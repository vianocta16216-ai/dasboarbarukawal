import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const master=JSON.parse(fs.readFileSync(path.join(root,'public/rpjmd-mahakam-ulu-2025-2029-master.json'),'utf8'));
assert.equal(master.objectives.length,4,'RPJMD harus memuat empat tujuan');
const goals=master.objectives.flatMap(o=>o.goals||[]);
assert.equal(goals.length,21,'Master RPJMD harus memuat 21 sasaran');
assert.equal(new Set(goals.map(g=>g.code)).size,goals.length,'Kode sasaran harus unik');
for(const g of goals){assert.ok(g.code && g.name,'Setiap sasaran harus punya kode/nama');assert.ok(Array.isArray(g.indicators),'Setiap sasaran harus punya array indikator');}
const script=fs.readFileSync(path.join(root,'public/script.js'),'utf8');
const handler=fs.readFileSync(path.join(root,'functions/myCloudinaryHandler.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
for(const wp of ['KKE 1.1 SASTRA','KKE 1.2 SASTRA OPD','KKE 2.1 SASPRO','KKE 2.2 SASKEG','KKE 2.3 SASSUBKEG','KK 5.1 A','KK 5.1 B','KK 5.1 C']){
 assert.ok(script.includes(`code:'${wp}'`),`UI missing workpaper ${wp}`);
 assert.ok(handler.includes(`'${wp}'`),`API allowlist missing workpaper ${wp}`);
}
for(const action of ['getKkRpjmdMappings','saveKkRpjmdMapping','verifyKkRpjmdMapping']) assert.ok(handler.includes(`case '${action}'`),`API case missing ${action}`);
assert.ok(html.includes('data-pm-tab="rpjmd"'),'UI tab missing');
assert.ok(handler.includes('opd_kk_rpjmd_mapping_audit'),'Audit table missing');
assert.ok(handler.includes("assessmentOrgProfile(orgRow.opd)!=='BP4D'"),'BP4D-only mapping rule missing');
console.log(JSON.stringify({status:'PASS',objectives:master.objectives.length,strategicGoals:goals.length,indicators:goals.reduce((n,g)=>n+g.indicators.length,0)+master.objectives.reduce((n,o)=>n+(o.objectiveIndicators||[]).length,0),workpapers:8,apiActions:3,checks:11},null,2));
