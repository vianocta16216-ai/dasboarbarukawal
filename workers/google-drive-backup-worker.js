/**
 * KAWAL SPIP — Google Drive Backup Queue Consumer
 *
 * Queue message contains metadata only. The actual evidence file stays in R2
 * until this worker successfully writes it to Google Drive.
 */
const MIME_FOLDER = 'application/vnd.google-apps.folder';

function safeName(v, fallback='OPD') {
  return String(v ?? fallback)
    .replace(/[\\/:*?"<>|#%{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150) || fallback;
}

async function fetchRetry(url, init={}, options={}) {
  const retries = Number.isFinite(options.retries) ? options.retries : 5;
  const baseDelay = Number.isFinite(options.baseDelay) ? options.baseDelay : 750;
  let lastErr;
  for (let attempt=0; attempt<=retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      const retryable = [429,500,502,503,504].includes(res.status);
      if (!retryable || attempt === retries) return res;
      const retryAfter = Number(res.headers.get('Retry-After'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(30000, retryAfter*1000)
        : Math.min(30000, baseDelay * 2**attempt + Math.floor(Math.random()*400));
      await new Promise(r=>setTimeout(r, delay));
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
      const delay = Math.min(30000, baseDelay * 2**attempt + Math.floor(Math.random()*400));
      await new Promise(r=>setTimeout(r, delay));
    }
  }
  throw lastErr || new Error('Request Google gagal');
}

let tokenCache = { token:null, expiresAt:0 };
let tokenPromise = null;
const folderCache = new Map();

async function getToken(env) {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 60000) return tokenCache.token;
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async()=>{
    const res = await fetchRetry('https://oauth2.googleapis.com/token', {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({
        client_id:env.GOOGLE_DRIVE_CLIENT_ID,
        client_secret:env.GOOGLE_DRIVE_CLIENT_SECRET,
        refresh_token:env.GOOGLE_DRIVE_REFRESH_TOKEN,
        grant_type:'refresh_token'
      })
    }, {retries:5});
    const data = await res.json().catch(()=>({}));
    if(!res.ok || !data.access_token) throw new Error('Google OAuth gagal: '+JSON.stringify(data));
    tokenCache = {token:data.access_token, expiresAt:now + Math.max(60000, Number(data.expires_in||3600)*1000)};
    return data.access_token;
  })().finally(()=>{tokenPromise=null;});
  return tokenPromise;
}

async function getOrCreateFolder(token,parentId,name) {
  const safe = safeName(name);
  const key = parentId+'\0'+safe;
  if(folderCache.has(key)) return folderCache.get(key);
  const q = `name='${safe.replace(/'/g,"\\'")}' and mimeType='${MIME_FOLDER}' and '${parentId}' in parents and trashed=false`;
  const params = new URLSearchParams({
    q, fields:'files(id,name)', spaces:'drive',
    includeItemsFromAllDrives:'true', supportsAllDrives:'true', pageSize:'10'
  });
  const res = await fetchRetry('https://www.googleapis.com/drive/v3/files?'+params.toString(), {
    headers:{Authorization:`Bearer ${token}`}
  }, {retries:5});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error('Gagal mencari folder Drive: '+JSON.stringify(data));
  const id = data.files?.[0]?.id || await createFolder(token,parentId,safe);
  folderCache.set(key,id);
  return id;
}

async function createFolder(token,parentId,name) {
  const res = await fetchRetry('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({name:safeName(name),mimeType:MIME_FOLDER,parents:[parentId]})
  }, {retries:5});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error('Gagal membuat folder Drive: '+JSON.stringify(data));
  return data.id;
}

async function findByUploadId(token,parentId,uploadId) {
  const key = String(uploadId||'');
  if(!key) return null;
  const q = `appProperties has { key='kawalUploadId' and value='${key.replace(/'/g,"\\'")}' } and '${parentId}' in parents and trashed=false`;
  const params = new URLSearchParams({q,fields:'files(id,name,parents,webViewLink)',spaces:'drive',includeItemsFromAllDrives:'true',supportsAllDrives:'true',pageSize:'10'});
  const res = await fetchRetry('https://www.googleapis.com/drive/v3/files?'+params.toString(),{headers:{Authorization:`Bearer ${token}`}}, {retries:5});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error('Gagal cek duplikat Drive: '+JSON.stringify(data));
  return data.files?.[0] || null;
}

