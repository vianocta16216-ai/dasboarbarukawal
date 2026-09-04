import { createClient } from '@supabase/supabase-js';
import { SUBUNSUR_DATA } from './subunsur.js';

const UNSUR_MAP = {
  '1': '1. LINGKUNGAN PENGENDALIAN',
  '2': '2. PENILAIAN RISIKO',
  '3': '3. KEGIATAN PENGENDALIAN',
  '4': '4. INFORMASI DAN KOMUNIKASI',
  '5': '5. EVALUASI DAN PEMANTAUAN'
};

export const onRequest = async ({ request, env }) => {
  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const ACCESS_PASSWORD = env.ACCESS_PASSWORD;
  const DELETE_PASSWORD = env.DELETE_PASSWORD;

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const url = new URL(request.url);
  let params = {};
  
  // PERBAIKAN PENTING: Ubah const menjadi let
  let action = url.searchParams.get('action') || '';

  if (request.method === 'POST') {
    try {
      params = await request.json();
      // PERBAIKAN PENTING: Jika action kosong di URL, ambil dari Body JSON!
      if (!action && params.action) {
        action = params.action;
      }
    } catch (e) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid JSON body' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } else {
    url.searchParams.forEach((value, key) => { params[key] = value; });
  }

  const year = params.year || '2026';

  function getFolderStructure(params) {
    const { fileData, fileName, opdName, subunsur, paramId, level, fileType } = params;
    const bytes = Buffer.from(fileData, 'base64');
    if (bytes.length / 1024 / 1024 > 5) throw new Error('File > 5MB, terlalu besar!');

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
      // ====== Aksi Dasar ======
      case 'getSubunsurData':
        return new Response(JSON.stringify(SUBUNSUR_DATA), { status: 200, headers: { 'Content-Type': 'application/json' } });
      case 'verifyAccess':
        return new Response(JSON.stringify({ status: params.password === ACCESS_PASSWORD ? 'success' : 'error', message: params.password === ACCESS_PASSWORD ? 'Akses diterima' : 'Password salah' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      case 'verifyDelete':
        return new Response(JSON.stringify({ status: params.password === DELETE_PASSWORD ? 'success' : 'error', message: params.password === DELETE_PASSWORD ? 'Password hapus benar' : 'Password hapus salah' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      
      // ====== Data OPD ======
      case 'getData': {
        const { data, error } = await supabase.from('opd_data').select('*').eq('year', year);
        if (error) throw error;
        const mapped = data.map(r => ({ ...r, qaApip: r.qa_apip || r.qaApip || 'Belum' }));
        return new Response(JSON.stringify(mapped), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      case 'addOpd': {
        const { id, opd, sa, evidence, qaApip, mri, iepk, rtp, status, subunsurs } = params;
        const payload = { id: id || 'r' + Math.random().toString(36).slice(2,9), opd: opd || 'OPD Baru', sa: parseFloat(sa) || 0, evidence: evidence || 'Belum', qa_apip: qaApip || 'Belum', mri: parseFloat(mri) || 0, iepk: parseFloat(iepk) || 0, rtp: rtp || 'Belum', status: status || 'Belum', subunsurs: subunsurs || {}, year };
        await supabase.from('opd_data').upsert(payload, { onConflict: 'id' });
        return new Response(JSON.stringify({ status: 'success', message: 'OPD berhasil ditambahkan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'saveData': {
        const rows = JSON.parse(params.rows);
        for (const row of rows) {
          const payload = { id: row.id, opd: row.opd || '', sa: parseFloat(row.sa) || 0, evidence: row.evidence || 'Belum', qa_apip: row.qaApip || 'Belum', mri: parseFloat(row.mri) || 0, iepk: parseFloat(row.iepk) || 0, rtp: row.rtp || 'Belum', status: row.status || 'Belum', subunsurs: row.subunsurs || {}, year };
          await supabase.from('opd_data').upsert(payload, { onConflict: 'id' });
        }
        return new Response(JSON.stringify({ status: 'success', message: 'Data tersimpan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      case 'saveField': {
        const { opdId, field, value } = params;
        const updateObj = {};
        updateObj[field] = value;
        await supabase.from('opd_data').update(updateObj).eq('id', opdId);
        return new Response(JSON.stringify({ status: 'success', message: 'Field tersimpan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      case 'deleteOpd': {
        if (params.opdId === 'all') await supabase.from('opd_data').delete().eq('year', year);
        else await supabase.from('opd_data').delete().eq('id', params.opdId);
        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      // ====== Tahun ======
      case 'getYears': {
        const { data } = await supabase.from('years').select('year');
        const years = data.map(x => x.year);
        if (!years.includes('2026')) years.push('2026');
        return new Response(JSON.stringify([...new Set(years)].sort()), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      case 'addYear': {
        await supabase.from('years').insert({ year: params.year });
        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      case 'deleteYear': {
        await supabase.from('opd_data').delete().eq('year', params.year);
        await supabase.from('years').delete().eq('year', params.year);
        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      // ====== File ======
      case 'uploadFile': {
        const { filePath, bytes, fileType, fileName } = getFolderStructure(params);
        const { error } = await supabase.storage
          .from('KAWALSPIP')
          .upload(filePath, bytes, { contentType: fileType, upsert: true });
        if (error) throw new Error(error.message);
        const { data } = supabase.storage.from('KAWALSPIP').getPublicUrl(filePath);
        return new Response(JSON.stringify({ url: data.publicUrl, fileName }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      case 'deleteFile': {
        const cleanUrl = params.fileUrl.split('?')[0];
        const marker = '/object/public/KAWALSPIP/';
        const idx = cleanUrl.indexOf(marker);
        if (idx !== -1) {
          const filePath = decodeURIComponent(cleanUrl.substring(idx + marker.length));
          await supabase.storage.from('KAWALSPIP').remove([filePath]);
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
