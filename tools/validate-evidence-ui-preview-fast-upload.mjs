import fs from 'node:fs';
const js=fs.readFileSync(new URL('../public/script.js',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../functions/myCloudinaryHandler.js',import.meta.url),'utf8');
const checks=[
  ['OPD can manage workbook evidence UI',js.includes("const canManageEvidence=['admin','auditor','ppupd','opd'].includes(role)")],
  ['Replacement shown only for returned evidence',js.includes("status==='dikembalikan'&&canManageEvidence")],
  ['Delete button uses manage permission',js.includes('${canManageEvidence?`<button type="button" class="wb-action-delete"')],
  ['XLSX local preview enabled',js.includes('window.XLSX.read(buffer,{type:\'array\',cellDates:true})')],
  ['PDF preview uses signed streaming URL',js.includes('Pratinjau streaming privat dari R2')],
  ['Workbook upload marks R2 ready before queue',api.includes('await markDriveBackupR2Ready(env,uploadId)')],
  ['Workbook upload sends queue message after R2',api.includes('await sendDriveBackupMessage(env,uploadId,0)')],
  ['Workbook upload returns pending until Drive is verified',api.includes("syncStatus:'retrying',uploadId,r2Key:filePath")],
  ['Queue completion broadcasts realtime',api.includes("action:'driveBackupCompleted'")]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)process.exitCode=1;}
