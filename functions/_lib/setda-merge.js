/*
 * Non-destructive Setda workbook consolidation.
 * Never creates/deletes/renames sheets, never writes to a formula, never invents a
 * numerical/grade aggregation rule. A durable per-cell ledger makes retries idempotent
 * and prevents overwriting independent edits in the parent workbook.
 */
import { SETDA_PARAMETER_ROWS } from './setda-workpaper-map.js';

export const SETDA_KK_TARGETS = Object.freeze({T1:'KK31',T2:'KK32',T3:'KK33',T4:'KK34'});
const TARGET_COLUMNS = ['M','N','O','P','Q','R'];
const D1_COLUMNS = ['hasil_pengujian','grade_result','aoi_cluster','aoi_desc','cause_cluster','cause_desc'];
const LEAD_CELLS = ['I11','I68','I85','I106'];
const ALLOWED_ROWS=Object.fromEntries(Object.entries(SETDA_KK_TARGETS).map(([target,key])=>{
  const rows=new Map();for(const info of Object.values(SETDA_PARAMETER_ROWS[target]||{})){
    const n=typeof info==='number'?info:info.row;
    for(const row of (typeof info==='number'?[info]:(info.gradeRows||[info.row])))rows.set(row,{anchorRow:n,description:info.description||''});
  }return [key,rows];
}));
const isFormula = value => typeof value === 'string' && /^\s*=/.test(value);
const isEmpty = v => v === undefined || v === null || v === '';
const qsheet = title => `'${String(title).replace(/'/g,"''")}'`;
const coordsKey = (key,cell) => `${key}!${cell}`;
const canonicalValue = x => JSON.stringify(x === undefined || x === null ? '' : x);

export function setdaMergeValue(entries, partNames) {
  const sorted=[...entries].filter(x=>!isEmpty(x.value)).sort((a,b)=>a.order-b.order);
  if(!sorted.length)return {kind:'empty',value:''};
  // Nine separate assessments cannot legally become one numeric score by SUM/AVG.
  const distinct=[...new Set(sorted.map(x=>canonicalValue(x.value)))];
  const isGrade=sorted.some(x=>x.grade === true);
  if(isGrade || sorted.some(x=>typeof x.value==='number' || typeof x.value==='boolean')){
    if(distinct.length!==1)return {kind:'conflict',reason:'Nilai/grade antarbagian berbeda; diperlukan penetapan nilai induk oleh penanggung jawab.'};
    return {kind:'value',value:sorted[0].value};
  }
  if(sorted.some(x=>isFormula(x.value)))return {kind:'conflict',reason:'Sumber mencoba memasukkan formula sebagai nilai input.'};
  if(sorted.length===1)return {kind:'value',value:String(sorted[0].value)};
  const combined=sorted.map(x=>`[${String(x.order).padStart(2,'0')} · ${partNames.get(x.order)||'Bagian'}]\n${String(x.value)}`).join('\n\n');
  if(combined.length>45000)return {kind:'conflict',reason:'Isi gabungan lebih besar dari batas aman sel Google Sheets (45.000 karakter).'};
  return {kind:'value',value:combined};
}
export function setdaCanWriteCell({current,template,lastWritten,desired}) {
  if(isFormula(current)||isFormula(template))return {ok:false,reason:'Sel ini merupakan formula dan tidak boleh ditimpa.'};
  if(canonicalValue(current)===canonicalValue(desired))return {ok:true,unchanged:true};
  // Baseline master, empty cell, or a value originally written by this compiler.
  if(canonicalValue(current)===canonicalValue(template)||isEmpty(current)||lastWritten!==undefined&&canonicalValue(current)===canonicalValue(lastWritten))return {ok:true,unchanged:false};
  return {ok:false,reason:'Sel induk sudah diubah manual; penimpaan otomatis diblokir.'};
}

