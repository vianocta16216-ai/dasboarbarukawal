import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequest} from '../functions/myCloudinaryHandler.js';
const sqlite=new DatabaseSync(':memory:');
const queries=[];
const DB={prepare(sql){const q={sql,args:[],bind(...args){return {...this,args};},async first(){queries.push({sql:this.sql,args:this.args});return sqlite.prepare(this.sql).get(...this.args)||null;},async all(){queries.push({sql:this.sql,args:this.args});return {results:sqlite.prepare(this.sql).all(...this.args)};},async run(){queries.push({sql:this.sql,args:this.args});const r=sqlite.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(r.changes)}};}};return q;},async batch(list){const out=[];sqlite.exec('BEGIN');try{for(const q of list){queries.push({sql:q.sql,args:q.args});const st=sqlite.prepare(q.sql);if(st.columns().length)out.push({results:st.all(...q.args),meta:{changes:0}});else{const r=st.run(...q.args);out.push({results:[],meta:{changes:Number(r.changes)}});}}sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};


import {SETDA_PARTS,partId,setdaSnapshot,syncSetda,buildSheetRequests,sheetValue} from '../functions/_lib/setda.js';
const users=[{username:'admin_test',password:'admin-test-password-2026',role:'admin'},
{username:'opd_setda',password:'parent-test-password-2026',role:'opd',opdNames:['SEKRETARIAT DAERAH']},
{username:'opd_other',password:'other-test-password-2026',role:'opd',opdNames:['SEKRETARIAT DPRD']}];
const env={DB,KAWAL_SPIP_USERS_JSON:JSON.stringify(users)};const background=[];
async function api(action,params={},cookie=''){
  const res=await onRequest({request:new Request('https://test.local/myCloudinaryHandler',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'CF-Connecting-IP':'127.0.0.1'},body:JSON.stringify({action,year:'2026',...params})}),env,waitUntil(p){background.push(p);}});
  return {res,body:await res.json()};
}
async function login(username,password){const result=await api('login',{username,password});assert.equal(result.res.status,200,JSON.stringify(result.body));return result.res.headers.get('set-cookie').split(';')[0];}
sqlite.exec(`CREATE TABLE opd_data(id TEXT PRIMARY KEY,opd TEXT,year TEXT,subunsurs TEXT,sa REAL DEFAULT 0,mri REAL DEFAULT 0,iepk REAL DEFAULT 0,evidence TEXT,qa_apip TEXT,rtp TEXT,status TEXT,kk_data TEXT);CREATE TABLE years(year TEXT PRIMARY KEY);`);
const admin=await login(users[0].username,users[0].password),parent=await login(users[1].username,users[1].password),other=await login(users[2].username,users[2].password);
assert.equal((await api('setupSetda',{},parent)).res.status,403);
const setup=await api('setupSetda',{},admin);assert.equal(setup.body.status,'success',JSON.stringify(setup.body));assert.equal(setup.body.credentials.length,9);
const creds=setup.body.credentials;assert.equal(new Set(creds.map(c=>c.password)).size,9);
const cookies=[];for(const c of creds)cookies.push(await login(c.username,c.password));
const again=await api('setupSetda',{},admin);assert.equal(again.body.credentials.length,0,'activation must never reset passwords');
const parentId=sqlite.prepare("SELECT id FROM opd_data WHERE opd='SEKRETARIAT DAERAH' AND year='2026'").get().id;
for(let i=0;i<9;i++){
  const id=partId('2026',SETDA_PARTS[i].code);
  const item=await api('saveKkPmItem',{opdId:id,target:'T1',subunsur:'1.1',paramId:'1.1.1',hasilPengujian:'Pengujian bagian '+i,gradeResult:'B'},cookies[i]);assert.equal(item.body.status,'success',JSON.stringify(item.body));
  const save=await api('saveKkPmData',{opdId:id,kkPmData:{cells:{A1:'BAGIAN '+i}}},cookies[i]);assert.equal(save.body.status,'success',JSON.stringify(save.body));
  assert.equal((await api('saveKkPmData',{opdId:partId('2026',SETDA_PARTS[(i+1)%9].code),kkPmData:{cells:{A1:'WRONG'}}},cookies[i])).res.status,403);
  assert.equal((await api('getKkPmData',{opdId:parentId},cookies[i])).res.status,403);
  assert.equal((await api('getSetdaCompilation',{},cookies[i])).res.status,403);
}
assert.equal((await api('getSetdaCompilation',{},other)).res.status,403);
assert.equal((await api('getKkPmData',{opdId:partId('2026','hukum')},parent)).body.status,'success');
assert.equal((await api('saveKkPmData',{opdId:partId('2026','hukum'),kkPmData:{cells:{A1:'parent'}}},parent)).res.status,403);
const adminData=await api('getData',{},admin);assert.equal(adminData.res.status,200);
const adminRows=Array.isArray(adminData.body)?adminData.body:adminData.body.data;
assert.ok(Array.isArray(adminRows),Object.keys(adminData.body).join(','));assert.equal(adminRows.some(r=>r.id.startsWith('setda_bagian_')),false);
const childData=await api('getData',{},cookies[0]);const childRows=Array.isArray(childData.body)?childData.body:childData.body.data;assert.equal(childRows.length,1);assert.equal(childRows[0].id,partId('2026','hukum'));
// Independent writes to the same logical cell are retained in all nine scopes.
await Promise.all(cookies.map((cookie,i)=>api('saveKkPmData',{opdId:partId('2026',SETDA_PARTS[i].code),kkPmData:{cells:{B2:'SIMULTANEOUS '+i}}},cookie)));
let snap=await setdaSnapshot(env,'2026');assert.equal(snap.cells.length,18);assert.deepEqual(snap.parts.map(p=>p.code),SETDA_PARTS.map(p=>p.code));
// Evidence mirrors must appear once, with original scope, and deletion disappears.
const id=partId('2026','hukum');
sqlite.prepare(`INSERT INTO opd_workbook_evidence_items(upload_id,year,opd_id,evidence_key,target_code,subunsur,param_id,grade,level,file_name,file_type,r2_key,created_at,updated_at) VALUES('u1','2026',?,'test','T1','1.1','1.1.1','A',5,'uji.pdf','application/pdf','scoped/u1',1,1)`).run(id);
sqlite.prepare('UPDATE opd_data SET subunsurs=? WHERE id=?').run(JSON.stringify({'1.1':{'1.1.1':{files5:[{uploadId:'u1',fileName:'uji.pdf'},{uploadId:'u2',fileName:'legacy.pdf',r2Key:'legacy/u2'}]}}}),id);
snap=await setdaSnapshot(env,'2026');assert.equal(snap.evidence.length,2);assert.equal(snap.evidence.find(x=>x.upload_id==='u2').level,5);
const parentSnapshot=await api('getSetdaCompilation',{},parent);assert.equal(parentSnapshot.body.evidence.length,2);
sqlite.prepare('DELETE FROM opd_workbook_evidence_items WHERE upload_id=?').run('u1');sqlite.prepare("UPDATE opd_data SET subunsurs='{}' WHERE id=?").run(id);assert.equal((await setdaSnapshot(env,'2026')).evidence.length,0);
// Google contract: snapshot replacement, original workbook tabs untouched, no formula injection.
assert.deepEqual(sheetValue('=IMPORTXML("evil")'),{stringValue:'=IMPORTXML("evil")'});
const metadata={sheets:[{properties:{title:'KKLEAD_SPIP',sheetId:1}},{properties:{title:'SETDA_KK_PARAMETER',sheetId:2,gridProperties:{rowCount:200,columnCount:20}}}]};
const requests=buildSheetRequests([{title:'SETDA_KK_PARAMETER',values:[['H'],['NEW']]}],metadata);
assert.equal(requests.find(r=>r.updateCells).updateCells.range.sheetId,2);assert.equal(requests.find(r=>r.updateCells).updateCells.rows.length,2);assert.ok(!JSON.stringify(requests).includes('formulaValue'));
// Sync mock exercises 9 actual workbook reads, retry state, atomic publish and cross-isolate lease.
const wb=x=>JSON.stringify({workbook:{workbookSpreadsheetId:x,workbookUrl:'https://docs.google.com/spreadsheets/d/'+x+'/edit'}});
sqlite.prepare('UPDATE opd_data SET kk_pm_data=? WHERE id=?').run(wb('parent-sheet'),parentId);
for(const p of SETDA_PARTS)sqlite.prepare('UPDATE opd_data SET kk_pm_data=? WHERE id=?').run(wb('child-'+p.code),partId('2026',p.code));
let writes=[],reads=0,fail=false;
const googleFetch=async(url,init)=>{if(init.method==='POST'){writes.push(JSON.parse(init.body));return Response.json({replies:[]});}reads++;if(fail&&url.includes('child-kesra'))return Response.json({error:{message:'temporary unavailable'}},{status:503});if(url.includes('/values:batchGet'))return Response.json({valueRanges:[{values:[['Header'],['=literal','Actual sheet edit']]}]});return Response.json({sheets:[{properties:{title:'KK3.1',sheetId:1}}]});};
const options={token:async()=> 'test-token',googleFetch};
let sync=await syncSetda(env,'2026',options,true);assert.equal(sync.status,'success');assert.equal(writes.length,1);assert.equal(reads,19);assert.equal(writes[0].requests.filter(r=>r.updateCells).length,14);assert.ok(JSON.stringify(writes[0]).includes('Actual sheet edit'));
const successAt=sqlite.prepare('SELECT last_success FROM setda_compilation_state').get().last_success;
fail=true;await assert.rejects(syncSetda(env,'2026',options,true),/temporary unavailable/);assert.equal(writes.length,1,'failed source read must preserve previous destination');assert.equal(sqlite.prepare('SELECT last_success FROM setda_compilation_state').get().last_success,successAt);
fail=false;const both=await Promise.all([syncSetda(env,'2026',options,true),syncSetda(env,'2026',options,true)]);assert.deepEqual(both.map(r=>r.status).sort(),['pending','success']);
assert.equal((await syncSetda(env,'2026',options)).status,'pending','scheduled cooldown');
const newYear=await api('setupSetda',{year:'2027'},admin);assert.equal(newYear.body.status,'success');assert.equal(newYear.body.credentials.length,0);assert.equal((await setdaSnapshot(env,'2027')).parts.length,9);
if(process.env.SETDA_TEST_FIXTURE)fs.writeFileSync(process.env.SETDA_TEST_FIXTURE,JSON.stringify({rows:adminRows.filter(r=>r.id===parentId),compilation:parentSnapshot.body}));
await Promise.allSettled(background);
console.log('PASS: nine unique accounts, login, idempotent setup, per-part read/write authorization, parent read-only access, year isolation, OPD totals, concurrent saves, evidence deduplication/deletion, real-workbook read contract, literal values, atomic publication, failure recovery, distributed lock and cooldown.');
