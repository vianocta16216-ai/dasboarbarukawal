import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const worker=fs.readFileSync(path.join(root,'functions/myCloudinaryHandler.js'),'utf8');
const helperStart=worker.indexOf('function normalizeSheetTitle(');
const helperEnd=worker.indexOf('async function listPmTemplateCandidates(',helperStart);
assert.ok(helperStart>=0&&helperEnd>helperStart,'pure sheet-resolution helpers not found');
const context={
  PM_MASTER_TARGET_SHEET_ALIASES:{
    T1:['KK3.1','KK3.1 (OPD)','KK3.1 OPD'],
    T2:['KK3.2','KK3.2 BPKAD AKUN','KK3.2 BPKAD Akun','KK3.2 BPKAD'],
    T3:['KK3.3','KK3.3 BPKAD ASET','KK3.3 BPKAD Aset','KK3.3 BPKAD'],
    T4:['KK3.4','KK3.4 (INSPEKTORAT)','KK3.4 INSPEKTORAT','KK3.4 (Inspektorat)']
  }
};
vm.createContext(context);
vm.runInContext(worker.slice(helperStart,helperEnd)+';this.resolveMasterTargetSheetNames=resolveMasterTargetSheetNames;this.normalizeDriveTemplateTitle=normalizeDriveTemplateTitle;this.sheetTitleOf=sheetTitleOf;',context);
const resolve=context.resolveMasterTargetSheetNames;
const pm=resolve({sheets:['KK3.1','KK3.2','KK3.3','KK3.4'].map((title,index)=>({properties:{title,index}}))},context.PM_MASTER_TARGET_SHEET_ALIASES,'PM');
assert.deepEqual({...pm},{T1:'KK3.1',T2:'KK3.2',T3:'KK3.3',T4:'KK3.4'});
const legacy=resolve({sheets:['KK3.1 (OPD)','KK3.2 BPKAD Akun','KK3.3 BPKAD Aset','KK3.4 (INSPEKTORAT)'].map((title,index)=>({properties:{title,index}}))},context.PM_MASTER_TARGET_SHEET_ALIASES,'PM');
assert.deepEqual({...legacy},{T1:'KK3.1 (OPD)',T2:'KK3.2 BPKAD Akun',T3:'KK3.3 BPKAD Aset',T4:'KK3.4 (INSPEKTORAT)'});
assert.throws(()=>resolve({sheets:[{properties:{title:'KK3.1'}}]},context.PM_MASTER_TARGET_SHEET_ALIASES,'PM'),/Tab sumber master PM tidak ditemukan/);
const expected=context.normalizeDriveTemplateTitle('KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313.xlsx');
assert.equal(context.normalizeDriveTemplateTitle('KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313'),expected);
assert.equal(context.normalizeDriveTemplateTitle('KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313 (1)'),expected);
assert.equal(context.sheetTitleOf('KK3.1'),'KK3.1');
assert.equal(context.sheetTitleOf({title:'KK3.2 BPKAD Akun'}),'KK3.2 BPKAD Akun');
assert.ok(worker.includes('corpora:\'allDrives\''),'Drive search must consider shared-drive master templates');
assert.ok(worker.includes("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"),'Only active native Google Sheets can be template candidates');
assert.ok(worker.includes("if(!check.ok||check.profile!=='PM_2026')continue;"),'Discovered candidates must pass 26-sheet and formula validation');
assert.ok(worker.includes("if(getPmSheetProfile(recordedSheets)!=='PM_2026')continue;"),'Master propagation must skip legacy/incomplete OPD workbooks');
assert.ok(worker.includes("if(profile!=='PM_2026'){needsSync=true;"),'The UI must flag legacy 28-sheet workbooks for PM synchronization');
assert.ok(worker.includes('Array.isArray(raw?.workbook?.sheets)?raw.workbook.sheets:[]'),'Master propagation must not assume missing destination metadata means PM_2026');

