import { SUBUNSUR_DATA } from './subunsur.js';

const UNSUR_MAP = {
  '1': '1. LINGKUNGAN PENGENDALIAN',
  '2': '2. PENILAIAN RISIKO',
  '3': '3. KEGIATAN PENGENDALIAN',
  '4': '4. INFORMASI DAN KOMUNIKASI',
  '5': '5. EVALUASI DAN PEMANTAUAN'
};

// Pemetaan nama field dari Frontend (camelCase) ke Database (snake_case)
const FIELD_MAP = {
  qaApip: 'qa_apip'
};

// Fungsi bantu untuk menghitung SA (Self Assessment) dari subunsur
function calculateSAFromSubunsur(subunsurs) {
    if (!subunsurs) return 0;
    let totalLevel = 0;
    let totalParams = 0;
    
    // Hitung TOTAL SEMUA PARAMETER (otomatis 43 karena looping data)
    Object.keys(SUBUNSUR_DATA).forEach(subCode => {
        if (SUBUNSUR_DATA[subCode].params) {
            totalParams += SUBUNSUR_DATA[subCode].params.length;
        }
    });
    
    // Jumlahkan semua level yang ada
    Object.keys(subunsurs).forEach(subCode => {
        Object.keys(subunsurs[subCode]).forEach(paramId => {
            const level = subunsurs[subCode][paramId].level;
            if (level > 0) {
                totalLevel += level;
            }
        });
    });
    
    // Rumus: Total Level / 43 (Total Semua Parameter)
    return totalParams > 0 ? Math.round((totalLevel / totalParams) * 100) / 100 : 0;
}

