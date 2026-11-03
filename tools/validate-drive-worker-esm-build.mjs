import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const modules = [
  'drive-backup-worker/index.js',
  'functions/myCloudinaryHandler.js',
];
let failed = false;
for (const rel of modules) {
  const file = path.join(root, rel);
  const source = fs.readFileSync(file, 'utf8');
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: source,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    failed = true;
    console.error(`FAIL ${rel}:\n${result.stderr || result.stdout}`);
  } else {
    console.log(`PASS ESM parse: ${rel}`);
  }
}

const workerEntry = fs.readFileSync(path.join(root, 'drive-backup-worker/index.js'), 'utf8');
const workerConfig = fs.readFileSync(path.join(root, 'drive-backup-worker/wrangler.toml'), 'utf8');
if (!workerEntry.includes("from '../functions/myCloudinaryHandler.js'")) {
  failed = true;
  console.error('FAIL Worker entry no longer imports the production handler path.');
} else {
  console.log('PASS Worker entry imports the production handler path.');
}
if (!/^main\s*=\s*["']index\.js["']\s*$/m.test(workerConfig)) {
  failed = true;
  console.error('FAIL Worker wrangler.toml main must point to index.js.');
} else {
  console.log('PASS Worker wrangler.toml entrypoint is index.js.');
}

if (failed) process.exit(1);
console.log('PASS Worker deployment ESM build preflight.');
