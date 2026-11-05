import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {onRequest} from '../functions/myCloudinaryHandler.js';
const sqlite=new DatabaseSync(':memory:');
const queries=[];
const DB={prepare(sql){const q={sql,args:[],bind(...args){return {...this,args};},async first(){queries.push({sql:this.sql,args:this.args});return sqlite.prepare(this.sql).get(...this.args)||null;},async all(){queries.push({sql:this.sql,args:this.args});return {results:sqlite.prepare(this.sql).all(...this.args)};},async run(){queries.push({sql:this.sql,args:this.args});const r=sqlite.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(r.changes)}};}};return q;},async batch(list){const out=[];sqlite.exec('BEGIN');try{for(const q of list){queries.push({sql:q.sql,args:q.args});const st=sqlite.prepare(q.sql);if(st.columns().length)out.push({results:st.all(...q.args),meta:{changes:0}});else{const r=st.run(...q.args);out.push({results:[],meta:{changes:Number(r.changes)}});}}sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};

const users=[
 {username:'admin_test',password:'admin-test-password-2026',role:'admin'},
 {username:'verifikator_irban',password:'irban-test-password-2026',role:'irban'},
 {username:'operator_test',password:'operator-test-password-2026',role:'opd',opdIds:['opd1']}
];
const env={DB,KAWAL_SPIP_USERS_JSON:JSON.stringify(users)};
const background=[];
async function api(action,params={},cookie=''){const req=new Request('https://test.local/myCloudinaryHandler',{method:'POST',headers:{'Content-Type':'application/json','Cookie':cookie,'CF-Connecting-IP':'127.0.0.1'},body:JSON.stringify({action,...params})});const res=await onRequest({request:req,env,waitUntil(p){background.push(p);}});return {res,body:await res.json()};}

sqlite.exec('CREATE TABLE opd_data(id TEXT PRIMARY KEY,opd TEXT,year TEXT,subunsurs TEXT); CREATE TABLE years(year TEXT PRIMARY KEY);');
const login = (i,password=users[i].password)=>api('login',{username:users[i].username,password});
const admin=await login(0);assert.equal(admin.res.status,200);
const adminCookie=admin.res.headers.get('set-cookie').split(';')[0];
const irban=await login(1);assert.equal(irban.res.status,200);
const oldCookie=irban.res.headers.get('set-cookie').split(';')[0];
const operator=await login(2);assert.equal(operator.res.status,200);
const operatorCookie=operator.res.headers.get('set-cookie').split(';')[0];
assert.equal((await api('listAuthUsers',{},adminCookie)).res.status,200);
// Deterministic timestamps, independent of CPU speed.
sqlite.exec('UPDATE auth_users SET password_changed_at=password_changed_at-1000');
for(let i=0;i<5;i++)assert.equal((await login(1,'wrong')).res.status,401);
assert.equal((await login(1)).res.status,429,'correct password still respects an active lock before reset');
assert.equal((await login(2)).res.status,200,'shared IP must not block another account');
const action=sqlite.prepare('SELECT action FROM login_attempts LIMIT 1').get().action;
sqlite.prepare('INSERT INTO login_attempts(ip,action,timestamp) VALUES(?,?,?)').run('other-ip',action,Date.now());
sqlite.prepare('INSERT INTO login_attempts(ip,action,timestamp) VALUES(?,?,?)').run('other-ip','login:unrelated',Date.now());
sqlite.prepare('INSERT INTO login_attempts(ip,action,timestamp) VALUES(?,?,?)').run('other-ip','verifyDelete',Date.now());
const newPassword='new-irban-test-password-2026';
assert.equal((await api('resetAuthUserPassword',{username:'verifikator_irban',password:newPassword},operatorCookie)).res.status,403);
const reset=await api('resetAuthUserPassword',{username:' VERIFIKATOR_IRBAN ',password:newPassword},adminCookie);
assert.equal(reset.res.status,200,JSON.stringify(reset.body));
assert.equal(sqlite.prepare('SELECT count(*) AS n FROM login_attempts WHERE action=?').get(action).n,0);
assert.equal(sqlite.prepare('SELECT count(*) AS n FROM login_attempts').get().n,2,'other limits must survive');
assert.equal((await api('authMe',{},oldCookie)).body.authenticated,false);
assert.equal((await api('authMe',{},adminCookie)).body.authenticated,true);
assert.equal((await api('authMe',{},operatorCookie)).body.authenticated,true);
assert.equal((await login(1,newPassword)).res.status,200,'new password works immediately');
assert.equal((await login(1)).res.status,401,'bootstrap password must no longer work');
// Old failed requests / historical resets cannot reintroduce a stale lock.
const resetAt=sqlite.prepare('SELECT password_changed_at FROM auth_users WHERE username_key=?').get('verifikator_irban').password_changed_at;
for(let i=0;i<6;i++)sqlite.prepare('INSERT INTO login_attempts(ip,action,timestamp) VALUES(?,?,?)').run('127.0.0.1',action,resetAt-1);
assert.equal((await login(1,newPassword)).res.status,200);
sqlite.exec("UPDATE auth_users SET password_changed_at=password_changed_at-1000 WHERE username_key='verifikator_irban'");
for(let i=0;i<5;i++)assert.equal((await login(1,'wrong-again')).res.status,401);
assert.equal((await login(1,newPassword)).res.status,429,'fresh failures must still trigger protection');
const before=sqlite.prepare('SELECT password_hash FROM auth_users WHERE username_key=?').get('verifikator_irban').password_hash;
// Simulate failure mid-batch: password/session/lockout must all roll back.
sqlite.exec("CREATE TRIGGER fail_reset_delete BEFORE DELETE ON login_attempts BEGIN SELECT RAISE(ABORT,'test rollback'); END");
assert.equal((await api('resetAuthUserPassword',{username:'verifikator_irban',password:'rollback-test-password-2026'},adminCookie)).body.status,'error');
assert.equal(sqlite.prepare('SELECT password_hash FROM auth_users WHERE username_key=?').get('verifikator_irban').password_hash,before);
sqlite.exec('DROP TRIGGER fail_reset_delete');
assert.equal((await api('resetAuthUserPassword',{username:'verifikator_irban',password:newPassword},adminCookie)).res.status,200);
sqlite.exec("UPDATE auth_users SET enabled=0 WHERE username_key='verifikator_irban'");
assert.equal((await login(1,newPassword)).res.status,401,'reset does not enable a disabled account');
await Promise.allSettled(background);
console.log('PASS: reset unlock, all IPs, account isolation, role authorization, session revocation, old password rejected, stale failures ignored, renewed lockout, atomic rollback, disabled account.');
