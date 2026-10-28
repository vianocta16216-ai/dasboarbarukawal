import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const frontend=fs.readFileSync(path.join(root,'public/script.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'functions/myCloudinaryHandler.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const checks=[];
const check=(name,condition)=>{assert.ok(condition,`FAIL: ${name}`);checks.push(name);};

check('Retry buttons exist in both Pemda dashboard and master admin modal',html.includes('id="pemdaPmTemplateRetry"')&&html.includes('id="kkPmMasterRetryAndSync"'));
check('retry state is persisted locally with year and master source',frontend.includes('KK_PM_BULK_RETRY_STORAGE_KEY')&&frontend.includes('localStorage.setItem(KK_PM_BULK_RETRY_STORAGE_KEY')&&frontend.includes('year:String(currentYear)')&&frontend.includes('masterId:normalizedRequested'));
check('Retry skips the Pemda workbook when its saved status says it already succeeded',frontend.includes('const needPemda=!retryOnly||Boolean(retryState.pendingPemda);'));
check('Retry only targets saved incomplete OPD IDs',frontend.includes('if(retryOnly&&!retryState.retryAll)')&&frontend.includes('allTargets.filter(target=>pendingSet.has(String(target.id)))'));
check('successful OPD targets are removed from pending list; errors remain',frontend.includes('if(!targetNeedsRetry)pendingSet.delete(id);else pendingSet.add(id);')&&frontend.includes('pendingSet.add(id);\n          failedOpd.push'));
check('future/unprocessed OPD targets remain pending after each batch',frontend.includes('const futureIds=targets.slice(offset+pool).map(target=>String(target.id))')&&frontend.includes('futureIds.forEach(id=>pendingSet.add(id))'));
check('quota 429 stops further batches while preserving retry status',frontend.includes('if(encounteredQuotaLimit)break;')&&frontend.includes('status tersimpan')&&frontend.includes('Tunggu hingga kuota pulih lalu tekan Retry'));
check('Retry refuses to silently switch to another master ID',frontend.includes('ID master berbeda dari proses tertunda')&&frontend.includes('retryState.masterId&&kkPmNormalizeSpreadsheetId(retryState.masterId)!==activeMasterId'));
check('Pemda and OPD retries pass resumeIfCurrentMaster to avoid duplicate copies',frontend.includes('resumeIfCurrentMaster:true')&&backend.includes('(!forceRefresh||Boolean(params.resumeIfCurrentMaster))'));
check('backend build version and frontend cache-buster are aligned',backend.includes("KAWAL_PM_MASTER_BUILD_VERSION='20261028-sheets-quota-resumable-retry-v8'")&&html.includes('script.js?v=20261028-sheets-quota-resumable-retry-v8'));
check('Retry buttons are restricted to admin/irban and disabled while a job is running',frontend.includes("const allowed=['admin','irban'].includes(role)")&&frontend.includes('!kkPmBulkRefreshRunning'));

// Execute only the retry state helpers against a lightweight DOM/localStorage mock.
const helperStart=frontend.indexOf("const KK_PM_BULK_RETRY_STORAGE_KEY=");
const helperEnd=frontend.indexOf('\nfunction kkPmMasterUpdateStatus',helperStart);
assert.ok(helperStart>=0&&helperEnd>helperStart,'retry state helpers must exist');
const storage=new Map();
const buttons=new Map([
  ['pemdaPmTemplateRetry',{disabled:true,textContent:''}],
  ['kkPmMasterRetryAndSync',{disabled:true,textContent:''}],
]);
const sandbox={
  console,Date,JSON,Map,Set,
  currentYear:2026,
  currentUser:{role:'admin'},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  document:{getElementById:id=>buttons.get(id)||null},
};
vm.runInNewContext(`${frontend.slice(helperStart,helperEnd)}\nglobalThis.__retryApi={write:kkPmWriteBulkRetryState,read:kkPmReadBulkRetryState,pending:kkPmBulkRetryStatePending,count:kkPmBulkRetryPendingCount,normalize:kkPmNormalizeSpreadsheetId};`,sandbox);
const api=sandbox.__retryApi;
api.write({year:'2026',masterId:'AbCdEfghijklmnopqrstuvwxyz_123456789',retryAll:false,pendingPemda:true,pendingIds:['opd-1','opd-2']});
assert.equal(api.pending(),true,'saved state should be pending');
assert.equal(api.count(),3,'pending count includes Pemda plus two OPDs');
assert.equal(buttons.get('pemdaPmTemplateRetry').disabled,false,'retry button enabled for admin while work remains');
assert.match(buttons.get('kkPmMasterRetryAndSync').textContent,/3 tertunda/);
assert.equal(api.normalize('https://docs.google.com/spreadsheets/d/AbCdEfghijklmnopqrstuvwxyz_123456789/edit?gid=0'),'AbCdEfghijklmnopqrstuvwxyz_123456789');
sandbox.currentYear=2027;
assert.equal(api.pending(),false,'pending state from a different year is not reused');
api.write(null);
assert.equal(storage.has('kawal-spip-kkpm-bulk-retry-v1'),false,'clearing successful retry removes saved state');
checks.push('retry state helper round-trip, year isolation, ID normalization, and UI enable/disable behavior');
console.log(JSON.stringify({status:'PASS',checks:checks.length,verified:checks},null,2));
