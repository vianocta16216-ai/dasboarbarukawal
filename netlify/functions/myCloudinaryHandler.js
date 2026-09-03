const { createClient } = require('@supabase/supabase-js');
const { SUBUNSUR_DATA } = require('./subunsur');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;
const DELETE_PASSWORD = process.env.DELETE_PASSWORD;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const UNSUR_MAP = {
  '1': '1. LINGKUNGAN PENGENDALIAN',
  '2': '2. PENILAIAN RISIKO',
  '3': '3. KEGIATAN PENGENDALIAN',
  '4': '4. INFORMASI DAN KOMUNIKASI',
  '5': '5. EVALUASI DAN PEMANTAUAN'
};

async function uploadFileToSupabase(params) {
  const { fileData, fileName, year, opdName, subunsur, paramId, level } = params;
  const bytes = Buffer.from(fileData, 'base64');
  if (bytes.length / 1024 / 1024 > 5) throw new Error('File > 5MB, terlalu besar!');

  // ====== PERBAIKAN NAMA FOLDER ======
  const unsurKey = subunsur.split('.')[0];
  const unsurName = UNSUR_MAP[unsurKey] || `Unsur ${unsurKey}`;
  const safeOpd = opdName.replace(/[^a-zA-Z0-9\s.-]/g, '').substring(0, 80) || 'OPD';

  // Ambil label Sub-Unsur (contoh: "1.1 Penegakan Integritas...")
  const subUnsurLabel = SUBUNSUR_DATA[subunsur] ? SUBUNSUR_DATA[subunsur].label : subunsur;
  const safeSubUnsur = subUnsurLabel.replace(/[^a-zA-Z0-9\s.-]/g, '').substring(0, 80);

  // Ambil deskripsi Parameter (contoh: "K/L/D menegakkan...")
  let paramDesc = paramId;
  if (SUBUNSUR_DATA[subunsur] && SUBUNSUR_DATA[subunsur].params) {
    const paramObj = SUBUNSUR_DATA[subunsur].params.find(p => p.id === paramId);
    if (paramObj) paramDesc = paramObj.desc;
  }
  const safeParam = paramDesc.replace(/[^a-zA-Z0-9\s.-]/g, '').substring(0, 100);

  const filePath = `kawal_spip/${year}/${safeOpd}/${unsurName}/${safeSubUnsur}/${safeParam}/Level_${level}/${fileName}`;

  // Upload ke bucket KAWALSPIP
  const { error } = await supabase.storage
    .from('KAWALSPIP')
    .upload(filePath, bytes, { contentType: 'application/octet-stream', upsert: true });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('KAWALSPIP').getPublicUrl(filePath);

  // Kembalikan objek berisi URL dan Nama File ASLI
  return { url: data.publicUrl, fileName };
}

exports.handler = async (event) => {
  // (Bagian switch-case lain TIDAK BERUBAH, gunakan yang sudah benar)
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
        const result = await uploadFileToSupabase(params);
        return res(result);
      }
      case 'deleteFile': {
        const cleanUrl = params.fileUrl.split('?')[0];
        const parts = cleanUrl.split('/');
        const bucketIndex = parts.indexOf('KAWALSPIP');
        if (bucketIndex !== -1 && parts.length > bucketIndex + 1) {
          const filePath = parts.slice(bucketIndex + 1).join('/');
          await supabase.storage.from('KAWALSPIP').remove([filePath]);
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
