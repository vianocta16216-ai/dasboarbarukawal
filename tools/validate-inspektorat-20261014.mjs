import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const worker=fs.readFileSync(path.join(root,'functions/myCloudinaryHandler.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/script.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sync=fs.readFileSync(path.join(root,'tools/KawalSPIP_MasterSync.gs'),'utf8');

// OPD/Inspektorat-scoped accounts must be allowed to read the workpaper and QA data
// needed by the UI; the handler continues to validate the requested OPD scope.
const opdActions=(worker.match(/const OPD_INPUT_ACTIONS = new Set\(\[([\s\S]*?)\]\);/)||[])[1]||'';
for(const action of ['getQaApipData','getQaApipChecklistData','getWorkbookEvidenceFiles','getBpkpOfficialScore','getKkPmDataDetailed','getKkRpjmdMappings','saveKkRpjmdMapping','getKkMasterSheetRows','syncKkComputedValues','getEvidenceWorkflow']){
  assert.ok(opdActions.includes(`'${action}'`),`OPD allowlist missing ${action}`);
}
assert.ok(worker.includes('assertSessionCanAccessOpd(env, authSession, params.year || year, params.opdId)'), 'Per-OPD scope guard is missing');
assert.ok(worker.includes("'template_source_year'"), 'LHE original-template-year migration missing');
assert.ok(worker.includes('new Set([String(year),String(Number(year)-1)])'), 'LHE target years must be dynamic and current/previous');
assert.ok(worker.includes('LIVE_KK_MASTER_ROWS_GENERATION'), 'Master cache generation guard missing');
assert.ok(worker.includes('LIVE_KK_MASTER_ROWS_CACHE.delete(cacheKey)'), 'Master cache invalidation missing after sync');
assert.ok(worker.includes("new Set(['syncKkPmMasterNow'])"), 'Secret-protected service webhook must bypass browser-session requirement');
assert.ok(worker.includes('supplied!==configured'), 'Webhook secret comparison is missing');
assert.ok(worker.includes("'syncKkPmMasterNow'"), 'Webhook must remain an explicit API action');
assert.ok(app.includes("ensureKkPmMasterLoaded(true)"), 'Kertas Kerja must refresh the master when opened');
assert.ok(app.includes("{masterKind:kind,year:currentYear}"), 'Master refresh should pass selected year for OPD-wide propagation');
assert.ok(app.includes('function lheYearPair()'), 'Dynamic LHE year helper missing');
assert.ok(app.includes('lheTemplateTargetYear(t)'), 'Historical template year mapping missing');
// Exercise the actual pure year-mapping helpers with both current and future years.
const helperStart=app.indexOf('function lheYearPair()');
const helperEnd=app.indexOf('function lheRefreshSourceYearOptions(',helperStart);
assert.ok(helperStart>=0&&helperEnd>helperStart,'LHE year helpers are not in the expected region');
const helperCode=app.slice(helperStart,helperEnd);
const context={currentYear:'2026',lheUi:{templates:[{sourceYear:'2025'},{sourceYear:'2024'}]}};
vm.createContext(context);vm.runInContext(helperCode,context);
assert.equal(context.lheTemplateTargetYear({sourceYear:'2025'}),'2026');
assert.equal(context.lheTemplateTargetYear({sourceYear:'2024'}),'2025');
context.currentYear='2027';
assert.equal(context.lheTemplateTargetYear({sourceYear:'2025'}),'2027');
assert.equal(context.lheTemplateTargetYear({sourceYear:'2024'}),'2026');
assert.ok(!html.includes('2025 / 2024'), 'Stale hard-coded LHE label remains in HTML');
assert.ok(!html.includes('value="2026">LHE / Renaksi 2026'), 'Stale hard-coded LHE select remains in HTML');
assert.ok(sync.includes('String(new Date().getFullYear())'), 'Master webhook year must follow the current calendar year');
assert.ok(worker.includes('const calendarYear=String(new Date().getFullYear())'), 'Year list must add current calendar year automatically');
assert.ok(worker.includes('const yearValue = String(params.year || new Date().getFullYear())'), 'Workbook creation default year must be dynamic');
console.log(JSON.stringify({status:'PASS',checks:32,areas:['role access/scoping','QA APIP','KK PM sync/cache invalidation','dynamic LHE years','master webhook year']},null,2));
