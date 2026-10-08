import { SUBUNSUR_DATA } from './subunsur.js';

const UNSUR_MAP = {
  '1': '1. LINGKUNGAN PENGENDALIAN',
  '2': '2. PENILAIAN RISIKO',
  '3': '3. KEGIATAN PENGENDALIAN',
  '4': '4. INFORMASI DAN KOMUNIKASI',
  '5': '5. EVALUASI DAN PEMANTAUAN'
};

const FIELD_MAP = { opd:'opd', qaApip:'qa_apip', nilaiStrukturProses:'nilai_struktur_proses', nilaiMaturitas:'nilai_maturitas', nilaiKapabilitasApip:'nilai_kapabilitas_apip', mri:'mri', iepk:'iepk', evidence:'evidence', rtp:'rtp', status:'status', strukturProsesStatus:'struktur_proses_status' };

const DB_FILE_NAME = 'SAKIP_DB.json';
const DEFAULT_KK_TEMPLATE_SPREADSHEET_ID='1ozFUON9VcxDZdgZ-v4HvhP54ulPxkqoRvV2G3SNlolE';
const DEFAULT_RTP_TEMPLATE_SPREADSHEET_ID='1WO_caRMgUjTlUcf6SoLpG242vRTOhe1Euz9UI-AuyJY';
const KK_TEMPLATE_SHEET_NAMES = [
  'KKLEAD_SPIP',
  'KKLEAD I_PEMDA',
  'KKLEAD II',
  'KKLEAD III',
  'KKE 1.1 SASTRA PEMDA (BP4D)',
  'KKE 1.2 SASTRA OPD',
  'KKE 2.1 PROGRAM (OPD)',
  'KKE 2.2 KEGIATAN (OPD)',
  'KKE 2.3 SUB KEGIATAN (OPD)',
  'KK3.1 (OPD)',
  'KK3.2 BPKAD Akun',
  'KK3.3 BPKAD Aset',
  'KK3.4 (inspektorat)',
  'KK 5.1A Lakip RPJMD',
  'KK 5.1B OPD',
  'KK 5.2 OPD',
  'KK 6 INSP',
  'KK 7 INSP',
  'KK 8 INSP'
];

let schemaReady=false;
let schemaReadyPromise=null;
const DRIVE_TOKEN_CACHE={token:null,expiresAt:0};
const DRIVE_TOKEN_PROMISE={value:null};
const DRIVE_FOLDER_CACHE=new Map();
const DRIVE_FOLDER_PROMISES=new Map();
let GOOGLE_ACTIVE=0;
const GOOGLE_QUEUE=[];

async function withGoogleConcurrency(task, limit=3){
  if(GOOGLE_ACTIVE>=limit){
    await new Promise(resolve=>GOOGLE_QUEUE.push(resolve));
  }
  GOOGLE_ACTIVE++;
  try{return await task();}
  finally{
    GOOGLE_ACTIVE=Math.max(0,GOOGLE_ACTIVE-1);
    const next=GOOGLE_QUEUE.shift();
    if(next)next();
  }
}

async function fetchWithRetry(url, init={}, options={}){
  const retries=Number.isFinite(options.retries)?options.retries:3;
  const baseDelay=Number.isFinite(options.baseDelay)?options.baseDelay:400;
  let lastError=null;
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      const response=await fetch(url,init);
      if(response.ok || ![429,500,502,503,504].includes(response.status) || attempt===retries)return response;
      const wait=Math.min(5000,baseDelay*Math.pow(2,attempt)+Math.floor(Math.random()*250));
      await new Promise(r=>setTimeout(r,wait));
    }catch(err){
      lastError=err;
      if(attempt===retries)throw err;
      const wait=Math.min(5000,baseDelay*Math.pow(2,attempt)+Math.floor(Math.random()*250));
      await new Promise(r=>setTimeout(r,wait));
    }
  }
  throw lastError||new Error('Request gagal');
}

function jsonResponse(data,status=200,extraHeaders={}){
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extraHeaders}});
}

// D1 is SQLite underneath: keep individual writes small and retry transient
// contention/overload errors with jitter instead of immediately failing a user save.
async function runD1WithRetry(makeStatement, options={}) {
  const retries = Number.isFinite(options.retries) ? options.retries : 3;
  const baseDelay = Number.isFinite(options.baseDelay) ? options.baseDelay : 120;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await makeStatement().run();
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || err || '').toLowerCase();
      const transient = /busy|locked|overload|timeout|temporar|too many|rate.?limit/.test(msg);
      if (!transient || attempt === retries) throw err;
      const wait = Math.min(1800, baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 120));
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
  throw lastError || new Error('D1 request gagal');
}

async function ensureOpdSchema(env){
  if(schemaReady)return;
  if(schemaReadyPromise)return schemaReadyPromise;
  schemaReadyPromise=(async()=>{
    const info=await env.DB.prepare("PRAGMA table_info(opd_data)").all();
    const cols=new Set((info.results||[]).map(x=>x.name));
    const hadStructureField=cols.has('nilai_struktur_proses');
    const adds=[['nilai_struktur_proses','REAL NOT NULL DEFAULT 0'],['nilai_maturitas','REAL NOT NULL DEFAULT 0'],['nilai_kapabilitas_apip','REAL NOT NULL DEFAULT 0'],['kk_pm_data',"TEXT NOT NULL DEFAULT '{}'"],['kk_rtp_data',"TEXT NOT NULL DEFAULT '{}'"],['rtp_evidence',"TEXT NOT NULL DEFAULT '[]'"],['rtp_evidence_folder',"TEXT NOT NULL DEFAULT 'Evidence RTP'"],['rtp_evidence_folder_id',"TEXT NOT NULL DEFAULT ''"],['pm_spip_reports',"TEXT NOT NULL DEFAULT '[]'"],['pm_spip_folder',"TEXT NOT NULL DEFAULT 'Laporan Hasil PM SPIP'"],['pm_spip_folder_id',"TEXT NOT NULL DEFAULT ''"],['rr_rtp_reports',"TEXT NOT NULL DEFAULT '[]'"],['rr_rtp_folder',"TEXT NOT NULL DEFAULT 'Laporan Pemantauan RR_RTP'"],['rr_rtp_folder_id',"TEXT NOT NULL DEFAULT ''"],['struktur_proses_status',"TEXT NOT NULL DEFAULT 'Belum'"]];
    for(const [name,type] of adds)if(!cols.has(name))await env.DB.prepare(`ALTER TABLE opd_data ADD COLUMN ${name} ${type}`).run();
    if(cols.has('sa') && !hadStructureField) {
      await env.DB.prepare("UPDATE opd_data SET nilai_struktur_proses=CAST(COALESCE(sa,0) AS REAL)").run();
      await env.DB.prepare("UPDATE opd_data SET struktur_proses_status = CASE WHEN CAST(COALESCE(nilai_struktur_proses,0) AS REAL) > 0 THEN 'Proses' ELSE 'Belum' END").run();
      await env.DB.prepare("UPDATE opd_data SET nilai_maturitas=CAST(COALESCE(nilai_struktur_proses,0) AS REAL)").run();
    }
    // Indexes used by almost every OPD request. IF NOT EXISTS makes this safe on
    // an already deployed D1 database and avoids full-table scans under load.
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_data_year ON opd_data(year)").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_data_id_year ON opd_data(id, year)").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts(ip, action, timestamp)").run();

    // Evidence registry migration (IMPORTANT):
    // Previous deployments may already have evidence_uploads with an older schema.
    // CREATE TABLE IF NOT EXISTS does NOT add new columns to an existing table.
    // Therefore inspect the live D1 schema and add every missing column explicitly.
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS evidence_uploads (
      upload_id TEXT PRIMARY KEY,
      year TEXT NOT NULL DEFAULT '2026',
      opd_id TEXT NOT NULL DEFAULT '',
      subunsur TEXT NOT NULL DEFAULT '',
      param_id TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'evidence',
      r2_key TEXT,
      gdrive_id TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      sync_error TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    )`).run();

    // Authoritative upload identity registry. This is deliberately separate from
    // the legacy evidence_uploads table so old/partial schemas cannot block uploads.
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS evidence_upload_registry (
      upload_id TEXT PRIMARY KEY,
      year TEXT NOT NULL,
      opd_id TEXT NOT NULL,
      subunsur TEXT NOT NULL,
      param_id TEXT NOT NULL,
      level TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'evidence',
      r2_key TEXT,
      gdrive_id TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      sync_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_evidence_upload_registry_location ON evidence_upload_registry(year,opd_id,subunsur,param_id,level)").run();

    const evidenceInfo = await env.DB.prepare("PRAGMA table_info(evidence_uploads)").all();
    const evidenceCols = new Set((evidenceInfo.results || []).map(c => String(c.name)));

    const missingEvidenceCols = [
      ['year', "TEXT NOT NULL DEFAULT '2026'"],
      ['opd_id', "TEXT NOT NULL DEFAULT ''"],
      ['subunsur', "TEXT NOT NULL DEFAULT ''"],
      ['param_id', "TEXT NOT NULL DEFAULT ''"],
      ['level', "TEXT NOT NULL DEFAULT ''"],
      ['type', "TEXT NOT NULL DEFAULT 'evidence'"],
      ['r2_key', "TEXT"],
      ['gdrive_id', "TEXT"],
      ['sync_status', "TEXT NOT NULL DEFAULT 'pending'"],
      ['sync_error', "TEXT"],
      ['created_at', "INTEGER NOT NULL DEFAULT 0"],
      ['updated_at', "INTEGER NOT NULL DEFAULT 0"]
    ];
    for (const [colName, colType] of missingEvidenceCols) {
      if (!evidenceCols.has(colName)) {
        await env.DB.prepare(`ALTER TABLE evidence_uploads ADD COLUMN ${colName} ${colType}`).run();
      }
    }

    // Migrate legacy rows so later retry/status queries always have a valid type.
    await env.DB.prepare("UPDATE evidence_uploads SET type=COALESCE(NULLIF(type,''),'evidence') WHERE type IS NULL OR type=''").run();
    await env.DB.prepare("UPDATE evidence_uploads SET sync_status=COALESCE(NULLIF(sync_status,''),'pending') WHERE sync_status IS NULL OR sync_status=''").run();

    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_evidence_uploads_location ON evidence_uploads(year, opd_id, subunsur, param_id, level)").run();

    // Dedicated source-of-truth table for the 43 Structure & Process parameter levels.
    // This prevents nested JSON snapshots from ever causing the derived score to fall back to 0.
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS opd_parameter_levels (
      year TEXT NOT NULL,
      opd_id TEXT NOT NULL,
      subunsur TEXT NOT NULL,
      param_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(year, opd_id, subunsur, param_id)
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_parameter_levels_opd ON opd_parameter_levels(year, opd_id)").run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS opd_parameter_levels_v2 (
      year TEXT NOT NULL,
      opd_id TEXT NOT NULL,
      subunsur TEXT NOT NULL,
      param_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(year, opd_id, subunsur, param_id)
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_parameter_levels_v2_opd ON opd_parameter_levels_v2(year, opd_id)").run();

    // Dedicated sparse table for Penjaminan Kualitas / Quality Assurance APIP.
    // QA data is kept outside the large subunsurs JSON so each OPD only loads
    // the QA rows that have actually been filled, which keeps the dashboard
    // responsive for many simultaneous users.
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS opd_qa_apip_items (
      year TEXT NOT NULL,
      opd_id TEXT NOT NULL,
      subunsur TEXT NOT NULL,
      param_id TEXT NOT NULL,
      grade TEXT NOT NULL,
      item_no INTEGER NOT NULL,
      availability TEXT NOT NULL DEFAULT '',
      identity_doc TEXT NOT NULL DEFAULT '',
      validity TEXT NOT NULL DEFAULT '',
      period_ok TEXT NOT NULL DEFAULT '',
      substance TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      score REAL,
      conclusion TEXT NOT NULL DEFAULT '',
      examiner_name TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(year, opd_id, subunsur, param_id, grade, item_no)
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_qa_apip_opd ON opd_qa_apip_items(year, opd_id)").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_qa_apip_param ON opd_qa_apip_items(year, opd_id, subunsur, param_id)").run();

    // Dedicated sparse table for Kertas Kerja PM SPIP. PM shares the same
    // 43-parameter / 671-item master but is stored independently from QA APIP
    // so concurrent operators cannot overwrite each other's work.
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS opd_kk_pm_items (
      year TEXT NOT NULL,
      opd_id TEXT NOT NULL,
      subunsur TEXT NOT NULL,
      param_id TEXT NOT NULL,
      grade TEXT NOT NULL,
      item_no INTEGER NOT NULL,
      availability TEXT NOT NULL DEFAULT '',
      identity_doc TEXT NOT NULL DEFAULT '',
      validity TEXT NOT NULL DEFAULT '',
      period_ok TEXT NOT NULL DEFAULT '',
      substance TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      score REAL,
      conclusion TEXT NOT NULL DEFAULT '',
      examiner_name TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(year, opd_id, subunsur, param_id, grade, item_no)
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_kk_pm_opd ON opd_kk_pm_items(year, opd_id)").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_kk_pm_param ON opd_kk_pm_items(year, opd_id, subunsur, param_id)").run();

    // One-time backfill from the legacy subunsurs JSON so existing Level selections are preserved.
    try {
      const rowsForBackfill = await env.DB.prepare("SELECT id, year, subunsurs FROM opd_data").all();
      const nowBackfill = Date.now();
      for (const rr of (rowsForBackfill.results || [])) {
        let obj = {};
        try { obj = rr.subunsurs ? JSON.parse(rr.subunsurs) : {}; } catch { obj = {}; }
        const stmts=[];
        for (const [subCode, info] of Object.entries(SUBUNSUR_DATA || {})) {
          for (const prm of (Array.isArray(info?.params) ? info.params : [])) {
            const raw = obj?.[subCode]?.[prm.id]?.level;
            const lv = Math.max(0, Math.min(5, Number(raw) || 0));
            stmts.push(env.DB.prepare(`INSERT INTO opd_parameter_levels(year,opd_id,subunsur,param_id,level,updated_at)
              VALUES(?,?,?,?,?,?)
              ON CONFLICT(year,opd_id,subunsur,param_id) DO NOTHING`
            ).bind(String(rr.year), String(rr.id), String(subCode), String(prm.id), lv, nowBackfill));
          }
        }
        for(let i=0;i<stmts.length;i+=50) if(stmts.length) await env.DB.batch(stmts.slice(i,i+50));
      }
    } catch (e) { console.warn('Backfill opd_parameter_levels dilewati:', e?.message || e); }

    schemaReady=true;
  })().catch(err=>{schemaReadyPromise=null;throw err;});
  return schemaReadyPromise;
}

// ============ KEAMANAN: SANITASI & RATE LIMITING ============
function decodeSafeFileName(value) {
  const raw = String(value || '').split('?')[0];
  const tail = raw.split('/').pop() || 'File';
  try { return decodeURIComponent(tail); } catch { return tail; }
}

function sanitizeString(str) {
  return String(str || '')
    .replace(/[<>"'`\\]/g, '')          // Hapus karakter berbahaya XSS
    .replace(/\.\./g, '')               // Hapus path traversal
    .replace(/[\/:*?"<>|#%{}]/g, ' ')   // Hapus karakter path ilegal
    .trim()
    .substring(0, 150) || 'OPD';
}

async function checkRateLimit(env, ip, action) {
  const now = Date.now();
  const limit = 5;
  const windowMs = 10 * 60 * 1000;

  const { results } = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND action = ? AND timestamp > ?"
  ).bind(ip, action, now - windowMs).all();

  if (results[0].count >= limit) {
    throw new Error('Terlalu banyak percobaan. Coba lagi dalam 10 menit.');
  }

  await env.DB.prepare(
    "INSERT INTO login_attempts (ip, action, timestamp) VALUES (?, ?, ?)"
  ).bind(ip, action, now).run();
}
// ============ END KEAMANAN ============

function assertGoogleDriveConfigured(env) {
  if (!env.GOOGLE_DRIVE_CLIENT_ID || !env.GOOGLE_DRIVE_CLIENT_SECRET || !env.GOOGLE_DRIVE_REFRESH_TOKEN || !env.GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error('Google Drive WAJIB dikonfigurasi sebelum upload evidence. Periksa GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN, dan GOOGLE_DRIVE_FOLDER_ID.');
  }
}

const VERIFICATION_STATUS_SET = new Set(['diterima','diterima_catatan','dikembalikan']);
function normalizeVerificationStatus(value){
  const status=String(value||'');
  return VERIFICATION_STATUS_SET.has(status)?status:'';
}

const VERIFICATION_WEIGHTS_SERVER = Object.freeze({diterima:1, diterima_catatan:0.75, dikembalikan:0, '':0});
function sanitizeVerificationField(value,maxLength){
  return String(value ?? '').replace(/[<>`\\]/g,'').trim().substring(0,maxLength);
}
function normalizeVerificationRecord(raw){
  const v=raw && typeof raw==='object' ? raw : {};
  const status=VERIFICATION_STATUS_SET.has(String(v.status||'')) ? String(v.status) : '';
  return {
    examinerName:sanitizeVerificationField(v.examinerName ?? v.namaPemeriksa,100),
    note:sanitizeVerificationField(v.note ?? v.catatanPemeriksa,1000),
    status,
    verifiedAt:v.verifiedAt || null,
    updatedAt:v.updatedAt || null
  };
}
function calculateVerificationSummaryServer(files){
  const arr=Array.isArray(files) ? files.filter(Boolean) : [];
  let score=0,verified=0,accepted=0,withNotes=0,returned=0;
  arr.forEach(file=>{
    const v=normalizeVerificationRecord(file?.verification);
    if(VERIFICATION_STATUS_SET.has(v.status)) verified++;
    if(v.status==='diterima') accepted++;
    else if(v.status==='diterima_catatan') withNotes++;
    else if(v.status==='dikembalikan') returned++;
    score+=(VERIFICATION_WEIGHTS_SERVER[v.status]||0)*100;
  });
  return {
    total:arr.length,
    verified,
    accepted,
    withNotes,
    returned,
    percentage:arr.length ? Math.round((score/arr.length)*100)/100 : 0,
    progress:arr.length ? Math.round((verified/arr.length)*10000)/100 : 0
  };
}

function safeDriveName(v, fallback='OPD') {
  return String(v || fallback)
    .replace(/[\\/:*?"<>|#%{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 150) || fallback;
}

async function copyDriveFile(accessToken, sourceFileId, name, parentFolderId) {
  const q = new URLSearchParams({
    supportsAllDrives: 'true',
    fields: 'id,name,mimeType,parents,webViewLink'
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(sourceFileId)}/copy?${q.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      parents: [parentFolderId]
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error('Gagal menyalin template Google Spreadsheet: ' + JSON.stringify(data));
  }
  return data;
}

async function getDriveFile(accessToken, fileId) {
  const q = new URLSearchParams({
    supportsAllDrives: 'true',
    fields: 'id,name,mimeType,parents,webViewLink,trashed'
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${q.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (response.status === 404) return null;
  const data = await response.json();
  if (!response.ok) throw new Error('Gagal membaca Google Spreadsheet: ' + JSON.stringify(data));
  return data;
}

function extractSpreadsheetId(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : raw;
}

function normalizeWorkbookData(raw,fallbackSheets=[]){
  if(!raw)return{version:1,workbookSpreadsheetId:null,workbookUrl:null,workbookName:null,templateSpreadsheetId:null,sheets:fallbackSheets};
  let d=raw;if(typeof d==='string'){try{d=JSON.parse(d)}catch{return{version:1,workbookSpreadsheetId:null,workbookUrl:null,workbookName:null,templateSpreadsheetId:null,sheets:fallbackSheets}}}
  if(!d||typeof d!=='object'||!d.workbookSpreadsheetId)return{version:1,workbookSpreadsheetId:null,workbookUrl:null,workbookName:null,templateSpreadsheetId:d?.templateSpreadsheetId||null,sheets:Array.isArray(d?.sheets)?d.sheets:fallbackSheets};
  return{version:d.version||1,workbookSpreadsheetId:String(d.workbookSpreadsheetId),workbookUrl:d.workbookUrl||`https://docs.google.com/spreadsheets/d/${encodeURIComponent(d.workbookSpreadsheetId)}/edit`,workbookName:d.workbookName||null,templateSpreadsheetId:d.templateSpreadsheetId||null,sheets:Array.isArray(d.sheets)?d.sheets:fallbackSheets};
}

function normalizeKkData(raw) {
  if (!raw) return { version: 3, workbookSpreadsheetId: null, workbookUrl: null, workbookName: null, sheets: KK_TEMPLATE_SHEET_NAMES };
  let data = raw;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return { version: 3, workbookSpreadsheetId: null, workbookUrl: null, workbookName: null, sheets: KK_TEMPLATE_SHEET_NAMES }; }
  }
  if (!data || typeof data !== 'object') return { version: 3, workbookSpreadsheetId: null, workbookUrl: null, workbookName: null, sheets: KK_TEMPLATE_SHEET_NAMES };
  if (data.workbookSpreadsheetId) {
    return {
      version: 3,
      workbookSpreadsheetId: String(data.workbookSpreadsheetId),
      workbookUrl: data.workbookUrl || `https://docs.google.com/spreadsheets/d/${encodeURIComponent(data.workbookSpreadsheetId)}/edit`,
      workbookName: data.workbookName || null,
      templateSpreadsheetId: data.templateSpreadsheetId || null,
      sheets: Array.isArray(data.sheets) ? data.sheets : KK_TEMPLATE_SHEET_NAMES
    };
  }
  return { version: 3, workbookSpreadsheetId: null, workbookUrl: null, workbookName: null, sheets: KK_TEMPLATE_SHEET_NAMES };
}

