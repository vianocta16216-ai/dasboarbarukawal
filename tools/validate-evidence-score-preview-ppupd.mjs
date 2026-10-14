import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const backend=fs.readFileSync('functions/myCloudinaryHandler.js','utf8');
const ui=fs.readFileSync('public/script.js','utf8');
const html=fs.readFileSync('public/index.html','utf8');

// Execute the actual score-calculation function with a small two-parameter master.
const start=backend.indexOf('const VERIFIED_STRUCTURE_STATUSES = new Set');
const end=backend.indexOf('function structureEvidenceFingerprint',start);
assert(start>=0&&end>start,'score function source must be found');
const scoreSource=backend.slice(start,end)+ '\nglobalThis.scoreFn=calculateVerifiedStructureProcessBreakdown;';
const sandbox={
  SUBUNSUR_DATA:{'1.1':{params:[{id:'P1'},{id:'P2'}]}},
  countTotalParameters(){return 2;},
  normalizeVerificationStatus(v){const s=String(v||'').trim().toLowerCase().replace(/[\\s-]+/g,'_');return ({accepted:'diterima',returned:'dikembalikan',diterima_dengan_catatan:'diterima_catatan'})[s]||(['diterima','diterima_catatan','dikembalikan'].includes(s)?s:'');},
  normalizeVerificationRecord(raw){const v=raw&&typeof raw==='object'?raw:{};return {status:v.status||v.verificationStatus||v.verification_status||'',updatedAt:v.updatedAt||v.updated_at||null,verifiedAt:v.verifiedAt||v.verificationAt||v.verification_at||null};}
};
vm.runInNewContext(scoreSource,sandbox);
const score=sandbox.scoreFn;
const oldAcceptedTime=Date.parse('2026-10-15T01:00:00Z');
const laterReturnTime=Date.parse('2026-10-15T01:05:00Z');
let result=score({'1.1':{P1:{files2:[{uploadId:'u1',verification:{status:'diterima',updatedAt:'2026-10-15T01:00:00Z'}}]},P2:{files4:[{uploadId:'u2',verification:{status:'dikembalikan',updatedAt:'2026-10-15T01:02:00Z'}}]}}},[
  {upload_id:'u1',subunsur:'1.1',param_id:'P1',level:2,verification_status:'dikembalikan',verification_at:laterReturnTime,updated_at:laterReturnTime},
  {upload_id:'u2',subunsur:'1.1',param_id:'P2',level:4,verification_status:'diterima',verification_at:oldAcceptedTime,updated_at:laterReturnTime+100000}
]);
assert.equal(result.value,0,'a later returned decision must erase an older accepted score, regardless of later housekeeping updated_at');
assert.equal(result.verifiedParams,0);

result=score({'1.1':{P1:{files2:[{uploadId:'u1',verification:{status:'diterima',updatedAt:'2026-10-15T01:00:00Z'}}]},P2:{files4:[{uploadId:'u2',verification:{status:'diterima_catatan',updatedAt:'2026-10-15T01:00:00Z'}}]}}},[
  {upload_id:'u1',subunsur:'1.1',param_id:'P1',level:3,verification_status:'diterima_catatan',verification_at:laterReturnTime,updated_at:laterReturnTime+1},
  {upload_id:'u2',subunsur:'1.1',param_id:'P2',level:4,verification_status:'diterima',verification_at:laterReturnTime,updated_at:laterReturnTime+1}
]);
assert.equal(result.value,3.5,'score uses the highest accepted level per parameter and master denominator');
assert.equal(result.verifiedParams,2);
assert.equal(result.byLevel[3],1);
assert.equal(result.byLevel[4],1);

// API response/UI parity and concurrency safety checks.
assert.match(backend,/const verifiedStructureBreakdown=calculateVerifiedStructureProcessBreakdown\(subunsurs,verifiedEvidenceMap\.get\(String\(r\.id\)\)\|\|\[\]\)/,'getData must compute the score from verified evidence rows');
assert.match(backend,/nilaiStrukturProses:verifiedStructureBreakdown\.value,sa:verifiedStructureBreakdown\.value,strukturProsesStatus:strukturStatus,structureProcessBreakdown:verifiedStructureBreakdown/,'API must publish the verified-only score as authoritative');
assert.match(backend,/AND TRIM\(COALESCE\(r2_key,''\)\)<>'' AND TRIM\(COALESCE\(file_name,''\)\)<>''/,'score must exclude evidence rows whose underlying file is not actually stored');
assert.match(backend,/const PPUPD_ALLOWED_ACTIONS = new Set\(AUDITOR_ALLOWED_ACTIONS\)/,'PPUPD must mirror Auditor action permissions');
assert.match(backend,/role==='auditor'\|\|role==='ppupd'/,'server role authorization must explicitly include Auditor and PPUPD');
assert.match(backend,/saveWorkbookEvidenceVerification/,'server must retain workbook-verification API');
assert.match(ui,/const canDirectVerify=\['admin','auditor','ppupd','irban'\]/,'the workbook UI must display verification controls for Auditor, PPUPD and Irban');
assert.match(ui,/source==='verified_evidence_only'/,'client must prefer server-verified score and not selected input levels');
assert.match(ui,/Microsoft Office Online Viewer/,'Office document preview integration must be present');
assert.match(ui,/Google Docs Viewer/,'OpenDocument preview integration must be present');
assert.match(ui,/Pratinjau PDF lokal di browser/,'PDF preview must use browser rendering');
assert.match(ui,/URL\.revokeObjectURL/,'browser object URLs must be released when preview closes/replaces');
assert.match(backend,/const filePath=`kawal_spip\/\$\{year\}\/\$\{safeOpd\}\/Evidence Struktur dan Proses\/\$\{unsurFolder\}\/\$\{subFolder\}\/\$\{parameterFolder\}\/\$\{targetFolder\}\/\$\{levelFolder\}/,'evidence storage path must follow OPD/unsur/subunsur/parameter/target/level');
assert.match(html,/option value="ppupd">PPUPD/,'admin account form must allow the PPUPD role');
assert.match(backend,/COALESCE\(subunsurs,'\{\}'\)=\?/,'legacy data writes must be compare-and-swap protected against other operators');
console.log(JSON.stringify({status:'PASS',checks:17,scoringCases:2,notes:['stale accepted status does not override a newer return decision','highest accepted level drives per-parameter score','PPUPD/verifier access, preview, folder order and concurrency guards present']},null,2));
