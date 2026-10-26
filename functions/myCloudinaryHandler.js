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
const KK_FULL_TEMPLATE_SHEET_NAMES = ['FAQ','DAFTAR KK','NAMA OPD','CHECKLIST PK','KKLEAD_SPIP','KKLEAD I','KKE 1.1 SASTRA','KKE 1.2 SASTRA OPD','KKE 2.1 SASPRO','KKE 2.2 SASKEG','KKE 2.3 SASSUBKEG','KKLEAD II','KK3.1','KK3.2','KK3.3','KK3.4','KK 4','KKLEAD III','KK 5.1 A','KK 5.1 B ','KK 5.1 C','KK 5.2','KK 6','KK 7','KK 8','Ref PCT','REF','INDIKATOR HASIL'];
const KK_PM_2026_SHEET_NAMES = ['FAQ','DAFTAR KK','NAMA OPD','KKLEAD_SPIP','KKLEAD I','KKE 1.1 SASTRA','KKE 1.2 SASTRA OPD','KKE 2.1 SASPRO','KKE 2.2 SASKEG','KKE 2.3 SASSUBKEG','KKLEAD II','KK3.1','KK3.2','KK3.3','KK3.4','KKLEAD III','KK 5.1 A','KK 5.1 B ','KK 5.1 C','KK 5.2','KK 6','KK 7','KK 8','Ref PCT','REF','INDIKATOR HASIL'];
const MAHULU_DEFAULT_OPDS = [
  'INSPEKTORAT',
  'DINAS PEKERJAAN UMUM DAN PENATAAN RUANG, PERUMAHAN DAN KAWASAN PEMUKIMAN',
  'SATUAN POLISI PAMONG PRAJA',
  'BADAN PENANGGULANGAN BENCANA DAERAH',
  'DINAS SOSIAL, PEMBERDAYAAN PEREMPUAN DAN PERLINDUNGAN ANAK',
  'DINAS KETAHANAN PANGAN DAN PERTANIAN',
  'DINAS LINGKUNGAN HIDUP',
  'DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL',
  'DINAS PEMBERDAYAAN MASYARAKAT DAN PEMERINTAHAN KAMPUNG',
  'DINAS PERHUBUNGAN',
  'DINAS KOMUNIKASI DAN INFORMATIKA, STATISTIK DAN PERSANDIAN',
  'DINAS PENANAMAN MODAL DAN PELAYANAN TERPADU SATU PINTU',
  'SEKRETARIAT DAERAH',
  'SEKRETARIAT DPRD',
  'BADAN PERENCANAAN PEMBANGUNAN, PENELITIAN DAN PENGEMBANGAN DAERAH',
  'BADAN PENDAPATAN DAERAH',
  'BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA',
  'BADAN PENGELOLA PERBATASAN DAERAH',
  'KECAMATAN LONG APARI',
  'KECAMATAN LONG PAHANGAI',
  'KECAMATAN LONG BAGUN',
  'KECAMATAN LAHAM',
  'KECAMATAN LONG HUBUNG',
  'BADAN KESATUAN BANGSA DAN POLITIK',
  'PUSKESMAS LONG BAGUN',
  'DINAS KESEHATAN, PENGENDALIAN PENDUDUK DAN KELUARGA BERENCANA',
  'DINAS PARIWISATA, PEMUDA DAN OLAHRAGA',
  'BADAN PENGELOLA KEUANGAN DAN ASET DAERAH (BPKAD)'
];
const KK_PM_EXPECTED_FORMULAS = {
  'KKLEAD_SPIP!I11':'=H16+H50+H64',
  'KKLEAD_SPIP!I68':'=F83',
  'KKLEAD_SPIP!I85':'=F104',
  'KKLEAD_SPIP!I106':"='KKLEAD II'!L35"
};


