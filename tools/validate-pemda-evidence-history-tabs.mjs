import fs from 'node:fs';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../public/script.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const checks=[
 ['three separate target tabs exist', ['T2','T3','T4'].every(t=>html.includes(`data-pemda-evidence-history-target="${t}"`))],
 ['history tabs display per-target count', html.includes('pemdaEvidenceHistoryTabs')&&html.includes('<span>0</span>')],
 ['only selected target renders in history', js.includes('files.filter(file=>file.targetCode===active)')],
 ['tab switching is wired to history target state', js.includes("addEventListener('click',e=>{const btn=e.target.closest('[data-pemda-evidence-history-target]')")&&js.includes('pemdaPmDash.evidenceHistoryTarget=target')],
 ['existing upload target remains separate', html.includes('id="pemdaEvidenceTarget"')&&js.includes("addEventListener('change',()=>renderPemdaPmEvidenceSelectors())")],
 ['verification, delete and retry actions preserved', ['data-pemda-evidence-verify','data-pemda-evidence-delete','data-pemda-evidence-retry'].every(x=>js.includes(x))],
 ['responsive target tabs styling exists', css.includes('.pemda-pm-evidence-history-tabs')&&css.includes('@media(max-width:600px){.pemda-pm-evidence-history-tabs')],
];
for (const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(checks.some(([,ok])=>!ok)) process.exit(1);
console.log(`PASS ${checks.length}/${checks.length} checks`);
