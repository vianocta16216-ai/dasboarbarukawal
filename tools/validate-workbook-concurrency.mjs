import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const handler = fs.readFileSync(path.join(root, 'functions/myCloudinaryHandler.js'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/script.js'), 'utf8');

const allowlist = (handler.match(/const OPD_INPUT_ACTIONS = new Set\(\[([\s\S]*?)\]\);/) || [])[1] || '';
for (const action of [
  'getQaApipData', 'getQaApipChecklistData', 'getBpkpOfficialScore', 'getKkPmDataDetailed',
  'getKkRpjmdMappings', 'getKkMasterSheetRows', 'getWorkbookEvidenceFiles', 'getEvidenceWorkflow',
  'syncKkComputedValues', 'createKkPmSheets', 'saveKkPmItem'
]) assert.ok(allowlist.includes(`'${action}'`), `OPD allowlist is missing ${action}`);
const irbanAllowed=(handler.match(/const IRBAN_ALLOWED_ACTIONS = new Set\(\[([\s\S]*?)\]\);/)||[])[1]||'';
for (const action of ['createKkPmSheets','syncKkComputedValues']) assert.ok(irbanAllowed.includes(`'${action}'`), `Inspektorat/Irban role is missing ${action}`);

const helperStart = handler.indexOf('async function ensureKkPmSpreadsheet(env,params){');
const helperEnd = handler.indexOf('async function getSpreadsheetMetadata(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'PM workbook helper not found');
const helper = handler.slice(helperStart, helperEnd);
assert.ok(helper.includes('GOOGLE_SHEETS_PM_TEMPLATE_ID'), 'PM template must use dedicated environment variable');
assert.ok(!helper.includes('env.GOOGLE_SHEETS_PM_TEMPLATE_ID||env.GOOGLE_SHEETS_TEMPLATE_ID'), 'PM workbook must not silently fall back to legacy PK template');
assert.ok(helper.includes("templateCheck.profile!=='PM_2026'"), 'PM template must be checked against PM_2026 profile');
assert.ok(helper.includes('checkFormulas:true'), 'PM master formulas must be validated before copying');
assert.ok(!helper.includes('deleteGoogleDriveFile'), 'Existing workbooks must not be deleted during recovery');

assert.ok(handler.includes('CREATE TABLE IF NOT EXISTS kk_pm_workbook_sync_locks'), 'Distributed workbook lock table missing');
assert.ok(handler.includes('WHERE kk_pm_workbook_sync_locks.lease_until<?'), 'Workbook lock must have atomic lease acquisition');
assert.ok(handler.includes("WHERE lock_key=? AND owner_token=?"), 'Workbook lock release must be owner-token scoped');
assert.ok(handler.includes("kk_pm_data=json_patch(CASE WHEN json_valid(kk_pm_data) THEN kk_pm_data ELSE '{}' END,json(?))"), 'Sparse PM cell saves must merge, not replace workbook metadata');
assert.ok(handler.includes('LIVE_KK_MASTER_ROWS_GENERATION'), 'Master cache generation guard missing');
assert.ok(handler.includes('if(LIVE_KK_MASTER_ROWS_PENDING.get(cacheKey)===job)'), 'Old in-flight master response must not clear the newer pending refresh');
assert.ok(handler.includes("code:'INVALID_MASTER_SYNC_SECRET'"), 'Unauthenticated Apps Script master webhook must be rejected');
assert.ok(handler.includes('!isTrustedMasterWebhook && !SAFE_PUBLIC_ACTIONS'), 'Only a valid secret-protected webhook may bypass a browser session');
assert.ok(handler.includes('json_extract(CASE WHEN json_valid('), 'Computed-value write must be conditional on the currently linked workbook');
assert.ok(handler.includes("code:'VERIFICATION_STAGE_CONFLICT'"), 'Concurrent downstream verification must reject stale stage state');
assert.ok(handler.includes('SELECT 1 FROM evidence_verification_steps WHERE year=? AND opd_id=? AND upload_id=? AND stage=? AND status=?'), 'Verification prerequisite must be checked atomically with the D1 write');
assert.ok(script.includes("callServerWithRetry('syncKkComputedValues'"), 'UI must continue using the computed values sync action');
assert.ok(script.includes('async function ensureKkPmMasterLoaded(forceRefresh=true)'), 'PM master loader must refresh live data on each modal open');
assert.ok(script.includes('ensureKkPmMasterLoaded(true)'), 'PM modal must explicitly request fresh master data');
assert.ok(script.includes("fetch('/kk-pm-exact-workbook-master.json?v=20261015.1',{cache:'no-store'})"), 'PM static snapshot must not be held by browser cache');
assert.ok(script.includes('snapshot lokal karena refresh master live gagal'), 'UI must show a warning instead of silently reporting stale master as live');

const sheetNamesText = (handler.match(/const KK_PM_2026_SHEET_NAMES = \[([\s\S]*?)\];/) || [])[1] || '';
assert.equal((sheetNamesText.match(/'[^']*'/g) || []).length, 26, 'PM_2026 profile must remain 26 sheets');

console.log(JSON.stringify({
  status: 'PASS',
  checks: 36,
  verified: [
    'scoped-account permissions for dashboard reads and formula synchronization',
    'Inspektorat/Irban is explicitly allowed to synchronize PM workbooks within its OPD scope',
    'dedicated PM template configuration (no silent legacy template fallback)',
    'PM_2026 26-sheet + formula validation',
    'distributed D1 lease for concurrent workbook creation',
    'atomic merge of sparse PM cells without losing workbook links or other cells',
    'cache generation protection against stale in-flight responses',
    'PM UI revalidates master source on each open and avoids stale browser-cached snapshot',
    'secret-protected Apps Script master webhook',
    'conditional score sync only from the workbook currently linked to the OPD/year'
  ]
}, null, 2));
