// ===== PRATINJAU FILE PRIVAT; tanpa unduhan otomatis =====
// Setiap file QA APIP memakai viewer yang sama dengan Evidence Struktur & Proses.
const evidencePreviewUi={objectUrl:null,activeTab:'preview',fileName:'',fileType:'',size:0,viewerProvider:'',requestId:0,timer:null,controller:null,workbook:null,source:null};
function evidencePreviewContent(){return document.getElementById('evidencePreviewContent');}
function evidencePreviewDetails(){return document.getElementById('evidencePreviewDetails');}
function evidencePreviewClean(){
  evidencePreviewUi.requestId++;
  clearTimeout(evidencePreviewUi.timer);
  if(evidencePreviewUi.controller){evidencePreviewUi.controller.abort();evidencePreviewUi.controller=null;}
  if(evidencePreviewUi.objectUrl){URL.revokeObjectURL(evidencePreviewUi.objectUrl);evidencePreviewUi.objectUrl=null;}
  evidencePreviewUi.workbook=null;evidencePreviewUi.source=null;
  evidencePreviewContent()?.replaceChildren();evidencePreviewDetails()?.replaceChildren();
}
function closeEvidencePreview(){if(document.body.dataset.previewPage){window.close();return;}document.getElementById('evidencePreviewModal')?.classList.remove('active');evidencePreviewClean();}
function evidencePreviewSetTab(tab){
  evidencePreviewUi.activeTab=tab==='details'?'details':'preview';
  document.querySelectorAll('[data-preview-tab]').forEach(b=>{
    const selected=b.dataset.previewTab===evidencePreviewUi.activeTab;
    b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));
  });
  const preview=evidencePreviewContent(),details=evidencePreviewDetails();
  if(preview)preview.hidden=evidencePreviewUi.activeTab!=='preview';
  if(details){details.hidden=evidencePreviewUi.activeTab!=='details';if(!details.hidden){
    details.innerHTML=`<dl class="preview-file-details"><dt>Nama file</dt><dd>${escapeHtml(evidencePreviewUi.fileName)}</dd><dt>Jenis file</dt><dd>${escapeHtml(evidencePreviewUi.fileType||'Tidak diketahui')}</dd><dt>Ukuran file</dt><dd>${evidencePreviewUi.size?(evidencePreviewUi.size/1024).toLocaleString('id-ID',{maximumFractionDigits:1})+' KB':'Ukuran belum tersedia (streaming)'}</dd><dt>Jenis pratinjau</dt><dd>${escapeHtml(evidencePreviewUi.viewerProvider||'Lokal/privat')}</dd></dl>`;
  }}
}
function evidencePreviewStatus(message,kind=''){
  const body=evidencePreviewContent();if(!body)return;
  const el=document.createElement('div');el.className='preview-file-placeholder'+(kind==='error'?' is-error':'');
  const text=document.createElement('p');text.textContent=message;el.append(text);body.replaceChildren(el);
}
function evidencePreviewSheetTable(sheetName){
  const book=evidencePreviewUi.workbook;if(!book||!window.XLSX)return '';
  const sheet=book.Sheets[sheetName];if(!sheet)return '';
  const rows=window.XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:'',blankrows:false}).slice(0,180);
  const cols=Math.min(24,Math.max(1,...rows.map(r=>Array.isArray(r)?r.length:0)));
  const tabs=book.SheetNames.map((name,index)=>`<button type="button" class="preview-sheet-tab ${name===sheetName?'active':''}" data-preview-sheet-index="${index}" aria-pressed="${name===sheetName}">${escapeHtml(name)}</button>`).join('');
  const tableRows=rows.map((row,index)=>`<tr><th>${index+1}</th>${Array.from({length:cols},(_,col)=>`<td>${escapeHtml(String(row?.[col]??''))}</td>`).join('')}</tr>`).join('');
  return `<div class="evidence-preview-sheet-wrap"><div class="evidence-preview-sheet-meta"><b>Spreadsheet · ${escapeHtml(sheetName)}</b><span>${book.SheetNames.length} sheet · maksimal 180 baris dan 24 kolom per sheet</span></div><div class="preview-sheet-tabs" role="group" aria-label="Pilih sheet spreadsheet">${tabs}</div><div class="evidence-preview-sheet-scroll"><table class="evidence-preview-sheet"><tbody>${tableRows||'<tr><td>Sheet kosong</td></tr>'}</tbody></table></div></div>`;
}
function evidencePreviewExtractXmlText(xml,tagLocalNames,maxBlocks=250){
  if(xml.length>4_000_000)throw new Error('Isi dokumen terlalu besar untuk pratinjau teks cepat.');
  const parsed=new DOMParser().parseFromString(xml,'application/xml');
  if(parsed.getElementsByTagName('parsererror').length)throw new Error('Struktur dokumen tidak dapat dibaca.');
  const wanted=new Set(tagLocalNames);const blocks=[];
  const nodes=parsed.getElementsByTagName('*');
  for(const node of nodes){
    if(!wanted.has(node.localName))continue;
    const text=String(node.textContent||'').replace(/\s+/g,' ').trim();
    if(text){blocks.push(text.slice(0,2000));if(blocks.length>=maxBlocks)break;}
  }
  return blocks;
}
async function evidencePreviewOfficeLocal(buffer,ext,requestId){
  const body=evidencePreviewContent();
  if(evidencePreviewUi.requestId!==requestId)return true;
  if(['xls','xlsx','csv','ods'].includes(ext)&&window.XLSX){
    const book=window.XLSX.read(buffer,{type:'array',cellDates:true,sheetRows:181});
    if(!book.SheetNames?.length)throw new Error('Spreadsheet tidak memiliki sheet.');
    if(evidencePreviewUi.requestId!==requestId)return true;
    evidencePreviewUi.workbook=book;evidencePreviewUi.viewerProvider='Pratinjau spreadsheet lokal di browser';
    body.innerHTML=evidencePreviewSheetTable(book.SheetNames[0]);return true;
  }
  if(!['docx','pptx','odt','ods','odp'].includes(ext)||!window.JSZip)return false;
  const archive=await window.JSZip.loadAsync(buffer,{checkCRC32:false});
  const readPart=async name=>{
    const item=archive.file(name);if(!item)return '';
    if(Number(item._data?.uncompressedSize||0)>4_000_000)throw new Error('Dokumen terlalu besar untuk pratinjau teks.');
    const value=await item.async('string');if(value.length>4_000_000)throw new Error('Pratinjau teks dibatasi 4 MB.');return value;
  };
  let blocks=[],title='',subtitle='';
  if(ext==='docx'){
    const xml=await readPart('word/document.xml');if(!xml)throw new Error('Konten DOCX tidak ditemukan.');
    // w:p -> seluruh teks yang ada dalam satu paragraf; tidak mengeksekusi macro/HTML.
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    const paras=[...doc.getElementsByTagNameNS('*','p')].slice(0,350);
    for(const paragraph of paras){const words=[...paragraph.getElementsByTagNameNS('*','t')].map(n=>n.textContent).join('');if(words.trim())blocks.push(words.slice(0,2500));}
    title='Pratinjau Word (DOCX)';subtitle='Teks paragraf dokumen; tata letak dan gambar tidak dirender';
  }else if(ext==='pptx'){
    const slideNames=Object.keys(archive.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
    for(const [i,name] of slideNames.slice(0,70).entries()){
      const xml=await readPart(name);const doc=new DOMParser().parseFromString(xml,'application/xml');
      const texts=[...doc.getElementsByTagNameNS('*','t')].map(n=>String(n.textContent||'').trim()).filter(Boolean);
      if(texts.length)blocks.push(`Slide ${i+1}\n${texts.join('\n').slice(0,3500)}`);
    }
    title='Pratinjau PowerPoint (PPTX)';subtitle='Teks slide; gambar, animasi, dan layout asli tidak dirender';
  }else{
    const xml=await readPart('content.xml');if(!xml)throw new Error('Konten OpenDocument tidak ditemukan.');
    blocks=evidencePreviewExtractXmlText(xml,['p','h'],280);
    title='Pratinjau OpenDocument';subtitle='Teks dokumen; pemformatan kompleks tidak dirender';
  }
  if(evidencePreviewUi.requestId!==requestId)return true;
  const text=blocks.join('\n\n').slice(0,240000);
  body.innerHTML=`<div class="preview-local-office"><div class="preview-local-office-head"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span><button type="button" class="preview-external-button preview-external-small" data-preview-external="1">Tampilan dokumen lengkap (viewer pihak ketiga, perlu persetujuan)</button></div><pre class="evidence-preview-text">${escapeHtml(text||'Tidak ada teks yang dapat dipratinjau.')}</pre></div>`;
  evidencePreviewUi.viewerProvider='Pratinjau isi Office lokal tanpa layanan pihak ketiga';return true;
}
function evidencePreviewOfferExternal(ext){
  const body=evidencePreviewContent();
  if(!body)return;
  body.innerHTML=`<div class="preview-file-placeholder"><h4>Format .${escapeHtml(ext)} tidak bisa ditampilkan secara lengkap secara lokal</h4><p>File tidak diunduh otomatis. Untuk format Office lama atau tampilan asli, layanan Microsoft Office Online dapat diminta secara manual. Layanan ini akan mengakses salinan file melalui tautan sementara selama 10 menit.</p><button type="button" class="preview-external-button" data-preview-external="1">Buka pratinjau melalui Office Online (pihak ketiga)</button><small>Gunakan hanya apabila dokumen diizinkan diproses oleh layanan eksternal.</small></div>`;
  evidencePreviewUi.viewerProvider='Menunggu persetujuan untuk viewer Office Online';
}
async function evidencePreviewExternalOffice(){
  const info=evidencePreviewUi.source;
  if(!info||!document.getElementById('evidencePreviewModal')?.classList.contains('active'))return;
  if(info.scope==='pemda'){evidencePreviewStatus('Viewer eksternal tidak diaktifkan untuk evidence Pemda. Gunakan pratinjau lokal.','error');return;}
  if(!window.confirm('Pratinjau lengkap Office Online akan mengirimkan akses file melalui tautan sementara ke layanan Microsoft. Lanjutkan hanya jika dokumen boleh diproses oleh pihak ketiga.'))return;
  const current=evidencePreviewUi.requestId;const body=evidencePreviewContent();evidencePreviewStatus('Menyiapkan pratinjau Office Online...');
  try{
    const result=await callServerWithRetry('createEvidencePreviewLink',{opdId:info.opdId,uploadId:info.uploadId,year:info.year},1);
    if(evidencePreviewUi.requestId!==current)return;
    const ext=(evidencePreviewUi.fileName.split('.').pop()||'').toLowerCase();
    const openDoc=['odt','ods','odp','rtf'].includes(ext);
    const url=openDoc?`https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(result.url)}`:`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(result.url)}`;
    const frame=document.createElement('iframe');frame.className='evidence-preview-frame';frame.title='Pratinjau '+(openDoc?'Google Docs Viewer':'Microsoft Office Online Viewer')+' '+evidencePreviewUi.fileName;frame.referrerPolicy='no-referrer';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms');frame.src=url;
    const notice=document.createElement('p');notice.className='preview-external-notice';notice.textContent='Viewer pihak ketiga aktif. Tautan sementara kedaluwarsa otomatis; jika gagal, kembali ke pratinjau lokal atau tutup.';
    body.replaceChildren(notice,frame);evidencePreviewUi.viewerProvider=openDoc?'Google Docs Viewer (berdasarkan persetujuan pengguna)':'Microsoft Office Online Viewer (berdasarkan persetujuan pengguna)';
  }catch(error){if(evidencePreviewUi.requestId===current)evidencePreviewStatus('Viewer Office Online tidak tersedia: '+(error.message||error),'error');}
}
const EVIDENCE_PREVIEW_LOCAL_LIMIT=22*1024*1024;
function evidencePreviewPrivateUrl(info){
  const qs=new URLSearchParams({action:info.scope==='pemda'?'previewPemdaEvidence':'previewEvidence',year:String(info.year||currentYear),uploadId:String(info.uploadId||'')});
  if(info.scope!=='pemda')qs.set('opdId',String(info.opdId||''));
  return '/myCloudinaryHandler?'+qs.toString();
}
function evidencePreviewLoading(message='Menyiapkan pratinjau privat…',percent=null){
  const body=evidencePreviewContent();if(!body)return;
  body.innerHTML=`<div class="preview-loading" role="status" aria-live="polite"><svg class="preview-loading-svg" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle class="preview-ring-track" cx="24" cy="24" r="19"/><circle class="preview-ring-progress" cx="24" cy="24" r="19"/></svg><strong>${escapeHtml(message)}</strong><span>File tetap dibuka dalam aplikasi, tanpa mengunduh otomatis.</span><div class="preview-loading-progress"><i style="width:${percent===null?24:Math.min(100,Math.max(0,percent))}%"></i></div>${percent===null?'':`<small>${Math.round(percent)}%</small>`}</div>`;
}
async function evidencePreviewReadLimited(response,controller,id){
  const length=Number(response.headers.get('Content-Length')||0);
  if(length>EVIDENCE_PREVIEW_LOCAL_LIMIT){await response.body?.cancel?.();throw new Error('File lebih dari 22 MB. Pratinjau Office/teks lokal dibatasi demi menjaga kecepatan aplikasi.');}
  if(!response.body?.getReader){const data=await response.arrayBuffer();if(data.byteLength>EVIDENCE_PREVIEW_LOCAL_LIMIT)throw new Error('File terlalu besar untuk pratinjau lokal.');return data;}
  const reader=response.body.getReader(),chunks=[];let count=0,lastShown=-1;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;if(controller.signal.aborted||evidencePreviewUi.requestId!==id)throw new DOMException('Dibatalkan','AbortError');
      count+=value.byteLength;if(count>EVIDENCE_PREVIEW_LOCAL_LIMIT){await reader.cancel();throw new Error('Ukuran file melebihi batas 22 MB untuk pratinjau lokal.');}
      chunks.push(value);
      if(length){const percent=Math.min(95,Math.round(count*100/length));if(percent>=lastShown+8){lastShown=percent;evidencePreviewLoading('Membaca dokumen…',percent);}}
    }
  }finally{reader.releaseLock();}
  const result=new Uint8Array(count);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result.buffer;
}
function evidencePreviewStreamElement(url,ext,type,id){
  const body=evidencePreviewContent(),wrap=document.createElement('div');wrap.className='preview-stream-wrap';
  const loading=document.createElement('div');loading.className='preview-stream-loading';loading.innerHTML='<span class="preview-stream-spinner" aria-hidden="true"></span><span>Memuat tampilan file…</span>';wrap.appendChild(loading);
  const ready=()=>{clearTimeout(evidencePreviewUi.timer);if(evidencePreviewUi.requestId!==id)return;loading.remove();};
  const failed=()=>{clearTimeout(evidencePreviewUi.timer);if(evidencePreviewUi.requestId!==id)return;loading.textContent='Tampilan belum dapat dimuat. Coba lagi atau buka/unduh file asli melalui tombol di atas; codec media tertentu memerlukan aplikasi yang sesuai.';};
  evidencePreviewUi.timer=setTimeout(failed,20000);
  let element;
  if(ext==='pdf'||type==='application/pdf'){
    element=document.createElement('iframe');element.className='evidence-preview-frame';element.title='Pratinjau PDF '+evidencePreviewUi.fileName;element.referrerPolicy='no-referrer';element.src=url+'#toolbar=1&navpanes=1';element.addEventListener('load',ready,{once:true});element.addEventListener('error',failed,{once:true});
  }else if(type.startsWith('image/')||['jpg','jpeg','png','webp','gif','bmp','avif'].includes(ext)){
    element=document.createElement('img');element.className='evidence-preview-image';element.alt=evidencePreviewUi.fileName;element.loading='eager';element.decoding='async';wrap.classList.add('is-image');element.addEventListener('load',ready,{once:true});element.addEventListener('error',failed,{once:true});element.src=url;
  }else if(type.startsWith('video/')||['mp4','webm','mov','m4v','ogv','avi','mkv'].includes(ext)){
    element=document.createElement('video');element.className='evidence-preview-media';element.controls=true;element.playsInline=true;element.preload='metadata';element.addEventListener('loadedmetadata',ready,{once:true});element.addEventListener('error',failed,{once:true});element.src=url;
  }else{
    element=document.createElement('audio');element.className='evidence-preview-audio';element.controls=true;element.preload='metadata';element.addEventListener('loadedmetadata',ready,{once:true});element.addEventListener('error',failed,{once:true});element.src=url;
  }
  wrap.append(element);body.replaceChildren(wrap);
}
async function renderEvidencePreview(info){
  const modal=document.getElementById('evidencePreviewModal'),body=evidencePreviewContent();if(!modal||!body)return;
  evidencePreviewClean();const id=evidencePreviewUi.requestId;
  const controller=new AbortController();evidencePreviewUi.controller=controller;
  const timeout=setTimeout(()=>controller.abort(new Error('Waktu pemuatan habis. Klik Coba lagi.')),45000);
  const source={opdId:String(info.opdId||''),uploadId:String(info.uploadId||''),year:info.year||currentYear,scope:info.scope==='pemda'?'pemda':'opd'};
  evidencePreviewUi.source=source;evidencePreviewUi.fileName=String(info.fileName||'Evidence');evidencePreviewUi.fileType=String(info.fileType||'application/octet-stream');evidencePreviewUi.viewerProvider='Pratinjau privat Cloudflare R2';evidencePreviewUi.size=0;
  document.getElementById('evidencePreviewTitle').textContent='Pratinjau File · '+evidencePreviewUi.fileName;
  modal.classList.add('active');evidencePreviewSetTab('preview');evidencePreviewLoading();
  const stale=()=>evidencePreviewUi.requestId!==id||controller.signal.aborted;
  const ext=(evidencePreviewUi.fileName.split('.').pop()||'').toLowerCase(),type=evidencePreviewUi.fileType.toLowerCase();
  const url=evidencePreviewPrivateUrl(source);
  try{
    const streaming=['pdf','jpg','jpeg','png','webp','gif','bmp','avif','mp4','webm','mov','m4v','ogv','avi','mkv','mp3','wav','ogg','m4a','aac'];
    if(streaming.includes(ext)||type==='application/pdf'||(type.startsWith('image/')&&type!=='image/svg+xml')||type.startsWith('video/')||type.startsWith('audio/')){
      // The browser requests only required bytes (Range for PDF/media); sessions remain private.
      if(stale())return;evidencePreviewStreamElement(url,ext,type,id);
      evidencePreviewUi.viewerProvider='Pratinjau streaming privat dari R2 (sesi akun, tanpa tautan publik)';
      return;
    }
    // The binary legacy Word/PowerPoint formats have no safe built-in local renderer.
    // Offer external conversion ONLY after explicit consent, never automatically.
    if(['doc','ppt'].includes(ext)){
      if(source.scope==='pemda'){
        body.innerHTML='<div class="preview-file-placeholder"><h4>Format Office lama</h4><p>Dokumen tidak dapat dipratinjau lengkap secara lokal. Pratinjau pihak ketiga dinonaktifkan untuk evidence Pemda.</p></div>';
      }else evidencePreviewOfferExternal(ext);
      return;
    }
    const local=['zip','xls','xlsx','csv','docx','pptx','odt','ods','odp','txt','json','xml','log','md','html','htm','svg','yaml','yml','ini','rtf','css','js','ts','sql'];
    if(!local.includes(ext)&&!type.startsWith('text/')){
      // Unknown archives/binaries: do not transfer megabytes merely to tell users a format is unsupported.
      const response=await fetch(url,{method:'HEAD',credentials:'same-origin',cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('File tidak tersedia atau akses ditolak (HTTP '+response.status+').');
      if(stale())return;
      evidencePreviewUi.size=Number(response.headers.get('Content-Length')||0);
      body.innerHTML=`<div class="preview-file-placeholder"><h4>Pratinjau ${escapeHtml(ext.toUpperCase()||'format biner')} belum didukung browser</h4><p>File berhasil ditemukan dan tetap aman di penyimpanan privat. Tidak ada pengunduhan otomatis.</p><small>${(evidencePreviewUi.size/1024).toLocaleString('id-ID',{maximumFractionDigits:1})} KB · ${escapeHtml(type)}</small></div>`;
      evidencePreviewUi.viewerProvider='Metadata file, tanpa mengambil isi';return;
    }
    const response=await fetch(url,{method:'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('Gagal membaca file privat (HTTP '+response.status+').');
    const buffer=await evidencePreviewReadLimited(response,controller,id);if(stale())return;
    evidencePreviewUi.size=buffer.byteLength;evidencePreviewLoading('Menyiapkan tampilan…',98);
    await new Promise(resolve=>requestAnimationFrame(resolve));if(stale())return;
    if(ext==='zip'&&window.JSZip){
      const archive=await window.JSZip.loadAsync(buffer);if(stale())return;
      const names=Object.keys(archive.files);const pre=document.createElement('pre');pre.className='evidence-preview-text';pre.textContent='Isi arsip ZIP ('+names.length+' entri; ditampilkan maksimal 500):\n\n'+names.slice(0,500).join('\n');body.replaceChildren(pre);return;
    }
    if(['xls','xlsx','csv','docx','pptx','odt','ods','odp'].includes(ext)){
      if(await evidencePreviewOfficeLocal(buffer,ext,id))return;
    }
    if(['txt','json','csv','xml','log','md','html','htm','svg','yaml','yml','ini','rtf','css','js','ts','sql'].includes(ext)||type.startsWith('text/')){
      const text=new TextDecoder('utf-8',{fatal:false}).decode(buffer.slice(0,2_000_000));const pre=document.createElement('pre');pre.className='evidence-preview-text';pre.textContent=text;body.replaceChildren(pre);evidencePreviewUi.viewerProvider='Pratinjau teks lokal, konten tidak dieksekusi';return;
    }
    evidencePreviewOfferExternal(ext);
  }catch(error){if(evidencePreviewUi.requestId!==id)return;evidencePreviewStatus('Pratinjau gagal: '+(controller.signal.reason?.message||error.message||error)+'. Gunakan Coba lagi atau Buka/unduh file asli.','error');}
  finally{clearTimeout(timeout);if(evidencePreviewUi.requestId===id)evidencePreviewUi.controller=null;}
}
document.getElementById('evidencePreviewClose')?.addEventListener('click',closeEvidencePreview);
document.getElementById('evidencePreviewCloseFooter')?.addEventListener('click',closeEvidencePreview);
document.querySelectorAll('[data-preview-tab]').forEach(button=>button.addEventListener('click',()=>evidencePreviewSetTab(button.dataset.previewTab)));
document.getElementById('evidencePreviewModal')?.addEventListener('click',event=>{if(event.target.id==='evidencePreviewModal')closeEvidencePreview();});
document.getElementById('evidencePreviewBody')?.addEventListener('click',event=>{
  const sheet=event.target.closest('[data-preview-sheet-index]');
  if(sheet&&evidencePreviewUi.workbook){const name=evidencePreviewUi.workbook.SheetNames[Number(sheet.dataset.previewSheetIndex)];if(name)evidencePreviewContent().innerHTML=evidencePreviewSheetTable(name);return;}
  if(event.target.closest('[data-preview-external]'))evidencePreviewExternalOffice();
});

