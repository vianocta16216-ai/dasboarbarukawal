import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequest} from '../functions/myCloudinaryHandler.js';
import {SETDA_PARTS,partId} from '../functions/_lib/setda.js';
const filename=process.argv[2];
const input=await new Promise((resolve,reject)=>{const chunks=[];process.stdin.on('data',c=>chunks.push(c));process.stdin.on('end',()=>resolve(Buffer.concat(chunks).toString()));process.stdin.on('error',reject)});
const pass=JSON.parse(input);assert.equal(Object.keys(pass).length,9);
const sqlite=new DatabaseSync(':memory:');
const DB={
  prepare(sql){return {sql,args:[],bind(...args){return {...this,args}},async first(){return sqlite.prepare(this.sql).get(...this.args)||null},async all(){return {results:sqlite.prepare(this.sql).all(...this.args)}},async run(){const r=sqlite.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes)},success:true}}}},
  async batch(statements){let out=[];sqlite.exec('BEGIN');try{for(const s of statements){const stmt=sqlite.prepare(s.sql);if(stmt.columns().length)out.push({results:stmt.all(...s.args)});else{const r=stmt.run(...s.args);out.push({meta:{changes:Number(r.changes)},results:[]})}}sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e}}
};
sqlite.exec(`CREATE TABLE opd_data(id TEXT PRIMARY KEY,opd TEXT,year TEXT,sa REAL DEFAULT 0,nilai_struktur_proses REAL DEFAULT 0,nilai_maturitas REAL DEFAULT 0,nilai_kapabilitas_apip REAL DEFAULT 0,mri REAL DEFAULT 0,iepk REAL DEFAULT 0,evidence TEXT,qa_apip TEXT,rtp TEXT,status TEXT,struktur_proses_status TEXT,subunsurs TEXT,kk_data TEXT,kk_pm_data TEXT,kk_rtp_data TEXT,rtp_evidence TEXT,rtp_evidence_folder TEXT);CREATE TABLE years(year TEXT PRIMARY KEY);`);
const env={DB,KAWAL_SPIP_USERS_JSON:JSON.stringify([{username:'admin_daerah',password:'Synthetic-Admin-Test-Strong-2026!',role:'admin'}, {username:'opd_setda',password:'Synthetic-Parent-Test-Strong-2026!',role:'opd',opdNames:['SEKRETARIAT DAERAH']},{username:'opd_other',password:'Synthetic-Other-Test-Strong-2026!',role:'opd',opdNames:['SEKRETARIAT DPRD']}])};
const background=[];
async function api(action,params={},cookie=''){const response=await onRequest({request:new Request('https://example.test/myCloudinaryHandler',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'CF-Connecting-IP':'127.0.0.1'},body:JSON.stringify({action,year:'2026',...params})}),env,waitUntil(p){background.push(p)}});return {status:response.status,body:await response.json(),cookie:(response.headers.get('Set-Cookie')||'').split(';')[0]}}
const admin=(await api('login',{username:'admin_daerah',password:'Synthetic-Admin-Test-Strong-2026!'}));assert.equal(admin.status,200);
const parent=(await api('login',{username:'opd_setda',password:'Synthetic-Parent-Test-Strong-2026!'}));assert.equal(parent.status,200);
const other=(await api('login',{username:'opd_other',password:'Synthetic-Other-Test-Strong-2026!'}));assert.equal(other.status,200);
const before=await api('getSetdaCompilation',{},admin.cookie);assert.equal(before.status,200);assert.equal(before.body.parts.length,9);assert.equal(before.body.accountSummary.active,0);
sqlite.exec(readFileSync(filename,'utf8'));
const again=await api('getSetdaCompilation',{},admin.cookie);assert.equal(again.status,200,JSON.stringify(again.body));assert.equal(again.body.parts.length,9);assert.equal(again.body.accountSummary.active,9);assert.equal(again.body.enabled,true);
assert.equal((await api('getSetdaCompilation',{},parent.cookie)).status,200);
assert.equal((await api('getSetdaCompilation',{},other.cookie)).status,403);
const saved=sqlite.prepare('SELECT COUNT(*) AS n FROM auth_users').get().n;
sqlite.exec(readFileSync(filename,'utf8'));
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM auth_users').get().n,saved,'running migration twice must not add accounts');
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM opd_data WHERE year='2026' AND id LIKE 'setda_bagian_2026_%'").get().n,9);
for(const p of SETDA_PARTS){
 const result=await api('login',{username:p.username,password:pass[p.username]});assert.equal(result.status,200,`Login must work: ${p.username}; got ${JSON.stringify(result.body)}`);
 const data=await api('getData',{},result.cookie);assert.equal(data.status,200,`getData: ${p.username}`);
 const rows=Array.isArray(data.body)?data.body:data.body.data;
 assert.equal(rows.length,1);assert.equal(rows[0].id,partId('2026',p.code));
 const different=partId('2026',SETDA_PARTS.find(x=>x.code!==p.code).code);
 assert.equal((await api('getKkPmData',{opdId:different},result.cookie)).status,403,'cross-part access forbidden');
}
assert.equal((await api('login',{username:'admin_daerah',password:'Synthetic-Admin-Test-Strong-2026!'})).status,200);
assert.equal((await api('login',{username:'opd_setda',password:'Synthetic-Parent-Test-Strong-2026!'})).status,200);
await Promise.allSettled(background);
console.log('PASS: real XLSX credential hashes authenticate all 9; 9 parts visible on Pemda before/after activation; parent permission works; unrelated OPD denied; same-year isolation; admin/parent existing login preserved; migration repeatable.');
