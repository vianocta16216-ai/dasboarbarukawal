// VERSION 8 - CLOUDINARY (RAW PDF, FIX ERROR 401)
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;
const { SUBUNSUR_DATA } = require('./subunsur');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;
const DELETE_PASSWORD = process.env.DELETE_PASSWORD;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const UNSUR_MAP = {
  '1': '1. LINGKUNGAN PENGENDALIAN',
  '2': '2. PENILAIAN RISIKO',
  '3': '3. KEGIATAN PENGENDALIAN',
  '4': '4. INFORMASI DAN KOMUNIKASI',
  '5': '5. EVALUASI DAN PEMANTAUAN'
};

async function uploadFileToCloudinary(params) {
  const { fileData, fileName, year, opdName, subunsur, paramId, level } = params;
  const bytes = Buffer.from(fileData, 'base64');
  if (bytes.length / 1024 / 1024 > 5) throw new Error('File > 5MB, terlalu besar!');

  // Folder tetap sesuai permintaan
  const unsurKey = subunsur.split('.')[0];
  const unsurName = UNSUR_MAP[unsurKey] || `Unsur ${unsurKey}`;
  const safeOpd = opdName.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50) || 'OPD';
  const folder = `kawal_spip/${year}/${safeOpd}/${unsurName}/${subunsur}/${paramId}/Level_${level}`;

  // Nama unik pendek (tanpa ekstensi ganda)
  const publicId = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);

  // ====== PERBAIKAN UTAMA: UBAH KE 'raw' ======
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { 
        resource_type: 'raw', // <-- RAW membuat URL menjadi /raw/upload/ (hilang 401)
        folder: folder, 
        public_id: publicId 
      },
      (error, uploadResult) => {
        if (error) reject(error);
        else resolve(uploadResult);
      }
    ).end(bytes);
  });

  // ====== HAPUS ?fl_attachment=false ======
  // Karena file RAW sudah otomatis dibuka langsung oleh browser (bukan di-download).
  return result.secure_url;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  let params = {};
  try {
    if (event.httpMethod === 'POST') params = JSON.parse(event.body || '{}');
    else params = event.queryStringParameters || {};
  } catch (e) {
    return res({ status: 'error', message: 'Invalid JSON body: ' + e.message });
  }

  const action = params.action || '';
  const year = params.year || '2026';

  try {
    switch (action) {
      case 'getSubunsurData': return res(SUBUNSUR_DATA);
      case 'verifyAccess': return res({ status: params.password === ACCESS_PASSWORD ? 'success' : 'error', message: params.password === ACCESS_PASSWORD ? 'Akses diterima' : 'Password salah' });
      case 'verifyDelete': return res({ status: params.password === DELETE_PASSWORD ? 'success' : 'error', message: params.password === DELETE_PASSWORD ? 'Password hapus benar' : 'Password hapus salah' });
      case 'getData': {
        const { data, error } = await supabase.from('opd_data').select('*').eq('year', year);
        if (error) throw error;
        const mapped = data.map(r => ({ ...r, qaApip: r.qa_apip || r.qaApip || 'Belum' }));
        return res(mapped);
      }
      case 'saveData': {
        const rows = JSON.parse(params.rows);
        for (const row of rows) {
          const payload = { id: row.id, opd: row.opd || '', sa: parseFloat(row.sa) || 0, evidence: row.evidence || 'Belum', qa_apip: row.qaApip || 'Belum', mri: parseFloat(row.mri) || 0, iepk: parseFloat(row.iepk) || 0, rtp: row.rtp || 'Belum', status: row.status || 'Belum', subunsurs: row.subunsurs || {}, year };
          await supabase.from('opd_data').upsert(payload, { onConflict: 'id' });
        }
        return res({ status: 'success', message: 'Data tersimpan' });
      }
      case 'saveField': {
        const { opdId, field, value } = params;
        const updateObj = {};
        updateObj[field] = value;
        await supabase.from('opd_data').update(updateObj).eq('id', opdId);
        return res({ status: 'success', message: 'Field tersimpan' });
      }
      case 'deleteOpd': {
        if (params.opdId === 'all') await supabase.from('opd_data').delete().eq('year', year);
        else await supabase.from('opd_data').delete().eq('id', params.opdId);
        return res({ status: 'success' });
      }
      case 'getYears': {
        const { data } = await supabase.from('years').select('year');
        const years = data.map(x => x.year);
        if (!years.includes('2026')) years.push('2026');
        return res([...new Set(years)].sort());
      }
      case 'addYear': {
        await supabase.from('years').insert({ year: params.year });
        return res({ status: 'success' });
      }
      case 'deleteYear': {
        await supabase.from('opd_data').delete().eq('year', params.year);
        await supabase.from('years').delete().eq('year', params.year);
        return res({ status: 'success' });
      }
      case 'uploadFile': {
        const fileUrl = await uploadFileToCloudinary(params);
        return res(fileUrl);
      }
      case 'deleteFile': {
        const cleanUrl = params.fileUrl.split('?')[0];
        const parts = cleanUrl.split('/');
        const rawIndex = parts.indexOf('raw');
        const uploadIndex = parts.indexOf('upload');
        const idx = rawIndex !== -1 ? rawIndex : uploadIndex;
        if (idx !== -1 && parts.length > idx + 1) {
          const publicId = parts.slice(idx + 1).join('/');
          await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
        }
        return res({ status: 'success' });
      }
      default: return res({ status: 'error', message: 'Aksi tidak dikenal: ' + action });
    }
  } catch (err) {
    return res({ status: 'error', message: 'Error: ' + err.message });
  }

  function res(obj) {
    return { statusCode: 200, headers, body: JSON.stringify(obj) };
  }
};