function gridDataFromRanges(ranges,startRow){
  const map=new Map();
  (ranges||[]).forEach((valueRange,i)=>{
    const values=valueRange?.values||[];
    values.forEach((row,j)=>row.forEach((v,k)=>{
      if(v!==undefined)map.set(`${startRow[i]+j}:${k}`,v);
    }));
  });
  return map;
}
function safeCellAddress(value){
  const m=String(value||'').match(/^\s*(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]{1,3})\$?([1-9]\d{0,6})\s*$/i);
  if(!m)return null;
  return {sheet:String((m[1]||m[2]).replace(/''/g,"'")).trim(),cell:`${m[3].toUpperCase()}${m[4]}`};
}
function cellLetter(col){let s='',n=col;do{s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)-1;}while(n>=0);return s;}
function cellColumn(cell){let n=0;for(const c of cell.match(/^[A-Z]+/)[0])n=n*26+c.charCodeAt(0)-64;return n-1;}
function cellRow(cell){return Number(cell.match(/\d+$/)[0]);}
function allowSparseInput(key,cell){
  if(['FAQ','DAFTARKK','NAMAOPD','CHECKLISTPK','REF','REFPCT','INDIKATORHASIL'].includes(key)||key.startsWith('KKLEAD'))return false;
  if(Object.values(SETDA_KK_TARGETS).includes(key))return /^[MNOPQR][1-9]\d*$/i.test(cell)&&ALLOWED_ROWS[key]?.has(cellRow(cell));
  return key.startsWith('KKE')||/^KK[4-8]/.test(key);
}
function textAnchor(value){return String(value||'').replace(/\s+/g,' ').trim().toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,'').slice(0,85);}
function makeRangeDefs(metadata, canonicalSheetKey, sparseRequests){
  const byKey=new Map();
  for(const sheet of metadata.sheets||[]){
    const p=sheet.properties||{},key=canonicalSheetKey(p.title);
    if(key && byKey.has(key))throw new Error(`Sheet induk memiliki nama semantik ganda: ${p.title}. Kompilasi dibatalkan tanpa mengubah file.`);
    if(key)byKey.set(key,p);
  }
  const defs=[];
  for(const [target,key] of Object.entries(SETDA_KK_TARGETS)){
    const p=byKey.get(key);if(!p)throw new Error(`Sheet ${key} tidak ada pada workbook induk.`);
    const rows=Object.values(SETDA_PARAMETER_ROWS[target]);
    const last=Math.max(...rows.flatMap(x=>typeof x==='number'?[x]:(x.gradeRows||[x.row])));
    // Read only six workpaper input columns (not the enormous formula grids).
    defs.push({key,sheet:p.title,range:`${qsheet(p.title)}!M1:R${last}`,startRow:1,startCol:12,type:'input'});
    defs.push({key,sheet:p.title,range:`${qsheet(p.title)}!D1:D${last}`,startRow:1,startCol:3,type:'anchor'});
  }
  // Explicitly saved sparse inputs can target any existing, non-formula sheet.
  // Read only those addressed cells, never the full template workbook.
  for(const entry of sparseRequests.values()){
    const p=byKey.get(entry.key);if(!p)continue;
    defs.push({key:entry.key,sheet:p.title,range:`${qsheet(p.title)}!${entry.cell}`,startRow:cellRow(entry.cell),startCol:cellColumn(entry.cell),type:'sparse',cell:entry.cell});
  }
  return {defs,byKey};
}
async function readRanges(api,id,defs){
  const result=new Map();
  for(let off=0;off<defs.length;off+=45){
    const segment=defs.slice(off,off+45);
    const query=segment.map(d=>`ranges=${encodeURIComponent(d.range)}`).join('&');
    const response=await api(`${encodeURIComponent(id)}/values:batchGet?${query}&valueRenderOption=FORMULA`);
    segment.forEach((d,i)=>{
      const values=response.valueRanges?.[i]?.values||[];
      result.set(d.range,values);
    });
  }
  return result;
}
function valueAt(rangeData,def,cell){
  const row=cellRow(cell)-def.startRow;
  const col=cellColumn(cell)-def.startCol;
  return row<0||col<0?'':(rangeData.get(def.range)?.[row]?.[col]??'');
}
function defForCell(defs,key,cell){
  return defs.find(d=>d.key===key&&d.type==='sparse'&&d.cell===cell)
    ||defs.find(d=>d.key===key&&d.type==='input'&&cellRow(cell)>=d.startRow&&cellColumn(cell)>=d.startCol&&cellColumn(cell)<d.startCol+6);
}
function addCandidate(store,part,canonicalKey,cell,value,{grade=false,source='unknown'}={}){
  if(isEmpty(value)||isFormula(value))return;
  const k=coordsKey(canonicalKey,cell);
  if(!store.has(k))store.set(k,{key:canonicalKey,cell,parts:new Map()});
  const existing=store.get(k).parts.get(part.order);
  if(!existing || source==='app')store.get(k).parts.set(part.order,{order:part.order,value,grade,source});
}
async function updateLedger(db,year,spreadsheetId,changes){
  if(!changes.length)return;
  const statements=changes.map(c=>db.prepare(`INSERT INTO setda_compilation_written(year,spreadsheet_id,sheet_key,cell_ref,written_value,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(year,spreadsheet_id,sheet_key,cell_ref) DO UPDATE SET written_value=excluded.written_value,updated_at=excluded.updated_at`)
    .bind(year,spreadsheetId,c.key,c.cell,canonicalValue(c.value),Date.now()));
  for(let i=0;i<statements.length;i+=60)await db.batch(statements.slice(i,i+60));
}

