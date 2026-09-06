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

const DB_FILE_NAME = 'SAKIP_DB.json';

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

// ============ GOOGLE DRIVE INTEGRATION (RESUMABLE UPLOAD) ============
async function getGoogleAccessToken(env) {
  const { GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY } = env;
  if (!GOOGLE_DRIVE_CLIENT_EMAIL || !GOOGLE_DRIVE_PRIVATE_KEY) {
    throw new Error('Google Drive credentials not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: GOOGLE_DRIVE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const encodedClaim = btoa(JSON.stringify(claim)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsignedToken = `${encodedHeader}.${encodedClaim}`;

  const privateKey = GOOGLE_DRIVE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const keyData = privateKey;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(keyData),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${unsignedToken}.${encodedSignature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error('Failed to get Google Drive access token: ' + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

function pemToArrayBuffer(pem) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '')
                    .replace(/-----END PRIVATE KEY-----/, '')
                    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function uploadToGoogleDrive(env, fileName, bytes, folderId) {
  const accessToken = await getGoogleAccessToken(env);

  const metadata = {
    name: fileName,
    parents: [folderId]
  };

  const initResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/octet-stream',
      'X-Upload-Content-Length': bytes.length.toString()
    },
    body: JSON.stringify(metadata)
  });

  if (!initResponse.ok) {
    const errText = await initResponse.text();
    throw new Error('Gagal inisialisasi upload: ' + errText);
  }

  const location = initResponse.headers.get('Location');
  if (!location) throw new Error('Tidak ada URL upload dari Google Drive');

  const uploadResponse = await fetch(location, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': bytes.length.toString()
    },
    body: bytes
  });

  const result = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error('Gagal upload file ke Google Drive: ' + JSON.stringify(result));
  }
  return result.id;
}
// ============ END GOOGLE DRIVE INTEGRATION ============

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

      case 'verifyAccess':
        return new Response(JSON.stringify({ status: params.password === ACCESS_PASSWORD ? 'success' : 'error', message: params.password === ACCESS_PASSWORD ? 'Akses diterima' : 'Password salah' }), { status: 200, headers: { 'Content-Type': 'application/json' } });

      case 'verifyDelete':
        return new Response(JSON.stringify({ status: params.password === DELETE_PASSWORD ? 'success' : 'error', message: params.password === DELETE_PASSWORD ? 'Password hapus benar' : 'Password hapus salah' }), { status: 200, headers: { 'Content-Type': 'application/json' } });

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

      case 'uploadFile': {
        const { filePath, bytes, fileType, fileName } = getFolderStructure(params);

        await env.EVIDENCE_BUCKET.put(filePath, bytes, { httpMetadata: { contentType: fileType } });

        let gdriveId = null;
        if (env.GOOGLE_DRIVE_FOLDER_ID && env.GOOGLE_DRIVE_CLIENT_EMAIL && env.GOOGLE_DRIVE_PRIVATE_KEY) {
          try {
            gdriveId = await uploadToGoogleDrive(env, fileName, bytes, env.GOOGLE_DRIVE_FOLDER_ID);
          } catch (err) {
            throw new Error('Gagal upload ke Google Drive: ' + err.message);
          }
        }

        const publicUrl = `https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${filePath}`;

        return new Response(JSON.stringify({ url: publicUrl, fileName, googleDriveId: gdriveId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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

          return { fileName, timestamp: isNaN(date.getTime()) ? 'Tanggal tidak valid' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }), size: Math.round((obj.size || 0) / 1024), count: count };
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

        if (env.GOOGLE_DRIVE_FOLDER_ID && env.GOOGLE_DRIVE_CLIENT_EMAIL && env.GOOGLE_DRIVE_PRIVATE_KEY) {
          try {
            const bytes = new TextEncoder().encode(data);
            await uploadToGoogleDrive(env, fileName, bytes, env.GOOGLE_DRIVE_FOLDER_ID);
            await uploadToGoogleDrive(env, DB_FILE_NAME, bytes, env.GOOGLE_DRIVE_FOLDER_ID);
          } catch (err) {
            throw new Error('Gagal upload backup ke Google Drive: ' + err.message);
          }
        }

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
