// netlify/functions/proxy.js
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const busboy = require('busboy');
const { SUBUNSUR_DATA } = require('./subunsur');

// ====== KONFIGURASI ======
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_DRIVE_ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;
const DELETE_PASSWORD = process.env.DELETE_PASSWORD;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!SUPABASE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!GOOGLE_DRIVE_ROOT_FOLDER_ID) missing.push('GOOGLE_DRIVE_ROOT_FOLDER_ID');
if (!ACCESS_PASSWORD) missing.push('ACCESS_PASSWORD');
if (!DELETE_PASSWORD) missing.push('DELETE_PASSWORD');
if (!GOOGLE_SERVICE_ACCOUNT_JSON) missing.push('GOOGLE_SERVICE_ACCOUNT_JSON');
if (missing.length) throw new Error('Env: ' + missing.join(', '));

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let drive;
function getDrive() {
  if (drive) return drive;
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    drive = google.drive({ version: 'v3', auth });
  } catch (e) { throw new Error('Google auth: ' + e.message); }
  return drive;
}

async function getOrCreateFolder(parentId, name) {
  const res = await getDrive().files.list({
    q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}'`,
    fields: 'files(id, name)', spaces: 'drive'
  });
  if (res.data.files.length) return res.data.files[0].id;
  const folder = await getDrive().files.create({
    resource: { name, mimeType: 'application/vnd.google-apps.folder' }, fields: 'id'
  });
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
  const file = await getDrive().files.create({
    resource: { name: uniqueName, parents: [levelFolder] },
    media: { mimeType: 'application/octet-stream', body: bytes },
    fields: 'id, webViewLink'
  });
  return `https://drive.google.com/file/d/${file.data.id}/view`;
}

async function deleteFileFromDrive(fileUrl) {
  const fileId = fileUrl.match(/[-\w]{25,}/)[0];
  await getDrive().files.delete({ fileId });
}

function mapDBToFront(row) {
  if (!row) return row;
  return { ...row, qaApip: row.qa_apip || row.qaApip || 'Belum', qa_apip: row.qa_apip || row.qaApip || 'Belum' };
}
function mapFrontToDB(row) {
  if (!row) return row;
  return { ...row, qa_apip: row.qaApip || row.qa_apip || 'Belum' };
}
const ALLOWED = ['sa', 'evidence', 'qa_apip', 'qaApip', 'mri', 'iepk', 'rtp', 'status', 'opd', 'subunsurs'];

// ====== HELPER UNTUK MEMPROSES FORMDATA ======
function parseFormData(event) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: event.headers });
    const fields = {};
    let fileBuffer = Buffer.alloc(0);
    let filename = '';

    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('file', (name, stream, info) => {
      filename = info.filename;
      stream.on('data', (data) => { fileBuffer = Buffer.concat([fileBuffer, data]); });
      stream.on('end', () => {});
    });
    bb.on('finish', () => { resolve({ fields, fileBuffer, filename }); });
    bb.on('error', reject);

    let bodyBuffer;
    if (event.isBase64Encoded) {
      bodyBuffer = Buffer.from(event.body, 'base64');
    } else {
      bodyBuffer = Buffer.from(event.body || '');
    }
    bb.end(bodyBuffer);
  });
}