async function ensureKkSpreadsheet(env, params) {
  if (!env.GOOGLE_DRIVE_CLIENT_ID || !env.GOOGLE_DRIVE_CLIENT_SECRET || !env.GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new Error('Google OAuth untuk Spreadsheet belum dikonfigurasi');
  }
  if (!env.GOOGLE_DRIVE_FOLDER_ID) throw new Error('GOOGLE_DRIVE_FOLDER_ID belum dikonfigurasi');

  const accessToken = await getGoogleAccessToken(env);
  const templateId = extractSpreadsheetId(env.GOOGLE_SHEETS_TEMPLATE_ID || DEFAULT_KK_TEMPLATE_SPREADSHEET_ID);
  if (!templateId) throw new Error('ID template Google Spreadsheet belum dikonfigurasi');

  const templateFile = await getDriveFile(accessToken, templateId);
  if (!templateFile || templateFile.trashed) {
    throw new Error(
      `Template Google Spreadsheet tidak dapat diakses oleh akun Google pada GOOGLE_DRIVE_REFRESH_TOKEN. ` +
      `Periksa ID template (${templateId}) dan pastikan akun OAuth tersebut memiliki akses Editor/Viewer.`
    );
  }
  if (templateFile.mimeType !== 'application/vnd.google-apps.spreadsheet') {
    throw new Error(`ID template ${templateId} bukan Google Spreadsheet (mimeType: ${templateFile.mimeType || 'unknown'}).`);
  }

  const yearValue = params.year || '2026';
  const opdName = safeDriveName(params.opd || 'OPD Baru');
  const root = await getOrCreateFolder(accessToken, env.GOOGLE_DRIVE_FOLDER_ID, 'Kertas Kerja Spreadsheet');
  const yearFolder = await getOrCreateFolder(accessToken, root, String(yearValue));
  const opdFolder = await getOrCreateFolder(accessToken, yearFolder, opdName);

  const current = normalizeKkData(params.currentKkData);
  if (current.workbookSpreadsheetId) {
    const existing = await getDriveFile(accessToken, current.workbookSpreadsheetId);
    if (existing && !existing.trashed) {
      const url = current.workbookUrl || existing.webViewLink || `https://docs.google.com/spreadsheets/d/${encodeURIComponent(current.workbookSpreadsheetId)}/edit`;
      return {
        version: 3,
        templateSpreadsheetId: templateId,
        workbookSpreadsheetId: current.workbookSpreadsheetId,
        workbookUrl: url,
        workbookName: current.workbookName || existing.name || `${opdName} - Kertas Kerja SPIP - ${yearValue}`,
        sheets: current.sheets || KK_TEMPLATE_SHEET_NAMES
      };
    }
  }

  const workbookName = `${opdName} - Kertas Kerja SPIP - ${yearValue}`;
  const copied = await copyDriveFile(accessToken, templateId, workbookName, opdFolder);
  const workbookUrl = copied.webViewLink || `https://docs.google.com/spreadsheets/d/${encodeURIComponent(copied.id)}/edit`;

  return {
    version: 3,
    templateSpreadsheetId: templateId,
    workbookSpreadsheetId: copied.id,
    workbookUrl,
    workbookName: copied.name || workbookName,
    sheets: KK_TEMPLATE_SHEET_NAMES
  };
}

async function ensureRtpSpreadsheet(env,params){
  if(!env.GOOGLE_DRIVE_CLIENT_ID||!env.GOOGLE_DRIVE_CLIENT_SECRET||!env.GOOGLE_DRIVE_REFRESH_TOKEN)throw new Error('Google OAuth untuk KK RTP belum dikonfigurasi');
  if(!env.GOOGLE_DRIVE_FOLDER_ID)throw new Error('GOOGLE_DRIVE_FOLDER_ID belum dikonfigurasi');
  const accessToken=await getGoogleAccessToken(env);
  const templateId=extractSpreadsheetId(env.GOOGLE_SHEETS_RTP_TEMPLATE_ID||DEFAULT_RTP_TEMPLATE_SPREADSHEET_ID);
  const tf=await getDriveFile(accessToken,templateId);
  if(!tf||tf.trashed)throw new Error(`Template KK RTP tidak dapat diakses. Periksa ID template (${templateId}).`);
  if(tf.mimeType!=='application/vnd.google-apps.spreadsheet')throw new Error(`ID template KK RTP ${templateId} bukan Google Spreadsheet.`);
  const yearValue=params.year||'2026',opdName=safeDriveName(params.opd||'OPD Baru');
  const root=await getOrCreateFolder(accessToken,env.GOOGLE_DRIVE_FOLDER_ID,'Kertas Kerja Spreadsheet');
  const yearFolder=await getOrCreateFolder(accessToken,root,String(yearValue));
  const opdFolder=await getOrCreateFolder(accessToken,yearFolder,opdName);
  const rtpFolder=await getOrCreateFolder(accessToken,opdFolder,'Kertas Kerja RTP');
  const cur=normalizeWorkbookData(params.currentKkRtpData,[]);
  if(cur.workbookSpreadsheetId){const ex=await getDriveFile(accessToken,cur.workbookSpreadsheetId);if(ex&&!ex.trashed)return{...cur,version:1,templateSpreadsheetId:templateId,workbookUrl:cur.workbookUrl||ex.webViewLink,workbookName:cur.workbookName||ex.name};}
  const workbookName=`${opdName} - Kertas Kerja RTP - ${yearValue}`,copied=await copyDriveFile(accessToken,templateId,workbookName,rtpFolder);
  return{version:1,templateSpreadsheetId:templateId,workbookSpreadsheetId:copied.id,workbookUrl:copied.webViewLink||`https://docs.google.com/spreadsheets/d/${encodeURIComponent(copied.id)}/edit`,workbookName:copied.name||workbookName,sheets:[]};
}
function decodeBase64File(data,maxMb=10){const b=atob(data||''),bytes=new Uint8Array(b.length);for(let i=0;i<b.length;i++)bytes[i]=b.charCodeAt(i);if(bytes.length/1024/1024>maxMb)throw new Error(`File > ${maxMb}MB, terlalu besar!`);return bytes;}

function countTotalParameters() { return Object.values(SUBUNSUR_DATA).reduce((n,s)=>n+(Array.isArray(s?.params)?s.params.length:0),0); }

function countParameterEvidence(subunsurs) {
  if (!subunsurs) return 0;
  let count = 0;
  for (const subCode of Object.keys(SUBUNSUR_DATA)) {
    const params = SUBUNSUR_DATA[subCode]?.params || [];
    for (const param of params) {
      const data = subunsurs?.[subCode]?.[param.id];
      let has = false;
      if (data) for (let lv=1; lv<=5; lv++) { if (Array.isArray(data['files'+lv]) && data['files'+lv].length) { has=true; break; } }
      if (has) count++;
    }
  }
  return count;
}

function countStructureEvidenceFiles(subunsurs) {
  if (!subunsurs || typeof subunsurs !== 'object') return 0;
  let count = 0;
  for (const subCode of Object.keys(SUBUNSUR_DATA || {})) {
    const params = SUBUNSUR_DATA[subCode]?.params || [];
    for (const param of params) {
      const data = subunsurs?.[subCode]?.[param.id];
      if (!data) continue;
      for (let lv=1; lv<=5; lv++) {
        const files = data['files'+lv];
        if (Array.isArray(files)) count += files.length;
      }
    }
  }
  return count;
}

function structureProcessBreakdown(subunsurs) {
  const b = { totalParams: 0, selectedParams: 0, sumLevels: 0, byLevel: {1:0,2:0,3:0,4:0,5:0} };
  for (const [subCode, subInfo] of Object.entries(SUBUNSUR_DATA || {})) {
    const params = Array.isArray(subInfo?.params) ? subInfo.params : [];
    for (const param of params) {
      b.totalParams++;
      const level = Math.max(0, Math.min(5, Number(subunsurs?.[subCode]?.[param.id]?.level) || 0));
      if (level > 0) { b.selectedParams++; b.sumLevels += level; b.byLevel[level]++; }
    }
  }
  b.value = b.totalParams ? Math.round((b.sumLevels / b.totalParams) * 100) / 100 : 0;
  return b;
}

function calculateSAFromSubunsur(subunsurs) {
  return structureProcessBreakdown(subunsurs || {}).value;
}

async function getGoogleAccessToken(env) {
  const { GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN } = env;
  if (!GOOGLE_DRIVE_CLIENT_ID || !GOOGLE_DRIVE_CLIENT_SECRET || !GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new Error('Google Drive credentials not configured');
  }
  const now=Date.now();
  if(DRIVE_TOKEN_CACHE.token && DRIVE_TOKEN_CACHE.expiresAt > now + 60_000) return DRIVE_TOKEN_CACHE.token;
  if(DRIVE_TOKEN_PROMISE.value) return DRIVE_TOKEN_PROMISE.value;
  DRIVE_TOKEN_PROMISE.value=(async()=>{
    const tokenResponse=await fetchWithRetry('https://oauth2.googleapis.com/token',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:GOOGLE_DRIVE_CLIENT_ID,client_secret:GOOGLE_DRIVE_CLIENT_SECRET,refresh_token:GOOGLE_DRIVE_REFRESH_TOKEN,grant_type:'refresh_token'})
    },{retries:2,baseDelay:500});
    const tokenData=await tokenResponse.json().catch(()=>({}));
    if(!tokenResponse.ok)throw new Error('Failed to get Google Drive access token: '+JSON.stringify(tokenData));
    DRIVE_TOKEN_CACHE.token=tokenData.access_token;
    DRIVE_TOKEN_CACHE.expiresAt=now + Math.max(60_000,Number(tokenData.expires_in||3600)*1000);
    return DRIVE_TOKEN_CACHE.token;
  })().finally(()=>{DRIVE_TOKEN_PROMISE.value=null;});
  return DRIVE_TOKEN_PROMISE.value;
}

async function createFolder(accessToken, parentId, folderName) {
  const response=await fetchWithRetry('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',{
    method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({name:folderName,mimeType:'application/vnd.google-apps.folder',parents:[parentId]})
  },{retries:3,baseDelay:500});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('Gagal membuat folder: '+JSON.stringify(data));
  return data.id;
}

async function getOrCreateFolder(accessToken,parentId,folderName){
  const safeName=String(folderName||'').replace(/'/g,"\\'");
  const cacheKey=`${parentId}\u0000${safeName}`;
  const cached=DRIVE_FOLDER_CACHE.get(cacheKey);
  if(cached)return cached;
  const inFlight=DRIVE_FOLDER_PROMISES.get(cacheKey);
  if(inFlight)return inFlight;
  const promise=(async()=>{
    const query=`name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
    const params=new URLSearchParams({q:query,fields:'files(id,name)',spaces:'drive',includeItemsFromAllDrives:'true',supportsAllDrives:'true',pageSize:'10'});
    const response=await fetchWithRetry(`https://www.googleapis.com/drive/v3/files?${params.toString()}`,{headers:{Authorization:`Bearer ${accessToken}`}}, {retries:3,baseDelay:500});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error('Gagal mencari folder Google Drive: '+JSON.stringify(data));
    const id=data.files?.[0]?.id || await createFolder(accessToken,parentId,folderName);
    DRIVE_FOLDER_CACHE.set(cacheKey,id);
    return id;
  })().catch(err=>{DRIVE_FOLDER_PROMISES.delete(cacheKey);throw err;}).finally(()=>DRIVE_FOLDER_PROMISES.delete(cacheKey));
  DRIVE_FOLDER_PROMISES.set(cacheKey,promise);
  return promise;
}

async function getRtpDriveFolder(env, accessToken, year, opdName, folderName){
  assertGoogleDriveConfigured(env);
  const root=await getOrCreateFolder(accessToken,env.GOOGLE_DRIVE_FOLDER_ID,'Kertas Kerja Spreadsheet');
  const yearFolder=await getOrCreateFolder(accessToken,root,String(year));
  const opdFolder=await getOrCreateFolder(accessToken,yearFolder,safeDriveName(opdName||'OPD'));
  const rtpFolder=await getOrCreateFolder(accessToken,opdFolder,'Kertas Kerja RTP');

  // KHUSUS EVIDENCE RTP: jangan gunakan DRIVE_FOLDER_CACHE untuk folder evidence.
  // Folder dapat dihapus manual oleh user di Google Drive. Bila ID lama masih
  // tertinggal di cache/database, cache tersebut bisa menunjuk ke folder yang
  // sudah tidak ada. Cari ulang langsung berdasarkan nama + parent agar sistem
  // fleksibel dan otomatis membuat folder baru bila folder lama terhapus.
  const evidenceName=safeDriveName(folderName||'Evidence RTP');
  const safeName=evidenceName.replace(/'/g,"\\'");
  const query=`name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${rtpFolder}' in parents and trashed=false`;
  const params=new URLSearchParams({q:query,fields:'files(id,name,mimeType,parents,trashed)',spaces:'drive',includeItemsFromAllDrives:'true',supportsAllDrives:'true',pageSize:'10'});
  const response=await fetchWithRetry(`https://www.googleapis.com/drive/v3/files?${params.toString()}`,{headers:{Authorization:`Bearer ${accessToken}`}}, {retries:3,baseDelay:500});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error('Gagal mencari folder Evidence RTP di Google Drive: '+JSON.stringify(data));

  // Bila folder sudah dihapus, hasil query kosong dan folder baru dibuat.
  const evidenceFolder=data.files?.find(f=>f && !f.trashed && f.mimeType==='application/vnd.google-apps.folder' && Array.isArray(f.parents) && f.parents.includes(rtpFolder))?.id
    || await createFolder(accessToken,rtpFolder,evidenceName);

  // Verifikasi ID/folder terbaru langsung ke Google Drive sebelum dikembalikan.
  const file=await getDriveFile(accessToken,evidenceFolder);
  if(!file || file.trashed || file.mimeType!=='application/vnd.google-apps.folder'){
    throw new Error('Folder Evidence RTP tidak dapat diverifikasi setelah dibuat/ditemukan.');
  }
  const parents=Array.isArray(file.parents)?file.parents:[];
  if(!parents.includes(rtpFolder)) throw new Error('Folder Evidence RTP terdeteksi di lokasi Google Drive yang tidak sesuai.');

  // Perbarui cache dengan ID yang benar agar operasi berikutnya dalam instance
  // yang sama langsung memakai folder aktif.
  DRIVE_FOLDER_CACHE.set(`${rtpFolder}\u0000${evidenceName}`,evidenceFolder);
  return {evidenceFolder,rtpFolder,opdFolder,yearFolder,root};
}

async function getReportDriveFolder(env, accessToken, year, opdName, reportType){
  assertGoogleDriveConfigured(env);
  const isPm=String(reportType)==='pm_spip';
  const category=isPm?'Laporan Hasil PM SPIP':'Laporan Pemantauan RR_RTP';
  const root=await getOrCreateFolder(accessToken,env.GOOGLE_DRIVE_FOLDER_ID,'Laporan SPIP');
  const yearFolder=await getOrCreateFolder(accessToken,root,String(year));
  const opdFolder=await getOrCreateFolder(accessToken,yearFolder,safeDriveName(opdName||'OPD'));
  const reportFolder=await getOrCreateFolder(accessToken,opdFolder,category);
  const file=await getDriveFile(accessToken,reportFolder);
  if(!file || file.trashed || file.mimeType!=='application/vnd.google-apps.folder'){
    throw new Error(`Folder ${category} tidak dapat diverifikasi di Google Drive.`);
  }
  if(!Array.isArray(file.parents) || !file.parents.includes(opdFolder)){
    throw new Error(`Folder ${category} terdeteksi di lokasi Google Drive yang tidak sesuai.`);
  }
  return {root,yearFolder,opdFolder,reportFolder,category};
}

function reportFieldConfig(reportType){
  if(String(reportType)==='pm_spip') return {type:'pm_spip',listField:'pm_spip_reports',folderField:'pm_spip_folder',folderIdField:'pm_spip_folder_id',folderName:'Laporan Hasil PM SPIP'};
  if(String(reportType)==='rr_rtp') return {type:'rr_rtp',listField:'rr_rtp_reports',folderField:'rr_rtp_folder',folderIdField:'rr_rtp_folder_id',folderName:'Laporan Pemantauan RR_RTP'};
  throw new Error('Jenis laporan tidak valid');
}

function parseJsonArray(value){
  try{const x=value?JSON.parse(value):[];return Array.isArray(x)?x:[]}catch{return []}
}

async function updateReportFileStatus(env, job, patch) {
  const cfg=reportFieldConfig(job.reportType);
  const rec=await env.DB.prepare(`SELECT ${cfg.listField} FROM opd_data WHERE id=? AND year=? LIMIT 1`).bind(job.opdId,job.year).all();
  const list=parseJsonArray(rec.results[0]?.[cfg.listField]);
  const index=list.findIndex(x=>x&&x.uploadId===job.uploadId);
  if(index<0) return;
  const base=`$[${index}]`; let expr=`COALESCE(${cfg.listField},'[]')`; const binds=[];
  for(const [k,v] of Object.entries(patch||{})){ expr=`json_set(${expr}, ?, json(?))`; binds.push(`${base}.\"${String(k).replace(/\"/g,'\\\"')}\"`,JSON.stringify(v)); }
  if(binds.length) await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_data SET ${cfg.listField}=${expr} WHERE id=? AND year=?`).bind(...binds,job.opdId,job.year));
}

async function findDriveFileByUploadId(accessToken, parentFolderId, uploadId) {
  const id = String(uploadId || '').trim();
  if (!id) return null;
  const safeId = id.replace(/'/g, "\\'");
  const q = `appProperties has { key='kawalUploadId' and value='${safeId}' } and '${parentFolderId}' in parents and trashed=false`;
  const qs = new URLSearchParams({q,fields:'files(id,name,webViewLink,parents,trashed)',spaces:'drive',includeItemsFromAllDrives:'true',supportsAllDrives:'true',pageSize:'10'});
  const res = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files?${qs.toString()}`, {headers:{Authorization:`Bearer ${accessToken}`}}, {retries:4,baseDelay:700});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error('Gagal memeriksa file backup Google Drive: '+JSON.stringify(data));
  return data.files?.[0] || null;
}

async function uploadBytesToGoogleDriveFolder(env, accessToken, parentFolderId, fileName, bytes, fileType='application/octet-stream', uploadId='') {
  // Evidence is capped at 10 MB in this application. For files of this size,
  // Drive multipart upload is simpler and more reliable in Cloudflare Workers
  // than a resumable session. It also avoids retrying a PUT against a stale
  // resumable-session URL.
  const existing = await findDriveFileByUploadId(accessToken, parentFolderId, uploadId);
  if (existing) return existing.id;

  const metadata = {
    name: String(fileName || 'evidence'),
    parents: [parentFolderId],
    appProperties: { kawalUploadId: String(uploadId || '') }
  };

  const endpoint = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink';
  let lastError = null;

  // POST is deliberately retried only after checking Drive by uploadId. This
  // prevents a lost HTTP response from creating duplicate Drive files.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = new FormData();
      body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      body.append('file', new Blob([bytes], { type: fileType || 'application/octet-stream' }), String(fileName || 'evidence'));

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body
      });
      const raw = await res.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }

      if (res.ok && data.id) return data.id;

      const err = new Error(`Google Drive upload gagal (HTTP ${res.status}): ${JSON.stringify(data)}`);
      err.status = res.status;
      lastError = err;

      const after = await findDriveFileByUploadId(accessToken, parentFolderId, uploadId);
      if (after) return after.id;

      if (![408, 425, 429, 500, 502, 503, 504].includes(res.status) || attempt === 2) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(4000, 700 * Math.pow(2, attempt) + Math.floor(Math.random() * 300))));
    } catch (err) {
      lastError = err;
      if (err?.name === 'TypeError' && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, Math.min(4000, 700 * Math.pow(2, attempt))));
        continue;
      }
      if (attempt === 2) break;
      // A network failure may mean Drive already committed the multipart POST.
      try {
        const after = await findDriveFileByUploadId(accessToken, parentFolderId, uploadId);
        if (after) return after.id;
      } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, Math.min(4000, 700 * Math.pow(2, attempt) + Math.floor(Math.random() * 300))));
    }
  }

  throw lastError || new Error('Upload Google Drive gagal tanpa pesan error.');
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
  const stableUploadId = `backup:${filePath}`;
  return uploadBytesToGoogleDriveFolder(env, accessToken, currentFolderId, fileName, bytes, 'application/octet-stream', stableUploadId);
}

