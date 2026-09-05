import { SUBUNSUR_DATA } from './subunsur.js';

const UNSUR_MAP = {
  '1': '1. LINGKUNGAN PENGENDALIAN',
  '2': '2. PENILAIAN RISIKO',
  '3': '3. KEGIATAN PENGENDALIAN',
  '4': '4. INFORMASI DAN KOMUNIKASI',
  '5': '5. EVALUASI DAN PEMANTAUAN'
};

const FIELD_MAP = {
  qaApip: 'qa_apip'
};

function calculateSAFromSubunsur(subunsurs) {
    if (!subunsurs) return 0;
    let totalLevel = 0;
    let totalParams = 0;
    
    Object.keys(SUBUNSUR_DATA).forEach(subCode => {
        if (SUBUNSUR_DATA[subCode].params) {
            totalParams += SUBUNSUR_DATA[subCode].params.length;
        }
    });
    
    Object.keys(subunsurs).forEach(subCode => {
        Object.keys(subunsurs[subCode]).forEach(paramId => {
            const level = subunsurs[subCode][paramId].level;
            if (level > 0) totalLevel += level;
        });
    });
    
    return totalParams > 0 ? Math.round((totalLevel / totalParams) * 100) / 100 : 0;
}

export const onRequest = async ({ request, env }) => {
  // KEAMANAN: Password HANYA diambil dari Environment Variable di Cloudflare, tidak pernah ada di kode klien
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

  function getFolderStructure(params) {
    const { fileData, fileName, opdName, subunsur, paramId, level, fileType } = params;
    
    const binaryString = atob(fileData);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
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
        
      // KEAMANAN: Verifikasi password hanya di sini (server side)
      case 'verifyAccess':
        return new Response(JSON.stringify({ status: params.password === ACCESS_PASSWORD ? 'success' : 'error', message: params.password === ACCESS_PASSWORD ? 'Akses diterima' : 'Password salah' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        
      case 'verifyDelete':
        return new Response(JSON.stringify({ status: params.password === DELETE_PASSWORD ? 'success' : 'error', message: params.password === DELETE_PASSWORD ? 'Password hapus benar' : 'Password hapus salah' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      
      // ====== DATABASE CLOUDFLARE D1 ======
      case 'getData': {
        const { results } = await env.DB.prepare("SELECT * FROM opd_data WHERE year = ? ORDER BY CAST(mri AS REAL) DESC, CAST(iepk AS REAL) DESC").bind(year).all();
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
      case 'listBackups': {
        const prefix = `backup_${year}_`;
        let files;
        try {
          files = await env.EVIDENCE_BUCKET.list({ prefix });
        } catch (e) {
          return new Response(JSON.stringify({ status: 'error', message: 'Gagal list bucket: ' + e.message }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        
        const fileList = files && files.objects ? files.objects : [];
        
        const backups = await Promise.all(fileList.map(async obj => {
          if (!obj || !obj.key) return null;
          
          const fileName = obj.key;
          const timestampStr = fileName.replace(prefix, '').replace('.json', '');
          
          const parts = timestampStr.split('_');
          const datePart = parts[0];
          const timePart = parts[1] ? parts[1].replace(/-/g, ':') : '00:00:00';
          const fullDateStr = `${datePart}T${timePart}`;
          
          const date = new Date(fullDateStr);

          let count = 0;
          try {
            const file = await env.EVIDENCE_BUCKET.get(fileName);
            if (file) {
              const content = await file.text();
              const data = JSON.parse(content);
              if (Array.isArray(data)) {
                count = data.length;
              }
            }
          } catch (e) {
            count = 0;
          }

          return { 
            fileName, 
            timestamp: isNaN(date.getTime()) ? 'Tanggal tidak valid' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }), 
            size: Math.round((obj.size || 0) / 1024), 
            count: count
          };
        }));
        
        const validBackups = backups.filter(b => b !== null);

        return new Response(JSON.stringify(validBackups), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'createBackup': {
        const { results } = await env.DB.prepare("SELECT * FROM opd_data WHERE year = ?").bind(year).all();
        
        if (results.length === 0) {
          return new Response(JSON.stringify({ status: 'error', message: 'Tidak ada data OPD untuk tahun ini!' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        
        const fileName = `backup_${year}_${timestamp}.json`;
        const data = JSON.stringify(results);

        await env.EVIDENCE_BUCKET.put(fileName, data, { httpMetadata: { contentType: 'application/json' } });

        return new Response(JSON.stringify({ status: 'success', message: 'Backup berhasil dibuat', fileName }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'restoreBackup': {
        const { fileName } = params;
        const file = await env.EVIDENCE_BUCKET.get(fileName);
        
        if (!file) {
          return new Response(JSON.stringify({ status: 'error', message: 'Backup tidak ditemukan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        const data = JSON.parse(await file.text());
        
        await env.DB.prepare("DELETE FROM opd_data WHERE year = ?").bind(year).run();

        for (const row of data) {
          const subunsurs = row.subunsurs ? JSON.parse(row.subunsurs) : {};
          const sa = calculateSAFromSubunsur(subunsurs);

          await env.DB.prepare("INSERT OR REPLACE INTO opd_data (id, opd, sa, evidence, qa_apip, mri, iepk, rtp, status, subunsurs, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(row.id, row.opd||'', sa, row.evidence||'Belum', row.qa_apip || row.qaApip || 'Belum', parseFloat(row.mri)||0, parseFloat(row.iepk)||0, row.rtp||'Belum', row.status||'Belum', JSON.stringify(subunsurs), year).run();
        }

        return new Response(JSON.stringify({ status: 'success', message: 'Data berhasil dipulihkan dari backup' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'deleteBackup': {
        const { fileName } = params;
        await env.EVIDENCE_BUCKET.delete(fileName);
        return new Response(JSON.stringify({ status: 'success', message: 'Backup dihapus' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({ status: 'error', message: 'Aksi tidak dikenal: ' + action }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Error: ' + err.message }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};