export async function syncSetdaIntoExistingSheets({env,year,snapshot,destination,token,googleFetch,canonicalSheetKey,validateWorkbook,recheckOwnership}){
  const conflicts=[],warnings=[];
  const api=async(path,body=null,method='GET')=>{
    const response=await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`,
      {method:body?'POST':method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)},
      {retries:1,baseDelay:700,googleSheetsReadEnv:env});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(`Google Sheets ${response.status}: ${String(data.error?.message||'Tidak dapat membaca/menulis workbook').slice(0,300)}`);
    return data;
  };
  // Fail closed unless the parent workpaper and core lead formulas are valid.
  const checked=await validateWorkbook(token,destination,{checkFormulas:true,env,forceMetadataRefresh:true});
  if(!checked.ok||checked.profile!=='PM_2026')throw new Error('Workbook induk tidak lulus validasi sheet/formula KK LEAD. Tidak ada sel diubah. Buat/sinkronkan ulang workbook induk resmi terlebih dahulu.');
  const originalSheets=(checked.metadata?.sheets||[]).map(s=>({id:s.properties.sheetId,title:s.properties.title}));
  const parent=await env.DB.prepare('SELECT kk_pm_data FROM opd_data WHERE id=? AND year=?').bind(snapshot.state.parent_id,year).first();
  const parentRoot=(()=>{try{return JSON.parse(parent?.kk_pm_data||'{}')}catch{return {}}})();
  const sourceTemplateId=String((parentRoot.workbook||parentRoot).templateSpreadsheetId||'');
  if(!sourceTemplateId || sourceTemplateId===destination)throw new Error('ID master asli untuk membandingkan sel input belum tersedia. Kompilasi dihentikan demi melindungi rumus.');
  const templateCheck=await validateWorkbook(token,sourceTemplateId,{checkFormulas:true,env});
  if(!templateCheck.ok || templateCheck.profile!=='PM_2026')throw new Error('Template sumber tidak lulus validasi formula; penggabungan dibatalkan.');
  const sheetsByKey=new Map((templateCheck.metadata.sheets||[]).map(s=>[canonicalSheetKey(s.properties.title),s.properties.title]));

  const sparseRequests=new Map(), candidates=new Map(), partNames=new Map(snapshot.parts.map(p=>[p.order,p.name]));
  for(const p of snapshot.parts){
    for(const [address,value] of Object.entries((()=>{try{return JSON.parse(p.row?.kk_pm_data||'{}').cells||{}}catch{return {}}})())){
      const parsed=safeCellAddress(address);if(!parsed)continue;
      const key=canonicalSheetKey(parsed.sheet);
      if(!key||!sheetsByKey.has(key)||!allowSparseInput(key,parsed.cell))continue;
      const normalized=value&&typeof value==='object'&&Object.prototype.hasOwnProperty.call(value,'value')?value.value:value;
      if(!['string','number','boolean'].includes(typeof normalized))continue;
      sparseRequests.set(coordsKey(key,parsed.cell),{key,cell:parsed.cell});
      addCandidate(candidates,p,key,parsed.cell,normalized,{source:'app'});
    }
  }
  const {defs,byKey}=makeRangeDefs(checked.metadata,canonicalSheetKey,sparseRequests);
  // Template names may use aliases. Match by canonical key, never sheet order.
  const templateDefs=defs.map(d=>({...d,sheet:sheetsByKey.get(d.key),range:`${qsheet(sheetsByKey.get(d.key))}!${d.range.split('!').slice(1).join('!')}`}));
  const [parentData,templateData]=await Promise.all([
    readRanges(api,destination,defs),readRanges(api,sourceTemplateId,templateDefs)
  ]);
  const parentDef= (key,cell)=>defForCell(defs,key,cell);
  const templateDef=(key,cell)=>defForCell(templateDefs,key,cell);
  // Before reading a department's Google Sheets, use the D1 entries as a guaranteed
  // reliable source for the app's saved evaluations.
  let mapped=0;
  for(const item of snapshot.items){
    const target=String(item.target||'').toUpperCase(),key=SETDA_KK_TARGETS[target];
    const info=SETDA_PARAMETER_ROWS[target]?.[`${item.subunsur}|${item.param_id}`];
    if(!key||!info){warnings.push(`Parameter aplikasi ${target}/${item.subunsur}/${item.param_id} belum mempunyai pemetaan baris yang tervalidasi.`);continue;}
    const row=typeof info==='number'?info:info.row;
    if(info.description){
      const actual=valueAt(parentData,defs.find(d=>d.key===key&&d.type==='anchor'),`D${row}`);
      if(textAnchor(actual)!==textAnchor(info.description)){
        warnings.push(`Baris ${key}!D${row} tidak cocok dengan deskripsi parameter master; isian D1 ${item.partName} tidak ditimpa ke baris yang salah.`);continue;
      }
    }
    const part=snapshot.parts.find(p=>p.order===item.partOrder);if(!part)continue;
    D1_COLUMNS.forEach((field,j)=>addCandidate(candidates,part,key,`${TARGET_COLUMNS[j]}${row}`,item[field],{grade:j===1,source:'app'}));mapped++;
  }
  // Direct edits in a department's source workbook are accepted only when a
  // source input differs from the canonical template. Formula output is ignored.
  const sourceIds=new Set();let connectedSources=0;
  for(const part of snapshot.parts){
    const raw=(()=>{try{return JSON.parse(part.row?.kk_pm_data||'{}')}catch{return {}}})(), wb=raw.workbook||raw;
    const id=String(wb.workbookSpreadsheetId||'');
    if(!id){warnings.push(`${part.name}: workbook bagian belum dibuat; hanya data aplikasi yang dapat dikompilasi.`);continue;}
    if(id===destination||sourceIds.has(id))throw new Error('Ada ID workbook bagian yang sama dengan induk/bagian lain. Kompilasi dihentikan untuk menghindari duplikasi.');
    sourceIds.add(id);
    let meta;
    try{meta=await api(`${encodeURIComponent(id)}?fields=sheets(properties(title,sheetId))`);}catch(e){
      warnings.push(`${part.name}: workbook Google Sheets tidak dapat dibaca (${String(e.message).slice(0,140)}). Data D1 bagian tetap digunakan.`);continue;
    }
    const sourceTitleByKey=new Map((meta.sheets||[]).map(s=>[canonicalSheetKey(s.properties.title),s.properties.title]));
    const departmentDefs=defs.filter(d=>(d.type==='input'||d.type==='anchor')&&sourceTitleByKey.has(d.key)).map(d=>({
      ...d,sheet:sourceTitleByKey.get(d.key),range:`${qsheet(sourceTitleByKey.get(d.key))}!${d.range.split('!').slice(1).join('!')}`
    }));
    if(departmentDefs.length!==8){warnings.push(`${part.name}: tidak seluruh sheet KK3.1–3.4 ditemukan; sheet yang cocok tetap diperiksa.`);}
    try{
      const sourceData=await readRanges(api,id,departmentDefs);connectedSources++;
      for(const d of departmentDefs.filter(x=>x.type==='input')){
        const base=templateDefs.find(x=>x.key===d.key&&x.type==='input');
        if(!base)continue;
        const rows=sourceData.get(d.range)||[];
        for(let i=0;i<rows.length;i++)for(let j=0;j<Math.min(6,rows[i]?.length||0);j++){
          const cell=`${TARGET_COLUMNS[j]}${i+1}`,value=rows[i][j];
          if(isEmpty(value)||isFormula(value))continue;
          const allowed=ALLOWED_ROWS[d.key]?.get(i+1);
          if(!allowed)continue;
          const anchorDef=departmentDefs.find(x=>x.key===d.key&&x.type==='anchor');
          if(!anchorDef || textAnchor(valueAt(sourceData,anchorDef,`D${allowed.anchorRow}`))!==textAnchor(allowed.description))continue;
          const templateValue=valueAt(templateData,base,cell);
          if(canonicalValue(value)===canonicalValue(templateValue))continue;
          if(j===1&&!/^[A-E]$/.test(String(value).trim().toUpperCase()))continue;
          const itemKey=coordsKey(d.key,cell),existing=candidates.get(itemKey)?.parts.get(part.order);
          if(existing && canonicalValue(existing.value)!==canonicalValue(value)){
            warnings.push(`Sumber ${part.name}, ${d.sheet}!${cell}: isian aplikasi dan Google Sheets berbeda; digunakan isian aplikasi.`);continue;
          }
          addCandidate(candidates,part,d.key,cell,value,{grade:j===1,source:'google'});
        }
      }
    }catch(e){warnings.push(`${part.name}: gagal membaca sel input Google Sheets (${String(e.message).slice(0,130)}). Data D1 tetap aman.`);}
  }
  const ledgerRows=(await env.DB.prepare('SELECT sheet_key,cell_ref,written_value FROM setda_compilation_written WHERE year=? AND spreadsheet_id=?').bind(year,destination).all()).results||[];
  const oldLedger=new Map(ledgerRows.map(r=>[coordsKey(r.sheet_key,r.cell_ref),JSON.parse(r.written_value)]));
  const desired=new Map(),unresolved=new Set();
  for(const [key,entry] of candidates){
    const chosen=setdaMergeValue([...entry.parts.values()],partNames);
    if(chosen.kind==='conflict'){
      unresolved.add(key); // Preserve previous synced value while a new conflict awaits manual reconciliation.
      conflicts.push({sheet:byKey.get(entry.key)?.title||entry.key,cell:entry.cell,reason:chosen.reason,parts:[...entry.parts.keys()]});continue;
    }
    if(chosen.kind==='value')desired.set(key,{...entry,value:chosen.value});
  }
  // Previously synced input that was removed from all 9 parts is reverted to the
  // *master input default*, never to an arbitrary blank and never a formula.
  for(const [key,previousValue] of oldLedger){
    if(desired.has(key)||unresolved.has(key))continue;
    const i=key.lastIndexOf('!'),sheetKey=key.slice(0,i),cell=key.slice(i+1);
    const def=templateDef(sheetKey,cell);
    if(!def)continue;
    desired.set(key,{key:sheetKey,cell,value:valueAt(templateData,def,cell),restore:true});
  }
  const writes=[];let unchanged=0;
  for(const [key,entry] of desired){
    const p=byKey.get(entry.key),d=parentDef(entry.key,entry.cell),td=templateDef(entry.key,entry.cell);
    if(!p||!d||!td){warnings.push(`Sel ${key} tidak termasuk area pemetaan aman; tidak ditulis.`);continue;}
    const current=valueAt(parentData,d,entry.cell),template=valueAt(templateData,td,entry.cell);
    // Never overwrite hardcoded source-master content, including labels or
    // static grade values on KK3.x; only genuinely empty input cells are writable.
    if(!isEmpty(template)){
      conflicts.push({sheet:p.title,cell:entry.cell,reason:'Sel terisi pada master resmi; hanya sel input kosong yang aman untuk kompilasi.',parts:[...(entry.parts?.keys()||[])]});continue;
    }
    const permission=setdaCanWriteCell({current,template,lastWritten:oldLedger.get(key),desired:entry.value});
    if(!permission.ok){conflicts.push({sheet:p.title,cell:entry.cell,reason:permission.reason,parts:[...(entry.parts?.keys()||[])]});continue;}
    if(permission.unchanged){unchanged++;continue;}
    writes.push({key:entry.key,cell:entry.cell,value:entry.value,range:`${qsheet(p.title)}!${entry.cell}`});
  }
  // Verify no concurrent operator replaced any source workbook or destination link.
  await recheckOwnership();
  for(let i=0;i<writes.length;i+=180){
    const section=writes.slice(i,i+180);
    // Single request for 180 independent cells. RAW string values preserve existing
    // formulas in ALL cells not selected for update.
    await api(`${encodeURIComponent(destination)}/values:batchUpdate`,{valueInputOption:'RAW',data:section.map(w=>({range:w.range,majorDimension:'ROWS',values:[[w.value]]}))});
    await updateLedger(env.DB,year,destination,section);
  }
  // The four formula anchors must still be intact and sheet count unchanged.
  const post=await validateWorkbook(token,destination,{checkFormulas:true,env,forceMetadataRefresh:true});
  if(!post.ok||post.profile!=='PM_2026')throw new Error('Verifikasi setelah sinkronisasi mendeteksi perubahan tidak sah pada struktur/formula inti. Periksa riwayat versi Google Sheets sebelum melanjutkan.');
  const postSheets=(post.metadata?.sheets||[]).map(s=>({id:s.properties.sheetId,title:s.properties.title}));
  if(JSON.stringify(postSheets)!==JSON.stringify(originalSheets))throw new Error('Jumlah/urutan sheet induk berubah selama kompilasi oleh proses lain. Periksa perubahan manual.');
  return {written:writes.length,unchanged,conflicts:conflicts.slice(0,80),conflictCount:conflicts.length,warnings:warnings.slice(0,60),warningCount:warnings.length,
    inputItemsMapped:mapped,sourceWorkbooksRead:connectedSources,sheetCount:postSheets.length,leadFormulasVerified:LEAD_CELLS};
}