async function updateEvidenceFileStatus(env, job, patch) {
  const rec = await env.DB.prepare("SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(job.opdId,job.year).all();
  let obj={}; try{obj=rec.results[0]?.subunsurs?JSON.parse(rec.results[0].subunsurs):{}}catch{}
  const arr=obj?.[job.subunsur]?.[job.paramId]?.['files'+job.level];
  const index=Array.isArray(arr)?arr.findIndex(x=>x&&x.uploadId===job.uploadId):-1;
  if(index<0) return;
  const esc=(v)=>String(v).replace(/\"/g,'\\\"'); const base=`$.\"${esc(job.subunsur)}\".\"${esc(job.paramId)}\".\"files${esc(job.level)}\"[${index}]`;
  const sets=[]; const vals=[];
  for(const [k,v] of Object.entries(patch||{})){ sets.push(`json_set(COALESCE(subunsurs,'{}'), ?, json(?))`); vals.push(`${base}.'${String(k).replace(/'/g,"''")}'`, JSON.stringify(v)); }
  if(!sets.length) return;
  let expr='COALESCE(subunsurs,\'{}\')'; const binds=[];
  for(const [k,v] of Object.entries(patch||{})){ expr=`json_set(${expr}, ?, json(?))`; binds.push(`${base}.\"${String(k).replace(/\"/g,'\\\"')}\"`,JSON.stringify(v)); }
  await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_data SET subunsurs=${expr} WHERE id=? AND year=?`).bind(...binds,job.opdId,job.year));
}

async function updateRtpFileStatus(env, job, patch) {
  const rec = await env.DB.prepare("SELECT rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(job.opdId,job.year).all();
  let list=[]; try{list=rec.results[0]?.rtp_evidence?JSON.parse(rec.results[0].rtp_evidence):[]}catch{}
  const index=Array.isArray(list)?list.findIndex(x=>x&&x.uploadId===job.uploadId):-1;
  if(index<0) return;
  const base=`$[${index}]`; let expr='COALESCE(rtp_evidence,\'[]\')'; const binds=[];
  for(const [k,v] of Object.entries(patch||{})){ expr=`json_set(${expr}, ?, json(?))`; binds.push(`${base}.\"${String(k).replace(/\"/g,'\\\"')}\"`,JSON.stringify(v)); }
  await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_data SET rtp_evidence=${expr} WHERE id=? AND year=?`).bind(...binds,job.opdId,job.year));
}

async function directGoogleDriveBackup(env, job) {
  return withGoogleConcurrency(async()=>{
    if(!env.GOOGLE_DRIVE_CLIENT_ID||!env.GOOGLE_DRIVE_CLIENT_SECRET||!env.GOOGLE_DRIVE_REFRESH_TOKEN||!env.GOOGLE_DRIVE_FOLDER_ID){
      throw new Error('Konfigurasi Google Drive belum lengkap');
    }
    const obj=await env.EVIDENCE_BUCKET.get(job.r2Key);
    if(!obj) throw new Error('File sumber di R2 tidak ditemukan');
    const bytes=new Uint8Array(await obj.arrayBuffer());
    if(bytes.byteLength>10*1024*1024) throw new Error('File > 10 MB');
    const token=await getGoogleAccessToken(env);

    if(job.type==='rtp'){
      let evidenceFolder=job.gdriveFolderId;
      if(evidenceFolder){
        const folder=await getDriveFile(token,evidenceFolder);
        if(!folder || folder.trashed || folder.mimeType!=='application/vnd.google-apps.folder') evidenceFolder=null;
      }
      if(!evidenceFolder){
        evidenceFolder=(await getRtpDriveFolder(env,token,job.year,job.opdName,job.folderName)).evidenceFolder;
      }
      const gdriveId=await uploadBytesToGoogleDriveFolder(env,token,evidenceFolder,job.fileName,bytes,job.fileType,job.uploadId);
      const uploaded=await getDriveFile(token,gdriveId);
      if(!uploaded || uploaded.trashed) throw new Error('Google Drive mengembalikan ID tetapi file tidak dapat diverifikasi.');
      if(!(Array.isArray(uploaded.parents)&&uploaded.parents.includes(evidenceFolder))) throw new Error('File berhasil di-upload tetapi masuk ke folder Google Drive yang tidak sesuai.');
      return gdriveId;
    }

    if(job.type==='report'){
      let reportFolder=job.gdriveFolderId;
      if(reportFolder){
        const folder=await getDriveFile(token,reportFolder);
        if(!folder || folder.trashed || folder.mimeType!=='application/vnd.google-apps.folder') reportFolder=null;
      }
      if(!reportFolder){
        reportFolder=(await getReportDriveFolder(env,token,job.year,job.opdName,job.reportType)).reportFolder;
      }
      const gdriveId=await uploadBytesToGoogleDriveFolder(env,token,reportFolder,job.fileName,bytes,job.fileType,job.uploadId);
      const uploaded=await getDriveFile(token,gdriveId);
      if(!uploaded || uploaded.trashed) throw new Error('Google Drive mengembalikan ID tetapi file laporan tidak dapat diverifikasi.');
      if(!(Array.isArray(uploaded.parents)&&uploaded.parents.includes(reportFolder))) throw new Error('File laporan berhasil di-upload tetapi masuk ke folder Google Drive yang tidak sesuai.');
      return gdriveId;
    }

    const parts=String(job.r2Key).split('/');
    parts.pop();
    let parent=env.GOOGLE_DRIVE_FOLDER_ID;
    for(const part of parts){
      if(part) parent=await getOrCreateFolder(token,parent,part);
    }
    return uploadBytesToGoogleDriveFolder(env,token,parent,job.fileName,bytes,job.fileType,job.uploadId);
  },3);
}

async function processDriveBackupJob(env, job) {
  try {
    const gdriveId = await directGoogleDriveBackup(env, job);
    if (job.type === 'rtp') {
      await updateRtpFileStatus(env, job, { gdriveId, storage: 'R2 + Google Drive', syncStatus: 'done', syncError: null });
    } else if (job.type === 'report') {
      await updateReportFileStatus(env, job, { gdriveId, storage: 'R2 + Google Drive', syncStatus: 'done', syncError: null });
    } else {
      await updateEvidenceFileStatus(env, job, { gdriveId, storage: 'R2 + Google Drive', syncStatus: 'done', syncError: null });
    }
    return { ok: true, gdriveId };
  } catch (err) {
    const message = String(err?.message || err);
    if (job.type === 'rtp') {
      await updateRtpFileStatus(env, job, { syncStatus: 'retrying', syncError: message });
    } else if (job.type === 'report') {
      await updateReportFileStatus(env, job, { syncStatus: 'retrying', syncError: message });
    } else {
      await updateEvidenceFileStatus(env, job, { syncStatus: 'retrying', syncError: message });
    }
    console.warn('Google Drive backup tertunda:', message);
    return { ok: false, error: message };
  }
}

function scheduleDriveBackup(env, ctx, job) {
  // R2 is the durable staging layer. Google Drive remains mandatory as the
  // final backup destination. waitUntil keeps the upload request fast while
  // Cloudflare continues the Drive transfer after the response is prepared.
  if (ctx?.waitUntil) {
    ctx.waitUntil(processDriveBackupJob(env, job));
  }
}

function notifyRealtime(env, ctx, year, payload = {}) {
  try {
    if (!env?.REALTIME || !year) return;
    const room = `year:${String(year)}`;
    const id = env.REALTIME.idFromName(room);
    const body = JSON.stringify({
      type: 'data-changed',
      year: String(year),
      at: new Date().toISOString(),
      ...payload
    });
    const task = env.REALTIME.get(id).fetch(new Request('https://realtime.internal/broadcast', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body
    })).catch(err => console.warn('Realtime broadcast gagal:', err?.message || err));
    if (ctx?.waitUntil) ctx.waitUntil(task);
  } catch (err) {
    console.warn('Realtime notify gagal:', err?.message || err);
  }
}

async function deleteGoogleDriveFile(env, fileId) {
  const safeId = String(fileId || '').trim();
  if (!safeId) return { deleted: false, alreadyMissing: true };

  return withGoogleConcurrency(async () => {
    const accessToken = await getGoogleAccessToken(env);
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(safeId)}?supportsAllDrives=true`;
    const response = await fetchWithRetry(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    }, { retries: 3, baseDelay: 500 });

    if (response.status === 404) {
      // File sudah tidak ada di Drive; dari sisi penghapusan hasil akhirnya sama.
      return { deleted: true, alreadyMissing: true };
    }

    if (!response.ok) {
      const errText = await response.text();
      const err = new Error(
        `Gagal hapus file di Google Drive (HTTP ${response.status}): ${errText || response.statusText || 'unknown error'}`
      );
      err.status = response.status;
      throw err;
    }

    return { deleted: true, alreadyMissing: false };
  });
}

async function updateGoogleDriveFileContent(env, fileId, fileName, bytes, fileType='application/octet-stream') {
  const accessToken = await getGoogleAccessToken(env);
  const safeName = String(fileName || 'evidence').substring(0, 150) || 'evidence';
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = new FormData();
      body.append('metadata', new Blob([JSON.stringify({ name: safeName })], { type: 'application/json' }));
      body.append('file', new Blob([bytes], { type: fileType || 'application/octet-stream' }), safeName);
      const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink,trashed`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
        body
      });
      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
      if (response.ok && data.id) return data;
      const err = new Error(`Google Drive replace gagal (HTTP ${response.status}): ${JSON.stringify(data)}`);
      err.status = response.status;
      lastError = err;
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) throw err;
      await new Promise(resolve => setTimeout(resolve, Math.min(4000, 700 * Math.pow(2, attempt) + Math.floor(Math.random() * 300))));
    } catch (err) {
      lastError = err;
      if (attempt === 2) break;
      if (![408, 425, 429, 500, 502, 503, 504].includes(Number(err?.status)) && err?.name !== 'TypeError') throw err;
      await new Promise(resolve => setTimeout(resolve, Math.min(4000, 700 * Math.pow(2, attempt))));
    }
  }
  throw lastError || new Error('Google Drive replace gagal tanpa pesan error.');
}

function calculateQaApipScore({availability, validity, periodOk, substance}) {
  const k=String(availability||'');
  const m=String(validity||'');
  const n=String(periodOk||'');
  const o=String(substance||'');
  if (!k || k === 'N/A') return null;
  if (k === 'Tidak Ada') return 0;
  if (!o) return null;
  if (o === 'Tidak Sesuai') return 0;
  return (m === 'Ya' && n === 'Ya' && o === 'Sesuai') ? 1 : 0.5;
}
function calculateQaApipConclusion({availability, score}) {
  if (String(availability||'') === 'N/A') return 'N/A';
  if (score === null || score === undefined || score === '') return 'Belum dinilai';
  const n=Number(score);
  if (n === 1) return 'Memenuhi';
  if (n === 0.5) return 'Memenuhi Sebagian';
  return 'Tidak Memenuhi';
}
function sanitizeQaText(value,max=1000){
  return String(value ?? '').replace(/[<>`]/g,'').trim().substring(0,max);
}
function validQaItemLocation(subunsur,paramId,grade,itemNo){
  const sub=String(subunsur||''); const pid=String(paramId||''); const g=String(grade||'').toUpperCase(); const no=Number(itemNo);
  if(!SUBUNSUR_DATA[sub]) return false;
  const p=SUBUNSUR_DATA[sub].params?.find(x=>String(x.id)===pid);
  if(!p || !['E','D','C','B','A'].includes(g) || !Number.isInteger(no) || no<1 || no>20) return false;
  return true;
}

