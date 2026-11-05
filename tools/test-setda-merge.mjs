import assert from 'node:assert/strict';
import {setdaMergeValue,setdaCanWriteCell,syncSetdaIntoExistingSheets} from '../functions/_lib/setda-merge.js';
import {SETDA_PARAMETER_ROWS} from '../functions/_lib/setda-workpaper-map.js';
const parts=new Map([[1,'Bagian Hukum'],[2,'Bagian PBJ']]);
assert.deepEqual(setdaMergeValue([{order:2,value:'data B'},{order:1,value:'data A'}],parts),
  {kind:'value',value:'[01 · Bagian Hukum]\ndata A\n\n[02 · Bagian PBJ]\ndata B'});
assert.equal(setdaMergeValue([{order:1,value:'B',grade:true},{order:2,value:'A',grade:true}],parts).kind,'conflict');
assert.equal(setdaMergeValue([{order:1,value:4},{order:2,value:9}],parts).kind,'conflict');
assert.equal(setdaCanWriteCell({current:'=SUM(A1:A2)',template:'',desired:'ok'}).ok,false);
assert.equal(setdaCanWriteCell({current:'user manual',template:'',desired:'new'}).ok,false);
assert.equal(setdaCanWriteCell({current:'last sync',template:'',lastWritten:'last sync',desired:'new'}).ok,true);
assert.equal(setdaCanWriteCell({current:'placeholder',template:'placeholder',desired:'new'}).ok,true);

const sheetMeta=['KK3.1 OPD','KK3.2 BPKAD AKUN','KK3.3 BPKAD ASET','KK3.4 (INSPEKTORAT)'].map((title,i)=>({properties:{title,sheetId:i+10}}));
const canonical=t=>{const x=t.replace(/[^A-Za-z0-9]/g,'').toUpperCase();return x.startsWith('KK31')?'KK31':x.startsWith('KK32')?'KK32':x.startsWith('KK33')?'KK33':x.startsWith('KK34')?'KK34':x;};
const sourceParts=Array.from({length:9},(_,i)=>({order:i+1,id:'part'+(i+1),name:i===0?'Bagian Hukum':i===1?'Bagian PBJ':'Bagian '+(i+1),row:{kk_pm_data:JSON.stringify({workbook:{workbookSpreadsheetId:'src'+(i+1)}})}}));
const state={sheet:'',parentInput:'',parentGrade:'',written:[],ledger:new Map(),sourceItems:[]};
function mockPrepare(sql){return {bind(...args){return {
  async first(){if(sql.includes('SELECT kk_pm_data FROM opd_data'))return {kk_pm_data:JSON.stringify({workbook:{templateSpreadsheetId:'template'}})};return null;},
  async all(){return {results:sql.includes('FROM setda_compilation_written')?[...state.ledger].map(([k,v])=>({sheet_key:k.split('!')[0],cell_ref:k.split('!')[1],written_value:JSON.stringify(v)})):[]};},
  async run(){if(sql.includes('INSERT INTO setda_compilation_written'))state.ledger.set(args[2]+'!'+args[3],JSON.parse(args[4]));return {meta:{changes:1}};}
};}};}
const env={DB:{prepare:mockPrepare,async batch(a){return Promise.all(a.map(x=>x.run()));}}};
let validationCalls=0;
const validateWorkbook=async(_,id)=>{validationCalls++;return {ok:true,profile:'PM_2026',metadata:{sheets:sheetMeta}};};
const googleFetch=async(url,init)=>{
  const u=new URL(url),id=u.pathname.split('/')[3],qs=u.searchParams.getAll('ranges');
  if(u.pathname.endsWith('/values:batchUpdate')){
    const payload=JSON.parse(init.body);for(const d of payload.data){state.written.push(d);if(d.range.includes('!M11'))state.parentInput=d.values[0][0];if(d.range.includes('!N11'))state.parentGrade=d.values[0][0];}
    return new Response(JSON.stringify({totalUpdatedCells:payload.data.length}),{status:200});
  }
  if(u.pathname.endsWith('/values:batchGet')){
    const out=qs.map(q=>{
      const values=[];
      if(q.includes('KK3.1 OPD') && q.includes('!D1:D') && (id==='parent'||id==='template'||id==='src1'||id==='src2')){
        for(let i=0;i<11;i++)values.push([]);
        values[10]=[SETDA_PARAMETER_ROWS.T1['1.1|1.1.1'].description];
      }
      if(q.includes('KK3.1 OPD') && q.includes('!M1:R') && (id==='parent'||id==='template'||id==='src1'||id==='src2')){
        for(let i=0;i<11;i++)values.push([]);
        if(id==='parent')values[10]=[state.parentInput,state.parentGrade];
        if(id==='src1')values[10]=['data A','A'];
        if(id==='src2')values[10]=['data B','B'];
      }
      return {range:q,values};
    });
    return new Response(JSON.stringify({valueRanges:out}),{status:200});
  }
  if(u.pathname.includes('/spreadsheets/src'))return new Response(JSON.stringify({sheets:sheetMeta}),{status:200});
  throw new Error('Unexpected mock API path: '+url);
};
const args={env,year:'2026',destination:'parent',snapshot:{state:{parent_id:'parent-opd'},parts:sourceParts,items:[]},token:'fake',googleFetch,canonicalSheetKey:canonical,validateWorkbook,recheckOwnership:async()=>{}};
const first=await syncSetdaIntoExistingSheets(args);
assert.equal(first.written,1,JSON.stringify(first));
assert.equal(first.conflictCount,1,JSON.stringify(first.conflicts));
assert.equal(first.sourceWorkbooksRead,9);
assert.equal(first.sheetCount,4);
assert.deepEqual(state.written.map(x=>x.range),["'KK3.1 OPD'!M11"]);
assert.equal(validationCalls>=3,true);
const second=await syncSetdaIntoExistingSheets(args);
assert.equal(second.written,0);
assert.equal(second.unchanged,1);
assert.equal(state.written.length,1);
// A previously synced grade must NOT be reset merely because source grades disagree.
state.ledger.set('KK31!N11','A');state.parentGrade='A';
const third=await syncSetdaIntoExistingSheets(args);
assert.equal(third.written,0,JSON.stringify(third));
assert.equal(state.parentGrade,'A');
assert.equal(state.written.length,1);
// An independent manual edit to a parent cell cannot be silently overwritten.
state.parentInput='reviewer edit';
const fourth=await syncSetdaIntoExistingSheets(args);
assert.equal(fourth.written,0,JSON.stringify(fourth));
assert.equal(state.parentInput,'reviewer edit');
assert.equal(fourth.conflicts.some(x=>x.cell==='M11'),true);
console.log('PASS: ordered nine-part merge; grade conflicts; formula protection; no new tabs; idempotent repeat.');
