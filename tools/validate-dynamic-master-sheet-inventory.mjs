import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const expected=[
 'FAQ','DAFTAR KK','NAMA OPD','CHECKLIST PK','KKLEAD_SPIP','KKLEAD I_PEMDA',
 'KKE 1.1 SASTRA PEMDA (BP4D)','KKE 1.2 SASTRA OPD','KKE 2.1 SASPRO OPD',
 'KKE 2.2 SASKEG OPD','KKE 2.3 SASSUBKEG OPD','KKLEAD II','KK3.1 OPD',
 'KK3.2 BPKAD AKUN','KK3.3 BPKAD ASET','KK3.4 (INSPEKTORAT)',
 'KK 4 INSPEKTORAT','KKLEAD III','KK 5.1 A RPJMD (BP4D)','KK 5.1 B  OPD',
 'KK 5.1 C OPD','KK 5.2 OPD','KK 6 INSPEKTORAT','KK 7 INSPEKTORAT',
 'KK 8 INSPEKTORAT','Ref PCT','REF','INDIKATOR HASIL'
];
const backend=fs.readFileSync(path.join(root,'functions/myCloudinaryHandler.js'),'utf8');
const frontend=fs.readFileSync(path.join(root,'public/script.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const results=[];function check(label,ok){assert.ok(ok,`FAIL: ${label}`);results.push(label);}
for(const file of ['public/kk-full-workbook-manifest.json','public/kk-pm-full-workbook-manifest.json']){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 check(`${file} has 28 sheets and the ordered titles from the uploaded workbook`,manifest.allSheetCount===28&&manifest.sheets.length===28&&manifest.sheets.map(s=>s.sheetName).join('\n')===expected.join('\n'));
}
const inventoryMatch=backend.match(/const KK_PM_2026_SHEET_NAMES = \[([^\n]+)\];/);
const backendNames=inventoryMatch?[...inventoryMatch[1].matchAll(/'((?:\\.|[^'])*)'/g)].map(m=>m[1]):[];
check('backend fallback inventory matches all 28 master tab names',backendNames.length===28&&backendNames.join('\n')===expected.join('\n'));
check('backend requires semantic core anchors while allowing extra sheets',backend.includes('const KK_PM_REQUIRED_SHEET_NAMES =')&&backend.includes('const valid=actual.length>=expectedKeys.length&&missing.length===0&&duplicateRequired.length===0;')&&backend.includes('Extra tabs are valid'));
check('frontend uses live workbook tab metadata rather than fixed 26-sheet assumptions',frontend.includes('const sheetCount=live.length;')&&frontend.includes('allSheetCount:countForManifest')&&!/26 sheet|26 tab|26\/26/i.test(frontend));
check('HTML uses cache-busted dynamic-master script build',html.includes('script.js?v=20261027-dynamic-master-sheets'));
console.log(JSON.stringify({status:'PASS',checks:results.length,verified:results},null,2));
