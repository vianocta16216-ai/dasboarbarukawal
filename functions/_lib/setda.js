// SETDA: child storage identities are never used as independent OPDs in Pemda totals.
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
export function compilationTables(snapshot){
  return [
    {title:'SETDA_00_DAFTAR',values:[['No','Bagian','Workbook Sumber','Parameter Terisi','Evidence Aktif'],...snapshot.parts.map(p=>[p.order,p.name,workbookOf(p.row).workbookUrl||'',snapshot.items.filter(x=>x.partOrder===p.order).length,snapshot.evidence.filter(x=>x.partOrder===p.order).length])]},
    {title:'SETDA_KK_PARAMETER',values:[['No Bagian','Bagian','Target','Subunsur','Parameter','Hasil Pengujian','Grade','AOI Cluster','AOI Uraian','Sebab Cluster','Sebab Uraian','Kesimpulan','Catatan','Pengisi','Waktu'],...snapshot.items.map(x=>[x.partOrder,x.partName,x.target,x.subunsur,x.param_id,x.hasil_pengujian,x.grade_result,x.aoi_cluster,x.aoi_desc,x.cause_cluster,x.cause_desc,x.conclusion,x.note,x.updated_by,x.updated_at])]},
    {title:'SETDA_EVIDENCE',values:[['No Bagian','Bagian','Target','Subunsur','Parameter','Grade','Level','Nama File','Google Drive','Status Salinan','Verifikasi','Upload ID','ID Bagian'],...snapshot.evidence.map(x=>[x.partOrder,x.partName,x.target_code,x.subunsur,x.param_id,x.grade,x.level,x.file_name,x.gdrive_id?`https://drive.google.com/file/d/${encodeURIComponent(x.gdrive_id)}/view`:'Menunggu salinan Drive; file tersedia di aplikasi',x.sync_status,x.verification_status,x.upload_id,x.opd_id])]},
    {title:'SETDA_META',values:[['No Bagian','Bagian','Target','Fokus','Disusun','Tanggal','Direviu','Tanggal','Disetujui','Tanggal'],...snapshot.meta.map(x=>[x.partOrder,x.partName,x.target,x.sector_focus,x.prepared_by,x.prepared_date,x.reviewed_by,x.reviewed_date,x.approved_by,x.approved_date])]},
    {title:'SETDA_SEL_APLIKASI',values:[['No Bagian','Bagian','Lokasi Sel','Isi'],...snapshot.cells.map(x=>[x.partOrder,x.partName,x.cell,typeof x.value==='object'?JSON.stringify(x.value):x.value])]}
  ];
}
// No user-controlled formula is executed in the compilation workbook.
export const sheetValue=v=>typeof v==='number'&&Number.isFinite(v)?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:String(v??'')};
export function buildSheetRequests(tables,metadata){
  const existing=new Map((metadata.sheets||[]).map(s=>[s.properties.title,s.properties]));
  const used=new Set((metadata.sheets||[]).map(s=>s.properties.sheetId));let next=1900000000;
  const requests=[];
  for(const table of tables){
    let p=existing.get(table.title);const cols=Math.max(1,...table.values.map(r=>r.length)),rowCount=Math.max(2,table.values.length);
    if(!p){while(used.has(next))next++;p={sheetId:next++,title:table.title,gridProperties:{rowCount,columnCount:cols}};used.add(p.sheetId);requests.push({addSheet:{properties:p}});}
    else requests.push({updateSheetProperties:{properties:{sheetId:p.sheetId,gridProperties:{rowCount:Math.max(rowCount,p.gridProperties?.rowCount||0),columnCount:Math.max(cols,p.gridProperties?.columnCount||0)}},fields:'gridProperties.rowCount,gridProperties.columnCount'}});
    requests.push({updateCells:{range:{sheetId:p.sheetId},rows:table.values.map(row=>({values:row.map(v=>({userEnteredValue:sheetValue(v)}))})),fields:'userEnteredValue'}});
    requests.push({repeatCell:{range:{sheetId:p.sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:0.06,green:0.18,blue:0.29},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}}}},fields:'userEnteredFormat'}});
    requests.push({updateSheetProperties:{properties:{sheetId:p.sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}});
  }
  return requests;
}
export async function syncSetda(env,year,{token:tokenProvider,googleFetch},force=false){
  await ensureSetdaSchema(env);
  const key=String(year),now=Date.now(),owner=crypto.randomUUID();
  const acquired=await env.DB.prepare(`UPDATE setda_compilation_state SET lock_token=?,lease_until=?,last_attempt=? WHERE year=? AND lease_until<? AND (?=1 OR last_attempt<?)`)
    .bind(owner,now+600000,now,key,now,force?1:0,now-300000).run();
  if(!acquired.meta?.changes)return {status:'pending',message:'Kompilasi sedang berjalan atau menunggu jadwal berikutnya.'};
  try{
    const snapshot=await setdaSnapshot(env,key);
    const parent=await env.DB.prepare('SELECT kk_pm_data FROM opd_data WHERE id=? AND year=?').bind(snapshot.state.parent_id,key).first();
    const destination=workbookOf(parent).workbookSpreadsheetId;
    if(!destination)throw new Error('Buka KK PM SPIP akun induk dan buat/sinkronkan workbook Sekretariat Daerah terlebih dahulu.');
    const sourceIds=new Set();
    for(const p of snapshot.parts){if(!p.row)throw new Error('Data bagian belum lengkap; jalankan aktivasi ulang.');const id=workbookOf(p.row).workbookSpreadsheetId;if(id){if(id===destination||sourceIds.has(id))throw new Error('Workbook sumber antarbagian/induk bertabrakan.');sourceIds.add(id);}}
    const token=await tokenProvider(env);
    const api=async(path,body)=>{
      const response=await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)},{retries:1,baseDelay:800,googleSheetsReadEnv:env});
      const data=await response.json();if(!response.ok)throw new Error(`Google Sheets ${response.status}: ${String(data.error?.message||'Gagal sinkronisasi').slice(0,400)}`);return data;
    };
    const tables=compilationTables(snapshot);
    // Read actual Google workbooks too: edits made directly in Sheets must be included.
    for(const p of snapshot.parts){
      const wb=workbookOf(p.row);const values=[['Bagian',p.name,'Tahun',key],['Sheet Asal','Baris Asal','Isi sel mulai kolom A →']];
      if(wb.workbookSpreadsheetId){
        if(wb.workbookSpreadsheetId===destination)throw new Error(`Workbook ${p.name} bertabrakan dengan workbook induk.`);
        const meta=await api(`${encodeURIComponent(wb.workbookSpreadsheetId)}?fields=sheets(properties)`);
        const titles=(meta.sheets||[]).map(s=>s.properties.title).filter(t=>!t.startsWith('SETDA_'));
        if(titles.length){
          const qs=titles.map(t=>'ranges='+encodeURIComponent("'"+t.replace(/'/g,"''")+"'")).join('&');
          const source=await api(`${encodeURIComponent(wb.workbookSpreadsheetId)}/values:batchGet?${qs}&valueRenderOption=FORMATTED_VALUE`);
          for(let i=0;i<titles.length;i++)for(const [r,cells] of (source.valueRanges?.[i]?.values||[]).entries())if(cells.some(v=>v!==''&&v!==null))values.push([titles[i],r+1,...cells]);
        }
      }else values.push(['Workbook bagian belum dibuat']);
      tables.push({title:`SETDA_${String(p.order).padStart(2,'0')}_${p.code.toUpperCase()}`,values});
    }
    const metadata=await api(`${encodeURIComponent(destination)}?fields=sheets(properties)`);
    const requests=buildSheetRequests(tables,metadata);
    if(JSON.stringify(requests).length>18000000)throw new Error('Kompilasi melebihi batas aman 18 MB per batch. Data sumber tetap utuh; kurangi lembar sumber yang tidak diperlukan.');
    // Re-check ownership immediately before the single atomic external write.
    const lease=await env.DB.prepare('SELECT lock_token,lease_until FROM setda_compilation_state WHERE year=?').bind(key).first();
    if(lease?.lock_token!==owner||Number(lease.lease_until)<Date.now()+30000)throw new Error('Lease kompilasi berakhir; akan dicoba pada jadwal berikutnya.');
    const latestParent=await env.DB.prepare('SELECT kk_pm_data FROM opd_data WHERE id=? AND year=?').bind(snapshot.state.parent_id,key).first();
    if(workbookOf(latestParent).workbookSpreadsheetId!==destination)throw new Error('Workbook induk berubah saat kompilasi; ulangi sinkronisasi.');
    for(const p of snapshot.parts){const latest=await env.DB.prepare('SELECT kk_pm_data FROM opd_data WHERE id=? AND year=?').bind(p.id,key).first();if(workbookOf(latest).workbookSpreadsheetId!==workbookOf(p.row).workbookSpreadsheetId)throw new Error('Workbook bagian berubah saat kompilasi; ulangi sinkronisasi.');}
    await api(`${encodeURIComponent(destination)}:batchUpdate`,{requests});
    await env.DB.prepare("UPDATE setda_compilation_state SET last_success=?,last_error='',spreadsheet_id=? WHERE year=? AND lock_token=?").bind(Date.now(),destination,key,owner).run();
    return {status:'success',message:'Kompilasi sembilan bagian diperbarui.',spreadsheetUrl:`https://docs.google.com/spreadsheets/d/${destination}/edit`};
  }catch(e){await env.DB.prepare('UPDATE setda_compilation_state SET last_error=? WHERE year=? AND lock_token=?').bind(String(e.message||e).slice(0,700),key,owner).run();throw e;}
  finally{await env.DB.prepare("UPDATE setda_compilation_state SET lock_token='',lease_until=0 WHERE year=? AND lock_token=?").bind(key,owner).run();}
}
