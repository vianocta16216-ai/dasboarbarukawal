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
  {upload_id:'u1',subunsur:'1.1',param_id:'P1',level:2,verification_status:'dikembalikan',verification_at:laterReturnTime,updated_at:laterReturnTime,r2_key:'r2/u1',file_name:'u1.pdf'},
  {upload_id:'u2',subunsur:'1.1',param_id:'P2',level:4,verification_status:'diterima',verification_at:oldAcceptedTime,updated_at:laterReturnTime+100000,r2_key:'r2/u2',file_name:'u2.pdf'}
]);
assert.equal(result.value,0,'a later returned decision must erase an older accepted score, regardless of later housekeeping updated_at');
assert.equal(result.verifiedParams,0);

result=score({'1.1':{P1:{files2:[{uploadId:'u1',verification:{status:'diterima',updatedAt:'2026-10-15T01:00:00Z'}}]},P2:{files4:[{uploadId:'u2',verification:{status:'diterima_catatan',updatedAt:'2026-10-15T01:00:00Z'}}]}}},[
  {upload_id:'u1',subunsur:'1.1',param_id:'P1',level:3,verification_status:'diterima_catatan',verification_at:laterReturnTime,updated_at:laterReturnTime+1,r2_key:'r2/u1',file_name:'u1.pdf'},
  {upload_id:'u2',subunsur:'1.1',param_id:'P2',level:4,verification_status:'diterima',verification_at:laterReturnTime,updated_at:laterReturnTime+1,r2_key:'r2/u2',file_name:'u2.pdf'}
]);
assert.equal(result.value,3.5,'score uses the highest accepted level per parameter and master denominator');
assert.equal(result.verifiedParams,2);
assert.equal(result.byLevel[3],1);
assert.equal(result.byLevel[4],1);

// Deleting the final workbook file must not re-enable stale accepted legacy JSON,
// whether the stale file had an upload ID or was an older ID-less entry.
result=score({'1.1':{P1:{files2:[
  {fileName:'stale-idless.pdf',verification:{status:'diterima',updatedAt:'2026-10-15T01:00:00Z'}},
  {uploadId:'old-u',fileName:'stale-id.pdf',verification:{status:'diterima',updatedAt:'2026-10-15T01:01:00Z'}}
]}}},[
  {upload_id:'deleted-u',subunsur:'1.1',param_id:'P1',level:2,verification_status:'',verification_at:null,updated_at:laterReturnTime,r2_key:'',file_name:'deleted.pdf'}
]);
assert.equal(result.value,0,'a tombstone must keep the parameter reset instead of reviving old accepted JSON');
assert.equal(result.verifiedParams,0);

// Legacy-only accepted files are compatibility data, never an authoritative score source.
result=score({'1.1':{P1:{files2:[{uploadId:'legacy-only',verification:{status:'diterima',updatedAt:'2026-10-15T01:00:00Z'}}]}}},[]);
assert.equal(result.value,0,'legacy-only accepted files must not restore old score when the current evidence table has no active item');
assert.equal(result.verifiedParams,0);

// A stale legacy file with a different upload ID must not keep a parameter scored
// when its current workbook evidence has been returned.
result=score({'1.1':{P1:{files2:[{uploadId:'old-u',verification:{status:'diterima',updatedAt:'2026-10-15T04:00:00Z'}}]}}},[
  {upload_id:'current-u',subunsur:'1.1',param_id:'P1',level:2,verification_status:'dikembalikan',verification_at:laterReturnTime,updated_at:laterReturnTime,r2_key:'r2/current-u',file_name:'current-u.pdf'}
]);
assert.equal(result.value,0,'stale legacy files not present in current normalized evidence must not keep the score alive');

// API response/UI parity and concurrency safety checks.
assert.match(backend,/const verifiedStructureBreakdown=calculateVerifiedStructureProcessBreakdown\(subunsurs,structureEvidenceRows\)/,'getData must compute the score from verified evidence rows');
assert.match(backend,/scoreRefreshCandidates\.push\(/,'getData must persist stale score-column resets after computing from live evidence');
assert.match(backend,/structureEvidenceFingerprint\(structureEvidenceRows\)/,'persisted resets must compare the complete active-evidence fingerprint before writing');
assert.match(backend,/nilaiStrukturProses:verifiedStructureBreakdown\.value,sa:verifiedStructureBreakdown\.value,strukturProsesStatus:strukturStatus,structureProcessBreakdown:verifiedStructureBreakdown/,'API must publish the verified-only score as authoritative');
assert.match(backend,/!String\(file\?\.r2_key\|\|file\?\.r2Key\|\|''\)\.trim\(\)\|\|!String\(file\?\.file_name\|\|file\?\.fileName\|\|''\)\.trim\(\)/,'score must exclude workbook rows without a backing file');
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
console.log(JSON.stringify({status:'PASS',checks:19,scoringCases:5,notes:['newest decision applies to the same active upload','highest accepted level drives per-parameter score','deleted and legacy-only files cannot revive old scores','PPUPD/verifier access, preview, folder order and concurrency guards present']},null,2));