function normalizeAssessmentOrgName(value){
  return String(value?.opd||value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
}
function assessmentOrgProfile(value){
  const n=normalizeAssessmentOrgName(value);
  if(n.includes('INSPEKTORAT'))return 'INSPEKTORAT';
  if(n.includes('BPKAD')||(n.includes('PENGELOLA KEUANGAN')&&n.includes('ASET DAERAH')))return 'BPKAD';
  if(n.includes('BP4D')||n.includes('BAPPELITBANGDA')||(n.includes('BADAN PERENCANAAN PEMBANGUNAN')&&n.includes('PENELITIAN')&&n.includes('PENGEMBANGAN')))return 'BP4D';
  return 'OPD';
}
function assessmentAllowedTargets(value){
  const profile=assessmentOrgProfile(value);
  if(profile==='BPKAD')return ['T1','T2','T3'];
  if(profile==='INSPEKTORAT')return ['T1','T4'];
  return ['T1'];
}
async function assertAssessmentTargetAllowed(env,year,opdId,target){
  const code=String(target||'').toUpperCase();
  const row=(await env.DB.prepare('SELECT opd FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(String(opdId||''),String(year)).all()).results?.[0];
  if(!row)throw new Error('OPD tidak ditemukan.');
  const allowed=assessmentAllowedTargets(row.opd);
  if(!allowed.includes(code))throw new Error(`${code} tidak tersedia untuk ${row.opd}. Target yang berlaku: ${allowed.join(', ')}.`);
  return row.opd;
}
async function assertAssessmentInputEditable(env,year,opdId){
  const row=(await env.DB.prepare('SELECT opd,assessment_status FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(String(opdId||''),String(year)).all()).results?.[0];
  if(!row)throw new Error('OPD tidak ditemukan.');
  const status=String(row.assessment_status||'Belum Mengisi');
  if(status==='Proses Review'||status==='Selesai Verifikasi')throw new Error(`Input mandiri ${row.opd} terkunci karena status ${status}. Minta Inspektorat membuka kembali status pengisian sebelum mengubah data.`);
  if(status==='Belum Mengisi'){
    await env.DB.prepare("UPDATE opd_data SET assessment_status='Proses Pengisian',assessment_status_updated_at=? WHERE id=? AND year=? AND assessment_status='Belum Mengisi'").bind(Date.now(),String(opdId),String(year)).run();
  }
  return row.opd;
}
function getPmSheetProfile(sheets){
  const actual=(sheets||[]).map(sheetTitleOf);
  const match=expected=>actual.length===expected.length&&actual.every((x,i)=>x===normalizeSheetTitle(expected[i]));
  if(match(KK_PM_2026_SHEET_NAMES))return 'PM_2026';
  if(match(KK_FULL_TEMPLATE_SHEET_NAMES))return 'LEGACY_PK_28';
  return null;
}
async function readLiveKkMasterRows(env,masterKind='PK',options={}){
  const kind=String(masterKind||'PK').toUpperCase()==='PM'?'PM':'PK';
  const configuredId=extractSpreadsheetId(kind==='PM'
    ?(env.GOOGLE_SHEETS_PM_TEMPLATE_ID||'')
    :(env.GOOGLE_SHEETS_PK_MASTER_ID||env.GOOGLE_SHEETS_PK_TEMPLATE_ID||env.GOOGLE_SHEETS_TEMPLATE_ID||''));
  if(!configuredId&&kind!=='PM')return{live:false,masterKind:kind,message:'GOOGLE_SHEETS_PK_MASTER_ID belum diatur; aplikasi memakai snapshot master yang disertakan.'};
  const token=await getGoogleAccessToken(env);
  let spreadsheetId=configuredId;
  let metadata=null;
  if(kind==='PM'){
    // Never present a legacy/PK workbook as the authoritative PM source. If the configured
    // ID is stale, the resolver searches Drive for the exact, validated 26-sheet PM master.
    const resolved=await resolveKkPmTemplateSpreadsheet(env,token,configuredId);
    spreadsheetId=resolved.id;
    metadata=resolved.check?.metadata||null;
  }
  const cacheKey=`${kind}:${spreadsheetId}`;
  if(options.forceRefresh){
    LIVE_KK_MASTER_ROWS_GENERATION.set(cacheKey,(LIVE_KK_MASTER_ROWS_GENERATION.get(cacheKey)||0)+1);
    LIVE_KK_MASTER_ROWS_CACHE.delete(cacheKey);
  }
  const generation=LIVE_KK_MASTER_ROWS_GENERATION.get(cacheKey)||0;
  const now=Date.now();const cached=LIVE_KK_MASTER_ROWS_CACHE.get(cacheKey);
  if(!options.forceRefresh&&cached&&cached.expiresAt>now)return cached.payload;
  const inflight=LIVE_KK_MASTER_ROWS_PENDING.get(cacheKey);if(inflight&&!options.forceRefresh)return inflight;
  const job=(async()=>{
    if(!metadata)metadata=await getSpreadsheetMetadata(token,spreadsheetId);
    const aliases=kind==='PM'?PM_MASTER_TARGET_SHEET_ALIASES:PK_MASTER_TARGET_SHEET_ALIASES;
    const mappings=resolveMasterTargetSheetNames(metadata,aliases,kind);
    const params=new URLSearchParams();params.set('majorDimension','ROWS');params.set('valueRenderOption','FORMATTED_VALUE');
    for(const sheetName of Object.values(mappings))params.append('ranges',`'${String(sheetName).replace(/'/g,"''")}'!A1:L1000`);
    const url=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params.toString()}`;
    const response=await fetchWithRetry(url,{headers:{Authorization:`Bearer ${token}`}}, {retries:2,baseDelay:250});
    const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`Gagal membaca sumber master KK (${spreadsheetId}; tab ${Object.values(mappings).join(', ')}): `+JSON.stringify(body).slice(0,500));
    const ranges=body.valueRanges||[];const sheets={};Object.entries(mappings).forEach(([code,sheetName],i)=>{sheets[code]=Array.isArray(ranges[i]?.values)?ranges[i].values:[];});
    const payload={live:true,masterKind:kind,masterSpreadsheetId:spreadsheetId,masterProfile:kind==='PM'?'PM_2026':getPmSheetProfile(metadata.sheets||[])||'PK_MASTER',sheets,sheetNames:mappings,updatedAt:Date.now(),cacheSeconds:60};
    // An old in-flight response must not overwrite a cache populated by a newer forced refresh.
    if((LIVE_KK_MASTER_ROWS_GENERATION.get(cacheKey)||0)===generation){
      LIVE_KK_MASTER_ROWS_CACHE.set(cacheKey,{expiresAt:Date.now()+60_000,payload});
    }
    return payload;
  })();
  LIVE_KK_MASTER_ROWS_PENDING.set(cacheKey,job);
  try{return await job;}finally{if(LIVE_KK_MASTER_ROWS_PENDING.get(cacheKey)===job)LIVE_KK_MASTER_ROWS_PENDING.delete(cacheKey);}
}
async function syncPmMasterColumnsToOpdWorkbooks(env,year,options={}){
  if(String(env.GOOGLE_SHEETS_PM_AUTO_PROPAGATE||'true').toLowerCase()==='false')return {skipped:true,reason:'disabled'};
  const configuredId=extractSpreadsheetId(env.GOOGLE_SHEETS_PM_TEMPLATE_ID||'');
  const token=await getGoogleAccessToken(env);
  const resolved=await resolveKkPmTemplateSpreadsheet(env,token,configuredId);
  const masterId=resolved.id;
  const sourceMap=resolveMasterTargetSheetNames(resolved.check.metadata,PM_MASTER_TARGET_SHEET_ALIASES,'PM');
  const names=Object.values(sourceMap);
  const params=new URLSearchParams();params.set('majorDimension','ROWS');params.set('valueRenderOption','FORMULA');
  for(const sheetName of names)params.append('ranges',`'${sheetName.replace(/'/g,"''")}'!A1:L1000`);
  const sourceUrl=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(masterId)}/values:batchGet?${params.toString()}`;
  const sourceRes=await fetchWithRetry(sourceUrl,{headers:{Authorization:`Bearer ${token}`}}, {retries:2,baseDelay:300});
  const sourceBody=await sourceRes.json().catch(()=>({}));
  if(!sourceRes.ok)throw new Error('Gagal membaca formula master PM untuk propagasi: '+JSON.stringify(sourceBody).slice(0,400));
  const sourceRows={};
  Object.entries(sourceMap).forEach(([target,sheetName],i)=>{
    const raw=Array.isArray(sourceBody.valueRanges?.[i]?.values)?sourceBody.valueRanges[i].values:[];
    let last=-1;raw.forEach((row,index)=>{if(Array.isArray(row)&&row.some(v=>v!==''&&v!==null&&v!==undefined))last=index;});
    sourceRows[target]=raw.slice(0,last+1).map(row=>Array.from({length:12},(_,col)=>row?.[col]??''));
  });
  const opdRows=(await env.DB.prepare('SELECT id,opd,kk_pm_data FROM opd_data WHERE year=?').bind(String(year)).all()).results||[];
  const plans=new Map();
  for(const row of opdRows){
    let raw={};try{raw=row.kk_pm_data?JSON.parse(row.kk_pm_data):{};}catch{raw={};}
    const wb=normalizeKkPmData(raw).workbook;
    const destId=extractSpreadsheetId(wb.workbookSpreadsheetId||'');
    if(!destId||destId===masterId)continue;
    // Only write to destinations that were explicitly verified and recorded as the PM_2026
    // profile. Missing metadata is not proof of compatibility; skip instead of risking writes
    // to an old PK/legacy workbook that happens to share some tab names.
    const recordedSheets=Array.isArray(raw?.workbook?.sheets)?raw.workbook.sheets:[];
    if(getPmSheetProfile(recordedSheets)!=='PM_2026')continue;
    const allowed=assessmentAllowedTargets(row.opd);
    const knownSheets=new Set(recordedSheets.map(sheetTitleOf).filter(Boolean));
    const data=[];
    for(const target of allowed){
      const sheetName=sourceMap[target];
      const rows=sourceRows[target];
      if(rows?.length&&knownSheets.has(normalizeSheetTitle(sheetName)))data.push({range:`'${sheetName.replace(/'/g,"''")}'!A1:L${rows.length}`,values:rows});
    }
    if(!data.length)continue;
    if(!plans.has(destId))plans.set(destId,{id:destId,opds:[],data:[]});
    const plan=plans.get(destId);plan.opds.push(String(row.opd||row.id));
    for(const item of data){const ix=plan.data.findIndex(x=>x.range===item.range);if(ix<0)plan.data.push(item);}
  }
  const hashInput=JSON.stringify({sourceRows,plans:[...plans.values()].map(p=>({id:p.id,opds:p.opds.sort(),ranges:p.data.map(x=>x.range).sort()})).sort((a,b)=>a.id.localeCompare(b.id))});
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(hashInput));
  const contentHash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
  const syncKey=`kk-pm-master:${String(year)}:${masterId}`;
  const now=Date.now();
  await env.DB.prepare('INSERT OR IGNORE INTO kk_pm_master_sync_state(sync_key,content_hash,last_synced_at,lease_until,last_attempt_at,last_error) VALUES(?,?,0,0,0,\'\')').bind(syncKey,'').run();
  const acquired=options.force
    ? await env.DB.prepare('UPDATE kk_pm_master_sync_state SET lease_until=?,last_attempt_at=? WHERE sync_key=? AND lease_until<?').bind(now+180000,now,syncKey,now).run()
    : await env.DB.prepare(`UPDATE kk_pm_master_sync_state SET lease_until=?,last_attempt_at=? WHERE sync_key=? AND lease_until<? AND (content_hash<>? OR (last_error<>'' AND last_attempt_at<?))`).bind(now+180000,now,syncKey,now,contentHash,now-300000).run();
  if(!Number(acquired.meta?.changes||0))return {skipped:true,reason:'master unchanged or sync already running',workbooks:plans.size};
  let updated=0,failed=0;const errors=[];
  try{
    const jobs=[...plans.values()];
    for(let i=0;i<jobs.length;i+=4){
      const batch=jobs.slice(i,i+4);
      const results=await Promise.all(batch.map(async plan=>{
        try{
          const url=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(plan.id)}/values:batchUpdate`;
          const res=await fetchWithRetry(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({valueInputOption:'USER_ENTERED',includeValuesInResponse:false,data:plan.data})},{retries:2,baseDelay:400});
          const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(`HTTP ${res.status}: ${JSON.stringify(body).slice(0,240)}`);
          return {ok:true,id:plan.id};
        }catch(err){return {ok:false,id:plan.id,error:String(err?.message||err).slice(0,300)};}
      }));
      for(const result of results){if(result.ok)updated++;else{failed++;errors.push(`${result.id}: ${result.error}`);}}
    }
    const finished=Date.now();
    if(!failed){
      await env.DB.prepare('UPDATE kk_pm_master_sync_state SET content_hash=?,last_synced_at=?,lease_until=0,last_attempt_at=?,last_error=\'\' WHERE sync_key=?').bind(contentHash,finished,finished,syncKey).run();
    }else{
      await env.DB.prepare('UPDATE kk_pm_master_sync_state SET lease_until=0,last_attempt_at=?,last_error=? WHERE sync_key=?').bind(finished,errors.join(' | ').slice(0,1500),syncKey).run();
      console.warn('Propagasi master KK PM sebagian gagal:',errors.slice(0,5));
    }
    return {skipped:false,masterSpreadsheetId:masterId,masterSource:'validated PM_2026',workbooksUpdated:updated,workbooksFailed:failed,targets:Object.keys(sourceMap)};
  }catch(err){
    const failedAt=Date.now();
    await env.DB.prepare('UPDATE kk_pm_master_sync_state SET lease_until=0,last_attempt_at=?,last_error=? WHERE sync_key=?').bind(failedAt,String(err?.message||err).slice(0,1500),syncKey).run().catch(()=>{});
    throw err;
  }
}

function schedulePmMasterPropagation(env,year,ctx){
  const task=syncPmMasterColumnsToOpdWorkbooks(env,year).catch(err=>{console.warn('Propagasi master KK PM ke workbook OPD gagal:',err?.message||err);return null;});
  if(ctx?.waitUntil)ctx.waitUntil(task);else task.catch(()=>{});
}

async function ensureDefaultMahuluOpds(env,year){
  // Reconcile the default OPD master on every data load. Older deployments
  // may already contain a partial list; a one-time seed marker must not prevent
  // missing default OPDs from being added. Existing names are preserved.
  const seedKey=`mahulu-opds-v2:${String(year)}`;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS app_seed_state(seed_key TEXT PRIMARY KEY, created_at INTEGER NOT NULL)').run();
  const existing=(await env.DB.prepare('SELECT id,opd FROM opd_data WHERE year=?').bind(String(year)).all()).results||[];
  const existingNames=new Set(existing.map(x=>normalizeAssessmentOrgName(x.opd)));
  const seen=new Set();const unique=MAHULU_DEFAULT_OPDS.filter(name=>{const n=normalizeAssessmentOrgName(name);if(!n||seen.has(n)||existingNames.has(n))return false;seen.add(n);return true;});
  const sheets=JSON.stringify(KK_PM_2026_SHEET_NAMES);
  const stmts=unique.map(name=>{
    const slug=normalizeAssessmentOrgName(name).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,46);
    const id=`mh_${String(year).replace(/[^0-9]/g,'').slice(-4)||'year'}_${slug}`.slice(0,90);
    const workbookData=JSON.stringify({version:2,workbook:{version:1,workbookSpreadsheetId:null,workbookUrl:null,workbookName:`${name} - Kertas Kerja PM SPIP - ${year}`,templateSpreadsheetId:null,sheets:JSON.parse(sheets)},cells:{}});
    return env.DB.prepare("INSERT OR IGNORE INTO opd_data (id,opd,sa,nilai_struktur_proses,nilai_maturitas,nilai_kapabilitas_apip,evidence,qa_apip,mri,iepk,rtp,status,struktur_proses_status,subunsurs,year,kk_data,kk_pm_data,kk_rtp_data,rtp_evidence,rtp_evidence_folder) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,name,0,0,0,0,'Belum','Belum',0,0,'Belum','Belum','Belum','{}',String(year),'{}',workbookData,'{}','[]','Evidence RTP');
  });
  for(let i=0;i<stmts.length;i+=40)await env.DB.batch(stmts.slice(i,i+40));
  await env.DB.prepare('INSERT OR IGNORE INTO app_seed_state(seed_key,created_at) VALUES(?,?)').bind(seedKey,Date.now()).run();
}

let schemaReady=false;
let schemaReadyPromise=null;
const DRIVE_TOKEN_CACHE={token:null,expiresAt:0};
const DRIVE_TOKEN_PROMISE={value:null};
const DRIVE_FOLDER_CACHE=new Map();
const DRIVE_FOLDER_PROMISES=new Map();
let GOOGLE_ACTIVE=0;
const GOOGLE_QUEUE=[];
const LIVE_KK_MASTER_ROWS_CACHE=new Map();
const LIVE_KK_MASTER_ROWS_PENDING=new Map();
const LIVE_KK_MASTER_ROWS_GENERATION=new Map();
const PM_TEMPLATE_RESOLUTION_CACHE=new Map();
const PM_TEMPLATE_RESOLUTION_PENDING=new Map();
const PM_TEMPLATE_FILE_BASENAME='KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313';
const PM_MASTER_TARGET_SHEET_ALIASES={
  T1:['KK3.1','KK3.1 (OPD)','KK3.1 OPD'],
  T2:['KK3.2','KK3.2 BPKAD AKUN','KK3.2 BPKAD Akun','KK3.2 BPKAD'],
  T3:['KK3.3','KK3.3 BPKAD ASET','KK3.3 BPKAD Aset','KK3.3 BPKAD'],
  T4:['KK3.4','KK3.4 (INSPEKTORAT)','KK3.4 INSPEKTORAT','KK3.4 (Inspektorat)']
};
const PK_MASTER_TARGET_SHEET_ALIASES={
  T1:['KK3.1 OPD','KK3.1 (OPD)','KK3.1'],
  T2:['KK3.2 BPKAD AKUN','KK3.2 BPKAD Akun','KK3.2'],
  T3:['KK3.3 BPKAD ASET','KK3.3 BPKAD Aset','KK3.3'],
  T4:['KK3.4 (INSPEKTORAT)','KK3.4 INSPEKTORAT','KK3.4']
};

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

// Authentication and scoped-account helpers. Credentials stay in Cloudflare
// Secrets; only an opaque, hashed session identifier is stored in D1.
const SESSION_COOKIE_NAME = 'kawal_spip_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const VALID_ACCOUNT_ROLES = new Set(['admin','auditor','ppupd','opd','irban','bpkp']);
const SAFE_PUBLIC_ACTIONS = new Set(['authMe','login','verifyAccess','previewPublicEvidence']);
const COMMON_READ_ACTIONS = new Set([
  'getYears','getData','getPemdaSampling','getSubunsurData','getKkMasterSheetRows','getKkSheets','getRtpKkSheets',
  'getRtpEvidence','getReportFiles','getWorkbookEvidenceFiles','getKkPmSheets','getKkPmData',
  'getKkPmDataDetailed','getKkRpjmdMappings','getQaApipData','getQaApipChecklistData','getEvidenceWorkflow','previewEvidence','createEvidencePreviewLink','downloadEvidence',
  'getBpkpOfficialScore','exportKkPmWorkbook','getLheFollowups'
]);
const ADMIN_ONLY_ACTIONS = new Set([
  'addOpd','deleteOpd','addYear','deleteYear','createBackup','restoreBackup','deleteBackup',
  'deleteYear','saveAssessmentStatus','syncKkPmMasterNow','saveBpkpOfficialScore',
  'unlockBpkpOfficialScore','getBpkpOfficialScoreAdmin','getBpkpOfficialAudit',
  'listAuthUsers','createAuthUser','setAuthUserEnabled','resetAuthUserPassword'
]);
const VERIFICATION_ACTIONS = new Set([
  'saveEvidenceVerification','saveRtpEvidenceVerification','saveWorkbookEvidenceVerification','saveEvidenceWorkflowStep','verifyKkRpjmdMapping'
]);
const OPD_INPUT_ACTIONS = new Set([
  'saveSubunsur','saveField','saveRow','uploadFile','deleteFile','replaceEvidenceFile','retryDriveBackup',
  'uploadRtpEvidence','deleteRtpEvidence','replaceRtpEvidence','saveRtpEvidenceFolder',
  'uploadReportFile','deleteReportFile','deleteLheFollowup','getReportFiles','getRtpEvidence','getLheFollowups','saveLheFollowup','uploadLheEvidence','deleteLheEvidence','deleteWorkbookEvidence','getKkSheets','createKkSheets',
  'saveKkData','getRtpKkSheets','createRtpKkSheets','saveRtpKkData','getKkPmSheets','createKkPmSheets',
  'exportKkPmWorkbook','getKkPmData','getKkPmDataDetailed','saveKkPmData','saveKkPmItem','deleteKkPmItem',
  'saveKkPmMeta','saveKkRpjmdMapping','getKkRpjmdMappings','createEvidencePreviewLink','previewEvidence','getWorkbookEvidenceFiles','replaceWorkbookEvidenceFile','saveQaApipItem',
  'getQaApipData','getBpkpOfficialScore','syncKkComputedValues',
  'deleteQaApipItem','saveQaApipChecklistItem','deleteQaApipChecklistItem','getQaApipChecklistData',
  'getYears','getData','getSubunsurData','saveEvidenceWorkflowStep','getKkMasterSheetRows','getEvidenceWorkflow','downloadEvidence','previewEvidence','createEvidencePreviewLink','getLheFollowups'
]);
const AUDITOR_ALLOWED_ACTIONS = new Set([
  ...COMMON_READ_ACTIONS,...OPD_INPUT_ACTIONS,'saveEvidenceWorkflowStep','savePemdaSampling',
  'saveEvidenceVerification','saveRtpEvidenceVerification','saveWorkbookEvidenceVerification','deleteLheFollowup'
]);
// PPUPD memiliki hak operasional yang sama dengan Auditor, tetap dibatasi oleh cakupan OPD sesi.
const PPUPD_ALLOWED_ACTIONS = new Set(AUDITOR_ALLOWED_ACTIONS);
const IRBAN_ALLOWED_ACTIONS = new Set([
  ...COMMON_READ_ACTIONS,
  // Inspektorat/Irban may provision and refresh the PM workbook for an OPD in scope.
  // These two actions remain protected by the per-OPD scope check below; the role
  // is not granted general account-management or official-score finalization rights.
  'createKkPmSheets','syncKkComputedValues',
  'saveAssessmentStatus','saveEvidenceVerification','saveRtpEvidenceVerification','getPemdaSampling','savePemdaSampling',
  'saveWorkbookEvidenceVerification','saveEvidenceWorkflowStep','verifyKkRpjmdMapping','downloadEvidence','listBackups','getLheFollowups','saveLheFollowup','deleteLheFollowup','uploadLheEvidence','deleteLheEvidence'
]);
const BPKP_ALLOWED_ACTIONS = new Set([
  ...COMMON_READ_ACTIONS,'saveEvidenceWorkflowStep','getPemdaSampling','downloadEvidence','getLheFollowups','getBpkpOfficialScoreAdmin',
  'getBpkpOfficialAudit','saveBpkpOfficialScore','unlockBpkpOfficialScore'
]);
const DESTRUCTIVE_ADMIN_ACTIONS = new Set([
  'addOpd','deleteOpd','addYear','deleteYear','createBackup','restoreBackup','deleteBackup',
  'deleteBackup','deleteYear','syncKkPmMasterNow','saveAssessmentStatus','getBpkpOfficialScoreAdmin',
  'getBpkpOfficialAudit','saveBpkpOfficialScore','unlockBpkpOfficialScore','saveRow','saveData',
  'listAuthUsers','createAuthUser','setAuthUserEnabled','resetAuthUserPassword'
]);

function normalizeOrgForAuth(value){
  return normalizeAssessmentOrgName(value);
}
function parseAccountConfig(env){
  const raw=String(env.KAWAL_SPIP_USERS_JSON||'').trim();
  if(!raw)return [];
  let parsed;
  try{parsed=JSON.parse(raw);}catch{throw new Error('KAWAL_SPIP_USERS_JSON bukan JSON yang valid.');}
  if(!Array.isArray(parsed))throw new Error('KAWAL_SPIP_USERS_JSON harus berupa array akun.');
  const seen=new Set();
  return parsed.map((item,index)=>{
    if(!item||typeof item!=='object')throw new Error(`Akun ke-${index+1} tidak valid.`);
    const username=String(item.username||'').trim();
    const password=String(item.password||'');
    const role=String(item.role||'').trim().toLowerCase();
    if(!username||username.length>100||!password||password.length<12||!VALID_ACCOUNT_ROLES.has(role)){
      throw new Error(`Akun ke-${index+1} wajib memiliki username, password minimal 12 karakter, dan role yang valid.`);
    }
    const key=username.toLowerCase();
    if(seen.has(key))throw new Error(`Username duplikat pada KAWAL_SPIP_USERS_JSON: ${username}`);
    seen.add(key);
    const opdIds=[...(Array.isArray(item.opdIds)?item.opdIds:[])].map(x=>String(x||'').trim()).filter(Boolean);
    if(item.opdId)opdIds.push(String(item.opdId).trim());
    const opdNames=[...(Array.isArray(item.opdNames)?item.opdNames:[])].map(x=>String(x||'').trim()).filter(Boolean);
    if(item.opdName)opdNames.push(String(item.opdName).trim());
    if(role==='opd'&&!opdIds.length&&!opdNames.length)throw new Error(`Akun OPD ${username} wajib diikat ke opdId atau opdName.`);
    if(role==='opd'&&(opdIds.includes('*')||opdNames.includes('*')))throw new Error(`Akun OPD ${username} tidak boleh menggunakan cakupan wildcard (*).`);
    return {username,password,role,displayName:String(item.displayName||item.nama||username).trim().slice(0,120),opdIds:[...new Set(opdIds)],opdNames:[...new Set(opdNames)],enabled:item.enabled!==false};
  });
}
// Cloudflare Workers currently rejects a single WebCrypto PBKDF2 operation above 100,000 iterations.
// Keep new hashes at the supported ceiling and migrate older bootstrap hashes on a successful seed-password login.
const AUTH_PASSWORD_ITERATIONS=100000;
const AUTH_PASSWORD_MAX_ITERATIONS=100000;
function randomBase64(byteLength=16){const bytes=crypto.getRandomValues(new Uint8Array(byteLength));let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary);}
function bytesToHex(bytes){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function deriveAuthPasswordHash(password,saltBase64,iterations=AUTH_PASSWORD_ITERATIONS){
  const count=Number(iterations)||AUTH_PASSWORD_ITERATIONS;
  if(!Number.isInteger(count)||count<1||count>AUTH_PASSWORD_MAX_ITERATIONS)throw new Error(`Iterasi PBKDF2 tidak didukung pada runtime ini (maksimum ${AUTH_PASSWORD_MAX_ITERATIONS}).`);
  const saltBytes=Uint8Array.from(atob(String(saltBase64||'')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(password)),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:saltBytes,iterations:count,hash:'SHA-256'},key,256);
  return bytesToHex(bits);
}
async function makeAuthPasswordRecord(password){const salt=randomBase64(16);return {salt,hash:await deriveAuthPasswordHash(password,salt,AUTH_PASSWORD_ITERATIONS),iterations:AUTH_PASSWORD_ITERATIONS};}
function constantTimeStringEqual(a,b){a=String(a||'');b=String(b||'');let diff=a.length^b.length;const length=Math.max(a.length,b.length);for(let i=0;i<length;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
async function verifyAuthPassword(password,row){
  if(!row?.password_salt||!row?.password_hash)return false;
  const iterations=Number(row.password_iterations)||AUTH_PASSWORD_ITERATIONS;
  // Do not allow an unsupported legacy count to bubble up as an HTTP 500 during login.
  if(!Number.isInteger(iterations)||iterations<1||iterations>AUTH_PASSWORD_MAX_ITERATIONS)return false;
  const candidate=await deriveAuthPasswordHash(password,row.password_salt,iterations);
  return constantTimeStringEqual(candidate,row.password_hash);
}
function matchesConfiguredBootstrapPassword(env,row,password){
  const raw=String(env.KAWAL_SPIP_USERS_JSON||'').trim();
  if(!raw)return false;
  try{
    const accounts=JSON.parse(raw);
    if(!Array.isArray(accounts))return false;
    const account=accounts.find(item=>String(item?.username||'').trim().toLowerCase()===String(row?.username||'').trim().toLowerCase());
    return !!account&&account.enabled!==false&&String(account.role||'').trim().toLowerCase()===String(row?.role||'').trim().toLowerCase()&&String(account.password||'')===String(password||'');
  }catch{return false;}
}
async function upgradeSeededLegacyAuthPassword(env,row,password){
  const iterations=Number(row?.password_iterations)||0;
  const createdAt=Number(row?.created_at||0);
  const passwordChangedAt=Number(row?.password_changed_at||0);
  // Only migrate untouched bootstrap hashes. A password explicitly reset later by an administrator
  // must not be overwritten by an old value still present in the bootstrap secret.
  if(iterations<=AUTH_PASSWORD_MAX_ITERATIONS||!createdAt||passwordChangedAt!==createdAt||!matchesConfiguredBootstrapPassword(env,row,password))return null;
  const record=await makeAuthPasswordRecord(password);
  const now=Date.now();
  await env.DB.prepare('UPDATE auth_users SET password_salt=?,password_hash=?,password_iterations=?,updated_at=? WHERE username_key=? AND password_iterations=? AND password_changed_at=created_at')
    .bind(record.salt,record.hash,record.iterations,now,row.username_key,iterations).run();
  return await env.DB.prepare('SELECT * FROM auth_users WHERE username_key=? LIMIT 1').bind(row.username_key).first();
}
async function ensureAuthUsersSeeded(env){
  const accounts=parseAccountConfig(env);
  if(!accounts.length)return;
  const now=Date.now();
  // Seed missing JSON-managed accounts on every login/administration bootstrap, not
  // only on the very first deployment. Existing admin-created users are never changed.
  const existingRows=(await env.DB.prepare('SELECT username_key,created_by FROM auth_users').all()).results||[];
  const existingByKey=new Map(existingRows.map(row=>[String(row.username_key||''),row]));
  const inserts=[];const updates=[];
  for(const user of accounts){
    const key=user.username.toLowerCase();
    const old=existingByKey.get(key);
    if(!old){
      const pass=await makeAuthPasswordRecord(user.password);
      inserts.push(env.DB.prepare(`INSERT OR IGNORE INTO auth_users(username_key,username,display_name,role,opd_ids_json,opd_names_json,password_salt,password_hash,password_iterations,enabled,created_at,updated_at,password_changed_at,created_by,last_login_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`)
        .bind(key,user.username,user.displayName,user.role,JSON.stringify(user.opdIds||[]),JSON.stringify(user.opdNames||[]),pass.salt,pass.hash,pass.iterations,user.enabled?1:0,now,now,now,'KAWAL_SPIP_USERS_JSON'));
    }else if(String(old.created_by||'')==='KAWAL_SPIP_USERS_JSON'){
      updates.push(env.DB.prepare(`UPDATE auth_users SET username=?,display_name=?,role=?,opd_ids_json=?,opd_names_json=?,updated_at=? WHERE username_key=? AND created_by='KAWAL_SPIP_USERS_JSON'`)
        .bind(user.username,user.displayName,user.role,JSON.stringify(user.opdIds||[]),JSON.stringify(user.opdNames||[]),now,key));
      // Do not change enabled or password_hash here: an administrator may have
      // intentionally disabled the account or reset its password through the UI.
    }
  }
  for(let i=0;i<inserts.length;i+=8)await env.DB.batch(inserts.slice(i,i+8));
  for(let i=0;i<updates.length;i+=50)await env.DB.batch(updates.slice(i,i+50));
  await env.DB.prepare(`INSERT INTO auth_user_seed_state(seed_key,seeded_at,account_count)
    VALUES('KAWAL_SPIP_USERS_JSON_v1',?,?) ON CONFLICT(seed_key) DO UPDATE SET seeded_at=excluded.seeded_at,account_count=excluded.account_count`)
    .bind(now,accounts.length).run();
}
function parseJsonStringArray(value){try{const parsed=JSON.parse(value||'[]');return Array.isArray(parsed)?parsed.map(x=>String(x)):[]}catch{return []}}
async function migrateAuthOpdNameScope(env,oldName,newName){
  const oldKey=normalizeOrgForAuth(oldName);const newValue=String(newName||'').trim();if(!oldKey||!newValue||oldKey===normalizeOrgForAuth(newValue))return;
  const users=(await env.DB.prepare('SELECT username_key,opd_names_json FROM auth_users').all()).results||[];
  for(const user of users){const names=parseJsonStringArray(user.opd_names_json);let changed=false;const updated=names.map(name=>{if(name!=='*'&&normalizeOrgForAuth(name)===oldKey){changed=true;return newValue;}return name;});if(changed)await env.DB.prepare('UPDATE auth_users SET opd_names_json=?,updated_at=? WHERE username_key=?').bind(JSON.stringify(updated),Date.now(),user.username_key).run();}
  const sessions=(await env.DB.prepare('SELECT token_hash,opd_name,opd_names_json FROM auth_sessions').all()).results||[];
  for(const session of sessions){const names=parseJsonStringArray(session.opd_names_json);let changed=false;const updated=names.map(name=>{if(name!=='*'&&normalizeOrgForAuth(name)===oldKey){changed=true;return newValue;}return name;});const direct=session.opd_name&&normalizeOrgForAuth(session.opd_name)===oldKey?newValue:session.opd_name;if(changed||direct!==session.opd_name)await env.DB.prepare('UPDATE auth_sessions SET opd_name=?,opd_names_json=? WHERE token_hash=?').bind(direct,JSON.stringify(updated),session.token_hash).run();}
}
async function sha256Hex(value){
  const bytes=new TextEncoder().encode(String(value));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function cookieValue(request,name){
  const header=request.headers.get('Cookie')||'';
  for(const part of header.split(';')){
    const idx=part.indexOf('=');if(idx<0)continue;
    if(part.slice(0,idx).trim()===name)return decodeURIComponent(part.slice(idx+1).trim());
  }
  return '';
}
function sessionCookie(token,maxAge=SESSION_TTL_SECONDS){
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(0,Number(maxAge)||0)}`;
}
function publicSessionUser(session){
  if(!session)return null;
  return {username:session.username,displayName:session.display_name||session.username,role:session.role,opdId:session.opd_id||null,opdName:session.opd_name||null,scoped:Boolean((session.opdIds||[]).length||(session.opdNames||[]).length)};
}
async function readAuthSession(env,request){
  const token=cookieValue(request,SESSION_COOKIE_NAME);
  if(!token||token.length<32)return null;
  const tokenHash=await sha256Hex(token);
  // Session rows are per-device/operator, but role/scope must always be read from
  // the authoritative account row so a corrected Auditor/Irban/PPUPD scope takes
  // effect without leaving old permissions cached in other open browser sessions.
  const rec=await env.DB.prepare(`SELECT s.token_hash,s.username,
      COALESCE(u.display_name,s.display_name) AS display_name,u.role AS role,
      s.opd_id,s.opd_name,COALESCE(u.opd_ids_json,'[]') AS opd_ids_json,
      COALESCE(u.opd_names_json,'[]') AS opd_names_json,s.created_at,s.expires_at
    FROM auth_sessions s JOIN auth_users u ON u.username_key=lower(s.username)
    WHERE s.token_hash=? AND s.expires_at>? AND COALESCE(u.enabled,0)=1 LIMIT 1`)
    .bind(tokenHash,Date.now()).all();
  const row=rec.results?.[0];if(!row)return null;
  let ids=[],names=[];try{ids=JSON.parse(row.opd_ids_json||'[]')}catch{}try{names=JSON.parse(row.opd_names_json||'[]')}catch{}
  return {...row,opdIds:Array.isArray(ids)?ids:[],opdNames:Array.isArray(names)?names:[]};
}
async function createAuthSession(env,user){
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  const tokenHash=await sha256Hex(token);const now=Date.now();const expires=now+SESSION_TTL_SECONDS*1000;
  await env.DB.prepare(`INSERT INTO auth_sessions(token_hash,username,display_name,role,opd_id,opd_name,opd_ids_json,opd_names_json,created_at,expires_at,last_seen_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(tokenHash,user.username,user.displayName||user.username,user.role,user.opdIds?.length===1?user.opdIds[0]:null,user.opdNames?.length===1?user.opdNames[0]:null,JSON.stringify(user.opdIds||[]),JSON.stringify(user.opdNames||[]),now,expires,now).run();
  // Clean up expired records opportunistically to keep D1 small.
  await env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at<?').bind(now).run().catch(()=>{});
  return {token,tokenHash,session:{token_hash:tokenHash,username:user.username,display_name:user.displayName||user.username,role:user.role,opd_id:user.opdIds?.length===1?user.opdIds[0]:null,opd_name:user.opdNames?.length===1?user.opdNames[0]:null,opdIds:user.opdIds||[],opdNames:user.opdNames||[],created_at:now,expires_at:expires}};
}
function sessionHasWideScope(session){
  return session?.role==='admin'||session?.opdIds?.includes('*')||session?.opdNames?.includes('*')||(!session?.opdIds?.length&&!session?.opdNames?.length&&session?.role!=='opd');
}
function sessionCanAccessOrg(session,opdId,opdName){
  if(!session)return false;
  if(session.role==='admin'||sessionHasWideScope(session))return true;
  const id=String(opdId||'');const name=normalizeOrgForAuth(opdName);
  if(session.opdIds?.length&&!session.opdIds.includes(id))return false;
  if(session.opdNames?.length&&!session.opdNames.some(x=>x==='*'||normalizeOrgForAuth(x)===name))return false;
  return !!(session.opdIds?.length||session.opdNames?.length);
}
async function assertSessionCanAccessOpd(env,session,year,opdId){
  if(!session)throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');
  if(session.role==='admin'||sessionHasWideScope(session))return true;
  const id=String(opdId||'');
  if(!id||id==='all')throw new Error('Akun ini tidak diizinkan mengakses semua OPD.');
  const row=(await env.DB.prepare('SELECT opd FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(id,String(year)).all()).results?.[0];
  if(!row||!sessionCanAccessOrg(session,id,row.opd))throw new Error('Akses ditolak: akun ini hanya dapat membuka OPD yang ditetapkan.');
  return true;
}
function isActionAllowedForRole(session,action,params={}){
  const role=String(session?.role||'');
  if(role==='admin')return true;
  if(role==='opd'){
    if(!OPD_INPUT_ACTIONS.has(action))return false;
    if(action==='saveEvidenceWorkflowStep'&&String(params.stage||'').toLowerCase()==='opd')return true;
    if(VERIFICATION_ACTIONS.has(action)||DESTRUCTIVE_ADMIN_ACTIONS.has(action))return false;
    if(action==='saveField'&&!['evidence','qaApip','rtp','status'].includes(String(params.field||'')))return false;
    if(action==='saveRow'||action==='saveData')return false;
    return true;
  }
  if(role==='auditor'||role==='ppupd'){
    // Auditor dan PPUPD dapat mengirim serta memverifikasi evidence pada OPD dalam cakupannya.
    // Finalisasi nilai resmi BPKP dan pengelolaan akun tetap dilarang.
    const allowed=role==='ppupd'?PPUPD_ALLOWED_ACTIONS:AUDITOR_ALLOWED_ACTIONS;
    if(!allowed.has(action)||DESTRUCTIVE_ADMIN_ACTIONS.has(action))return false;
    if(action==='saveEvidenceWorkflowStep'&&String(params.stage||'').toLowerCase()!=='qa')return false;
    if(action==='savePemdaSampling')return false;
    return true;
  }
  if(role==='irban')return IRBAN_ALLOWED_ACTIONS.has(action);
  if(role==='bpkp')return BPKP_ALLOWED_ACTIONS.has(action);
  return false;
}
function privateEvidenceUrl(year,opdId,uploadId){
  const q=new URLSearchParams({action:'downloadEvidence',year:String(year),opdId:String(opdId),uploadId:String(uploadId)});
  return `/myCloudinaryHandler?${q.toString()}`;
}
async function previewSignature(env,payload){
  const secret=String(env.EVIDENCE_PREVIEW_SECRET||env.KK_MASTER_SYNC_SECRET||env.KAWAL_SPIP_SYNC_SECRET||env.GOOGLE_DRIVE_CLIENT_SECRET||'');
  if(secret.length<32)throw new Error('Preview Office memerlukan EVIDENCE_PREVIEW_SECRET minimal 32 karakter atau GOOGLE_DRIVE_CLIENT_SECRET yang valid.');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)));
  return Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');
}
function constantTimeTextEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function evidencePreviewPayload(year,opdId,uploadId,expires){return `${String(year)}|${String(opdId)}|${String(uploadId)}|${String(expires)}`;}
async function evidencePreviewStreamResponse(env,request,file,{signed=false}={}){
  const key=String(file?.r2Key||'');if(!key)return new Response('File tidak tersedia',{status:404});
  const head=await env.EVIDENCE_BUCKET.head(key);if(!head)return new Response('File tidak ditemukan',{status:404});
  const size=Math.max(0,Number(head.size||0));let offset=0,length=size,status=200,object=null;
  const range=String(request.headers.get('Range')||'').match(/^bytes=(\d*)-(\d*)$/i);
  if(range&&size>0){
    let start=range[1]===''?Math.max(0,size-Number(range[2]||0)):Number(range[1]);
    let end=range[1]===''?size-1:(range[2]===''?size-1:Number(range[2]));
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||start>=size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`,'Accept-Ranges':'bytes'}});
    end=Math.min(end,size-1);offset=start;length=end-start+1;status=206;object=await env.EVIDENCE_BUCKET.get(key,{range:{offset,length}});
  }else if(request.method!=='HEAD'){object=await env.EVIDENCE_BUCKET.get(key);}
  const contentType=String(file.fileType||head.httpMetadata?.contentType||'application/octet-stream').split(';')[0].trim().toLowerCase();
  const name=String(file.fileName||'evidence').replace(/[\r\n"\\]/g,'_').slice(0,180)||'evidence';
  const headers=new Headers({'Content-Type':contentType,'Content-Disposition':`inline; filename="${name.replace(/[^\x20-\x7E]/g,'_')}"`,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});
  if(size)headers.set('Content-Length',String(length));if(status===206)headers.set('Content-Range',`bytes ${offset}-${offset+length-1}/${size}`);
  if(signed){headers.set('Access-Control-Allow-Origin','*');headers.set('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');headers.set('Access-Control-Allow-Headers','Range, Content-Type');headers.set('Access-Control-Expose-Headers','Content-Length, Content-Range, Accept-Ranges');}
  else{headers.set('Referrer-Policy','no-referrer');headers.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'self'; sandbox");}
  if(head.httpEtag)headers.set('ETag',head.httpEtag);
  return new Response(request.method==='HEAD'?null:object?.body||null,{status,headers});
}
async function assertUploadBelongsToOpd(env,year,opdId,uploadId){
  const id=String(opdId||''),uid=String(uploadId||'');
  if(!id||!uid)throw new Error('Identitas OPD dan file wajib lengkap.');
  const r=await env.DB.prepare('SELECT r2_key,file_name,file_type FROM opd_workbook_evidence_items WHERE upload_id=? AND year=? AND opd_id=? LIMIT 1').bind(uid,String(year),id).all();
  if(r.results?.[0]&&String(r.results[0].r2_key||'').trim())return {r2Key:r.results[0].r2_key,fileName:r.results[0].file_name,fileType:r.results[0].file_type};
  const reg=await env.DB.prepare('SELECT r2_key FROM evidence_upload_registry WHERE upload_id=? AND year=? AND opd_id=? LIMIT 1').bind(uid,String(year),id).all();
  if(reg.results?.[0]){
    const row=(await env.DB.prepare('SELECT subunsurs,rtp_evidence,pm_spip_reports,rr_rtp_reports FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(id,String(year)).all()).results?.[0];
    let sub={},rtp=[],pm=[],rr=[];try{sub=JSON.parse(row?.subunsurs||'{}')}catch{}try{rtp=JSON.parse(row?.rtp_evidence||'[]')}catch{}try{pm=JSON.parse(row?.pm_spip_reports||'[]')}catch{}try{rr=JSON.parse(row?.rr_rtp_reports||'[]')}catch{}
    let file=null;for(const group of Object.values(sub||{}))for(const param of Object.values(group||{}))for(let lv=1;lv<=5;lv++){const arr=param?.['files'+lv];if(Array.isArray(arr)){file=arr.find(x=>x&&String(x.uploadId||'')===uid)||file;}}
    file=file||[...(rtp||[]),...(pm||[]),...(rr||[])].find(x=>x&&String(x.uploadId||'')===uid)||null;
    return {r2Key:reg.results[0].r2_key||file?.r2Key||null,fileName:file?.fileName||'evidence',fileType:file?.fileType||'application/octet-stream'};
  }
  const row=(await env.DB.prepare('SELECT rtp_evidence,pm_spip_reports,rr_rtp_reports,subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(id,String(year)).all()).results?.[0];
  if(row){let all=[];for(const key of ['rtp_evidence','pm_spip_reports','rr_rtp_reports','subunsurs']){let value;try{value=JSON.parse(row[key]|| (key==='subunsurs'?'{}':'[]'))}catch{value=key==='subunsurs'?{}:[];}if(key==='subunsurs'){for(const group of Object.values(value||{}))for(const param of Object.values(group||{}))for(let lv=1;lv<=5;lv++){const arr=param?.['files'+lv];if(Array.isArray(arr))all.push(...arr);}}else if(Array.isArray(value))all.push(...value);}
    const file=all.find(x=>x&&typeof x==='object'&&String(x.uploadId||'')===uid);
    if(file)return {r2Key:file.r2Key||null,fileName:file.fileName||'evidence',fileType:file.fileType||'application/octet-stream'};
  }
  const lheRows=await env.DB.prepare('SELECT evidence_json FROM lhe_followup_items WHERE year=? AND opd_id=?').bind(String(year),id).all();
  for(const record of (lheRows.results||[])){let list=[];try{list=JSON.parse(record.evidence_json||'[]')}catch{};const file=(Array.isArray(list)?list:[]).find(x=>x&&String(x.uploadId||'')===uid);if(file)return {r2Key:file.r2Key||null,fileName:file.fileName||'bukti-tindak-lanjut',fileType:file.fileType||'application/octet-stream',sourceType:'lhe_evidence',followupId:record.id};}
  throw new Error('File tidak ditemukan pada OPD/tahun tersebut.');
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
    const adds=[['nilai_struktur_proses','REAL NOT NULL DEFAULT 0'],['nilai_maturitas','REAL NOT NULL DEFAULT 0'],['nilai_kapabilitas_apip','REAL NOT NULL DEFAULT 0'],['computed_workbook_data',"TEXT NOT NULL DEFAULT '{}'"],['kk_pm_data',"TEXT NOT NULL DEFAULT '{}'"],['kk_rtp_data',"TEXT NOT NULL DEFAULT '{}'"],['rtp_evidence',"TEXT NOT NULL DEFAULT '[]'"],['rtp_evidence_folder',"TEXT NOT NULL DEFAULT 'Evidence RTP'"],['rtp_evidence_folder_id',"TEXT NOT NULL DEFAULT ''"],['pm_spip_reports',"TEXT NOT NULL DEFAULT '[]'"],['pm_spip_folder',"TEXT NOT NULL DEFAULT 'Laporan Hasil PM SPIP'"],['pm_spip_folder_id',"TEXT NOT NULL DEFAULT ''"],['rr_rtp_reports',"TEXT NOT NULL DEFAULT '[]'"],['rr_rtp_folder',"TEXT NOT NULL DEFAULT 'Laporan Pemantauan RR_RTP'"],['rr_rtp_folder_id',"TEXT NOT NULL DEFAULT ''"],['struktur_proses_status',"TEXT NOT NULL DEFAULT 'Belum'"],['assessment_status',"TEXT NOT NULL DEFAULT 'Belum Mengisi'"],['assessment_status_updated_at','INTEGER NOT NULL DEFAULT 0']];
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
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_assessment_status ON opd_data(year, assessment_status)").run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY, username TEXT NOT NULL, display_name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL,
      opd_id TEXT, opd_name TEXT, opd_ids_json TEXT NOT NULL DEFAULT '[]', opd_names_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at)").run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_users (
      username_key TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL,
      opd_ids_json TEXT NOT NULL DEFAULT '[]', opd_names_json TEXT NOT NULL DEFAULT '[]',
      password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, password_iterations INTEGER NOT NULL DEFAULT 100000,
      enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      password_changed_at INTEGER NOT NULL, created_by TEXT NOT NULL DEFAULT '', last_login_at INTEGER
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_auth_users_enabled_role ON auth_users(enabled,role)").run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_user_seed_state (
      seed_key TEXT PRIMARY KEY, seeded_at INTEGER NOT NULL, account_count INTEGER NOT NULL DEFAULT 0
    )`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS evidence_verification_steps (
      year TEXT NOT NULL, opd_id TEXT NOT NULL, upload_id TEXT NOT NULL, stage TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'menunggu', examiner_name TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(year,opd_id,upload_id,stage)
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_evidence_workflow_lookup ON evidence_verification_steps(year,opd_id,upload_id)").run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS evidence_verification_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, year TEXT NOT NULL, opd_id TEXT NOT NULL, upload_id TEXT NOT NULL,
      stage TEXT NOT NULL, status TEXT NOT NULL, examiner_name TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_evidence_workflow_audit ON evidence_verification_audit(year,opd_id,upload_id,created_at)").run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS pemda_opd_sampling (year TEXT NOT NULL, opd_id TEXT NOT NULL, selected INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', selected_by TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(year,opd_id))`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_pemda_sampling_year_selected ON pemda_opd_sampling(year,selected)").run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS lhe_followup_items (
      id TEXT PRIMARY KEY, year TEXT NOT NULL, opd_id TEXT NOT NULL, source_year TEXT NOT NULL DEFAULT '',
      recommendation_ref TEXT NOT NULL DEFAULT '', recommendation TEXT NOT NULL DEFAULT '', action_plan TEXT NOT NULL DEFAULT '',
      indicator TEXT NOT NULL DEFAULT '', evidence_required TEXT NOT NULL DEFAULT '', pic TEXT NOT NULL DEFAULT '', due_date TEXT NOT NULL DEFAULT '', actual_action TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Belum diverifikasi', evidence_json TEXT NOT NULL DEFAULT '[]',
      verification_status TEXT NOT NULL DEFAULT 'Belum diverifikasi', verifier_name TEXT NOT NULL DEFAULT '', verifier_note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
    )`).run();
    const lheColsInfo=await env.DB.prepare("PRAGMA table_info(lhe_followup_items)").all();
    const lheCols=new Set((lheColsInfo.results||[]).map(x=>x.name));
    if(!lheCols.has('evidence_required'))await env.DB.prepare("ALTER TABLE lhe_followup_items ADD COLUMN evidence_required TEXT NOT NULL DEFAULT ''").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_lhe_followup_opd ON lhe_followup_items(year,opd_id,source_year,status)").run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bpkp_official_scores (
      year TEXT PRIMARY KEY,
      spip REAL NOT NULL,
      mri REAL NOT NULL,
      iepk REAL NOT NULL,
      apip INTEGER NOT NULL,
      finalized INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT ''
    )`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bpkp_official_score_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      updated_by TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT 0
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_bpkp_score_audit_year ON bpkp_official_score_audit(year, created_at)").run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS kk_pm_master_sync_state (
      sync_key TEXT PRIMARY KEY, content_hash TEXT NOT NULL DEFAULT '', last_synced_at INTEGER NOT NULL DEFAULT 0,
      lease_until INTEGER NOT NULL DEFAULT 0, last_attempt_at INTEGER NOT NULL DEFAULT 0, last_error TEXT NOT NULL DEFAULT ''
    )`).run();
    // Distributed lock per OPD/year: independent Cloudflare isolates and accounts
    // must not create two Google Sheets copies at the same time.
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS kk_pm_workbook_sync_locks (
      lock_key TEXT PRIMARY KEY, lease_until INTEGER NOT NULL DEFAULT 0,
      owner_token TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL DEFAULT 0
    )`).run();

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

    const registryInfo = await env.DB.prepare("PRAGMA table_info(evidence_upload_registry)").all();
    const registryCols = new Set((registryInfo.results || []).map(c => String(c.name)));
    const workbookRegistryCols = [
      ['evidence_key', "TEXT NOT NULL DEFAULT ''"],
      ['source_model', "TEXT NOT NULL DEFAULT 'legacy'"],
      ['target_code', "TEXT NOT NULL DEFAULT ''"],
      ['grade', "TEXT NOT NULL DEFAULT ''"]
    ];
    for (const [colName, colType] of workbookRegistryCols) {
      if (!registryCols.has(colName)) await env.DB.prepare(`ALTER TABLE evidence_upload_registry ADD COLUMN ${colName} ${colType}`).run();
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

    // Legacy 10-item checklist table retained only for backward compatibility.
    // The active QA APIP UI uses opd_qa_apip_items with 671 template-aligned items.
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS opd_qa_apip_checklist_items (
      year TEXT NOT NULL,
      opd_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      checklist TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      examiner_name TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(year, opd_id, item_id)
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_qa_apip_checklist_opd ON opd_qa_apip_checklist_items(year, opd_id)").run();

    // Legacy sparse PM table retained for backward compatibility; the active KK PM workpaper
    // uses opd_kk_pm_workpaper_items below so concurrent operators update individual parameters.
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

    // Workbook-shaped KK PM SPIP (KK3.1–KK3.4): one record per OPD/year/target/parameter.
    // This is deliberately separate from the legacy 671-item table so existing data
    // and APIs remain backward compatible while the new workpaper can be edited by
    // many operators without whole-JSON overwrites.
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS opd_kk_pm_workpaper_items (
      year TEXT NOT NULL,
      opd_id TEXT NOT NULL,
      target TEXT NOT NULL,
      subunsur TEXT NOT NULL,
      param_id TEXT NOT NULL,
      hasil_pengujian TEXT NOT NULL DEFAULT '',
      grade_result TEXT NOT NULL DEFAULT '',
      aoi_cluster TEXT NOT NULL DEFAULT '',
      aoi_desc TEXT NOT NULL DEFAULT '',
      cause_cluster TEXT NOT NULL DEFAULT '',
      cause_desc TEXT NOT NULL DEFAULT '',
      conclusion TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(year, opd_id, target, subunsur, param_id)
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_kk_pm_wp_opd ON opd_kk_pm_workpaper_items(year, opd_id)").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_kk_pm_wp_target ON opd_kk_pm_workpaper_items(year, opd_id, target)").run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS opd_kk_pm_meta (
      year TEXT NOT NULL,
      opd_id TEXT NOT NULL,
      target TEXT NOT NULL,
      sector_focus TEXT NOT NULL DEFAULT '',
      prepared_by TEXT NOT NULL DEFAULT '',
      prepared_date TEXT NOT NULL DEFAULT '',
      reviewed_by TEXT NOT NULL DEFAULT '',
      reviewed_date TEXT NOT NULL DEFAULT '',
      approved_by TEXT NOT NULL DEFAULT '',
      approved_date TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(year, opd_id, target)
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_kk_pm_meta_opd ON opd_kk_pm_meta(year, opd_id)").run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS opd_kk_rpjmd_mapping (
      year TEXT NOT NULL, opd_id TEXT NOT NULL, workpaper_code TEXT NOT NULL,
      goal_codes_json TEXT NOT NULL DEFAULT '[]', rationale TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Belum Diajukan', submitted_by TEXT NOT NULL DEFAULT '',
      verifier_name TEXT NOT NULL DEFAULT '', verifier_note TEXT NOT NULL DEFAULT '',
      verified_at INTEGER, updated_by TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(year,opd_id,workpaper_code)
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_opd_kk_rpjmd_mapping_lookup ON opd_kk_rpjmd_mapping(year,opd_id)").run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS opd_kk_rpjmd_mapping_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, year TEXT NOT NULL, opd_id TEXT NOT NULL,
      workpaper_code TEXT NOT NULL, status TEXT NOT NULL, verifier_name TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
    )`).run();

    // Workbook-aligned Evidence Struktur & Proses. The same evidenceKey is stored once
    // when KK3.1-KK3.4 share identical parameter content; target labels are metadata.
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS opd_workbook_evidence_items (
      upload_id TEXT PRIMARY KEY,
      year TEXT NOT NULL,
      opd_id TEXT NOT NULL,
      evidence_key TEXT NOT NULL,
      target_code TEXT NOT NULL DEFAULT '',
      subunsur TEXT NOT NULL DEFAULT '',
      param_id TEXT NOT NULL DEFAULT '',
      grade TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL DEFAULT 0,
      file_name TEXT NOT NULL DEFAULT '',
      file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      r2_key TEXT,
      gdrive_id TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      sync_error TEXT,
      verification_status TEXT NOT NULL DEFAULT '',
      verification_examiner TEXT NOT NULL DEFAULT '',
      verification_note TEXT NOT NULL DEFAULT '',
      verification_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    )`).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_wbe_location ON opd_workbook_evidence_items(year,opd_id,evidence_key,grade)").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_wbe_opd ON opd_workbook_evidence_items(year,opd_id,updated_at)").run();
    // Lookup index for QA APIP's exact linkage: OPD/year + subunsur + parameter + grade + T1-T4.
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_wbe_qa_lookup ON opd_workbook_evidence_items(year,opd_id,subunsur,param_id,grade,target_code,created_at)").run();

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
  const raw=String(value||'').trim().toLowerCase();
  const status=raw.replace(/[\s-]+/g,'_');
  const normalized=({diterima_dengan_catatan:'diterima_catatan','accepted':'diterima','returned':'dikembalikan'})[status]||status;
  return VERIFICATION_STATUS_SET.has(normalized)?normalized:'';
}

const VERIFICATION_WEIGHTS_SERVER = Object.freeze({diterima:1, diterima_catatan:0.75, dikembalikan:0, '':0});
function sanitizeVerificationField(value,maxLength){
  return String(value ?? '').replace(/[<>`\\]/g,'').trim().substring(0,maxLength);
}
function normalizeVerificationRecord(raw){
  const v=raw && typeof raw==='object' ? raw : {};
  const status=normalizeVerificationStatus(v.status ?? v.verificationStatus ?? v.verification_status ?? v.hasilVerifikasi ?? '');
  return {
    examinerName:sanitizeVerificationField(v.examinerName ?? v.namaPemeriksa ?? v.verificationExaminer,100),
    note:sanitizeVerificationField(v.note ?? v.catatanPemeriksa ?? v.verificationNote,1000),
    status,
    verifiedAt:v.verifiedAt || v.verificationAt || v.verification_at || null,
    updatedAt:v.updatedAt || v.updated_at || null
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
    fields: 'id,name,mimeType,parents,webViewLink,modifiedTime,md5Checksum,trashed'
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

function normalizeKkPmData(raw){
  let data=raw; if(typeof data==='string'){try{data=JSON.parse(data)}catch{data={}}}
  if(!data||typeof data!=='object')data={};
  const wb=data.workbook&&typeof data.workbook==='object'?data.workbook:{};
  // Preserve template lineage/revision fields through every normalization pass. Dropping
  // these fields made a valid workbook look stale forever and generated a new copy at each sync.
  return {version:3,workbook:{version:3,workbookSpreadsheetId:wb.workbookSpreadsheetId||null,workbookUrl:wb.workbookUrl||null,workbookName:wb.workbookName||null,templateSpreadsheetId:wb.templateSpreadsheetId||null,templateModifiedTime:wb.templateModifiedTime||null,templateRevision:wb.templateRevision||null,syncDisposition:wb.syncDisposition||null,previousWorkbookSpreadsheetId:wb.previousWorkbookSpreadsheetId||null,sheets:Array.isArray(wb.sheets)?wb.sheets:KK_PM_2026_SHEET_NAMES},cells:data.cells&&typeof data.cells==='object'?data.cells:{}};
}
async function ensureKkPmSpreadsheet(env,params){
  if(!env.GOOGLE_DRIVE_CLIENT_ID||!env.GOOGLE_DRIVE_CLIENT_SECRET||!env.GOOGLE_DRIVE_REFRESH_TOKEN)throw new Error('Google OAuth untuk Spreadsheet PM belum dikonfigurasi. Periksa GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, dan GOOGLE_DRIVE_REFRESH_TOKEN.');
  const accessToken=await getGoogleAccessToken(env);
  const yearValue=String(params.year||new Date().getFullYear());
  const opdName=safeDriveName(params.opd||'OPD Baru');
  const current=normalizeKkPmData(params.currentKkPmData).workbook;

  // Resolve the canonical master BEFORE accepting a linked workbook. A workbook can have
  // 26 correct tabs and still be stale because it was copied from an earlier master.
  const resolvedTemplate=await resolveKkPmTemplateSpreadsheet(env,accessToken,extractSpreadsheetId(env.GOOGLE_SHEETS_PM_TEMPLATE_ID||''),{forceRefresh:true});
  const templateId=String(resolvedTemplate.id||'');
  const templateFile=resolvedTemplate.file||{};
  const templateModifiedTime=String(templateFile.modifiedTime||'');
  const templateRevision=templateModifiedTime || await (async()=>{
    // Google Drive normally supplies modifiedTime. Use a stable fallback if a proxy omits it.
    const signature=JSON.stringify({id:templateId,sheets:(resolvedTemplate.check?.metadata?.sheets||[]).map(x=>sheetTitleOf(x)),formulas:resolvedTemplate.check?.formulas||KK_PM_EXPECTED_FORMULAS});
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature));
    return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
  })();
  if(!templateId)throw new Error('Master PM terbaru tidak memiliki ID Spreadsheet. Sinkronisasi dihentikan agar workbook lama tidak terus ditautkan.');
  if(!env.GOOGLE_DRIVE_FOLDER_ID)throw new Error('GOOGLE_DRIVE_FOLDER_ID belum dikonfigurasi; master PM sudah valid, tetapi folder tujuan Google Drive belum tersedia.');

  let currentProfile=null,currentFile=null,currentWorkbookUsable=false;
  if(current.workbookSpreadsheetId){
    try{
      const check=await validateKkPmSpreadsheet(accessToken,current.workbookSpreadsheetId,{checkFormulas:false});
      currentProfile=check.profile;
      currentFile=await getDriveFile(accessToken,current.workbookSpreadsheetId);
      currentWorkbookUsable=Boolean(check.ok&&check.profile==='PM_2026'&&currentFile&&!currentFile.trashed&&currentFile.mimeType==='application/vnd.google-apps.spreadsheet');
    }catch(err){
      console.warn('Workbook PM tertaut tidak lolos pemeriksaan; akan dibuat ulang dari master kanonis tanpa menghapus file lama:',String(err?.message||err).slice(0,240));
    }
  }
  const sameTemplate=String(current.templateSpreadsheetId||'')===templateId;
  const sameRevision=String(current.templateRevision||current.templateModifiedTime||'')===String(templateRevision);
  if(currentWorkbookUsable&&sameTemplate&&sameRevision){
    return {
      version:3,templateSpreadsheetId:templateId,templateModifiedTime,templateRevision,
      workbookSpreadsheetId:String(current.workbookSpreadsheetId),
      workbookUrl:current.workbookUrl||currentFile.webViewLink||`https://docs.google.com/spreadsheets/d/${encodeURIComponent(current.workbookSpreadsheetId)}/edit`,
      workbookName:current.workbookName||currentFile.name||`${opdName} - Kertas Kerja PM SPIP - ${yearValue}`,
      sheets:(current.sheets&&current.sheets.length)?current.sheets:KK_PM_2026_SHEET_NAMES,
      syncDisposition:'reused',previousWorkbookSpreadsheetId:null
    };
  }

  const root=await getOrCreateFolder(accessToken,env.GOOGLE_DRIVE_FOLDER_ID,'Kertas Kerja Spreadsheet');
  const yearFolder=await getOrCreateFolder(accessToken,root,String(yearValue));
  const opdFolder=await getOrCreateFolder(accessToken,yearFolder,opdName);
  const pmFolder=await getOrCreateFolder(accessToken,opdFolder,'Kertas Kerja PM SPIP');
  const workbookName=`${opdName} - Kertas Kerja PM SPIP - ${yearValue}`;
  const copied=await copyDriveFile(accessToken,templateId,workbookName,pmFolder);
  const copiedCheck=await validateKkPmSpreadsheet(accessToken,copied.id,{checkFormulas:true});
  if(!copiedCheck.ok||copiedCheck.profile!=='PM_2026'){
    // The unvalidated copy is NOT linked. Keep the old workbook and D1 data untouched.
    throw new Error('Salinan Spreadsheet PM baru gagal validasi struktur/formula 26 sheet. Workbook lama tetap tertaut; periksa template sumber dan izin Google Drive sebelum mencoba lagi.');
  }
  return {
    version:3,templateSpreadsheetId:templateId,templateModifiedTime,templateRevision,
    workbookSpreadsheetId:copied.id,
    workbookUrl:copied.webViewLink||`https://docs.google.com/spreadsheets/d/${encodeURIComponent(copied.id)}/edit`,
    workbookName:copied.name||workbookName,sheets:KK_PM_2026_SHEET_NAMES,
    syncDisposition:'created',previousWorkbookSpreadsheetId:current.workbookSpreadsheetId||null,
    previousWorkbookProfile:currentProfile||null,previousTemplateSpreadsheetId:current.templateSpreadsheetId||null
  };
}
async function getSpreadsheetMetadata(accessToken,spreadsheetId){
  const url=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties(title),sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))`;
  const res=await fetchWithRetry(url,{headers:{Authorization:`Bearer ${accessToken}`}}, {retries:3,baseDelay:400}); const body=await res.json().catch(()=>({})); if(!res.ok)throw new Error('Gagal membaca metadata workbook: '+JSON.stringify(body));
  return body;
}

function normalizeSheetTitle(title){return String(title||'').trim().replace(/\s+/g,' ');}
function sheetTitleOf(sheet){return normalizeSheetTitle(typeof sheet==='string'?sheet:(sheet?.properties?.title||sheet?.title||''));}
function normalizeDriveTemplateTitle(title){
  return String(title||'').trim().replace(/\.(xlsx|xls|ods)$/i,'').replace(/^copy of\s+/i,'').replace(/\s*\(\d+\)$/,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
}
function resolveMasterTargetSheetNames(metadata,aliases,kind='master'){
  const available=(metadata?.sheets||[]).map(s=>normalizeSheetTitle(s.properties?.title||s.title)).filter(Boolean);
  const lookup=new Map(available.map(title=>[title.toLocaleUpperCase('en-US'),title]));
  const result={};const missing=[];
  for(const [target,options] of Object.entries(aliases||{})){
    const found=(options||[]).map(normalizeSheetTitle).map(title=>lookup.get(title.toLocaleUpperCase('en-US'))).find(Boolean);
    if(found)result[target]=found;else missing.push(`${target} (${(options||[]).join(' / ')})`);
  }
  if(missing.length)throw new Error(`Tab sumber master ${kind} tidak ditemukan: ${missing.join('; ')}. Tab yang tersedia: ${available.slice(0,40).join(' | ')||'(metadata kosong)'}. Periksa ID Google Sheets dan nama tab master.`);
  return result;
}
async function listPmTemplateCandidates(accessToken){
  const basename=PM_TEMPLATE_FILE_BASENAME;
  const expected=normalizeDriveTemplateTitle(basename);
  const queries=[`name contains '${basename}'`,`name contains 'LENGKAP2313'`];
  const found=new Map();const errors=[];
  for(const nameClause of queries){
    const query=`mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and ${nameClause}`;
    const qs=new URLSearchParams({q:query,pageSize:'100',orderBy:'modifiedTime desc',fields:'files(id,name,mimeType,modifiedTime,webViewLink,trashed),nextPageToken',supportsAllDrives:'true',includeItemsFromAllDrives:'true',corpora:'allDrives'});
    try{
      const response=await fetchWithRetry(`https://www.googleapis.com/drive/v3/files?${qs.toString()}`,{headers:{Authorization:`Bearer ${accessToken}`}}, {retries:2,baseDelay:300});
      const body=await response.json().catch(()=>({}));
      if(!response.ok){errors.push(`Drive search HTTP ${response.status}`);continue;}
      for(const file of (body.files||[])){
        if(!file?.id||file.trashed||file.mimeType!=='application/vnd.google-apps.spreadsheet')continue;
        const normalized=normalizeDriveTemplateTitle(file.name);
        // Accept the canonical name, Drive duplicate suffixes (normalized away above), and
        // a small allowlist of explicit release suffixes. Do not accept arbitrary prefix matches
        // such as "...LENGKAP2313 BACKUP LAMA" because those can outrank the real master by date.
        const suffix=normalized.startsWith(expected)?normalized.slice(expected.length):'';
        const explicitReleaseSuffix=/^(?:BARU|MASTERBARU|MASTERTERBARU|TERBARU|LATEST|UPDATED|REV(?:ISI)?\d*|V\d+|VERSI\d+)$/i.test(suffix);
        if(normalized!==expected&&!explicitReleaseSuffix)continue;
        found.set(file.id,file);
      }
      if(found.size)break;
    }catch(err){errors.push(String(err?.message||err).slice(0,120));}
  }
  const candidates=[...found.values()].sort((a,b)=>String(b.modifiedTime||'').localeCompare(String(a.modifiedTime||'')));
  return {candidates,searchError:errors.join('; ')};
}
async function resolveKkPmTemplateSpreadsheet(env,accessToken,configuredId='',options={}){
  const configured=extractSpreadsheetId(configuredId||env.GOOGLE_SHEETS_PM_TEMPLATE_ID||'');
  const cacheKey=configured||'(unset)';const now=Date.now();
  if(options.forceRefresh)PM_TEMPLATE_RESOLUTION_CACHE.delete(cacheKey);
  const cached=PM_TEMPLATE_RESOLUTION_CACHE.get(cacheKey);
  if(!options.forceRefresh&&cached&&cached.expiresAt>now)return cached.value;
  const pending=PM_TEMPLATE_RESOLUTION_PENDING.get(cacheKey);if(pending)return pending;
  const job=(async()=>{
    let configuredProblem='';let configuredValue=null;
    if(configured){
      try{
        const file=await getDriveFile(accessToken,configured);
        if(file&&!file.trashed&&file.mimeType==='application/vnd.google-apps.spreadsheet'){
          const check=await validateKkPmSpreadsheet(accessToken,configured,{checkFormulas:true});
          if(check.ok&&check.profile==='PM_2026')configuredValue={id:configured,file,check,source:'configured'};
          else{
            const actual=(check.metadata?.sheets||[]).map(x=>normalizeSheetTitle(x.properties?.title||x.title));
            const profile=check.profile==='LEGACY_PK_28'?'master konfigurasi adalah workbook legacy 28 tab':`master konfigurasi memiliki ${actual.length} tab, sedangkan PM terbaru memerlukan 26 tab`;
            const formula=check.formulaOk?'':`; formula inti tidak sesuai: ${(check.formulaMismatches||[]).map(x=>`${x.cell}=${x.actual||'(kosong)'}`).join(', ')}`;
            configuredProblem=`ID ${configured}: ${profile}${formula}.`;
          }
        }else configuredProblem=`ID ${configured} tidak ditemukan, sudah dihapus, atau bukan Google Sheets.`;
      }catch(err){configuredProblem=`ID ${configured} gagal divalidasi: ${String(err?.message||err).slice(0,240)}.`;}
    }else configuredProblem='GOOGLE_SHEETS_PM_TEMPLATE_ID belum diatur.';

    // Never assume an explicitly configured but old 26-tab file is the newest master.
    // Compare it with valid canonical-name candidates; the newest Drive modifiedTime wins.
    // If a candidate search fails, an independently validated configured ID remains usable.
    const discovery=await listPmTemplateCandidates(accessToken);
    let discoveredValue=null;
    for(const candidate of discovery.candidates){
      if(configuredValue&&String(candidate.id)===String(configuredValue.id))continue;
      try{
        const check=await validateKkPmSpreadsheet(accessToken,candidate.id,{checkFormulas:true});
        if(!check.ok||check.profile!=='PM_2026')continue;
        discoveredValue={id:candidate.id,file:candidate,check,source:'drive-discovery',configuredProblem};
        break; // candidates are sorted newest-first
      }catch(err){console.warn('Kandidat master PM dilewati karena validasi gagal:',candidate.name,String(err?.message||err).slice(0,180));}
    }
    if(configuredValue){
      const configuredTime=Date.parse(configuredValue.file?.modifiedTime||'')||0;
      const discoveredTime=Date.parse(discoveredValue?.file?.modifiedTime||'')||0;
      if(discoveredValue&&discoveredTime>configuredTime){
        PM_TEMPLATE_RESOLUTION_CACHE.set(cacheKey,{expiresAt:Date.now()+60_000,value:discoveredValue});
        console.warn('Master PM kanonis yang lebih baru dipilih menggantikan ID konfigurasi lama:',discoveredValue.file.name,'(',discoveredValue.id,')');
        return discoveredValue;
      }
      PM_TEMPLATE_RESOLUTION_CACHE.set(cacheKey,{expiresAt:Date.now()+60_000,value:configuredValue});
      return configuredValue;
    }
    if(discoveredValue){
      PM_TEMPLATE_RESOLUTION_CACHE.set(cacheKey,{expiresAt:Date.now()+60_000,value:discoveredValue});
      console.warn('Master PM valid ditemukan otomatis di Google Drive:',discoveredValue.file.name,'(',discoveredValue.id,')');
      return discoveredValue;
    }
    const searchDetail=discovery.searchError?` Pencarian Drive: ${discovery.searchError}.`:'';
    throw new Error(`Master PM terbaru belum dapat ditemukan dan divalidasi. ${configuredProblem} Sistem sudah mencari Google Sheets bernama “${PM_TEMPLATE_FILE_BASENAME}” dan variasi namanya, tetapi tidak menemukan sumber PM_2026 yang valid.${searchDetail} Pastikan master baru sudah diimpor sebagai Google Sheets, memiliki 26 tab beserta formula KKLEAD_SPIP!I11/I68/I85/I106, dan akun OAuth memiliki izin membacanya. Workbook OPD lama tidak dihapus, diubah, atau ditimpa.`);
  })();
  PM_TEMPLATE_RESOLUTION_PENDING.set(cacheKey,job);
  try{return await job;}finally{if(PM_TEMPLATE_RESOLUTION_PENDING.get(cacheKey)===job)PM_TEMPLATE_RESOLUTION_PENDING.delete(cacheKey);}
}
function expectedPmSheetOrderMatches(sheets){ return Boolean(getPmSheetProfile(sheets)); }
async function getSpreadsheetFormulaValues(accessToken,spreadsheetId){
  const qs=Object.keys(KK_PM_EXPECTED_FORMULAS).map(r=>`ranges=${encodeURIComponent(r)}`).join('&');
  const url=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${qs}&valueRenderOption=FORMULA`;
  const res=await fetchWithRetry(url,{headers:{Authorization:`Bearer ${accessToken}`}}, {retries:3,baseDelay:350});
  const body=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(`Gagal memeriksa formula workbook: ${JSON.stringify(body)}`);
  const ranges=body.valueRanges||[];
  const out={}; Object.keys(KK_PM_EXPECTED_FORMULAS).forEach((r,i)=>{out[r]=ranges[i]?.values?.[0]?.[0]??null;}); return out;
}
async function validateKkPmSpreadsheet(accessToken,spreadsheetId,{checkFormulas=true}={}){
  const meta=await getSpreadsheetMetadata(accessToken,spreadsheetId);
  const shapeOk=expectedPmSheetOrderMatches(meta.sheets||[]);
  let formulaOk=true,formulas=null,formulaMismatches=[];
  if(checkFormulas){
    formulas=await getSpreadsheetFormulaValues(accessToken,spreadsheetId);
    for(const [cell,expected] of Object.entries(KK_PM_EXPECTED_FORMULAS)){const actual=String(formulas[cell]||'').trim(); if(actual!==expected)formulaMismatches.push({cell,expected,actual});}
    formulaOk=formulaMismatches.length===0;
  }
  return {ok:shapeOk&&formulaOk,shapeOk,formulaOk,formulaMismatches,profile:getPmSheetProfile(meta.sheets||[]),metadata:meta,formulas};
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

  const yearValue = String(params.year || new Date().getFullYear());
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
  const yearValue=String(params.year||new Date().getFullYear()),opdName=safeDriveName(params.opd||'OPD Baru');
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

// Nilai Struktur & Proses resmi internal dihitung hanya dari bukti yang telah
// diterima oleh verifikator. Level bersumber dari kolom files1..files5, bukan
// dari angka yang dipilih sendiri sebelum bukti diverifikasi. Bila satu parameter
// mempunyai beberapa file pada beberapa level, digunakan level tertinggi yang
// memiliki minimal satu file berstatus Diterima/Diterima dengan Catatan.
const VERIFIED_STRUCTURE_STATUSES = new Set(['diterima','diterima_catatan']);
function normalizedFileArray(value){
  if(Array.isArray(value))return value;
  if(typeof value==='string'){try{const p=JSON.parse(value);return Array.isArray(p)?p:[];}catch{return [];}}
  if(value&&typeof value==='object'&&Array.isArray(value.files))return value.files;
  return [];
}
function evidenceTimestampMs(value){
  if(value===null||value===undefined||value==='')return 0;
  const numeric=Number(value);if(Number.isFinite(numeric)&&numeric>0)return numeric;
  const parsed=Date.parse(String(value));return Number.isFinite(parsed)?parsed:0;
}
function calculateVerifiedStructureProcessBreakdown(legacySubunsurs, workbookRows=[]){
  const totalParams=countTotalParameters();
  // Only currently active normalized workbook rows can contribute to the score.
  // Legacy JSON is consulted only as a second copy of the decision for the SAME
  // active upload ID. This preserves the newest decision if a synchronized write
  // briefly reached one store first, but legacy-only/deleted files can never revive
  // an old score. Soft-deleted rows remain tombstones and do not count as active.
  const activeByUpload=new Map();
  for(const file of (Array.isArray(workbookRows)?workbookRows:[])){
    if(!String(file?.r2_key||file?.r2Key||'').trim()||!String(file?.file_name||file?.fileName||'').trim())continue;
    const id=String(file?.upload_id||file?.uploadId||'').trim();
    const sub=String(file?.subunsur||''),param=String(file?.param_id||file?.paramId||'');
    const level=Math.max(0,Math.min(5,Number(file?.level)||0));
    if(!id||!sub||!param||level<1||!SUBUNSUR_DATA?.[sub]?.params?.some(x=>String(x.id)===param))continue;
    const status=normalizeVerificationStatus(file?.verification_status||file?.verificationStatus||'');
    const decisionTime=evidenceTimestampMs(file?.verification_at)||evidenceTimestampMs(file?.verifiedAt);
    const timestamp=status?(decisionTime||evidenceTimestampMs(file?.updated_at)):evidenceTimestampMs(file?.updated_at);
    const prev=activeByUpload.get(id);
    if(!prev||timestamp>=prev.timestamp)activeByUpload.set(id,{id,sub,param,level,status,timestamp,sourcePriority:2});
  }
  const latestDecisionByUpload=new Map(activeByUpload);
  const considerLegacy=(candidate)=>{
    const id=String(candidate.uploadId||'').trim();
    if(!id||!activeByUpload.has(id))return; // never score stale / legacy-only files
    const old=latestDecisionByUpload.get(id);
    if(!old||candidate.timestamp>old.timestamp||(candidate.timestamp===old.timestamp&&candidate.sourcePriority>old.sourcePriority)){
      // Keep the normalized row's parameter/level identity; take only the latest status/time.
      latestDecisionByUpload.set(id,{...old,status:candidate.status,timestamp:candidate.timestamp,sourcePriority:candidate.sourcePriority});
    }
  };
  for(const [subCode,subInfo] of Object.entries(SUBUNSUR_DATA||{})){
    for(const param of (Array.isArray(subInfo?.params)?subInfo.params:[])){
      for(let lv=1;lv<=5;lv++){
        const files=normalizedFileArray(legacySubunsurs?.[subCode]?.[param.id]?.['files'+lv]);
        files.forEach(file=>{
          if(!file||typeof file!=='object')return;
          const id=String(file.uploadId||file.upload_id||'').trim();const active=activeByUpload.get(id);
          if(!id||!active||active.sub!==String(subCode)||active.param!==String(param.id)||active.level!==lv)return;
          const v=normalizeVerificationRecord(file.verification||file);
          const timestamp=Math.max(evidenceTimestampMs(v.updatedAt),evidenceTimestampMs(v.verifiedAt),evidenceTimestampMs(file.updatedAt),evidenceTimestampMs(file.createdAt),evidenceTimestampMs(file.uploadedAt));
          considerLegacy({uploadId:id,status:v.status,timestamp,sourcePriority:1});
        });
      }
    }
  }
  const byParam=new Map();
  for(const [id,file] of activeByUpload){
    const current=latestDecisionByUpload.get(id)||file;
    if(!VERIFIED_STRUCTURE_STATUSES.has(normalizeVerificationStatus(current.status)))continue;
    const key=`${file.sub}|${file.param}`;
    byParam.set(key,Math.max(Number(byParam.get(key)||0),file.level));
  }
  const byLevel={1:0,2:0,3:0,4:0,5:0};let sumLevels=0;
  for(const lv of byParam.values()){if(lv>=1&&lv<=5){byLevel[lv]++;sumLevels+=lv;}}
  return {totalParams,verifiedParams:byParam.size,selectedParams:byParam.size,sumLevels,byLevel,value:totalParams?Math.round((sumLevels/totalParams)*100)/100:0,source:'verified_evidence_only'};
}
function structureEvidenceFingerprint(rows){
  const sep='\u001f',rowSep='\u001e';
  return (Array.isArray(rows)?rows:[]).map(row=>[
    row.upload_id,row.subunsur,row.param_id,row.level,row.verification_status,row.verification_at,row.updated_at,row.r2_key,row.file_name
  ].map(value=>String(value??'').replaceAll(sep,' ').replaceAll(rowSep,' ')).join(sep)).join(rowSep);
}
async function refreshVerifiedStructureProcessScore(env,year,opdId){
  for(let attempt=0;attempt<8;attempt++){
    const row=await env.DB.prepare('SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(String(opdId),String(year)).first();
    if(!row)throw new Error('OPD tidak ditemukan saat menghitung Nilai Struktur dan Proses.');
    const raw=String(row.subunsurs||'{}');let obj={};try{obj=JSON.parse(raw||'{}')}catch{obj={};}
    const fileQuery=await env.DB.prepare(`SELECT upload_id,subunsur,param_id,level,verification_status,verification_at,updated_at,r2_key,file_name
      FROM opd_workbook_evidence_items WHERE year=? AND opd_id=? ORDER BY upload_id`)
      .bind(String(year),String(opdId)).all();
    const files=fileQuery.results||[];const fingerprint=structureEvidenceFingerprint(files);
    const breakdown=calculateVerifiedStructureProcessBreakdown(obj,files);
    const status=breakdown.verifiedParams>=breakdown.totalParams&&breakdown.totalParams>0?'Selesai':(breakdown.verifiedParams>0?'Proses':'Belum');
    const write=await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_data SET sa=?,nilai_struktur_proses=?,struktur_proses_status=?
      WHERE id=? AND year=? AND COALESCE(subunsurs,'{}')=?
      AND COALESCE((SELECT group_concat(sig, char(30)) FROM (
        SELECT COALESCE(upload_id,'')||char(31)||COALESCE(subunsur,'')||char(31)||COALESCE(param_id,'')||char(31)||
          COALESCE(CAST(level AS TEXT),'')||char(31)||COALESCE(verification_status,'')||char(31)||COALESCE(CAST(verification_at AS TEXT),'')||char(31)||COALESCE(CAST(updated_at AS TEXT),'')||char(31)||COALESCE(r2_key,'')||char(31)||COALESCE(file_name,'') AS sig
        FROM opd_workbook_evidence_items WHERE year=? AND opd_id=? ORDER BY upload_id
      )),'')=?`)
      .bind(breakdown.value,breakdown.value,status,String(opdId),String(year),raw,String(year),String(opdId),fingerprint));
    if(Number(write.meta?.changes||0)>0)return {...breakdown,status};
    await new Promise(resolve=>setTimeout(resolve,20*(attempt+1)+Math.floor(Math.random()*15)));
  }
  const e=new Error('Nilai Struktur dan Proses sedang diperbarui operator lain. Data terbaru tidak ditimpa; muat ulang sebentar lagi.');e.status=409;throw e;
}
async function saveLegacyEvidenceVerificationAtomic(env,year,opdId,subunsur,paramId,level,uploadId,verification){
  for(let attempt=0;attempt<6;attempt++){
    const row=await env.DB.prepare('SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(String(opdId),String(year)).first();
    if(!row)throw new Error('OPD tidak ditemukan.');
    const raw=String(row.subunsurs||'{}');let obj={};try{obj=JSON.parse(raw||'{}')}catch{obj={};}
    const arr=obj?.[subunsur]?.[paramId]?.['files'+level];
    if(!Array.isArray(arr))throw new Error('Daftar file evidence tidak ditemukan.');
    const file=arr.find(x=>x&&typeof x==='object'&&String(x.uploadId||'')===String(uploadId));
    if(!file)throw new Error('File evidence tidak ditemukan pada OPD/parameter/level yang sama.');
    file.verification=verification;if(file.replacementStatus==='menunggu_verifikasi')file.replacementStatus=null;
    const write=await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET subunsurs=? WHERE id=? AND year=? AND COALESCE(subunsurs,'{}')=?").bind(JSON.stringify(obj),String(opdId),String(year),raw));
    if(Number(write.meta?.changes||0)>0){
      const mirror=await env.DB.prepare('SELECT upload_id FROM opd_workbook_evidence_items WHERE upload_id=? AND year=? AND opd_id=? LIMIT 1').bind(String(uploadId),String(year),String(opdId)).first();
      if(mirror){
        const maxRow=await env.DB.prepare('SELECT COALESCE(MAX(updated_at),0) AS t FROM opd_workbook_evidence_items WHERE year=? AND opd_id=?').bind(String(year),String(opdId)).first();
        const stamp=Math.max(Date.parse(verification.updatedAt||verification.verifiedAt||'')||Date.now(),Number(maxRow?.t||0)+1);
        verification={...verification,verifiedAt:new Date(stamp).toISOString(),updatedAt:new Date(stamp).toISOString()};
        await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_workbook_evidence_items SET verification_status=?,verification_examiner=?,verification_note=?,verification_at=?,updated_at=?
          WHERE upload_id=? AND year=? AND opd_id=?`).bind(verification.status,verification.examinerName,verification.note,stamp,stamp,String(uploadId),String(year),String(opdId)));
      }
      const score=await refreshVerifiedStructureProcessScore(env,year,opdId);return {verification,summary:calculateVerificationSummaryServer(arr),score};
    }
    await new Promise(resolve=>setTimeout(resolve,12*(attempt+1)));
  }
  const e=new Error('Data evidence berubah karena operator lain sedang menyimpan. Muat ulang dan ulangi verifikasi.');e.status=409;throw e;
}
async function removeLegacyEvidenceMirror(env,year,opdId,uploadId){
  for(let attempt=0;attempt<8;attempt++){
    const row=await env.DB.prepare('SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(String(opdId),String(year)).first();
    if(!row)return false;
    const raw=String(row.subunsurs||'{}');let obj={};try{obj=JSON.parse(raw||'{}')}catch{obj={};}
    let changed=false;
    for(const paramGroup of Object.values(obj||{})){
      if(!paramGroup||typeof paramGroup!=='object')continue;
      for(const data of Object.values(paramGroup)){
      if(!data||typeof data!=='object')continue;
      for(let level=1;level<=5;level++){
      const key='files'+level,arr=normalizedFileArray(data?.[key]);
      if(arr.some(file=>file&&typeof file==='object'&&String(file.uploadId||file.upload_id||'')===String(uploadId))){
        data[key]=arr.filter(file=>!(file&&typeof file==='object'&&String(file.uploadId||file.upload_id||'')===String(uploadId)));changed=true;
      }
      }
      }
    }
    if(!changed)return true;
    const write=await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET subunsurs=? WHERE id=? AND year=? AND COALESCE(subunsurs,'{}')=?").bind(JSON.stringify(obj),String(opdId),String(year),raw));
    if(Number(write.meta?.changes||0)>0)return true;
    await new Promise(resolve=>setTimeout(resolve,12*(attempt+1)+Math.floor(Math.random()*12)));
  }
  const e=new Error('Evidence berubah saat operator lain menyimpan. File belum dapat dihapus dengan aman; muat ulang lalu coba lagi.');e.status=409;throw e;
}
async function syncStructureVerificationForUpload(env,year,opdId,uploadId,status,examinerName,note,now){
  const normalizedStatus=normalizeVerificationStatus(status);
  const safeExaminer=sanitizeVerificationField(examinerName,100),safeNote=sanitizeVerificationField(note,2000);
  let nestedFound=false,nestedSaved=false,conflict=false;
  for(let attempt=0;attempt<6;attempt++){
    const row=await env.DB.prepare('SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(String(opdId),String(year)).first();if(!row)break;
    const raw=String(row.subunsurs||'{}');let obj={};try{obj=JSON.parse(raw||'{}')}catch{obj={};}
    let found=null;
    for(const [sub,paramGroup] of Object.entries(obj||{})){
      for(const [param,data] of Object.entries(paramGroup||{})){
        for(let lv=1;lv<=5;lv++){
          const arr=normalizedFileArray(data?.['files'+lv]);
          const f=arr.find(x=>x&&typeof x==='object'&&String(x.uploadId||'')===String(uploadId));
          if(f){found={sub,param,level:lv,file:f};break;}
        }
        if(found)break;
      }
      if(found)break;
    }
    if(!found)break;
    nestedFound=true;found.file.verification={examinerName:safeExaminer,note:safeNote,status:normalizedStatus,verifiedAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};
    if(found.file.replacementStatus==='menunggu_verifikasi')found.file.replacementStatus=null;
    const write=await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET subunsurs=? WHERE id=? AND year=? AND COALESCE(subunsurs,'{}')=?").bind(JSON.stringify(obj),String(opdId),String(year),raw));
    if(Number(write.meta?.changes||0)>0){nestedSaved=true;break;}
    conflict=true;await new Promise(resolve=>setTimeout(resolve,15*(attempt+1)+Math.floor(Math.random()*12)));
  }
  if(nestedFound&&!nestedSaved){const e=new Error('Evidence berubah saat diverifikasi oleh operator lain. Muat ulang lalu simpan kembali.');e.status=409;throw e;}
  const workbook=await env.DB.prepare('SELECT upload_id FROM opd_workbook_evidence_items WHERE upload_id=? AND year=? AND opd_id=? LIMIT 1').bind(String(uploadId),String(year),String(opdId)).first();
  if(workbook){
    const maxRow=await env.DB.prepare('SELECT COALESCE(MAX(updated_at),0) AS t FROM opd_workbook_evidence_items WHERE year=? AND opd_id=?').bind(String(year),String(opdId)).first();
    const stamp=Math.max(Number(now)||Date.now(),Number(maxRow?.t||0)+1);
    await runD1WithRetry(()=>env.DB.prepare('UPDATE opd_workbook_evidence_items SET verification_status=?,verification_examiner=?,verification_note=?,verification_at=?,updated_at=? WHERE upload_id=? AND year=? AND opd_id=?')
      .bind(normalizedStatus,safeExaminer,safeNote,stamp,stamp,String(uploadId),String(year),String(opdId)));
  }
  if(!nestedSaved&&!workbook)throw new Error('Evidence tidak ditemukan pada OPD/tahun tersebut. Muat ulang daftar evidence.');
  const score=await refreshVerifiedStructureProcessScore(env,year,opdId).catch(err=>{console.error('Pembaruan skor tertunda:',err?.message||err);throw err;});
  return {score,nestedUpdated:nestedSaved,workbookUpdated:Boolean(workbook),concurrentConflict:conflict};
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

async function updateWorkbookEvidenceFileStatus(env, job, patch) {
  const row=(await env.DB.prepare("SELECT upload_id FROM opd_workbook_evidence_items WHERE upload_id=? AND year=? AND opd_id=? LIMIT 1").bind(job.uploadId,job.year,job.opdId).all()).results?.[0];
  if(!row)return;
  const map={gdriveId:'gdrive_id',syncStatus:'sync_status',syncError:'sync_error',fileName:'file_name'};
  const sets=[];const vals=[];
  for(const [k,v] of Object.entries(patch||{})){const col=map[k];if(!col)continue;sets.push(`${col}=?`);vals.push(v==null?null:String(v));}
  if(!sets.length)return;sets.push('updated_at=?');vals.push(Date.now(),job.uploadId,job.year,job.opdId);
  await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_workbook_evidence_items SET ${sets.join(',')} WHERE upload_id=? AND year=? AND opd_id=?`).bind(...vals));
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

async function updateLheEvidenceStatus(env, job, patch) {
  const record=await env.DB.prepare('SELECT evidence_json FROM lhe_followup_items WHERE id=? AND year=? AND opd_id=? LIMIT 1').bind(String(job.followupId||''),String(job.year),String(job.opdId)).first();
  if(!record)return;
  let list=[];try{list=JSON.parse(record.evidence_json||'[]')}catch{};if(!Array.isArray(list))list=[];
  const index=list.findIndex(x=>x&&String(x.uploadId||'')===String(job.uploadId||''));if(index<0)return;
  list[index]={...list[index],...patch};
  await runD1WithRetry(()=>env.DB.prepare('UPDATE lhe_followup_items SET evidence_json=?,updated_at=? WHERE id=? AND year=? AND opd_id=?').bind(JSON.stringify(list),Date.now(),String(job.followupId),String(job.year),String(job.opdId)));
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
    } else if (job.type === 'workbook_evidence') {
      await updateWorkbookEvidenceFileStatus(env, job, { gdriveId, storage: 'R2 + Google Drive', syncStatus: 'done', syncError: null });
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
    } else if (job.type === 'workbook_evidence') {
      await updateWorkbookEvidenceFileStatus(env, job, { syncStatus: 'retrying', syncError: message });
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

async function cleanupLheEvidenceArtifacts(env,year,opdId,file){
  const warnings=[];const uploadId=String(file?.uploadId||file?.upload_id||'').trim();
  const driveId=String(file?.gdriveId||file?.gdrive_id||'').trim(),r2Key=String(file?.r2Key||file?.r2_key||'').trim();
  const fileName=String(file?.fileName||file?.file_name||'bukti').slice(0,80);
  if(driveId){try{await deleteGoogleDriveFile(env,driveId);}catch(e){warnings.push(`Google Drive (${fileName}): ${String(e?.message||e).slice(0,180)}`);}}
  if(r2Key){try{await env.EVIDENCE_BUCKET.delete(r2Key);}catch(e){warnings.push(`R2 (${fileName}): ${String(e?.message||e).slice(0,180)}`);}}
  if(uploadId){
    try{await env.DB.prepare('DELETE FROM evidence_verification_steps WHERE year=? AND opd_id=? AND upload_id=?').bind(String(year),String(opdId),uploadId).run();}catch(e){warnings.push(`Riwayat status aktif ${uploadId}: ${String(e?.message||e).slice(0,120)}`);}
    try{await env.DB.prepare('DELETE FROM evidence_upload_registry WHERE upload_id=? AND year=? AND opd_id=?').bind(uploadId,String(year),String(opdId)).run();}catch(e){warnings.push(`Registri upload ${uploadId}: ${String(e?.message||e).slice(0,120)}`);}
    try{await env.DB.prepare('DELETE FROM evidence_uploads WHERE upload_id=?').bind(uploadId).run();}catch(e){warnings.push(`Metadata upload ${uploadId}: ${String(e?.message||e).slice(0,120)}`);}
  }
  return warnings;
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

const KK_PM_TARGET_TOTALS = Object.freeze({T1:43,T2:42,T3:43,T4:55});
const KK_PM_GRADE_LEVEL = Object.freeze({A:5,B:4,C:3,D:2,E:1});
const KK_PM_TOTAL_PARAMETERS = 183;
function validKkPmWorkpaperLocation(target,subunsur,paramId){
  const t=String(target||'').toUpperCase(); const sub=String(subunsur||''); const pid=String(paramId||'');
  if(!Object.prototype.hasOwnProperty.call(KK_PM_TARGET_TOTALS,t)) return false;
  if(!/^\d+\.\d+$/.test(sub) || !/^\d+\.\d+\.\d+$/.test(pid)) return false;
  if(!pid.startsWith(sub+'.')) return false;
  const parts=pid.split('.').map(Number); const no=parts[2];
  return Number.isInteger(no) && no>=1 && no<=20;
}
function kkPmWorkpaperSummaryFromRows(rows, opdName=''){
  const allowed=new Set(assessmentAllowedTargets(opdName));
  const active=(rows||[]).filter(row=>allowed.has(String(row?.target||'').toUpperCase()));
  const total=[...allowed].reduce((n,target)=>n+(KK_PM_TARGET_TOTALS[target]||0),0);
  const evaluated=active.reduce((n,row)=>n+Number(row?.evaluated_items||0),0);
  const sum=active.reduce((n,row)=>n+Number(row?.sum_levels||0),0);
  const completion=total?Math.min(100,Math.round((evaluated/total)*10000)/100):0;
  const avgLevel=evaluated?Math.round((sum/evaluated)*100)/100:0;
  return {total,evaluated,pending:Math.max(0,total-evaluated),sum,percentage:completion,completion,avgLevel,avgPercent:Math.round((avgLevel/5)*10000)/100,status:completion>=100?'Selesai':(evaluated?'Proses':'Belum'),targets:[...allowed]};
}
async function getKkPmWorkpaperSummary(env,year,opdId){
  const org=(await env.DB.prepare('SELECT opd FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(String(opdId),String(year)).all()).results?.[0]?.opd||'';
  const q=await env.DB.prepare(`SELECT target,COUNT(*) AS evaluated_items,
    COALESCE(SUM(CASE grade_result WHEN 'A' THEN 5 WHEN 'B' THEN 4 WHEN 'C' THEN 3 WHEN 'D' THEN 2 WHEN 'E' THEN 1 ELSE 0 END),0) AS sum_levels
    FROM opd_kk_pm_workpaper_items WHERE year=? AND opd_id=? AND grade_result IN ('A','B','C','D','E') GROUP BY target`).bind(String(year),String(opdId)).all();
  return kkPmWorkpaperSummaryFromRows(q.results||[],org);
}

function parseWorkbookScalar(value){
  if(value===null||value===undefined||value==='')return{value:null,status:'incomplete'};
  const s=String(value).trim();if(!s||/^#(DIV\/0!|VALUE!|REF!|N\/A|NAME\?|NUM!|NULL!)/i.test(s)||/lengkapi\s+kk/i.test(s))return{value:null,status:'incomplete',raw:s};
  const n=Number(s.replace(',','.'));if(Number.isFinite(n))return{value:Math.max(0,Math.min(5,n)),status:'ok',raw:s};return{value:null,status:'incomplete',raw:s};
}
async function readWorkbookComputedValues(env,spreadsheetId,sourceInfo={}){
  const token=await getGoogleAccessToken(env);const ranges=['KKLEAD_SPIP!I11','KKLEAD_SPIP!I68','KKLEAD_SPIP!I85','KKLEAD_SPIP!I106'];
  const qs=ranges.map(r=>`ranges=${encodeURIComponent(r)}`).join('&');const url=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const res=await fetchWithRetry(url,{headers:{Authorization:`Bearer ${token}`}}, {retries:3,baseDelay:500});const body=await res.json().catch(()=>({}));
  if(!res.ok){const msg=JSON.stringify(body||{});if(res.status===403&&/scope|permission|insufficient/i.test(msg))throw new Error('Akses Google Sheets belum memiliki scope spreadsheet readonly. Tambahkan scope Google Sheets readonly pada OAuth refresh token.');throw new Error(`Gagal membaca nilai formula workbook ${sourceInfo.workbookName||spreadsheetId}: ${msg}`);}
  const vals=(body.valueRanges||[]).map(x=>x.values?.[0]?.[0]);
  const parsed={nilaiMaturitas:parseWorkbookScalar(vals[0]),mri:parseWorkbookScalar(vals[1]),iepk:parseWorkbookScalar(vals[2]),nilaiKapabilitasApip:parseWorkbookScalar(vals[3])};
  const statuses=Object.values(parsed).map(x=>x.status);
  return{source:sourceInfo.source||'KK PM SPIP workbook formula cells',spreadsheetId,spreadsheetUrl:`https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`,workbookName:sourceInfo.workbookName||null,sheet:'KKLEAD_SPIP',cells:{nilaiMaturitas:'I11',mri:'I68',iepk:'I85',nilaiKapabilitasApip:'I106'},values:Object.fromEntries(Object.entries(parsed).map(([k,v])=>[k,v.value])),raw:Object.fromEntries(Object.entries(parsed).map(([k,v])=>[k,v.raw??null])),status:statuses.every(x=>x==='ok')?'ok':(statuses.some(x=>x==='ok')?'partial':'incomplete'),syncedAt:Date.now()};
}

export async function onRequest({ request, env, ctx }) {
  const ACCESS_PASSWORD = env.ACCESS_PASSWORD;
  const DELETE_PASSWORD = env.DELETE_PASSWORD;
  const url = new URL(request.url);
  let params = {};
  let action = url.searchParams.get('action') || '';

  // Daftar aksi sensitif yang tidak boleh diakses via GET
  const SENSITIVE_ACTIONS = [
    'verifyAccess', 'verifyDelete', 'login', 'logout', 'createEvidencePreviewLink', 'saveEvidenceWorkflowStep', 'saveLheFollowup', 'deleteLheFollowup', 'uploadLheEvidence', 'deleteLheEvidence', 'addOpd', 'saveData', 'saveField', 'saveAssessmentStatus', 'saveBpkpOfficialScore', 'unlockBpkpOfficialScore', 'getBpkpOfficialScoreAdmin', 'getBpkpOfficialAudit',
    'uploadFile', 'deleteFile', 'saveEvidenceVerification', 'saveRtpEvidenceVerification', 'saveWorkbookEvidenceVerification', 'deleteWorkbookEvidence', 'replaceWorkbookEvidenceFile', 'saveQaApipItem', 'deleteQaApipItem', 'getQaApipChecklistData', 'saveQaApipChecklistItem', 'deleteQaApipChecklistItem', 'deleteOpd', 'addYear', 'deleteYear',
    'createBackup', 'restoreBackup', 'deleteBackup', 'createKkSheets', 'createKkPmSheets', 'saveKkData', 'getKkPmData', 'saveKkPmData', 'saveKkPmItem', 'deleteKkPmItem', 'saveKkPmMeta', 'getKkPmSheets', 'exportKkPmWorkbook', 'getWorkbookEvidenceFiles', 'syncKkPmMasterNow', 'saveWorkbookEvidenceVerification', 'deleteWorkbookEvidence', 'replaceWorkbookEvidenceFile', 'syncKkComputedValues', 'saveRow', 'saveSubunsur', 'createRtpKkSheets', 'saveRtpKkData', 'saveRtpEvidenceFolder', 'uploadRtpEvidence', 'deleteRtpEvidence', 'replaceEvidenceFile', 'replaceRtpEvidence', 'uploadReportFile', 'deleteReportFile', 'retryDriveBackup',
    'listAuthUsers','createAuthUser','setAuthUserEnabled','resetAuthUserPassword'
  ];

  // KK RTP dan pengaturan folder Evidence RTP wajib melalui POST.
  if (request.method === 'POST') {
    try {
      const contentType=request.headers.get('content-type')||'';
      // Binary upload mode: metadata stays in the query string; the request body is the file stream.
      if(action==='uploadFile' || action==='uploadRtpEvidence' || action==='replaceEvidenceFile' || action==='replaceRtpEvidence' || action==='replaceWorkbookEvidenceFile' || action==='uploadReportFile' || action==='uploadLheEvidence'){
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

  const year = String(params.year || new Date().getFullYear());
  await ensureOpdSchema(env);

  // Rate limiting untuk aksi login: hanya percobaan SALAH yang dihitung.
  // Password yang benar selalu dapat masuk, sekaligus mereset penghitung percobaan.
  let clientIp = 'unknown';
  let loginRateLimited = false;
  if (action === 'login' || action === 'verifyAccess' || action === 'verifyDelete') {
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

  // Resolve the server-side session for every protected API request. Browser flags are not trusted.
  let authSession = null;
  try { authSession = await readAuthSession(env, request); } catch (e) { console.warn('Pembacaan sesi ditolak:', e?.message || e); }

  // Login/legacy verification are the only paths allowed to establish a session.
  const SESSION_ESTABLISH_ACTIONS = new Set(['login','verifyAccess']);
  const configuredMasterSyncSecret=String(env.KK_MASTER_SYNC_SECRET||'').trim();
  const suppliedMasterSyncSecret=String(params.secret||request.headers.get('X-KK-Master-Sync-Secret')||'').trim();
  const isTrustedMasterWebhook=action==='syncKkPmMasterNow'&&request.method==='POST'&&configuredMasterSyncSecret.length>=32&&suppliedMasterSyncSecret.length===configuredMasterSyncSecret.length&&(()=>{let diff=0;for(let i=0;i<configuredMasterSyncSecret.length;i++)diff|=configuredMasterSyncSecret.charCodeAt(i)^suppliedMasterSyncSecret.charCodeAt(i);return diff===0;})();
  if(action==='syncKkPmMasterNow'&&!isTrustedMasterWebhook){
    return jsonResponse({status:'error',code:'INVALID_MASTER_SYNC_SECRET',message:'Webhook sinkronisasi master ditolak: secret belum valid atau belum dikonfigurasi (minimal 32 karakter).'},403);
  }
  if (!isTrustedMasterWebhook && !SAFE_PUBLIC_ACTIONS.has(action) && !SESSION_ESTABLISH_ACTIONS.has(action) && action !== 'logout' && !authSession) {
    return jsonResponse({ status: 'error', code: 'AUTH_REQUIRED', message: 'Sesi login tidak ditemukan atau sudah berakhir. Silakan masuk kembali.' }, 401);
  }
  if (!isTrustedMasterWebhook && authSession && action && !SAFE_PUBLIC_ACTIONS.has(action) && !SESSION_ESTABLISH_ACTIONS.has(action) && action !== 'logout' && !isActionAllowedForRole(authSession, action, params)) {
    return jsonResponse({ status: 'error', code: 'ROLE_FORBIDDEN', message: 'Role akun tidak memiliki izin untuk aksi ini.' }, 403);
  }
  // Any action addressed to a specific OPD is checked against the logged-in scope.
  if (authSession && params.opdId && !['addOpd'].includes(action)) {
    try { await assertSessionCanAccessOpd(env, authSession, params.year || year, params.opdId); }
    catch (e) { return jsonResponse({ status: 'error', code: 'OPD_SCOPE_FORBIDDEN', message: e?.message || 'Akses OPD ditolak.' }, 403); }
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
    const targetCode=String(params.targetCode||'').toUpperCase();
    const targetFolder=({T1:'T1 - KK3.1 - Seluruh OPD',T2:'T2 - KK3.2 - BPKAD',T3:'T3 - KK3.3 - BPKAD',T4:'T4 - KK3.4 - Inspektorat'})[targetCode]||'';
    const targetPart=targetFolder?`${targetFolder}/`:'';
    // Legacy Structure & Process uploads follow the same readable hierarchy as
    // workbook evidence. Target is inserted only when the caller explicitly chose
    // a validated T1-T4 target; it is never guessed for a multi-target OPD.
    const filePath = `kawal_spip/${year}/${safeOpd}/Evidence Struktur dan Proses/${unsurName}/${safeSubUnsur}/${safeParam}/${targetPart}Level_${level}/${safeFileName}`;
    return { filePath, bytes, fileType: fileType || 'application/octet-stream', fileName: safeFileName };
  }

  try {
    switch (action) {
      case 'listAuthUsers': {
        await ensureAuthUsersSeeded(env);
        const rec=await env.DB.prepare('SELECT username,display_name,role,opd_ids_json,opd_names_json,enabled,created_at,updated_at,password_changed_at,created_by,last_login_at FROM auth_users ORDER BY role,username').all();
        const users=(rec.results||[]).map(row=>({username:row.username,displayName:row.display_name||row.username,role:row.role,opdIds:parseJsonStringArray(row.opd_ids_json),opdNames:parseJsonStringArray(row.opd_names_json),enabled:Number(row.enabled)===1,createdAt:Number(row.created_at||0),updatedAt:Number(row.updated_at||0),passwordChangedAt:Number(row.password_changed_at||0),createdBy:row.created_by||'',lastLoginAt:row.last_login_at?Number(row.last_login_at):null}));
        return jsonResponse({status:'success',users});
      }
      case 'createAuthUser': {
        await ensureAuthUsersSeeded(env);
        const username=String(params.username||'').trim();const password=String(params.password||'');const role=String(params.role||'opd').trim().toLowerCase();const displayName=String(params.displayName||username).trim().slice(0,120);
        if(!/^[A-Za-z0-9._-]{3,60}$/.test(username))throw new Error('Username harus 3–60 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.');
        if(password.length<16)throw new Error('Password awal minimal 16 karakter.');
        if(!VALID_ACCOUNT_ROLES.has(role))throw new Error('Role akun tidak valid.');
        if(role==='opd'){
          const requested=String(params.opdName||'').trim();if(!requested)throw new Error('Pilih satu OPD untuk akun ini.');
          const all=(await env.DB.prepare('SELECT DISTINCT opd FROM opd_data WHERE year=? ORDER BY opd').bind(String(year)).all()).results||[];
          const match=all.find(x=>normalizeOrgForAuth(x.opd)===normalizeOrgForAuth(requested));
          if(!match)throw new Error(`OPD “${requested}” belum ada pada tahun ${year}. Tambahkan dahulu dari menu Tambah OPD, lalu buat akunnya.`);
          params.opdNames=[String(match.opd)];params.opdIds=[];
        }else{
          params.opdNames=Array.isArray(params.opdNames)?params.opdNames.map(x=>String(x||'').trim()).filter(Boolean):[];
          params.opdIds=Array.isArray(params.opdIds)?params.opdIds.map(x=>String(x||'').trim()).filter(Boolean):[];
          if(params.opdNames.includes('*')||params.opdIds.includes('*')){if(role==='opd')throw new Error('Akun OPD tidak boleh memakai wildcard.');}
        }
        const pass=await makeAuthPasswordRecord(password);const now=Date.now();
        try{
          await env.DB.prepare(`INSERT INTO auth_users(username_key,username,display_name,role,opd_ids_json,opd_names_json,password_salt,password_hash,password_iterations,enabled,created_at,updated_at,password_changed_at,created_by,last_login_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,NULL)`)
            .bind(username.toLowerCase(),username,displayName||username,role,JSON.stringify(params.opdIds||[]),JSON.stringify(params.opdNames||[]),pass.salt,pass.hash,pass.iterations,now,now,now,String(authSession?.username||'admin')).run();
        }catch(err){if(/unique|constraint/i.test(String(err?.message||'')))throw new Error(`Username ${username} sudah digunakan.`);throw err;}
        return jsonResponse({status:'success',message:`Akun ${username} berhasil dibuat.`,username,role,opdName:params.opdNames?.[0]||null});
      }
      case 'setAuthUserEnabled': {
        const username=String(params.username||'').trim();const usernameKey=username.toLowerCase();const enabled=params.enabled===true||String(params.enabled).toLowerCase()==='true'||String(params.enabled)==='1';
        const target=await env.DB.prepare('SELECT username,role,enabled FROM auth_users WHERE username_key=? LIMIT 1').bind(usernameKey).first();
        if(!target)throw new Error('Akun tidak ditemukan.');
        if(!enabled&&usernameKey===String(authSession?.username||'').toLowerCase())throw new Error('Anda tidak dapat menonaktifkan akun yang sedang dipakai.');
        if(!enabled&&target.role==='admin'&&Number(target.enabled)===1){const n=Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM auth_users WHERE role='admin' AND enabled=1").first())?.n||0);if(n<=1)throw new Error('Admin aktif terakhir tidak boleh dinonaktifkan.');}
        await env.DB.prepare('UPDATE auth_users SET enabled=?,updated_at=? WHERE username_key=?').bind(enabled?1:0,Date.now(),usernameKey).run();
        if(!enabled)await env.DB.prepare('DELETE FROM auth_sessions WHERE lower(username)=?').bind(usernameKey).run();
        return jsonResponse({status:'success',message:enabled?`Akun ${target.username} diaktifkan.`:`Akun ${target.username} dinonaktifkan.`});
      }
      case 'resetAuthUserPassword': {
        const username=String(params.username||'').trim();const usernameKey=username.toLowerCase();const password=String(params.password||'');
        if(password.length<16)throw new Error('Password baru minimal 16 karakter.');
        const target=await env.DB.prepare('SELECT username FROM auth_users WHERE username_key=? LIMIT 1').bind(usernameKey).first();if(!target)throw new Error('Akun tidak ditemukan.');
        const pass=await makeAuthPasswordRecord(password);const now=Date.now();
        await env.DB.prepare('UPDATE auth_users SET password_salt=?,password_hash=?,password_iterations=?,password_changed_at=?,updated_at=? WHERE username_key=?').bind(pass.salt,pass.hash,pass.iterations,now,now,usernameKey).run();
        await env.DB.prepare('DELETE FROM auth_sessions WHERE lower(username)=?').bind(usernameKey).run();
        return jsonResponse({status:'success',message:`Password ${target.username} berhasil direset. Sesi lama akun ini dicabut.`});
      }
      case 'authMe': {
        return jsonResponse({ status: 'success', authenticated: !!authSession, user: publicSessionUser(authSession) });
      }
      case 'login': {
        if (loginRateLimited) return jsonResponse({ status: 'error', message: 'Terlalu banyak percobaan login. Coba lagi dalam 10 menit.' }, 429);
        const username=String(params.username||'').trim();
        const password=String(params.password||'');
        let user=null;
        try {
          await ensureAuthUsersSeeded(env);
          let stored= username ? await env.DB.prepare('SELECT * FROM auth_users WHERE username_key=? LIMIT 1').bind(username.toLowerCase()).first() : null;
          if(stored && Number(stored.enabled)===1 && password){
            if(Number(stored.password_iterations)>AUTH_PASSWORD_MAX_ITERATIONS){
              try{stored=await upgradeSeededLegacyAuthPassword(env,stored,password)||stored;}
              catch(migrationError){console.error('Migrasi hash password lama gagal:',migrationError?.message||migrationError);}
            }
            if(await verifyAuthPassword(password,stored)){
              user={username:stored.username,displayName:stored.display_name,role:stored.role,opdIds:parseJsonStringArray(stored.opd_ids_json),opdNames:parseJsonStringArray(stored.opd_names_json)};
              await env.DB.prepare('UPDATE auth_users SET last_login_at=? WHERE username_key=?').bind(Date.now(),stored.username_key).run();
            }
          }
          const accountCount=Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM auth_users').first())?.n||0);
          const hasJsonConfig=Boolean(String(env.KAWAL_SPIP_USERS_JSON||'').trim());
          // Emergency compatibility login only while there are no managed/configured users at all.
          if(!user && accountCount===0 && !hasJsonConfig && password && password===ACCESS_PASSWORD) user={username:'admin',displayName:'Administrator',role:'admin',opdIds:[],opdNames:[]};
          if(!user && accountCount===0 && !hasJsonConfig && username.toLowerCase()==='bpkp' && password && password===env.BPKP_ADMIN_PASSWORD) user={username:'bpkp',displayName:'Verifikator BPKP',role:'bpkp',opdIds:[],opdNames:[]};
        } catch (e) { return jsonResponse({status:'error',message:e?.message||'Konfigurasi akun tidak valid.'},500); }
        if(!user){
          try{await env.DB.prepare("INSERT INTO login_attempts (ip, action, timestamp) VALUES (?, ?, ?)").bind(clientIp,'login',Date.now()).run();}catch{}
          return jsonResponse({status:'error',message:'Username atau password tidak sesuai, atau akun dinonaktifkan.'},401);
        }
        try{await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ? AND action = ?").bind(clientIp,'login').run();}catch{}
        const created=await createAuthSession(env,user);
        return jsonResponse({status:'success',message:'Login berhasil.',authenticated:true,user:publicSessionUser(created.session)},200,{'Set-Cookie':sessionCookie(created.token),'X-Content-Type-Options':'nosniff'});
      }
      case 'logout': {
        const token=cookieValue(request,SESSION_COOKIE_NAME);
        if(token){const hash=await sha256Hex(token);await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(hash).run().catch(()=>{});}
        return jsonResponse({status:'success',message:'Logout berhasil.'},200,{'Set-Cookie':sessionCookie('',0)});
      }
      case 'createEvidencePreviewLink': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||'');
        if(!opdId||!uploadId)throw new Error('Identitas file untuk preview belum lengkap.');
        await assertSessionCanAccessOpd(env,authSession,year,opdId);
        const file=await assertUploadBelongsToOpd(env,year,opdId,uploadId);if(!file?.r2Key)throw new Error('Berkas belum tersedia di penyimpanan privat.');
        const expires=Math.floor(Date.now()/1000)+600;const payload=evidencePreviewPayload(year,opdId,uploadId,expires);const sig=await previewSignature(env,payload);
        const previewUrl=new URL('/myCloudinaryHandler',url.origin);previewUrl.searchParams.set('action','previewPublicEvidence');previewUrl.searchParams.set('year',String(year));previewUrl.searchParams.set('opdId',opdId);previewUrl.searchParams.set('uploadId',uploadId);previewUrl.searchParams.set('expires',String(expires));previewUrl.searchParams.set('sig',sig);
        return jsonResponse({status:'success',url:previewUrl.toString(),expiresAt:expires*1000,expiresInSeconds:600,fileName:file.fileName||'Evidence',fileType:file.fileType||'application/octet-stream'});
      }
      case 'previewEvidence': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||'');
        await assertSessionCanAccessOpd(env,authSession,year,opdId);
        const file=await assertUploadBelongsToOpd(env,year,opdId,uploadId);if(!file?.r2Key)return jsonResponse({status:'error',message:'Berkas belum tersedia di penyimpanan privat.'},404);
        return await evidencePreviewStreamResponse(env,request,file,{signed:false});
      }
      case 'previewPublicEvidence': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||''),expires=Number(params.expires||0),sig=String(params.sig||'');
        const now=Math.floor(Date.now()/1000);if(!opdId||!uploadId||!Number.isInteger(expires)||expires<now||expires>now+660||!/^[a-f0-9]{64}$/i.test(sig))return jsonResponse({status:'error',message:'Tautan preview Office tidak valid atau sudah kedaluwarsa.'},403);
        let expected='';try{expected=await previewSignature(env,evidencePreviewPayload(year,opdId,uploadId,expires));}catch{return jsonResponse({status:'error',message:'Preview Office belum dikonfigurasi. Tetapkan EVIDENCE_PREVIEW_SECRET (minimal 32 karakter).'},503);}
        if(!constantTimeTextEqual(expected.toLowerCase(),sig.toLowerCase()))return jsonResponse({status:'error',message:'Tanda tangan preview tidak valid.'},403);
        const file=await assertUploadBelongsToOpd(env,year,opdId,uploadId);if(!file?.r2Key)return jsonResponse({status:'error',message:'File preview tidak ditemukan.'},404);
        return await evidencePreviewStreamResponse(env,request,file,{signed:true});
      }
      case 'downloadEvidence': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||'');
        await assertSessionCanAccessOpd(env,authSession,year,opdId);
        const file=await assertUploadBelongsToOpd(env,year,opdId,uploadId);
        if(!file?.r2Key) return jsonResponse({status:'error',message:'Berkas belum tersedia pada penyimpanan privat.'},404);
        const object=await env.EVIDENCE_BUCKET.get(file.r2Key);
        if(!object) return jsonResponse({status:'error',message:'Berkas tidak ditemukan pada R2.'},404);
        const name=String(file.fileName||'evidence').replace(/[\r\n"\\]/g,'_').slice(0,180)||'evidence';
        const safeEncoded=encodeURIComponent(name).replace(/['()*]/g,ch=>'%'+ch.charCodeAt(0).toString(16).toUpperCase());
        const contentType=String(file.fileType||object.httpMetadata?.contentType||'application/octet-stream').split(';')[0].trim().toLowerCase();
        // Inline only well-known passive formats; treat all office/unknown formats as downloads.
        // This prevents an uploaded HTML/SVG/script-like file from executing in the app's origin.
        const inlineSafeTypes=new Set(['application/pdf','image/png','image/jpeg','image/gif','image/webp']);
        const disposition=inlineSafeTypes.has(contentType)?'inline':'attachment';
        const headers=new Headers({'Content-Type':contentType,'Content-Disposition':`${disposition}; filename="${name.replace(/[^\x20-\x7E]/g,'_')}"; filename*=UTF-8''${safeEncoded}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"sandbox; default-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
        if(object.httpEtag)headers.set('ETag',object.httpEtag);
        return new Response(object.body,{status:200,headers});
      }
      case 'getPemdaSampling': {
        if(!['admin','irban','bpkp','auditor','ppupd'].includes(String(authSession?.role||'')))return jsonResponse({status:'error',message:'Akses kertas kerja Pemda tidak diizinkan.'},403);
        const result=await env.DB.prepare(`SELECT o.id AS opd_id,o.opd,o.assessment_status,COALESCE(s.selected,0) AS selected,COALESCE(s.note,'') AS note,COALESCE(s.selected_by,'') AS selected_by,COALESCE(s.updated_at,0) AS updated_at,(SELECT COUNT(*) FROM evidence_verification_steps v WHERE v.year=o.year AND v.opd_id=o.id AND v.stage='qa' AND v.status IN ('diterima','diterima_catatan')) AS qa_accepted,(SELECT COUNT(*) FROM evidence_verification_steps v WHERE v.year=o.year AND v.opd_id=o.id AND v.stage='bpkp' AND v.status IN ('diterima','diterima_catatan')) AS bpkp_accepted FROM opd_data o LEFT JOIN pemda_opd_sampling s ON s.year=o.year AND s.opd_id=o.id WHERE o.year=? ORDER BY o.opd COLLATE NOCASE`).bind(String(year)).all();
        const items=(result.results||[]).filter(r=>sessionCanAccessOrg(authSession,String(r.opd_id),String(r.opd||''))||['admin','irban','bpkp'].includes(String(authSession?.role||''))).map(r=>({...r,selected:Number(r.selected)===1,qa_status:Number(r.qa_accepted)>0?'QA diterima':'Belum QA',bpkp_status:Number(r.bpkp_accepted)>0?'Diterima':'Belum diverifikasi'}));
        const selected=items.filter(x=>x.selected).length;
        return jsonResponse({status:'success',year:String(year),items,summary:{total:items.length,selected}});
      }
      case 'savePemdaSampling': {
        if(!['admin','irban'].includes(String(authSession?.role||'')))return jsonResponse({status:'error',message:'Pemilihan sampel hanya dapat dilakukan oleh Super Admin atau Irban.'},403);
        const items=Array.isArray(params.items)?params.items:[];if(items.length>100)throw new Error('Maksimal 100 OPD per penyimpanan.');
        const now=Date.now();const username=String(authSession.username||'');
        for(const item of items){const opdId=String(item?.opdId||'');if(!opdId)continue;await assertSessionCanAccessOpd(env,authSession,year,opdId);const selected=item.selected?1:0;const note=sanitizeVerificationField(item.note,1000);await runD1WithRetry(()=>env.DB.prepare(`INSERT INTO pemda_opd_sampling(year,opd_id,selected,note,selected_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(year,opd_id) DO UPDATE SET selected=excluded.selected,note=excluded.note,selected_by=excluded.selected_by,updated_at=excluded.updated_at`).bind(String(year),opdId,selected,note,username,now).run());}
        notifyRealtime(env,ctx,String(year),{action:'savePemdaSampling',year:String(year)});
        return jsonResponse({status:'success',message:'Kertas Kerja Pemda dan pilihan sampling berhasil disimpan.',updatedAt:now});
      }
      case 'getEvidenceWorkflow': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||'');
        await assertSessionCanAccessOpd(env,authSession,year,opdId);
        const file=await assertUploadBelongsToOpd(env,year,opdId,uploadId);
        if(!file)throw new Error('Evidence tidak ditemukan.');
        const rec=await env.DB.prepare('SELECT stage,status,examiner_name,note,updated_by,updated_at FROM evidence_verification_steps WHERE year=? AND opd_id=? AND upload_id=?').bind(String(year),opdId,uploadId).all();
        const stages={opd:{stage:'opd',status:'menunggu',examinerName:'',note:'',updatedBy:'',updatedAt:0},qa:{stage:'qa',status:'menunggu',examinerName:'',note:'',updatedBy:'',updatedAt:0},bpkp:{stage:'bpkp',status:'menunggu',examinerName:'',note:'',updatedBy:'',updatedAt:0}};
        for(const row of (rec.results||[])){if(stages[row.stage])stages[row.stage]={stage:row.stage,status:row.status||'menunggu',examinerName:row.examiner_name||'',note:row.note||'',updatedBy:row.updated_by||'',updatedAt:Number(row.updated_at||0)};else if(row.stage==='irban'&&!stages.qa.updatedAt)stages.qa={stage:'qa',status:row.status||'menunggu',examinerName:row.examiner_name||'',note:row.note||'',updatedBy:row.updated_by||'',updatedAt:Number(row.updated_at||0)};}
        const history=(await env.DB.prepare('SELECT stage,status,examiner_name,note,updated_by,created_at FROM evidence_verification_audit WHERE year=? AND opd_id=? AND upload_id=? ORDER BY created_at DESC LIMIT 30').bind(String(year),opdId,uploadId).all()).results||[];
        return jsonResponse({status:'success',year:String(year),opdId,uploadId,fileName:file.fileName||'Evidence',stages,history});
      }
      case 'saveEvidenceWorkflowStep': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||''),stage=String(params.stage||'').toLowerCase();
        const role=String(authSession?.role||''),status=String(params.status||'');
        const examinerName=sanitizeVerificationField(params.examinerName||authSession?.display_name||authSession?.username,100);
        const note=sanitizeVerificationField(params.note,2000);
        if(!['opd','qa','bpkp'].includes(stage))throw new Error('Tahap verifikasi tidak valid.');
        const roleStage=(role==='ppupd'||role==='auditor')?'qa':role;if(role!=='admin'&&roleStage!==stage)return jsonResponse({status:'error',message:'Akun hanya dapat mengisi tahap sesuai role masing-masing.'},403);
        if(role==='opd'&&stage!=='opd')return jsonResponse({status:'error',message:'Akun OPD hanya dapat mengisi PM internal.'},403);
        const allowedStatuses=['diterima','diterima_catatan','dikembalikan'];
        if(!allowedStatuses.includes(status))throw new Error('Pilih hasil Diterima, Diterima dengan Catatan, atau Dikembalikan.');
        if(!opdId||!uploadId||!examinerName)throw new Error('OPD, file, dan nama pemeriksa wajib lengkap.');
        if(['diterima_catatan','dikembalikan'].includes(status)&&note.trim().length<2)throw new Error('Catatan wajib diisi untuk Diterima dengan Catatan atau Dikembalikan.');
        await assertSessionCanAccessOpd(env,authSession,year,opdId);
        const fileRecord=await assertUploadBelongsToOpd(env,year,opdId,uploadId);
        if(stage==='bpkp'){const sample=await env.DB.prepare('SELECT selected FROM pemda_opd_sampling WHERE year=? AND opd_id=? LIMIT 1').bind(String(year),opdId).all();if(Number(sample.results?.[0]?.selected||0)!==1)return jsonResponse({status:'error',code:'OPD_NOT_SAMPLED',message:'OPD ini belum dipilih sebagai sampel pada Kertas Kerja Pemerintah Kabupaten Mahakam Ulu.'},409);}
        const now=Date.now();
        const previousStage=stage==='qa'?'opd':(stage==='bpkp'?'qa':'');
        const previousStatuses=stage==='qa'?['diterima','diterima_catatan']:(stage==='bpkp'?['diterima','diterima_catatan']:[]);
        const baseValues=[String(year),opdId,uploadId,stage,status,examinerName,note,String(authSession.username||''),now];
        let write;
        if(previousStage){
          // Atomic prerequisite check: Irban may proceed only after Auditor sends;
          // BPKP may proceed after Irban accepts with or without notes.
          const statusClause=previousStatuses.length===1?'status=?':'status IN (?,?)';
          write=await env.DB.prepare(`INSERT INTO evidence_verification_steps(year,opd_id,upload_id,stage,status,examiner_name,note,updated_by,updated_at)
            SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (
              SELECT 1 FROM evidence_verification_steps WHERE year=? AND opd_id=? AND upload_id=? AND stage=? AND ${statusClause}
            ) ON CONFLICT(year,opd_id,upload_id,stage) DO UPDATE SET status=excluded.status,examiner_name=excluded.examiner_name,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
            .bind(...baseValues,String(year),opdId,uploadId,previousStage,...previousStatuses).run();
          if(!Number(write.meta?.changes||0))return jsonResponse({status:'error',code:'VERIFICATION_STAGE_CONFLICT',message:stage==='qa'?'PM internal asesor OPD belum Diterima atau Diterima dengan Catatan. Muat ulang status evidence sebelum QA.':'QA Auditor/PUPPD belum Diterima atau Diterima dengan Catatan. Muat ulang status sebelum verifikasi BPKP.'},409);
        }else{
          write=await env.DB.prepare(`INSERT INTO evidence_verification_steps(year,opd_id,upload_id,stage,status,examiner_name,note,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(year,opd_id,upload_id,stage) DO UPDATE SET status=excluded.status,examiner_name=excluded.examiner_name,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(...baseValues).run();
        }
        // When an upstream reviewer re-submits or returns a file, downstream decisions are invalidated.
        if(stage==='opd')await env.DB.prepare("DELETE FROM evidence_verification_steps WHERE year=? AND opd_id=? AND upload_id=? AND stage IN ('qa','bpkp')").bind(String(year),opdId,uploadId).run();
        if(stage==='qa')await env.DB.prepare("DELETE FROM evidence_verification_steps WHERE year=? AND opd_id=? AND upload_id=? AND stage='bpkp'").bind(String(year),opdId,uploadId).run();
        await env.DB.prepare('INSERT INTO evidence_verification_audit(year,opd_id,upload_id,stage,status,examiner_name,note,updated_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(String(year),opdId,uploadId,stage,status,examinerName,note,String(authSession.username||''),now).run();
        if(stage==='qa'){
          // Only QA decisions update the authoritative evidence verification score.
          await syncStructureVerificationForUpload(env,year,opdId,uploadId,status,examinerName,note,now);
        }
        if(fileRecord?.sourceType==='lhe_evidence'){
          const summaryStatus=stage==='bpkp'?(status==='diterima'?'Terverifikasi akhir BPKP':'Dikembalikan oleh BPKP'):(stage==='qa'?(status==='diterima'?'Menunggu verifikasi BPKP jika masuk sampel':'Perlu perbaikan oleh OPD'):'Menunggu QA Auditor/PUPPD');
          await env.DB.prepare('UPDATE lhe_followup_items SET verification_status=?,verifier_name=?,verifier_note=?,updated_by=?,updated_at=? WHERE id=? AND year=? AND opd_id=?').bind(summaryStatus,examinerName,note,String(authSession.username||''),now,String(fileRecord.followupId),String(year),opdId).run();
        }
        notifyRealtime(env,ctx,String(year),{action:'saveEvidenceWorkflowStep',opdId,uploadId,stage,status});
        return jsonResponse({status:'success',message:'Tahap verifikasi tersimpan.',stage,status,updatedAt:now});
      }
      case 'getLheFollowups': {
        const opdId=String(params.opdId||'');if(!opdId)throw new Error('OPD wajib dipilih.');
        const result=await env.DB.prepare('SELECT * FROM lhe_followup_items WHERE year=? AND opd_id=? ORDER BY source_year DESC,recommendation_ref,id').bind(String(year),opdId).all();
        const items=(result.results||[]).map(item=>{let evidence=[];try{evidence=JSON.parse(item.evidence_json||'[]')}catch{};return {...item,evidence:Array.isArray(evidence)?evidence.map(f=>({...f,url:f?.uploadId?privateEvidenceUrl(year,opdId,f.uploadId):f.url})):[]};});
        return jsonResponse({status:'success',items});
      }
      case 'saveLheFollowup': {
        const opdId=String(params.opdId||''),id=String(params.id||crypto.randomUUID());if(!opdId)throw new Error('OPD wajib dipilih.');
        const clean=(v,max=4000)=>sanitizeQaText(v,max);
        // `year` is the active/target budget year and keys the follow-up row. `source_year`
        // records the actual year on the source LHE; keep valid historical source years intact.
        const sourceYear=String(params.sourceYear||year||new Date().getFullYear());
        if(!/^\d{4}$/.test(sourceYear)||Number(sourceYear)<2000||Number(sourceYear)>new Date().getFullYear()+2)throw new Error('Tahun sumber LHE harus berupa tahun 4 digit yang valid. Tahun Anggaran tindak lanjut mengikuti Tahun Anggaran yang dipilih di aplikasi.');
        const recommendationRef=clean(params.recommendationRef,50),recommendation=clean(params.recommendation,4000),actionPlan=clean(params.actionPlan,4000),indicator=clean(params.indicator,2000),evidenceRequired=clean(params.evidenceRequired,4000),pic=clean(params.pic,500),dueDate=clean(params.dueDate,160),actualAction=clean(params.actualAction,4000),status=clean(params.status||'Belum dilaksanakan',80);
        if(!recommendationRef||!recommendation)throw new Error('Nomor referensi dan ringkasan rekomendasi wajib diisi.');
        const allowedStatus=['Belum dilaksanakan','Dalam proses','Sudah ditindaklanjuti','Belum diverifikasi','Ditolak / perlu perbaikan'];if(!allowedStatus.includes(status))throw new Error('Status tindak lanjut tidak valid.');
        const existing=await env.DB.prepare('SELECT id,source_year,recommendation_ref,recommendation,action_plan,indicator,evidence_required,pic,due_date,actual_action,status,evidence_json FROM lhe_followup_items WHERE id=? AND year=? AND opd_id=? LIMIT 1').bind(id,String(year),opdId).first();
        const now=Date.now();
        if(existing){
          const incoming={source_year:sourceYear,recommendation_ref:recommendationRef,recommendation,action_plan:actionPlan,indicator,evidence_required:evidenceRequired,pic,due_date:dueDate,actual_action:actualAction,status};
          const changed=Object.entries(incoming).some(([key,value])=>String(existing[key]??'')!==String(value??''));
          await env.DB.prepare(`UPDATE lhe_followup_items SET source_year=?,recommendation_ref=?,recommendation=?,action_plan=?,indicator=?,evidence_required=?,pic=?,due_date=?,actual_action=?,status=?,verification_status=CASE WHEN ?=1 THEN 'Belum diverifikasi' ELSE verification_status END,verifier_name=CASE WHEN ?=1 THEN '' ELSE verifier_name END,verifier_note=CASE WHEN ?=1 THEN '' ELSE verifier_note END,updated_by=?,updated_at=? WHERE id=? AND year=? AND opd_id=?`).bind(sourceYear,recommendationRef,recommendation,actionPlan,indicator,evidenceRequired,pic,dueDate,actualAction,status,changed?1:0,changed?1:0,changed?1:0,String(authSession.username||''),now,id,String(year),opdId).run();
          // A material edit invalidates prior approvals for attached files. Audit history remains for traceability.
          if(changed){let files=[];try{files=JSON.parse(existing.evidence_json||'[]')}catch{};for(const file of (Array.isArray(files)?files:[])){if(file?.uploadId)await env.DB.prepare('DELETE FROM evidence_verification_steps WHERE year=? AND opd_id=? AND upload_id=?').bind(String(year),opdId,String(file.uploadId)).run();}}
        } else {
          await env.DB.prepare(`INSERT INTO lhe_followup_items(id,year,opd_id,source_year,recommendation_ref,recommendation,action_plan,indicator,evidence_required,pic,due_date,actual_action,status,evidence_json,verification_status,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,String(year),opdId,sourceYear,recommendationRef,recommendation,actionPlan,indicator,evidenceRequired,pic,dueDate,actualAction,status,'[]','Belum diverifikasi',String(authSession.username||''),String(authSession.username||''),now,now).run();
        }
        notifyRealtime(env,ctx,String(year),{action:'saveLheFollowup',opdId,followupId:id});
        return jsonResponse({status:'success',id,message:'Butir tindak lanjut LHE SPIP tersimpan.'});
      }
      case 'deleteLheFollowup': {
        const id=String(params.id||''),opdId=String(params.opdId||'');if(!id||!opdId)throw new Error('ID butir dan OPD wajib lengkap.');
        await assertSessionCanAccessOpd(env,authSession,String(year),opdId);
        const record=await env.DB.prepare('SELECT evidence_json FROM lhe_followup_items WHERE id=? AND year=? AND opd_id=? LIMIT 1').bind(id,String(year),opdId).first();if(!record)throw new Error('Butir tindak lanjut tidak ditemukan.');
        const evidenceRaw=String(record.evidence_json||'[]');let evidence=[];let evidenceParseFailed=false;
        try{evidence=JSON.parse(evidenceRaw)}catch{evidenceParseFailed=true;}if(!Array.isArray(evidence)){evidence=[];evidenceParseFailed=true;}
        // Compare-and-swap the exact version before cleaning storage. If another
        // operator uploads/edits at the same time, nothing is deleted on conflict.
        const deleted=await runD1WithRetry(()=>env.DB.prepare("DELETE FROM lhe_followup_items WHERE id=? AND year=? AND opd_id=? AND COALESCE(evidence_json,'[]')=?").bind(id,String(year),opdId,evidenceRaw).run());
        if(!Number(deleted.meta?.changes||0))return jsonResponse({status:'error',code:'LHE_DELETE_CONFLICT',message:'Butir berubah karena operator lain sedang menyimpan. Muat ulang daftar lalu ulangi hapus.'},409);
        const cleanupWarnings=evidenceParseFailed?['Data bukti lama tidak dapat dibaca; mohon admin memeriksa kemungkinan file yatim di Google Drive/R2.']:[];
        for(const file of evidence)cleanupWarnings.push(...await cleanupLheEvidenceArtifacts(env,year,opdId,file));
        notifyRealtime(env,ctx,String(year),{action:'deleteLheFollowup',opdId,followupId:id});
        return jsonResponse({status:'success',message:'Butir tindak lanjut dihapus.',cleanupWarnings});
      }
      case 'uploadLheEvidence': {
        assertGoogleDriveConfigured(env);const opdId=String(params.opdId||''),followupId=String(params.followupId||''),uploadId=String(params.uploadId||crypto.randomUUID());
        if(!opdId||!followupId)throw new Error('OPD dan butir tindak lanjut wajib dipilih.');
        const rec=await env.DB.prepare('SELECT id,source_year,evidence_json FROM lhe_followup_items WHERE id=? AND year=? AND opd_id=? LIMIT 1').bind(followupId,String(year),opdId).first();if(!rec)throw new Error('Butir tindak lanjut tidak ditemukan.');
        const file=params.file;let bytes=null;let body=null;let fileName=sanitizeString(params.fileName||file?.name||'bukti').slice(0,150)||'bukti';const fileType=params.fileType||file?.type||'application/octet-stream';
        if(file){fileName=sanitizeString(file.name||fileName).slice(0,150)||'bukti';if(file.size>10*1024*1024)throw new Error('File melebihi 10 MB.');bytes=new Uint8Array(await file.arrayBuffer());}else if(params.fileData){bytes=decodeBase64File(params.fileData,10);}else{const size=Number(request.headers.get('Content-Length')||0);if(size>10*1024*1024)throw new Error('File melebihi 10 MB.');body=request.body;}
        const opdRec=await env.DB.prepare('SELECT opd FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(opdId,String(year)).first();if(!opdRec)throw new Error('OPD tidak ditemukan.');
        const safeOpd=sanitizeString(opdRec.opd||'OPD').replace(/[^A-Za-z0-9_. -]/g,'_').slice(0,80)||'OPD';const key=`kawal_spip/${year}/${safeOpd}/Tindak Lanjut LHE SPIP/${rec.source_year}/${followupId}/${uploadId}-${fileName}`;
        await env.EVIDENCE_BUCKET.put(key,body||bytes,{httpMetadata:{contentType:fileType}});
        const item={uploadId,fileName,fileType,r2Key:key,gdriveId:null,syncStatus:'pending',uploadedAt:new Date().toISOString(),url:privateEvidenceUrl(year,opdId,uploadId)};
        let evidence=[];try{evidence=JSON.parse(rec.evidence_json||'[]')}catch{};evidence=Array.isArray(evidence)?evidence:[];evidence.push(item);
        await env.DB.prepare("UPDATE lhe_followup_items SET evidence_json=?,verification_status='Belum diverifikasi',verifier_name='',verifier_note='',updated_by=?,updated_at=? WHERE id=? AND year=? AND opd_id=?").bind(JSON.stringify(evidence),String(authSession.username||''),Date.now(),followupId,String(year),opdId).run();
        let gdriveId=null,syncStatus='retrying',driveError='';
        try{gdriveId=await directGoogleDriveBackup(env,{type:'lhe_evidence',uploadId,year,opdId,opdName:opdRec.opd,followupId,r2Key:key,fileName,fileType});syncStatus='done';evidence[evidence.length-1]={...item,gdriveId,syncStatus};}
        catch(e){driveError=String(e?.message||e);evidence[evidence.length-1]={...item,syncStatus:'retrying',syncError:driveError};}
        await env.DB.prepare("UPDATE lhe_followup_items SET evidence_json=?,verification_status='Belum diverifikasi',verifier_name='',verifier_note='',updated_by=?,updated_at=? WHERE id=? AND year=? AND opd_id=?").bind(JSON.stringify(evidence),String(authSession.username||''),Date.now(),followupId,String(year),opdId).run();
        notifyRealtime(env,ctx,String(year),{action:'uploadLheEvidence',opdId,followupId,uploadId,syncStatus});
        return jsonResponse({status:'success',message:syncStatus==='done'?'Bukti berhasil diunggah dan dicadangkan ke Google Drive.':'Bukti aman di R2, tetapi sinkronisasi Google Drive perlu diperiksa.',file:{...evidence[evidence.length-1],url:privateEvidenceUrl(year,opdId,uploadId)},syncStatus,driveError});
      }
      case 'deleteLheEvidence': {
        const opdId=String(params.opdId||''),followupId=String(params.followupId||''),uploadId=String(params.uploadId||'');if(!opdId||!followupId||!uploadId)throw new Error('Identitas file bukti tidak lengkap.');
        await assertSessionCanAccessOpd(env,authSession,String(year),opdId);
        let fileToDelete=null,committed=false;
        for(let attempt=0;attempt<6;attempt++){
          const rec=await env.DB.prepare('SELECT evidence_json FROM lhe_followup_items WHERE id=? AND year=? AND opd_id=? LIMIT 1').bind(followupId,String(year),opdId).first();
          if(!rec)throw new Error('Butir tindak lanjut tidak ditemukan.');
          const evidenceRaw=String(rec.evidence_json||'[]');let list=[];try{list=JSON.parse(evidenceRaw)}catch{};if(!Array.isArray(list))list=[];
          fileToDelete=list.find(x=>String(x?.uploadId||x?.upload_id||'')===uploadId)||null;if(!fileToDelete)throw new Error('File bukti tidak ditemukan.');
          const nextList=list.filter(x=>String(x?.uploadId||x?.upload_id||'')!==uploadId);
          const write=await runD1WithRetry(()=>env.DB.prepare("UPDATE lhe_followup_items SET evidence_json=?,verification_status='Belum diverifikasi',verifier_name='',verifier_note='',updated_by=?,updated_at=? WHERE id=? AND year=? AND opd_id=? AND COALESCE(evidence_json,'[]')=?").bind(JSON.stringify(nextList),String(authSession.username||''),Date.now(),followupId,String(year),opdId,evidenceRaw).run());
          if(Number(write.meta?.changes||0)>0){committed=true;break;}
          fileToDelete=null;await new Promise(resolve=>setTimeout(resolve,20*(attempt+1)));
        }
        if(!committed||!fileToDelete)return jsonResponse({status:'error',code:'LHE_EVIDENCE_DELETE_CONFLICT',message:'Daftar bukti sedang berubah karena operator lain. Muat ulang lalu coba lagi.'},409);
        const cleanupWarnings=await cleanupLheEvidenceArtifacts(env,year,opdId,fileToDelete);
        notifyRealtime(env,ctx,String(year),{action:'deleteLheEvidence',opdId,followupId,uploadId});return jsonResponse({status:'success',message:'File bukti dihapus.',cleanupWarnings});
      }
      case 'getSubunsurData':
        return new Response(JSON.stringify(SUBUNSUR_DATA), { status: 200, headers: { 'Content-Type': 'application/json' } });

      case 'verifyAccess': {
        let configuredAccounts=[];try{await ensureAuthUsersSeeded(env);configuredAccounts=parseAccountConfig(env)}catch(e){return jsonResponse({status:'error',message:e.message},500)}
        const accountCount=Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM auth_users').first())?.n||0);
        const ok = !configuredAccounts.length && accountCount===0 && Boolean(ACCESS_PASSWORD) && params.password === ACCESS_PASSWORD;
        if (ok) {
          try { await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ? AND action = ?").bind(clientIp, action).run(); } catch {}
          const created=await createAuthSession(env,{username:'admin',displayName:'Administrator',role:'admin',opdIds:[],opdNames:[]});
          return jsonResponse({ status: 'success', message: 'Akses diterima', user:publicSessionUser(created.session) }, 200, {'Set-Cookie':sessionCookie(created.token)});
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

      case 'getKkMasterSheetRows': {
        const masterKind=String(params.masterKind||'PK').toUpperCase()==='PM'?'PM':'PK';
        try{
          const snapshot=await readLiveKkMasterRows(env,masterKind,{forceRefresh:params.forceRefresh===true||params.forceRefresh==='true'});
          if(masterKind==='PM'&&snapshot.live)schedulePmMasterPropagation(env,year,ctx);
          return jsonResponse({status:'success',...snapshot});
        }catch(err){return jsonResponse({status:'success',live:false,masterKind,message:String(err?.message||err).slice(0,500),fallback:'snapshot'});}
      }
      case 'syncKkPmMasterNow': {
        const configured=String(env.KK_MASTER_SYNC_SECRET||'').trim();
        const supplied=String(params.secret||request.headers.get('X-KK-Master-Sync-Secret')||'').trim();
        if(!configured||configured.length<32||supplied!==configured)return jsonResponse({status:'error',message:'Token sinkronisasi master tidak valid atau belum dikonfigurasi.'},403);
        try{
          const result=await syncPmMasterColumnsToOpdWorkbooks(env,year,{force:true});
          const masterId=String(result.masterSpreadsheetId||extractSpreadsheetId(env.GOOGLE_SHEETS_PM_TEMPLATE_ID||''));
          if(masterId){const key=`PM:${masterId}`;LIVE_KK_MASTER_ROWS_GENERATION.set(key,(LIVE_KK_MASTER_ROWS_GENERATION.get(key)||0)+1);LIVE_KK_MASTER_ROWS_CACHE.delete(key);}
          return jsonResponse({status:'success',message:'Sinkronisasi master KK PM diproses; cache master lokal telah diinvalidasi.',...result});
        }catch(err){return jsonResponse({status:'error',message:String(err?.message||err).slice(0,600)},500);}
      }

      case 'getBpkpOfficialScore': {
        const found = (await env.DB.prepare('SELECT year,spip,mri,iepk,apip,finalized,updated_at,updated_by,note FROM bpkp_official_scores WHERE year=? LIMIT 1').bind(String(year)).all()).results?.[0] || null;
        const score = found && Number(found.finalized)===1 ? found : (found ? {year:String(year),finalized:0,updated_at:found.updated_at||0} : null);
        return jsonResponse({status:'success',year:String(year),score});
      }
      case 'getBpkpOfficialScoreAdmin': {
        const configured=String(env.BPKP_ADMIN_PASSWORD||'');
        if(configured.length<12)return jsonResponse({status:'error',message:'Secret BPKP_ADMIN_PASSWORD belum dikonfigurasi.'},503);
        if(String(params.adminPassword||'')!==configured)return jsonResponse({status:'error',message:'Password admin nilai resmi salah.'},403);
        const score=(await env.DB.prepare('SELECT year,spip,mri,iepk,apip,finalized,updated_at,updated_by,note FROM bpkp_official_scores WHERE year=? LIMIT 1').bind(String(year)).all()).results?.[0]||null;
        return jsonResponse({status:'success',year:String(year),score});
      }
      case 'getBpkpOfficialAudit': {
        const configured=String(env.BPKP_ADMIN_PASSWORD||'');
        if(configured.length<12)return jsonResponse({status:'error',message:'Secret BPKP_ADMIN_PASSWORD belum dikonfigurasi.'},503);
        if(String(params.adminPassword||'')!==configured)return jsonResponse({status:'error',message:'Password admin nilai resmi salah.'},403);
        const q=await env.DB.prepare('SELECT action,payload,updated_by,created_at FROM bpkp_official_score_audit WHERE year=? ORDER BY created_at DESC LIMIT 10').bind(String(year)).all();
        const entries=(q.results||[]).map(x=>{let payload={};try{payload=JSON.parse(x.payload||'{}')}catch{}return{action:x.action,payload,updatedBy:x.updated_by,createdAt:Number(x.created_at||0)}});
        return jsonResponse({status:'success',entries});
      }
      case 'saveBpkpOfficialScore': {
        const configured=String(env.BPKP_ADMIN_PASSWORD||'');
        if(configured.length<12) return jsonResponse({status:'error',message:'Secret BPKP_ADMIN_PASSWORD belum dikonfigurasi dengan aman di Cloudflare.'},503);
        if(String(params.adminPassword||'')!==configured) return jsonResponse({status:'error',message:'Password admin finalisasi BPKP salah.'},403);
        const prior=(await env.DB.prepare('SELECT finalized FROM bpkp_official_scores WHERE year=? LIMIT 1').bind(String(year)).all()).results?.[0];
        if(Number(prior?.finalized||0)===1) return jsonResponse({status:'error',message:'Nilai resmi sudah dikunci. Gunakan Buka Kunci terlebih dahulu sebelum mengubahnya.'},409);
        const parseScore=(key)=>{const n=Number(params[key]);if(!Number.isFinite(n)||n<1||n>5)throw new Error(`${key.toUpperCase()} harus bernilai 1 sampai 5.`);return n;};
        const spip=parseScore('spip'),mri=parseScore('mri'),iepk=parseScore('iepk');
        const apip=Number(params.apip);if(!Number.isInteger(apip)||apip<1||apip>5)throw new Error('Kapabilitas APIP harus berupa level bulat 1 sampai 5.');
        const finalizing=['1','true','yes','on'].includes(String(params.finalize||'').toLowerCase());
        const by=String(params.updatedBy||'Admin Inspektorat').trim().slice(0,120)||'Admin Inspektorat';
        const note=String(params.note||'').trim().slice(0,2000);const now=Date.now();
        await env.DB.prepare(`INSERT INTO bpkp_official_scores(year,spip,mri,iepk,apip,finalized,updated_at,updated_by,note) VALUES(?,?,?,?,?,?,?,?,?)
          ON CONFLICT(year) DO UPDATE SET spip=excluded.spip,mri=excluded.mri,iepk=excluded.iepk,apip=excluded.apip,finalized=excluded.finalized,updated_at=excluded.updated_at,updated_by=excluded.updated_by,note=excluded.note`)
          .bind(String(year),spip,mri,iepk,apip,finalizing?1:0,now,by,note).run();
        const payload=JSON.stringify({spip,mri,iepk,apip,finalized:finalizing,note});
        await env.DB.prepare('INSERT INTO bpkp_official_score_audit(year,action,payload,updated_by,created_at) VALUES(?,?,?,?,?)').bind(String(year),finalizing?'finalize':'save-draft',payload,by,now).run();
        notifyRealtime(env,ctx,String(year),{action:'bpkpOfficialScoreUpdated'});
        return jsonResponse({status:'success',message:finalizing?'Nilai resmi BPKP berhasil dikunci dan difinalisasi.':'Draft nilai resmi berhasil disimpan.',score:{year:String(year),spip,mri,iepk,apip,finalized:finalizing?1:0,updated_at:now,updated_by:by,note}});
      }
      case 'unlockBpkpOfficialScore': {
        const configured=String(env.BPKP_ADMIN_PASSWORD||'');
        if(configured.length<12) return jsonResponse({status:'error',message:'Secret BPKP_ADMIN_PASSWORD belum dikonfigurasi di Cloudflare.'},503);
        if(String(params.adminPassword||'')!==configured) return jsonResponse({status:'error',message:'Password admin finalisasi BPKP salah.'},403);
        const by=String(params.updatedBy||'Admin Inspektorat').trim().slice(0,120)||'Admin Inspektorat';const now=Date.now();
        const res=await env.DB.prepare('UPDATE bpkp_official_scores SET finalized=0,updated_at=?,updated_by=? WHERE year=? AND finalized=1').bind(now,by,String(year)).run();
        if(!Number(res.meta?.changes||0)) return jsonResponse({status:'error',message:'Tidak ada nilai resmi yang sedang terkunci.'},409);
        await env.DB.prepare('INSERT INTO bpkp_official_score_audit(year,action,payload,updated_by,created_at) VALUES(?,?,?,?,?)').bind(String(year),'unlock','{}',by,now).run();
        notifyRealtime(env,ctx,String(year),{action:'bpkpOfficialScoreUpdated'});
        return jsonResponse({status:'success',message:'Kunci nilai resmi dibuka. Anda dapat memperbaiki draft.'});
      }
      case 'saveAssessmentStatus': {
        if(!['admin','irban'].includes(String(authSession?.role||''))) return jsonResponse({status:'error',message:'Hanya Admin atau Irban yang dapat mengubah status verifikasi OPD.'},403);
        const status=String(params.assessmentStatus||'');
        const allowed=['Belum Mengisi','Proses Pengisian','Proses Review','Selesai Verifikasi'];
        if(!allowed.includes(status)) return jsonResponse({status:'error',message:'Status pengisian tidak valid.'},400);
        const opdId=String(params.opdId||'');
        const upd=await env.DB.prepare('UPDATE opd_data SET assessment_status=?,assessment_status_updated_at=? WHERE id=? AND year=?').bind(status,Date.now(),opdId,String(year)).run();
        if(!Number(upd.meta?.changes||0)) return jsonResponse({status:'error',message:'OPD tidak ditemukan.'},404);
        notifyRealtime(env,ctx,String(year),{action:'saveAssessmentStatus',opdId});
        return jsonResponse({status:'success',message:'Status pengisian OPD berhasil diperbarui.',assessmentStatus:status});
      }
      case 'getData': {
        await ensureDefaultMahuluOpds(env,year);
        const {results}=await env.DB.prepare("SELECT * FROM opd_data WHERE year=? ORDER BY CAST(nilai_maturitas AS REAL) DESC, CAST(nilai_struktur_proses AS REAL) DESC, CAST(mri AS REAL) DESC, CAST(iepk AS REAL) DESC").bind(year).all();
        const levelRows=await env.DB.prepare("SELECT opd_id,subunsur,param_id,level FROM opd_parameter_levels_v2 WHERE year=?").bind(String(year)).all();
        const qaSummaryRows=await env.DB.prepare(`
          SELECT opd_id,
                 SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) AS evaluated_items,
                 SUM(CASE WHEN availability='N/A' THEN 1 ELSE 0 END) AS na_items,
                 COALESCE(SUM(CASE WHEN score IS NOT NULL THEN score ELSE 0 END),0) AS sum_score,
                 SUM(CASE WHEN score=1 THEN 1 ELSE 0 END) AS pass_items,
                 SUM(CASE WHEN score=0.5 THEN 1 ELSE 0 END) AS partial_items,
                 SUM(CASE WHEN score=0 THEN 1 ELSE 0 END) AS fail_items
          FROM opd_qa_apip_items WHERE year=? GROUP BY opd_id
        `).bind(String(year)).all();
        const qaSummaryMap=new Map();
        for(const q of (qaSummaryRows.results||[])) qaSummaryMap.set(String(q.opd_id),q);
        const kkPmSummaryRows=await env.DB.prepare(`
          SELECT opd_id,target,
                 COUNT(*) AS evaluated_items,
                 COALESCE(SUM(CASE grade_result WHEN 'A' THEN 5 WHEN 'B' THEN 4 WHEN 'C' THEN 3 WHEN 'D' THEN 2 WHEN 'E' THEN 1 ELSE 0 END),0) AS sum_levels
          FROM opd_kk_pm_workpaper_items
          WHERE year=? AND grade_result IN ('A','B','C','D','E') GROUP BY opd_id,target
        `).bind(String(year)).all();
        const kkPmSummaryMap=new Map();
        for(const q of (kkPmSummaryRows.results||[])){
          const key=String(q.opd_id);if(!kkPmSummaryMap.has(key))kkPmSummaryMap.set(key,[]);kkPmSummaryMap.get(key).push(q);
        }
        const workbookEvidenceSummaryRows=await env.DB.prepare(`
          SELECT opd_id,
                 COUNT(DISTINCT upload_id) AS total_files,
                 COUNT(DISTINCT evidence_key) AS evidence_groups,
                 COUNT(DISTINCT CASE WHEN verification_status='diterima' THEN upload_id END) AS verified_files,
                 COUNT(DISTINCT CASE WHEN verification_status IN ('diterima','diterima_catatan','dikembalikan') THEN upload_id END) AS reviewed_files,
                 COUNT(DISTINCT CASE WHEN verification_status='diterima_catatan' THEN upload_id END) AS with_notes_files,
                 COUNT(DISTINCT CASE WHEN verification_status='dikembalikan' THEN upload_id END) AS returned_files,
                 COUNT(DISTINCT CASE WHEN sync_status='done' THEN upload_id END) AS synced_files,
                 COUNT(DISTINCT CASE WHEN target_code='T1' OR COALESCE(target_code,'')='' THEN evidence_key END) AS groups_t1,
                 COUNT(DISTINCT CASE WHEN target_code='T2' THEN evidence_key END) AS groups_t2,
                 COUNT(DISTINCT CASE WHEN target_code='T3' THEN evidence_key END) AS groups_t3,
                 COUNT(DISTINCT CASE WHEN target_code='T4' THEN evidence_key END) AS groups_t4,
                 COUNT(DISTINCT CASE WHEN target_code='T1' OR COALESCE(target_code,'')='' THEN upload_id END) AS files_t1,
                 COUNT(DISTINCT CASE WHEN target_code='T2' THEN upload_id END) AS files_t2,
                 COUNT(DISTINCT CASE WHEN target_code='T3' THEN upload_id END) AS files_t3,
                 COUNT(DISTINCT CASE WHEN target_code='T4' THEN upload_id END) AS files_t4,
                 COUNT(DISTINCT CASE WHEN (target_code='T1' OR COALESCE(target_code,'')='') AND verification_status='diterima' THEN upload_id END) AS verified_t1,
                 COUNT(DISTINCT CASE WHEN target_code='T2' AND verification_status='diterima' THEN upload_id END) AS verified_t2,
                 COUNT(DISTINCT CASE WHEN target_code='T3' AND verification_status='diterima' THEN upload_id END) AS verified_t3,
                 COUNT(DISTINCT CASE WHEN target_code='T4' AND verification_status='diterima' THEN upload_id END) AS verified_t4
          FROM opd_workbook_evidence_items
          WHERE year=? AND TRIM(COALESCE(r2_key,''))<>'' AND TRIM(COALESCE(file_name,''))<>''
          GROUP BY opd_id
        `).bind(String(year)).all();
        const workbookEvidenceSummaryMap=new Map();
        for(const q of (workbookEvidenceSummaryRows.results||[])) workbookEvidenceSummaryMap.set(String(q.opd_id),q);
        // One batched read supplies the authoritative status/level source for every OPD.
        // Do not derive the reported score from self-selected parameter levels.
        const verifiedEvidenceQuery=await env.DB.prepare(`SELECT opd_id,upload_id,subunsur,param_id,level,verification_status,verification_at,updated_at,r2_key,file_name
          FROM opd_workbook_evidence_items WHERE year=?
          ORDER BY opd_id,upload_id`).bind(String(year)).all();
        const verifiedEvidenceMap=new Map();
        for(const evidenceRow of (verifiedEvidenceQuery.results||[])){
          const key=String(evidenceRow.opd_id||'');if(!verifiedEvidenceMap.has(key))verifiedEvidenceMap.set(key,[]);verifiedEvidenceMap.get(key).push(evidenceRow);
        }
        const levelMap=new Map();
        for(const lr of (levelRows.results||[])){
          const key=`${lr.opd_id}|${lr.subunsur}|${lr.param_id}`;
          levelMap.set(key,Math.max(0,Math.min(5,Number(lr.level)||0)));
        }
        // Persist a one-time correction for old cached score columns as the data is read.
        // Only OPDs in the current session scope are touched, and compare-and-swap checks
        // both the JSON input and the full evidence fingerprint to avoid stale writes.
        const scoreRefreshCandidates=[];
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
          // Selected level remains useful for workbook entry, but the dashboard score
          // is calculated only from accepted evidence, not from unverified selections.
          const structureEvidenceRows=verifiedEvidenceMap.get(String(r.id))||[];
          const verifiedStructureBreakdown=calculateVerifiedStructureProcessBreakdown(subunsurs,structureEvidenceRows);
          const strukturStatus=verifiedStructureBreakdown.verifiedParams>=verifiedStructureBreakdown.totalParams&&verifiedStructureBreakdown.totalParams>0?'Selesai':(verifiedStructureBreakdown.verifiedParams>0?'Proses':'Belum');
          const scoreMatchesStored=(value)=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Math.round(Number(value)*100)===Math.round(verifiedStructureBreakdown.value*100);
          if((!scoreMatchesStored(r.sa)||!scoreMatchesStored(r.nilai_struktur_proses)||String(r.struktur_proses_status||'')!==strukturStatus)&&sessionCanAccessOrg(authSession,r.id,r.opd)){
            scoreRefreshCandidates.push({id:String(r.id),rawSubunsurs:r.subunsurs===null||r.subunsurs===undefined?'{}':String(r.subunsurs),oldSa:r.sa===null||r.sa===undefined?-9999:r.sa,oldNilai:r.nilai_struktur_proses===null||r.nilai_struktur_proses===undefined?-9999:r.nilai_struktur_proses,oldStatus:String(r.struktur_proses_status||''),value:verifiedStructureBreakdown.value,status:strukturStatus,fingerprint:structureEvidenceFingerprint(structureEvidenceRows)});
          }
          const wb=workbookEvidenceSummaryMap.get(String(r.id));
          const qaEvidenceFiles=Number(wb?.total_files||0);
          const q=qaSummaryMap.get(String(r.id));
          const qaEvaluated=Number(q?.evaluated_items||0);
          const qaNa=Number(q?.na_items||0);
          const qaSum=Number(q?.sum_score||0);
          const qaPass=Number(q?.pass_items||0);
          const qaPartial=Number(q?.partial_items||0);
          const qaFail=Number(q?.fail_items||0);
          const qaTotalItems=671;
          const qaChecked=qaEvaluated+qaNa;
          const qaPending=Math.max(0,qaTotalItems-qaChecked);
          const qaPercentage=qaEvaluated?Math.round((qaSum/qaEvaluated)*10000)/100:0;
          const qaCompletion=Math.round((qaChecked/qaTotalItems)*10000)/100;
          const qaStatus=qaCompletion>=100?'Selesai':(qaChecked>0?'Proses':'Belum');
          const pmRows=kkPmSummaryMap.get(String(r.id))||[];
          const pmScope=new Set(assessmentAllowedTargets(r.opd));
          const pmScopedRows=pmRows.filter(item=>pmScope.has(String(item.target||'').toUpperCase()));
          const pmEvaluated=pmScopedRows.reduce((n,item)=>n+Number(item.evaluated_items||0),0);
          const pmSum=pmScopedRows.reduce((n,item)=>n+Number(item.sum_levels||0),0);
          const pmTotalItems=[...pmScope].reduce((n,target)=>n+(KK_PM_TARGET_TOTALS[target]||0),0);
          const pmPending=Math.max(0,pmTotalItems-pmEvaluated);
          const pmCompletion=pmTotalItems>0 ? Math.min(100,Math.round((pmEvaluated/pmTotalItems)*10000)/100) : 0;
          const pmAvgLevel=pmEvaluated>0 ? Math.round((pmSum/pmEvaluated)*100)/100 : 0;
          const pmStatus=pmCompletion>=100?'Selesai':(pmEvaluated>0?'Proses':'Belum');
          let computedWorkbook={}; try{computedWorkbook=r.computed_workbook_data?JSON.parse(r.computed_workbook_data):{};}catch{computedWorkbook={};}
          const cv=computedWorkbook?.values||{};
          const n=(v)=>{const x=Number(v); return Number.isFinite(x)&&x>0?x:null;};
          return{...r,subunsurs,parameterLevels,totalParameterLevels:totalParams,selectedParameterLevels:selected,sumParameterLevels:sumLevels,kkData,kkPmData,kkRtpData,rtpEvidence,rtpEvidenceFolder:r.rtp_evidence_folder||'Evidence RTP',pmSpipReports,pmSpipFolder:r.pm_spip_folder||'Laporan Hasil PM SPIP',pmSpipFolderId:r.pm_spip_folder_id||null,rrRtpReports,rrRtpFolder:r.rr_rtp_folder||'Laporan Pemantauan RR_RTP',rrRtpFolderId:r.rr_rtp_folder_id||null,qaApip:qaStatus,qaApipSummary:{total:qaTotalItems,checked:qaChecked,evaluated:qaEvaluated,na:qaNa,pass:qaPass,partial:qaPartial,fail:qaFail,pending:qaPending,sum:qaSum,percentage:qaPercentage,completion:qaCompletion,evidenceFiles:qaEvidenceFiles,status:qaStatus},kkPmSummary:{total:pmTotalItems,evaluated:pmEvaluated,na:0,pending:pmPending,sum:pmSum,percentage:pmCompletion,completion:pmCompletion,avgLevel:pmAvgLevel,status:pmStatus,targets:[...pmScope]},nilaiStrukturProses:verifiedStructureBreakdown.value,sa:verifiedStructureBreakdown.value,strukturProsesStatus:strukturStatus,structureProcessBreakdown:verifiedStructureBreakdown,computedWorkbook, nilaiMaturitas:n(cv.nilaiMaturitas),nilaiMRI:n(cv.mri),nilaiIEPK:n(cv.iepk),nilaiKapabilitasApip:n(cv.nilaiKapabilitasApip),mri:n(cv.mri),iepk:n(cv.iepk),workbookEvidenceSummary:{totalFiles:Number(wb?.total_files||0),evidenceGroups:Number(wb?.evidence_groups||0),verifiedFiles:Number(wb?.verified_files||0),reviewedFiles:Number(wb?.reviewed_files||0),withNotesFiles:Number(wb?.with_notes_files||0),returnedFiles:Number(wb?.returned_files||0),syncedFiles:Number(wb?.synced_files||0),targetStats:{T1:{groups:Number(wb?.groups_t1||0),files:Number(wb?.files_t1||0),verifiedFiles:Number(wb?.verified_t1||0)},T2:{groups:Number(wb?.groups_t2||0),files:Number(wb?.files_t2||0),verifiedFiles:Number(wb?.verified_t2||0)},T3:{groups:Number(wb?.groups_t3||0),files:Number(wb?.files_t3||0),verifiedFiles:Number(wb?.verified_t3||0)},T4:{groups:Number(wb?.groups_t4||0),files:Number(wb?.files_t4||0),verifiedFiles:Number(wb?.verified_t4||0)}}}};
        });
        if(scoreRefreshCandidates.length){
          try{
            for(let i=0;i<scoreRefreshCandidates.length;i+=40){
              const writes=scoreRefreshCandidates.slice(i,i+40).map(c=>env.DB.prepare(`UPDATE opd_data SET sa=?,nilai_struktur_proses=?,struktur_proses_status=?
                WHERE id=? AND year=? AND COALESCE(subunsurs,'{}')=?
                  AND COALESCE(sa,-9999)=? AND COALESCE(nilai_struktur_proses,-9999)=? AND COALESCE(struktur_proses_status,'')=?
                  AND COALESCE((SELECT group_concat(sig, char(30)) FROM (
                    SELECT COALESCE(upload_id,'')||char(31)||COALESCE(subunsur,'')||char(31)||COALESCE(param_id,'')||char(31)||
                      COALESCE(CAST(level AS TEXT),'')||char(31)||COALESCE(verification_status,'')||char(31)||COALESCE(CAST(verification_at AS TEXT),'')||char(31)||
                      COALESCE(CAST(updated_at AS TEXT),'')||char(31)||COALESCE(r2_key,'')||char(31)||COALESCE(file_name,'') AS sig
                    FROM opd_workbook_evidence_items WHERE year=? AND opd_id=? ORDER BY upload_id
                  )),'')=?`).bind(c.value,c.value,c.status,c.id,String(year),c.rawSubunsurs,c.oldSa,c.oldNilai,c.oldStatus,String(year),c.id,c.fingerprint));
              await env.DB.batch(writes);
            }
          }catch(scoreSyncError){console.warn('Koreksi persistensi nilai Struktur dan Proses tertunda; respons tetap memakai nilai hitung terbaru:',scoreSyncError?.message||scoreSyncError);}
        }
        let visibleRows=mapped.filter(r=>sessionCanAccessOrg(authSession,r.id,r.opd));
        // Evidence URLs are routed through the authenticated download endpoint rather than the public r2.dev hostname.
        for(const row of visibleRows){
          const secureFile=(f)=>{if(!f||typeof f!=='object'||!f.uploadId)return f;return {...f,url:privateEvidenceUrl(year,row.id,f.uploadId)};};
          row.rtpEvidence=(Array.isArray(row.rtpEvidence)?row.rtpEvidence:[]).map(secureFile);
          row.pmSpipReports=(Array.isArray(row.pmSpipReports)?row.pmSpipReports:[]).map(secureFile);
          row.rrRtpReports=(Array.isArray(row.rrRtpReports)?row.rrRtpReports:[]).map(secureFile);
          for(const group of Object.values(row.subunsurs||{}))for(const param of Object.values(group||{}))for(let lv=1;lv<=5;lv++){if(Array.isArray(param?.['files'+lv]))param['files'+lv]=param['files'+lv].map(secureFile);}
        }
        return new Response(JSON.stringify(visibleRows),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store, no-cache, must-revalidate, max-age=0'}});
      }
      case 'addOpd': {
        const id = params.id || 'r' + Math.random().toString(36).slice(2,9);
        const opd = sanitizeString(params.opd || 'OPD Baru');
        const subunsurs = params.subunsurs || {};
        const sa = 0; // New OPDs have no accepted evidence yet.
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
              evidence=?,
              qa_apip=?,
              rtp=?,
              status=?
            WHERE id=? AND year=?
          `).bind(
            sanitizeString(row.opd||''),
            row.evidence||'Belum', row.qaApip||'Belum', row.rtp||'Belum', row.status||'Belum',
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
          await env.DB.prepare(`UPDATE opd_data SET opd=?, evidence=?, qa_apip=?, rtp=?, status=? WHERE id=? AND year=?`).bind(
            sanitizeString(row.opd||''),
            row.evidence||'Belum', row.qaApip||'Belum', row.rtp||'Belum', row.status||'Belum', row.id, year
          ).run();
        } else {
          const subunsurs=row.subunsurs||{};
          const sa=0;
          const strukturStatus='Belum';
          await env.DB.prepare("INSERT INTO opd_data (id,opd,sa,nilai_struktur_proses,nilai_maturitas,nilai_kapabilitas_apip,evidence,qa_apip,mri,iepk,rtp,status,struktur_proses_status,subunsurs,year,kk_data,kk_pm_data,kk_rtp_data,rtp_evidence,rtp_evidence_folder) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(row.id,sanitizeString(row.opd||''),sa,sa,0,0,row.evidence||'Belum',row.qaApip||'Belum',0,0,row.rtp||'Belum',row.status||'Belum',strukturStatus,JSON.stringify(subunsurs),year,JSON.stringify(row.kkData||{}),JSON.stringify(row.kkPmData||{}),JSON.stringify(row.kkRtpData||{}),JSON.stringify(Array.isArray(row.rtpEvidence)?row.rtpEvidence:[]),row.rtpEvidenceFolder||'Evidence RTP').run();
        }
        notifyRealtime(env, ctx, year, { action: 'saveRow', opdId: row.id });
        return jsonResponse({status:'success',message:'Data OPD tersimpan'});
      }
      case 'saveSubunsur': {
        if (!params.opdId) throw new Error('ID OPD wajib diisi');
        await assertAssessmentInputEditable(env,year,params.opdId);

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

          // Re-read authoritative input values but never use unverified level selections
          // as the reported Structure & Process score. Only accepted evidence contributes.
          const rec = await env.DB.prepare("SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId, year).first();
          if (!rec) throw new Error('OPD tidak ditemukan');
          let authoritativeSubunsurs={};try{authoritativeSubunsurs=rec.subunsurs?JSON.parse(rec.subunsurs):{}}catch{authoritativeSubunsurs={};}
          const verifiedScore=await refreshVerifiedStructureProcessScore(env,year,params.opdId);
          const currentSa=verifiedScore.value,currentStatus=verifiedScore.status;
          notifyRealtime(env, ctx, year, { action: 'saveSubunsur', opdId: params.opdId, changes:valid, nilaiStrukturProses:verifiedScore.value, strukturProsesStatus:verifiedScore.status, structureProcessBreakdown:verifiedScore });
          return jsonResponse({
            status:'success',
            message:'Perubahan subunsur tersimpan',
            subunsurs:authoritativeSubunsurs,
            nilaiStrukturProses:Number(currentSa)||0,
            strukturProsesStatus:currentStatus,
            structureProcessBreakdown:verifiedScore
          });
        }

        // Backward-compatible fallback for older clients. Use compare-and-swap so a
        // stale full-document save cannot silently erase newer concurrent evidence.
        const subunsurs=params.subunsurs||{};
        for(let attempt=0;attempt<5;attempt++){
          const current=await env.DB.prepare("SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(String(params.opdId),String(year)).first();
          if(!current)throw new Error('OPD tidak ditemukan.');
          const raw=String(current.subunsurs||'{}');
          const write=await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET subunsurs=? WHERE id=? AND year=? AND COALESCE(subunsurs,'{}')=?").bind(JSON.stringify(subunsurs),String(params.opdId),String(year),raw));
          if(Number(write.meta?.changes||0)>0)break;
          if(attempt===4){const e=new Error('Data berubah saat disimpan operator lain. Muat ulang agar isian terbaru tidak tertimpa.');e.status=409;throw e;}
          await new Promise(resolve=>setTimeout(resolve,15*(attempt+1)+Math.floor(Math.random()*10)));
        }
        const verifiedScore=await refreshVerifiedStructureProcessScore(env,year,params.opdId);
        notifyRealtime(env, ctx, year, { action: 'saveSubunsur', opdId: params.opdId, nilaiStrukturProses:verifiedScore.value, strukturProsesStatus:verifiedScore.status, structureProcessBreakdown:verifiedScore });
        return jsonResponse({status:'success',message:'Subunsur tersimpan',nilaiStrukturProses:verifiedScore.value,strukturProsesStatus:verifiedScore.status,structureProcessBreakdown:verifiedScore});
      }

      case 'saveField': {
        const { opdId, field, value } = params;
        if(field==='opd'&&authSession?.role!=='admin')return jsonResponse({status:'error',message:'Hanya Super Admin yang boleh mengubah nama OPD.'},403);
        if (field === 'nilaiStrukturProses') throw new Error('Nilai Struktur dan Proses dihitung otomatis dari parameter.');
        if (['nilaiMaturitas','nilaiKapabilitasApip','mri','iepk'].includes(field)) throw new Error('Nilai Maturitas, MRI, IEPK, dan Kapabilitas APIP hanya berasal dari rumus workbook KK dan tidak dapat diedit manual.');
        const dbField=FIELD_MAP[field];if(!dbField)throw new Error('Field tidak diizinkan: '+field);
        let oldOrg='';if(field==='opd'){oldOrg=(await env.DB.prepare('SELECT opd FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(opdId,String(year)).first())?.opd||'';}
        const cleanValue=['nilaiMaturitas','nilaiKapabilitasApip','mri','iepk'].includes(field)?Math.max(0,Math.min(5,Number(value)||0)):(field==='opd'?sanitizeString(value):String(value||''));
        if(field==='opd'&&!cleanValue)throw new Error('Nama OPD tidak boleh kosong.');
        await env.DB.prepare(`UPDATE opd_data SET ${dbField} = ? WHERE id = ? AND year = ?`).bind(cleanValue,opdId,year).run();
        if(field==='opd'&&oldOrg)await migrateAuthOpdNameScope(env,oldOrg,cleanValue).catch(err=>{console.warn('Migrasi cakupan akun OPD gagal:',err?.message||err);throw err;});
        notifyRealtime(env, ctx, year, { action: 'saveField', opdId });
        return new Response(JSON.stringify({ status: 'success', message: 'Field tersimpan' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'getWorkbookEvidenceFiles': {
        const opdId=String(params.opdId||'');if(!opdId)throw new Error('ID OPD wajib diisi.');
        const q=await env.DB.prepare(`SELECT upload_id,evidence_key,target_code,subunsur,param_id,grade,level,file_name,file_type,r2_key,gdrive_id,sync_status,sync_error,verification_status,verification_examiner,verification_note,verification_at,created_at,updated_at FROM opd_workbook_evidence_items WHERE year=? AND opd_id=? AND TRIM(COALESCE(r2_key,''))<>'' AND TRIM(COALESCE(file_name,''))<>'' ORDER BY subunsur,param_id,CASE grade WHEN 'E' THEN 1 WHEN 'D' THEN 2 WHEN 'C' THEN 3 WHEN 'B' THEN 4 WHEN 'A' THEN 5 ELSE 9 END,created_at`).bind(String(year),opdId).all();
        const files=(q.results||[]).map(x=>({uploadId:String(x.upload_id),evidenceKey:String(x.evidence_key||''),targetCode:String(x.target_code||''),subunsur:String(x.subunsur||''),paramId:String(x.param_id||''),grade:String(x.grade||''),level:Number(x.level||0),fileName:x.file_name||'File',fileType:x.file_type||'application/octet-stream',url:x.r2_key?privateEvidenceUrl(year,opdId,String(x.upload_id)):null,r2Key:x.r2_key||null,gdriveId:x.gdrive_id||null,syncStatus:x.sync_status||'pending',syncError:x.sync_error||null,verificationStatus:x.verification_status||'',verificationExaminer:x.verification_examiner||'',verificationNote:x.verification_note||'',verificationAt:x.verification_at?Number(x.verification_at):null,createdAt:Number(x.created_at||0),updatedAt:Number(x.updated_at||0)}));
        return jsonResponse({status:'success',files});
      }
      case 'replaceWorkbookEvidenceFile': {
        assertGoogleDriveConfigured(env);
        const opdId=String(params.opdId||'');
        const uploadId=String(params.uploadId||'');
        if(!opdId||!uploadId)throw new Error('Identitas file evidence pengganti tidak lengkap.');
        const file=params.file;const legacyData=params.fileData;
        if(!file&&!legacyData&&!request.body)throw new Error('File pengganti tidak diterima.');
        let bytes=null;let fileType=String(params.fileType||'application/octet-stream');let fileName=sanitizeString(params.fileName||'evidence').substring(0,150)||'evidence';
        if(file){
          if(Number(file.size||0)>10*1024*1024)throw new Error('File lebih dari 10 MB.');
          fileName=sanitizeString(file.name||fileName).substring(0,150)||'evidence';fileType=file.type||fileType;bytes=new Uint8Array(await file.arrayBuffer());
        }else if(legacyData){
          bytes=decodeBase64File(legacyData,10);
        }else{
          const sizeHint=Number(params.fileSize)||0;if(sizeHint>10*1024*1024)throw new Error('File lebih dari 10 MB.');
          bytes=new Uint8Array(await request.arrayBuffer());
        }
        if(!bytes?.byteLength)throw new Error('File pengganti kosong atau tidak dapat dibaca.');
        if(bytes.byteLength>10*1024*1024)throw new Error('File lebih dari 10 MB.');
        if(!/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(fileType))fileType='application/octet-stream';
        const q=await env.DB.prepare('SELECT * FROM opd_workbook_evidence_items WHERE upload_id=? AND year=? AND opd_id=? LIMIT 1').bind(uploadId,String(year),opdId).all();
        const item=q.results?.[0];if(!item)throw new Error('Evidence tidak ditemukan pada OPD/tahun yang sama.');
        if(normalizeVerificationStatus(item.verification_status)!=='dikembalikan')throw new Error('Penggantian hanya tersedia untuk file dengan status verifikasi Dikembalikan.');
        if(!item.r2_key)throw new Error('Lokasi file R2 tidak ditemukan.');
        const previousObject=await env.EVIDENCE_BUCKET.get(item.r2_key);if(!previousObject)throw new Error('File lama di R2 tidak ditemukan.');
        const previousBytes=new Uint8Array(await previousObject.arrayBuffer());
        const previousContentType=previousObject.httpMetadata?.contentType||item.file_type||'application/octet-stream';
        const previousName=item.file_name||'evidence';const previousDriveId=String(item.gdrive_id||'').trim();
        let gdriveId=previousDriveId;let driveEffect='none';let r2Updated=false;
        try{
          await env.EVIDENCE_BUCKET.put(item.r2_key,bytes,{httpMetadata:{contentType:fileType}});r2Updated=true;
          if(gdriveId){
            try{
              const accessToken=await getGoogleAccessToken(env);const currentDrive=await getDriveFile(accessToken,gdriveId);
              if(currentDrive&&!currentDrive.trashed){await updateGoogleDriveFileContent(env,gdriveId,fileName,bytes,fileType);driveEffect='updated_existing';}
              else gdriveId='';
            }catch(err){if(Number(err?.status)===404)gdriveId='';else throw err;}
          }
          if(!gdriveId){
            const job={type:'workbook_evidence',uploadId,year:String(year),opdId,opdName:'OPD',r2Key:item.r2_key,fileName,fileType,evidenceKey:item.evidence_key,targetCode:item.target_code,subunsur:item.subunsur,paramId:item.param_id,grade:item.grade,level:item.level};
            gdriveId=await directGoogleDriveBackup(env,job);driveEffect='created_new';
          }
          const now=Date.now();
          const updated=await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_workbook_evidence_items SET file_name=?,file_type=?,gdrive_id=?,sync_status='done',sync_error=NULL,verification_status='',verification_examiner='',verification_note='',verification_at=NULL,updated_at=? WHERE upload_id=? AND year=? AND opd_id=? AND LOWER(TRIM(COALESCE(verification_status,'')))='dikembalikan'`).bind(fileName,fileType,gdriveId,now,uploadId,String(year),opdId));
          if(!updated.meta?.changes)throw new Error('Status file berubah saat penggantian diproses. Muat ulang daftar evidence sebelum mencoba lagi.');
          try{await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_upload_registry SET gdrive_id=?,r2_key=?,sync_status='done',sync_error=NULL,updated_at=? WHERE upload_id=?").bind(gdriveId,item.r2_key,now,uploadId));}catch(_){}
          try{await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_uploads SET gdrive_id=?,r2_key=?,sync_status='done',sync_error=NULL,updated_at=? WHERE upload_id=?").bind(gdriveId,item.r2_key,now,uploadId));}catch(_){}
          const fileRecord={uploadId,evidenceKey:String(item.evidence_key||''),targetCode:String(item.target_code||''),subunsur:String(item.subunsur||''),paramId:String(item.param_id||''),grade:String(item.grade||''),level:Number(item.level||0),fileName,fileType,url:privateEvidenceUrl(year,opdId,uploadId),r2Key:item.r2_key,gdriveId,syncStatus:'done',syncError:null,verificationStatus:'',verificationExaminer:'',verificationNote:'',verificationAt:null,createdAt:Number(item.created_at||0),updatedAt:now};
          await env.DB.prepare('DELETE FROM evidence_verification_steps WHERE year=? AND opd_id=? AND upload_id=?').bind(String(year),opdId,uploadId).run();
          // A replacement is a new evidence revision: clear the nested legacy mirror
          // and recalculate the score before any client sees the replacement as current.
          let scoreRefreshPending=false,replacementScore=null;
          try{const mirrored=await syncStructureVerificationForUpload(env,year,opdId,uploadId,'','', '',now);replacementScore=mirrored.score;}
          catch(scoreError){scoreRefreshPending=true;console.error('Penggantian file berhasil tetapi sinkronisasi mirror/skor perlu diulang:',scoreError?.message||scoreError);}
          notifyRealtime(env,ctx,year,{action:'replaceWorkbookEvidenceFile',opdId,uploadId,evidenceKey:item.evidence_key,targetCode:item.target_code,grade:item.grade,storage:'R2 + Google Drive',...(replacementScore?{nilaiStrukturProses:replacementScore.value,strukturProsesStatus:replacementScore.status,structureProcessBreakdown:replacementScore}:{})});
          return jsonResponse({status:'success',message:scoreRefreshPending?'File pengganti tersimpan; penyegaran mirror/skor belum selesai dan perlu sinkronisasi ulang.':'File pengganti memperbarui record, tautan R2 dan file Google Drive yang sama.',scoreRefreshPending,...(replacementScore?{nilaiStrukturProses:replacementScore.value,strukturProsesStatus:replacementScore.status,structureProcessBreakdown:replacementScore}:{}),file:fileRecord});
        }catch(err){
          if(r2Updated)await env.EVIDENCE_BUCKET.put(item.r2_key,previousBytes,{httpMetadata:{contentType:previousContentType}}).catch(()=>{});
          if(driveEffect==='updated_existing'&&previousDriveId)await updateGoogleDriveFileContent(env,previousDriveId,previousName,previousBytes,previousContentType).catch(()=>{});
          else if(driveEffect==='created_new'&&gdriveId)await deleteGoogleDriveFile(env,gdriveId).catch(()=>{});
          throw err;
        }
      }

      case 'saveWorkbookEvidenceVerification': {
        if(!['admin','auditor','ppupd','irban'].includes(String(authSession?.role||'')))return jsonResponse({status:'error',code:'VERIFICATION_ROLE_REQUIRED',message:'Hanya Admin, Auditor, PPUPD, atau Irban yang dapat memverifikasi Evidence Struktur dan Proses.'},403);
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||'');if(!opdId||!uploadId)throw new Error('Identitas evidence tidak lengkap.');
        await assertSessionCanAccessOpd(env,authSession,year,opdId);
        const verificationStatus=sanitizeQaText(params.verificationStatus,30),verificationExaminer=sanitizeQaText(params.verificationExaminer,100),verificationNote=sanitizeQaText(params.verificationNote,2000);
        if(!['diterima','diterima_catatan','dikembalikan'].includes(verificationStatus))throw new Error('Status verifikasi tidak valid.');
        if(verificationExaminer.length<2)throw new Error('Nama pemeriksa wajib diisi untuk evidence yang diverifikasi.');
        if(['diterima_catatan','dikembalikan'].includes(verificationStatus)&&verificationNote.length<2)throw new Error('Catatan verifikasi wajib diisi untuk status tersebut.');
        const now=Date.now();
        const sync=await syncStructureVerificationForUpload(env,year,opdId,uploadId,verificationStatus,verificationExaminer,verificationNote,now);
        const score=sync.score;
        notifyRealtime(env,ctx,year,{action:'saveWorkbookEvidenceVerification',opdId,uploadId,verificationStatus,nilaiStrukturProses:score.value});
        return jsonResponse({status:'success',uploadId,verificationStatus,verificationExaminer,verificationNote,verificationAt:now,nilaiStrukturProses:score.value,strukturProsesStatus:score.status,structureProcessBreakdown:score,verificationStoresSynced:true});
      }
      case 'deleteWorkbookEvidence': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||'');if(!opdId||!uploadId)throw new Error('Identitas evidence tidak lengkap.');
        const q=await env.DB.prepare('SELECT * FROM opd_workbook_evidence_items WHERE upload_id=? AND year=? AND opd_id=? LIMIT 1').bind(uploadId,String(year),opdId).all();const item=q.results?.[0];if(!item)throw new Error('Evidence tidak ditemukan.');
        if(item.gdrive_id)await deleteGoogleDriveFile(env,item.gdrive_id);if(item.r2_key)await env.EVIDENCE_BUCKET.delete(item.r2_key);
        await removeLegacyEvidenceMirror(env,year,opdId,uploadId);
        const deletedAt=Date.now();
        // Keep a metadata-only tombstone so legacy JSON cannot resurrect this
        // parameter's old accepted value after its last workbook file is deleted.
        await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_workbook_evidence_items SET r2_key='',gdrive_id=NULL,sync_status='deleted',sync_error=NULL,verification_status='',verification_examiner='',verification_note='',verification_at=NULL,updated_at=? WHERE upload_id=? AND year=? AND opd_id=?`).bind(deletedAt,uploadId,String(year),opdId));
        try{await runD1WithRetry(()=>env.DB.prepare('DELETE FROM evidence_upload_registry WHERE upload_id=?').bind(uploadId));}catch(_){ }
        try{await runD1WithRetry(()=>env.DB.prepare('DELETE FROM evidence_uploads WHERE upload_id=?').bind(uploadId));}catch(_){ }
        const score=await refreshVerifiedStructureProcessScore(env,year,opdId);
        notifyRealtime(env,ctx,year,{action:'deleteWorkbookEvidence',opdId,uploadId,evidenceKey:item.evidence_key,nilaiStrukturProses:score.value,strukturProsesStatus:score.status,structureProcessBreakdown:score});return jsonResponse({status:'success',uploadId,evidenceKey:item.evidence_key,fileName:item.file_name||'File',nilaiStrukturProses:score.value,strukturProsesStatus:score.status,structureProcessBreakdown:score});
      }
      case 'syncKkComputedValues': {
        const opdId=String(params.opdId||'');
        if(!opdId)throw new Error('ID OPD wajib diisi.');
        const rec=await env.DB.prepare('SELECT opd,kk_data,kk_pm_data,computed_workbook_data FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(opdId,String(year)).all();
        if(!rec.results?.length)throw new Error('OPD tidak ditemukan.');
        const saved=rec.results[0];
        const kkPm=normalizeKkPmData(saved.kk_pm_data).workbook;
        const kk=normalizeKkData(saved.kk_data);
        // The dashboard's four formula values belong to the workbook shown in "KK PM SPIP".
        // Prefer that workbook; read the older "KK SPIP" workbook only for legacy OPDs
        // that have not created a PM workbook yet.
        const usePm=Boolean(kkPm.workbookSpreadsheetId);
        const spreadsheetId=extractSpreadsheetId(kkPm.workbookSpreadsheetId||kk.workbookSpreadsheetId);
        const workbookName=usePm?(kkPm.workbookName||'KK PM SPIP'):(kk.workbookName||'KK SPIP');
        if(!spreadsheetId){
          return jsonResponse({status:'unavailable',computed:{source:'KK PM SPIP workbook formula cells',status:'unavailable',syncedAt:null,message:'Spreadsheet KK PM SPIP belum dibuat/disinkronkan untuk OPD ini.',values:{nilaiMaturitas:null,mri:null,iepk:null,nilaiKapabilitasApip:null}}});
        }
        try{
          const computed=await readWorkbookComputedValues(env,spreadsheetId,{source:usePm?'KK PM SPIP · formula workbook cells':'KK SPIP (legacy fallback) · formula workbook cells',workbookName});
          const v=computed.values||{};
          // Keep existing numeric columns if a formula cell is temporarily blank/error, but
          // never present an old cached result as current: computed_workbook_data is replaced.
          const linkPath=usePm?'$.workbook.workbookSpreadsheetId':'$.workbookSpreadsheetId';
          const update=await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_data SET nilai_maturitas=COALESCE(?,nilai_maturitas),nilai_kapabilitas_apip=COALESCE(?,nilai_kapabilitas_apip),mri=COALESCE(?,mri),iepk=COALESCE(?,iepk),computed_workbook_data=? WHERE id=? AND year=? AND json_extract(CASE WHEN json_valid(${usePm?'kk_pm_data':'kk_data'}) THEN ${usePm?'kk_pm_data':'kk_data'} ELSE '{}' END, ?) = ?`).bind(v.nilaiMaturitas,v.nilaiKapabilitasApip,v.mri,v.iepk,JSON.stringify(computed),opdId,String(year),linkPath,String(spreadsheetId)));
          if(!Number(update.meta?.changes||0))return jsonResponse({status:'stale',message:'Workbook berubah saat nilai sedang dibaca. Nilai lama tidak disimpan; jalankan sinkronisasi ulang.',computed:{...computed,status:'stale'}});
          notifyRealtime(env,ctx,year,{action:'syncKkComputedValues',opdId,computed});
          return jsonResponse({status:'success',computed});
        }catch(err){
          let old={};try{old=saved.computed_workbook_data?JSON.parse(saved.computed_workbook_data):{};}catch{}
          // If the source workbook changed, do not surface cached scores read from the old workbook.
          const sameWorkbook=String(old.spreadsheetId||'')===String(spreadsheetId);
          const emptyValues={nilaiMaturitas:null,mri:null,iepk:null,nilaiKapabilitasApip:null};
          const computed={...(sameWorkbook?old:{}),status:'error',source:usePm?'KK PM SPIP workbook formula cells':'KK SPIP (legacy fallback) · formula workbook cells',spreadsheetId,spreadsheetUrl:`https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`,values:sameWorkbook&&old.values?old.values:emptyValues,error:String(err.message||err),syncedAt:sameWorkbook?(old.syncedAt||null):null};
          const errorLinkPath=usePm?'$.workbook.workbookSpreadsheetId':'$.workbookSpreadsheetId';
          await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_data SET computed_workbook_data=? WHERE id=? AND year=? AND json_extract(CASE WHEN json_valid(${usePm?'kk_pm_data':'kk_data'}) THEN ${usePm?'kk_pm_data':'kk_data'} ELSE '{}' END, ?) = ?`).bind(JSON.stringify(computed),opdId,String(year),errorLinkPath,String(spreadsheetId)));
          return jsonResponse({status:'error',message:computed.error,computed},200);
        }
      }

      case 'getKkPmSheets': {
        const rec=await env.DB.prepare("SELECT kk_pm_data,opd FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(String(params.opdId||''),String(year)).all();
        if(!rec.results?.length)return jsonResponse({status:'error',message:'OPD tidak ditemukan'},404);
        const rawRoot=(()=>{try{return rec.results[0].kk_pm_data?JSON.parse(rec.results[0].kk_pm_data):{};}catch{return {};}})();
        const data=normalizeKkPmData(rawRoot); let sheets=[]; let needsSync=false; let profile=null; let needsSyncReason='';
        let token=null;
        if(data.workbook.workbookSpreadsheetId){
          try{
            token=await getGoogleAccessToken(env);
            const meta=await getSpreadsheetMetadata(token,data.workbook.workbookSpreadsheetId);
            sheets=(meta.sheets||[]).map(s=>({sheetId:s.properties?.sheetId,title:s.properties?.title,index:s.properties?.index,rowCount:s.properties?.gridProperties?.rowCount||0,columnCount:s.properties?.gridProperties?.columnCount||0}));
            profile=getPmSheetProfile(meta.sheets||[]);
            if(profile!=='PM_2026'){needsSync=true;needsSyncReason=`Workbook tertaut memiliki profil ${profile||'tidak dikenal'}; PM terbaru harus 26 tab.`;}
          }catch(err){needsSync=true;needsSyncReason=`Workbook tertaut tidak dapat divalidasi: ${String(err?.message||err).slice(0,220)}`;sheets=Array.isArray(data.workbook.sheets)?data.workbook.sheets.map((x,i)=>({sheetId:x?.sheetId||x?.properties?.sheetId||null,title:typeof x==='string'?x:(x?.title||x?.properties?.title||''),index:Number.isFinite(Number(x?.index))?Number(x.index):i,rowCount:Number(x?.rowCount||x?.properties?.gridProperties?.rowCount||0),columnCount:Number(x?.columnCount||x?.properties?.gridProperties?.columnCount||0)})):[];}
        }else {needsSync=true;needsSyncReason='Belum ada workbook PM yang tertaut untuk OPD/tahun ini.';}
        // Check template lineage as well as tab count. A legacy workbook can have the right
        // shape but still be linked to the old master. The resolver is cached briefly to bound
        // Google API traffic during simultaneous access by many accounts.
        try{
          token=token||await getGoogleAccessToken(env);
          const active=await resolveKkPmTemplateSpreadsheet(env,token,extractSpreadsheetId(env.GOOGLE_SHEETS_PM_TEMPLATE_ID||''),{forceRefresh:params.forceRefresh===true||String(params.forceRefresh||'').toLowerCase()==='true'});
          const activeRevision=String(active.file?.modifiedTime||'');
          const savedRevision=String(data.workbook.templateRevision||data.workbook.templateModifiedTime||'');
          if(data.workbook.workbookSpreadsheetId&&(String(data.workbook.templateSpreadsheetId||'')!==String(active.id)||!savedRevision||(activeRevision&&savedRevision!==activeRevision))){
            needsSync=true;
            needsSyncReason='Workbook belum berasal dari master PM terbaru. Sinkronisasi akan membuat salinan baru dan memperbarui tautan OPD/tahun; workbook lama tetap disimpan untuk pemulihan.';
          }
        }catch(err){
          needsSync=true;
          needsSyncReason=`Master PM terbaru belum dapat diverifikasi: ${String(err?.message||err).slice(0,260)}`;
        }
        const history=Array.isArray(rawRoot.workbookHistory)?rawRoot.workbookHistory:[];
        return jsonResponse({status:'success',kkPmData:data.workbook,sheets,needsSync,needsSyncReason,profile,workbookHistory:history.map(x=>({workbookSpreadsheetId:x.workbookSpreadsheetId||null,workbookUrl:x.workbookUrl||null,workbookName:x.workbookName||null,archivedAt:x.archivedAt||null,archiveReason:x.archiveReason||''})),expectedSheetCount:26});
      }
      case 'createKkPmSheets': {
        const opdId=String(params.opdId||'');
        if(!opdId)throw new Error('ID OPD wajib diisi.');
        const lockKey=`kk-pm-workbook:${String(year)}:${opdId}`;
        const lockToken=crypto.randomUUID();
        const lockNow=Date.now();
        const leaseMs=10*60*1000;
        const lock=await env.DB.prepare(`INSERT INTO kk_pm_workbook_sync_locks(lock_key,lease_until,owner_token,updated_at)
          VALUES(?,?,?,?) ON CONFLICT(lock_key) DO UPDATE SET lease_until=excluded.lease_until,owner_token=excluded.owner_token,updated_at=excluded.updated_at
          WHERE kk_pm_workbook_sync_locks.lease_until<?`).bind(lockKey,lockNow+leaseMs,lockToken,lockNow,lockNow).run();
        if(!Number(lock.meta?.changes||0)){
          return jsonResponse({status:'error',code:'WORKBOOK_SYNC_IN_PROGRESS',message:`Sinkronisasi workbook untuk OPD ini pada tahun ${year} sedang berjalan dari sesi lain. Tunggu beberapa detik lalu tekan Muat Link atau Sinkronkan sekali lagi.`,retryAfterSeconds:5},409);
        }
        try{
          // Re-read only after acquiring the lock so a concurrent request cannot give us a stale workbook ID.
          const rec=await env.DB.prepare("SELECT kk_pm_data,opd FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(opdId,String(year)).all();
          if(!rec.results?.length)return jsonResponse({status:'error',message:'OPD tidak ditemukan'},404);
          const latestRaw=normalizeKkPmData(rec.results[0].kk_pm_data);
          const wb=await ensureKkPmSpreadsheet(env,{...params,opd:rec.results[0].opd,currentKkPmData:latestRaw});
          const accessToken=await getGoogleAccessToken(env);
          const meta=await getSpreadsheetMetadata(accessToken,wb.workbookSpreadsheetId);
          if(!expectedPmSheetOrderMatches(meta.sheets||[])||getPmSheetProfile(meta.sheets||[])!=='PM_2026')throw new Error('Spreadsheet PM hasil sinkronisasi tidak mengikuti template resmi PM terbaru 26 sheet. Tidak ada referensi workbook yang diubah.');
          const sheets=(meta.sheets||[]).map(x=>({sheetId:x.properties?.sheetId,title:x.properties?.title,index:x.properties?.index,rowCount:x.properties?.gridProperties?.rowCount||0,columnCount:x.properties?.gridProperties?.columnCount||0}));
          const workbook={...wb,sheets:sheets.length?sheets:wb.sheets};
          // Keep a minimal recovery record if a legacy workbook must be replaced. The old
          // Google Sheet itself remains untouched and reachable; sparse PM cells are preserved.
          let rawRoot={};try{rawRoot=rec.results[0].kk_pm_data?JSON.parse(rec.results[0].kk_pm_data):{};}catch{rawRoot={};}
          const workbookHistory=Array.isArray(rawRoot.workbookHistory)?rawRoot.workbookHistory.slice(-9):[];
          const oldWorkbook=latestRaw.workbook||{};
          if(oldWorkbook.workbookSpreadsheetId&&String(oldWorkbook.workbookSpreadsheetId)!==String(workbook.workbookSpreadsheetId)&&!workbookHistory.some(x=>String(x.workbookSpreadsheetId||'')===String(oldWorkbook.workbookSpreadsheetId))){
            workbookHistory.push({...oldWorkbook,archivedAt:Date.now(),archiveReason:'Workbook lama tidak sesuai profil PM_2026; referensi disimpan untuk pemulihan, file Drive tidak dihapus.'});
          }
          // Verify lock ownership immediately before writing. If a slow Google operation outlived
          // the lease and another session acquired it, this request must not overwrite its link.
          const lockState=await env.DB.prepare('SELECT owner_token,lease_until FROM kk_pm_workbook_sync_locks WHERE lock_key=? LIMIT 1').bind(lockKey).first();
          if(!lockState||String(lockState.owner_token||'')!==lockToken||Number(lockState.lease_until||0)<=Date.now()){
            throw new Error('Lease sinkronisasi berakhir sebelum penyimpanan. Referensi workbook tidak diubah oleh sesi ini; tunggu sebentar lalu muat ulang dan sinkronkan kembali.');
          }
          // D1 updates the workbook link/history atomically and preserves $.cells during concurrent edits.
          const saved=await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET kk_pm_data=json_set(CASE WHEN json_valid(kk_pm_data) THEN kk_pm_data ELSE '{}' END,'$.version',3,'$.workbook',json(?),'$.workbookHistory',json(?)) WHERE id=? AND year=?").bind(JSON.stringify(workbook),JSON.stringify(workbookHistory),opdId,String(year)).run());
          if(!saved.meta?.changes)throw new Error('Referensi OPD/tahun tidak berubah karena rekaman tidak ditemukan saat menyimpan hasil sinkronisasi.');
          notifyRealtime(env,ctx,year,{action:'createKkPmSheets',opdId});
          return jsonResponse({status:'success',message:wb.syncDisposition==='created'?'Workbook baru dari master PM terbaru berhasil dibuat dan ditautkan. Workbook lama tetap disimpan dalam riwayat.':'Workbook PM terbaru sudah terverifikasi dan tertaut.',kkPmData:workbook,sheets:workbook.sheets,syncDisposition:wb.syncDisposition||'reused',previousWorkbookSpreadsheetId:wb.previousWorkbookSpreadsheetId||null,workbookHistory});
        }finally{
          await env.DB.prepare("UPDATE kk_pm_workbook_sync_locks SET lease_until=0,owner_token='',updated_at=? WHERE lock_key=? AND owner_token=?").bind(Date.now(),lockKey,lockToken).run().catch(()=>{});
        }
      }

      case 'exportKkPmWorkbook': {
        const rec=await env.DB.prepare("SELECT kk_pm_data,opd FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(String(params.opdId||''),String(year)).all();
        if(!rec.results?.length)return jsonResponse({status:'error',message:'OPD tidak ditemukan'},404);
        const wb=normalizeKkPmData(rec.results[0].kk_pm_data).workbook; if(!wb.workbookSpreadsheetId)throw new Error('Spreadsheet PM belum dibuat. Klik Sinkronkan Workbook terlebih dahulu.');
        const token=await getGoogleAccessToken(env); const url=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(wb.workbookSpreadsheetId)}/export?mimeType=${encodeURIComponent('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}`;
        const res=await fetchWithRetry(url,{headers:{Authorization:`Bearer ${token}`}}, {retries:3,baseDelay:500}); if(!res.ok){const txt=await res.text();throw new Error('Export workbook gagal: '+txt.slice(0,400));}
        const headers=new Headers({'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${safeDriveName(rec.results[0].opd||'OPD')}-${year}-KK-PM-SPIP-FULL.xlsx"`,'Cache-Control':'no-store'}); return new Response(res.body,{status:200,headers});
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
        const compact = { version: 2, cells };
        const serialized = JSON.stringify(compact);
        if (serialized.length > 900000) throw new Error('Perubahan Kertas Kerja PM terlalu besar. Simpan secara bertahap.');
        // Merge sparse cell overrides atomically instead of replacing the entire JSON blob:
        // keep the linked workbook metadata and preserve cells saved by other open sessions.
        const result=await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET kk_pm_data=json_patch(CASE WHEN json_valid(kk_pm_data) THEN kk_pm_data ELSE '{}' END,json(?)) WHERE id=? AND year=?").bind(serialized,params.opdId,String(year)).run());
        if(!Number(result.meta?.changes||0))throw new Error('OPD tidak ditemukan saat menyimpan Kertas Kerja PM.');
        notifyRealtime(env, ctx, year, { action: 'saveKkPmData', opdId: params.opdId });
        return jsonResponse({ status: 'success', message: 'Kertas Kerja PM tersimpan', kkPmData: compact });
      }

      case 'getKkRpjmdMappings': {
        const opdId=String(params.opdId||''); if(!opdId) throw new Error('ID OPD wajib diisi.');
        const rows=(await env.DB.prepare(`SELECT workpaper_code,goal_codes_json,rationale,status,submitted_by,verifier_name,verifier_note,verified_at,updated_by,updated_at FROM opd_kk_rpjmd_mapping WHERE year=? AND opd_id=? ORDER BY workpaper_code`).bind(String(year),opdId).all()).results||[];
        const mappings=rows.map(r=>({workpaperCode:r.workpaper_code,goalCodes:(()=>{try{return JSON.parse(r.goal_codes_json||'[]')}catch{return []}})(),rationale:r.rationale||'',status:r.status||'Belum Diajukan',submittedBy:r.submitted_by||'',verifierName:r.verifier_name||'',verifierNote:r.verifier_note||'',verifiedAt:r.verified_at?Number(r.verified_at):null,updatedBy:r.updated_by||'',updatedAt:Number(r.updated_at||0)}));
        return jsonResponse({status:'success',mappings});
      }
      case 'saveKkRpjmdMapping': {
        const opdId=String(params.opdId||''), workpaperCode=String(params.workpaperCode||'').toUpperCase();
        const allowedWorkpapers=new Set(['KKE 1.1 SASTRA','KKE 1.2 SASTRA OPD','KKE 2.1 SASPRO','KKE 2.2 SASKEG','KKE 2.3 SASSUBKEG','KK 5.1 A','KK 5.1 B','KK 5.1 C']);
        const allowedGoals=new Set(['T1.S1','T1.S2','T1.S3','T2.S1','T2.S2','T2.S3','T2.S4','T2.S5','T2.S6','T2.S7','T2.S8','T3.S1','T3.S2','T3.S3','T3.S4','T4.S1','T4.S2','T4.S3','T4.S4','T4.S5','T4.S6']);
        if(!opdId||!allowedWorkpapers.has(workpaperCode))throw new Error('Identitas kertas kerja pemetaan RPJMD tidak valid.');
        const orgRow=(await env.DB.prepare('SELECT opd FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(opdId,String(year)).all()).results?.[0];
        if(!orgRow)throw new Error('OPD tidak ditemukan.');
        if(['KKE 1.1 SASTRA','KK 5.1 A'].includes(workpaperCode)&&authSession?.role!=='admin'&&assessmentOrgProfile(orgRow.opd)!=='BP4D')throw new Error(`${workpaperCode} merupakan kertas kerja tingkat Pemda; pengisian dibatasi untuk akun BP4D/Bappelitbangda atau Admin Pemda.`);
        await assertAssessmentInputEditable(env,year,opdId);
        const goalCodes=Array.isArray(params.goalCodes)?[...new Set(params.goalCodes.map(x=>String(x||'').trim()).filter(Boolean))]:[];
        if(goalCodes.some(x=>!allowedGoals.has(x)))throw new Error('Terdapat kode sasaran RPJMD yang tidak dikenal.');
        if(!goalCodes.length)throw new Error('Pilih minimal satu sasaran RPJMD yang terkait.');
        const rationale=sanitizeQaText(params.rationale,3000); if(rationale.length<10)throw new Error('Uraian keterkaitan wajib diisi minimal 10 karakter.');
        const now=Date.now(), actor=String(authSession?.username||authSession?.displayName||'');
        await env.DB.prepare(`INSERT INTO opd_kk_rpjmd_mapping(year,opd_id,workpaper_code,goal_codes_json,rationale,status,submitted_by,verifier_name,verifier_note,verified_at,updated_by,updated_at)
          VALUES(?,?,?,?,?,'Menunggu Verifikasi',?,'','',NULL,?,?) ON CONFLICT(year,opd_id,workpaper_code) DO UPDATE SET goal_codes_json=excluded.goal_codes_json,rationale=excluded.rationale,status='Menunggu Verifikasi',submitted_by=excluded.submitted_by,verifier_name='',verifier_note='',verified_at=NULL,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
          .bind(String(year),opdId,workpaperCode,JSON.stringify(goalCodes),rationale,actor,actor,now).run();
        await env.DB.prepare(`INSERT INTO opd_kk_rpjmd_mapping_audit(year,opd_id,workpaper_code,status,verifier_name,note,updated_by,created_at) VALUES(?,?,?,'Menunggu Verifikasi','',?,?,?)`).bind(String(year),opdId,workpaperCode,'Pemetaan disimpan/diajukan untuk verifikasi.',actor,now).run();
        return jsonResponse({status:'success',message:'Pemetaan RPJMD disimpan dan menunggu verifikasi.',workpaperCode,goalCodes,status:'Menunggu Verifikasi',updatedAt:now});
      }
      case 'verifyKkRpjmdMapping': {
        const opdId=String(params.opdId||''),workpaperCode=String(params.workpaperCode||'').toUpperCase(),decision=String(params.decision||'').trim();
        if(!opdId||!['KKE 1.1 SASTRA','KKE 1.2 SASTRA OPD','KKE 2.1 SASPRO','KKE 2.2 SASKEG','KKE 2.3 SASSUBKEG','KK 5.1 A','KK 5.1 B','KK 5.1 C'].includes(workpaperCode))throw new Error('Identitas pemetaan tidak valid.');
        if(!['Terverifikasi','Perlu Perbaikan'].includes(decision))throw new Error('Keputusan verifikasi tidak valid.');
        const examiner=sanitizeQaText(params.verifierName||authSession?.displayName||authSession?.username,120),note=sanitizeQaText(params.note,3000);
        if(examiner.length<2)throw new Error('Nama verifikator wajib diisi.');
        if(decision==='Perlu Perbaikan'&&note.length<5)throw new Error('Catatan perbaikan wajib diisi.');
        const now=Date.now();
        const res=await env.DB.prepare(`UPDATE opd_kk_rpjmd_mapping SET status=?,verifier_name=?,verifier_note=?,verified_at=?,updated_by=?,updated_at=? WHERE year=? AND opd_id=? AND workpaper_code=? AND status='Menunggu Verifikasi'`).bind(decision,examiner,note,now,String(authSession?.username||examiner),now,String(year),opdId,workpaperCode).run();
        if(!res.meta?.changes)throw new Error('Pemetaan belum disimpan oleh OPD.');
        await env.DB.prepare(`INSERT INTO opd_kk_rpjmd_mapping_audit(year,opd_id,workpaper_code,status,verifier_name,note,updated_by,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(String(year),opdId,workpaperCode,decision,examiner,note,String(authSession?.username||examiner),now).run();
        return jsonResponse({status:'success',message:`Pemetaan RPJMD ${decision.toLowerCase()}.`,decision,verifiedAt:now});
      }
      case 'getKkPmDataDetailed': {
        const opdId=String(params.opdId||'');
        if(!opdId) throw new Error('ID OPD wajib diisi');
        const q=await env.DB.prepare(`SELECT target,subunsur,param_id,hasil_pengujian,grade_result,aoi_cluster,aoi_desc,cause_cluster,cause_desc,conclusion,note,updated_by,updated_at
          FROM opd_kk_pm_workpaper_items WHERE year=? AND opd_id=? ORDER BY CASE target WHEN 'T1' THEN 1 WHEN 'T2' THEN 2 WHEN 'T3' THEN 3 WHEN 'T4' THEN 4 ELSE 9 END,subunsur,param_id`).bind(String(year),opdId).all();
        const metaQ=await env.DB.prepare(`SELECT target,sector_focus,prepared_by,prepared_date,reviewed_by,reviewed_date,approved_by,approved_date,updated_at
          FROM opd_kk_pm_meta WHERE year=? AND opd_id=? ORDER BY target`).bind(String(year),opdId).all();
        const items=(q.results||[]).map(x=>({target:String(x.target),subunsur:String(x.subunsur),paramId:String(x.param_id),hasilPengujian:x.hasil_pengujian||'',gradeResult:String(x.grade_result||''),aoiCluster:x.aoi_cluster||'',aoiDesc:x.aoi_desc||'',causeCluster:x.cause_cluster||'',causeDesc:x.cause_desc||'',conclusion:x.conclusion||'',note:x.note||'',updatedBy:x.updated_by||'',updatedAt:Number(x.updated_at||0)}));
        const meta=(metaQ.results||[]).map(x=>({target:String(x.target),sectorFocus:x.sector_focus||'',preparedBy:x.prepared_by||'',preparedDate:x.prepared_date||'',reviewedBy:x.reviewed_by||'',reviewedDate:x.reviewed_date||'',approvedBy:x.approved_by||'',approvedDate:x.approved_date||'',updatedAt:Number(x.updated_at||0)}));
        return jsonResponse({status:'success',items,meta});
      }

      case 'saveKkPmMeta': {
        const opdId=String(params.opdId||''), target=String(params.target||'').toUpperCase();
        if(!opdId || !Object.prototype.hasOwnProperty.call(KK_PM_TARGET_TOTALS,target)) throw new Error('Identitas target PM tidak valid.');
        await assertAssessmentTargetAllowed(env,year,opdId,target);
        await assertAssessmentInputEditable(env,year,opdId);
        const clean=v=>sanitizeQaText(v,160);
        const values={sectorFocus:clean(params.sectorFocus),preparedBy:clean(params.preparedBy),preparedDate:clean(params.preparedDate),reviewedBy:clean(params.reviewedBy),reviewedDate:clean(params.reviewedDate),approvedBy:clean(params.approvedBy),approvedDate:clean(params.approvedDate)};
        const now=Date.now();
        await env.DB.prepare(`INSERT INTO opd_kk_pm_meta(year,opd_id,target,sector_focus,prepared_by,prepared_date,reviewed_by,reviewed_date,approved_by,approved_date,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(year,opd_id,target) DO UPDATE SET sector_focus=excluded.sector_focus,prepared_by=excluded.prepared_by,prepared_date=excluded.prepared_date,reviewed_by=excluded.reviewed_by,reviewed_date=excluded.reviewed_date,approved_by=excluded.approved_by,approved_date=excluded.approved_date,updated_at=excluded.updated_at`)
          .bind(String(year),opdId,target,values.sectorFocus,values.preparedBy,values.preparedDate,values.reviewedBy,values.reviewedDate,values.approvedBy,values.approvedDate,now).run();
        notifyRealtime(env,ctx,year,{action:'saveKkPmMeta',opdId,target});
        return jsonResponse({status:'success',target,meta:{target,...values,updatedAt:now}});
      }

      case 'saveKkPmItem': {
        const opdId=String(params.opdId||''), target=String(params.target||'').toUpperCase(), subunsur=String(params.subunsur||''), paramId=String(params.paramId||'');
        if(!opdId || !validKkPmWorkpaperLocation(target,subunsur,paramId)) throw new Error('Identitas parameter KK PM SPIP tidak valid.');
        await assertAssessmentTargetAllowed(env,year,opdId,target);
        await assertAssessmentInputEditable(env,year,opdId);
        const gradeResult=sanitizeQaText(params.gradeResult,2).toUpperCase();
        if(gradeResult && !Object.prototype.hasOwnProperty.call({A:1,B:1,C:1,D:1,E:1},gradeResult)) throw new Error('Grade hasil harus A, B, C, D, atau E.');
        const clean=v=>sanitizeQaText(v,4000);
        const hasilPengujian=clean(params.hasilPengujian),aoiCluster=clean(params.aoiCluster),aoiDesc=clean(params.aoiDesc),causeCluster=clean(params.causeCluster),causeDesc=clean(params.causeDesc),note=clean(params.note);
        const updatedBy=clean(params.updatedBy||'');
        const conclusion=gradeResult?`Grade ${gradeResult} · Level ${KK_PM_GRADE_LEVEL[gradeResult]||''}`:'';
        const now=Date.now();
        const isEmpty=!hasilPengujian&&!gradeResult&&!aoiCluster&&!aoiDesc&&!causeCluster&&!causeDesc&&!note&&!updatedBy;
        if(isEmpty){
          await env.DB.prepare("DELETE FROM opd_kk_pm_workpaper_items WHERE year=? AND opd_id=? AND target=? AND subunsur=? AND param_id=?").bind(String(year),opdId,target,subunsur,paramId).run();
        }else{
          await env.DB.prepare(`INSERT INTO opd_kk_pm_workpaper_items(year,opd_id,target,subunsur,param_id,hasil_pengujian,grade_result,aoi_cluster,aoi_desc,cause_cluster,cause_desc,conclusion,note,updated_by,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(year,opd_id,target,subunsur,param_id) DO UPDATE SET
            hasil_pengujian=excluded.hasil_pengujian,grade_result=excluded.grade_result,aoi_cluster=excluded.aoi_cluster,aoi_desc=excluded.aoi_desc,cause_cluster=excluded.cause_cluster,cause_desc=excluded.cause_desc,conclusion=excluded.conclusion,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
            .bind(String(year),opdId,target,subunsur,paramId,hasilPengujian,gradeResult,aoiCluster,aoiDesc,causeCluster,causeDesc,conclusion,note,updatedBy,now).run();
        }
        const summary=await getKkPmWorkpaperSummary(env,year,opdId);
        notifyRealtime(env,ctx,year,{action:'saveKkPmItem',opdId,target,subunsur,paramId,summary});
        return jsonResponse({status:'success',item:{target,subunsur,paramId,hasilPengujian,gradeResult,aoiCluster,aoiDesc,causeCluster,causeDesc,conclusion,note,updatedBy,updatedAt:now},summary});
      }

      case 'deleteKkPmItem': {
        const opdId=String(params.opdId||''), target=String(params.target||'').toUpperCase(), subunsur=String(params.subunsur||''), paramId=String(params.paramId||'');
        if(!opdId || !validKkPmWorkpaperLocation(target,subunsur,paramId)) throw new Error('Identitas parameter KK PM SPIP tidak valid.');
        await assertAssessmentTargetAllowed(env,year,opdId,target);
        await assertAssessmentInputEditable(env,year,opdId);
        await env.DB.prepare("DELETE FROM opd_kk_pm_workpaper_items WHERE year=? AND opd_id=? AND target=? AND subunsur=? AND param_id=?").bind(String(year),opdId,target,subunsur,paramId).run();
        const summary=await getKkPmWorkpaperSummary(env,year,opdId);
        notifyRealtime(env,ctx,year,{action:'deleteKkPmItem',opdId,target,subunsur,paramId,summary});
        return jsonResponse({status:'success',message:'Parameter KK PM SPIP dikosongkan',summary});
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
        list=(Array.isArray(list)?list:[]).map(f=>f&&f.uploadId?{...f,url:privateEvidenceUrl(year,params.opdId,f.uploadId)}:f); return jsonResponse({status:'success',rtpEvidence:list,folderName:folder,folderId,folderUrl:folderId?`https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`:null});
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
            return jsonResponse({status:'success',url:privateEvidenceUrl(year,params.opdId,uploadId),fileName:existing.fileName||safeFileName,folderName:existing.folderName||folderName,gdriveId:existing.gdriveId,rtpEvidence:existingList.map(f=>f&&f.uploadId?{...f,url:privateEvidenceUrl(year,params.opdId,f.uploadId)}:f),syncStatus:'done',uploadId,backupQueued:false});
          }
          if(existing?.r2Key) {
            try{
              const folderRec=await env.DB.prepare("SELECT rtp_evidence_folder_id FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
              const existingJob={type:'rtp',uploadId,year,opdId:params.opdId,opdName:params.opdName||'OPD',r2Key:existing.r2Key,fileName:existing.fileName||safeFileName,fileType:existing.fileType||fileType,folderName:existing.folderName||folderName,gdriveFolderId:folderRec.results?.[0]?.rtp_evidence_folder_id||null};
              const existingGdriveId=await directGoogleDriveBackup(env,existingJob);
              await updateRtpFileStatus(env,existingJob,{gdriveId:existingGdriveId,storage:'R2 + Google Drive',syncStatus:'done',syncError:null});
              const latestExisting=await env.DB.prepare("SELECT rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
              let latestExistingList=[];try{latestExistingList=latestExisting.results[0]?.rtp_evidence?JSON.parse(latestExisting.results[0].rtp_evidence):[]}catch{}
              return jsonResponse({status:'success',url:privateEvidenceUrl(year,params.opdId,uploadId),fileName:existing.fileName||safeFileName,folderName:existing.folderName||folderName,gdriveId:existingGdriveId,rtpEvidence:latestExistingList.map(f=>f&&f.uploadId?{...f,url:privateEvidenceUrl(year,params.opdId,f.uploadId)}:f),syncStatus:'done',uploadId,backupQueued:false});
            }catch(retryExistingErr){
              await updateRtpFileStatus(env, {type:'rtp',uploadId,year,opdId:params.opdId}, {syncStatus:'retrying',syncError:String(retryExistingErr.message||retryExistingErr)});
              return jsonResponse({status:'pending',url:privateEvidenceUrl(year,params.opdId,uploadId),fileName:existing.fileName||safeFileName,folderName:existing.folderName||folderName,gdriveId:null,rtpEvidence:existingList.map(f=>f&&f.uploadId?{...f,url:privateEvidenceUrl(year,params.opdId,f.uploadId)}:f),syncStatus:'retrying',uploadId,backupQueued:false,driveError:String(retryExistingErr.message||retryExistingErr),r2Saved:true,r2Key:existing.r2Key});
            }
          }
        }
        await env.EVIDENCE_BUCKET.put(filePath,fileBody||bytes,{httpMetadata:{contentType:fileType}});
        const publicUrl=privateEvidenceUrl(year,params.opdId,uploadId);
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
          return jsonResponse({status:'success',url:publicUrl,fileName:safeFileName,folderName,gdriveId,gdriveFolderId,folderUrl:`https://drive.google.com/drive/folders/${encodeURIComponent(gdriveFolderId)}`,rtpEvidence:latestList.map(f=>f&&f.uploadId?{...f,url:privateEvidenceUrl(year,params.opdId,f.uploadId)}:f),syncStatus:'done',uploadId,backupQueued:false,r2Saved:true,r2Key:filePath});
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
        const privateList=list.map(f=>f&&f.uploadId?{...f,url:privateEvidenceUrl(year,params.opdId,f.uploadId)}:f); return jsonResponse({status:'success',reportType:cfg.type,reports:privateList,folderName:cfg.folderName,folderId,folderUrl:folderId?`https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`:null});
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
          return jsonResponse({status:'success',reportType:cfg.type,url:privateEvidenceUrl(year,params.opdId,uploadId),fileName:existing.fileName||safeFileName,gdriveId:existing.gdriveId,reports:list,syncStatus:'done',uploadId,folderName:cfg.folderName,folderId:gdriveFolderId,folderUrl:`https://drive.google.com/drive/folders/${encodeURIComponent(gdriveFolderId)}`});
        }
        if(existing?.r2Key){
          try{
            const job={type:'report',reportType:cfg.type,uploadId,year,opdId:params.opdId,opdName:safeOpd,r2Key:existing.r2Key,fileName:existing.fileName||safeFileName,fileType:existing.fileType||fileType,gdriveFolderId:existing.gdriveFolderId||gdriveFolderId};
            const existingGdriveId=await directGoogleDriveBackup(env,job);
            await updateReportFileStatus(env,job,{gdriveId:existingGdriveId,storage:'R2 + Google Drive',syncStatus:'done',syncError:null});
            const latest=await env.DB.prepare(`SELECT ${cfg.listField} FROM opd_data WHERE id=? AND year=? LIMIT 1`).bind(params.opdId,year).all();
            return jsonResponse({status:'success',reportType:cfg.type,url:existing.url,fileName:existing.fileName||safeFileName,gdriveId:existingGdriveId,reports:parseJsonArray(latest.results[0]?.[cfg.listField]).map(f=>f&&f.uploadId?{...f,url:privateEvidenceUrl(year,params.opdId,f.uploadId)}:f),syncStatus:'done',uploadId,folderName:cfg.folderName,folderId:gdriveFolderId,folderUrl:`https://drive.google.com/drive/folders/${encodeURIComponent(gdriveFolderId)}`});
          }catch(err){
            await updateReportFileStatus(env,{type:'report',reportType:cfg.type,uploadId,year,opdId:params.opdId},{syncStatus:'retrying',syncError:String(err.message||err)});
            return jsonResponse({status:'pending',reportType:cfg.type,url:existing.url,fileName:existing.fileName||safeFileName,gdriveId:null,reports:list.map(f=>f&&f.uploadId?{...f,url:privateEvidenceUrl(year,params.opdId,f.uploadId)}:f),syncStatus:'retrying',uploadId,folderName:cfg.folderName,folderId:gdriveFolderId,driveError:String(err.message||err),r2Saved:true,r2Key:existing.r2Key});
          }
        }
        await env.EVIDENCE_BUCKET.put(filePath,fileBody||bytes,{httpMetadata:{contentType:fileType}});
        const publicUrl=privateEvidenceUrl(year,params.opdId,uploadId);
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
          return jsonResponse({status:'success',reportType:cfg.type,url:publicUrl,fileName:safeFileName,gdriveId,reports:latestList.map(f=>f&&f.uploadId?{...f,url:privateEvidenceUrl(year,params.opdId,f.uploadId)}:f),syncStatus:'done',uploadId,folderName:cfg.folderName,folderId:gdriveFolderId,folderUrl:`https://drive.google.com/drive/folders/${encodeURIComponent(gdriveFolderId)}`,r2Saved:true,r2Key:filePath});
        }catch(err){
          const message=String(err?.message||err);
          await updateReportFileStatus(env,job,{syncStatus:'retrying',syncError:message});
          return jsonResponse({status:'pending',reportType:cfg.type,message:'File laporan sudah diamankan di R2 tetapi BELUM masuk Google Drive. Sistem akan mencoba lagi otomatis.',url:publicUrl,fileName:safeFileName,gdriveId:null,reports:list.map(f=>f&&f.uploadId?{...f,url:privateEvidenceUrl(year,params.opdId,f.uploadId)}:f),syncStatus:'retrying',uploadId,folderName:cfg.folderName,folderId:gdriveFolderId,r2Saved:true,r2Key:filePath,driveError:message});
        }
      }
      case 'deleteReportFile': {
        const cfg=reportFieldConfig(params.reportType);
        const rec=await env.DB.prepare(`SELECT ${cfg.listField} FROM opd_data WHERE id=? AND year=? LIMIT 1`).bind(params.opdId,year).all();
        if(!rec.results.length)throw new Error('OPD tidak ditemukan');
        const list=parseJsonArray(rec.results[0]?.[cfg.listField]);
        const wantedUploadId=String(params.uploadId||'').trim();
        const wantedUrl=String(params.fileUrl||'').split('?')[0];
        const index=list.findIndex(x => (wantedUploadId && String(x?.uploadId||'')===wantedUploadId) || (!wantedUploadId && String(x?.url||'').split('?')[0]===wantedUrl));
        if(index<0)throw new Error('File laporan tidak ditemukan pada OPD ini. Data tidak diubah.');
        const item=list[index]||{};
        let r2Key=String(item.r2Key||'').trim();
        if(!r2Key){const raw=String(item.url||'').split('?')[0],marker='r2.dev/',ix=raw.indexOf(marker);if(ix!==-1){try{r2Key=decodeURIComponent(raw.substring(ix+marker.length));}catch{r2Key=raw.substring(ix+marker.length);}}}
        const gdriveId=String(item.gdriveId||params.gdriveId||'').trim();
        if(gdriveId){try{await deleteGoogleDriveFile(env,gdriveId);}catch(err){return jsonResponse({status:'error',message:'Gagal hapus di Google Drive. Salinan R2 TETAP dipertahankan: '+err.message},409);}}
        if(r2Key)await env.EVIDENCE_BUCKET.delete(r2Key);
        const next=list.slice(0,index).concat(list.slice(index+1));
        await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_data SET ${cfg.listField}=? WHERE id=? AND year=?`).bind(JSON.stringify(next),params.opdId,year));
        if(item.uploadId){await env.DB.prepare('DELETE FROM evidence_upload_registry WHERE upload_id=? AND year=? AND opd_id=?').bind(String(item.uploadId),String(year),String(params.opdId)).run().catch(()=>{});await env.DB.prepare('DELETE FROM evidence_uploads WHERE upload_id=?').bind(String(item.uploadId)).run().catch(()=>{});}
        notifyRealtime(env,ctx,year,{action:'deleteReportFile',reportType:cfg.type,opdId:params.opdId,uploadId:item.uploadId||null});
        const privateList=next.map(f=>f&&f.uploadId?{...f,url:privateEvidenceUrl(year,params.opdId,f.uploadId)}:f);
        return jsonResponse({status:'success',reportType:cfg.type,reports:privateList});
      }

      case 'deleteRtpEvidence': {
        const rec=await env.DB.prepare("SELECT rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(params.opdId,year).all();
        if(!rec.results.length)throw new Error('OPD tidak ditemukan');
        let list=[];try{list=rec.results[0].rtp_evidence?JSON.parse(rec.results[0].rtp_evidence):[]}catch{}
        if(!Array.isArray(list))list=[];
        const wantedUploadId=String(params.uploadId||'').trim();
        const wantedUrl=String(params.fileUrl||'').split('?')[0];
        const index=list.findIndex(x => (wantedUploadId && String(x?.uploadId||'')===wantedUploadId) || (!wantedUploadId && String(x?.url||'').split('?')[0]===wantedUrl));
        if(index<0)throw new Error('File Evidence RTP tidak ditemukan pada OPD ini. Data tidak diubah.');
        const item=list[index]||{};
        let r2Key=String(item.r2Key||'').trim();
        if(!r2Key){const raw=String(item.url||'').split('?')[0],marker='r2.dev/',ix=raw.indexOf(marker);if(ix!==-1){try{r2Key=decodeURIComponent(raw.substring(ix+marker.length));}catch{r2Key=raw.substring(ix+marker.length);}}}
        const gdriveId=String(item.gdriveId||params.gdriveId||'').trim();
        // Delete Drive first. If that fails, retain R2 and metadata so the evidence is not lost.
        if(gdriveId){try{await deleteGoogleDriveFile(env,gdriveId);}catch(err){return jsonResponse({status:'error',message:'Gagal hapus di Google Drive. Salinan R2 TETAP dipertahankan: '+err.message},409);}}
        if(r2Key)await env.EVIDENCE_BUCKET.delete(r2Key);
        const next=list.slice(0,index).concat(list.slice(index+1));
        await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET rtp_evidence=? WHERE id=? AND year=?").bind(JSON.stringify(next),params.opdId,year));
        if(item.uploadId){await env.DB.prepare('DELETE FROM evidence_upload_registry WHERE upload_id=? AND year=? AND opd_id=?').bind(String(item.uploadId),String(year),String(params.opdId)).run().catch(()=>{});await env.DB.prepare('DELETE FROM evidence_uploads WHERE upload_id=?').bind(String(item.uploadId)).run().catch(()=>{});}
        notifyRealtime(env,ctx,year,{action:'deleteRtpEvidence',opdId:params.opdId,uploadId:item.uploadId||null});
        const privateList=next.map(f=>f&&f.uploadId?{...f,url:privateEvidenceUrl(year,params.opdId,f.uploadId)}:f);
        return jsonResponse({status:'success',rtpEvidence:privateList});
      }
      case 'getQaApipChecklistData': {
        const opdId=String(params.opdId||'');
        if(!opdId) throw new Error('ID OPD wajib diisi.');
        const {results}=await env.DB.prepare(`SELECT item_id,checklist,note,examiner_name,updated_at FROM opd_qa_apip_checklist_items WHERE year=? AND opd_id=? ORDER BY item_id`).bind(String(year),opdId).all();
        const items=(results||[]).map(x=>({itemId:String(x.item_id),checklist:x.checklist||'',note:x.note||'',examinerName:x.examiner_name||'',updatedAt:Number(x.updated_at||0)}));
        return jsonResponse({status:'success',items});
      }

      case 'saveQaApipChecklistItem': {
        const opdId=String(params.opdId||'');
        const itemId=String(params.itemId||'').toUpperCase();
        if(!opdId || !/^PK-(0[1-9]|10)$/.test(itemId)) throw new Error('Identitas item QA APIP tidak valid.');
        const checklist=sanitizeQaText(params.checklist,2);
        if(checklist && checklist!=='√' && checklist!=='X') throw new Error('Checklist QA APIP hanya boleh √ atau X.');
        const note=sanitizeQaText(params.note,2000);
        const examinerName=sanitizeQaText(params.examinerName,100);
        const now=Date.now();
        if(!checklist&&!note&&!examinerName){
          await env.DB.prepare("DELETE FROM opd_qa_apip_checklist_items WHERE year=? AND opd_id=? AND item_id=?").bind(String(year),opdId,itemId).run();
        }else{
          await env.DB.prepare(`INSERT INTO opd_qa_apip_checklist_items(year,opd_id,item_id,checklist,note,examiner_name,updated_at) VALUES(?,?,?,?,?,?,?)
            ON CONFLICT(year,opd_id,item_id) DO UPDATE SET checklist=excluded.checklist,note=excluded.note,examiner_name=excluded.examiner_name,updated_at=excluded.updated_at`).bind(String(year),opdId,itemId,checklist,note,examinerName,now).run();
        }
        const q=await env.DB.prepare(`SELECT COUNT(*) AS checked_items,SUM(CASE WHEN checklist='√' THEN 1 ELSE 0 END) AS pass_items,SUM(CASE WHEN checklist='X' THEN 1 ELSE 0 END) AS fail_items FROM opd_qa_apip_checklist_items WHERE year=? AND opd_id=?`).bind(String(year),opdId).all();
        const qr=q.results?.[0]||{}; const total=10; const checked=Number(qr.checked_items||0); const pass=Number(qr.pass_items||0); const fail=Number(qr.fail_items||0); const pending=Math.max(0,total-checked); const percentage=Math.round(pass/total*10000)/100; const completion=Math.round(checked/total*10000)/100;
        const qaStatus=completion>=100?'Selesai':(completion>0?'Proses':'Belum');
        await env.DB.prepare("UPDATE opd_data SET qa_apip=? WHERE id=? AND year=?").bind(qaStatus,opdId,year).run();
        const summary={total,checked,evaluated:checked,na:0,pass,fail,pending,percentage,completion,status:qaStatus};
        notifyRealtime(env,ctx,year,{action:'saveQaApipChecklistItem',opdId,itemId,summary});
        return jsonResponse({status:'success',item:{itemId,checklist,note,examinerName,updatedAt:now},summary});
      }

      case 'deleteQaApipChecklistItem': {
        const opdId=String(params.opdId||''); const itemId=String(params.itemId||'').toUpperCase();
        if(!opdId || !/^PK-(0[1-9]|10)$/.test(itemId)) throw new Error('Identitas item QA APIP tidak valid.');
        await env.DB.prepare("DELETE FROM opd_qa_apip_checklist_items WHERE year=? AND opd_id=? AND item_id=?").bind(String(year),opdId,itemId).run();
        const q=await env.DB.prepare(`SELECT COUNT(*) AS checked_items,SUM(CASE WHEN checklist='√' THEN 1 ELSE 0 END) AS pass_items,SUM(CASE WHEN checklist='X' THEN 1 ELSE 0 END) AS fail_items FROM opd_qa_apip_checklist_items WHERE year=? AND opd_id=?`).bind(String(year),opdId).all();
        const qr=q.results?.[0]||{}; const total=10; const checked=Number(qr.checked_items||0); const pass=Number(qr.pass_items||0); const fail=Number(qr.fail_items||0); const pending=Math.max(0,total-checked); const percentage=Math.round(pass/total*10000)/100; const completion=Math.round(checked/total*10000)/100;
        const qaStatus=completion>=100?'Selesai':(completion>0?'Proses':'Belum');
        await env.DB.prepare("UPDATE opd_data SET qa_apip=? WHERE id=? AND year=?").bind(qaStatus,opdId,year).run();
        const summary={total,checked,evaluated:checked,na:0,pass,fail,pending,percentage,completion,status:qaStatus};
        notifyRealtime(env,ctx,year,{action:'deleteQaApipChecklistItem',opdId,itemId,summary});
        return jsonResponse({status:'success',summary});
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
              COALESCE(SUM(CASE WHEN score IS NOT NULL THEN score ELSE 0 END),0) AS sum_score,
              SUM(CASE WHEN score=1 THEN 1 ELSE 0 END) AS pass_items,
              SUM(CASE WHEN score=0.5 THEN 1 ELSE 0 END) AS partial_items,
              SUM(CASE WHEN score=0 THEN 1 ELSE 0 END) AS fail_items
          FROM opd_qa_apip_items WHERE year=? AND opd_id=?`).bind(String(year),opdId).all();
        const qr=q.results?.[0]||{}; const evaluated=Number(qr.evaluated_items||0); const na=Number(qr.na_items||0); const sum=Number(qr.sum_score||0); const total=671;
        const pending=Math.max(0,total-evaluated-na);
        const percentage=evaluated?Math.round((sum/evaluated)*10000)/100:0;
        const completion=Math.round(((evaluated+na)/total)*10000)/100;
        const pass=Number(qr.pass_items||0),partial=Number(qr.partial_items||0),fail=Number(qr.fail_items||0);
        const evidenceCount=await env.DB.prepare("SELECT COUNT(DISTINCT upload_id) AS n FROM opd_workbook_evidence_items WHERE year=? AND opd_id=? AND TRIM(COALESCE(r2_key,''))<>'' AND TRIM(COALESCE(file_name,''))<>''").bind(String(year),opdId).first();
        const evidenceFiles=Number(evidenceCount?.n||0),checked=evaluated+na;
        const qaStatus=completion>=100?'Selesai':(checked>0?'Proses':'Belum');
        await env.DB.prepare("UPDATE opd_data SET qa_apip=? WHERE id=? AND year=?").bind(qaStatus,opdId,String(year)).run();
        const summary={total,evaluated,na,checked,pass,partial,fail,pending,sum,percentage,completion,evidenceFiles,status:qaStatus};
        notifyRealtime(env,ctx,year,{action:'saveQaApipItem',opdId,subunsur,paramId,grade,itemNo,item:{subunsur,paramId,grade,itemNo,availability,identityDoc,validity,periodOk,substance,note,score,conclusion,examinerName,updatedAt:now},summary});
        return jsonResponse({status:'success',item:{subunsur,paramId,grade,itemNo,availability,identityDoc,validity,periodOk,substance,note,score,conclusion,examinerName,updatedAt:now},summary});
      }

      case 'deleteQaApipItem': {
        const opdId=String(params.opdId||''); const subunsur=String(params.subunsur||''); const paramId=String(params.paramId||''); const grade=String(params.grade||'').toUpperCase(); const itemNo=Number(params.itemNo);
        if(!opdId || !validQaItemLocation(subunsur,paramId,grade,itemNo)) throw new Error('Identitas item QA APIP tidak valid.');
        await env.DB.prepare("DELETE FROM opd_qa_apip_items WHERE year=? AND opd_id=? AND subunsur=? AND param_id=? AND grade=? AND item_no=?").bind(String(year),opdId,subunsur,paramId,grade,itemNo).run();
        const q=await env.DB.prepare(`SELECT
              SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) AS evaluated_items,
              SUM(CASE WHEN availability='N/A' THEN 1 ELSE 0 END) AS na_items,
              COALESCE(SUM(CASE WHEN score IS NOT NULL THEN score ELSE 0 END),0) AS sum_score,
              SUM(CASE WHEN score=1 THEN 1 ELSE 0 END) AS pass_items,
              SUM(CASE WHEN score=0.5 THEN 1 ELSE 0 END) AS partial_items,
              SUM(CASE WHEN score=0 THEN 1 ELSE 0 END) AS fail_items
          FROM opd_qa_apip_items WHERE year=? AND opd_id=?`).bind(String(year),opdId).all();
        const qr=q.results?.[0]||{}; const evaluated=Number(qr.evaluated_items||0); const na=Number(qr.na_items||0); const sum=Number(qr.sum_score||0); const total=671;
        const pending=Math.max(0,total-evaluated-na);
        const percentage=evaluated?Math.round((sum/evaluated)*10000)/100:0;
        const completion=Math.round(((evaluated+na)/total)*10000)/100;
        const pass=Number(qr.pass_items||0),partial=Number(qr.partial_items||0),fail=Number(qr.fail_items||0);
        const evidenceCount=await env.DB.prepare("SELECT COUNT(DISTINCT upload_id) AS n FROM opd_workbook_evidence_items WHERE year=? AND opd_id=? AND TRIM(COALESCE(r2_key,''))<>'' AND TRIM(COALESCE(file_name,''))<>''").bind(String(year),opdId).first();
        const evidenceFiles=Number(evidenceCount?.n||0),checked=evaluated+na;
        const qaStatus=completion>=100?'Selesai':(checked>0?'Proses':'Belum');
        await env.DB.prepare("UPDATE opd_data SET qa_apip=? WHERE id=? AND year=?").bind(qaStatus,opdId,String(year)).run();
        const summary={total,evaluated,na,checked,pass,partial,fail,pending,sum,percentage,completion,evidenceFiles,status:qaStatus};
        notifyRealtime(env,ctx,year,{action:'deleteQaApipItem',opdId,subunsur,paramId,grade,itemNo,deleted:true,summary});
        return jsonResponse({status:'success',summary});
      }

      case 'saveEvidenceVerification': {
        if(!['admin','auditor','ppupd','irban'].includes(String(authSession?.role||'')))return jsonResponse({status:'error',code:'VERIFICATION_ROLE_REQUIRED',message:'Hanya Admin, Auditor, PPUPD, atau Irban yang dapat memverifikasi Evidence Struktur dan Proses.'},403);
        const opdId=String(params.opdId||'');
        const subunsur=String(params.subunsur||'');
        const paramId=String(params.paramId||'');
        const level=String(params.level||'');
        const uploadId=String(params.uploadId||'');
        const status=String(params.status||'');
        const examinerName=sanitizeVerificationField(params.examinerName,100);
        const note=sanitizeVerificationField(params.note,1000);
        if(!opdId||!subunsur||!paramId||!/^[1-5]$/.test(level)||!uploadId)throw new Error('Lokasi evidence tidak lengkap.');
        if(!VERIFICATION_STATUS_SET.has(status))throw new Error('Hasil verifikasi tidak valid.');
        if(!examinerName)throw new Error('Nama pemeriksa wajib diisi.');
        if((status==='diterima_catatan'||status==='dikembalikan')&&!note)throw new Error('Catatan pemeriksa wajib diisi untuk status ini.');
        await assertSessionCanAccessOpd(env,authSession,year,opdId);
        const now=new Date().toISOString();
        const saved=await saveLegacyEvidenceVerificationAtomic(env,year,opdId,subunsur,paramId,level,uploadId,{examinerName,note,status,verifiedAt:now,updatedAt:now});
        notifyRealtime(env,ctx,year,{action:'saveEvidenceVerification',opdId,subunsur,paramId,level,uploadId,status,nilaiStrukturProses:saved.score.value});
        return jsonResponse({status:'success',verification:saved.verification,summary:saved.summary,nilaiStrukturProses:saved.score.value,strukturProsesStatus:saved.score.status,structureProcessBreakdown:saved.score});
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
        // Ensure the calendar year is always available so fresh deployments and a new
        // annual LHE follow-up do not fall back to the newest historical year in D1.
        const calendarYear=String(new Date().getFullYear());
        await env.DB.prepare('INSERT OR IGNORE INTO years (year) VALUES (?)').bind(calendarYear).run();
        const { results } = await env.DB.prepare("SELECT year FROM years").all();
        const years = results.map(x => String(x.year));
        if (!years.includes(calendarYear)) years.push(calendarYear);
        return jsonResponse([...new Set(years)].sort((a,b)=>b.localeCompare(a)));
      }

      case 'addYear': {
        await env.DB.prepare("INSERT OR IGNORE INTO years (year) VALUES (?)").bind(params.year).run();
        notifyRealtime(env, ctx, String(params.year), { action: 'addYear' });
        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'deleteYear': {
        if(String(params.year||'')===String(new Date().getFullYear()))return jsonResponse({status:'error',message:'Tahun Anggaran berjalan tidak dapat dihapus.'},400);
        await env.DB.prepare("DELETE FROM opd_data WHERE year = ?").bind(params.year).run();
        await env.DB.prepare("DELETE FROM years WHERE year = ?").bind(params.year).run();
        notifyRealtime(env, ctx, String(params.year), { action: 'deleteYear' });
        return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'uploadFile': {
        const sourceModel=String(params.sourceModel||'legacy');
        if(params.opdId) await assertAssessmentInputEditable(env,year,String(params.opdId));
        if(sourceModel==='workbook'){
          const file=params.file,legacyData=params.fileData;if(!file&&!legacyData&&!request.body)throw new Error('File tidak diterima');let bytes=null,fileBody=null,fileName=String(params.fileName||'evidence'),fileType=String(params.fileType||'application/octet-stream');const fileSize=Number(params.fileSize)||0;
          if(file){fileName=file.name||fileName;fileType=file.type||fileType;if((file.size||0)>10*1024*1024)throw new Error('File > 10MB, terlalu besar!');bytes=await file.arrayBuffer();}else if(legacyData){bytes=decodeBase64File(legacyData,10);}else{if(fileSize>10*1024*1024)throw new Error('File > 10MB, terlalu besar!');fileBody=request.body;}
          const opdId=String(params.opdId||''),evidenceKey=String(params.evidenceKey||''),targetCode=String(params.targetCode||''),subCode=String(params.subunsur||''),paramId=String(params.paramId||''),grade=String(params.grade||'').toUpperCase(),level=Number(params.level||({A:5,B:4,C:3,D:2,E:1}[grade]||0)),uploadId=String(params.uploadId||crypto.randomUUID());
          if(!opdId||!evidenceKey)throw new Error('Identitas evidence workbook tidak lengkap.');if(targetCode&&!/^T[1-4]$/.test(targetCode))throw new Error('Target workbook tidak valid.');if(!['A','B','C','D','E'].includes(grade))throw new Error('Grade evidence harus A-E.');
          const rec=await env.DB.prepare('SELECT opd FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(opdId,String(year)).all();if(!rec.results.length)throw new Error('OPD tidak ditemukan.');if(targetCode)await assertAssessmentTargetAllowed(env,year,opdId,targetCode);
          const safePathPart=(value,fallback='Tidak Diketahui',max=100)=>sanitizeString(String(value||fallback)).replace(/[\\/:*?"<>|#%{}]/g,' ').replace(/\s+/g,' ').trim().substring(0,max)||fallback;
          const safeOpd=safePathPart(rec.results[0].opd||params.opdName,'OPD',80);
          const unsurKey=String(subCode).split('.')[0];const unsurName=UNSUR_MAP[unsurKey]||`Unsur ${unsurKey}`;
          const subInfo=SUBUNSUR_DATA?.[subCode]||{};const paramObj=(subInfo.params||[]).find(p=>String(p.id)===paramId);
          const unsurFolder=safePathPart(unsurName,`Unsur ${unsurKey}`,90);
          const subFolder=safePathPart(subInfo.label||subInfo.name||subCode,`Sub Unsur ${subCode}`,100);
          const parameterFolder=safePathPart(paramObj?.desc||paramObj?.parameter||paramId,`Parameter ${paramId}`,110);
          const targetFolder=({T1:'T1 - KK3.1 - Seluruh OPD',T2:'T2 - KK3.2 - BPKAD',T3:'T3 - KK3.3 - BPKAD',T4:'T4 - KK3.4 - Inspektorat'})[targetCode]||safePathPart(targetCode,'Target');
          const levelFolder=`Level_${level}_Grade_${grade}`;const safeName=safePathPart(fileName,'evidence',150);
          const filePath=`kawal_spip/${year}/${safeOpd}/Evidence Struktur dan Proses/${unsurFolder}/${subFolder}/${parameterFolder}/${targetFolder}/${levelFolder}/${uploadId}-${safeName.replace(/[^A-Za-z0-9._ -]/g,'_')}`;
          const publicUrl=privateEvidenceUrl(year,params.opdId,uploadId);const now=Date.now();
          const existingReg=(await env.DB.prepare('SELECT * FROM evidence_upload_registry WHERE upload_id=? LIMIT 1').bind(uploadId).all()).results?.[0];if(existingReg&&(String(existingReg.year)!==String(year)||String(existingReg.opd_id)!==opdId||String(existingReg.evidence_key||'')!==evidenceKey||String(existingReg.source_model||'')!=='workbook'))throw new Error('Upload ID sudah terikat ke evidence lain.');
          if(!existingReg)await runD1WithRetry(()=>env.DB.prepare(`INSERT INTO evidence_upload_registry(upload_id,year,opd_id,subunsur,param_id,level,type,r2_key,sync_status,created_at,updated_at,evidence_key,source_model,target_code,grade) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uploadId,String(year),opdId,subCode,paramId,String(level),'workbook_evidence',filePath,'pending',now,now,evidenceKey,'workbook',targetCode,grade));
          const old=(await env.DB.prepare('SELECT * FROM opd_workbook_evidence_items WHERE upload_id=? AND year=? AND opd_id=? LIMIT 1').bind(uploadId,String(year),opdId).all()).results?.[0];if(old?.gdrive_id)return jsonResponse({status:'success',url:privateEvidenceUrl(year,opdId,uploadId),fileName:old.file_name||safeName,gdriveId:old.gdrive_id,syncStatus:'done',uploadId,r2Key:old.r2_key});
          if(!old)await runD1WithRetry(()=>env.DB.prepare(`INSERT INTO opd_workbook_evidence_items(upload_id,year,opd_id,evidence_key,target_code,subunsur,param_id,grade,level,file_name,file_type,r2_key,sync_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uploadId,String(year),opdId,evidenceKey,targetCode,subCode,paramId,grade,level,safeName,fileType,filePath,'pending',now,now));
          try{await env.EVIDENCE_BUCKET.put(filePath,fileBody||bytes,{httpMetadata:{contentType:fileType}});}catch(storageError){if(!old){try{await env.DB.prepare('DELETE FROM opd_workbook_evidence_items WHERE upload_id=? AND year=? AND opd_id=?').bind(uploadId,String(year),opdId).run();}catch(_){ }}if(!existingReg){try{await env.DB.prepare('DELETE FROM evidence_upload_registry WHERE upload_id=? AND year=? AND opd_id=?').bind(uploadId,String(year),opdId).run();}catch(_){ }}throw storageError;}const job={type:'workbook_evidence',uploadId,year:String(year),opdId,opdName:rec.results[0].opd||'OPD',r2Key:filePath,fileName:safeName,fileType,evidenceKey,targetCode,subunsur:subCode,paramId,grade,level};notifyRealtime(env,ctx,year,{action:'uploadWorkbookEvidence',opdId,uploadId,evidenceKey,grade,targetCode});
          try{const gdriveId=await directGoogleDriveBackup(env,job);await updateWorkbookEvidenceFileStatus(env,job,{gdriveId,syncStatus:'done',syncError:null});await runD1WithRetry(()=>env.DB.prepare('UPDATE evidence_upload_registry SET gdrive_id=?,sync_status=?,updated_at=? WHERE upload_id=?').bind(gdriveId,'done',Date.now(),uploadId));return jsonResponse({status:'success',url:publicUrl,fileName:safeName,gdriveId,syncStatus:'done',uploadId,r2Key:filePath});}catch(err){const msg=String(err.message||err);await updateWorkbookEvidenceFileStatus(env,job,{syncStatus:'retrying',syncError:msg});await runD1WithRetry(()=>env.DB.prepare('UPDATE evidence_upload_registry SET sync_status=?,sync_error=?,updated_at=? WHERE upload_id=?').bind('retrying',msg,Date.now(),uploadId));return jsonResponse({status:'pending',message:'Evidence tersimpan di R2; Google Drive akan di-retry.',url:publicUrl,fileName:safeName,gdriveId:null,syncStatus:'retrying',uploadId,r2Key:filePath,driveError:msg});}
        }
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
        const targetCode=String(params.targetCode||'').toUpperCase();
        const uploadId=String(params.uploadId||crypto.randomUUID());
        if(!opdId) throw new Error('OPD wajib diisi');
        if(targetCode){if(!/^T[1-4]$/.test(targetCode))throw new Error('Target T1-T4 tidak valid.');await assertAssessmentTargetAllowed(env,year,opdId,targetCode);}
        const {filePath:baseFilePath}=getFolderStructure({
          fileData:legacyData||'',
          fileName,
          opdName:params.opdName,
          subunsur:subCode,
          paramId,
          level,
          targetCode,
          fileType
        });
        const filePath=baseFilePath.replace(/([^/]+)$/,(m)=>`${uploadId}-${m}`);
        const publicUrl=privateEvidenceUrl(year,params.opdId,uploadId);

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
            url:privateEvidenceUrl(year,opdId,uploadId),
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
          // New evidence starts unverified. Preserve the score from accepted files only.
          await refreshVerifiedStructureProcessScore(env,year,opdId);
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
          return jsonResponse({status:'success',url:privateEvidenceUrl(year,opdId,uploadId),
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
            url:privateEvidenceUrl(year,opdId,uploadId),
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
        } else if(type==='workbook_evidence') {
          const q=await env.DB.prepare('SELECT o.opd,e.upload_id,e.evidence_key,e.target_code,e.subunsur,e.param_id,e.grade,e.level,e.file_name,e.file_type,e.r2_key,e.gdrive_id FROM opd_workbook_evidence_items e JOIN opd_data o ON o.id=e.opd_id AND o.year=e.year WHERE upload_id=? AND year=? AND opd_id=? LIMIT 1').bind(uploadId,targetYear,opdId).all();
          const item=q.results?.[0];if(!item)throw new Error('Evidence workbook tidak ditemukan pada OPD/lokasi yang sama.');job={type:'workbook_evidence',uploadId,year:targetYear,opdId,opdName:item.opd||'OPD',r2Key:item.r2_key||'',fileName:item.file_name||'evidence',fileType:item.file_type||'application/octet-stream',evidenceKey:item.evidence_key||'',targetCode:item.target_code||'',subunsur:item.subunsur||'',paramId:item.param_id||'',grade:item.grade||'',level:Number(item.level||0)};
        } else if(type==='lhe') {
          const rec=await env.DB.prepare('SELECT o.opd,l.evidence_json FROM lhe_followup_items l JOIN opd_data o ON o.id=l.opd_id AND o.year=l.year WHERE l.id=? AND l.year=? AND l.opd_id=? LIMIT 1').bind(String(params.followupId||''),targetYear,opdId).first();
          if(!rec)throw new Error('Butir tindak lanjut LHE tidak ditemukan pada OPD/tahun yang sama.');
          let list=[];try{list=JSON.parse(rec.evidence_json||'[]')}catch{};const item=(Array.isArray(list)?list:[]).find(x=>x&&String(x.uploadId||'')===String(uploadId));
          if(!item)throw new Error('Bukti LHE tidak ditemukan pada butir yang sama.');
          job={type:'lhe_evidence',followupId:String(params.followupId),uploadId,year:targetYear,opdId,opdName:rec.opd||'OPD',r2Key:item.r2Key||'',fileName:item.fileName||'bukti',fileType:item.fileType||'application/octet-stream'};
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
          else if(job.type==='workbook_evidence') await updateWorkbookEvidenceFileStatus(env,job,{gdriveId,syncStatus:'done',syncError:null});
          else if(job.type==='lhe_evidence') await updateLheEvidenceStatus(env,job,{gdriveId,syncStatus:'done',syncError:null});
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
          else if(job.type==='workbook_evidence') await updateWorkbookEvidenceFileStatus(env,job,{syncStatus:'retrying',syncError:String(err.message||err)});
          else if(job.type==='lhe_evidence') await updateLheEvidenceStatus(env,job,{syncStatus:'retrying',syncError:String(err.message||err)});
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
        item.url=privateEvidenceUrl(year,opdId,uploadId);
        item.replacementStatus='menunggu_verifikasi';
        item.replacedAt=now;
        item.replacementVersion=Math.max(1,Number(item.replacementVersion||0)+1);
        item.verification=null;
        await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET subunsurs=? WHERE id=? AND year=?").bind(JSON.stringify(obj),opdId,year));
        try{await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_upload_registry SET gdrive_id=?,r2_key=?,sync_status='done',sync_error=NULL,updated_at=? WHERE upload_id=?").bind(gdriveId,item.r2Key,Date.now(),uploadId));}catch(_){ }
        try{await runD1WithRetry(()=>env.DB.prepare("UPDATE evidence_uploads SET gdrive_id=?,r2_key=?,sync_status='done',sync_error=NULL,updated_at=? WHERE upload_id=?").bind(gdriveId,item.r2Key,Date.now(),uploadId));}catch(_){ }
        await env.DB.prepare('DELETE FROM evidence_verification_steps WHERE year=? AND opd_id=? AND upload_id=?').bind(String(year),opdId,uploadId).run();
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
        item.url=privateEvidenceUrl(year,opdId,uploadId);
        item.replacementStatus='menunggu_verifikasi';
        item.replacedAt=now;
        item.replacementVersion=Math.max(1,Number(item.replacementVersion||0)+1);
        item.verification=null;
        await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET rtp_evidence=? WHERE id=? AND year=?").bind(JSON.stringify(list),opdId,year));
        await env.DB.prepare('DELETE FROM evidence_verification_steps WHERE year=? AND opd_id=? AND upload_id=?').bind(String(year),opdId,uploadId).run();
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

            const rawSubunsurs=String(rec.results[0].subunsurs||'{}');
            let obj={};
            try{obj=rawSubunsurs?JSON.parse(rawSubunsurs):{};}catch{obj={};}

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
            const writeDelete=await runD1WithRetry(()=>env.DB.prepare(
              "UPDATE opd_data SET subunsurs=? WHERE id=? AND year=? AND COALESCE(subunsurs,'{}')=?"
            ).bind(JSON.stringify(obj),params.opdId,year,rawSubunsurs));
            if(!Number(writeDelete.meta?.changes||0)){const conflictError=new Error('Data evidence berubah saat file dihapus oleh operator lain. Perubahan terbaru dipertahankan; muat ulang lalu ulangi hapus.');conflictError.status=409;throw conflictError;}
            await refreshVerifiedStructureProcessScore(env,year,params.opdId);

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
          try { const file = await env.EVIDENCE_BUCKET.get(fileName); if (file) { const content = await file.text(); const data = JSON.parse(content); count = Array.isArray(data) ? data.length : Array.isArray(data?.opdData) ? data.opdData.length : 0; } } catch (e) { count = 0; }
          return { fileName, timestamp: isNaN(date.getTime()) ? 'Tanggal tidak valid' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }), size: Math.round((obj.size || 0) / 1024), count: count };
        }));
        const validBackups = backups.filter(b => b !== null);
        return new Response(JSON.stringify(validBackups), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      case 'createBackup': {
        const { results } = await env.DB.prepare("SELECT * FROM opd_data WHERE year = ?").bind(year).all();
        if (results.length === 0) return new Response(JSON.stringify({ status: 'error', message: 'Tidak ada data OPD untuk tahun ini!' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        const [{ results: kkPmItems } = { results: [] }] = await Promise.all([
          env.DB.prepare("SELECT * FROM opd_kk_pm_workpaper_items WHERE year = ?").bind(year).all()
        ]);
        const [{ results: kkPmMeta } = { results: [] }] = await Promise.all([
          env.DB.prepare("SELECT * FROM opd_kk_pm_meta WHERE year = ?").bind(year).all()
        ]);
        const [{ results: qaChecklistItems } = { results: [] }] = await Promise.all([
          env.DB.prepare("SELECT * FROM opd_qa_apip_checklist_items WHERE year = ?").bind(year).all()
        ]);
        const [{ results: workbookEvidenceItems } = { results: [] }] = await Promise.all([
          env.DB.prepare("SELECT * FROM opd_workbook_evidence_items WHERE year = ?").bind(year).all()
        ]);
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        const fileName = `backup_${year}_${timestamp}.json`;
        // Versioned envelope: old backups were a plain OPD array; restoreBackup
        // below remains backward-compatible while new KK PM workpaper tables are
        // protected in the same backup artifact.
        const backupPayload = { version: 4, year, opdData: results, kkPmWorkpaperItems: kkPmItems || [], kkPmMeta: kkPmMeta || [], qaApipChecklistItems: qaChecklistItems || [], workbookEvidenceItems: workbookEvidenceItems || [] };
        const data = JSON.stringify(backupPayload);
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
        const raw = JSON.parse(await file.text());
        const data = Array.isArray(raw) ? raw : (Array.isArray(raw?.opdData) ? raw.opdData : []);
        const pmItems = Array.isArray(raw?.kkPmWorkpaperItems) ? raw.kkPmWorkpaperItems : [];
        const pmMeta = Array.isArray(raw?.kkPmMeta) ? raw.kkPmMeta : [];
        const qaChecklistItems = Array.isArray(raw?.qaApipChecklistItems) ? raw.qaApipChecklistItems : [];
        const workbookEvidenceItems = Array.isArray(raw?.workbookEvidenceItems) ? raw.workbookEvidenceItems : [];
        await env.DB.prepare("DELETE FROM opd_data WHERE year = ?").bind(year).run();
        if (!Array.isArray(raw)) {
          await env.DB.prepare("DELETE FROM opd_kk_pm_workpaper_items WHERE year = ?").bind(year).run();
          await env.DB.prepare("DELETE FROM opd_kk_pm_meta WHERE year = ?").bind(year).run();
          await env.DB.prepare("DELETE FROM opd_qa_apip_checklist_items WHERE year = ?").bind(year).run();
          await env.DB.prepare("DELETE FROM opd_workbook_evidence_items WHERE year = ?").bind(year).run();
        }
        for (const row of data) {
          const subunsurs = row.subunsurs ? (typeof row.subunsurs==='string' ? JSON.parse(row.subunsurs) : row.subunsurs) : {};
          const sa = calculateSAFromSubunsur(subunsurs);
          const kkData = row.kk_data || row.kkData || {};
          const kkPmData = row.kk_pm_data || row.kkPmData || {};
          const kkRtpData = row.kk_rtp_data || row.kkRtpData || {};
          const rtpEvidence = row.rtp_evidence || row.rtpEvidence || [];
          const pmSpipReports = row.pm_spip_reports || row.pmSpipReports || [];
          const rrRtpReports = row.rr_rtp_reports || row.rrRtpReports || [];
          const computedWorkbookData = row.computed_workbook_data || row.computedWorkbook || {};
          const nilaiStrukturProses = Number(row.nilai_struktur_proses ?? row.nilaiStrukturProses ?? sa) || sa;
          const nilaiMaturitas = Math.max(0,Math.min(5,Number(row.nilai_maturitas ?? row.nilaiMaturitas ?? 0)||0));
          const nilaiKapabilitasApip = Number(row.nilai_kapabilitas_apip ?? row.nilaiKapabilitasApip ?? 0)||0;
          const strukturStatus = row.struktur_proses_status || row.strukturProsesStatus || (countParameterEvidence(subunsurs)===countTotalParameters()?'Selesai':(countParameterEvidence(subunsurs)>0?'Proses':'Belum'));
          await env.DB.prepare("INSERT OR REPLACE INTO opd_data (id, opd, sa, nilai_struktur_proses, nilai_maturitas, nilai_kapabilitas_apip, evidence, qa_apip, mri, iepk, rtp, status, struktur_proses_status, subunsurs, year, kk_data, kk_pm_data, kk_rtp_data, rtp_evidence, rtp_evidence_folder, rtp_evidence_folder_id, pm_spip_reports, pm_spip_folder, pm_spip_folder_id, rr_rtp_reports, rr_rtp_folder, rr_rtp_folder_id, computed_workbook_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(row.id, sanitizeString(row.opd||''), sa, nilaiStrukturProses, nilaiMaturitas, nilaiKapabilitasApip, row.evidence||'Belum', row.qa_apip || row.qaApip || 'Belum', parseFloat(row.mri)||0, parseFloat(row.iepk)||0, row.rtp||'Belum', row.status||'Belum', strukturStatus, JSON.stringify(subunsurs), year, JSON.stringify(kkData), JSON.stringify(kkPmData), JSON.stringify(kkRtpData), JSON.stringify(rtpEvidence), row.rtp_evidence_folder || row.rtpEvidenceFolder || 'Evidence RTP', row.rtp_evidence_folder_id || row.rtpEvidenceFolderId || '', JSON.stringify(pmSpipReports), row.pm_spip_folder || row.pmSpipFolder || 'Laporan Hasil PM SPIP', row.pm_spip_folder_id || row.pmSpipFolderId || '', JSON.stringify(rrRtpReports), row.rr_rtp_folder || row.rrRtpFolder || 'Laporan Pemantauan RR_RTP', row.rr_rtp_folder_id || row.rrRtpFolderId || '', typeof computedWorkbookData === 'string' ? computedWorkbookData : JSON.stringify(computedWorkbookData)).run();
        }
        if (pmItems.length) {
          const stmt = env.DB.prepare(`INSERT OR REPLACE INTO opd_kk_pm_workpaper_items(year,opd_id,target,subunsur,param_id,hasil_pengujian,grade_result,aoi_cluster,aoi_desc,cause_cluster,cause_desc,conclusion,note,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
          for (const it of pmItems) {
            await stmt.bind(it.year || String(year), it.opd_id, it.target, it.subunsur, it.param_id, it.hasil_pengujian || '', it.grade_result || '', it.aoi_cluster || '', it.aoi_desc || '', it.cause_cluster || '', it.cause_desc || '', it.conclusion || '', it.note || '', it.updated_by || '', it.updated_at || Date.now()).run();
          }
        }
        if (pmMeta.length) {
          const stmt = env.DB.prepare(`INSERT OR REPLACE INTO opd_kk_pm_meta(year,opd_id,target,sector_focus,prepared_by,prepared_date,reviewed_by,reviewed_date,approved_by,approved_date,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
          for (const m of pmMeta) {
            await stmt.bind(m.year || String(year), m.opd_id, m.target, m.sector_focus || '', m.prepared_by || '', m.prepared_date || '', m.reviewed_by || '', m.reviewed_date || '', m.approved_by || '', m.approved_date || '', m.updated_at || Date.now()).run();
          }
        }
        if (qaChecklistItems.length) {
          const stmt = env.DB.prepare(`INSERT OR REPLACE INTO opd_qa_apip_checklist_items(year,opd_id,item_id,checklist,note,examiner_name,updated_at) VALUES(?,?,?,?,?,?,?)`);
          for (const q of qaChecklistItems) {
            await stmt.bind(q.year || String(year), q.opd_id, q.item_id, q.checklist || '', q.note || '', q.examiner_name || '', q.updated_at || Date.now()).run();
          }
        }
        if (workbookEvidenceItems.length) {
          const stmt = env.DB.prepare(`INSERT OR REPLACE INTO opd_workbook_evidence_items(upload_id,year,opd_id,evidence_key,target_code,subunsur,param_id,grade,level,file_name,file_type,r2_key,gdrive_id,sync_status,sync_error,verification_status,verification_examiner,verification_note,verification_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
          for (const e of workbookEvidenceItems) {
            await stmt.bind(e.upload_id,e.year||String(year),e.opd_id,e.evidence_key||'',e.target_code||'',e.subunsur||'',e.param_id||'',e.grade||'',Number(e.level||0),e.file_name||'',e.file_type||'application/octet-stream',e.r2_key||null,e.gdrive_id||null,e.sync_status||'pending',e.sync_error||null,e.verification_status||'',e.verification_examiner||'',e.verification_note||'',e.verification_at||null,e.created_at||Date.now(),e.updated_at||Date.now()).run();
          }
        }
        // Backup payloads may contain old self-selected scores. Recompute once the
        // normalized evidence rows are restored so only accepted evidence contributes.
        const scoreRefreshFailures=[];
        for(const restored of data){if(!restored?.id)continue;try{await refreshVerifiedStructureProcessScore(env,String(year),String(restored.id));}catch(scoreError){scoreRefreshFailures.push(String(restored.id));console.error('Skor pascapemulihan tertunda untuk OPD',restored.id,scoreError?.message||scoreError);}}
        const restoreStatus=scoreRefreshFailures.length?'warning':'success';
        return new Response(JSON.stringify({status:restoreStatus,message:scoreRefreshFailures.length?'Data pulih, tetapi beberapa skor perlu disegarkan ulang.':'Data berhasil dipulihkan dari backup dan skor evidence dihitung ulang.',scoreRefreshPending:scoreRefreshFailures}), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
