import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../functions/myCloudinaryHandler.js', import.meta.url), 'utf8');
const start = source.indexOf('async function runD1WithRetry(');
const end = source.indexOf('\nasync function ensurePemdaWorkflowRecord', start);
assert.ok(start >= 0 && end > start, 'runD1WithRetry helper must exist');
const helperSource = source.slice(start, end);
const sandbox = { console, setTimeout, Math, Promise };
vm.runInNewContext(`${helperSource}\nglobalThis.__runD1WithRetry = runD1WithRetry;`, sandbox);
const runD1WithRetry = sandbox.__runD1WithRetry;

// Cloudflare D1 preferred form: callback returns a prepared statement.
{
  let called = 0;
  const result = await runD1WithRetry(() => ({
    run: async () => { called++; return { meta: { changes: 1 }, tag: 'statement' }; }
  }));
  assert.equal(called, 1);
  assert.equal(result.meta.changes, 1);
  assert.equal(result.tag, 'statement');
}

// Compatibility form that caused the production crash: callback already called .run()
// and returns its Promise. The helper must await it, not call .run() on the Promise.
{
  let called = 0;
  const result = await runD1WithRetry(() => {
    called++;
    return Promise.resolve({ meta: { changes: 1 }, tag: 'pre-run-promise' });
  });
  assert.equal(called, 1);
  assert.equal(result.meta.changes, 1);
  assert.equal(result.tag, 'pre-run-promise');
}

// Transient D1 contention is retried and uses a fresh statement on every attempt.
{
  let attempts = 0;
  const result = await runD1WithRetry(() => ({
    run: async () => {
      attempts++;
      if (attempts === 1) throw new Error('database is locked');
      return { meta: { changes: 1 }, tag: 'retry-success' };
    }
  }), { retries: 2, baseDelay: 0 });
  assert.equal(attempts, 2);
  assert.equal(result.tag, 'retry-success');
}

// Non-transient failures should not be retried.
{
  let attempts = 0;
  await assert.rejects(() => runD1WithRetry(() => ({
    run: async () => { attempts++; throw new Error('permission denied'); }
  }), { retries: 3, baseDelay: 0 }), /permission denied/);
  assert.equal(attempts, 1);
}

// Source-level regression guards for the exact action and all-OPD refresh route.
assert.match(source, /case 'updateKkPmTemplateConfig'/);
assert.match(source, /INSERT INTO kk_pm_template_config\(config_key,spreadsheet_id/);
assert.match(source, /case 'getKkPmWorkbookRefreshTargets'/);
assert.match(source, /SELECT id,opd FROM opd_data WHERE year=\? ORDER BY opd COLLATE NOCASE/);
assert.match(source, /const isAuthorizedPmBulkRefresh=action==='createKkPmSheets'/);
const ui = readFileSync(new URL('../public/script.js', import.meta.url), 'utf8');
assert.match(ui, /const pool=2/);
assert.match(ui, /getKkPmWorkbookRefreshTargets/);
assert.match(ui, /createKkPmSheets.*expectedTemplateSpreadsheetId/s);
assert.match(source, /20261028-sheets-quota-resumable-v7/);
assert.match(ui, /20261028-sheets-quota-resumable-v7/);

// No call site should pre-execute .run() inside runD1WithRetry's statement factory.
function matchingCloseParen(text, openIndex) {
  let depth = 0, state = 'code', escape = false;
  for (let i = openIndex; i < text.length; i++) {
    const c = text[i], next = text[i + 1] || '';
    if (state === 'code') {
      if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') state = 'template';
      else if (c === '/' && next === '/') { state = 'line'; i++; }
      else if (c === '/' && next === '*') { state = 'block'; i++; }
      else if (c === '(') depth++;
      else if (c === ')' && --depth === 0) return i;
    } else if (['single','double','template'].includes(state)) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if ((state === 'single' && c === "'") || (state === 'double' && c === '"') || (state === 'template' && c === '`')) state = 'code';
    } else if (state === 'line' && c === '\n') state = 'code';
    else if (state === 'block' && c === '*' && next === '/') { state = 'code'; i++; }
  }
  return -1;
}
let pos = 0;
while ((pos = source.indexOf('runD1WithRetry(', pos)) >= 0) {
  const open = pos + 'runD1WithRetry'.length;
  const close = matchingCloseParen(source, open);
  assert.ok(close > open, 'runD1WithRetry call must have balanced parentheses');
  assert.ok(!source.slice(open + 1, close).includes('.run()'), `nested .run() found in runD1WithRetry call near line ${source.slice(0, pos).split('\n').length}`);
  pos = close + 1;
}

console.log('PASS: D1 prepared statement path');
console.log('PASS: pre-executed Promise compatibility path (regression for makeStatement(...).run is not a function)');
console.log('PASS: retry after transient D1 lock');
console.log('PASS: non-transient error is not retried');
console.log('PASS: master config + all-OPD refresh source guards');
console.log('PASS: no nested .run() call sites remain inside runD1WithRetry');
