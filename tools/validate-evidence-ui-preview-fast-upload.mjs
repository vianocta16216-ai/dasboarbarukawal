import fs from 'node:fs';
const js=fs.readFileSync(new URL('../public/script.js',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../functions/myCloudinaryHandler.js',import.meta.url),'utf8');
const checks=[
  ['OPD can manage workbook evidence UI',js.includes("const canManageEvidence=['admin','auditor','ppupd','opd'].includes(role)")],
  ['Replacement shown only for returned evidence',js.includes("status==='dikembalikan'&&canManageEvidence")],
  ['Delete button uses manage permission',js.includes('${canManageEvidence?`<button type="button" class="wb-action-delete"')],
  ['XLSX local preview enabled',js.includes('window.XLSX.read(buffer,{type:\'array\',cellDates:true})')],
  ['PDF preview uses signed streaming URL',js.includes('Pratinjau streaming privat dari R2')],
  ['Queue-first helper verifies R2 before marking the durable job ready',api.includes('const r2Head=await env.EVIDENCE_BUCKET.head')&&api.includes('await markDriveBackupR2Ready(env,safeJob.uploadId)')],
  ['Queue-first helper dispatches the R2-ready job immediately',api.includes('sendDriveBackupMessage(env,safeJob.uploadId,0)')],
  ['Workbook upload returns a pending state until Drive is verified',/status:driveQueue\.done\?'success':'pending'[\s\S]*?r2Key:filePath,r2Saved:true/.test(api)],
  ['Queue completion broadcasts realtime',api.includes("action:'driveBackupCompleted'")]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)process.exitCode=1;}