export const onRequest = async ({ request, env }) => {
  const ACCESS_PASSWORD = env.ACCESS_PASSWORD;
  const DELETE_PASSWORD = env.DELETE_PASSWORD;

  const url = new URL(request.url);
  let params = {};
  let action = url.searchParams.get('action') || '';

  if (request.method === 'POST') {
    try {
      params = await request.json();
      if (!action && params.action) action = params.action;
    } catch (e) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid JSON body' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } else {
    url.searchParams.forEach((value, key) => { params[key] = value; });
  }

  const year = params.year || '2026';

  // Ganti Buffer dengan Uint8Array + atob (hemat CPU)
  function getFolderStructure(params) {
    const { fileData, fileName, opdName, subunsur, paramId, level, fileType } = params;
    
    const binaryString = atob(fileData);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // UBAH BATASAN MENJADI 10MB
    if (bytes.length / 1024 / 1024 > 10) throw new Error('File > 10MB, terlalu besar!');

    const unsurKey = subunsur.split('.')[0];
    const unsurName = UNSUR_MAP[unsurKey] || `Unsur ${unsurKey}`;
    const safeOpd = opdName.replace(/[^a-zA-Z0-9\s.-]/g, '').substring(0, 80) || 'OPD';
    const subUnsurLabel = SUBUNSUR_DATA[subunsur] ? SUBUNSUR_DATA[subunsur].label : subunsur;
    const safeSubUnsur = subUnsurLabel.replace(/[^a-zA-Z0-9\s.-]/g, '').substring(0, 80);
    let paramDesc = paramId;
    if (SUBUNSUR_DATA[subunsur] && SUBUNSUR_DATA[subunsur].params) {
      const paramObj = SUBUNSUR_DATA[subunsur].params.find(p => p.id === paramId);
      if (paramObj) paramDesc = paramObj.desc;
    }
    const safeParam = paramDesc.replace(/[^a-zA-Z0-9\s.-]/g, '').substring(0, 100);

    const filePath = `kawal_spip/${year}/${safeOpd}/${unsurName}/${safeSubUnsur}/${safeParam}/Level_${level}/${fileName}`;
    return { filePath, bytes, fileType: fileType || 'application/octet-stream', fileName };
  }

  try {
    switch (action) {
      case 'getSubunsurData':
        return new Response(JSON.stringify(SUBUNSUR_DATA), { status: 200, headers: { 'Content-Type': 'application/json' } });
      case 'verifyAccess':
        return new Response(JSON.stringify({ status: params.password === ACCESS_PASSWORD ? 'success' : 'error', message: params.password === ACCESS_PASSWORD ? 'Akses diterima' : 'Password salah' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      case 'verifyDelete':
        return new Response(JSON.stringify({ status: params.password === DELETE_PASSWORD ? 'success' : 'error', message: params.password === DELETE_PASSWORD ? 'Password hapus benar' : 'Password hapus salah' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      
      // ====== DATABASE CLOUDFLARE D1 ======
      case 'getData': {
        const { results } = await env.DB.prepare("SELECT * FROM opd_data WHERE year = ?").bind(year).all();
        const mapped = results.map(r => {
            const subunsurs = r.subunsurs ? JSON.parse(r.subunsurs) : {};
            const sa = calculateSAFromSubunsur(subunsurs);
            return { ...r, subunsurs, qaApip: r.qa_apip || 'Belum', sa: sa };
        });
        return new Response(JSON.stringify(mapped), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      case 'addOpd': {
        const id = params.id || 'r' + Math.random().toString(36).slice(2,9);
        const opd = params.opd || 'OPD Baru';
        const subunsurs = params.subunsurs || {};
        const sa = calculateSAFromSubunsur(subunsurs);

        await env.DB.prepare("INSERT OR REPLACE INTO opd_data (id, opd, sa, evidence, qa_apip, mri, iepk, rtp, status, subunsurs, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(id, opd, sa, params.evidence||'Belum', params.qaApip||'Belum', parseFloat(params.mri)||0, parseFloat(params.iepk)||0, params.rtp||'Belum', params.status||'Belum', JSON.stringify(subunsurs), year).run();
        return new Response(JSON.stringify({ status: 'success', message: 'OPD berhasil ditambahkan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'saveData': {
        const rows = JSON.parse(params.rows);
        for (const row of rows) {
          const subunsurs = row.subunsurs || {};
          const sa = calculateSAFromSubunsur(subunsurs);

          await env.DB.prepare("INSERT OR REPLACE INTO opd_data (id, opd, sa, evidence, qa_apip, mri, iepk, rtp, status, subunsurs, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(row.id, row.opd||'', sa, row.evidence||'Belum', row.qaApip||'Belum', parseFloat(row.mri)||0, parseFloat(row.iepk)||0, row.rtp||'Belum', row.status||'Belum', JSON.stringify(subunsurs), year).run();
        }
        return new Response(JSON.stringify({ status: 'success', message: 'Data tersimpan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      // ====== PERBAIKAN UTAMA DI SINI ======
      case 'saveField': {
        const { opdId, field, value } = params;
        const dbField = FIELD_MAP[field] || field;
        await env.DB.prepare(`UPDATE opd_data SET ${dbField} = ? WHERE id = ?`).bind(value, opdId).run();
        return new Response(JSON.stringify({ status: 'success', message: 'Field tersimpan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      case 'deleteOpd': {
        if (params.opdId === 'all') await env.DB.prepare("DELETE FROM opd_data WHERE year = ?").bind(year).run();
        else await env.DB.prepare("DELETE FROM opd_data WHERE id = ?").bind(params.opdId).run();
        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      // ====== TAHUN ======
      case 'getYears': {
        const { results } = await env.DB.prepare("SELECT year FROM years").all();
        const years = results.map(x => x.year);
        if (!years.includes('2026')) years.push('2026');
        return new Response(JSON.stringify([...new Set(years)].sort()), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      case 'addYear': {
        await env.DB.prepare("INSERT OR IGNORE INTO years (year) VALUES (?)").bind(params.year).run();
        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      case 'deleteYear': {
        await env.DB.prepare("DELETE FROM opd_data WHERE year = ?").bind(params.year).run();
        await env.DB.prepare("DELETE FROM years WHERE year = ?").bind(params.year).run();
        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      // ====== FILE (UPLOAD VIA WORKER) ======
      case 'uploadFile': {
        const { filePath, bytes, fileType, fileName } = getFolderStructure(params);
        
        await env.EVIDENCE_BUCKET.put(filePath, bytes, { httpMetadata: { contentType: fileType } });

        const publicUrl = `https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${filePath}`;
        
        return new Response(JSON.stringify({ url: publicUrl, fileName }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      case 'deleteFile': {
        const cleanUrl = params.fileUrl.split('?')[0];
        const marker = 'r2.dev/';
        const idx = cleanUrl.indexOf(marker);
        if (idx !== -1) {
          const filePath = decodeURIComponent(cleanUrl.substring(idx + marker.length));
          await env.EVIDENCE_BUCKET.delete(filePath);
        }
        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // ====== FITUR BACKUP ======
      case 'listBackups':
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      case 'createBackup':
        return new Response(JSON.stringify({ status: 'success', message: 'Backup tidak tersedia di konfigurasi ini' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      case 'restoreBackup':
        return new Response(JSON.stringify({ status: 'error', message: 'Backup tidak tersedia' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      case 'deleteBackup':
        return new Response(JSON.stringify({ status: 'success', message: 'Backup dihapus' }), { status: 200, headers: { 'Content-Type': 'application/json' } });

      default:
        return new Response(JSON.stringify({ status: 'error', message: 'Aksi tidak dikenal: ' + action }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Error: ' + err.message }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};
