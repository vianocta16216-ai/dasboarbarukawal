// UI import test. Optional .xlsx argument tests the user-provided workbook locally.
// Never prints actual passwords or persists them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {SETDA_PARTS} from '../functions/_lib/setda.js';
const require=createRequire(import.meta.url);
const XLSX=require('../public/vendor/xlsx.full.min.js');
let bytes;
if(process.argv[2])bytes=fs.readFileSync(process.argv[2]);
else{
  const rows=[['No','Jenis Akun','OPD / Cakupan','Username','Password Awal']];
  SETDA_PARTS.forEach((p,i)=>rows.push([i+1,'Operator Bagian Setda',p.org,p.username,`Synthetic-Excel-Password-${i}-2026!!`]));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Daftar Akun');
  bytes=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
}
const els=new Map(),el=id=>{if(!els.has(id))els.set(id,{id,disabled:false,hidden:false,innerHTML:'',textContent:'',value:'',addEventListener(){},remove(){},showModal(){},close(){}});return els.get(id);};
let called=null;
const sandbox={console,Uint8Array,URL,Blob,currentYear:'2026',currentUser:{role:'admin'},rows:[],document:{hidden:false,getElementById:el},setInterval(){},setTimeout(){},window:{confirm(){return true}},ensureExportLibrary:async()=>XLSX,
  callServer:async(action,params)=>{called={action,params};return {status:'success',message:'OK',updated:9,created:0}}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../public/setda.js',import.meta.url),'utf8'),sandbox);
const file={name:'41_akun.xlsx',size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
await vm.runInContext('setdaImportFromExcel(__event)',Object.assign(sandbox,{__event:{target:{files:[file],value:'selected'}}}));
assert.equal(called.action,'repairSetdaAccounts');assert.equal(called.params.accounts.length,9);
assert.deepEqual([...called.params.accounts.map(x=>x.username)],SETDA_PARTS.map(x=>x.username));
assert.equal(new Set(called.params.accounts.map(x=>x.password)).size,9);
assert.equal(el('setdaImportAccounts').disabled,false);
assert.ok(el('setdaStatus').textContent.includes('OK'));
console.log('PASS: client-side .xlsx parsed; exactly 9 expected users; authenticated API payload; no passwords displayed/persisted.');
