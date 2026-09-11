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
    const adds=[['nilai_struktur_proses','REAL NOT NULL DEFAULT 0'],['nilai_maturitas','REAL NOT NULL DEFAULT 0'],['nilai_kapabilitas_apip','REAL NOT NULL DEFAULT 0'],['kk_pm_data',"TEXT NOT NULL DEFAULT '{}'"],['kk_rtp_data',"TEXT NOT NULL DEFAULT '{}'"],['rtp_evidence',"TEXT NOT NULL DEFAULT '[]'"],['rtp_evidence_folder',"TEXT NOT NULL DEFAULT 'Evidence RTP'"],['struktur_proses_status',"TEXT NOT NULL DEFAULT 'Belum'"]];
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
    schemaReady=true;
  })().catch(err=>{schemaReadyPromise=null;throw err;});
  return schemaReadyPromise;
}

// ============ KEAMANAN: SANITASI & RATE LIMITING ============
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
  const existing = await findDriveFileByUploadId(accessToken, parentFolderId, uploadId);
  if (existing) return existing.id;

  const metadata = {
    name: fileName,
    parents: [parentFolderId],
    appProperties: { kawalUploadId: String(uploadId || '') }
  };

  async function startSession() {
    const res = await fetchWithRetry('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method:'POST',
      headers:{
        Authorization:`Bearer ${accessToken}`,
        'Content-Type':'application/json; charset=UTF-8',
        'X-Upload-Content-Type':fileType,
        'X-Upload-Content-Length':String(bytes.length)
      },
      body:JSON.stringify(metadata)
    }, {retries:5,baseDelay:800});
    if (!res.ok) throw new Error('Gagal inisialisasi upload Google Drive: '+await res.text());
    const location=res.headers.get('Location');
    if(!location) throw new Error('Google Drive tidak mengembalikan URL sesi resumable');
    return location;
  }

  async function putSession(location) {
    const res = await fetchWithRetry(location, {
      method:'PUT',
      headers:{
        'Content-Type':fileType,
        'Content-Length':String(bytes.length),
        'Content-Range':`bytes 0-${bytes.length-1}/${bytes.length}`
      },
      body:bytes
    }, {retries:5,baseDelay:1000});
    const data=await res.json().catch(()=>({}));
    if(res.ok && data.id) return data.id;
    throw new Error('Google Drive menolak upload: '+JSON.stringify(data));
  }

  let location = await startSession();
  try {
    return await putSession(location);
  } catch (firstErr) {
    // Check idempotency once more in case Drive committed the file but the response was lost.
    const after = await findDriveFileByUploadId(accessToken, parentFolderId, uploadId);
    if (after) return after.id;
    // Recreate the resumable session and try again from byte 0.
    location = await startSession();
    return await putSession(location);
  }
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
      const root=await getOrCreateFolder(token,env.GOOGLE_DRIVE_FOLDER_ID,'Kertas Kerja Spreadsheet');
      const yearFolder=await getOrCreateFolder(token,root,String(job.year));
      const opdFolder=await getOrCreateFolder(token,yearFolder,safeDriveName(job.opdName||'OPD'));
      const rtpFolder=await getOrCreateFolder(token,opdFolder,'Kertas Kerja RTP');
      const evidenceFolder=await getOrCreateFolder(token,rtpFolder,safeDriveName(job.folderName||'Evidence RTP'));
      return uploadBytesToGoogleDriveFolder(env,token,evidenceFolder,job.fileName,bytes,job.fileType,job.uploadId);
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
    } else {
      await updateEvidenceFileStatus(env, job, { gdriveId, storage: 'R2 + Google Drive', syncStatus: 'done', syncError: null });
    }
    return { ok: true, gdriveId };
  } catch (err) {
    const message = String(err?.message || err);
    if (job.type === 'rtp') {
      await updateRtpFileStatus(env, job, { syncStatus: 'retrying', syncError: message });
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

export async function onRequest({ request, env, ctx }) {
  const ACCESS_PASSWORD = env.ACCESS_PASSWORD;
  const DELETE_PASSWORD = env.DELETE_PASSWORD;
  const url = new URL(request.url);
  let params = {};
  let action = url.searchParams.get('action') || '';

  // Daftar aksi sensitif yang tidak boleh diakses via GET
  const SENSITIVE_ACTIONS = [
    'verifyAccess', 'verifyDelete', 'addOpd', 'saveData', 'saveField',
    'uploadFile', 'deleteFile', 'deleteOpd', 'addYear', 'deleteYear',
    'createBackup', 'restoreBackup', 'deleteBackup', 'createKkSheets', 'saveKkData', 'getKkPmData', 'saveKkPmData', 'saveRow', 'saveSubunsur', 'createRtpKkSheets', 'saveRtpKkData', 'saveRtpEvidenceFolder', 'uploadRtpEvidence', 'deleteRtpEvidence', 'retryDriveBackup'
  ];

  // KK RTP dan pengaturan folder Evidence RTP wajib melalui POST.
  if (request.method === 'POST') {
    try {
      const contentType=request.headers.get('content-type')||'';
      // Binary upload mode: metadata stays in the query string; the request body is the file stream.
      if(action==='uploadFile' || action==='uploadRtpEvidence'){
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
        const mapped=results.map(r=>{const subunsurs=r.subunsurs?JSON.parse(r.subunsurs):{};const kkData=normalizeKkData(r.kk_data);let kkPmData={};try{kkPmData=r.kk_pm_data?JSON.parse(r.kk_pm_data):{}}catch{}const kkRtpData=normalizeWorkbookData(r.kk_rtp_data,[]);let rtpEvidence=[];try{rtpEvidence=r.rtp_evidence?JSON.parse(r.rtp_evidence):[]}catch{}const strukturNilai=calculateSAFromSubunsur(subunsurs); const strukturEvidenceCount=countParameterEvidence(subunsurs); const totalParams=countTotalParameters(); const strukturStatus=strukturEvidenceCount===totalParams?'Selesai':(strukturEvidenceCount>0?'Proses':'Belum'); return{...r,subunsurs,kkData,kkPmData,kkRtpData,rtpEvidence,rtpEvidenceFolder:r.rtp_evidence_folder||'Evidence RTP',qaApip:r.qa_apip||'Belum',nilaiStrukturProses:strukturNilai,sa:strukturNilai,strukturProsesStatus:strukturStatus,nilaiMaturitas:Number(r.nilai_maturitas||0),nilaiKapabilitasApip:Number(r.nilai_kapabilitas_apip||0)};});
        return new Response(JSON.stringify(mapped),{status:200,headers:{'Content-Type':'application/json'}});
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
            c && /^[A-Za-z0-9_-]{1,40}$/.test(String(c.subCode || '')) &&
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
              await runD1WithRetry(() => env.DB.prepare(
                "UPDATE opd_data SET subunsurs=json_set(COALESCE(subunsurs,'{}'), ?, json(?)), sa=ROUND(COALESCE(sa,0) + (? - COALESCE(CAST(json_extract(COALESCE(subunsurs,'{}'), ?) AS REAL),0)) / ?, 2), nilai_struktur_proces=ROUND(COALESCE(sa,0) + (? - COALESCE(CAST(json_extract(COALESCE(subunsurs,'{}'), ?) AS REAL),0)) / ?, 2) WHERE id=? AND year=?"
                  .replace('nilai_struktur_proces','nilai_struktur_proses')
              ).bind(path, newLevel, newLevel, path, totalParams, newLevel, path, totalParams, params.opdId, year));
            } else {
              const value = String(change.value ?? '').substring(0, 5000);
              await runD1WithRetry(() => env.DB.prepare(
                "UPDATE opd_data SET subunsurs=json_set(COALESCE(subunsurs,'{}'), ?, json(?)) WHERE id=? AND year=?"
              ).bind(path, value, params.opdId, year));
            }
          }

          const rec = await env.DB.prepare("SELECT sa, nilai_struktur_proses, struktur_proses_status FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId, year).all();
          if (!rec.results.length) throw new Error('OPD tidak ditemukan');
          const current = rec.results[0];
          notifyRealtime(env, ctx, year, { action: 'saveSubunsur', opdId: params.opdId });
          return jsonResponse({
            status:'success',
            message:'Perubahan subunsur tersimpan',
            nilaiStrukturProses:Number(current.sa)||0,
            strukturProsesStatus:current.struktur_proses_status||'Belum'
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
      case 'getRtpEvidence': { const {results}=await env.DB.prepare("SELECT rtp_evidence, rtp_evidence_folder FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();if(!results.length)throw new Error('OPD tidak ditemukan');let list=[];try{list=results[0].rtp_evidence?JSON.parse(results[0].rtp_evidence):[]}catch{}const folder=safeDriveName(results[0].rtp_evidence_folder||'Evidence RTP','Evidence RTP');return new Response(JSON.stringify({status:'success',rtpEvidence:list,folderName:folder}),{status:200,headers:{'Content-Type':'application/json'}}); }
      case 'saveRtpEvidenceFolder': {
        const folderName=safeDriveName(params.folderName||'Evidence RTP','Evidence RTP').substring(0,100)||'Evidence RTP';
        const rec=await env.DB.prepare("SELECT opd FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
        if(!rec.results.length) throw new Error('OPD tidak ditemukan');
        let gdriveFolderId=null;
        const driveReady=!!(env.GOOGLE_DRIVE_CLIENT_ID&&env.GOOGLE_DRIVE_CLIENT_SECRET&&env.GOOGLE_DRIVE_REFRESH_TOKEN&&env.GOOGLE_DRIVE_FOLDER_ID);
        if(driveReady){
          const accessToken=await getGoogleAccessToken(env);
          const root=await getOrCreateFolder(accessToken,env.GOOGLE_DRIVE_FOLDER_ID,'Kertas Kerja Spreadsheet');
          const yearFolder=await getOrCreateFolder(accessToken,root,String(year));
          const opdFolder=await getOrCreateFolder(accessToken,yearFolder,safeDriveName(rec.results[0].opd||'OPD'));
          const rtpFolder=await getOrCreateFolder(accessToken,opdFolder,'Kertas Kerja RTP');
          gdriveFolderId=await getOrCreateFolder(accessToken,rtpFolder,folderName);
        }
        await env.DB.prepare("UPDATE opd_data SET rtp_evidence_folder=? WHERE id=? AND year=?").bind(folderName,params.opdId,year).run();
        notifyRealtime(env, ctx, year, { action: 'saveRtpEvidenceFolder', opdId: params.opdId });
        const safeOpd=sanitizeString(rec.results[0].opd||'OPD').substring(0,80)||'OPD';
        const r2Prefix=`kawal_spip/${year}/${safeOpd}/Kertas Kerja RTP/${folderName}/`;
        return new Response(JSON.stringify({status:'success',folderName,gdriveFolderId,r2Prefix,driveConfigured:driveReady}),{status:200,headers:{'Content-Type':'application/json'}});
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
              const existingJob={type:'rtp',uploadId,year,opdId:params.opdId,opdName:params.opdName||'OPD',r2Key:existing.r2Key,fileName:existing.fileName||safeFileName,fileType:existing.fileType||fileType,folderName:existing.folderName||folderName};
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
        await env.DB.prepare("UPDATE opd_data SET rtp_evidence=?, rtp_evidence_folder=? WHERE id=? AND year=?").bind(JSON.stringify(list),folderName,params.opdId,year).run();

        const job={type:'rtp',uploadId,year,opdId:params.opdId,opdName:params.opdName||'OPD',r2Key:filePath,fileName:safeFileName,fileType,folderName};
        notifyRealtime(env, ctx, year, { action: 'uploadRtpEvidence', opdId: params.opdId, uploadId });
        // MANDATORY GOOGLE DRIVE: RTP upload is successful only after Drive returns an ID.
        try {
          const gdriveId=await directGoogleDriveBackup(env,job);
          await updateRtpFileStatus(env,job,{gdriveId,storage:'R2 + Google Drive',syncStatus:'done',syncError:null});
          notifyRealtime(env, ctx, year, { action: 'uploadRtpEvidence', opdId: params.opdId, uploadId, storage: 'R2 + Google Drive' });
          const latest=await env.DB.prepare("SELECT rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
          let latestList=[];try{latestList=latest.results[0]?.rtp_evidence?JSON.parse(latest.results[0].rtp_evidence):[]}catch{}
          return jsonResponse({status:'success',url:publicUrl,fileName:safeFileName,folderName,gdriveId,rtpEvidence:latestList,syncStatus:'done',uploadId,backupQueued:false,r2Saved:true,r2Key:filePath});
        } catch (driveErr) {
          const message=String(driveErr?.message||driveErr);
          await updateRtpFileStatus(env,job,{syncStatus:'retrying',syncError:message,storage:'R2'});
          notifyRealtime(env, ctx, year, { action: 'uploadRtpEvidence', opdId: params.opdId, uploadId, storage: 'R2', syncStatus: 'retrying' });
          return jsonResponse({status:'pending',message:'File RTP sudah diamankan di R2 tetapi BELUM masuk Google Drive. Sistem akan mencoba lagi otomatis.',url:publicUrl,fileName:safeFileName,folderName,gdriveId:null,syncStatus:'retrying',uploadId,backupQueued:false,r2Saved:true,r2Key:filePath,driveError:message});
        }
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
          const safeSubPath=subCode.replace(/"/g,'\\"');
          const safeParamPath=paramId.replace(/"/g,'\\"');
          const filesPath=`$.\"${safeSubPath}\".\"${safeParamPath}\".\"files${level.replace(/"/g,'\\"')}\"`;
          await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_data SET subunsurs=json_insert(
            json_set(json_set(json_set(COALESCE(subunsurs,'{}'), ?, COALESCE(json_extract(COALESCE(subunsurs,'{}'), ?), json('{}'))), ?, COALESCE(json_extract(COALESCE(subunsurs,'{}'), ?), json('{}'))), ?, COALESCE(json_extract(COALESCE(subunsurs,'{}'), ?), '[]')),
            ? , json(?) )
            WHERE id=? AND year=?`)
            .bind(`$.\"${safeSubPath}\"`,`$.\"${safeSubPath}\"`, `$.\"${safeSubPath}\".\"${safeParamPath}\"`,`$.\"${safeSubPath}\".\"${safeParamPath}\"`, filesPath, filesPath, filesPath+'[#]', jsonItem, opdId, year));
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
        if(type==='rtp'){
          const rec=await env.DB.prepare("SELECT opd,rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,targetYear).all();
          if(!rec.results.length) throw new Error('OPD tidak ditemukan');
          let list=[];try{list=rec.results[0]?.rtp_evidence?JSON.parse(rec.results[0].rtp_evidence):[]}catch{}
          const item=list.find(x=>x&&x.uploadId===uploadId); if(!item) throw new Error('Evidence RTP tidak ditemukan pada OPD/lokasi yang sama');
          job={type:'rtp',uploadId,year:targetYear,opdId,opdName:rec.results[0].opd||'OPD',r2Key:item.r2Key||'',fileName:item.fileName||'evidence',fileType:item.fileType||'application/octet-stream',folderName:item.folderName||'Evidence RTP'};
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
          else{
            await updateEvidenceFileStatus(env,job,{gdriveId,storage:'R2 + Google Drive',syncStatus:'done',syncError:null});
            await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_uploads SET gdrive_id=?,sync_status='done',sync_error=NULL,updated_at=? WHERE upload_id=?")
              .bind(gdriveId,Date.now(),uploadId));
          }
          notifyRealtime(env,ctx,targetYear,{action:'retryDriveBackup',opdId,uploadId,storage:'R2 + Google Drive'});
          return jsonResponse({status:'success',gdriveId,syncStatus:'done',uploadId});
        }catch(err){
          if(job.type==='rtp') await updateRtpFileStatus(env,job,{syncStatus:'retrying',syncError:String(err.message||err)});
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
      case 'deleteFile': {
        const cleanUrl = params.fileUrl.split('?')[0];
        const marker = 'r2.dev/';
        const idx = cleanUrl.indexOf(marker);
        const filePath = idx !== -1 ? decodeURIComponent(cleanUrl.substring(idx + marker.length)) : '';

        // Deletion is ordered Drive -> R2. A Drive failure never destroys the R2 backup.
        if (params.gdriveId) {
          try {
            await deleteGoogleDriveFile(env, params.gdriveId);
          } catch (err) {
            return jsonResponse({ status:'error', message:'Gagal hapus di Google Drive. Salinan R2 TETAP dipertahankan: '+err.message });
          }
        }
        if (filePath) await env.EVIDENCE_BUCKET.delete(filePath);
        if(params.opdId && params.subunsur && params.paramId && params.level && params.fileUrl){
          try{
            const rec=await env.DB.prepare("SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
            if(rec.results.length){
              let obj={};try{obj=rec.results[0].subunsurs?JSON.parse(rec.results[0].subunsurs):{};}catch{}
              const key='files'+String(params.level);
              const arr=obj?.[params.subunsur]?.[params.paramId]?.[key];
              if(Array.isArray(arr)){obj[params.subunsur][params.paramId][key]=arr.filter(x=>x.url!==params.fileUrl);const sa=calculateSAFromSubunsur(obj);const sc=countParameterEvidence(obj);const st=sc===countTotalParameters()?'Selesai':(sc>0?'Proses':'Belum');await env.DB.prepare("UPDATE opd_data SET subunsurs=?, sa=?, nilai_struktur_proses=?, struktur_proses_status=? WHERE id=? AND year=?").bind(JSON.stringify(obj),sa,sa,st,params.opdId,year).run();}
            }
          }catch(err){console.warn('Metadata evidence gagal diperbarui:',err.message);}
        }
        return jsonResponse({ status: 'success' });
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
            .bind(row.id, sanitizeString(row.opd||''), sa, row.evidence||'Belum', row.qa_apip || row.qaApip || 'Belum', parseFloat(row.mri)||0, parseFloat(row.iepk)||0, row.rtp||'Belum', row.status||'Belum', JSON.stringify(subunsurs), year, JSON.stringify(kkData)).run();
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
