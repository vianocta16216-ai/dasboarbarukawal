import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {getGoogleDriveConfigurationStatus} from '../functions/myCloudinaryHandler.js';
import worker from '../drive-backup-worker/index.js';
const required=['GOOGLE_DRIVE_CLIENT_ID','GOOGLE_DRIVE_CLIENT_SECRET','GOOGLE_DRIVE_REFRESH_TOKEN','GOOGLE_DRIVE_FOLDER_ID'];
const full=Object.fromEntries(required.map(k=>[k,'private-test-value-'+k]));
assert.equal(getGoogleDriveConfigurationStatus(full).configured,true);
for(const key of required){
  for(const value of [undefined,'','  ']){
    const status=getGoogleDriveConfigurationStatus({...full,[key]:value});
    assert.equal(status.configured,false);assert.deepEqual(status.missing,[key]);
    assert.ok(!JSON.stringify(status).includes('private-test-value'));
  }
}
const DB={prepare:()=>({first:async()=>({}),bind(){return this;}})};
for(const configured of [false,true]){
 const response=await worker.fetch(new Request('https://example.test/health'),{DB,EVIDENCE_BUCKET:{},DRIVE_BACKUP_QUEUE:{sendBatch(){}},REALTIME:{},...(configured?full:{})});
 assert.equal(response.status,configured?200:503);
 const data=await response.json();assert.equal(data.googleDriveConfigured,configured);
 assert.equal(data.googleDriveAuthenticationVerified,false);
 assert.deepEqual(data.missingGoogleDriveVariables,configured?[]:required);
 assert.ok(!JSON.stringify(data).includes('private-test-value'));
}
console.log('PASS runtime missing/blank/complete credentials and health; values not disclosed; no false OAuth verification');
const js=fs.readFileSync(new URL('../public/script.js',import.meta.url),'utf8');
const fragment=js.slice(js.indexOf('function renderPemdaPmEvidenceGuidance(){'),js.indexOf('function renderPemdaPmEvidenceSelectors(){'));
const master=JSON.parse(fs.readFileSync(new URL('../public/kk-pm-exact-workbook-master.json',import.meta.url),'utf8'));
const excel=JSON.parse(fs.readFileSync(new URL('../public/pemda-evidence-recommendations-2026.json',import.meta.url),'utf8'));
const panel={innerHTML:''};let parameter,target,grade;
const escapeHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const context=vm.createContext({document:{getElementById:id=>id==='pemdaEvidenceGuidance'?panel:{value:id==='pemdaEvidenceTarget'?target:grade}},pemdaPmCurrentParameter:()=>parameter,escapeHtml,PEMDA_PM_TARGET_LABELS:{T2:'T2',T3:'T3',T4:'T4'},pemdaEvidenceExcelSource:excel,pemdaExcelGradeEvidence:(t,p,g)=>excel.recommendations[t]?.[`${p?.subCode||''}|${p?.paramId||''}`]?.[g]||null});
vm.runInContext(fragment,context);let count=0;
for(const t of master.targets.filter(t=>['T2','T3','T4'].includes(t.code))){target=t.code;
 for(const p of t.parameters){parameter=p;for(const g of ['A','B','C','D','E']){grade=g;context.renderPemdaPmEvidenceGuidance();
  assert.ok(panel.innerHTML.includes('Penjelasan'));assert.ok(panel.innerHTML.includes('Evidence yang Disarankan'));
  if(p.grades[g].penjelasan)assert.ok(panel.innerHTML.includes(escapeHtml(p.grades[g].penjelasan)));
  const excelGrade=excel.recommendations[target]?.[`${p.subCode}|${p.paramId}`]?.[g];
  assert.ok(excelGrade?.lines?.length,`${target} ${p.paramId} ${g} has no source Excel L evidence`);
  for(const e of excelGrade.lines)assert.ok(panel.innerHTML.includes(escapeHtml(e)));
  assert.ok(panel.innerHTML.includes(`baris ${excelGrade.row}`));
  count++;
 }}
}
parameter={grades:{A:{kriteria:'<script>bad</script>',penjelasan:'<img onerror=bad>',evidenceDisarankan:['<b>bad</b>']}}};grade='A';context.renderPemdaPmEvidenceGuidance();assert.ok(!panel.innerHTML.includes('<script>'));assert.ok(panel.innerHTML.includes('&lt;script&gt;'));
parameter=null;context.renderPemdaPmEvidenceGuidance();assert.ok(panel.innerHTML.includes('belum tersedia'));
console.log(`PASS ${count} Pemda parameter/grade renderings, escaping and missing-master fallback`);