async function uploadToDrive(token,parentId,name,mime,bytes,uploadId) {
  const existing = await findByUploadId(token,parentId,uploadId);
  if(existing) return existing.id;

  const metadata = {
    name,
    parents:[parentId],
    appProperties:{kawalUploadId:String(uploadId)}
  };
  const init = await fetchRetry('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method:'POST',
    headers:{
      Authorization:`Bearer ${token}`,
      'Content-Type':'application/json; charset=UTF-8',
      'X-Upload-Content-Type':mime,
      'X-Upload-Content-Length':String(bytes.length)
    },
    body:JSON.stringify(metadata)
  }, {retries:5});
  const initData=await init.json().catch(()=>({}));
  if(!init.ok) throw new Error('Gagal inisialisasi upload Drive: '+JSON.stringify(initData));
  const location=init.headers.get('Location');
  if(!location) throw new Error('URL sesi resumable Drive tidak tersedia');

  for(let attempt=0; attempt<6; attempt++){
    const res=await fetchRetry(location, {
      method:'PUT',
      headers:{'Content-Type':mime,'Content-Length':String(bytes.length),'Content-Range':`bytes 0-${bytes.length-1}/${bytes.length}`},
      body:bytes
    }, {retries:5});
    if(res.ok){
      const data=await res.json().catch(()=>({}));
      if(data.id) return data.id;
    }
    if([400,401,403,404].includes(res.status)){
      // The session can expire; re-create a fresh resumable session.
      break;
    }
  }

  // Fresh session fallback after a failed/expired resumable session.
  const init2 = await fetchRetry('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method:'POST',
    headers:{
      Authorization:`Bearer ${token}`,
      'Content-Type':'application/json; charset=UTF-8',
      'X-Upload-Content-Type':mime,
      'X-Upload-Content-Length':String(bytes.length)
    },
    body:JSON.stringify(metadata)
  }, {retries:5});
  if(!init2.ok) throw new Error('Gagal membuka ulang sesi Drive: '+await init2.text());
  const location2=init2.headers.get('Location');
  if(!location2) throw new Error('URL sesi Drive kedua tidak tersedia');
  const finalRes=await fetchRetry(location2, {
    method:'PUT',
    headers:{'Content-Type':mime,'Content-Length':String(bytes.length)},
    body:bytes
  }, {retries:5});
  const finalData=await finalRes.json().catch(()=>({}));
  if(!finalRes.ok || !finalData.id) throw new Error('Upload Drive gagal: '+JSON.stringify(finalData));
  return finalData.id;
}

async function readR2Bytes(env,key) {
  const obj=await env.EVIDENCE_BUCKET.get(key);
  if(!obj) throw new Error('Objek R2 tidak ditemukan: '+key);
  return new Uint8Array(await obj.arrayBuffer());
}

