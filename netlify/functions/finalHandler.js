const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { SUBUNSUR_DATA } = require('./subunsur');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_DRIVE_ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;
const DELETE_PASSWORD = process.env.DELETE_PASSWORD;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let drive;
function getDrive() {
  if (drive) return drive;
  try {
    const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON), scopes: ['https://www.googleapis.com/auth/drive'] });
    drive = google.drive({ version: 'v3', auth });
  } catch (e) { throw new Error('Google auth: ' + e.message); }
  return drive;
}

async function getOrCreateFolder(parentId, name) {
  const res = await getDrive().files.list({ q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}'`, fields: 'files(id, name)', spaces: 'drive' });
  if (res.data.files.length) return res.data.files[0].id;
  const folder = await getDrive().files.create({ resource: { name, mimeType: 'application/vnd.google-apps.folder' }, fields: 'id' });
  return folder.data.id;
}

async function uploadFileToDrive(params) {
  const { fileData, fileName, year, opdName, subunsur, paramId, paramLabel, level } = params;
  const bytes = Buffer.from(fileData, 'base64');
  if (bytes.length / 1024 / 1024 > 5) throw new Error('File > 5MB, terlalu besar untuk query string!');
  const yearFolder = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`);
  const opdFolder = await getOrCreateFolder(yearFolder, opdName);
  const unsurMap = { '1': '1. LINGKUNGAN PENGENDALIAN', '2': '2. PENILAIAN RISIKO', '3': '3. KEGIATAN PENGENDALIAN', '4': '4. INFORMASI DAN KOMUNIKASI', '5': '5. EVALUASI DAN PEMANTAUAN' };
  const unsurCode = subunsur.split('.')[0];
  const unsurFolder = await getOrCreateFolder(opdFolder, unsurMap[unsurCode] || `Unsur ${unsurCode}`);
  const subUnsurFolder = await getOrCreateFolder(unsurFolder, subunsur);
  let paramName = paramLabel;
  if (paramName.includes(' - ')) paramName = paramName.split(' - ')[1];
  else if (paramName.includes('-')) paramName = paramName.split('-')[1];
  if (!paramName || paramName.trim() === '') paramName = paramId;
  paramName = paramName.trim();
  const paramFolder = await getOrCreateFolder(subUnsurFolder, paramName);
  const levelFolder = await getOrCreateFolder(paramFolder, `Level ${level}`);
  const uniqueName = Date.now() + '_' + fileName;
  const file = await getDrive().files.create({ resource: { name: uniqueName, parents: [levelFolder] }, media: { mimeType: 'application/octet-stream', body: bytes }, fields: 'id, webViewLink' });
  return `https://drive.google.com/file/d/${file.data.id}/view`;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  // ===== HANYA BACA QUERY STRING (TIDAK PERNAH MENYENTUH event.body) =====
  const params = event.queryStringParameters || {};

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
        const fileUrl = await uploadFileToDrive(params);
        return res(fileUrl);
      }
      case 'deleteFile': {
        const fileId = params.fileUrl.match(/[-\w]{25,}/)[0];
        await getDrive().files.delete({ fileId });
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
