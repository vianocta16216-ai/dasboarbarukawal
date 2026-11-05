// SETDA: child storage identities are never used as independent OPDs in Pemda totals.
import { syncSetdaIntoExistingSheets } from './setda-merge.js';
export const SETDA_PARTS = [
  ['hukum','Bagian Hukum'],['ekonomi_sda','Bagian Perekonomian dan Sumber Daya Alam (Ekonomi & SDA)'],
  ['adbang','Bagian Administrasi Pembangunan (Adbang)'],['organisasi','Bagian Organisasi dan Tata Laksana'],
  ['prokopim','Bagian Protokol dan Komunikasi Pimpinan (Prokopim)'],['pemerintahan','Bagian Administrasi Pemerintahan'],
  ['kesra','Bagian Kesejahteraan Rakyat (Kesra)'],['pbj','Bagian Pengadaan Barang dan Jasa (PBJ)'],['umum','Bagian Umum']
].map(([code,name],i)=>({code,name,order:i+1,org:`SEKRETARIAT DAERAH / ${name}`,username:`setda_${code}`}));
export const partId=(year,code)=>`setda_bagian_${year}_${code}`;
export const isSetdaPart=id=>/^setda_bagian_\d{4}_(hukum|ekonomi_sda|adbang|organisasi|prokopim|pemerintahan|kesra|pbj|umum)$/.test(String(id));
export const isSetdaParent=name=>String(name||'').trim().toUpperCase()==='SEKRETARIAT DAERAH';
export const parseJson=(v,f={})=>{try{return typeof v==='string'?JSON.parse(v):v||f;}catch{return f;}};
export const workbookOf=row=>{const data=parseJson(row?.kk_pm_data);return data.workbook||data;};
export async function ensureSetdaSchema(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS setda_compilation_state(
    year TEXT PRIMARY KEY,parent_id TEXT NOT NULL,lock_token TEXT NOT NULL DEFAULT '',lease_until INTEGER NOT NULL DEFAULT 0,
    last_attempt INTEGER NOT NULL DEFAULT 0,last_success INTEGER NOT NULL DEFAULT 0,last_error TEXT NOT NULL DEFAULT '',spreadsheet_id TEXT NOT NULL DEFAULT '')`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS setda_compilation_written (
    year TEXT NOT NULL,spreadsheet_id TEXT NOT NULL,sheet_key TEXT NOT NULL,cell_ref TEXT NOT NULL,
    written_value TEXT NOT NULL,updated_at INTEGER NOT NULL,
    PRIMARY KEY(year,spreadsheet_id,sheet_key,cell_ref))`).run();
}
export async function ensureSetdaParts(env,year){
  const state=await env.DB.prepare('SELECT parent_id FROM setda_compilation_state WHERE year=?').bind(String(year)).first();
  if(!state)return;
  await env.DB.batch(SETDA_PARTS.map(p=>env.DB.prepare(`INSERT OR IGNORE INTO opd_data
    (id,opd,year,sa,nilai_struktur_proses,nilai_maturitas,nilai_kapabilitas_apip,mri,iepk,evidence,qa_apip,rtp,status,struktur_proses_status,subunsurs,kk_data,kk_pm_data,kk_rtp_data,rtp_evidence,rtp_evidence_folder)
    VALUES(?,?,?,0,0,0,0,0,0,'Belum','Belum','Belum','Belum','Belum','{}','{}','{}','{}','[]','Evidence RTP')`).bind(partId(year,p.code),p.org,String(year))));
}
export async function setdaSnapshot(env,year){
  const state=await env.DB.prepare('SELECT * FROM setda_compilation_state WHERE year=?').bind(String(year)).first();
  if(!state)return {enabled:false,parts:[],items:[],evidence:[],meta:[],cells:[]};
  const ids=JSON.stringify(SETDA_PARTS.map(p=>partId(year,p.code)));
  const queries=[
    'SELECT * FROM opd_data WHERE year=? AND id IN (SELECT value FROM json_each(?))',
    'SELECT * FROM opd_kk_pm_workpaper_items WHERE year=? AND opd_id IN (SELECT value FROM json_each(?)) ORDER BY target,subunsur,param_id',
    'SELECT * FROM opd_workbook_evidence_items WHERE year=? AND opd_id IN (SELECT value FROM json_each(?)) ORDER BY target_code,subunsur,param_id,grade,created_at,upload_id',
    'SELECT * FROM opd_kk_pm_meta WHERE year=? AND opd_id IN (SELECT value FROM json_each(?)) ORDER BY target'
  ];
  // D1 batch provides a consistent read snapshot across source tables.
  const result=await env.DB.batch(queries.map(sql=>env.DB.prepare(sql).bind(String(year),ids)));
  const [orgs,items,evidence,meta]=result.map(r=>r.results||[]);
  const parts=SETDA_PARTS.map(p=>({...p,id:partId(year,p.code),row:orgs.find(o=>o.id===partId(year,p.code))}));
  const ordered=list=>parts.flatMap(p=>list.filter(x=>x.opd_id===p.id).map(x=>({...x,partCode:p.code,partName:p.name,partOrder:p.order})));
  const files=ordered(evidence).filter(x=>x.r2_key&&x.file_name);
  const seen=new Set(files.map(x=>x.upload_id));
  // Include legacy Structure & Process evidence without duplicating mirrored uploads.
  for(const p of parts){const obj=parseJson(p.row?.subunsurs);for(const [sub,params] of Object.entries(obj))for(const [param,levels] of Object.entries(params||{}))for(const [level,value] of Object.entries(levels||{})){
    const list=Array.isArray(value)?value:(Array.isArray(value?.files)?value.files:[]);
    for(const f of list){if(!f.uploadId||seen.has(f.uploadId))continue;seen.add(f.uploadId);files.push({partCode:p.code,partName:p.name,partOrder:p.order,opd_id:p.id,upload_id:f.uploadId,subunsur:sub,param_id:param,level:Number(String(level).replace(/^files/,''))||0,target_code:f.targetCode||'T1',grade:f.grade||'',file_name:f.fileName||'',gdrive_id:f.gdriveId||'',r2_key:f.r2Key||'',sync_status:f.syncStatus||'',verification_status:f.verification?.status||''});}
  }}
  files.sort((a,b)=>a.partOrder-b.partOrder||String(a.target_code).localeCompare(String(b.target_code))||String(a.subunsur).localeCompare(String(b.subunsur),undefined,{numeric:true})||String(a.param_id).localeCompare(String(b.param_id),undefined,{numeric:true})||String(a.upload_id).localeCompare(String(b.upload_id)));
  const cells=parts.flatMap(p=>Object.entries(parseJson(p.row?.kk_pm_data).cells||{}).map(([cell,value])=>({partName:p.name,partOrder:p.order,cell,value})));
  return {enabled:true,state,parts,items:ordered(items),evidence:files,meta:ordered(meta),cells};
}
// All compilation output goes into existing input cells on the validated PM workbook.
// Legacy SETDA_* sheet-creation logic has been removed. Old SETDA_* tabs, if any,
// are left untouched rather than deleted by a risky migration.
export async function syncSetda(env,year,{token:tokenProvider,googleFetch,validateWorkbook,canonicalSheetKey,getDriveFile},force=false){
  await ensureSetdaSchema(env);
  const key=String(year),now=Date.now(),owner=crypto.randomUUID();
  const acquired=await env.DB.prepare(`UPDATE setda_compilation_state
    SET lock_token=?,lease_until=?,last_attempt=?
    WHERE year=? AND lease_until<? AND (?=1 OR last_attempt<?)`)
    .bind(owner,now+600000,now,key,now,force?1:0,now-300000).run();
  if(!acquired.meta?.changes)return {status:'pending',message:'Kompilasi sedang berjalan atau menunggu giliran. Tidak ada workbook baru dibuat.'};
  try{
    const snapshot=await setdaSnapshot(env,key);
    if(!snapshot.enabled||!snapshot.state?.parent_id)throw new Error('Aktifkan sembilan bagian Setda terlebih dahulu.');
    if(snapshot.parts.some(p=>!p.row))throw new Error('Data 9 bagian belum lengkap; periksa aktivasi dan akun bagian.');
    const parent=await env.DB.prepare('SELECT kk_pm_data FROM opd_data WHERE id=? AND year=?').bind(snapshot.state.parent_id,key).first();
    const destination=String(workbookOf(parent).workbookSpreadsheetId||'');
    if(!destination)throw new Error('Workbook induk Sekretariat Daerah belum dibuat. Klik Buat/Sinkronkan Workbook Induk lalu konfirmasi Ya.');
    const token=await tokenProvider(env);
    const file=await getDriveFile(token,destination);
    if(!file||file.trashed)throw new Error('Workbook induk telah dihapus dari Google Drive. Klik Buat/Sinkronkan Workbook Induk untuk memulihkan tautan dari master, lalu ulangi kompilasi.');
    if(file.mimeType!=='application/vnd.google-apps.spreadsheet')throw new Error('File induk bukan Google Spreadsheet. Sinkronisasi dihentikan.');
    const originalSources=new Map(snapshot.parts.map(p=>[p.id,String(workbookOf(p.row).workbookSpreadsheetId||'')]));
    const recheckOwnership=async()=>{
      const state=await env.DB.prepare('SELECT lock_token,lease_until,parent_id FROM setda_compilation_state WHERE year=?').bind(key).first();
      if(state?.lock_token!==owner||Number(state.lease_until)<Date.now()+30000)throw new Error('Kunci sinkronisasi habis; hentikan penulisan dan ulangi setelah memuat status terbaru.');
      const current=await env.DB.prepare('SELECT kk_pm_data FROM opd_data WHERE id=? AND year=?').bind(snapshot.state.parent_id,key).first();
      if(workbookOf(current).workbookSpreadsheetId!==destination)throw new Error('ID induk berubah selama sinkronisasi; operasi dihentikan.');
      for(const p of snapshot.parts){
        const row=await env.DB.prepare('SELECT kk_pm_data FROM opd_data WHERE id=? AND year=?').bind(p.id,key).first();
        if(String(workbookOf(row).workbookSpreadsheetId||'')!==originalSources.get(p.id))throw new Error(`Sumber ${p.name} berubah selama kompilasi; batalkan dan ulangi.`);
      }
    };
    const result=await syncSetdaIntoExistingSheets({env,year:key,snapshot,destination,token,googleFetch,validateWorkbook,canonicalSheetKey,recheckOwnership});
    const status=result.conflictCount||result.warningCount?'partial':'success';
    const summary=status==='partial'?`Kompilasi sebagian: ${result.conflictCount} konflik dan ${result.warningCount} peringatan. Periksa laporan gabungan; rumus induk dilindungi.`:'';
    await env.DB.prepare('UPDATE setda_compilation_state SET last_success=?,last_error=?,spreadsheet_id=? WHERE year=? AND lock_token=?')
      .bind(Date.now(),summary,destination,key,owner).run();
    return {status,message:`Kompilasi selesai: ${result.written} sel diperbarui, ${result.unchanged} sel sudah sesuai, ${result.conflictCount} konflik, ${result.warningCount} peringatan. Tidak menambah sheet/workbook.`,
      spreadsheetUrl:`https://docs.google.com/spreadsheets/d/${destination}/edit`,...result};
  }catch(e){await env.DB.prepare('UPDATE setda_compilation_state SET last_error=? WHERE year=? AND lock_token=?')
    .bind(String(e.message||e).slice(0,700),key,owner).run().catch(()=>{});throw e;}
  finally{await env.DB.prepare("UPDATE setda_compilation_state SET lock_token='',lease_until=0 WHERE year=? AND lock_token=?")
    .bind(key,owner).run().catch(()=>{});}
}
