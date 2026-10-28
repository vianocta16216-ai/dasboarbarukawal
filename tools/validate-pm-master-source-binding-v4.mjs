import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const backend=fs.readFileSync(path.join(root,'functions/myCloudinaryHandler.js'),'utf8');
const frontend=fs.readFileSync(path.join(root,'public/script.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const expected=[
 'FAQ','DAFTAR KK','NAMA OPD','CHECKLIST PK','KKLEAD_SPIP','KKLEAD I_PEMDA',
 'KKE 1.1 SASTRA PEMDA (BP4D)','KKE 1.2 SASTRA OPD','KKE 2.1 SASPRO OPD',
 'KKE 2.2 SASKEG OPD','KKE 2.3 SASSUBKEG OPD','KKLEAD II','KK3.1 OPD',
 'KK3.2 BPKAD AKUN','KK3.3 BPKAD ASET','KK3.4 (INSPEKTORAT)','KK 4 INSPEKTORAT',
 'KKLEAD III','KK 5.1 A RPJMD (BP4D)','KK 5.1 B  OPD','KK 5.1 C OPD','KK 5.2 OPD',
 'KK 6 INSPEKTORAT','KK 7 INSPEKTORAT','KK 8 INSPEKTORAT','Ref PCT','REF','INDIKATOR HASIL'
];
const start=backend.indexOf('function canonicalPmSheetKey(value){');
const end=backend.indexOf('async function readLiveKkMasterRows',start);
assert.ok(start>=0&&end>start,'PM sheet-validation helpers found');
const listMatch=backend.match(/const KK_PM_2026_SHEET_NAMES = (\[[^;]+\]);/);
const requiredMatch=backend.match(/const KK_PM_REQUIRED_SHEET_NAMES = (\[[^;]+\]);/);
assert.ok(listMatch&&requiredMatch,'backend master and required inventories exist');
const ctx={
 KK_PM_2026_SHEET_NAMES:vm.runInNewContext(listMatch[1]),
 KK_PM_REQUIRED_SHEET_NAMES:vm.runInNewContext(requiredMatch[1]),
 KK_FULL_TEMPLATE_SHEET_NAMES:['FAQ','DAFTAR KK','NAMA OPD','CHECKLIST PK','KKLEAD_SPIP','KKLEAD I','KKE 1.1 SASTRA','KKE 1.2 SASTRA OPD','KKE 2.1 SASPRO','KKE 2.2 SASKEG','KKE 2.3 SASSUBKEG','KKLEAD II','KK3.1','KK3.2','KK3.3','KK3.4','KK 4','KKLEAD III','KK 5.1 A','KK 5.1 B ','KK 5.1 C','KK 5.2','KK 6','KK 7','KK 8','Ref PCT','REF','INDIKATOR HASIL'],
 normalizeSheetTitle:t=>String(t||'').trim().replace(/\s+/g,' '),
 sheetTitleOf:s=>String(typeof s==='string'?s:(s?.properties?.title||s?.title||'')).trim().replace(/\s+/g,' ')
};
vm.createContext(ctx);
vm.runInContext(backend.slice(start,end)+';this.profile=getPmSheetProfile;this.diagnostics=pmSheetStructureDiagnostics;',ctx);
const diagnostics=ctx.diagnostics(expected.map(title=>({properties:{title}})));
assert.equal(diagnostics.valid,true,'exact 28 sheet names in user workbook are accepted');
assert.equal(diagnostics.actualCount,28,'all 28 names count in their source order');
assert.equal(diagnostics.currentInventoryValid,true,'updated inventory path, not old 26-sheet restriction, validates');
assert.equal(ctx.profile(expected.map(title=>({properties:{title}}))),'PM_2026','current workbook gets PM_2026 profile');
const plusOne=ctx.diagnostics([...expected,'FUTURE SHEET 2027'].map(title=>({properties:{title}})));
assert.equal(plusOne.valid,true,'future sheet additions are allowed and retained');
const missing=ctx.diagnostics(expected.slice(0,-1).map(title=>({properties:{title}})));
assert.notEqual(ctx.profile(expected.slice(0,-1).map(title=>({properties:{title}}))),'PM_2026','missing required current inventory does not silently pass');
const duplicate=ctx.diagnostics([...expected,'KK 6 INSPEKTORAT'].map(title=>({properties:{title}})));
assert.equal(duplicate.valid,false,'duplicate canonical PM tabs fail validation');
assert.ok(backend.includes("const KAWAL_PM_MASTER_BUILD_VERSION='20261028-sheets-quota-resumable-v7'"),'backend build ID is exposed');
assert.ok(backend.includes('masterSheets,sheetCount:masterSheets.length')&&backend.includes('masterValidationError'),'template config returns actual source sheet inventory and validation outcome');
assert.ok(backend.includes("resolveKkPmTemplateSpreadsheet(env,token,await getConfiguredKkPmTemplateId(env),{forceRefresh:params.forceRefresh===true"),'Muat Ulang can force a fresh active-template resolution');
assert.ok(frontend.includes("getKkPmTemplateConfig',{forceRefresh:Boolean(forceRefresh)")&&frontend.includes('masterSheets=Array.isArray(result.masterSheets)?result.masterSheets:[]'),'frontend reads source inventory from the configured master ID');
assert.ok(frontend.includes('forceRefresh:true,forceTemplateRefresh:true')&&frontend.includes('expectedTemplateSpreadsheetId:activeMasterId'),'Sinkronkan Master reads the active ID and pins the source ID into the request');
assert.ok(backend.includes('expectedTemplateId&&expectedTemplateId!==templateId')&&backend.includes('Sumber master berubah/berbeda'),'backend refuses to copy from an unexpected source ID');
assert.ok(frontend.includes("master.source!=='cloudflare-environment'")&&frontend.includes('!master.masterValidationOk'),'sync refuses old backend/non-validated master');
assert.ok(frontend.includes('expectedTemplateSpreadsheetId:config.spreadsheetId'),'bulk refresh pins the validated master ID for Pemda and OPD');
assert.ok(frontend.includes("loadPemdaPmDashboard(true,{forceMasterRefresh:true})"),'Muat Ulang forces re-reading the configured master');
assert.ok(html.includes('script.js?v=20261028-sheets-quota-resumable-v7'),'fresh frontend build URL prevents prior JS cache');
console.log(JSON.stringify({status:'PASS',checks:17,masterSheetCount:expected.length,verified:[
 'all 28 user workbook sheet names accepted in original order',
 'new sheet inventory is active and future additional tabs are accepted',
 'missing or duplicate required tabs are rejected',
 'master config endpoint returns actual tab inventory and validation diagnostic',
 'Muat Ulang forces active master ID revalidation',
 'Sinkronkan Master forces new copy from GOOGLE_SHEETS_PM_TEMPLATE_ID',
 'frontend cache URL and backend build version identify this release'
]},null,2));
