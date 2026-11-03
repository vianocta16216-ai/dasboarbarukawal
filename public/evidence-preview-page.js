/* Lightweight standalone preview: no dashboard data, polling, or upload initialization. */
const previewParams=new URLSearchParams(location.hash.slice(1));
const currentYear=previewParams.get('year')||String(new Date().getFullYear());
const previewInfo=Object.fromEntries(previewParams);
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
async function callServerWithRetry(action,params){
  const response=await fetch('/myCloudinaryHandler',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...params}),signal:AbortSignal.timeout(30000)});
  const result=await response.json();if(!response.ok||result.status==='error')throw new Error(result.message||'Akses file ditolak. Silakan login kembali di dashboard.');return result;
}
const previewLibraries=new Map();
function loadPreviewLibrary(url){
  if(!previewLibraries.has(url))previewLibraries.set(url,new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;const timer=setTimeout(()=>script.onerror(),20000);script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);previewLibraries.delete(url);script.remove();reject(new Error('Komponen pratinjau tidak dapat dimuat. Periksa koneksi, lalu coba lagi.'));};document.head.append(script);}));
  return previewLibraries.get(url);
}
let previewStarting=false;
async function startPreview(){
  if(previewStarting)return;previewStarting=true;
  try{
    if(!previewInfo.uploadId)throw new Error('Identitas file tidak lengkap. Buka pratinjau kembali dari dashboard.');
    const ext=(previewInfo.fileName||'').split('.').pop().toLowerCase();
    if(['xls','xlsx','csv','ods'].includes(ext))await loadPreviewLibrary('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    if(['docx','pptx','odt','odp','zip'].includes(ext))await loadPreviewLibrary('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    await renderEvidencePreview(previewInfo);
  }catch(error){evidencePreviewStatus(error.message,'error');}finally{previewStarting=false;}
}
const original=new URL(evidencePreviewPrivateUrl(previewInfo),location.origin);
original.searchParams.set('action',previewInfo.scope==='pemda'?'downloadPemdaEvidence':'downloadEvidence');
document.getElementById('previewOriginal').href=original.pathname+original.search;
document.getElementById('previewRetry').addEventListener('click',startPreview);
window.addEventListener('pagehide',evidencePreviewClean);
startPreview();
