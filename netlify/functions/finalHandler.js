// netlify/functions/finalHandler.js
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

async function uploadFileToDrive({ fileData, fileName, year, opdName, subunsur, paramId, paramLabel, level }) {
  const bytes = Buffer.from(fileData, 'base64');
  if (bytes.length / 1024 / 1024 > 20) throw new Error('File >20MB');
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

  // ===== PENTING: Menerima Body dari POST DAN Query dari GET =====
  let params = {};
  try {
    if (event.body) {
      let bodyStr = event.body || '';
      if (event.isBase64Encoded) bodyStr = Buffer.from(bodyStr, 'base64').toString('utf8');
      try {
        params = JSON.parse(bodyStr);
      } catch (e) {
        const urlParams = new URLSearchParams(bodyStr);
        params = Object.fromEntries(urlParams);
      }
    }

    if (event.queryStringParameters) {
      params = { ...params, ...event.queryStringParameters };
    }

    console.log("Diterima di FinalHandler:", JSON.stringify(params));

  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'error', message: 'Format body harus JSON atau FormData. Error: ' + e.message }) };
  }

  const action = params.action || '';
  const year = params.year || '2026';

  try {
    switch (action) {
      case 'getSubunsurData': return res(SUBUNSUR_DATA);

      case 'verifyAccess': return res({ status: params.password === ACCESS_PASSWORD ? 'success' : 'error', message: params.password === ACCESS_PASSWORD ? 'Akses diterima' : 'Password salah' });
      case 'verifyDelete': return res({ status: params.password === DELETE_PASSWORD ? 'success' : 'error', message: params.password === DELETE_PASSWORD ? 'Password hapus benar' : 'Password hapus salah' });
      case 'getData': { const { data, error } = await supabase.from('opd_data').select('*').eq('year', year); if (error) throw error; return res((data || [])); }
      case 'saveData': { const rows = JSON.parse(params.rows); for (const row of rows) { const payload = { id: row.id, opd: row.opd || '', sa: parseFloat(row.sa) || 0, evidence: row.evidence || 'Belum', qa_apip: row.qaApip || 'Belum', mri: parseFloat(row.mri) || 0, iepk: parseFloat(row.iepk) || 0, rtp: row.rtp || 'Belum', status: row.status || 'Belum', subunsurs: row.subunsurs || {}, year }; await supabase.from('opd_data').upsert(payload, { onConflict: 'id' }); } return res({ status: 'success', message: 'Data tersimpan' }); }
      case 'saveField': { const { opdId, field, value } = params; const updateObj = {}; updateObj[field] = value; await supabase.from('opd_data').update(updateObj).eq('id', opdId); return res({ status: 'success', message: 'Field tersimpan' }); }
      case 'deleteOpd': { if (params.opdId === 'all') await supabase.from('opd_data').delete().eq('year', year); else await supabase.from('opd_data').delete().eq('id', params.opdId); return res({ status: 'success' }); }
      case 'getYears': { const { data } = await supabase.from('years').select('year'); const years = data.map(x => x.year); if (!years.includes('2026')) years.push('2026'); return res([...new Set(years)].sort()); }
      case 'addYear': { await supabase.from('years').insert({ year: params.year }); return res({ status: 'success' }); }
      case 'deleteYear': { await supabase.from('opd_data').delete().eq('year', params.year); await supabase.from('years').delete().eq('year', params.year); return res({ status: 'success' }); }
      case 'uploadFile': { const fileUrl = await uploadFileToDrive(params); return res(fileUrl); }
      case 'deleteFile': { const fileId = params.fileUrl.match(/[-\w]{25,}/)[0]; await getDrive().files.delete({ fileId }); return res({ status: 'success' }); }
      case 'createBackup': { const { data: rows } = await supabase.from('opd_data').select('*').eq('year', year); const folderId = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`); const backupFolder = await getOrCreateFolder(folderId, 'backup'); const timestamp = new Date().toISOString().replace(/[-:T]/g, '_').slice(0, 19); const fileName = `backup_${timestamp}.json`; await getDrive().files.create({ resource: { name: fileName, parents: [backupFolder] }, media: { mimeType: 'application/json', body: JSON.stringify(rows) }, fields: 'id' }); return res({ status: 'success', message: 'Backup berhasil', fileName }); }
      case 'listBackups': { const folderId = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`); const backupFolder = await getOrCreateFolder(folderId, 'backup'); const files = await getDrive().files.list({ q: `'${backupFolder}' in parents and trashed=false`, fields: 'files(id, name, size, createdTime)', orderBy: 'createdTime desc' }); return res(files.data.map(f => ({ fileName: f.name, timestamp: f.createdTime, size: Math.round(f.size / 1024) }))); }
      case 'restoreBackup': { const folderId = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`); const backupFolder = await getOrCreateFolder(folderId, 'backup'); const files = await getDrive().files.list({ q: `'${backupFolder}' in parents and name='${params.fileName}' and trashed=false`, fields: 'files(id)' }); const fileId = files.data[0].id; const content = await getDrive().files.get({ fileId, alt: 'media' }); const rows = JSON.parse(content.data); await supabase.from('opd_data').delete().eq('year', year); for (const row of rows) await supabase.from('opd_data').insert(row); return res({ status: 'success' }); }
      case 'deleteBackup': { const folderId = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`); const backupFolder = await getOrCreateFolder(folderId, 'backup'); const files = await getDrive().files.list({ q: `'${backupFolder}' in parents and name='${params.fileName}' and trashed=false`, fields: 'files(id)' }); if (files.data.length) await getDrive().files.delete({ fileId: files.data[0].id }); return res({ status: 'success' }); }
      default: return res({ status: 'error', message: 'Aksi tidak dikenal: ' + action });
    }
  } catch (err) {
    return res({ status: 'error', message: 'Error: ' + err.message });
  }

  function res(obj) {
    return { statusCode: 200, headers, body: JSON.stringify(obj) };
  }
};
