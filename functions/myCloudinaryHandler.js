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

// ============ GOOGLE SHEETS KERTAS KERJA ============
const DEFAULT_KK_TEMPLATE_SPREADSHEET_ID = '1mvkH9PFMoJWrtk2ShSWB1n6kzCwCq5cP';
const KK_SHEET_DEFS = [
  { name: 'KKLEAD_SPIP', label: 'KKLEAD_SPIP' },
  { name: 'KKLEAD I_PEMDA', label: 'KKLEAD I' },
  { name: 'KKLEAD II', label: 'KKLEAD II' },
  { name: 'KKLEAD III', label: 'KKLEAD III' },
  { name: 'KKE 1.1 SASTRA PEMDA (BP4D)', label: 'KKE 1.1' },
  { name: 'KKE 1.2 SASTRA OPD', label: 'KKE 1.2' },
  { name: 'KKE 2.1 PROGRAM (OPD)', label: 'KKE 2.1' },
  { name: 'KKE 2.2 KEGIATAN (OPD)', label: 'KKE 2.2' },
  { name: 'KKE 2.3 SUB KEGIATAN (OPD)', label: 'KKE 2.3' },
  { name: 'KK3.1 (OPD)', label: 'KK 3.1' },
  { name: 'KK3.2 BPKAD Akun', label: 'KK 3.2' },
  { name: 'KK3.3 BPKAD Aset', label: 'KK 3.3' },
  { name: 'KK3.4 (inspektorat)', label: 'KK 3.4' },
  { name: 'KK 5.1A Lakip RPJMD', label: 'KK 5.1A' },
  { name: 'KK 5.1B OPD', label: 'KK 5.1B' },
  { name: 'KK 5.2 OPD', label: 'KK 5.2' },
  { name: 'KK 6 INSP', label: 'KK 6' },
  { name: 'KK 7 INSP', label: 'KK 7' },
  { name: 'KK 8 INSP', label: 'KK 8' }
];