// Exercise the async resolver with mocked Drive/Sheets responses: a stale legacy ID must
// never be accepted, but the precisely named valid PM_2026 sheet should be discovered.
const resolverStart=worker.indexOf('function normalizeSheetTitle(');
const resolverEnd=worker.indexOf('function expectedPmSheetOrderMatches(',resolverStart);
assert.ok(resolverStart>=0&&resolverEnd>resolverStart,'full PM template resolver block not found');
function makeResolverContext(candidateFiles){
  let searchCalls=0;
  const ctx={
    PM_TEMPLATE_RESOLUTION_CACHE:new Map(),PM_TEMPLATE_RESOLUTION_PENDING:new Map(),
    PM_TEMPLATE_FILE_BASENAME:'KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313',
    URLSearchParams,
    extractSpreadsheetId:value=>String(value||'').trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1]||String(value||'').trim(),
    console:{warn(){}},
    fetchWithRetry:async(url)=>{searchCalls++;return {ok:true,status:200,json:async()=>({files:candidateFiles})};},
    getDriveFile:async(_token,id)=>{
      if(id==='legacy')return{id,name:'Kawal SPIP PK Lama',mimeType:'application/vnd.google-apps.spreadsheet',modifiedTime:'2024-01-01T00:00:00Z',trashed:false};
      const listed=(candidateFiles||[]).find(x=>String(x.id)===String(id));
      if(listed)return{...listed,mimeType:'application/vnd.google-apps.spreadsheet',trashed:false};
      if(id==='pm-good')return{id,name:'KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313',mimeType:'application/vnd.google-apps.spreadsheet',modifiedTime:'2026-10-15T00:00:00Z',trashed:false};
      return null;
    },
    validateKkPmSpreadsheet:async(_token,id)=>id==='legacy'
      ?{ok:false,profile:'LEGACY_PK_28',formulaOk:true,formulaMismatches:[],metadata:{sheets:Array.from({length:28},(_,i)=>({properties:{title:`Legacy ${i+1}`}}))}}
      :(id==='pm-good'||id==='pm-config-old'||(candidateFiles||[]).some(x=>String(x.id)===String(id)))
        ?{ok:true,profile:'PM_2026',formulaOk:true,formulaMismatches:[],metadata:{sheets:Array.from({length:26},(_,i)=>({properties:{title:`PM ${i+1}`}}))}}
        :{ok:false,profile:null,formulaOk:false,formulaMismatches:[],metadata:{sheets:[]}}
  };
  vm.createContext(ctx);
  vm.runInContext(worker.slice(resolverStart,resolverEnd)+';this.resolveKkPmTemplateSpreadsheet=resolveKkPmTemplateSpreadsheet;',ctx);
  return {ctx,getSearchCalls:()=>searchCalls};
}
const validCandidate={id:'pm-good',name:'KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313.xlsx',mimeType:'application/vnd.google-apps.spreadsheet',modifiedTime:'2026-10-15T00:00:00Z',trashed:false};
const discovered=makeResolverContext([validCandidate]);
const chosen=await discovered.ctx.resolveKkPmTemplateSpreadsheet({GOOGLE_SHEETS_PM_TEMPLATE_ID:'legacy'},'token','legacy');
assert.equal(chosen.id,'pm-good');
assert.equal(chosen.source,'drive-discovery');
assert.ok(discovered.getSearchCalls()>=1);
const configured=makeResolverContext([]);
const configuredResult=await configured.ctx.resolveKkPmTemplateSpreadsheet({GOOGLE_SHEETS_PM_TEMPLATE_ID:'pm-good'},'token','pm-good');
assert.equal(configuredResult.id,'pm-good');
assert.equal(configuredResult.source,'configured');
assert.ok(configured.getSearchCalls()>=1,'Configured valid ID must still be compared with newer canonical-name masters');
const oldConfigured={id:'pm-config-old',name:'KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313',mimeType:'application/vnd.google-apps.spreadsheet',modifiedTime:'2026-10-14T00:00:00Z',trashed:false};
const freshCandidate={id:'pm-new',name:'KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313 - BARU',mimeType:'application/vnd.google-apps.spreadsheet',modifiedTime:'2026-10-15T00:00:00Z',trashed:false};
const latest=makeResolverContext([freshCandidate]);
latest.ctx.getDriveFile=async(_token,id)=>String(id)==='pm-config-old'?oldConfigured:(String(id)==='legacy'?{id:'legacy',name:'Kawal SPIP PK Lama',mimeType:'application/vnd.google-apps.spreadsheet',modifiedTime:'2024-01-01T00:00:00Z',trashed:false}:([freshCandidate].find(x=>x.id===id)||null));
const latestChosen=await latest.ctx.resolveKkPmTemplateSpreadsheet({GOOGLE_SHEETS_PM_TEMPLATE_ID:'pm-config-old'},'token','pm-config-old');
assert.equal(latestChosen.id,'pm-new','A newer valid canonical master must replace a stale-but-valid configured ID');
assert.equal(latestChosen.source,'drive-discovery');
const notFound=makeResolverContext([]);
await assert.rejects(()=>notFound.ctx.resolveKkPmTemplateSpreadsheet({GOOGLE_SHEETS_PM_TEMPLATE_ID:'legacy'},'token','legacy'),/Master PM terbaru belum dapat ditemukan dan divalidasi/);
const backupLookalike={id:'pm-backup',name:'KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313 BACKUP LAMA',mimeType:'application/vnd.google-apps.spreadsheet',modifiedTime:'2026-10-16T00:00:00Z',trashed:false};
const backupOnly=makeResolverContext([backupLookalike]);
await assert.rejects(()=>backupOnly.ctx.resolveKkPmTemplateSpreadsheet({GOOGLE_SHEETS_PM_TEMPLATE_ID:'legacy'},'token','legacy'),/Master PM terbaru belum dapat ditemukan dan divalidasi/);

console.log(JSON.stringify({status:'PASS',checks:23,verified:['PM tab aliases resolve before ranges are built','legacy T1-T4 sheet names are supported for safe resolution','missing target tabs fail with useful diagnostics','exact named master discovery handles .xlsx import names and duplicate suffix','stale 28-sheet IDs are rejected and valid PM masters are discovered','valid configured IDs are compared against newest canonical-name masters',
    'newer PM master wins over an older configured 26-sheet master','no-candidate failure explains the required master setup','shared-drive search uses native Google Sheets only','discovered templates and propagation targets require PM_2026 validation']},null,2));