export async function onRequest({ request, env, ctx }) {
  const ACCESS_PASSWORD = env.ACCESS_PASSWORD;
  const DELETE_PASSWORD = env.DELETE_PASSWORD;
  const url = new URL(request.url);
  let params = {};
  let action = url.searchParams.get('action') || '';

  // Daftar aksi sensitif yang tidak boleh diakses via GET
  const SENSITIVE_ACTIONS = [
    'verifyAccess', 'verifyDelete', 'addOpd', 'saveData', 'saveField',
    'uploadFile', 'deleteFile', 'saveEvidenceVerification', 'saveRtpEvidenceVerification', 'saveQaApipItem', 'deleteQaApipItem', 'deleteOpd', 'addYear', 'deleteYear',
    'createBackup', 'restoreBackup', 'deleteBackup', 'createKkSheets', 'saveKkData', 'getKkPmData', 'saveKkPmData', 'saveRow', 'saveSubunsur', 'createRtpKkSheets', 'saveRtpKkData', 'saveRtpEvidenceFolder', 'uploadRtpEvidence', 'deleteRtpEvidence', 'replaceEvidenceFile', 'replaceRtpEvidence', 'uploadReportFile', 'deleteReportFile', 'retryDriveBackup'
  ];

  // KK RTP dan pengaturan folder Evidence RTP wajib melalui POST.
  if (request.method === 'POST') {
    try {
      const contentType=request.headers.get('content-type')||'';
      // Binary upload mode: metadata stays in the query string; the request body is the file stream.
      if(action==='uploadFile' || action==='uploadRtpEvidence' || action==='replaceEvidenceFile' || action==='replaceRtpEvidence' || action==='uploadReportFile'){
        url.searchParams.forEach((value,key)=>{params[key]=value;});
        params.fileType=params.fileType||contentType||'application/octet-stream';
        params.fileName=params.fileName||request.headers.get('X-File-Name')||'evidence';
        params.uploadId=params.uploadId||request.headers.get('X-Upload-Id')||crypto.randomUUID();
        params.fileSize=Number(request.headers.get('Content-Length')||0)||0;
      }else if(contentType.includes('multipart/form-data')){
        const form=await request.formData();
        form.forEach((value,key)=>{
          if(key!=='file' && typeof value==='string') params[key]=value;
          else if(key==='file' && value instanceof File) params.file=value;
        });
        if(!action && params.action) action=params.action;
      }else{
        params=await request.json();
        if(!action && params.action) action=params.action;
      }
    } catch (e) {
      return jsonResponse({ status: 'error', message: 'Invalid POST body' }, 400);
    }
  } else {
    if (SENSITIVE_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ status: 'error', message: 'Method GET tidak diizinkan untuk aksi ini. Gunakan POST.' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }
    url.searchParams.forEach((value, key) => { params[key] = value; });
  }

  const year = params.year || '2026';
  await ensureOpdSchema(env);

  // Rate limiting untuk aksi login: hanya percobaan SALAH yang dihitung.
  // Password yang benar selalu dapat masuk, sekaligus mereset penghitung percobaan.
  let clientIp = 'unknown';
  let loginRateLimited = false;
  if (action === 'verifyAccess' || action === 'verifyDelete') {
    clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    try {
      const now = Date.now();
      const windowMs = 10 * 60 * 1000;
      const { results } = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND action = ? AND timestamp > ?"
      ).bind(clientIp, action, now - windowMs).all();
      loginRateLimited = Number(results?.[0]?.count || 0) >= 5;
    } catch (err) {
      console.warn('Rate-limit check dilewati:', err);
    }
  }

  function getFolderStructure(params) {
    const { fileData, fileName, opdName, subunsur, paramId, level, fileType } = params;
    let bytes = null;
    if (fileData) {
      const binaryString = atob(fileData);
      const len = binaryString.length;
      bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      if (bytes.length / 1024 / 1024 > 10) throw new Error('File > 10MB, terlalu besar!');
    }
    const unsurKey = subunsur.split('.')[0];
    const unsurName = UNSUR_MAP[unsurKey] || `Unsur ${unsurKey}`;
    
    // Sanitasi semua komponen path
    const safeOpd = sanitizeString(opdName).substring(0, 80) || 'OPD';
    const subUnsurLabel = SUBUNSUR_DATA[subunsur] ? SUBUNSUR_DATA[subunsur].label : subunsur;
    const safeSubUnsur = sanitizeString(subUnsurLabel).substring(0, 80);
    let paramDesc = paramId;
    if (SUBUNSUR_DATA[subunsur] && SUBUNSUR_DATA[subunsur].params) {
      const paramObj = SUBUNSUR_DATA[subunsur].params.find(p => p.id === paramId);
      if (paramObj) paramDesc = paramObj.desc;
    }
    const safeParam = sanitizeString(paramDesc).substring(0, 100);
    const safeFileName = sanitizeString(fileName).substring(0, 150);
    
    const filePath = `kawal_spip/${year}/${safeOpd}/${unsurName}/${safeSubUnsur}/${safeParam}/Level_${level}/${safeFileName}`;
    return { filePath, bytes, fileType: fileType || 'application/octet-stream', fileName: safeFileName };
  }

  try {
    switch (action) {
      case 'getSubunsurData':
        return new Response(JSON.stringify(SUBUNSUR_DATA), { status: 200, headers: { 'Content-Type': 'application/json' } });

      case 'verifyAccess': {
        const ok = params.password === ACCESS_PASSWORD;
        if (ok) {
          try { await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ? AND action = ?").bind(clientIp, action).run(); } catch {}
          return new Response(JSON.stringify({ status: 'success', message: 'Akses diterima' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (loginRateLimited) {
          return new Response(JSON.stringify({ status: 'error', message: 'Terlalu banyak percobaan salah. Coba lagi dalam 10 menit.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
        }
        try {
          await env.DB.prepare("INSERT INTO login_attempts (ip, action, timestamp) VALUES (?, ?, ?)").bind(clientIp, action, Date.now()).run();
        } catch {}
        return new Response(JSON.stringify({ status: 'error', message: 'Password salah' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'verifyDelete': {
        const ok = params.password === DELETE_PASSWORD;
        if (ok) {
          try { await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ? AND action = ?").bind(clientIp, action).run(); } catch {}
          return new Response(JSON.stringify({ status: 'success', message: 'Password hapus benar' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (loginRateLimited) {
          return new Response(JSON.stringify({ status: 'error', message: 'Terlalu banyak percobaan salah. Coba lagi dalam 10 menit.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
        }
        try {
          await env.DB.prepare("INSERT INTO login_attempts (ip, action, timestamp) VALUES (?, ?, ?)").bind(clientIp, action, Date.now()).run();
        } catch {}
        return new Response(JSON.stringify({ status: 'error', message: 'Password hapus salah' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'getData': {
        const {results}=await env.DB.prepare("SELECT * FROM opd_data WHERE year=? ORDER BY CAST(nilai_maturitas AS REAL) DESC, CAST(nilai_struktur_proses AS REAL) DESC, CAST(mri AS REAL) DESC, CAST(iepk AS REAL) DESC").bind(year).all();
        const levelRows=await env.DB.prepare("SELECT opd_id,subunsur,param_id,level FROM opd_parameter_levels_v2 WHERE year=?").bind(String(year)).all();
        const qaSummaryRows=await env.DB.prepare(`
          SELECT opd_id,
                 COUNT(*) AS stored_items,
                 SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) AS evaluated_items,
                 SUM(CASE WHEN availability='N/A' THEN 1 ELSE 0 END) AS na_items,
                 COALESCE(SUM(CASE WHEN score IS NOT NULL THEN score ELSE 0 END),0) AS sum_score
          FROM opd_qa_apip_items WHERE year=? GROUP BY opd_id
        `).bind(String(year)).all();
        const qaSummaryMap=new Map();
        for(const q of (qaSummaryRows.results||[])) qaSummaryMap.set(String(q.opd_id),q);
        const kkPmSummaryRows=await env.DB.prepare(`
          SELECT opd_id,
                 COUNT(*) AS stored_items,
                 SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) AS evaluated_items,
                 SUM(CASE WHEN availability='N/A' THEN 1 ELSE 0 END) AS na_items,
                 COALESCE(SUM(CASE WHEN score IS NOT NULL THEN score ELSE 0 END),0) AS sum_score
          FROM opd_kk_pm_items WHERE year=? GROUP BY opd_id
        `).bind(String(year)).all();
        const kkPmSummaryMap=new Map();
        for(const q of (kkPmSummaryRows.results||[])) kkPmSummaryMap.set(String(q.opd_id),q);
        const levelMap=new Map();
        for(const lr of (levelRows.results||[])){
          const key=`${lr.opd_id}|${lr.subunsur}|${lr.param_id}`;
          levelMap.set(key,Math.max(0,Math.min(5,Number(lr.level)||0)));
        }
        const mapped=results.map(r=>{
          let subunsurs={};
          try{subunsurs=r.subunsurs?JSON.parse(r.subunsurs):{}}catch{subunsurs={};}
          const kkData=normalizeKkData(r.kk_data);
          let kkPmData={}; try{kkPmData=r.kk_pm_data?JSON.parse(r.kk_pm_data):{}}catch{}
          const kkRtpData=normalizeWorkbookData(r.kk_rtp_data,[]);
          let rtpEvidence=[]; try{rtpEvidence=r.rtp_evidence?JSON.parse(r.rtp_evidence):[]}catch{}
          let pmSpipReports=[]; try{pmSpipReports=r.pm_spip_reports?JSON.parse(r.pm_spip_reports):[]}catch{}
          let rrRtpReports=[]; try{rrRtpReports=r.rr_rtp_reports?JSON.parse(r.rr_rtp_reports):[]}catch{}
          const parameterLevels={};
          for(const [subCode, info] of Object.entries(SUBUNSUR_DATA||{})){
            for(const prm of (Array.isArray(info?.params)?info.params:[])){
              const key=`${r.id}|${subCode}|${prm.id}`;
              const jsonLevel = subunsurs?.[subCode]?.[prm.id]?.level;
              // The nested subunsurs JSON is the primary source for levels.
              // The v2 table is only a fallback for legacy/missing JSON values,
              // so stale zero values in the auxiliary table never hide a saved level.
              const hasJsonLevel = jsonLevel !== undefined && jsonLevel !== null && jsonLevel !== '';
              const v = hasJsonLevel
                ? Math.max(0,Math.min(5,Number(jsonLevel)||0))
                : (levelMap.has(key) ? levelMap.get(key) : 0);
              parameterLevels[`${subCode}|${prm.id}`]=v;
              subunsurs[subCode]=subunsurs[subCode]||{};
              subunsurs[subCode][prm.id]=subunsurs[subCode][prm.id]||{};
              subunsurs[subCode][prm.id].level=v;
            }
          }
          let sumLevels=0, selected=0; const totalParams=countTotalParameters();
          for(const v of Object.values(parameterLevels)){ if(v>0){selected++;sumLevels+=v;} }
          const strukturNilai=totalParams?Math.round((sumLevels/totalParams)*100)/100:0;
          const strukturEvidenceCount=countParameterEvidence(subunsurs);
          const strukturStatus=strukturEvidenceCount===totalParams?'Selesai':(strukturEvidenceCount>0?'Proses':'Belum');
          const qaEvidenceFiles=countStructureEvidenceFiles(subunsurs);
          const q=qaSummaryMap.get(String(r.id));
          const qaEvaluated=Number(q?.evaluated_items||0);
          const qaNa=Number(q?.na_items||0);
          const qaSum=Number(q?.sum_score||0);
          const qaTotalItems=671;
          const qaPending=Math.max(0,qaTotalItems-qaEvaluated-qaNa);
          const qaApplicableItems=Math.max(0,qaTotalItems-qaNa);
          const qaPercentage=qaApplicableItems>0 ? Math.round((qaSum/qaApplicableItems)*10000)/100 : 0;
          const qaCompletion=qaTotalItems>0 ? Math.round(((qaEvaluated+qaNa)/qaTotalItems)*10000)/100 : 0;
          const qaStatus=qaCompletion>=100?'Selesai':(qaCompletion>0?'Proses':'Belum');
          const pm=kkPmSummaryMap.get(String(r.id));
          const pmEvaluated=Number(pm?.evaluated_items||0);
          const pmNa=Number(pm?.na_items||0);
          const pmSum=Number(pm?.sum_score||0);
          const pmTotalItems=671;
          const pmPending=Math.max(0,pmTotalItems-pmEvaluated-pmNa);
          const pmApplicable=Math.max(0,pmTotalItems-pmNa);
          const pmPercentage=pmApplicable>0 ? Math.round((pmSum/pmApplicable)*10000)/100 : 0;
          const pmCompletion=pmTotalItems>0 ? Math.round(((pmEvaluated+pmNa)/pmTotalItems)*10000)/100 : 0;
          const pmStatus=pmCompletion>=100?'Selesai':(pmCompletion>0?'Proses':'Belum');
          return{...r,subunsurs,parameterLevels,totalParameterLevels:totalParams,selectedParameterLevels:selected,sumParameterLevels:sumLevels,kkData,kkPmData,kkRtpData,rtpEvidence,rtpEvidenceFolder:r.rtp_evidence_folder||'Evidence RTP',pmSpipReports,pmSpipFolder:r.pm_spip_folder||'Laporan Hasil PM SPIP',pmSpipFolderId:r.pm_spip_folder_id||null,rrRtpReports,rrRtpFolder:r.rr_rtp_folder||'Laporan Pemantauan RR_RTP',rrRtpFolderId:r.rr_rtp_folder_id||null,qaApip:qaStatus,qaApipSummary:{total:qaTotalItems,evaluated:qaEvaluated,na:qaNa,pending:qaPending,sum:qaSum,percentage:qaPercentage,completion:qaCompletion,evidenceFiles:qaEvidenceFiles,status:qaStatus},kkPmSummary:{total:pmTotalItems,evaluated:pmEvaluated,na:pmNa,pending:pmPending,sum:pmSum,percentage:pmPercentage,completion:pmCompletion,status:pmStatus},nilaiStrukturProses:strukturNilai,sa:strukturNilai,strukturProsesStatus:strukturStatus,nilaiMaturitas:Number(r.nilai_maturitas||0),nilaiKapabilitasApip:Number(r.nilai_kapabilitas_apip||0)};
        });
        return new Response(JSON.stringify(mapped),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store, no-cache, must-revalidate, max-age=0'}});
      }
      case 'addOpd': {
        const id = params.id || 'r' + Math.random().toString(36).slice(2,9);
        const opd = sanitizeString(params.opd || 'OPD Baru');
        const subunsurs = params.subunsurs || {};
        const sa = calculateSAFromSubunsur(subunsurs);
        const nilaiStrukturProses=sa,nilaiMaturitas=Math.max(0,Math.min(5,Number(params.nilaiMaturitas??params.nilai_maturitas??0)||0)),nilaiKapabilitasApip=Number(params.nilaiKapabilitasApip??params.nilai_kapabilitas_apip??0)||0;
        await env.DB.prepare("INSERT OR REPLACE INTO opd_data (id,opd,sa,nilai_struktur_proses,nilai_maturitas,nilai_kapabilitas_apip,evidence,qa_apip,mri,iepk,rtp,status,struktur_proses_status,subunsurs,year,kk_data,kk_pm_data,kk_rtp_data,rtp_evidence,rtp_evidence_folder) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,opd,sa,nilaiStrukturProses,nilaiMaturitas,nilaiKapabilitasApip,params.evidence||'Belum',params.qaApip||'Belum',parseFloat(params.mri)||0,parseFloat(params.iepk)||0,params.rtp||'Belum',params.status||'Belum','Belum',JSON.stringify(subunsurs),year,params.kkData||'{}',params.kkPmData||'{}',params.kkRtpData||'{}',JSON.stringify(params.rtpEvidence||[]),params.rtpEvidenceFolder||'Evidence RTP').run();
        notifyRealtime(env, ctx, year, { action: 'addOpd', opdId: id });
        return new Response(JSON.stringify({ status: 'success', message: 'OPD berhasil ditambahkan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'saveData': {
        const rows = JSON.parse(params.rows);
        if (!Array.isArray(rows)) throw new Error('Data rows tidak valid');

        // IMPORTANT: saveData must never write the whole nested evidence JSON
        // from a stale browser snapshot. It updates only scalar/top-level fields
        // and leaves subunsurs, rtp_evidence, KK data, and other nested data intact.
        const statements = [];
        for (const row of rows) {
          statements.push(env.DB.prepare(`
            UPDATE opd_data SET
              opd=?,
              nilai_maturitas=?,
              nilai_kapabilitas_apip=?,
              evidence=?,
              qa_apip=?,
              mri=?,
              iepk=?,
              rtp=?,
              status=?
            WHERE id=? AND year=?
          `).bind(
            sanitizeString(row.opd||''),
            Math.max(0,Math.min(5,Number(row.nilaiMaturitas??row.nilai_maturitas??0)||0)),
            Number(row.nilaiKapabilitasApip??row.nilai_kapabilitas_apip??0)||0,
            row.evidence||'Belum', row.qaApip||'Belum', parseFloat(row.mri)||0,
            parseFloat(row.iepk)||0, row.rtp||'Belum', row.status||'Belum',
            row.id, year
          ));
        }
        // Run in batches to remain efficient for many OPDs.
        for (let i=0;i<statements.length;i+=50) await env.DB.batch(statements.slice(i,i+50));
        notifyRealtime(env, ctx, year, { action: 'saveData' });
        return jsonResponse({status:'success',message:`${rows.length} data tersimpan`});
      }

      case 'saveRow': {
        const row=params.row||{};
        if(!row.id)throw new Error('ID OPD wajib diisi');
        const existing=await env.DB.prepare("SELECT id FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(row.id,year).all();
        if(existing.results.length){
          // Existing row: preserve all nested evidence/KK/RTР fields.
          await env.DB.prepare(`UPDATE opd_data SET opd=?, nilai_maturitas=?, nilai_kapabilitas_apip=?, evidence=?, qa_apip=?, mri=?, iepk=?, rtp=?, status=? WHERE id=? AND year=?`).bind(
            sanitizeString(row.opd||''),
            Math.max(0,Math.min(5,Number(row.nilaiMaturitas??row.nilai_maturitas??0)||0)),
            Number(row.nilaiKapabilitasApip??row.nilai_kapabilitas_apip??0)||0,
            row.evidence||'Belum', row.qaApip||'Belum', parseFloat(row.mri)||0,
            parseFloat(row.iepk)||0, row.rtp||'Belum', row.status||'Belum', row.id, year
          ).run();
        } else {
          const subunsurs=row.subunsurs||{};
          const sa=calculateSAFromSubunsur(subunsurs);
          const strukturStatus=countParameterEvidence(subunsurs)===countTotalParameters()?'Selesai':(countParameterEvidence(subunsurs)>0?'Proses':'Belum');
          await env.DB.prepare("INSERT INTO opd_data (id,opd,sa,nilai_struktur_proses,nilai_maturitas,nilai_kapabilitas_apip,evidence,qa_apip,mri,iepk,rtp,status,struktur_proses_status,subunsurs,year,kk_data,kk_pm_data,kk_rtp_data,rtp_evidence,rtp_evidence_folder) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(row.id,sanitizeString(row.opd||''),sa,sa,Math.max(0,Math.min(5,Number(row.nilaiMaturitas??row.nilai_maturitas??0)||0)),Number(row.nilaiKapabilitasApip??row.nilai_kapabilitas_apip??0)||0,row.evidence||'Belum',row.qaApip||'Belum',parseFloat(row.mri)||0,parseFloat(row.iepk)||0,row.rtp||'Belum',row.status||'Belum',strukturStatus,JSON.stringify(subunsurs),year,JSON.stringify(row.kkData||{}),JSON.stringify(row.kkPmData||{}),JSON.stringify(row.kkRtpData||{}),JSON.stringify(Array.isArray(row.rtpEvidence)?row.rtpEvidence:[]),row.rtpEvidenceFolder||'Evidence RTP').run();
        }
        notifyRealtime(env, ctx, year, { action: 'saveRow', opdId: row.id });
        return jsonResponse({status:'success',message:'Data OPD tersimpan'});
      }
      case 'saveSubunsur': {
        if (!params.opdId) throw new Error('ID OPD wajib diisi');

        // Preferred path: send only changed parameter fields. Each JSON_SET is
        // one atomic SQLite/D1 UPDATE, so two users editing different parameters
        // cannot overwrite each other's unrelated changes.
        let changes = params.changes;
        if (typeof changes === 'string') { try { changes = JSON.parse(changes); } catch { changes = null; } }

        if (Array.isArray(changes)) {
          const totalParams = Math.max(1, Object.values(SUBUNSUR_DATA).reduce((n, x) => n + ((x && Array.isArray(x.params)) ? x.params.length : 0), 0));
          const valid = changes.filter(c =>
            c && /^[A-Za-z0-9_.-]{1,40}$/.test(String(c.subCode || '')) &&
            /^[A-Za-z0-9_.-]{1,80}$/.test(String(c.paramId || '')) &&
            /^(level|evid[1-5])$/.test(String(c.field || ''))
          ).slice(0, 200);

          for (const change of valid) {
            const subCode = String(change.subCode);
            const paramId = String(change.paramId);
            const field = String(change.field);
            const path = '$."' + subCode.replace(/"/g, '') + '"."' + paramId.replace(/"/g, '') + '"."' + field + '"';
            if (field === 'level') {
              const newLevel = Math.max(0, Math.min(5, Number(change.value) || 0));
              // IMPORTANT: do NOT calculate the derived SA from the JSON column in the
              // same UPDATE statement. SQLite may evaluate json_extract() against the
              // already-updated value, which turns the intended (new-old) delta into
              // zero and leaves SA stuck at 0. We update the authoritative subunsurs
              // first, then calculate SA from the freshly re-read JSON below.
              await runD1WithRetry(() => env.DB.prepare(
                "UPDATE opd_data SET subunsurs=json_set(COALESCE(subunsurs,'{}'), ?, json(?)) WHERE id=? AND year=?"
              ).bind(path, newLevel, params.opdId, year));
              await runD1WithRetry(() => env.DB.prepare(`INSERT INTO opd_parameter_levels_v2(year,opd_id,subunsur,param_id,level,updated_at)
                VALUES(?,?,?,?,?,?)
                ON CONFLICT(year,opd_id,subunsur,param_id) DO UPDATE SET level=excluded.level, updated_at=excluded.updated_at`
              ).bind(String(year),String(params.opdId),subCode,paramId,newLevel,Date.now()));
            } else {
              const value = String(change.value ?? '').substring(0, 5000);
              await runD1WithRetry(() => env.DB.prepare(
                "UPDATE opd_data SET subunsurs=json_set(COALESCE(subunsurs,'{}'), ?, json(?)) WHERE id=? AND year=?"
              ).bind(path, value, params.opdId, year));
            }
          }

          // Re-read the authoritative nested document after all atomic field writes,
          // then recompute the derived value/status from the CURRENT database state.
          const rec = await env.DB.prepare("SELECT subunsurs, sa, nilai_struktur_proses FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId, year).all();
          if (!rec.results.length) throw new Error('OPD tidak ditemukan');
          let authoritativeSubunsurs={};
          try { authoritativeSubunsurs = rec.results[0].subunsurs ? JSON.parse(rec.results[0].subunsurs) : {}; } catch { authoritativeSubunsurs={}; }
          const levelRowsForOpd=await env.DB.prepare("SELECT subunsur,param_id,level FROM opd_parameter_levels_v2 WHERE year=? AND opd_id=?").bind(String(year),String(params.opdId)).all();
          const authoritativeLevels=new Map();
          for(const lr of (levelRowsForOpd.results||[])) authoritativeLevels.set(`${lr.subunsur}|${lr.param_id}`,Math.max(0,Math.min(5,Number(lr.level)||0)));
          let breakdown={ totalParams:countTotalParameters(), selectedParams:0, sumLevels:0, byLevel:{1:0,2:0,3:0,4:0,5:0} }; // mutable: refreshed by the authoritative verification pass below
          for(const [subCode,info] of Object.entries(SUBUNSUR_DATA||{})){
            for(const prm of (Array.isArray(info?.params)?info.params:[])){
              const jsonLevel = authoritativeSubunsurs?.[subCode]?.[prm.id]?.level;
              const keyLevel = `${subCode}|${prm.id}`;
              const lv = authoritativeLevels.has(keyLevel)
                ? authoritativeLevels.get(keyLevel)
                : Math.max(0,Math.min(5,Number(jsonLevel)||0));
              if(lv>0){breakdown.selectedParams++;breakdown.sumLevels+=lv;breakdown.byLevel[lv]++;}
            }
          }
          breakdown.value=Math.round((breakdown.sumLevels/breakdown.totalParams)*100)/100;
          let currentSa=breakdown.value;
          let currentStatus=(countParameterEvidence(authoritativeSubunsurs)===countTotalParameters()?'Selesai':(countParameterEvidence(authoritativeSubunsurs)>0?'Proses':'Belum'));
          // Keep the persisted derived columns converged with the authoritative JSON.
          // A short second pass protects against another operator writing another
          // parameter between our read and derived-column update.
          for (let pass=0; pass<2; pass++) {
            await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET sa=?, nilai_struktur_proses=?, struktur_proses_status=? WHERE id=? AND year=?").bind(currentSa,currentSa,currentStatus,params.opdId,year));
            const verify=await env.DB.prepare("SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
            let latest={};
            try { latest=verify.results?.[0]?.subunsurs ? JSON.parse(verify.results[0].subunsurs) : {}; } catch { latest={}; }
            const latestLevelRows=await env.DB.prepare("SELECT subunsur,param_id,level FROM opd_parameter_levels_v2 WHERE year=? AND opd_id=?").bind(String(year),String(params.opdId)).all();
            const lm=new Map(); for(const lr of (latestLevelRows.results||[])) lm.set(`${lr.subunsur}|${lr.param_id}`,Math.max(0,Math.min(5,Number(lr.level)||0)));
            const latestBreakdown={ totalParams:countTotalParameters(), selectedParams:0, sumLevels:0, byLevel:{1:0,2:0,3:0,4:0,5:0} };
            for(const [subCode,info] of Object.entries(SUBUNSUR_DATA||{})) for(const prm of (Array.isArray(info?.params)?info.params:[])){ const jsonLevel = latest?.[subCode]?.[prm.id]?.level;
                const hasJsonLevel = jsonLevel !== undefined && jsonLevel !== null && jsonLevel !== '';
                const lv = hasJsonLevel ? Math.max(0,Math.min(5,Number(jsonLevel)||0)) : (lm.get(`${subCode}|${prm.id}`) ?? 0); if(lv>0){latestBreakdown.selectedParams++;latestBreakdown.sumLevels+=lv;latestBreakdown.byLevel[lv]++;} }
            latestBreakdown.value=Math.round((latestBreakdown.sumLevels/latestBreakdown.totalParams)*100)/100;
            const latestStatus=(countParameterEvidence(latest)===countTotalParameters()?'Selesai':(countParameterEvidence(latest)>0?'Proses':'Belum'));
            authoritativeSubunsurs=latest; breakdown=latestBreakdown; currentSa=latestBreakdown.value; currentStatus=latestStatus;
          }
          notifyRealtime(env, ctx, year, { action: 'saveSubunsur', opdId: params.opdId });
          return jsonResponse({
            status:'success',
            message:'Perubahan subunsur tersimpan',
            subunsurs:authoritativeSubunsurs,
            nilaiStrukturProses:Number(currentSa)||0,
            strukturProsesStatus:currentStatus,
            structureProcessBreakdown:breakdown
          });
        }

        // Backward-compatible fallback for older clients.
        const subunsurs=params.subunsurs||{};
        const sa=calculateSAFromSubunsur(subunsurs);
        const strukturStatus=countParameterEvidence(subunsurs)===countTotalParameters()?'Selesai':(countParameterEvidence(subunsurs)>0?'Proses':'Belum');
        await runD1WithRetry(() => env.DB.prepare("UPDATE opd_data SET subunsurs=?, sa=?, nilai_struktur_proses=?, struktur_proses_status=? WHERE id=? AND year=?").bind(JSON.stringify(subunsurs),sa,sa,strukturStatus,params.opdId,year));
        notifyRealtime(env, ctx, year, { action: 'saveSubunsur', opdId: params.opdId });
        return jsonResponse({status:'success',message:'Subunsur tersimpan',nilaiStrukturProses:sa,strukturProsesStatus:strukturStatus});
      }

      case 'saveField': {
        const { opdId, field, value } = params;
        if (field === 'nilaiStrukturProses') throw new Error('Nilai Struktur dan Proses dihitung otomatis dari 43 parameter.');
        const dbField=FIELD_MAP[field];if(!dbField)throw new Error('Field tidak diizinkan: '+field);const cleanValue=['nilaiMaturitas','nilaiKapabilitasApip','mri','iepk'].includes(field)?Math.max(0,Math.min(5,Number(value)||0)):(field==='opd'?sanitizeString(value):String(value||''));await env.DB.prepare(`UPDATE opd_data SET ${dbField} = ? WHERE id = ? AND year = ?`).bind(cleanValue,opdId,year).run();
        notifyRealtime(env, ctx, year, { action: 'saveField', opdId });
        return new Response(JSON.stringify({ status: 'success', message: 'Field tersimpan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'getKkPmData': {
        const { results } = await env.DB.prepare("SELECT kk_pm_data, opd FROM opd_data WHERE id = ? AND year = ? LIMIT 1").bind(params.opdId, year).all();
        if (!results.length) return jsonResponse({ status: 'error', message: 'OPD tidak ditemukan' }, 404);
        let kkPmData = {};
        try { kkPmData = results[0].kk_pm_data ? JSON.parse(results[0].kk_pm_data) : {}; } catch { kkPmData = {}; }
        return jsonResponse({ status: 'success', kkPmData });
      }

      case 'saveKkPmData': {
        if (!params.opdId) throw new Error('ID OPD wajib diisi');
        let kkPmData = params.kkPmData || {};
        if (typeof kkPmData === 'string') { try { kkPmData = JSON.parse(kkPmData); } catch { throw new Error('Data KK PM tidak valid'); } }
        if (!kkPmData || typeof kkPmData !== 'object') kkPmData = {};
        // Hanya simpan sparse cell overrides agar database tetap ringan.
        const cells = kkPmData.cells && typeof kkPmData.cells === 'object' ? kkPmData.cells : {};
        const compact = { version: 1, cells };
        const serialized = JSON.stringify(compact);
        if (serialized.length > 900000) throw new Error('Perubahan Kertas Kerja PM terlalu besar. Simpan secara bertahap.');
        await env.DB.prepare("UPDATE opd_data SET kk_pm_data=? WHERE id=? AND year=?").bind(serialized, params.opdId, year).run();
        notifyRealtime(env, ctx, year, { action: 'saveKkPmData', opdId: params.opdId });
        return jsonResponse({ status: 'success', message: 'Kertas Kerja PM tersimpan', kkPmData: compact });
      }

      case 'getKkPmDataDetailed': {
        const opdId=String(params.opdId||'');
        if(!opdId) throw new Error('ID OPD wajib diisi');
        const q=await env.DB.prepare(`SELECT subunsur,param_id,grade,item_no,availability,identity_doc,validity,period_ok,substance,note,score,conclusion,examiner_name,updated_at
          FROM opd_kk_pm_items WHERE year=? AND opd_id=? ORDER BY subunsur,param_id,CASE grade WHEN 'E' THEN 1 WHEN 'D' THEN 2 WHEN 'C' THEN 3 WHEN 'B' THEN 4 WHEN 'A' THEN 5 ELSE 9 END,item_no`).bind(String(year),opdId).all();
        const items=(q.results||[]).map(x=>({subunsur:String(x.subunsur),paramId:String(x.param_id),grade:String(x.grade),itemNo:Number(x.item_no),availability:x.availability||'',identityDoc:x.identity_doc||'',validity:x.validity||'',periodOk:x.period_ok||'',substance:x.substance||'',note:x.note||'',score:x.score===null?null:Number(x.score),conclusion:x.conclusion||'',examinerName:x.examiner_name||'',updatedAt:Number(x.updated_at||0)}));
        return jsonResponse({status:'success',items});
      }

      case 'saveKkPmItem': {
        const opdId=String(params.opdId||'');
        const subunsur=String(params.subunsur||'');
        const paramId=String(params.paramId||'');
        const grade=String(params.grade||'').toUpperCase();
        const itemNo=Number(params.itemNo);
        if(!opdId || !validQaItemLocation(subunsur,paramId,grade,itemNo)) throw new Error('Identitas item KK PM SPIP tidak valid.');
        const availability=sanitizeQaText(params.availability,30);
        const identityDoc=sanitizeQaText(params.identityDoc,500);
        const validity=sanitizeQaText(params.validity,10);
        const periodOk=sanitizeQaText(params.periodOk,10);
        const substance=sanitizeQaText(params.substance,30);
        const note=sanitizeQaText(params.note,1000);
        const examinerName=sanitizeQaText(params.examinerName,100);
        const score=calculateQaApipScore({availability,validity,periodOk,substance});
        const conclusion=calculateQaApipConclusion({availability,score});
        const now=Date.now();
        const isEmpty=!availability&&!identityDoc&&!validity&&!periodOk&&!substance&&!note&&!examinerName;
        if(isEmpty){
          await env.DB.prepare("DELETE FROM opd_kk_pm_items WHERE year=? AND opd_id=? AND subunsur=? AND param_id=? AND grade=? AND item_no=?").bind(String(year),opdId,subunsur,paramId,grade,itemNo).run();
        }else{
          await env.DB.prepare(`INSERT INTO opd_kk_pm_items(year,opd_id,subunsur,param_id,grade,item_no,availability,identity_doc,validity,period_ok,substance,note,score,conclusion,examiner_name,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(year,opd_id,subunsur,param_id,grade,item_no) DO UPDATE SET
              availability=excluded.availability, identity_doc=excluded.identity_doc, validity=excluded.validity,
              period_ok=excluded.period_ok, substance=excluded.substance, note=excluded.note,
              score=excluded.score, conclusion=excluded.conclusion, examiner_name=excluded.examiner_name, updated_at=excluded.updated_at`).bind(
              String(year),opdId,subunsur,paramId,grade,itemNo,availability,identityDoc,validity,periodOk,substance,note,score,conclusion,examinerName,now
            ).run();
        }
        const q=await env.DB.prepare(`SELECT SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) AS evaluated_items,
              SUM(CASE WHEN availability='N/A' THEN 1 ELSE 0 END) AS na_items,
              COALESCE(SUM(CASE WHEN score IS NOT NULL THEN score ELSE 0 END),0) AS sum_score
          FROM opd_kk_pm_items WHERE year=? AND opd_id=?`).bind(String(year),opdId).all();
        const qr=q.results?.[0]||{}; const evaluated=Number(qr.evaluated_items||0); const na=Number(qr.na_items||0); const sum=Number(qr.sum_score||0); const total=671;
        const pending=Math.max(0,total-evaluated-na); const applicable=Math.max(0,total-na);
        const percentage=applicable?Math.round((sum/applicable)*10000)/100:0; const completion=Math.round(((evaluated+na)/total)*10000)/100;
        const pmStatus=completion>=100?'Selesai':(completion>0?'Proses':'Belum');
        notifyRealtime(env,ctx,year,{action:'saveKkPmItem',opdId,subunsur,paramId,grade,itemNo,summary:{total,evaluated,na,pending,sum,percentage,completion,status:pmStatus}});
        return jsonResponse({status:'success',item:{subunsur,paramId,grade,itemNo,availability,identityDoc,validity,periodOk,substance,note,score,conclusion,examinerName,updatedAt:now},summary:{total,evaluated,na,pending,sum,percentage,completion,status:pmStatus}});
      }

      case 'deleteKkPmItem': {
        const opdId=String(params.opdId||''); const subunsur=String(params.subunsur||''); const paramId=String(params.paramId||''); const grade=String(params.grade||'').toUpperCase(); const itemNo=Number(params.itemNo);
        if(!opdId || !validQaItemLocation(subunsur,paramId,grade,itemNo)) throw new Error('Identitas item KK PM SPIP tidak valid.');
        await env.DB.prepare("DELETE FROM opd_kk_pm_items WHERE year=? AND opd_id=? AND subunsur=? AND param_id=? AND grade=? AND item_no=?").bind(String(year),opdId,subunsur,paramId,grade,itemNo).run();
        const q=await env.DB.prepare(`SELECT SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) AS evaluated_items,SUM(CASE WHEN availability='N/A' THEN 1 ELSE 0 END) AS na_items,COALESCE(SUM(CASE WHEN score IS NOT NULL THEN score ELSE 0 END),0) AS sum_score FROM opd_kk_pm_items WHERE year=? AND opd_id=?`).bind(String(year),opdId).all();
        const qr=q.results?.[0]||{}; const evaluated=Number(qr.evaluated_items||0); const na=Number(qr.na_items||0); const sum=Number(qr.sum_score||0); const total=671; const pending=Math.max(0,total-evaluated-na); const applicable=Math.max(0,total-na); const percentage=applicable?Math.round((sum/applicable)*10000)/100:0; const completion=Math.round(((evaluated+na)/total)*10000)/100; const pmStatus=completion>=100?'Selesai':(completion>0?'Proses':'Belum'); const summary={total,evaluated,na,pending,sum,percentage,completion,status:pmStatus};
        notifyRealtime(env,ctx,year,{action:'deleteKkPmItem',opdId,subunsur,paramId,grade,itemNo,summary});
        return jsonResponse({status:'success',message:'Item KK PM SPIP dikosongkan',summary});
      }

      case 'getKkSheets': {
        const { results } = await env.DB.prepare("SELECT kk_data, opd FROM opd_data WHERE id = ? AND year = ? LIMIT 1").bind(params.opdId, year).all();
        if (!results.length) return new Response(JSON.stringify({ status: 'error', message: 'OPD tidak ditemukan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        const kkData = normalizeKkData(results[0].kk_data);
        return new Response(JSON.stringify({ status: 'success', kkData }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'createKkSheets': {
        const { results } = await env.DB.prepare("SELECT kk_data, opd FROM opd_data WHERE id = ? AND year = ? LIMIT 1").bind(params.opdId, year).all();
        if (!results.length) return new Response(JSON.stringify({ status: 'error', message: 'OPD tidak ditemukan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        const currentKkData = normalizeKkData(results[0].kk_data);
        const kkData = await ensureKkSpreadsheet(env, { ...params, opd: params.opd || results[0].opd, currentKkData });
        await env.DB.prepare("UPDATE opd_data SET kk_data = ? WHERE id = ? AND year = ?").bind(JSON.stringify(kkData), params.opdId, year).run();
        notifyRealtime(env, ctx, year, { action: 'createKkSheets', opdId: params.opdId });
        return new Response(JSON.stringify({ status: 'success', message: 'Google Spreadsheet Kertas Kerja OPD berhasil dibuat/disinkronkan', kkData, spreadsheet: { id: kkData.workbookSpreadsheetId, url: kkData.workbookUrl, name: kkData.workbookName } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'saveKkData': {
        const { opdId, kkData } = params;
        const yearValue = params.year || year;
        const normalized = normalizeKkData(kkData);
        await env.DB.prepare("UPDATE opd_data SET kk_data = ? WHERE id = ? AND year = ?")
          .bind(JSON.stringify(normalized), opdId, yearValue)
          .run();
        notifyRealtime(env, ctx, yearValue, { action: 'saveKkData', opdId });
        return new Response(JSON.stringify({ status: 'success', message: 'Link spreadsheet tersimpan', kkData: normalized }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'getRtpKkSheets': { const {results}=await env.DB.prepare("SELECT kk_rtp_data FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();if(!results.length)throw new Error('OPD tidak ditemukan');return new Response(JSON.stringify({status:'success',kkRtpData:normalizeWorkbookData(results[0].kk_rtp_data,[])}),{status:200,headers:{'Content-Type':'application/json'}}); }
      case 'createRtpKkSheets': { const {results}=await env.DB.prepare("SELECT kk_rtp_data,opd FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();if(!results.length)throw new Error('OPD tidak ditemukan');const cur=normalizeWorkbookData(results[0].kk_rtp_data,[]);const kkRtpData=await ensureRtpSpreadsheet(env,{...params,opd:params.opd||results[0].opd,currentKkRtpData:cur});await env.DB.prepare("UPDATE opd_data SET kk_rtp_data=? WHERE id=? AND year=?").bind(JSON.stringify(kkRtpData),params.opdId,year).run();notifyRealtime(env,ctx,year,{action:'createRtpKkSheets',opdId:params.opdId});return new Response(JSON.stringify({status:'success',kkRtpData}),{status:200,headers:{'Content-Type':'application/json'}}); }
      case 'saveRtpKkData': { const kkRtpData=normalizeWorkbookData(params.kkRtpData,[]);await env.DB.prepare("UPDATE opd_data SET kk_rtp_data=? WHERE id=? AND year=?").bind(JSON.stringify(kkRtpData),params.opdId,year).run();notifyRealtime(env,ctx,year,{action:'saveRtpKkData',opdId:params.opdId});return new Response(JSON.stringify({status:'success',kkRtpData}),{status:200,headers:{'Content-Type':'application/json'}}); }
      case 'getRtpEvidence': {
        const {results}=await env.DB.prepare("SELECT rtp_evidence, rtp_evidence_folder, rtp_evidence_folder_id, opd FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
        if(!results.length)throw new Error('OPD tidak ditemukan');
        let list=[];try{list=results[0].rtp_evidence?JSON.parse(results[0].rtp_evidence):[]}catch{}
        const folder=safeDriveName(results[0].rtp_evidence_folder||'Evidence RTP','Evidence RTP');
        let folderId=results[0].rtp_evidence_folder_id||null;

        // Self-healing: bila folder pernah dihapus manual dari Google Drive,
        // buka modal kembali -> cek ID lama -> buat/temukan folder aktif -> simpan ID baru.
        try{
          const accessToken=await getGoogleAccessToken(env);
          if(folderId){
            const oldFolder=await getDriveFile(accessToken,folderId);
            const valid=oldFolder && !oldFolder.trashed && oldFolder.mimeType==='application/vnd.google-apps.folder';
            if(!valid) folderId=null;
          }
          if(!folderId){
            const driveFolder=await getRtpDriveFolder(env,accessToken,year,results[0].opd||'OPD',folder);
            folderId=driveFolder.evidenceFolder;
            await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET rtp_evidence_folder=?, rtp_evidence_folder_id=? WHERE id=? AND year=?").bind(folder,folderId,params.opdId,year));
          }
        }catch(err){
          // Jangan menggagalkan tampilan evidence/R2 bila Drive sementara bermasalah.
          // Modal tetap bisa dibuka; upload berikutnya akan melakukan self-healing lagi.
          console.warn('Validasi folder Evidence RTP ditunda:',err?.message||err);
        }
        return new Response(JSON.stringify({status:'success',rtpEvidence:list,folderName:folder,folderId,folderUrl:folderId?`https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`:null}),{status:200,headers:{'Content-Type':'application/json'}});
      }
      case 'saveRtpEvidenceFolder': {
        const folderName=safeDriveName(params.folderName||'Evidence RTP','Evidence RTP').substring(0,100)||'Evidence RTP';
        const rec=await env.DB.prepare("SELECT opd FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
        if(!rec.results.length) throw new Error('OPD tidak ditemukan');
        const accessToken=await getGoogleAccessToken(env);
        const driveFolder=await getRtpDriveFolder(env,accessToken,year,rec.results[0].opd,folderName);
        const folderUrl=`https://drive.google.com/drive/folders/${encodeURIComponent(driveFolder.evidenceFolder)}`;
        await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET rtp_evidence_folder=?, rtp_evidence_folder_id=? WHERE id=? AND year=?").bind(folderName,driveFolder.evidenceFolder,params.opdId,year));
        notifyRealtime(env, ctx, year, { action: 'saveRtpEvidenceFolder', opdId: params.opdId });
        const safeOpd=sanitizeString(rec.results[0].opd||'OPD').substring(0,80)||'OPD';
        const r2Prefix=`kawal_spip/${year}/${safeOpd}/Kertas Kerja RTP/${folderName}/`;
        return new Response(JSON.stringify({status:'success',folderName,gdriveFolderId:driveFolder.evidenceFolder,folderUrl,r2Prefix,driveConfigured:true}),{status:200,headers:{'Content-Type':'application/json'}});
      }
      case 'uploadRtpEvidence': {
        assertGoogleDriveConfigured(env);
        const file=params.file;
        const legacyData=params.fileData;
        if(!file && !legacyData && !request.body)throw new Error('File tidak diterima');
        let bytes=null;
        let fileBody=null;
        let safeFileName=sanitizeString(params.fileName||'evidence').substring(0,150)||'evidence';
        const fileType=params.fileType||'application/octet-stream';
        const fileSize=Number(params.fileSize)||0;
        if(file){
          safeFileName=sanitizeString(file.name||safeFileName).substring(0,150)||'evidence';
          if((file.size||0)>10*1024*1024)throw new Error('File melebihi 10 MB');
          bytes=new Uint8Array(await file.arrayBuffer());
        }else if(legacyData){
          bytes=decodeBase64File(legacyData,10);
        }else{
          if(fileSize>10*1024*1024)throw new Error('File melebihi 10 MB');
          fileBody=request.body;
        }
        const safeOpd=sanitizeString(params.opdName).substring(0,80)||'OPD';
        const folderName=safeDriveName(params.folderName||'Evidence RTP','Evidence RTP').substring(0,100)||'Evidence RTP';
        const accessToken=await getGoogleAccessToken(env);
        const driveFolder=await getRtpDriveFolder(env,accessToken,year,safeOpd,folderName);
        const gdriveFolderId=driveFolder.evidenceFolder;
        const baseFilePath=`kawal_spip/${year}/${safeOpd}/Kertas Kerja RTP/${folderName}/${safeFileName}`;
        const uploadId=String(params.uploadId||crypto.randomUUID());
        const filePath=baseFilePath.replace(/([^/]+)$/,(m)=>`${uploadId}-${m}`);
        const existingRec=await env.DB.prepare("SELECT rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
        if(existingRec.results?.length){
          let existingList=[];try{existingList=existingRec.results[0]?.rtp_evidence?JSON.parse(existingRec.results[0].rtp_evidence):[]}catch{}
          const existing=existingList.find(x=>x&&x.uploadId===uploadId);
          if(existing?.gdriveId){
            return jsonResponse({status:'success',url:existing.url||`https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${existing.r2Key||filePath}`,fileName:existing.fileName||safeFileName,folderName:existing.folderName||folderName,gdriveId:existing.gdriveId,rtpEvidence:existingList,syncStatus:'done',uploadId,backupQueued:false});
          }
          if(existing?.r2Key) {
            try{
              const folderRec=await env.DB.prepare("SELECT rtp_evidence_folder_id FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
              const existingJob={type:'rtp',uploadId,year,opdId:params.opdId,opdName:params.opdName||'OPD',r2Key:existing.r2Key,fileName:existing.fileName||safeFileName,fileType:existing.fileType||fileType,folderName:existing.folderName||folderName,gdriveFolderId:folderRec.results?.[0]?.rtp_evidence_folder_id||null};
              const existingGdriveId=await directGoogleDriveBackup(env,existingJob);
              await updateRtpFileStatus(env,existingJob,{gdriveId:existingGdriveId,storage:'R2 + Google Drive',syncStatus:'done',syncError:null});
              const latestExisting=await env.DB.prepare("SELECT rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
              let latestExistingList=[];try{latestExistingList=latestExisting.results[0]?.rtp_evidence?JSON.parse(latestExisting.results[0].rtp_evidence):[]}catch{}
              return jsonResponse({status:'success',url:existing.url||`https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${existing.r2Key}`,fileName:existing.fileName||safeFileName,folderName:existing.folderName||folderName,gdriveId:existingGdriveId,rtpEvidence:latestExistingList,syncStatus:'done',uploadId,backupQueued:false});
            }catch(retryExistingErr){
              await updateRtpFileStatus(env, {type:'rtp',uploadId,year,opdId:params.opdId}, {syncStatus:'retrying',syncError:String(retryExistingErr.message||retryExistingErr)});
              return jsonResponse({status:'pending',url:existing.url||`https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${existing.r2Key}`,fileName:existing.fileName||safeFileName,folderName:existing.folderName||folderName,gdriveId:null,rtpEvidence:existingList,syncStatus:'retrying',uploadId,backupQueued:false,driveError:String(retryExistingErr.message||retryExistingErr),r2Saved:true,r2Key:existing.r2Key});
            }
          }
        }
        await env.EVIDENCE_BUCKET.put(filePath,fileBody||bytes,{httpMetadata:{contentType:fileType}});
        const publicUrl=`https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${filePath}`;
        const item={url:publicUrl,fileName:safeFileName,folderName,gdriveId:null,storage:'R2',syncStatus:'pending',uploadedAt:new Date().toISOString(),uploadId,r2Key:filePath,fileType};
        const {results}=await env.DB.prepare("SELECT rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
        if(!results.length)throw new Error('OPD tidak ditemukan');
        let list=[];try{list=results[0].rtp_evidence?JSON.parse(results[0].rtp_evidence):[]}catch{}
        list.push(item);
        await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET rtp_evidence=?, rtp_evidence_folder=?, rtp_evidence_folder_id=? WHERE id=? AND year=?").bind(JSON.stringify(list),folderName,gdriveFolderId,params.opdId,year));

        const job={type:'rtp',uploadId,year,opdId:params.opdId,opdName:params.opdName||'OPD',r2Key:filePath,fileName:safeFileName,fileType,folderName,gdriveFolderId};
        notifyRealtime(env, ctx, year, { action: 'uploadRtpEvidence', opdId: params.opdId, uploadId });
        // MANDATORY GOOGLE DRIVE: RTP upload is successful only after Drive returns an ID.
        try {
          const gdriveId=await directGoogleDriveBackup(env,job);
          await updateRtpFileStatus(env,job,{gdriveId,storage:'R2 + Google Drive',syncStatus:'done',syncError:null});
          notifyRealtime(env, ctx, year, { action: 'uploadRtpEvidence', opdId: params.opdId, uploadId, storage: 'R2 + Google Drive' });
          const latest=await env.DB.prepare("SELECT rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
          let latestList=[];try{latestList=latest.results[0]?.rtp_evidence?JSON.parse(latest.results[0].rtp_evidence):[]}catch{}
          return jsonResponse({status:'success',url:publicUrl,fileName:safeFileName,folderName,gdriveId,gdriveFolderId,folderUrl:`https://drive.google.com/drive/folders/${encodeURIComponent(gdriveFolderId)}`,rtpEvidence:latestList,syncStatus:'done',uploadId,backupQueued:false,r2Saved:true,r2Key:filePath});
        } catch (driveErr) {
          const message=String(driveErr?.message||driveErr);
          await updateRtpFileStatus(env,job,{syncStatus:'retrying',syncError:message,storage:'R2'});
          notifyRealtime(env, ctx, year, { action: 'uploadRtpEvidence', opdId: params.opdId, uploadId, storage: 'R2', syncStatus: 'retrying' });
          return jsonResponse({status:'pending',message:'File RTP sudah diamankan di R2 tetapi BELUM masuk Google Drive. Sistem akan mencoba lagi otomatis.',url:publicUrl,fileName:safeFileName,folderName,gdriveId:null,syncStatus:'retrying',uploadId,backupQueued:false,r2Saved:true,r2Key:filePath,driveError:message});
        }
      }
      case 'getReportFiles': {
        const cfg=reportFieldConfig(params.reportType);
        const {results}=await env.DB.prepare(`SELECT ${cfg.listField}, ${cfg.folderField}, ${cfg.folderIdField}, opd FROM opd_data WHERE id=? AND year=? LIMIT 1`).bind(params.opdId,year).all();
        if(!results.length)throw new Error('OPD tidak ditemukan');
        const list=parseJsonArray(results[0]?.[cfg.listField]);
        let folderId=results[0]?.[cfg.folderIdField]||null;
        try{
          const accessToken=await getGoogleAccessToken(env);
          if(folderId){
            const f=await getDriveFile(accessToken,folderId);
            const valid=f && !f.trashed && f.mimeType==='application/vnd.google-apps.folder';
            if(!valid) folderId=null;
          }
          if(!folderId){
            const driveFolder=await getReportDriveFolder(env,accessToken,year,results[0].opd||'OPD',cfg.type);
            folderId=driveFolder.reportFolder;
            await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_data SET ${cfg.folderField}=?, ${cfg.folderIdField}=? WHERE id=? AND year=?`).bind(cfg.folderName,folderId,params.opdId,year));
          }
        }catch(err){ console.warn(`Validasi folder ${cfg.folderName} ditunda:`,err?.message||err); }
        return jsonResponse({status:'success',reportType:cfg.type,reports:list,folderName:cfg.folderName,folderId,folderUrl:folderId?`https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`:null});
      }
      case 'uploadReportFile': {
        const cfg=reportFieldConfig(params.reportType);
        assertGoogleDriveConfigured(env);
        const file=params.file;
        const legacyData=params.fileData;
        if(!file && !legacyData && !request.body)throw new Error('File tidak diterima');
        let bytes=null; let fileBody=null;
        let safeFileName=sanitizeString(params.fileName||'laporan').substring(0,150)||'laporan';
        const fileType=params.fileType||'application/octet-stream';
        const fileSize=Number(params.fileSize)||0;
        if(file){
          safeFileName=sanitizeString(file.name||safeFileName).substring(0,150)||'laporan';
          if((file.size||0)>10*1024*1024)throw new Error('File melebihi 10 MB');
          bytes=new Uint8Array(await file.arrayBuffer());
        }else if(legacyData){
          bytes=decodeBase64File(legacyData,10);
        }else{
          if(fileSize>10*1024*1024)throw new Error('File melebihi 10 MB');
          fileBody=request.body;
        }
        const safeOpd=sanitizeString(params.opdName||'OPD').substring(0,80)||'OPD';
        const accessToken=await getGoogleAccessToken(env);
        const driveFolder=await getReportDriveFolder(env,accessToken,year,safeOpd,cfg.type);
        const gdriveFolderId=driveFolder.reportFolder;
        const uploadId=String(params.uploadId||crypto.randomUUID());
        const filePath=`kawal_spip/${year}/${safeOpd}/${cfg.folderName}/${uploadId}-${safeFileName}`;
        const rec=await env.DB.prepare(`SELECT ${cfg.listField} FROM opd_data WHERE id=? AND year=? LIMIT 1`).bind(params.opdId,year).all();
        if(!rec.results.length)throw new Error('OPD tidak ditemukan');
        const list=parseJsonArray(rec.results[0]?.[cfg.listField]);
        const existing=list.find(x=>x&&x.uploadId===uploadId);
        if(existing?.gdriveId){
          return jsonResponse({status:'success',reportType:cfg.type,url:existing.url||`https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${existing.r2Key||filePath}`,fileName:existing.fileName||safeFileName,gdriveId:existing.gdriveId,reports:list,syncStatus:'done',uploadId,folderName:cfg.folderName,folderId:gdriveFolderId,folderUrl:`https://drive.google.com/drive/folders/${encodeURIComponent(gdriveFolderId)}`});
        }
        if(existing?.r2Key){
          try{
            const job={type:'report',reportType:cfg.type,uploadId,year,opdId:params.opdId,opdName:safeOpd,r2Key:existing.r2Key,fileName:existing.fileName||safeFileName,fileType:existing.fileType||fileType,gdriveFolderId:existing.gdriveFolderId||gdriveFolderId};
            const existingGdriveId=await directGoogleDriveBackup(env,job);
            await updateReportFileStatus(env,job,{gdriveId:existingGdriveId,storage:'R2 + Google Drive',syncStatus:'done',syncError:null});
            const latest=await env.DB.prepare(`SELECT ${cfg.listField} FROM opd_data WHERE id=? AND year=? LIMIT 1`).bind(params.opdId,year).all();
            return jsonResponse({status:'success',reportType:cfg.type,url:existing.url,fileName:existing.fileName||safeFileName,gdriveId:existingGdriveId,reports:parseJsonArray(latest.results[0]?.[cfg.listField]),syncStatus:'done',uploadId,folderName:cfg.folderName,folderId:gdriveFolderId,folderUrl:`https://drive.google.com/drive/folders/${encodeURIComponent(gdriveFolderId)}`});
          }catch(err){
            await updateReportFileStatus(env,{type:'report',reportType:cfg.type,uploadId,year,opdId:params.opdId},{syncStatus:'retrying',syncError:String(err.message||err)});
            return jsonResponse({status:'pending',reportType:cfg.type,url:existing.url,fileName:existing.fileName||safeFileName,gdriveId:null,reports:list,syncStatus:'retrying',uploadId,folderName:cfg.folderName,folderId:gdriveFolderId,driveError:String(err.message||err),r2Saved:true,r2Key:existing.r2Key});
          }
        }
        await env.EVIDENCE_BUCKET.put(filePath,fileBody||bytes,{httpMetadata:{contentType:fileType}});
        const publicUrl=`https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${filePath}`;
        const item={url:publicUrl,fileName:safeFileName,folderName:cfg.folderName,gdriveFolderId,gdriveId:null,storage:'R2',syncStatus:'pending',uploadedAt:new Date().toISOString(),uploadId,r2Key:filePath,fileType};
        list.push(item);
        await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_data SET ${cfg.listField}=?, ${cfg.folderField}=?, ${cfg.folderIdField}=? WHERE id=? AND year=?`).bind(JSON.stringify(list),cfg.folderName,gdriveFolderId,params.opdId,year));
        const job={type:'report',reportType:cfg.type,uploadId,year,opdId:params.opdId,opdName:safeOpd,r2Key:filePath,fileName:safeFileName,fileType,gdriveFolderId};
        notifyRealtime(env,ctx,year,{action:'uploadReportFile',reportType:cfg.type,opdId:params.opdId,uploadId});
        try{
          const gdriveId=await directGoogleDriveBackup(env,job);
          await updateReportFileStatus(env,job,{gdriveId,storage:'R2 + Google Drive',syncStatus:'done',syncError:null});
          const latest=await env.DB.prepare(`SELECT ${cfg.listField} FROM opd_data WHERE id=? AND year=? LIMIT 1`).bind(params.opdId,year).all();
          const latestList=parseJsonArray(latest.results[0]?.[cfg.listField]);
          notifyRealtime(env,ctx,year,{action:'uploadReportFile',reportType:cfg.type,opdId:params.opdId,uploadId,storage:'R2 + Google Drive'});
          return jsonResponse({status:'success',reportType:cfg.type,url:publicUrl,fileName:safeFileName,gdriveId,reports:latestList,syncStatus:'done',uploadId,folderName:cfg.folderName,folderId:gdriveFolderId,folderUrl:`https://drive.google.com/drive/folders/${encodeURIComponent(gdriveFolderId)}`,r2Saved:true,r2Key:filePath});
        }catch(err){
          const message=String(err?.message||err);
          await updateReportFileStatus(env,job,{syncStatus:'retrying',syncError:message});
          return jsonResponse({status:'pending',reportType:cfg.type,message:'File laporan sudah diamankan di R2 tetapi BELUM masuk Google Drive. Sistem akan mencoba lagi otomatis.',url:publicUrl,fileName:safeFileName,gdriveId:null,reports:list,syncStatus:'retrying',uploadId,folderName:cfg.folderName,folderId:gdriveFolderId,r2Saved:true,r2Key:filePath,driveError:message});
        }
      }
      case 'deleteReportFile': {
        const cfg=reportFieldConfig(params.reportType);
        const cleanUrl=String(params.fileUrl||'').split('?')[0],marker='r2.dev/',idx=cleanUrl.indexOf(marker);
        const r2Key=idx!==-1?decodeURIComponent(cleanUrl.substring(idx+marker.length)):'';
        if(params.gdriveId){ try{await deleteGoogleDriveFile(env,params.gdriveId)}catch(err){return jsonResponse({status:'error',message:'Gagal hapus di Google Drive. Salinan R2 TETAP dipertahankan: '+err.message});} }
        if(r2Key)await env.EVIDENCE_BUCKET.delete(r2Key);
        const rec=await env.DB.prepare(`SELECT ${cfg.listField} FROM opd_data WHERE id=? AND year=? LIMIT 1`).bind(params.opdId,year).all();
        if(!rec.results.length)throw new Error('OPD tidak ditemukan');
        const list=parseJsonArray(rec.results[0]?.[cfg.listField]).filter(x=>x?.url!==params.fileUrl);
        await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_data SET ${cfg.listField}=? WHERE id=? AND year=?`).bind(JSON.stringify(list),params.opdId,year));
        notifyRealtime(env,ctx,year,{action:'deleteReportFile',reportType:cfg.type,opdId:params.opdId});
        return jsonResponse({status:'success',reportType:cfg.type,reports:list});
      }

      case 'deleteRtpEvidence': {
        const cleanUrl=String(params.fileUrl||'').split('?')[0],marker='r2.dev/',idx=cleanUrl.indexOf(marker);
        const r2Key=idx!==-1?decodeURIComponent(cleanUrl.substring(idx+marker.length)):'';
        // Deletion is intentionally ordered Drive -> R2. If Drive deletion fails,
        // keep R2 so the permanent backup is not lost accidentally.
        if(params.gdriveId){
          try{await deleteGoogleDriveFile(env,params.gdriveId)}
          catch(err){return new Response(JSON.stringify({status:'error',message:'Gagal hapus di Google Drive. Salinan R2 TETAP dipertahankan: '+err.message}),{status:200,headers:{'Content-Type':'application/json'}})}
        }
        if(r2Key) await env.EVIDENCE_BUCKET.delete(r2Key);
        const {results}=await env.DB.prepare("SELECT rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
        if(!results.length)throw new Error('OPD tidak ditemukan');
        let list=[];try{list=results[0].rtp_evidence?JSON.parse(results[0].rtp_evidence):[]}catch{}
        list=list.filter(x=>x.url!==params.fileUrl);
        await env.DB.prepare("UPDATE opd_data SET rtp_evidence=? WHERE id=? AND year=?").bind(JSON.stringify(list),params.opdId,year).run();
        notifyRealtime(env, ctx, year, { action: 'deleteRtpEvidence', opdId: params.opdId });
        return new Response(JSON.stringify({status:'success',rtpEvidence:list}),{status:200,headers:{'Content-Type':'application/json'}});
      }
      case 'getQaApipData': {
        const opdId=String(params.opdId||'');
        if(!opdId) throw new Error('ID OPD wajib diisi.');
        const {results}=await env.DB.prepare(`SELECT subunsur,param_id,grade,item_no,availability,identity_doc,validity,period_ok,substance,note,score,conclusion,examiner_name,updated_at
          FROM opd_qa_apip_items WHERE year=? AND opd_id=? ORDER BY subunsur,param_id,CASE grade WHEN 'E' THEN 1 WHEN 'D' THEN 2 WHEN 'C' THEN 3 WHEN 'B' THEN 4 WHEN 'A' THEN 5 ELSE 9 END,item_no`).bind(String(year),opdId).all();
        const items=(results||[]).map(x=>({subunsur:String(x.subunsur),paramId:String(x.param_id),grade:String(x.grade),itemNo:Number(x.item_no),availability:x.availability||'',identityDoc:x.identity_doc||'',validity:x.validity||'',periodOk:x.period_ok||'',substance:x.substance||'',note:x.note||'',score:x.score===null?null:Number(x.score),conclusion:x.conclusion||'',examinerName:x.examiner_name||'',updatedAt:Number(x.updated_at||0)}));
        return jsonResponse({status:'success',items});
      }

      case 'saveQaApipItem': {
        const opdId=String(params.opdId||'');
        const subunsur=String(params.subunsur||'');
        const paramId=String(params.paramId||'');
        const grade=String(params.grade||'').toUpperCase();
        const itemNo=Number(params.itemNo);
        if(!opdId || !validQaItemLocation(subunsur,paramId,grade,itemNo)) throw new Error('Identitas item QA APIP tidak valid.');
        const availability=sanitizeQaText(params.availability,30);
        const identityDoc=sanitizeQaText(params.identityDoc,500);
        const validity=sanitizeQaText(params.validity,10);
        const periodOk=sanitizeQaText(params.periodOk,10);
        const substance=sanitizeQaText(params.substance,30);
        const note=sanitizeQaText(params.note,1000);
        const examinerName=sanitizeQaText(params.examinerName,100);
        const score=calculateQaApipScore({availability,validity,periodOk,substance});
        const conclusion=calculateQaApipConclusion({availability,score});
        const now=Date.now();
        const isEmpty=!availability&&!identityDoc&&!validity&&!periodOk&&!substance&&!note&&!examinerName;
        if(isEmpty){
          await env.DB.prepare("DELETE FROM opd_qa_apip_items WHERE year=? AND opd_id=? AND subunsur=? AND param_id=? AND grade=? AND item_no=?").bind(String(year),opdId,subunsur,paramId,grade,itemNo).run();
        }else{
          await env.DB.prepare(`INSERT INTO opd_qa_apip_items(year,opd_id,subunsur,param_id,grade,item_no,availability,identity_doc,validity,period_ok,substance,note,score,conclusion,examiner_name,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(year,opd_id,subunsur,param_id,grade,item_no) DO UPDATE SET
              availability=excluded.availability, identity_doc=excluded.identity_doc, validity=excluded.validity,
              period_ok=excluded.period_ok, substance=excluded.substance, note=excluded.note,
              score=excluded.score, conclusion=excluded.conclusion, examiner_name=excluded.examiner_name, updated_at=excluded.updated_at`).bind(
              String(year),opdId,subunsur,paramId,grade,itemNo,availability,identityDoc,validity,periodOk,substance,note,score,conclusion,examinerName,now
            ).run();
        }
        const q=await env.DB.prepare(`SELECT COUNT(*) AS stored_items,
              SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) AS evaluated_items,
              SUM(CASE WHEN availability='N/A' THEN 1 ELSE 0 END) AS na_items,
              COALESCE(SUM(CASE WHEN score IS NOT NULL THEN score ELSE 0 END),0) AS sum_score
          FROM opd_qa_apip_items WHERE year=? AND opd_id=?`).bind(String(year),opdId).all();
        const qr=q.results?.[0]||{}; const evaluated=Number(qr.evaluated_items||0); const na=Number(qr.na_items||0); const sum=Number(qr.sum_score||0); const total=671;
        const pending=Math.max(0,total-evaluated-na);
        const applicable=Math.max(0,total-na);
        const percentage=applicable?Math.round((sum/applicable)*10000)/100:0;
        const completion=Math.round(((evaluated+na)/total)*10000)/100;
        const evRec=await env.DB.prepare("SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,String(year)).all();
        let evidenceFiles=0; try{evidenceFiles=countStructureEvidenceFiles(evRec.results?.[0]?.subunsurs?JSON.parse(evRec.results[0].subunsurs):{});}catch{}
        const qaStatus=completion>=100?'Selesai':(completion>0?'Proses':'Belum');
        await env.DB.prepare("UPDATE opd_data SET qa_apip=? WHERE id=? AND year=?").bind(qaStatus,opdId,year).run();
        notifyRealtime(env,ctx,year,{action:'saveQaApipItem',opdId,subunsur,paramId,grade,itemNo,summary:{total,evaluated,na,pending,sum,percentage,completion,evidenceFiles,status:qaStatus}});
        return jsonResponse({status:'success',item:{subunsur,paramId,grade,itemNo,availability,identityDoc,validity,periodOk,substance,note,score,conclusion,examinerName,updatedAt:now},summary:{total,evaluated,na,pending,sum,percentage,completion,evidenceFiles,status:qaStatus}});
      }

      case 'deleteQaApipItem': {
        const opdId=String(params.opdId||''); const subunsur=String(params.subunsur||''); const paramId=String(params.paramId||''); const grade=String(params.grade||'').toUpperCase(); const itemNo=Number(params.itemNo);
        if(!opdId || !validQaItemLocation(subunsur,paramId,grade,itemNo)) throw new Error('Identitas item QA APIP tidak valid.');
        await env.DB.prepare("DELETE FROM opd_qa_apip_items WHERE year=? AND opd_id=? AND subunsur=? AND param_id=? AND grade=? AND item_no=?").bind(String(year),opdId,subunsur,paramId,grade,itemNo).run();
        const q=await env.DB.prepare(`SELECT
              SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) AS evaluated_items,
              SUM(CASE WHEN availability='N/A' THEN 1 ELSE 0 END) AS na_items,
              COALESCE(SUM(CASE WHEN score IS NOT NULL THEN score ELSE 0 END),0) AS sum_score
          FROM opd_qa_apip_items WHERE year=? AND opd_id=?`).bind(String(year),opdId).all();
        const qr=q.results?.[0]||{}; const evaluated=Number(qr.evaluated_items||0); const na=Number(qr.na_items||0); const sum=Number(qr.sum_score||0); const total=671;
        const pending=Math.max(0,total-evaluated-na);
        const applicable=Math.max(0,total-na);
        const percentage=applicable?Math.round((sum/applicable)*10000)/100:0;
        const completion=Math.round(((evaluated+na)/total)*10000)/100;
        const evRec=await env.DB.prepare("SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,String(year)).all();
        let evidenceFiles=0; try{evidenceFiles=countStructureEvidenceFiles(evRec.results?.[0]?.subunsurs?JSON.parse(evRec.results[0].subunsurs):{});}catch{}
        const qaStatus=completion>=100?'Selesai':(completion>0?'Proses':'Belum');
        await env.DB.prepare("UPDATE opd_data SET qa_apip=? WHERE id=? AND year=?").bind(qaStatus,opdId,year).run();
        const summary={total,evaluated,na,pending,sum,percentage,completion,evidenceFiles,status:qaStatus};
        notifyRealtime(env,ctx,year,{action:'deleteQaApipItem',opdId,subunsur,paramId,grade,itemNo,summary});
        return jsonResponse({status:'success',summary});
      }

      case 'saveEvidenceVerification': {
        const opdId=String(params.opdId||'');
        const subunsur=String(params.subunsur||'');
        const paramId=String(params.paramId||'');
        const level=String(params.level||'');
        const uploadId=String(params.uploadId||'');
        const status=String(params.status||'');
        const examinerName=sanitizeVerificationField(params.examinerName,100);
        const note=sanitizeVerificationField(params.note,1000);
        if(!opdId || !subunsur || !paramId || !/^[1-5]$/.test(level) || !uploadId) throw new Error('Lokasi evidence tidak lengkap.');
        if(!VERIFICATION_STATUS_SET.has(status)) throw new Error('Hasil verifikasi tidak valid.');
        if(!examinerName) throw new Error('Nama pemeriksa wajib diisi.');
        if((status==='diterima_catatan' || status==='dikembalikan') && !note) throw new Error('Catatan pemeriksa wajib diisi untuk status ini.');
        const rec=await env.DB.prepare("SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,year).all();
        if(!rec.results.length) throw new Error('OPD tidak ditemukan.');
        let obj={}; try{obj=rec.results[0]?.subunsurs?JSON.parse(rec.results[0].subunsurs):{}}catch{}
        const arr=obj?.[subunsur]?.[paramId]?.['files'+level];
        if(!Array.isArray(arr)) throw new Error('Daftar file evidence tidak ditemukan.');
        const fileObj=arr.find(x=>x && typeof x==='object' && String(x.uploadId||'')===uploadId);
        if(!fileObj) throw new Error('File evidence tidak ditemukan pada OPD/parameter/level yang sama.');
        const now=new Date().toISOString();
        const verification={examinerName,note,status,verifiedAt:now,updatedAt:now};
        fileObj.verification=verification;
        if(fileObj.replacementStatus==='menunggu_verifikasi') fileObj.replacementStatus=null;
        await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET subunsurs=? WHERE id=? AND year=?").bind(JSON.stringify(obj),opdId,year));
        notifyRealtime(env,ctx,year,{action:'saveEvidenceVerification',opdId,subunsur,paramId,level,uploadId,status});
        return jsonResponse({status:'success',verification,summary:calculateVerificationSummaryServer(arr)});
      }

      case 'saveRtpEvidenceVerification': {
        const opdId=String(params.opdId||'');
        const uploadId=String(params.uploadId||'');
        const status=String(params.status||'');
        const examinerName=sanitizeVerificationField(params.examinerName,100);
        const note=sanitizeVerificationField(params.note,1000);
        if(!opdId || !uploadId) throw new Error('Identitas evidence RTP tidak lengkap.');
        if(!VERIFICATION_STATUS_SET.has(status)) throw new Error('Hasil verifikasi tidak valid.');
        if(!examinerName) throw new Error('Nama pemeriksa wajib diisi.');
        if((status==='diterima_catatan' || status==='dikembalikan') && !note) throw new Error('Catatan pemeriksa wajib diisi untuk status ini.');
        const rec=await env.DB.prepare("SELECT rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,year).all();
        if(!rec.results.length) throw new Error('OPD tidak ditemukan.');
        let list=[]; try{list=rec.results[0]?.rtp_evidence?JSON.parse(rec.results[0].rtp_evidence):[]}catch{}
        if(!Array.isArray(list)) list=[];
        const fileObj=list.find(x=>x && typeof x==='object' && String(x.uploadId||'')===uploadId);
        if(!fileObj) throw new Error('File Evidence RTP tidak ditemukan pada OPD yang sama.');
        const now=new Date().toISOString();
        const verification={examinerName,note,status,verifiedAt:now,updatedAt:now};
        fileObj.verification=verification;
        if(fileObj.replacementStatus==='menunggu_verifikasi') fileObj.replacementStatus=null;
        await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET rtp_evidence=? WHERE id=? AND year=?").bind(JSON.stringify(list),opdId,year));
        notifyRealtime(env,ctx,year,{action:'saveRtpEvidenceVerification',opdId,uploadId,status});
        return jsonResponse({status:'success',verification,summary:calculateVerificationSummaryServer(list)});
      }

      case 'deleteOpd': {
        if (params.opdId === 'all') await env.DB.prepare("DELETE FROM opd_data WHERE year = ?").bind(year).run();
        else await env.DB.prepare("DELETE FROM opd_data WHERE id = ?").bind(params.opdId).run();
        notifyRealtime(env, ctx, year, { action: 'deleteOpd', opdId: params.opdId });
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
        notifyRealtime(env, ctx, String(params.year), { action: 'addYear' });
        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'deleteYear': {
        await env.DB.prepare("DELETE FROM opd_data WHERE year = ?").bind(params.year).run();
        await env.DB.prepare("DELETE FROM years WHERE year = ?").bind(params.year).run();
        notifyRealtime(env, ctx, String(params.year), { action: 'deleteYear' });
        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'uploadFile': {
        assertGoogleDriveConfigured(env);
        const file=params.file;
        const legacyData=params.fileData;
        if(!file && !legacyData && !request.body) throw new Error('File tidak diterima');

        let bytes=null;
        let fileBody=null;
        let fileName=params.fileName||'evidence';
        let fileType=params.fileType||'application/octet-stream';
        let fileSize=Number(params.fileSize)||0;
        if(file){
          fileName=file.name||fileName;
          fileType=file.type||fileType;
          fileSize=file.size||0;
          if(fileSize>10*1024*1024) throw new Error('File > 10MB, terlalu besar!');
          bytes=await file.arrayBuffer();
        }else if(legacyData){
          bytes=decodeBase64File(legacyData,10);
          fileSize=bytes.byteLength;
        }else{
          if(fileSize>10*1024*1024) throw new Error('File > 10MB, terlalu besar!');
          fileBody=request.body;
        }

        const subCode=String(params.subunsur||'');
        const paramId=String(params.paramId||'');
        const level=String(params.level||'1');
        const opdId=String(params.opdId||'');
        const uploadId=String(params.uploadId||crypto.randomUUID());
        if(!opdId) throw new Error('OPD wajib diisi');
        const {filePath:baseFilePath}=getFolderStructure({
          fileData:legacyData||'',
          fileName,
          opdName:params.opdName,
          subunsur:subCode,
          paramId,
          level,
          fileType
        });
        const filePath=baseFilePath.replace(/([^/]+)$/,(m)=>`${uploadId}-${m}`);
        const publicUrl=`https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${filePath}`;

        // Strong idempotency + location binding:
        // one uploadId can belong to exactly one year/OPD/subunsur/parameter/level.
        const now=Date.now();
        // The dedicated registry is the source of truth for upload placement.
        const regCheck=await env.DB.prepare(
          "SELECT upload_id,year,opd_id,subunsur,param_id,level,type,r2_key,gdrive_id,sync_status FROM evidence_upload_registry WHERE upload_id=? LIMIT 1"
        ).bind(uploadId).all();

        if(regCheck.results?.length){
          const reg=regCheck.results[0];
          const sameLocation=String(reg.year)===String(year) &&
            String(reg.opd_id)===String(opdId) &&
            String(reg.subunsur||'')===String(subCode||'') &&
            String(reg.param_id||'')===String(paramId||'') &&
            String(reg.level||'')===String(level||'') &&
            String(reg.type||'evidence')==='evidence';
          if(!sameLocation){
            throw new Error('Upload ID sudah terikat ke OPD/kolom lain. Upload dibatalkan untuk mencegah salah penempatan data.');
          }
        }else{
          // UUID uploadId is unique. Do NOT use INSERT OR IGNORE here: a legacy
          // constraint must never silently discard a new identity.
          await env.DB.prepare(`INSERT INTO evidence_upload_registry
            (upload_id,year,opd_id,subunsur,param_id,level,type,sync_status,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`)
            .bind(uploadId,String(year),String(opdId),String(subCode||''),String(paramId||''),String(level||''),'evidence','pending',now,now)
            .run();
        }

        // Best-effort legacy mirror. It cannot block the upload.
        try{
          await env.DB.prepare(`INSERT OR IGNORE INTO evidence_uploads
            (upload_id,year,opd_id,subunsur,param_id,level,type,sync_status,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`)
            .bind(uploadId,String(year),String(opdId),String(subCode||''),String(paramId||''),String(level||''),'evidence','pending',now,now)
            .run();
        }catch(_){}

        const existingRec=await env.DB.prepare("SELECT opd,subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,year).all();
        if(!existingRec.results.length) throw new Error('OPD tidak ditemukan');

        let existingObj={};
        try{ existingObj=existingRec.results[0]?.subunsurs?JSON.parse(existingRec.results[0].subunsurs):{}; }catch{}
        const existingArr=existingObj?.[subCode]?.[paramId]?.['files'+level];
        const existing=Array.isArray(existingArr)?existingArr.find(x=>x&&x.uploadId===uploadId):null;
        const regNow=(await env.DB.prepare("SELECT * FROM evidence_upload_registry WHERE upload_id=? LIMIT 1").bind(uploadId).all()).results?.[0];

        if(existing?.gdriveId || regNow?.gdrive_id){
          const gdriveId=existing?.gdriveId||regNow.gdrive_id;
          return jsonResponse({
            status:'success',
            url:existing?.url||publicUrl,
            fileName:existing?.fileName||fileName,
            googleDriveId:gdriveId,
            gdriveId,
            syncStatus:'done',
            uploadId,
            backupQueued:false,
            r2Saved:true,
            r2Key:existing?.r2Key||regNow.r2_key||filePath
          });
        }

        let r2Key=existing?.r2Key||regNow?.r2_key||filePath;
        let r2ObjectExists=false;
        if(r2Key){
          try{ r2ObjectExists=!!(await env.EVIDENCE_BUCKET.head(r2Key)); }catch{}
        }
        if(!r2ObjectExists){
          await env.EVIDENCE_BUCKET.put(r2Key,fileBody||bytes,{httpMetadata:{contentType:fileType}});
        }
        await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_uploads SET r2_key=?,sync_status='pending',sync_error=NULL,updated_at=? WHERE upload_id=?")
          .bind(r2Key,now,uploadId));

        if(!existing){
          const uploadMeta={
            url:`https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${r2Key}`,
            fileName:sanitizeString(fileName).substring(0,150),
            gdriveId:null,
            storage:'R2',
            syncStatus:'pending',
            uploadedAt:new Date().toISOString(),
            uploadId,
            r2Key,
            fileType
          };
          const jsonItem=JSON.stringify(uploadMeta);
          const safeSubPath=subCode.replace(/[^A-Za-z0-9_.-]/g,'');
          const safeParamPath=paramId.replace(/[^A-Za-z0-9_.-]/g,'');
          const safeLevel=(String(level).match(/[1-5]/)||['1'])[0];
          const subPath = `$.\"${safeSubPath}\"`;
          const paramPath = `$.\"${safeSubPath}\".\"${safeParamPath}\"`;
          const filesPath = `$.\"${safeSubPath}\".\"${safeParamPath}\".\"files${safeLevel}\"`;
          // Persist the upload history atomically in the exact OPD/parameter/level.
          // The old implementation passed '$[#]' as a bound parameter; SQLite JSON1
          // does not treat a bound append path reliably, leaving the array empty.
          // Build the append path as a SQL literal while all data values remain bound.
          const appendSql = `UPDATE opd_data SET subunsurs = json_set(
              json_set(
                json_set(COALESCE(subunsurs,'{}'), ?, COALESCE(json_extract(COALESCE(subunsurs,'{}'), ?), json('{}'))),
                ?, COALESCE(json_extract(COALESCE(subunsurs,'{}'), ?), json('{}'))
              ),
              '${filesPath}',
              json_insert(COALESCE(json_extract(COALESCE(subunsurs,'{}'), '${filesPath}'), '[]'), '$[#]', json(?))
            ) WHERE id=? AND year=?`;
          await runD1WithRetry(()=>env.DB.prepare(appendSql).bind(
            subPath, subPath, paramPath, paramPath, jsonItem, opdId, year
          ));
          const latest=await env.DB.prepare("SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,year).all();
          let subunsursLatest={};try{subunsursLatest=latest.results[0]?.subunsurs?JSON.parse(latest.results[0].subunsurs):{}}catch{}
          const strukturNilai=calculateSAFromSubunsur(subunsursLatest);
          const strukturCount=countParameterEvidence(subunsursLatest);
          const strukturStatus=strukturCount===countTotalParameters()?'Selesai':(strukturCount>0?'Proses':'Belum');
          await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET sa=?,nilai_struktur_proses=?,struktur_proses_status=? WHERE id=? AND year=?").bind(strukturNilai,strukturNilai,strukturStatus,opdId,year));
        }

        await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_upload_registry SET sync_status='pending',updated_at=? WHERE upload_id=?")
          .bind(Date.now(),uploadId));
        try{
          await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_uploads SET sync_status='pending',updated_at=? WHERE upload_id=?")
            .bind(Date.now(),uploadId));
        }catch(_){}

        const job={type:'evidence',uploadId,year,opdId,opdName:params.opdName||existingRec.results[0].opd||'OPD',
          r2Key,fileName:sanitizeString(fileName).substring(0,150),fileType,subunsur:subCode,paramId,level};

        notifyRealtime(env,ctx,year,{action:'uploadFile',opdId,uploadId});

        try{
          const gdriveId=await directGoogleDriveBackup(env,job);
          await updateEvidenceFileStatus(env,job,{gdriveId,storage:'R2 + Google Drive',syncStatus:'done',syncError:null});
          await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_upload_registry SET gdrive_id=?,sync_status='done',sync_error=NULL,updated_at=? WHERE upload_id=?")
            .bind(gdriveId,Date.now(),uploadId));
          try{
            await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_upload_registry SET gdrive_id=?,sync_status='done',sync_error=NULL,updated_at=? WHERE upload_id=?")
              .bind(gdriveId,Date.now(),uploadId));
            try{
              await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_uploads SET gdrive_id=?,sync_status='done',sync_error=NULL,updated_at=? WHERE upload_id=?")
                .bind(gdriveId,Date.now(),uploadId));
            }catch(_){}
          }catch(_){}
          notifyRealtime(env,ctx,year,{action:'uploadFile',opdId,uploadId,storage:'R2 + Google Drive'});
          return jsonResponse({status:'success',url:`https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${r2Key}`,
            fileName:job.fileName,googleDriveId:gdriveId,gdriveId,syncStatus:'done',uploadId,backupQueued:false,r2Saved:true,r2Key});
        }catch(driveErr){
          const message=String(driveErr?.message||driveErr);
          await updateEvidenceFileStatus(env,job,{syncStatus:'retrying',syncError:message,storage:'R2'});
          await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_upload_registry SET sync_status='retrying',sync_error=?,updated_at=? WHERE upload_id=?")
            .bind(message,Date.now(),uploadId));
          try{
            await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_uploads SET sync_status='retrying',sync_error=?,updated_at=? WHERE upload_id=?")
              .bind(message,Date.now(),uploadId));
          }catch(_){}
          notifyRealtime(env,ctx,year,{action:'uploadFile',opdId,uploadId,storage:'R2',syncStatus:'retrying'});
          return jsonResponse({
            status:'pending',
            message:'File sudah diamankan di R2 tetapi BELUM masuk Google Drive. Sistem akan mencoba lagi otomatis.',
            url:`https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${r2Key}`,
            fileName:job.fileName,googleDriveId:null,gdriveId:null,syncStatus:'retrying',
            uploadId,r2Saved:true,r2Key,driveError:message,backupQueued:false
          });
        }
      }

      case 'retryDriveBackup': {
        const {opdId, year: retryYear, uploadId, type='evidence', subunsur, paramId, level} = params;
        const targetYear=String(retryYear||year);
        if(!opdId || !uploadId) throw new Error('opdId dan uploadId wajib diisi');
        let job=null;
        if(type==='report'){
          const cfg=reportFieldConfig(params.reportType);
          const rec=await env.DB.prepare(`SELECT opd,${cfg.listField},${cfg.folderField},${cfg.folderIdField} FROM opd_data WHERE id=? AND year=? LIMIT 1`).bind(opdId,targetYear).all();
          if(!rec.results.length) throw new Error('OPD tidak ditemukan');
          const list=parseJsonArray(rec.results[0]?.[cfg.listField]);
          const item=list.find(x=>x&&x.uploadId===uploadId); if(!item) throw new Error('Laporan tidak ditemukan pada OPD/lokasi yang sama');
          job={type:'report',reportType:cfg.type,uploadId,year:targetYear,opdId,opdName:rec.results[0].opd||'OPD',r2Key:item.r2Key||'',fileName:item.fileName||'laporan',fileType:item.fileType||'application/octet-stream',gdriveFolderId:item.gdriveFolderId||rec.results[0][cfg.folderIdField]||null};
        } else if(type==='rtp'){
          const rec=await env.DB.prepare("SELECT opd,rtp_evidence,rtp_evidence_folder,rtp_evidence_folder_id FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,targetYear).all();
          if(!rec.results.length) throw new Error('OPD tidak ditemukan');
          let list=[];try{list=rec.results[0]?.rtp_evidence?JSON.parse(rec.results[0].rtp_evidence):[]}catch{}
          const item=list.find(x=>x&&x.uploadId===uploadId); if(!item) throw new Error('Evidence RTP tidak ditemukan pada OPD/lokasi yang sama');
          job={type:'rtp',uploadId,year:targetYear,opdId,opdName:rec.results[0].opd||'OPD',r2Key:item.r2Key||'',fileName:item.fileName||'evidence',fileType:item.fileType||'application/octet-stream',folderName:item.folderName||rec.results[0].rtp_evidence_folder||'Evidence RTP',gdriveFolderId:rec.results[0].rtp_evidence_folder_id||null};
        } else {
          const rec=await env.DB.prepare("SELECT opd,subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,targetYear).all();
          if(!rec.results.length) throw new Error('OPD tidak ditemukan');
          let obj={};try{obj=rec.results[0]?.subunsurs?JSON.parse(rec.results[0].subunsurs):{}}catch{}
          const arr=obj?.[subunsur]?.[paramId]?.['files'+level];
          const item=Array.isArray(arr)?arr.find(x=>x&&x.uploadId===uploadId):null;
          // NEVER create a new evidence record during a Drive retry.
          // If the exact OPD/subunsur/parameter/level record is absent, stop.
          if(!item) throw new Error('Evidence tidak ditemukan pada OPD/kolom yang sama. Retry dibatalkan untuk mencegah salah penempatan.');
          const registry=await env.DB.prepare("SELECT * FROM evidence_upload_registry WHERE upload_id=? LIMIT 1").bind(uploadId).all();
          const reg=registry.results?.[0];
          if(!reg) throw new Error('Registri upload tidak ditemukan. Retry dibatalkan untuk keamanan.');
          const sameLocation=String(reg.year)===targetYear &&
            String(reg.opd_id)===String(opdId) &&
            String(reg.subunsur||'')===String(subunsur||'') &&
            String(reg.param_id||'')===String(paramId||'') &&
            String(reg.level||'')===String(level||'') &&
            String(reg.type||'evidence')==='evidence';
          if(!sameLocation) throw new Error('Registri upload tidak cocok dengan OPD/kolom. Retry dibatalkan.');
          job={type:'evidence',uploadId,year:targetYear,opdId,opdName:rec.results[0].opd||'OPD',
            r2Key:item.r2Key||reg.r2_key||'',fileName:item.fileName||'evidence',fileType:item.fileType||'application/octet-stream',
            subunsur:String(subunsur),paramId:String(paramId),level:String(level)};
        }
        if(!job.r2Key) throw new Error('Lokasi file R2 tidak ditemukan');
        try{
          const obj=await env.EVIDENCE_BUCKET.head(job.r2Key);
          if(!obj) throw new Error('File sumber di R2 tidak ditemukan');
          const gdriveId=await directGoogleDriveBackup(env,job);
          if(job.type==='rtp') await updateRtpFileStatus(env,job,{gdriveId,storage:'R2 + Google Drive',syncStatus:'done',syncError:null});
          else if(job.type==='report') await updateReportFileStatus(env,job,{gdriveId,storage:'R2 + Google Drive',syncStatus:'done',syncError:null});
          else{
            await updateEvidenceFileStatus(env,job,{gdriveId,storage:'R2 + Google Drive',syncStatus:'done',syncError:null});
            await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_uploads SET gdrive_id=?,sync_status='done',sync_error=NULL,updated_at=? WHERE upload_id=?")
              .bind(gdriveId,Date.now(),uploadId));
          }
          notifyRealtime(env,ctx,targetYear,{action:'retryDriveBackup',opdId,uploadId,storage:'R2 + Google Drive'});
          return jsonResponse({status:'success',gdriveId,syncStatus:'done',uploadId});
        }catch(err){
          if(job.type==='rtp') await updateRtpFileStatus(env,job,{syncStatus:'retrying',syncError:String(err.message||err)});
          else if(job.type==='report') await updateReportFileStatus(env,job,{syncStatus:'retrying',syncError:String(err.message||err)});
          else{
            await updateEvidenceFileStatus(env,job,{syncStatus:'retrying',syncError:String(err.message||err)});
            await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_upload_registry SET sync_status='retrying',sync_error=?,updated_at=? WHERE upload_id=?")
              .bind(String(err.message||err),Date.now(),uploadId));
            try{
              await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_uploads SET sync_status='retrying',sync_error=?,updated_at=? WHERE upload_id=?")
                .bind(String(err.message||err),Date.now(),uploadId));
            }catch(_){}
          }
          notifyRealtime(env,ctx,targetYear,{action:'retryDriveBackup',opdId,uploadId,storage:'R2',syncStatus:'retrying'});
          return jsonResponse({status:'pending',syncStatus:'retrying',uploadId,driveError:String(err.message||err),message:'R2 tetap tersimpan. Google Drive belum berhasil; retry otomatis akan dilanjutkan.'});
        }
      }
      case 'replaceEvidenceFile': {
        assertGoogleDriveConfigured(env);
        const opdId=String(params.opdId||'');
        const subunsur=String(params.subunsur||'');
        const paramId=String(params.paramId||'');
        const level=String(params.level||'');
        const uploadId=String(params.uploadId||'');
        if(!opdId || !subunsur || !paramId || !/^[1-5]$/.test(level) || !uploadId) throw new Error('Identitas file pengganti tidak lengkap.');
        const file=params.file;
        const legacyData=params.fileData;
        if(!file && !legacyData && !request.body) throw new Error('File pengganti tidak diterima');
        let bytes=null; let fileType=params.fileType||'application/octet-stream'; let fileName=sanitizeString(params.fileName||'evidence').substring(0,150)||'evidence';
        if(file){
          if((file.size||0)>10*1024*1024) throw new Error('File > 10MB, terlalu besar!');
          fileName=sanitizeString(file.name||fileName).substring(0,150)||'evidence';
          fileType=file.type||fileType; bytes=new Uint8Array(await file.arrayBuffer());
        }else if(legacyData){
          bytes=decodeBase64File(legacyData,10);
        }else{
          const size=Number(params.fileSize)||0; if(size>10*1024*1024) throw new Error('File > 10MB, terlalu besar!');
          bytes=new Uint8Array(await request.arrayBuffer());
        }
        const rec=await env.DB.prepare("SELECT opd,subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,year).all();
        if(!rec.results.length) throw new Error('OPD tidak ditemukan');
        let obj={}; try{obj=rec.results[0]?.subunsurs?JSON.parse(rec.results[0].subunsurs):{}}catch{}
        const arr=obj?.[subunsur]?.[paramId]?.['files'+level];
        if(!Array.isArray(arr)) throw new Error('Daftar file evidence tidak ditemukan.');
        const item=arr.find(x=>x&&typeof x==='object'&&String(x.uploadId||'')===uploadId);
        if(!item) throw new Error('File evidence tidak ditemukan pada OPD/parameter/level yang sama.');
        if(normalizeVerificationStatus(item?.verification?.status)!=='dikembalikan') throw new Error('Penggantian file hanya tersedia setelah hasil verifikasi Dikembalikan.');
        if(!item.r2Key) throw new Error('Lokasi file R2 tidak ditemukan.');

        const previousObject=await env.EVIDENCE_BUCKET.get(item.r2Key);
        if(!previousObject) throw new Error('File lama pada R2 tidak ditemukan.');
        const previousBytes=new Uint8Array(await previousObject.arrayBuffer());
        const previousContentType=previousObject.httpMetadata?.contentType||item.fileType||'application/octet-stream';
        await env.EVIDENCE_BUCKET.put(item.r2Key,bytes,{httpMetadata:{contentType:fileType}});
        let gdriveId=String(item.gdriveId||'').trim();
        try {
          if(gdriveId){
            try{
              const accessToken=await getGoogleAccessToken(env);
              const currentDrive=await getDriveFile(accessToken,gdriveId);
              if(currentDrive && !currentDrive.trashed){
                const updated=await updateGoogleDriveFileContent(env,gdriveId,fileName,bytes,fileType);
                gdriveId=updated.id||gdriveId;
              }else{
                gdriveId='';
              }
            }catch(err){
              if(Number(err?.status)!==404) throw err;
              gdriveId='';
            }
          }
          if(!gdriveId){
            const job={type:'evidence',uploadId,year,opdId,opdName:rec.results[0].opd||'OPD',r2Key:item.r2Key,fileName,fileType,subunsur,paramId,level};
            gdriveId=await directGoogleDriveBackup(env,job);
          }
        } catch (err) {
          // Do not leave R2 and Drive out of sync when replacement fails.
          await env.EVIDENCE_BUCKET.put(item.r2Key,previousBytes,{httpMetadata:{contentType:previousContentType}}).catch(()=>{});
          throw err;
        }
        const now=new Date().toISOString();
        item.fileName=fileName;
        item.fileType=fileType;
        item.storage='R2 + Google Drive';
        item.syncStatus='done';
        item.syncError=null;
        item.gdriveId=gdriveId;
        item.url=`https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${item.r2Key}`;
        item.replacementStatus='menunggu_verifikasi';
        item.replacedAt=now;
        item.replacementVersion=Math.max(1,Number(item.replacementVersion||0)+1);
        item.verification=null;
        await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET subunsurs=? WHERE id=? AND year=?").bind(JSON.stringify(obj),opdId,year));
        try{await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_upload_registry SET gdrive_id=?,r2_key=?,sync_status='done',sync_error=NULL,updated_at=? WHERE upload_id=?").bind(gdriveId,item.r2Key,Date.now(),uploadId));}catch(_){ }
        try{await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_uploads SET gdrive_id=?,r2_key=?,sync_status='done',sync_error=NULL,updated_at=? WHERE upload_id=?").bind(gdriveId,item.r2Key,Date.now(),uploadId));}catch(_){ }
        notifyRealtime(env,ctx,year,{action:'replaceEvidenceFile',opdId,subunsur,paramId,level,uploadId,storage:'R2 + Google Drive'});
        return jsonResponse({status:'success',message:'File evidence berhasil diganti tanpa membuat file/record baru.',file:item});
      }

      case 'replaceRtpEvidence': {
        assertGoogleDriveConfigured(env);
        const opdId=String(params.opdId||'');
        const uploadId=String(params.uploadId||'');
        if(!opdId || !uploadId) throw new Error('Identitas Evidence RTP pengganti tidak lengkap.');
        const file=params.file;
        const legacyData=params.fileData;
        if(!file && !legacyData && !request.body) throw new Error('File pengganti tidak diterima');
        let bytes=null; let fileType=params.fileType||'application/octet-stream'; let fileName=sanitizeString(params.fileName||'evidence').substring(0,150)||'evidence';
        if(file){
          if((file.size||0)>10*1024*1024) throw new Error('File > 10MB, terlalu besar!');
          fileName=sanitizeString(file.name||fileName).substring(0,150)||'evidence';
          fileType=file.type||fileType; bytes=new Uint8Array(await file.arrayBuffer());
        }else if(legacyData){
          bytes=decodeBase64File(legacyData,10);
        }else{
          const size=Number(params.fileSize)||0; if(size>10*1024*1024) throw new Error('File >10MB, terlalu besar!');
          bytes=new Uint8Array(await request.arrayBuffer());
        }
        const rec=await env.DB.prepare("SELECT opd,rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,year).all();
        if(!rec.results.length) throw new Error('OPD tidak ditemukan');
        let list=[]; try{list=rec.results[0]?.rtp_evidence?JSON.parse(rec.results[0].rtp_evidence):[]}catch{}
        if(!Array.isArray(list)) list=[];
        const index=list.findIndex(x=>x&&typeof x==='object'&&String(x.uploadId||'')===uploadId);
        if(index<0) throw new Error('File Evidence RTP tidak ditemukan pada OPD yang sama.');
        const item=list[index];
        if(normalizeVerificationStatus(item?.verification?.status)!=='dikembalikan') throw new Error('Penggantian file hanya tersedia setelah hasil verifikasi Dikembalikan.');
        if(!item.r2Key) throw new Error('Lokasi file R2 tidak ditemukan.');

        const previousObject=await env.EVIDENCE_BUCKET.get(item.r2Key);
        if(!previousObject) throw new Error('File lama pada R2 tidak ditemukan.');
        const previousBytes=new Uint8Array(await previousObject.arrayBuffer());
        const previousContentType=previousObject.httpMetadata?.contentType||item.fileType||'application/octet-stream';
        await env.EVIDENCE_BUCKET.put(item.r2Key,bytes,{httpMetadata:{contentType:fileType}});
        let gdriveId=String(item.gdriveId||'').trim();
        try {
          if(gdriveId){
            try{
              const accessToken=await getGoogleAccessToken(env);
              const currentDrive=await getDriveFile(accessToken,gdriveId);
              if(currentDrive && !currentDrive.trashed){
                const updated=await updateGoogleDriveFileContent(env,gdriveId,fileName,bytes,fileType);
                gdriveId=updated.id||gdriveId;
              }else{
                gdriveId='';
              }
            }catch(err){
              if(Number(err?.status)!==404) throw err;
              gdriveId='';
            }
          }
          if(!gdriveId){
            const folderRec=await env.DB.prepare("SELECT rtp_evidence_folder,rtp_evidence_folder_id FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,year).all();
            const job={type:'rtp',uploadId,year,opdId,opdName:rec.results[0].opd||'OPD',r2Key:item.r2Key,fileName,fileType,folderName:item.folderName||folderRec.results?.[0]?.rtp_evidence_folder||'Evidence RTP',gdriveFolderId:item.gdriveFolderId||folderRec.results?.[0]?.rtp_evidence_folder_id||null};
            gdriveId=await directGoogleDriveBackup(env,job);
            item.gdriveFolderId=job.gdriveFolderId||null;
          }
        } catch (err) {
          await env.EVIDENCE_BUCKET.put(item.r2Key,previousBytes,{httpMetadata:{contentType:previousContentType}}).catch(()=>{});
          throw err;
        }
        const now=new Date().toISOString();
        item.fileName=fileName;
        item.fileType=fileType;
        item.storage='R2 + Google Drive';
        item.syncStatus='done';
        item.syncError=null;
        item.gdriveId=gdriveId;
        item.url=`https://pub-8e4e0075c2e4428e95f6455b2e2b9826.r2.dev/${item.r2Key}`;
        item.replacementStatus='menunggu_verifikasi';
        item.replacedAt=now;
        item.replacementVersion=Math.max(1,Number(item.replacementVersion||0)+1);
        item.verification=null;
        await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET rtp_evidence=? WHERE id=? AND year=?").bind(JSON.stringify(list),opdId,year));
        notifyRealtime(env,ctx,year,{action:'replaceRtpEvidence',opdId,uploadId,storage:'R2 + Google Drive'});
        return jsonResponse({status:'success',message:'File Evidence RTP berhasil diganti tanpa membuat file/record baru.',file:item,rtpEvidence:list});
      }

      case 'deleteFile': {
        const requestedUrl = String(params.fileUrl || '').trim();
        const requestedCleanUrl = requestedUrl.split('?')[0];

        // Resolve the target against the authoritative D1 copy first.
        // This is important for legacy files where URL/uploadId may be blank.
        let metadataDeleted = false;
        let deletedFile = null;
        let deletedIndex = -1;

        if(params.opdId && params.subunsur && params.paramId && params.level){
          try{
            const rec=await env.DB.prepare(
              "SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1"
            ).bind(params.opdId,year).all();

            if(!rec.results.length) throw new Error('OPD tidak ditemukan.');

            let obj={};
            try{obj=rec.results[0].subunsurs?JSON.parse(rec.results[0].subunsurs):{};}catch{obj={};}

            const key='files'+String(params.level);
            const holder=obj?.[params.subunsur]?.[params.paramId];
            const arr=holder?.[key];

            if(!Array.isArray(arr)) throw new Error('Daftar file evidence tidak ditemukan.');

            const wantedUploadId=String(params.uploadId||'').trim();
            const wantedName=String(params.fileName||'').trim();
            const serverIndex=Number.isInteger(Number(params.fileIndex)) ? Number(params.fileIndex) : -1;

            // Stable identity first.
            if(wantedUploadId){
              deletedIndex=arr.findIndex(x=>
                x && typeof x==='object' && String(x.uploadId||'')===wantedUploadId
              );
            }

            // Exact URL second.
            if(deletedIndex<0 && requestedCleanUrl){
              deletedIndex=arr.findIndex(x=>{
                const u=typeof x==='string'?x:(x&&typeof x==='object'?x.url:'');
                return String(u||'').split('?')[0]===requestedCleanUrl;
              });
            }

            // Unique filename is safer than trusting a browser-side index when
            // a legacy object was normalized differently on the client.
            if(deletedIndex<0 && wantedName){
              const matches=arr.map((x,i)=>({x,i})).filter(({x})=>{
                if(typeof x==='string') return decodeSafeFileName(x)===wantedName;
                return x && typeof x==='object' &&
                  String(x.fileName||x.name||'').trim()===wantedName;
              });
              if(matches.length===1) deletedIndex=matches[0].i;
            }

            // Last resort: explicit array index (needed when legacy rows share
            // generic names or have no URL/uploadId).
            if(deletedIndex<0 && serverIndex>=0 && serverIndex<arr.length){
              deletedIndex=serverIndex;
            }

            if(deletedIndex<0){
              throw new Error('File yang diminta tidak ditemukan di database. Daftar tidak diubah.');
            }

            deletedFile=arr[deletedIndex];
            const next=arr.slice(0,deletedIndex).concat(arr.slice(deletedIndex+1));

            const sa=calculateSAFromSubunsur(obj);
            const sc=countParameterEvidence(obj);
            const st=sc===countTotalParameters()?'Selesai':(sc>0?'Proses':'Belum');

            // External storage is deleted BEFORE changing D1 metadata. That makes
            // the operation retry-safe: if D1 fails, a second click sees Drive/R2
            // as already missing and can finish the metadata deletion.
            const deletedGdriveId=String(
              (deletedFile && typeof deletedFile==='object'
                ? (deletedFile.gdriveId || deletedFile.googleDriveId || '')
                : '') || params.gdriveId || ''
            ).trim();

            let deletedR2Key=String(
              (deletedFile && typeof deletedFile==='object' ? (deletedFile.r2Key || '') : '') ||
              params.r2Key || ''
            ).trim();

            let filePath='';
            if(deletedR2Key){
              filePath=deletedR2Key;
            }else{
              const deletedUrl=String(
                (deletedFile && typeof deletedFile==='object' ? (deletedFile.url || '') : '') ||
                (typeof deletedFile==='string' ? deletedFile : '') ||
                requestedCleanUrl
              ).split('?')[0];

              const marker='r2.dev/';
              const idx=deletedUrl.indexOf(marker);
              if(idx!==-1){
                try{ filePath=decodeURIComponent(deletedUrl.substring(idx+marker.length)); }catch{ filePath=deletedUrl.substring(idx+marker.length); }
              }
            }

            if(deletedGdriveId){
              try{
                await deleteGoogleDriveFile(env,deletedGdriveId);
              }catch(err){
                return jsonResponse({
                  status:'error',
                  message:`File belum dihapus karena salinan Google Drive gagal dihapus. ${err.message || err}`,
                  metadataDeleted:false,
                  driveDeleted:false,
                  gdriveId:deletedGdriveId
                },409);
              }
            }

            if(filePath){
              try{
                await env.EVIDENCE_BUCKET.delete(filePath);
              }catch(err){
                return jsonResponse({
                  status:'error',
                  message:`File belum dihapus karena salinan R2 gagal dihapus. ${err.message || err}`,
                  metadataDeleted:false,
                  r2Deleted:false,
                  r2Key:filePath
                },409);
              }
            }

            holder[key]=next;
            await runD1WithRetry(()=>env.DB.prepare(
              "UPDATE opd_data SET subunsurs=?, sa=?, nilai_struktur_proses=?, struktur_proses_status=? WHERE id=? AND year=?"
            ).bind(JSON.stringify(obj),sa,sa,st,params.opdId,year));

            // Verify the authoritative row after the write.
            const verify=await env.DB.prepare(
              "SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1"
            ).bind(params.opdId,year).all();

            let verifyObj={};
            try{
              verifyObj=verify.results?.[0]?.subunsurs
                ? JSON.parse(verify.results[0].subunsurs)
                : {};
            }catch{verifyObj={};}

            const verifyArr=verifyObj?.[params.subunsur]?.[params.paramId]?.[key];

            if(Array.isArray(verifyArr) && verifyArr.length !== next.length){
              throw new Error('Database belum mengonfirmasi penghapusan file. Silakan ulangi.');
            }

            metadataDeleted=true;

            const deletedUploadId=String(
              (deletedFile && typeof deletedFile==='object' ? deletedFile.uploadId : '') ||
              params.uploadId || ''
            ).trim();

            // Registry cleanup is best-effort after the authoritative metadata
            // has been removed.
            if(deletedUploadId){
              try{
                await runD1WithRetry(()=>env.DB.prepare(
                  "DELETE FROM evidence_upload_registry WHERE upload_id=?"
                ).bind(deletedUploadId).run());
              }catch(_){}
              try{
                await runD1WithRetry(()=>env.DB.prepare(
                  "DELETE FROM evidence_uploads WHERE upload_id=?"
                ).bind(deletedUploadId).run());
              }catch(_){}
            }

            notifyRealtime(env,ctx,year,{
              action:'deleteFile',
              opdId:params.opdId||null,
              subunsur:params.subunsur||null,
              paramId:params.paramId||null,
              level:params.level||null,
              uploadId:deletedUploadId||null,
              fileIndex:deletedIndex
            });

            return jsonResponse({
              status:'success',
              metadataDeleted,
              r2Deleted:!!filePath,
              driveDeleted:!!deletedGdriveId,
              fileName: typeof deletedFile==='string'
                ? decodeSafeFileName(deletedFile)
                : (deletedFile?.fileName || deletedFile?.name || params.fileName || 'File')
            });
          }catch(err){
            console.warn('Penghapusan evidence gagal:',err.message);
            return jsonResponse({
              status:'error',
              message:err.message || 'Gagal menghapus metadata file.',
              metadataDeleted:false
            },409);
          }
        }

        throw new Error('Lokasi evidence tidak lengkap.');
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
          const subunsurs = row.subunsurs ? (typeof row.subunsurs==='string' ? JSON.parse(row.subunsurs) : row.subunsurs) : {};
          const sa = calculateSAFromSubunsur(subunsurs);
          const kkData = row.kk_data || row.kkData || {};
          const kkPmData = row.kk_pm_data || row.kkPmData || {};
          const kkRtpData = row.kk_rtp_data || row.kkRtpData || {};
          const rtpEvidence = row.rtp_evidence || row.rtpEvidence || [];
          const pmSpipReports = row.pm_spip_reports || row.pmSpipReports || [];
          const rrRtpReports = row.rr_rtp_reports || row.rrRtpReports || [];
          const nilaiStrukturProses = Number(row.nilai_struktur_proses ?? row.nilaiStrukturProses ?? sa) || sa;
          const nilaiMaturitas = Math.max(0,Math.min(5,Number(row.nilai_maturitas ?? row.nilaiMaturitas ?? 0)||0));
          const nilaiKapabilitasApip = Number(row.nilai_kapabilitas_apip ?? row.nilaiKapabilitasApip ?? 0)||0;
          const strukturStatus = row.struktur_proses_status || row.strukturProsesStatus || (countParameterEvidence(subunsurs)===countTotalParameters()?'Selesai':(countParameterEvidence(subunsurs)>0?'Proses':'Belum'));
          await env.DB.prepare("INSERT OR REPLACE INTO opd_data (id, opd, sa, nilai_struktur_proses, nilai_maturitas, nilai_kapabilitas_apip, evidence, qa_apip, mri, iepk, rtp, status, struktur_proses_status, subunsurs, year, kk_data, kk_pm_data, kk_rtp_data, rtp_evidence, rtp_evidence_folder, rtp_evidence_folder_id, pm_spip_reports, pm_spip_folder, pm_spip_folder_id, rr_rtp_reports, rr_rtp_folder, rr_rtp_folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(row.id, sanitizeString(row.opd||''), sa, nilaiStrukturProses, nilaiMaturitas, nilaiKapabilitasApip, row.evidence||'Belum', row.qa_apip || row.qaApip || 'Belum', parseFloat(row.mri)||0, parseFloat(row.iepk)||0, row.rtp||'Belum', row.status||'Belum', strukturStatus, JSON.stringify(subunsurs), year, JSON.stringify(kkData), JSON.stringify(kkPmData), JSON.stringify(kkRtpData), JSON.stringify(rtpEvidence), row.rtp_evidence_folder || row.rtpEvidenceFolder || 'Evidence RTP', row.rtp_evidence_folder_id || row.rtpEvidenceFolderId || '', JSON.stringify(pmSpipReports), row.pm_spip_folder || row.pmSpipFolder || 'Laporan Hasil PM SPIP', row.pm_spip_folder_id || row.pmSpipFolderId || '', JSON.stringify(rrRtpReports), row.rr_rtp_folder || row.rrRtpFolder || 'Laporan Pemantauan RR_RTP', row.rr_rtp_folder_id || row.rrRtpFolderId || '').run();
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
