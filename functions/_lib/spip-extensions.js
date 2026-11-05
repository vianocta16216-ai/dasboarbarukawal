// Additive features: risk workbook templates and durable multi-year evidence copies.
export const RISK_TYPES={
  rr_pa:{label:'RR Strategic PA',file:'strategic-pa.xlsx'},
  fraud_pa:{label:'Risiko Fraud Strategic PA',file:'fraud.xlsx',role:'PA'},
  rr_kpa:{label:'RR Tactical KPA Program',file:'tactical-kpa.xlsx'},
  fraud_kpa:{label:'Risiko Fraud Tactical KPA Program',file:'fraud.xlsx',role:'KPA'},
  rr_pptk:{label:'RR Operasional PPTK',file:'operational-pptk.xlsx'},
  fraud_pptk:{label:'Risiko Fraud Operasional PPTK',file:'fraud.xlsx',role:'PPTK'}
};
const schemas=new WeakMap();
export async function ensureExtensionsSchema(env){
  if(schemas.has(env.DB))return schemas.get(env.DB);
  const job=(async()=>{
    await env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS risk_workbooks(year TEXT NOT NULL,opd_id TEXT NOT NULL,kind TEXT NOT NULL,drive_id TEXT,lease_until INTEGER NOT NULL DEFAULT 0,lease_owner TEXT,PRIMARY KEY(year,opd_id,kind))"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS evidence_period_jobs(source_id TEXT PRIMARY KEY,job_json TEXT NOT NULL,end_year INTEGER NOT NULL,next_year INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',error TEXT,lease_until INTEGER NOT NULL DEFAULT 0)"),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS sk_satgas_slots(year TEXT NOT NULL,opd_id TEXT NOT NULL,upload_id TEXT NOT NULL,PRIMARY KEY(year,opd_id))')
    ]);
    const cols=new Set(((await env.DB.prepare('PRAGMA table_info(opd_data)').all()).results||[]).map(x=>x.name));
    for(const [name,def] of [['sk_satgas_reports',"TEXT NOT NULL DEFAULT '[]'"],['sk_satgas_folder',"TEXT NOT NULL DEFAULT 'SK SATGAS SPIP'"],['sk_satgas_folder_id',"TEXT NOT NULL DEFAULT ''"]]){
      if(!cols.has(name))try{await env.DB.prepare(`ALTER TABLE opd_data ADD COLUMN ${name} ${def}`).run();}catch(e){if(!/duplicate column/i.test(e.message))throw e;}
    }
  })();schemas.set(env.DB,job);try{await job;}catch(e){schemas.delete(env.DB);throw e;}
}
function clean(v){return String(v||'').replace(/[\\/:*?"<>|#%{}]/g,' ').replace(/\s+/g,' ').trim().slice(0,100);}
async function checked(response){if(!response.ok)throw new Error(`Google Drive/Sheets (${response.status}): ${(await response.text()).slice(0,300)}`);return response.json();}
export async function riskWorkbookAction(env,request,params,action,api){
  const kind=String(params.kind||''),spec=RISK_TYPES[kind],year=String(params.year),opdId=String(params.opdId||'');
  if(!spec||!/^\d{4}$/.test(year)||!opdId)throw new Error('Jenis kertas kerja, OPD, atau tahun tidak valid.');
  const opd=await env.DB.prepare('SELECT opd FROM opd_data WHERE id=? AND year=?').bind(opdId,year).first();if(!opd)throw new Error('OPD tidak ditemukan.');
  let rec=await env.DB.prepare('SELECT drive_id FROM risk_workbooks WHERE year=? AND opd_id=? AND kind=?').bind(year,opdId,kind).first();
  if(action==='getRiskWorkbook')return {workbook:rec?.drive_id?{id:rec.drive_id,url:`https://docs.google.com/spreadsheets/d/${encodeURIComponent(rec.drive_id)}/edit`}:null,template:`/risk-templates/${spec.file}`,label:spec.label};
  const owner=crypto.randomUUID();await env.DB.prepare('INSERT OR IGNORE INTO risk_workbooks(year,opd_id,kind) VALUES(?,?,?)').bind(year,opdId,kind).run();
  const claim=await env.DB.prepare('UPDATE risk_workbooks SET lease_until=?,lease_owner=? WHERE year=? AND opd_id=? AND kind=? AND lease_until<?').bind(Date.now()+240000,owner,year,opdId,kind,Date.now()).run();
  if(!claim.meta?.changes)throw new Error('Kertas kerja sedang dibuat oleh permintaan lain. Muat ulang beberapa saat lagi.');
  try{
    const token=await api.token(env);let id=rec?.drive_id;
    if(id){const prior=await api.driveFile(token,id);if(prior&&!prior.trashed)return {workbook:{id,url:`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`},label:spec.label};id=null;}
    let folder=await api.folder(token,env.GOOGLE_DRIVE_FOLDER_ID,'Kertas Kerja Spreadsheet');folder=await api.folder(token,folder,year);folder=await api.folder(token,folder,clean(opd.opd));folder=await api.folder(token,folder,spec.label);
    // Recover a completed Drive import if its response was lost before D1 was updated.
    const identity=`risk:${year}:${opdId}:${kind}`;
    const q=`'${folder}' in parents and trashed=false and appProperties has { key='kawalRiskKey' and value='${identity.replace(/'/g,"\\'")}' }`;
    const existing=await checked(await api.fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=10`,{headers:{Authorization:`Bearer ${token}`}}));
    id=existing.files?.[0]?.id;
    if(!id){
      const assetUrl=new URL(`/risk-templates/${spec.file}`,request.url);const asset=env.ASSETS?.fetch?await env.ASSETS.fetch(assetUrl):await fetch(assetUrl);
      if(!asset.ok)throw new Error('Template Excel belum tersedia. Upload folder public/risk-templates terlebih dahulu.');
      const bytes=await asset.arrayBuffer();if(bytes.byteLength<100||bytes.byteLength>10*1024*1024)throw new Error('Ukuran template tidak valid.');
      await api.put(env,`kawal_spip/${year}/${clean(opd.opd)}/Kertas Kerja Risiko/${kind}/template.xlsx`,bytes,{httpMetadata:{contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
      const boundary='kawal_'+crypto.randomUUID();
      const metadata={name:`${opd.opd} - ${spec.label} - ${year}`,parents:[folder],mimeType:'application/vnd.google-apps.spreadsheet',appProperties:{kawalRiskKey:identity}};
      const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,bytes,`\r\n--${boundary}--`]);
      const created=await checked(await api.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':`multipart/related; boundary=${boundary}`},body},{retries:0}));id=created.id;
    }
    if(!id)throw new Error('Google Drive tidak mengembalikan ID workbook.');
    // Preserve every original sheet, format, formula, and validation. Only identity cells change.
    const data=spec.role?[{range:"'Risiko Fraud'!A2",values:[[`${opd.opd} | TAHUN ANGGARAN ${year}`]]},{range:"'Risiko Fraud'!A3",values:[[`${spec.role}: [NAMA PEJABAT TERKAIT] | NIP. [NOMOR NIP PEJABAT TERKAIT]`]]}]:kind==='rr_kpa'?[{range:"'RR PROGRAM FORMAT KPA'!D7",values:[[': '+opd.opd]]},{range:"'RR PROGRAM FORMAT KPA'!D8",values:[[': '+year]]}]:kind==='rr_pptk'?[{range:"'RR PROGRAM'!D6",values:[[': '+opd.opd]]},{range:"'RR PROGRAM'!D7",values:[[': '+year]]}]:[{range:"'RR STRATEGIS FORMAT PA'!B3",values:[['Nama PA']]},{range:"'RR STRATEGIS FORMAT PA'!D5",values:[[': '+opd.opd]]},{range:"'RR STRATEGIS FORMAT PA'!D6",values:[[': '+year]]}];
    if(data.length)await checked(await api.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({valueInputOption:'RAW',data})}));
    await env.DB.prepare('UPDATE risk_workbooks SET drive_id=? WHERE year=? AND opd_id=? AND kind=? AND lease_owner=?').bind(id,year,opdId,kind,owner).run();
    return {workbook:{id,url:`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`},label:spec.label};
  }finally{await env.DB.prepare('UPDATE risk_workbooks SET lease_until=0 WHERE year=? AND opd_id=? AND kind=? AND lease_owner=?').bind(year,opdId,kind,owner).run();}
}
export async function registerEvidencePeriod(env,job,end){
  const first=Number(job.year),last=Number(end||first);
  if(!Number.isInteger(last)||last<first||last>first+4)throw new Error('Masa berlaku maksimal lima tahun termasuk tahun unggahan.');
  if(last===first)return;
  if(!['workbook_evidence','evidence'].includes(job.type))throw new Error('Jenis evidence lintas tahun tidak valid.');
  await env.DB.prepare('INSERT OR IGNORE INTO evidence_period_jobs(source_id,job_json,end_year,next_year) VALUES(?,?,?,?)').bind(job.uploadId,JSON.stringify(job),last,first+1).run();
  const prior=await env.DB.prepare('SELECT end_year FROM evidence_period_jobs WHERE source_id=?').bind(job.uploadId).first();
  if(Number(prior.end_year)!==last)throw new Error('Masa berlaku upload ini sudah ditetapkan. Gunakan upload baru untuk perubahan periode.');
}
export async function processEvidencePeriods(env,api){
  const tasks=(await env.DB.prepare("SELECT * FROM evidence_period_jobs WHERE status='pending' AND lease_until<? ORDER BY source_id LIMIT 4").bind(Date.now()).all()).results||[];
  for(const task of tasks){
    const lease=Date.now()+240000;
    const claim=await env.DB.prepare("UPDATE evidence_period_jobs SET lease_until=? WHERE source_id=? AND status='pending' AND lease_until<?").bind(lease,task.source_id,Date.now()).run();if(!claim.meta?.changes)continue;
    try{
      const source=JSON.parse(task.job_json);
      const sourceRow=await env.DB.prepare('SELECT opd FROM opd_data WHERE id=? AND year=?').bind(source.opdId,String(source.year)).first();
      const sourceReg=await env.DB.prepare('SELECT upload_id FROM evidence_upload_registry WHERE upload_id=? AND opd_id=? AND year=?').bind(source.uploadId,source.opdId,String(source.year)).first();
      if(!sourceRow||!sourceReg){await env.DB.prepare("UPDATE evidence_period_jobs SET status='cancelled',error='Sumber dihapus' WHERE source_id=?").bind(task.source_id).run();continue;}
      // A failed initial R2 write must not create empty copies.
      if(!await env.EVIDENCE_BUCKET.head(source.r2Key))throw new Error('Menunggu file sumber R2 selesai.');
      for(let y=Number(task.next_year);y<=Number(task.end_year);y++){
        const year=String(y);
        let target=await env.DB.prepare('SELECT id,opd FROM opd_data WHERE year=? AND UPPER(TRIM(opd))=UPPER(TRIM(?))').bind(year,sourceRow.opd).first();
        if(!target){
          // OPD IDs are globally unique in the existing schema; future years need a new ID.
          const id=/^(setda_bagian|mh)_\d{4}_/.test(source.opdId)?source.opdId.replace(/_\d{4}_/,`_${year}_`):`period_${year}_${source.opdId}`;
          await env.DB.prepare("INSERT OR IGNORE INTO opd_data(id,opd,year,subunsurs) VALUES(?,?,?,'{}')").bind(id,sourceRow.opd,year).run();
          target=await env.DB.prepare('SELECT id,opd FROM opd_data WHERE id=? AND year=?').bind(id,year).first();
          if(!target||target.opd!==sourceRow.opd)throw new Error('Identitas OPD tahun tujuan bertabrakan.');
        }
        // Carry an explicit source-OPD assignment only to this same organization's year record.
        // Name constraints remain unchanged and are still enforced by authentication.
        await env.DB.prepare(`UPDATE auth_users SET opd_ids_json=json_insert(COALESCE(opd_ids_json,'[]'),'$[#]',?) WHERE EXISTS(SELECT 1 FROM json_each(auth_users.opd_ids_json) WHERE value=?) AND NOT EXISTS(SELECT 1 FROM json_each(auth_users.opd_ids_json) WHERE value=?)`).bind(target.id,source.opdId,target.id).run();
        if(source.targetCode)await api.target(env,year,target.id,source.targetCode);
        await api.editable(env,year,target.id);
        await env.DB.prepare('INSERT OR IGNORE INTO years(year) VALUES(?)').bind(year).run();
        const uploadId=`${source.uploadId}-y${year}`,parts=source.r2Key.split('/');parts[1]=year;parts[parts.length-1]=`${uploadId}-${clean(source.fileName)}`;
        const job={...source,year,opdId:target.id,opdName:target.opd,uploadId,r2Key:parts.join('/'),gdriveId:null,gdriveFolderId:null};
        const now=Date.now();
        await env.DB.prepare(`INSERT OR IGNORE INTO evidence_upload_registry(upload_id,year,opd_id,subunsur,param_id,level,type,r2_key,sync_status,created_at,updated_at,evidence_key,source_model,target_code,grade) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uploadId,year,target.id,source.subunsur,source.paramId,String(source.level),source.type,job.r2Key,'pending',now,now,source.evidenceKey||'',source.type==='workbook_evidence'?'workbook':'legacy',source.targetCode||'',source.grade||'').run();
        const bound=await env.DB.prepare('SELECT year,opd_id,r2_key,evidence_key FROM evidence_upload_registry WHERE upload_id=?').bind(uploadId).first();
        if(!bound||String(bound.year)!==year||bound.opd_id!==target.id||bound.r2_key!==job.r2Key||String(bound.evidence_key||'')!==String(source.evidenceKey||''))throw new Error('Identitas salinan bertabrakan dengan file lain.');
        if(!await env.EVIDENCE_BUCKET.head(job.r2Key)){const object=await env.EVIDENCE_BUCKET.get(source.r2Key);if(!object)throw new Error('Sumber R2 tidak tersedia.');await api.put(env,job.r2Key,object.body,{httpMetadata:{contentType:source.fileType}});}
        if(source.type==='workbook_evidence')await env.DB.prepare(`INSERT OR IGNORE INTO opd_workbook_evidence_items(upload_id,year,opd_id,evidence_key,target_code,subunsur,param_id,grade,level,file_name,file_type,r2_key,sync_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uploadId,year,target.id,source.evidenceKey,source.targetCode,source.subunsur,source.paramId,source.grade,source.level,source.fileName,source.fileType,job.r2Key,'pending',now,now).run();
        else await api.metadata(env,job);
        await api.queue(env,null,job);
        await env.DB.prepare('UPDATE evidence_period_jobs SET next_year=?,error=NULL WHERE source_id=?').bind(y+1,task.source_id).run();
      }
      await env.DB.prepare("UPDATE evidence_period_jobs SET status='done',error=NULL WHERE source_id=?").bind(task.source_id).run();
    }catch(e){await env.DB.prepare('UPDATE evidence_period_jobs SET error=? WHERE source_id=?').bind(String(e.message).slice(0,1000),task.source_id).run();}
    finally{await env.DB.prepare('UPDATE evidence_period_jobs SET lease_until=0 WHERE source_id=? AND lease_until=?').bind(task.source_id,lease).run();}
  }
  return {processed:tasks.length};
}
