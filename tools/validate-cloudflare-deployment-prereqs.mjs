#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pages = read('wrangler.toml');
const worker = read('drive-backup-worker/wrangler.toml');
const handler = read('functions/myCloudinaryHandler.js');
const issues = [];

const queueMatch = pages.match(/^\s*queue\s*=\s*"([^"]+)"/m);
const producerMatch = pages.match(/^\s*binding\s*=\s*"DRIVE_BACKUP_QUEUE"/m);
const workerConsumer = worker.includes('[[queues.consumers]]');
const workerCron = /crons\s*=\s*\["\* \* \* \* \*"\]/.test(worker);
if (!queueMatch) issues.push('Pages Wrangler config tidak memiliki queue producer.');
if (!producerMatch) issues.push('Binding DRIVE_BACKUP_QUEUE tidak dikonfigurasi pada Pages.');
if (!workerConsumer) issues.push('Drive backup Worker belum dikonfigurasi sebagai Queue consumer.');
if (!workerCron) issues.push('Cron pemulihan D1 per menit tidak ditemukan.');
if (!handler.includes('DRIVE_BACKUP_QUEUE')) issues.push('Handler Pages tidak merujuk binding antrean backup.');
if (!handler.includes('drive_backup_jobs')) issues.push('D1 durable outbox tidak ditemukan dalam handler.');
if (handler.includes("stage,status,updatedAt:now")) issues.push('Duplicate key status di respons saveEvidenceWorkflowStep belum diperbaiki.');
if (handler.includes("goalCodes,status:'Menunggu Verifikasi',updatedAt:now")) issues.push('Duplicate key status di respons saveKkRpjmdMapping belum diperbaiki.');

const queue = queueMatch?.[1];
if (queue && !worker.includes(`queue = "${queue}"`)) {
  issues.push(`Nama queue Pages (${queue}) tidak cocok dengan Worker consumer.`);
}
if (issues.length) {
  console.error('DEPLOY PREFLIGHT FAILED');
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}
console.log('DEPLOY PREFLIGHT SOURCE CHECK PASS');
console.log(`Pages producer queue: ${queue}`);
console.log('Worker consumer + one-minute D1 recovery cron: configured');
console.log('IMPORTANT: This validates repository configuration only. Confirm the Queue exists in the target Cloudflare account before retrying Pages deployment.');