async function markEvidenceDone(env,job,gdriveId) {
  const rec=await env.DB.prepare("SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(job.opdId,job.year).all();
  let obj={};
  try{obj=rec.results[0]?.subunsurs?JSON.parse(rec.results[0].subunsurs):{};}catch{}
  const arr=obj?.[job.subunsur]?.[job.paramId]?.['files'+job.level];
  if(Array.isArray(arr)){
    const item=arr.find(x=>x.uploadId===job.uploadId);
    if(item){
      item.gdriveId=gdriveId;
      item.storage='R2 + Google Drive';
      item.syncStatus='done';
      delete item.syncError;
    }
  }
  await env.DB.prepare("UPDATE opd_data SET subunsurs=? WHERE id=? AND year=?").bind(JSON.stringify(obj),job.opdId,job.year).run();
}

async function markRtpDone(env,job,gdriveId) {
  const rec=await env.DB.prepare("SELECT rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(job.opdId,job.year).all();
  let list=[];
  try{list=rec.results[0]?.rtp_evidence?JSON.parse(rec.results[0].rtp_evidence):[];}catch{}
  const item=list.find(x=>x.uploadId===job.uploadId);
  if(item){
    item.gdriveId=gdriveId;
    item.storage='R2 + Google Drive';
    item.syncStatus='done';
    delete item.syncError;
  }
  await env.DB.prepare("UPDATE opd_data SET rtp_evidence=? WHERE id=? AND year=?").bind(JSON.stringify(list),job.opdId,job.year).run();
}

async function markRetrying(env,job,errorMessage) {
  const msg=String(errorMessage||'Backup Drive belum berhasil').slice(0,500);
  if(job.type==='rtp'){
    const rec=await env.DB.prepare("SELECT rtp_evidence FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(job.opdId,job.year).all();
    let list=[];try{list=rec.results[0]?.rtp_evidence?JSON.parse(rec.results[0].rtp_evidence):[];}catch{}
    const item=list.find(x=>x.uploadId===job.uploadId);
    if(item){item.syncStatus='retrying';item.syncError=msg;}
    await env.DB.prepare("UPDATE opd_data SET rtp_evidence=? WHERE id=? AND year=?").bind(JSON.stringify(list),job.opdId,job.year).run();
  } else {
    const rec=await env.DB.prepare("SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1").bind(job.opdId,job.year).all();
    let obj={};try{obj=rec.results[0]?.subunsurs?JSON.parse(rec.results[0].subunsurs):{};}catch{}
    const arr=obj?.[job.subunsur]?.[job.paramId]?.['files'+job.level];
    if(Array.isArray(arr)){const item=arr.find(x=>x.uploadId===job.uploadId);if(item){item.syncStatus='retrying';item.syncError=msg;}}
    await env.DB.prepare("UPDATE opd_data SET subunsurs=? WHERE id=? AND year=?").bind(JSON.stringify(obj),job.opdId,job.year).run();
  }
}

async function processJob(env,job) {
  if(!env.GOOGLE_DRIVE_CLIENT_ID||!env.GOOGLE_DRIVE_CLIENT_SECRET||!env.GOOGLE_DRIVE_REFRESH_TOKEN||!env.GOOGLE_DRIVE_FOLDER_ID){
    throw new Error('Google Drive credentials/binding belum lengkap');
  }
  const bytes=await readR2Bytes(env,job.r2Key);
  const token=await getToken(env);

  if(job.type==='rtp'){
    const root=await getOrCreateFolder(token,env.GOOGLE_DRIVE_FOLDER_ID,'Kertas Kerja Spreadsheet');
    const yearFolder=await getOrCreateFolder(token,root,job.year);
    const opdFolder=await getOrCreateFolder(token,yearFolder,job.opdName);
    const rtpFolder=await getOrCreateFolder(token,opdFolder,'Kertas Kerja RTP');
    const evidenceFolder=await getOrCreateFolder(token,rtpFolder,job.folderName||'Evidence RTP');
    const id=await uploadToDrive(token,evidenceFolder,job.fileName,job.fileType,bytes,job.uploadId);
    await markRtpDone(env,job,id);
    return;
  }

  const parts=String(job.r2Key).split('/');
  parts.pop();
  let parent=env.GOOGLE_DRIVE_FOLDER_ID;
  for(const part of parts){
    if(!part) continue;
    parent=await getOrCreateFolder(token,parent,part);
  }
  const id=await uploadToDrive(token,parent,job.fileName,job.fileType,bytes,job.uploadId);
  await markEvidenceDone(env,job,id);
}

export default {
  async queue(batch,env) {
    for(const message of batch.messages){
      const job=message.body;
      try{
        await processJob(env,job);
        message.ack();
      }catch(err){
        console.error('Backup Drive job gagal:',job?.uploadId,err?.message||err);
        try{await markRetrying(env,job,err?.message||err);}catch{}
        message.retry();
      }
    }
  }
};
