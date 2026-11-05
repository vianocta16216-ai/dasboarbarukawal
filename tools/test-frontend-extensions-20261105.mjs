import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../public/script.js',import.meta.url),'utf8');
let calls=0,aborted=0;
const sandbox={kawalTabSession:()=>"test-tab-token",console,URLSearchParams,FormData,File,AbortController,Map,Set,Date,JSON,Promise,currentUser:{username:'user1'},setTimeout:(cb,ms)=>setTimeout(cb,Math.min(ms,30)),clearTimeout,fetch:async(url,opts)=>{calls++;assert.equal(opts.headers['X-Kawal-Tab-Session'],'test-tab-token');return new Promise((resolve,reject)=>{opts.signal.addEventListener('abort',()=>{aborted++;reject(new DOMException('aborted','AbortError'));});});}};
vm.createContext(sandbox);
vm.runInContext(source.slice(source.indexOf('const apiReadRequests='),source.indexOf('// ====== VERIFIKASI PASSWORD'))+'\nthis.api=callServer;',sandbox);
await assert.rejects(sandbox.api('login',{username:'u',password:'p'}),e=>e.code==='REQUEST_TIMEOUT'&&!e.transient);
assert.equal(aborted,1);calls=0;
await Promise.allSettled(Array.from({length:40},()=>sandbox.api('getData',{year:'2026'})));
assert.equal(calls,1,'40 concurrent identical dashboard calls should share one fetch');
sandbox.fetch=async()=>{calls++;return new Response(JSON.stringify({ok:true}));};
assert.equal((await sandbox.api('getData',{year:'2026'})).ok,true,'timed out requests must leave the inflight map');
vm.runInContext(source.slice(source.indexOf('function liveEvidenceLines('),source.indexOf('// Pemisahan target berdasarkan OPD.'))+'\nthis.apply=applyLiveKkMasterRows;',sandbox);
const master=JSON.parse(fs.readFileSync(new URL('../public/workbook-structure-process-master.json',import.meta.url),'utf8'));
const sheets={},names={};
for(const target of master.targets){const rows=[];for(const p of target.parameters){rows.push([p.subCode,p.subunsur]);for(const [i,g] of ['A','B','C','D','E'].entries()){const v=p.grades[g];rows.push(['','',i===0?String(p.no):'',i===0?p.uraianParameter:'',p.kodeParameter,p.mri,p.iepk,g,v.kriteria,v.penjelasan,v.caraPengujian,(v.evidenceDisarankan||[]).join('\n')]);}}sheets[target.code]=rows;names[target.code]=target.sheet;}
const expected=master.targets.map(t=>t.parameters.length);
sandbox.apply(master,{live:true,masterKind:'PM',sheets,sheetNames:names,updatedAt:Date.now()});assert.deepEqual(master.targets.map(t=>t.parameters.length),expected);
assert.deepEqual(expected,[43,42,43,55]);assert.equal(master.parameterBlocksTotal,183);
// Give two target records the same historical key: live reconciliation must not
// remove the T1 association when T2 is processed later.
const a=master.targets[0].parameters[0],b=master.targets[1].parameters[0];b.evidenceKey=a.evidenceKey;
sandbox.apply(master,{live:true,masterKind:'PM',sheets,sheetNames:names,updatedAt:Date.now()});
const shared=master.mergedEvidence.groups.flatMap(g=>g.variants).find(v=>v.variantKey===a.evidenceKey);
assert.ok(shared.targets.includes('T1')&&shared.targets.includes('T2'));assert.equal(shared.grades.A.evidenceByTarget.length,2);
const before=JSON.stringify(master);const broken=structuredClone(sheets);broken.T1=broken.T1.slice(0,3);
assert.throws(()=>sandbox.apply(master,{live:true,sheets:broken,sheetNames:names}),/belum terbaca lengkap/);assert.equal(JSON.stringify(master),before,'partial master must never overwrite last valid mapping');
// 514 physical files on a shared key remain T1-linked after a live refresh.
Object.assign(sandbox,{workbookEvidenceMaster:master,qaApipEvidenceLocationMap:null,qaApipVariantTargetMap:null,qaApipEvidenceIndex:new Map(),qaApipEvidenceFiles:[],qaApipEvidenceUnmapped:[],qaApipSourceFilesCount:0,qaApipCurrentRow:{opd:'OPD'},QA_APIP_GRADE_ORDER:['E','D','C','B','A'],assessmentAllowedTargets:()=>['T1']});
vm.runInContext(source.slice(source.indexOf('function qaApipNormalizeSubCode('),source.indexOf("function qaApipFilesForItem(item,targetFilter='all'){"))+'\nthis.index=qaApipIndexEvidence;',sandbox);
sandbox.index(Array.from({length:514},(_,i)=>({uploadId:String(i),fileName:`file ${i}.pdf`,evidenceKey:a.evidenceKey,grade:'A'})));
assert.equal(sandbox.qaApipEvidenceFiles.length,514);assert.ok(sandbox.qaApipEvidenceFiles.every(f=>f.qaTargetCodes.includes('T1')));
console.log(JSON.stringify({status:'PASS',loginAbort:true,dashboardFetchesFor40ConcurrentCalls:1,masterParameters:expected,totalParameters:183,sharedTargetFilesPreserved:514,partialMasterPreservesMapping:true},null,2));

for(const navigation of ['navigate','reload','back_forward']){
 const storage=new Map([['kawal_spip_tab_session_v1','saved-token']]);let onPageShow;
 const ctx={performance:{getEntriesByType:()=>[{type:navigation}]},sessionStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},window:{addEventListener:(t,f)=>{onPageShow=f;}},location:{reload(){}}};vm.createContext(ctx);
 vm.runInContext(source.slice(0,source.indexOf('// ====== STATUS GLOBAL ======')),ctx);
 assert.equal(storage.has('kawal_spip_tab_session_v1'),navigation==='reload');
 if(navigation==='reload'){onPageShow({persisted:true});assert.equal(storage.size,0);}
}
const extension=fs.readFileSync(new URL('../public/spip-extensions.js',import.meta.url),'utf8');
const ctx={currentYear:'2026',escapeHtml:v=>String(v).replaceAll('"','&quot;'),document:{addEventListener(){},createElement(){return {};},head:{append(){}}}};vm.createContext(ctx);vm.runInContext(extension,ctx);
const markup=vm.runInContext('riskDashboardCells({id:"opd-1"})',ctx);assert.equal((markup.match(/<td>/g)||[]).length,7);assert.equal((markup.match(/data-risk-kind=/g)||[]).length,6);
const period=vm.runInContext('evidencePeriodControl()',ctx);assert.equal((period.match(/<option /g)||[]).length,5);assert.match(period,/2030/);
console.log('PASS: tab navigate/reload/back-forward behavior, session header, seven dashboard cells, five-year selector. DOM markup/VM test, not visual browser rendering.');
