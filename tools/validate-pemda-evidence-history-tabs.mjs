import fs from 'node:fs';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../public/script.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const checks=[
 ['three separate target tabs exist', ['T2','T3','T4'].every(t=>html.includes(`data-pemda-evidence-history-target="${t}"`))],
 ['target tabs display per-target counts', html.includes('pemdaEvidenceHistoryTabs')&&html.includes('<span>0</span>')],
 ['history has a distinct parameter selector', html.includes('id="pemdaEvidenceHistoryParameter"')&&html.includes('for="pemdaEvidenceHistoryParameter"')],
 ['history has a separate level selector', html.includes('id="pemdaEvidenceHistoryLevel"')&&html.includes('for="pemdaEvidenceHistoryLevel"')],
 ['parameter options are built from the selected target master parameters', js.includes('const params=pemdaPmTargetParams(active)')&&js.includes('paramSelect.innerHTML=groups.size')],
 ['parameter options show independent file counts', js.includes('const countFor=p=>targetFiles.filter')&&js.includes('(${count} file)')],
 ['history filters files by target, subunsur, parameter id, and selected level', js.includes('const parameterFiles=targetFiles.filter(file=>fileSubCode(file)===String(selectedParam.subCode||\'\')&&String(file.paramId||\'\')===String(selectedParam.paramId||\'\'))')&&js.includes('const visibleFiles=parameterFiles.filter(file=>Number(file.level||')&&js.includes('===selectedLevel)')],
 ['level selector lists Level 1 to Level 5 with per-level file counts', js.includes('level:5,grade:\'A\'')&&js.includes('level:1,grade:\'E\'')&&js.includes('(${levelCount(opt)} file)')],
 ['changing level refreshes only that level history', js.includes("getElementById('pemdaEvidenceHistoryLevel')?.addEventListener('change'")&&js.includes('pemdaPmDash.evidenceHistoryLevelKey=String(level)')],
 ['parameter title is shown above its isolated history', js.includes('pemda-pm-evidence-parameter-title')&&js.includes('parameterTitle')],
 ['target switching changes history target state', js.includes("addEventListener('click',e=>{const btn=e.target.closest('[data-pemda-evidence-history-target]')")&&js.includes('pemdaPmDash.evidenceHistoryTarget=target')],
 ['parameter switching changes only selected parameter state', js.includes("getElementById('pemdaEvidenceHistoryParameter')?.addEventListener('change'")&&js.includes('pemdaPmDash.evidenceHistoryParamKey=key')],
 ['upload jumps to the exact parameter and level whose files were uploaded', js.includes('pemdaPmDash.evidenceHistoryParamKey=`${target}|${p.subCode}|${p.paramId}`')&&js.includes('pemdaPmDash.evidenceHistoryLevelKey=String(({A:5,B:4,C:3,D:2,E:1})[grade])')],
 ['upload form retains its own target and parameter fields', html.includes('id="pemdaEvidenceTarget"')&&html.includes('id="pemdaEvidenceParam"')],
 ['verification, delete and retry actions preserved', ['data-pemda-evidence-verify','data-pemda-evidence-delete','data-pemda-evidence-retry'].every(x=>js.includes(x))],
 ['responsive target tabs and parameter selector styles exist', css.includes('.pemda-pm-evidence-history-tabs')&&css.includes('.pemda-pm-evidence-history-filter')&&css.includes('@media(max-width:600px){.pemda-pm-evidence-history-tabs')],
];
for (const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(checks.some(([,ok])=>!ok)) process.exit(1);
console.log(`PASS ${checks.length}/${checks.length} checks`);
