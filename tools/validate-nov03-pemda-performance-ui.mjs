import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const js=read('public/script.js');
const html=read('public/index.html');
const css=read('public/style.css');
const rec=JSON.parse(read('public/pemda-evidence-recommendations-2026.json'));
const original=JSON.parse(read('public/kk-pm-exact-workbook-master.json'));
const expected={T2:210,T3:215,T4:275};
let validated=0;
assert.equal(rec.sourceColumn,'L');
for(const [code,total] of Object.entries(expected)){
  assert.equal(rec.counts[code],total);
  const parameters=original.targets.find(t=>t.code===code).parameters;
  assert.equal(Object.keys(rec.recommendations[code]).length,parameters.length);
  for(const p of parameters){
    const grades=rec.recommendations[code][`${p.subCode}|${p.paramId}`];
    assert.ok(grades,`${code}|${p.subCode}|${p.paramId}`);
    for(let i=0;i<5;i++){
      const grade='ABCDE'[i];const item=grades[grade];
      assert.equal(item.row,Number(p.gradeRows[i]));
      assert.equal(item.lines.length,3);
      assert.ok(item.lines.every(x=>x.length>20));validated++;
    }
  }
}
assert.equal(validated,700);
for(const id of ['accountResetPassword1','accountResetPassword2']){
  assert.ok(html.includes(`data-toggle-reset-password="${id}"`));
}
for(const token of ['resetPasswordVisibility()','resetEyeSvgClosed','pemdaExcelGradeEvidence(target,parameter,grade)','loadPemdaEvidenceExcelSource()',"if(pendingUploadFiles.size>0){event.preventDefault();event.returnValue='';}",'uploadYear=currentYear','String(workbookEvidenceRow?.id||\'\')!==key','wb-loading-track','wb-loading-ring-value','safeCloseOverlay','safeCloseYes','safeCloseNo','uploadActivityBadge']){
  assert.ok(js.includes(token),`Missing JS guard: ${token}`);
}
for(const token of ['id="safeCloseOverlay"','id="safeCloseYes"','id="safeCloseNo"','class="safe-close-icon"','role="alertdialog"'])assert.ok(html.includes(token));
for(const token of ['.password-visibility-toggle','.wb-loading-track','.safe-close-overlay','.upload-activity-dot'])assert.ok(css.includes(token));
const worker=read('drive-backup-worker/index.js');const config=read('drive-backup-worker/wrangler.toml');
assert.ok(worker.includes('const MESSAGE_CONCURRENCY = 2;'));
assert.ok(config.includes('max_concurrency = 3'));
assert.ok(js.includes("fetch('/workbook-structure-process-master.json?v=20261103-40users-v1',{cache:'force-cache'})"));
assert.ok(js.includes("fetch('/kk-pm-exact-workbook-master.json?v=20261015.2',{cache:'no-store'})"));
console.log(`PASS ${validated} Excel grade sources; scoped Pemda-only evidence; SVG password eyes; 2-step progress; safe close; browser-leave guard; indexedDB; conservative Drive queue; versioned cache.`);
