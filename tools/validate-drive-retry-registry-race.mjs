import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../functions/myCloudinaryHandler.js', import.meta.url), 'utf8');
const browser = fs.readFileSync(new URL('../public/script.js', import.meta.url), 'utf8');

function routeBlock(action, fallbackLength = 20000) {
  const start = source.indexOf(`case '${action}': {`);
  assert.notEqual(start, -1, `missing route ${action}`);
  const end = source.indexOf("\n      case '", start + 10);
  return source.slice(start, end > -1 ? end : start + fallbackLength);
}

assert.match(source, /FROM opd_workbook_evidence_items e JOIN opd_data o ON o.id=e.opd_id AND o.year=e.year WHERE e.upload_id=\? AND e.year=\? AND e.opd_id=\? LIMIT 1/);
assert.doesNotMatch(source, /FROM opd_workbook_evidence_items e JOIN opd_data o ON o.id=e.opd_id AND o.year=e.year WHERE upload_id=\? AND year=\? AND opd_id=\? LIMIT 1/);

assert.match(source, /INSERT OR IGNORE INTO evidence_upload_registry[\s\S]{0,600}claimMatches/);
assert.match(source, /INSERT OR IGNORE INTO evidence_upload_registry[\s\S]{0,1000}registryMatches/);
assert.match(source, /INSERT OR IGNORE INTO opd_workbook_evidence_items/);
assert.match(source, /INSERT OR IGNORE INTO pemda_workbook_evidence_items/);

assert.match(source, /ON CONFLICT\(upload_id\) DO UPDATE SET[\s\S]{0,1800}json_extract/);
assert.match(source, /Upload ID antrean sudah digunakan oleh file atau tujuan backup lain/);
assert.match(source, /async function queueDriveBackupInBackground\(env, ctx, job\)/);
assert.match(source, /export async function processDriveBackupQueueMessage\(env, uploadId, ctx = null\)/);
assert.match(source, /const completionGuard = patch\?\.syncStatus && patch\.syncStatus !== 'done'/);
assert.match(source, /const queueMessageSent = await sendDriveBackupMessage\(env, job\.uploadId, 5\)/);
assert.match(source, /notifyRealtime\(env,ctx,job\.year,\{action:'driveBackupCompleted',driveBackupType:job\.type/);
assert.match(browser, /msg\.action === 'driveBackupCompleted' \|\| msg\.action === 'driveBackupQueued'/);
assert.match(browser, /loadPemdaPmEvidenceFiles\(\)\.catch/);
assert.match(browser, /loadLheFollowups\(\)\.catch/);

for (const action of ['uploadLheEvidence','uploadPemdaWorkbookEvidence','uploadRtpEvidence','uploadReportFile']) {
  const block = routeBlock(action);
  assert.match(block, /enqueueDriveBackupJob/);
  assert.match(block, /queueDriveBackupInBackground\(env,ctx,/);
  assert.doesNotMatch(block, /runQueuedDriveBackup\(env,ctx,/);
}
const uploadFileBlock = routeBlock('uploadFile', 30000);
assert.match(uploadFileBlock, /enqueueDriveBackupJob/);
assert.match(uploadFileBlock, /queueDriveBackupInBackground\(env,ctx,/);
assert.match(uploadFileBlock, /sendDriveBackupMessage\(env,uploadId,0\)/); // workbook variant is already queue-first
const retryBlock = routeBlock('retryDriveBackup', 20000);
assert.ok(retryBlock.includes('e.upload_id=? AND e.year=? AND e.opd_id=?'));
assert.ok(retryBlock.includes("job.type==='pemda_workbook_evidence'"));
assert.ok(retryBlock.includes("UPDATE pemda_workbook_evidence_items SET sync_status='retrying'"));
for (const subtype of ["type==='lhe'", "type==='rtp'", "type==='report'", "type==='workbook_evidence'", "type==='pemda_workbook_evidence'"]) {
  assert.ok(retryBlock.includes(subtype));
}
assert.match(retryBlock, /queueDriveBackupInBackground\(env,ctx,job\)/);
assert.doesNotMatch(retryBlock, /runQueuedDriveBackup\(env,ctx,/);

for (const action of ['replaceWorkbookEvidenceFile','replaceEvidenceFile','replaceRtpEvidence']) {
  const block = routeBlock(action, 12000);
  assert.match(block, /updateGoogleDriveFileContent|runQueuedDriveBackup/);
}

// A completed upload can be replayed after the HTTP response was lost.
// Re-check the stable uploadId and refresh metadata instead of false failure.
const runQueuedStart = source.indexOf('async function runQueuedDriveBackup');
const runQueuedEnd = source.indexOf('// Queue consumer:', runQueuedStart);
const runQueuedBlock = source.slice(runQueuedStart, runQueuedEnd);
assert.match(runQueuedBlock, /row\?\.status==='done'/);
assert.match(runQueuedBlock, /processDriveBackupJob\(env,job\)/);
assert.match(runQueuedBlock, /finishDriveBackupJob\(env,job\.uploadId\)/);

// Pending Pemda response returns R2 key so browser recovery does Drive-only retry.
const pemdaUploadBlock = routeBlock('uploadPemdaWorkbookEvidence');
assert.ok(pemdaUploadBlock.includes("r2Key,syncStatus:'retrying',r2Saved:true"));
assert.ok(pemdaUploadBlock.includes("r2Key,gdriveId,syncStatus:'done'"));

// UI must report "done" only when both status and gdriveId are confirmed.
assert.match(browser, /result\?\.syncStatus==='done'&&result\?\.gdriveId/);
assert.match(browser, /d\.syncStatus==='done'&&d\.gdriveId/);
assert.match(browser, /const driveDone=r\?\.syncStatus==='done'/);
assert.match(browser, /if\(r\?\.syncStatus==='done'&&r\?\.gdriveId\)/);
assert.match(browser, /autoRetryPendingDriveBackups/);
assert.match(browser, /retryIndexedDbUploads/);

// Queue Worker must be able to import its named handler from the Pages module.
assert.match(source, /export async function processDriveBackupQueueMessage\(env, uploadId, ctx = null\)/);

// The only synchronous backup calls left are the three replacement flows.
// Every new upload and manual retry must use the durable Queue-first path.
const syncCalls = [...source.matchAll(/runQueuedDriveBackup\(env,ctx,/g)];
assert.equal(syncCalls.length, 3, 'Unexpected synchronous Drive backup call outside replacement flow');
for (const action of ['replaceWorkbookEvidenceFile','replaceEvidenceFile','replaceRtpEvidence']) {
  const block = routeBlock(action, 12000);
  assert.match(block, /runQueuedDriveBackup\(env,ctx,/);
}
assert.match(source, /const completionGuard = patch\?\.syncStatus && patch\.syncStatus !== 'done'/);

console.log('PASS: Drive retry SQL, duplicate upload race, background Queue upload paths, retry UI status, and replacement sync guards');
