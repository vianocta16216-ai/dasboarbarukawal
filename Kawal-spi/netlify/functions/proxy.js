// netlify/functions/proxy.js
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { SUBUNSUR_DATA } = require('./subunsur');

// ====== KONFIGURASI ======
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_DRIVE_ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;
const DELETE_PASSWORD = process.env.DELETE_PASSWORD;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

// Inisialisasi Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ====== GOOGLE DRIVE ======
let drive = null;

function getDrive() {
  if (drive) return drive;
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  drive = google.drive({ version: 'v3', auth });
  return drive;
}

// ====== HELPER GOOGLE DRIVE ======
async function getOrCreateFolder(parentId, folderName) {
  const res = await getDrive().files.list({
    q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}'`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  if (res.data.files.length > 0) return res.data.files[0].id;
  const folder = await getDrive().files.create({
    resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });
  return folder.data.id;
}

async function uploadFileToDrive({ fileData, fileName, year, opdName, subunsur, paramId, paramLabel, level }) {
  const bytes = Buffer.from(fileData, 'base64');
  const fileSizeMB = bytes.length / (1024 * 1024);
  if (fileSizeMB > 20) throw new Error('Ukuran file melebihi 20 MB');

  // Root folder tahun
  const yearFolder = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`);

  // Folder OPD
  const opdFolder = await getOrCreateFolder(yearFolder, opdName);

  // Folder unsur (level 1)
  const unsurMap = {
    '1': '1. LINGKUNGAN PENGENDALIAN',
    '2': '2. PENILAIAN RISIKO',
    '3': '3. KEGIATAN PENGENDALIAN',
    '4': '4. INFORMASI DAN KOMUNIKASI',
    '5': '5. EVALUASI DAN PEMANTAUAN'
  };
  const unsurCode = subunsur.split('.')[0];
  const unsurName = unsurMap[unsurCode] || `Unsur ${unsurCode}`;
  const unsurFolder = await getOrCreateFolder(opdFolder, unsurName);

  // Folder subunsur (level 2)
  const subUnsurFolder = await getOrCreateFolder(unsurFolder, subunsur);

  // Folder parameter
  let paramName = paramLabel;
  if (paramName.includes(' - ')) paramName = paramName.split(' - ')[1];
  else if (paramName.includes('-')) paramName = paramName.split('-')[1];
  if (!paramName || paramName.trim() === '') paramName = paramId;
  paramName = paramName.trim();
  const paramFolder = await getOrCreateFolder(subUnsurFolder, paramName);

  // Folder level
  const levelFolder = await getOrCreateFolder(paramFolder, `Level ${level}`);

  // Upload file
  const uniqueName = Date.now() + '_' + fileName;
  const fileMetadata = { name: uniqueName, parents: [levelFolder] };
  const media = { mimeType: 'application/octet-stream', body: bytes };
  const file = await getDrive().files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, webViewLink',
  });

  return `https://drive.google.com/file/d/${file.data.id}/view`;
}

async function deleteFileFromDrive(fileUrl) {
  const fileId = fileUrl.match(/[-\w]{25,}/)[0];
  await getDrive().files.delete({ fileId });
}

// ====== HANDLER UTAMA ======
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  let params = {};
  try {
    if (event.body) params = JSON.parse(event.body);
    else if (event.queryStringParameters) params = event.queryStringParameters;
  } catch (e) {
    params = {};
  }

  const action = params.action || '';
  const year = params.year || '2026';

  try {
    switch (action) {
      case 'verifyAccess':
        return jsonRes({ status: params.password === ACCESS_PASSWORD ? 'success' : 'error', message: params.password === ACCESS_PASSWORD ? 'Akses diterima' : 'Password salah' }, headers);

      case 'verifyDelete':
        return jsonRes({ status: params.password === DELETE_PASSWORD ? 'success' : 'error', message: params.password === DELETE_PASSWORD ? 'Password hapus benar' : 'Password hapus salah' }, headers);

      case 'getData': {
        const { data, error } = await supabase.from('opd_data').select('*').eq('year', year);
        if (error) throw error;
        return jsonRes(data || [], headers);
      }

      case 'saveData': {
        const rows = JSON.parse(params.rows);
        // UPSERT per row
        for (const row of rows) {
          const payload = {
            id: row.id,
            opd: row.opd || '',
            sa: parseFloat(row.sa) || 0,
            evidence: row.evidence || 'Belum',
            qa_apip: row.qaApip || 'Belum',
            mri: parseFloat(row.mri) || 0,
            iepk: parseFloat(row.iepk) || 0,
            rtp: row.rtp || 'Belum',
            status: row.status || 'Belum',
            subunsurs: row.subunsurs || {},
            year: year
          };
          const { error } = await supabase.from('opd_data').upsert(payload, { onConflict: 'id' });
          if (error) throw error;
        }
        return jsonRes({ status: 'success', message: 'Data berhasil disimpan' }, headers);
      }

      case 'saveField': {
        const { opdId, field, value } = params;
        if (!opdId || !field) return jsonRes({ status: 'error', message: 'Parameter tidak lengkap' }, headers);
        const updateObj = {};
        updateObj[field] = value;
        const { error } = await supabase.from('opd_data').update(updateObj).eq('id', opdId);
        if (error) throw error;
        return jsonRes({ status: 'success', message: 'Field berhasil disimpan' }, headers);
      }

      case 'deleteOpd': {
        const { opdId } = params;
        if (opdId === 'all') {
          await supabase.from('opd_data').delete().eq('year', year);
        } else {
          await supabase.from('opd_data').delete().eq('id', opdId);
        }
        return jsonRes({ status: 'success', message: 'OPD berhasil dihapus' }, headers);
      }

      case 'getYears': {
        const { data } = await supabase.from('years').select('year');
        const years = data.map(item => item.year);
        if (!years.includes('2026')) years.push('2026');
        const uniqueYears = [...new Set(years)].sort((a,b) => b.localeCompare(a));
        return jsonRes(uniqueYears, headers);
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

      case 'uploadFile': {
        const fileUrl = await uploadFileToDrive(params);
        return jsonRes(fileUrl, headers);
      }

      case 'deleteFile': {
        await deleteFileFromDrive(params.fileUrl);
        return jsonRes({ status: 'success', message: 'File dihapus' }, headers);
      }

      case 'createBackup': {
        const { data: rows } = await supabase.from('opd_data').select('*').eq('year', year);
        const folderId = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`);
        const backupFolder = await getOrCreateFolder(folderId, 'backup');
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '_').slice(0, 19);
        const fileName = `backup_${timestamp}.json`;
        await getDrive().files.create({
          resource: { name: fileName, parents: [backupFolder] },
          media: { mimeType: 'application/json', body: JSON.stringify(rows) },
          fields: 'id',
        });
        return jsonRes({ status: 'success', message: 'Backup berhasil dibuat', fileName }, headers);
      }

      case 'listBackups': {
        const folderId = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`);
        const backupFolder = await getOrCreateFolder(folderId, 'backup');
        const res = await getDrive().files.list({
          q: `'${backupFolder}' in parents and trashed=false`,
          fields: 'files(id, name, size, createdTime)',
          orderBy: 'createdTime desc',
        });
        const backups = res.data.files.map(file => ({
          fileName: file.name,
          timestamp: file.createdTime,
          size: Math.round(file.size / 1024),
          count: 0
        }));
        return jsonRes(backups, headers);
      }

      case 'restoreBackup': {
        const { fileName } = params;
        const folderId = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`);
        const backupFolder = await getOrCreateFolder(folderId, 'backup');
        const res = await getDrive().files.list({
          q: `'${backupFolder}' in parents and name='${fileName}' and trashed=false`,
          fields: 'files(id)',
        });
        if (res.data.files.length === 0) return jsonRes({ status: 'error', message: 'Backup tidak ditemukan' }, headers);
        const fileId = res.data.files[0].id;
        const content = await getDrive().files.get({ fileId, alt: 'media' });
        const rows = JSON.parse(content.data);
        await supabase.from('opd_data').delete().eq('year', year);
        for (const row of rows) {
          const { error } = await supabase.from('opd_data').insert(row);
          if (error) throw error;
        }
        return jsonRes({ status: 'success', message: 'Backup berhasil dipulihkan' }, headers);
      }

      case 'deleteBackup': {
        const { fileName } = params;
        const folderId = await getOrCreateFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, `year_${year}`);
        const backupFolder = await getOrCreateFolder(folderId, 'backup');
        const res = await getDrive().files.list({
          q: `'${backupFolder}' in parents and name='${fileName}' and trashed=false`,
          fields: 'files(id)',
        });
        if (res.data.files.length > 0) {
          await getDrive().files.delete({ fileId: res.data.files[0].id });
        }
        return jsonRes({ status: 'success', message: 'Backup dihapus' }, headers);
      }

      case 'getSubunsurData': {
        return jsonRes(SUBUNSUR_DATA, headers);
      }

      default:
        return jsonRes({ status: 'error', message: 'Aksi tidak dikenal' }, headers);
    }
  } catch (err) {
    console.error(err);
    return jsonRes({ status: 'error', message: err.message }, headers);
  }
};

function jsonRes(obj, headers) {
  return {
    statusCode: 200,
    headers: headers,
    body: JSON.stringify(obj),
  };
}