// ====== HANDLER UTAMA ======
exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  let params = {};
  try {
    let bodyStr = event.body || '';
    if (event.isBase64Encoded) bodyStr = Buffer.from(bodyStr, 'base64').toString('utf8');
    if (bodyStr) params = JSON.parse(bodyStr);
    else if (event.queryStringParameters) params = event.queryStringParameters;
  } catch (e) { return jsonRes({ status: 'error', message: 'Format body tidak valid' }, headers); }

  const action = params.action || '';
  const year = params.year || '2026';

  try {
    switch (action) {
      case 'verifyAccess': return jsonRes({ status: params.password === ACCESS_PASSWORD ? 'success' : 'error', message: params.password === ACCESS_PASSWORD ? 'Akses diterima' : 'Password salah' }, headers);
      case 'verifyDelete': return jsonRes({ status: params.password === DELETE_PASSWORD ? 'success' : 'error', message: params.password === DELETE_PASSWORD ? 'Password hapus benar' : 'Password hapus salah' }, headers);
      case 'getData': {
        const { data, error } = await supabase.from('opd_data').select('*').eq('year', year);
        if (error) throw error;
        return jsonRes((data || []).map(mapDBToFront), headers);
      }
      case 'saveData': {
        const rows = JSON.parse(params.rows);
        if (!Array.isArray(rows)) throw new Error('Format rows tidak valid');
        for (const row of rows) {
          const payload = mapFrontToDB({ id: row.id, opd: row.opd || '', sa: parseFloat(row.sa) || 0, evidence: row.evidence || 'Belum', qa_apip: row.qaApip || 'Belum', mri: parseFloat(row.mri) || 0, iepk: parseFloat(row.iepk) || 0, rtp: row.rtp || 'Belum', status: row.status || 'Belum', subunsurs: row.subunsurs || {}, year });
          const { error } = await supabase.from('opd_data').upsert(payload, { onConflict: 'id' });
          if (error) throw error;
        }
        return jsonRes({ status: 'success', message: 'Data berhasil disimpan' }, headers);
      }
      case 'saveField': {
        const { opdId, field, value } = params;
        if (!opdId || !field) return jsonRes({ status: 'error', message: 'Parameter opdId dan field wajib diisi' }, headers);
        if (!ALLOWED.includes(field)) return jsonRes({ status: 'error', message: `Field '${field}' tidak diizinkan` }, headers);
        const fieldMap = { 'qaApip': 'qa_apip', 'qa_apip': 'qa_apip' };
        const dbField = fieldMap[field] || field;
        const { error } = await supabase.from('opd_data').update({ [dbField]: value }).eq('id', opdId);
        if (error) throw error;
        return jsonRes({ status: 'success', message: 'Field berhasil disimpan' }, headers);
      }
      case 'deleteOpd': {
        const { opdId } = params;
        if (!opdId) return jsonRes({ status: 'error', message: 'Parameter opdId wajib diisi' }, headers);
        if (opdId === 'all') await supabase.from('opd_data').delete().eq('year', year);
        else await supabase.from('opd_data').delete().eq('id', opdId);
        return jsonRes({ status: 'success', message: 'OPD berhasil dihapus' }, headers);
      }
      case 'getYears': {
        const { data } = await supabase.from('years').select('year');
        const years = data.map(item => item.year);
        if (!years.includes('2026')) years.push('2026');
        return jsonRes([...new Set(years)].sort((a,b) => b.localeCompare(a)), headers);
      }
      case 'addYear': {
        const newYear = params.year;
        if (!/^\d{4}$/.test(newYear)) return jsonRes({ status: 'error', message: 'Tahun tidak valid' }, headers);
        const { error } = await supabase.from('years').insert({ year: newYear });
        if (error) throw error;
        return jsonRes({ status: 'success', message: 'Tahun berhasil ditambahkan' }, headers);
      }
      case 'deleteYear': {
        const delYear = params.year;
        if (delYear === '2026') return jsonRes({ status: 'error', message: 'Tahun default tidak boleh dihapus' }, headers);
        await supabase.from('opd_data').delete().eq('year', delYear);
        await supabase.from('years').delete().eq('year', delYear);
        return jsonRes({ status: 'success', message: 'Tahun berhasil dihapus' }, headers);
      }
      
      // ====== PERBAIKAN UPLOAD: MENERIMA FORMDATA ======
      case 'uploadFile': {
        // Jika Content-Type adalah multipart/form-data
        if (event.headers['content-type'] && event.headers['content-type'].includes('multipart/form-data')) {
          try {
            const { fields, fileBuffer, filename } = await parseFormData(event);
            
            const paramsForDrive = {
              fileData: fileBuffer.toString('base64'), // Convert Buffer ke Base64 untuk diproses
              fileName: filename,
              opdName: fields.opdName,
              subunsur: fields.subunsur,
              paramId: fields.paramId,
              paramLabel: fields.paramLabel,
              level: fields.level,
              year: fields.year || year
            };
            
            const fileUrl = await uploadFileToDrive(paramsForDrive);
            return jsonRes(fileUrl, headers);
          } catch (err) {
            return jsonRes({ status: 'error', message: 'Upload error: ' + err.message }, headers);
          }
        }
        
        // Fallback: Jika masih ada yang kirim JSON base64
        const fileUrl = await uploadFileToDrive(params);
        return jsonRes(fileUrl, headers);
      }

      case 'deleteFile': {
        if (!params.fileUrl) return jsonRes({ status: 'error', message: 'Parameter fileUrl wajib diisi' }, headers);
        await deleteFileFromDrive(params.fileUrl);
        return jsonRes({ status: 'success', message: 'File dihapus' }, headers);
      }
      case 'createBackup': {
        const { data: rows } = await supabase.from('opd_data').select('*').eq('year', year);
        const folderId = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`);
        const backupFolder = await getOrCreateFolder(folderId, 'backup');
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '_').slice(0, 19);
        const fileName = `backup_${timestamp}.json`;
        await getDrive().files.create({ resource: { name: fileName, parents: [backupFolder] }, media: { mimeType: 'application/json', body: JSON.stringify(rows) }, fields: 'id' });
        return jsonRes({ status: 'success', message: 'Backup berhasil dibuat', fileName }, headers);
      }
      case 'listBackups': {
        const folderId = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`);
        const backupFolder = await getOrCreateFolder(folderId, 'backup');
        const res = await getDrive().files.list({ q: `'${backupFolder}' in parents and trashed=false`, fields: 'files(id, name, size, createdTime)', orderBy: 'createdTime desc' });
        return jsonRes(res.data.files.map(file => ({ fileName: file.name, timestamp: file.createdTime, size: Math.round(file.size / 1024), count: 0 })), headers);
      }
      case 'restoreBackup': {
        const { fileName } = params;
        if (!fileName) return jsonRes({ status: 'error', message: 'Parameter fileName wajib diisi' }, headers);
        const folderId = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`);
        const backupFolder = await getOrCreateFolder(folderId, 'backup');
        const res = await getDrive().files.list({ q: `'${backupFolder}' in parents and name='${fileName}' and trashed=false`, fields: 'files(id)' });
        if (res.data.files.length === 0) return jsonRes({ status: 'error', message: 'Backup tidak ditemukan' }, headers);
        const fileId = res.data.files[0].id;
        const content = await getDrive().files.get({ fileId, alt: 'media' });
        const rows = JSON.parse(content.data);
        await supabase.from('opd_data').delete().eq('year', year);
        for (const row of rows) { const { error } = await supabase.from('opd_data').insert(row); if (error) throw error; }
        return jsonRes({ status: 'success', message: 'Backup berhasil dipulihkan' }, headers);
      }
      case 'deleteBackup': {
        const { fileName } = params;
        if (!fileName) return jsonRes({ status: 'error', message: 'Parameter fileName wajib diisi' }, headers);
        const folderId = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`);
        const backupFolder = await getOrCreateFolder(folderId, 'backup');
        const res = await getDrive().files.list({ q: `'${backupFolder}' in parents and name='${fileName}' and trashed=false`, fields: 'files(id)' });
        if (res.data.files.length > 0) await getDrive().files.delete({ fileId: res.data.files[0].id });
        return jsonRes({ status: 'success', message: 'Backup dihapus' }, headers);
      }
      case 'getSubunsurData': return jsonRes(SUBUNSUR_DATA, headers);
      default: return jsonRes({ status: 'error', message: `Aksi '${action}' tidak dikenal` }, headers);
    }
  } catch (err) {
    console.error('Error di Netlify Function:', err);
    return jsonRes({ status: 'error', message: 'Terjadi kesalahan: ' + err.message }, headers);
  }
};
function jsonRes(obj, headers) { return { statusCode: 200, headers, body: JSON.stringify(obj) }; }