function safeDriveName(v, fallback='OPD') {
  return String(v || fallback).replace(/[\\/:*?"<>|#%{}]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 150) || fallback;
}

async function sheetsApi(accessToken, path, options = {}) {
  const response = await fetch(`https://sheets.googleapis.com/v4${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    throw new Error(`Google Sheets API ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function getTemplateSheetFormulaData(accessToken, templateId) {
  const params = new URLSearchParams();
  params.set('includeGridData', 'true');
  params.set('ranges', 'KKLEAD_SPIP');
  for (const def of KK_SHEET_DEFS.slice(1)) params.append('ranges', def.name);
  const data = await sheetsApi(accessToken, `/spreadsheets/${encodeURIComponent(templateId)}?${params.toString()}`);
  const result = {};
  for (const sh of (data.sheets || [])) {
    const title = sh.properties?.title;
    if (!title) continue;
    const formulas = [];
    let rowBase = 1;
    for (const block of (sh.data || [])) {
      const startRow = Number(block.startRow || 0) + 1;
      const startCol = Number(block.startColumn || 0) + 1;
      const rowData = block.rowData || [];
      rowData.forEach((row, rIdx) => {
        const values = row.values || [];
        values.forEach((cell, cIdx) => {
          const f = cell.userEnteredValue?.formulaValue;
          if (typeof f === 'string' && f.startsWith('=')) {
            const colNum = startCol + cIdx;
            let col = ''; let n = colNum;
            while (n) { const rem = (n - 1) % 26; col = String.fromCharCode(65 + rem) + col; n = Math.floor((n - 1) / 26); }
            formulas.push({ row: startRow + rIdx, col: colNum, a1: `${col}${startRow + rIdx}`, formula: f });
          }
        });
      });
      rowBase = Math.max(rowBase, startRow + rowData.length);
    }
    result[title] = formulas;
  }
  return result;
}

function rewriteFormulaToExternalSheets(formula, currentSheet, idMap) {
  if (!formula || !idMap) return formula;
  return String(formula).replace(/('(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_. ]*)!([A-Z]{1,3}\$?\d+(?::[A-Z]{1,3}\$?\d+)?)/g, (match, sheetPart, a1) => {
    let name = sheetPart;
    if (name.startsWith("'") && name.endsWith("'")) name = name.slice(1, -1).replace(/''/g, "'");
    if (name === currentSheet) return match;
    const targetId = idMap[name];
    if (!targetId) return match;
    const escapedRange = `'${name.replace(/'/g, "''")}'!${a1}`;
    return `IMPORTRANGE("https://docs.google.com/spreadsheets/d/${targetId}","${escapedRange}")`;
  });
}

async function createGoogleSpreadsheet(accessToken, title) {
  return await sheetsApi(accessToken, '/spreadsheets', { method: 'POST', body: JSON.stringify({ properties: { title } }) });
}

async function copySheetToSpreadsheet(accessToken, sourceSpreadsheetId, sourceSheetId, destinationSpreadsheetId) {
  return await sheetsApi(accessToken, `/spreadsheets/${encodeURIComponent(sourceSpreadsheetId)}/sheets/${encodeURIComponent(sourceSheetId)}:copyTo`, {
    method: 'POST', body: JSON.stringify({ destinationSpreadsheetId })
  });
}

async function deleteSheetsAndRewrite(accessToken, spreadsheetId, keepSheetId, keepSheetTitle, formulaList, idMap) {
  const meta = await sheetsApi(accessToken, `/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets(properties(sheetId,title,index))`);
  const requests = [];
  for (const sh of (meta.sheets || [])) {
    const sid = sh.properties?.sheetId;
    if (sid != null && String(sid) !== String(keepSheetId)) requests.push({ deleteSheet: { sheetId: sid } });
  }
  if (requests.length) await sheetsApi(accessToken, `/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });

  const cellRequests = [];
  for (const item of formulaList || []) {
    const rewritten = rewriteFormulaToExternalSheets(item.formula, keepSheetTitle, idMap);
    if (rewritten !== item.formula) {
      cellRequests.push({
        updateCells: {
          rows: [{ values: [{ userEnteredValue: { formulaValue: rewritten } }] }],
          fields: 'userEnteredValue',
          start: { sheetId: keepSheetId, rowIndex: item.row - 1, columnIndex: item.col - 1 }
        }
      });
    }
  }
  if (cellRequests.length) await sheetsApi(accessToken, `/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: cellRequests }) });
}

async function moveFileToFolder(accessToken, fileId, folderId) {
  const metaResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const meta = await metaResponse.json();
  const oldParents = Array.isArray(meta.parents) ? meta.parents.join(',') : '';
  const q = new URLSearchParams({ addParents: folderId, fields: 'id,parents' });
  if (oldParents) q.set('removeParents', oldParents);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${q.toString()}`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error('Gagal memindahkan spreadsheet ke folder Google Drive: ' + await response.text());
  return response.json();
}

function normalizeKkData(raw) {
  if (!raw) return { version: 2, sheets: {} };
  let data = raw;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return { version: 2, sheets: {} }; }
  }
  if (data && typeof data === 'object' && data.sheets && typeof data.sheets === 'object') return { version: 2, sheets: data.sheets, templateSpreadsheetId: data.templateSpreadsheetId || null };
  // Legacy embedded KK data is intentionally ignored by the browser layer.
  return { version: 2, sheets: {} };
}

async function ensureKkSpreadsheets(env, params) {
  if (!env.GOOGLE_DRIVE_CLIENT_ID || !env.GOOGLE_DRIVE_CLIENT_SECRET || !env.GOOGLE_DRIVE_REFRESH_TOKEN) throw new Error('Google OAuth untuk Spreadsheet belum dikonfigurasi');
  if (!env.GOOGLE_DRIVE_FOLDER_ID) throw new Error('GOOGLE_DRIVE_FOLDER_ID belum dikonfigurasi');
  const accessToken = await getGoogleAccessToken(env);
  const templateId = env.GOOGLE_SHEETS_TEMPLATE_ID || DEFAULT_KK_TEMPLATE_SPREADSHEET_ID;
  const formulaData = await getTemplateSheetFormulaData(accessToken, templateId);

  const yearValue = params.year || '2026';
  const opdName = safeDriveName(params.opd || 'OPD Baru');
  const root = await getOrCreateFolder(accessToken, env.GOOGLE_DRIVE_FOLDER_ID, 'Kertas Kerja Spreadsheet');
  const yearFolder = await getOrCreateFolder(accessToken, root, String(yearValue));
  const opdFolder = await getOrCreateFolder(accessToken, yearFolder, opdName);

  let existing = normalizeKkData(params.currentKkData);
  const byName = { ...(existing.sheets || {}) };

  // First pass: create only missing spreadsheets so formulas can reference the final IDs.
  for (const def of KK_SHEET_DEFS) {
    const current = byName[def.name];
    if (current?.spreadsheetId && current?.url) continue;
    const sourceSheetMeta = await sheetsApi(accessToken, `/spreadsheets/${encodeURIComponent(templateId)}?fields=sheets(properties(sheetId,title))`);
    const sourceSheet = (sourceSheetMeta.sheets || []).find(s => s.properties?.title === def.name);
    if (!sourceSheet) throw new Error(`Sheet template tidak ditemukan: ${def.name}`);

    const created = await createGoogleSpreadsheet(accessToken, `${def.label} - ${opdName} - ${yearValue}`);
    const copied = await copySheetToSpreadsheet(accessToken, templateId, sourceSheet.properties.sheetId, created.spreadsheetId);
    await deleteSheetsAndRewrite(accessToken, created.spreadsheetId, copied.sheetId, def.name, [], {});
    await moveFileToFolder(accessToken, created.spreadsheetId, opdFolder);
    byName[def.name] = { spreadsheetId: created.spreadsheetId, sheetId: copied.sheetId, url: `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`, label: def.label };
  }

  const idMap = {};
  Object.entries(byName).forEach(([name, meta]) => { if (meta?.spreadsheetId) idMap[name] = meta.spreadsheetId; });

  // Second pass: rewrite formulas in each target sheet to IMPORTRANGE where they refer to another KK sheet.
  for (const def of KK_SHEET_DEFS) {
    const dest = byName[def.name];
    if (!dest?.spreadsheetId) continue;
    await deleteSheetsAndRewrite(accessToken, dest.spreadsheetId, dest.sheetId, def.name, formulaData[def.name] || [], idMap);
  }

  return { version: 2, templateSpreadsheetId: templateId, sheets: byName };
}
// ============ END GOOGLE SHEETS KERTAS KERJA ============

function calculateSAFromSubunsur(subunsurs) {
  if (!subunsurs) return 0;
  let totalLevel = 0;
  let totalParams = 0;
  Object.keys(SUBUNSUR_DATA).forEach(subCode => {
    if (SUBUNSUR_DATA[subCode].params) totalParams += SUBUNSUR_DATA[subCode].params.length;
  });
  Object.keys(subunsurs).forEach(subCode => {
    Object.keys(subunsurs[subCode]).forEach(paramId => {
      const level = subunsurs[subCode][paramId].level;
      if (level > 0) totalLevel += level;
    });
  });
  return totalParams > 0 ? Math.round((totalLevel / totalParams) * 100) / 100 : 0;
}

// ============ GOOGLE DRIVE INTEGRATION (OAUTH - REFRESH TOKEN) ============
async function getGoogleAccessToken(env) {
  const { GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN } = env;
  if (!GOOGLE_DRIVE_CLIENT_ID || !GOOGLE_DRIVE_CLIENT_SECRET || !GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new Error('Google Drive credentials not configured');
  }
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_DRIVE_CLIENT_ID,
      client_secret: GOOGLE_DRIVE_CLIENT_SECRET,
      refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error('Failed to get Google Drive access token: ' + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

async function createFolder(accessToken, parentId, folderName) {
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Gagal membuat folder: ' + JSON.stringify(data));
  return data.id;
}

async function getOrCreateFolder(accessToken, parentId, folderName) {
  const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (data.files && data.files.length > 0) return data.files[0].id;
  return await createFolder(accessToken, parentId, folderName);
}

async function uploadToGoogleDrive(env, filePath, fileName, bytes, rootFolderId) {
  const accessToken = await getGoogleAccessToken(env);
  const pathSegments = filePath.split('/');
  pathSegments.pop(); // hapus nama file
  let currentFolderId = rootFolderId;
  for (const folderName of pathSegments) {
    if (!folderName) continue;
    currentFolderId = await getOrCreateFolder(accessToken, currentFolderId, folderName);
  }
  const metadata = { name: fileName, parents: [currentFolderId] };
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
    headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': bytes.length.toString() },
    body: bytes
  });
  const result = await uploadResponse.json();
  if (!uploadResponse.ok) throw new Error('Gagal upload file ke Google Drive: ' + JSON.stringify(result));
  return result.id;
}

async function deleteGoogleDriveFile(env, fileId) {
  const accessToken = await getGoogleAccessToken(env);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok && response.status !== 404) {
    const errText = await response.text();
    throw new Error('Gagal hapus file di Google Drive: ' + errText);
  }
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
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
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
          const kkData = normalizeKkData(r.kk_data);
          const sa = calculateSAFromSubunsur(subunsurs);
          return { ...r, subunsurs, kkData, qaApip: r.qa_apip || 'Belum', sa: sa };
        });
        return new Response(JSON.stringify(mapped), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'addOpd': {
        const id = params.id || 'r' + Math.random().toString(36).slice(2,9);
        const opd = params.opd || 'OPD Baru';
        const subunsurs = params.subunsurs || {};
        const sa = calculateSAFromSubunsur(subunsurs);
        await env.DB.prepare("INSERT OR REPLACE INTO opd_data (id, opd, sa, evidence, qa_apip, mri, iepk, rtp, status, subunsurs, year, kk_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(id, opd, sa, params.evidence||'Belum', params.qaApip||'Belum', parseFloat(params.mri)||0, parseFloat(params.iepk)||0, params.rtp||'Belum', params.status||'Belum', JSON.stringify(subunsurs), year, params.kkData || '{}').run();
        return new Response(JSON.stringify({ status: 'success', message: 'OPD berhasil ditambahkan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'saveData': {
        const rows = JSON.parse(params.rows);
        for (const row of rows) {
          const subunsurs = row.subunsurs || {};
          const sa = calculateSAFromSubunsur(subunsurs);
          const kkData = row.kkData || {};
          await env.DB.prepare("INSERT OR REPLACE INTO opd_data (id, opd, sa, evidence, qa_apip, mri, iepk, rtp, status, subunsurs, year, kk_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(row.id, row.opd||'', sa, row.evidence||'Belum', row.qaApip||'Belum', parseFloat(row.mri)||0, parseFloat(row.iepk)||0, row.rtp||'Belum', row.status||'Belum', JSON.stringify(subunsurs), year, JSON.stringify(kkData)).run();
        }
        return new Response(JSON.stringify({ status: 'success', message: 'Data tersimpan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'saveField': {
        const { opdId, field, value } = params;
        const dbField = FIELD_MAP[field] || field;
        await env.DB.prepare(`UPDATE opd_data SET ${dbField} = ? WHERE id = ? AND year = ?`).bind(value, opdId, year).run();
        return new Response(JSON.stringify({ status: 'success', message: 'Field tersimpan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'getKkSheets': {
        const { results } = await env.DB.prepare("SELECT kk_data, opd FROM opd_data WHERE id = ? AND year = ? LIMIT 1").bind(params.opdId, year).all();
        if (!results.length) return new Response(JSON.stringify({ status: 'error', message: 'OPD tidak ditemukan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        const kkData = normalizeKkData(results[0].kk_data);
        return new Response(JSON.stringify({ status: 'success', kkData, sheets: kkData.sheets || {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'createKkSheets': {
        const { results } = await env.DB.prepare("SELECT kk_data, opd FROM opd_data WHERE id = ? AND year = ? LIMIT 1").bind(params.opdId, year).all();
        if (!results.length) return new Response(JSON.stringify({ status: 'error', message: 'OPD tidak ditemukan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        const currentKkData = normalizeKkData(results[0].kk_data);
        const kkData = await ensureKkSpreadsheets(env, { ...params, opd: params.opd || results[0].opd, currentKkData });
        await env.DB.prepare("UPDATE opd_data SET kk_data = ? WHERE id = ? AND year = ?").bind(JSON.stringify(kkData), params.opdId, year).run();
        return new Response(JSON.stringify({ status: 'success', message: 'Google Spreadsheet Kertas Kerja berhasil dibuat/disinkronkan', kkData, sheets: kkData.sheets }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'saveKkData': {
        const { opdId, kkData } = params;
        const yearValue = params.year || '2026';
        const normalized = normalizeKkData(kkData);
        await env.DB.prepare("UPDATE opd_data SET kk_data = ? WHERE id = ? AND year = ?")
          .bind(JSON.stringify(normalized), opdId, yearValue)
          .run();
        return new Response(JSON.stringify({ status: 'success', message: 'Link spreadsheet tersimpan', kkData: normalized }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
        if (env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET && env.GOOGLE_DRIVE_REFRESH_TOKEN && env.GOOGLE_DRIVE_FOLDER_ID) {
          try {
            gdriveId = await uploadToGoogleDrive(env, filePath, fileName, bytes, env.GOOGLE_DRIVE_FOLDER_ID);
          } catch (err) {
            console.error('Gagal upload ke Google Drive:', err.message);
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

        if (params.gdriveId) {
          try {
            await deleteGoogleDriveFile(env, params.gdriveId);
          } catch (err) {
            return new Response(JSON.stringify({ status: 'error', message: 'Gagal hapus di Google Drive: ' + err.message }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
        }

        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'listBackups': {
        const prefix = `backup_${year}_`;
        let files;
        try { files = await env.EVIDENCE_BUCKET.list({ prefix }); } catch (e) { return new Response(JSON.stringify({ status: 'error', message: 'Gagal list bucket: ' + e.message }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
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
          try { const file = await env.EVIDENCE_BUCKET.get(fileName); if (file) { const content = await file.text(); const data = JSON.parse(content); if (Array.isArray(data)) count = data.length; } } catch (e) { count = 0; }
          return { fileName, timestamp: isNaN(date.getTime()) ? 'Tanggal tidak valid' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }), size: Math.round((obj.size || 0) / 1024), count: count };
        }));
        const validBackups = backups.filter(b => b !== null);
        return new Response(JSON.stringify(validBackups), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'createBackup': {
        const { results } = await env.DB.prepare("SELECT * FROM opd_data WHERE year = ?").bind(year).all();
        if (results.length === 0) return new Response(JSON.stringify({ status: 'error', message: 'Tidak ada data OPD untuk tahun ini!' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        const fileName = `backup_${year}_${timestamp}.json`;
        const data = JSON.stringify(results);
        await env.EVIDENCE_BUCKET.put(fileName, data, { httpMetadata: { contentType: 'application/json' } });
        if (env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET && env.GOOGLE_DRIVE_REFRESH_TOKEN && env.GOOGLE_DRIVE_FOLDER_ID) {
          try {
            const bytes = new TextEncoder().encode(data);
            await uploadToGoogleDrive(env, fileName, fileName, bytes, env.GOOGLE_DRIVE_FOLDER_ID);
            await uploadToGoogleDrive(env, DB_FILE_NAME, DB_FILE_NAME, bytes, env.GOOGLE_DRIVE_FOLDER_ID);
          } catch (err) { throw new Error('Gagal upload backup ke Google Drive: ' + err.message); }
        }
        return new Response(JSON.stringify({ status: 'success', message: 'Backup berhasil dibuat', fileName }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'restoreBackup': {
        const { fileName } = params;
        const file = await env.EVIDENCE_BUCKET.get(fileName);
        if (!file) return new Response(JSON.stringify({ status: 'error', message: 'Backup tidak ditemukan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        const data = JSON.parse(await file.text());
        await env.DB.prepare("DELETE FROM opd_data WHERE year = ?").bind(year).run();
        for (const row of data) {
          const subunsurs = row.subunsurs ? JSON.parse(row.subunsurs) : {};
          const sa = calculateSAFromSubunsur(subunsurs);
          const kkData = row.kk_data || row.kkData || {};
          await env.DB.prepare("INSERT OR REPLACE INTO opd_data (id, opd, sa, evidence, qa_apip, mri, iepk, rtp, status, subunsurs, year, kk_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(row.id, row.opd||'', sa, row.evidence||'Belum', row.qa_apip || row.qaApip || 'Belum', parseFloat(row.mri)||0, parseFloat(row.iepk)||0, row.rtp||'Belum', row.status||'Belum', JSON.stringify(subunsurs), year, JSON.stringify(kkData)).run();
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
