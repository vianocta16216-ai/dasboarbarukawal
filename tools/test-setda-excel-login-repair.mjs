// Regression: administrative Excel credentials repair, isolation and legacy safety.
// Uses synthetic test passwords, never production credentials.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {onRequest} from '../functions/myCloudinaryHandler.js';
import {SETDA_PARTS,partId} from '../functions/_lib/setda.js';
const sqlite=new DatabaseSync(':memory:');
const DB={
  prepare(sql){return {sql,args:[],bind(...args){return {...this,args}},
    async first(){return sqlite.prepare(this.sql).get(...this.args)||null},
    async all(){return {results:sqlite.prepare(this.sql).all(...this.args)}},
    async run(){const x=sqlite.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(x.changes)}}}}},
  async batch(statements){const out=[];sqlite.exec('BEGIN');try{for(const s of statements){const stmt=sqlite.prepare(s.sql);if(stmt.columns().length)out.push({results:stmt.all(...s.args)});else{const r=stmt.run(...s.args);out.push({results:[],meta:{changes:Number(r.changes)}});}}sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}
};
const users=[{username:'admin_test',password:'Admin-Test-Not-Real-2026!',role:'admin'},
  {username:'other_opd',password:'Other-Test-Not-Real-2026!',role:'opd',opdNames:['SEKRETARIAT DPRD']}];
const env={DB,KAWAL_SPIP_USERS_JSON:JSON.stringify(users)},background=[];
sqlite.exec(`CREATE TABLE opd_data(id TEXT PRIMARY KEY,opd TEXT,year TEXT,subunsurs TEXT,sa REAL DEFAULT 0,mri REAL DEFAULT 0,iepk REAL DEFAULT 0,evidence TEXT,qa_apip TEXT,rtp TEXT,status TEXT,kk_data TEXT);CREATE TABLE years(year TEXT PRIMARY KEY);`);
async function api(action,params={},cookie=''){
  const res=await onRequest({request:new Request('https://test.local/myCloudinaryHandler',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'CF-Connecting-IP':'127.0.0.1'},body:JSON.stringify({action,year:'2026',...params})}),env,waitUntil(p){background.push(p)}});
  return {status:res.status,body:await res.json(),cookie:res.headers.get('Set-Cookie')?.split(';')[0]||''};
}
const login=async(username,password)=>api('login',{username,password});
const adminLogin=await login(users[0].username,users[0].password);assert.equal(adminLogin.status,200);
const admin=adminLogin.cookie,other=(await login(users[1].username,users[1].password)).cookie;
const setup=await api('setupSetda',{},admin);assert.equal(setup.status,200);
const original=setup.body.credentials;
const accountChanges=SETDA_PARTS.map((p,i)=>({username:p.username,password:`Synthetic-Excel-Password-${i}-2026!!`}));
const storedId=partId('2026',SETDA_PARTS[0].code);
sqlite.prepare('UPDATE opd_data SET kk_pm_data=? WHERE id=?').run('{"cells":{"A1":"DO NOT ERASE"}}',storedId);
const reject=await api('repairSetdaAccounts',{accounts:accountChanges},other);
assert.equal(reject.status,403,'OPD must never reset nine accounts');
const invalid=await api('repairSetdaAccounts',{accounts:accountChanges.slice(0,8)},admin);
assert.equal(invalid.body.status,'error','8 accounts must not modify 9 users');
const repair=await api('repairSetdaAccounts',{accounts:accountChanges},admin);
assert.equal(repair.status,200,JSON.stringify(repair.body));assert.equal(repair.body.updated,9);
assert.ok(!JSON.stringify(repair.body).includes('Synthetic-Excel-Password'), 'response must not contain a password');
for(let i=0;i<SETDA_PARTS.length;i++){
  const p=SETDA_PARTS[i];
  const old=await login(p.username,original[i].password);assert.equal(old.status,401,`${p.username} old password must fail`);
  const accepted=await login(p.username,accountChanges[i].password);assert.equal(accepted.status,200,`${p.username} new Excel credential must login`);
  const data=await api('getData',{},accepted.cookie);
  assert.equal(data.status,200);
  const rows=Array.isArray(data.body)?data.body:data.body.data;
  assert.equal(rows.length,1,`${p.username} must have one OPD`);
  assert.equal(rows[0].id,partId('2026',p.code));
  const otherId=partId('2026',SETDA_PARTS[(i+1)%9].code);
  assert.equal((await api('getKkPmData',{opdId:otherId},accepted.cookie)).status,403,`${p.username} must not access another part`);
}
assert.equal(sqlite.prepare('SELECT kk_pm_data FROM opd_data WHERE id=?').get(storedId).kk_pm_data,'{"cells":{"A1":"DO NOT ERASE"}}');
assert.equal((await login(users[1].username,users[1].password)).status,200,'unrelated OPD unchanged');
assert.equal((await login(users[0].username,users[0].password)).status,200,'admin unchanged');
const again=await api('repairSetdaAccounts',{accounts:accountChanges},admin);
assert.equal(again.status,200,'repair is repeatable');
assert.equal((await login(accountChanges[0].username,accountChanges[0].password)).status,200);
assert.equal(sqlite.prepare("SELECT count(*) AS n FROM opd_data WHERE id GLOB 'setda_bagian_*'").get().n,9);
await Promise.allSettled(background);
console.log('PASS: 9 Excel passwords accepted; admin-only; invalid all-or-none; existing hashes replaced; other 32-style users untouched; same-year scoped rows; cross-part access forbidden; evidence/workbook data unchanged; repeatable repair.');
