let advancedDispose=()=>{};
function previewAdvancedClean(){advancedDispose();advancedDispose=()=>{};}
function previewColumn(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
async function previewAdvanced(buffer,ext,id){
 if(['xls','xlsx','csv','ods'].includes(ext))return previewSpreadsheet(buffer,id);
 if(!['docx','pptx'].includes(ext))return false;
 const frame=document.createElement('iframe');frame.className='office-document-frame';frame.title='Pratinjau '+ext.toUpperCase();frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';
 const origin=location.origin,channel=new MessageChannel();
 const timer=setTimeout(()=>{if(evidencePreviewUi.requestId===id)evidencePreviewStatus('Tampilan dokumen belum selesai. Coba lagi atau buka file asli.','error');frame.remove();},35000);
 advancedDispose=()=>{clearTimeout(timer);window.removeEventListener('message',ready);channel.port1.close();frame.remove();};
 channel.port1.onmessage=({data})=>{clearTimeout(timer);if(evidencePreviewUi.requestId!==id)return;if(data.kind==='error')evidencePreviewStatus('Pratinjau layout gagal: '+data.message+'. Gunakan file asli.','error');};
 const ready=event=>{if(event.source!==frame.contentWindow||event.data?.kind!=='office-ready')return;window.removeEventListener('message',ready);frame.contentWindow.postMessage({ext,buffer},'*',[channel.port2,buffer]);};
 window.addEventListener('message',ready);
 const library=ext==='docx'?'docx-preview.min.js':'pptx-preview.umd.js';
 frame.srcdoc=`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${origin}; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><style>*{box-sizing:border-box}body{margin:0;background:#e8edf4;color:#243247;font:14px system-ui}nav{position:sticky;top:0;z-index:1000;background:white;padding:10px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #ccd5df}button{background:#f6f8fc;border:1px solid #ccd5df;padding:7px 12px;border-radius:6px;cursor:pointer}#position{flex:1}#pages{width:max-content;min-width:794px;margin:20px auto;transform-origin:top center}.docx-wrapper{padding:0!important;background:transparent!important}section.docx{box-shadow:0 2px 15px #192c4526!important;margin-bottom:24px!important}.pptx-preview-wrapper-next,.pptx-preview-wrapper-pagination{display:none!important}#status{padding:24px;text-align:center}</style><script defer src="${origin}/vendor/jszip.min.js"><\/script><script defer src="${origin}/vendor/${library}"><\/script><script defer src="${origin}/preview-office-frame.js?v=2"><\/script></head><body><nav><button id="previous">←</button><span id="position">Menata halaman…</span><button id="next">→</button><button id="minus">−</button><button id="fit">Pas lebar</button><button id="plus">+</button></nav><div id="status">Menampilkan dokumen…</div><div id="pages"></div></body></html>`;
 evidencePreviewContent().replaceChildren(frame);evidencePreviewUi.viewerProvider='Layout '+ext.toUpperCase()+' lokal terisolasi';return true;
}
async function previewSpreadsheet(buffer,id){
 const worker=new Worker('/preview-sheet-worker.js?v=2');let timer,active=0,row=0,col=0;
 const resetTimer=()=>{clearTimeout(timer);timer=setTimeout(()=>{worker.terminate();if(evidencePreviewUi.requestId===id)evidencePreviewStatus('Spreadsheet terlalu lama diproses. Buka file asli atau coba file yang lebih kecil.','error');},30000);};
 advancedDispose=()=>{clearTimeout(timer);worker.terminate();};
 const request=()=>{resetTimer();worker.postMessage({kind:'page',sheet:active,row,col});};
 worker.onerror=()=>{advancedDispose();if(evidencePreviewUi.requestId===id)evidencePreviewStatus('Komponen spreadsheet tidak dapat dimuat. Pastikan folder public/vendor ikut dideploy.','error');};
 worker.onmessage=({data:d})=>{
  if(evidencePreviewUi.requestId!==id)return;clearTimeout(timer);
  if(d.kind==='error'){worker.terminate();evidencePreviewStatus(d.message,'error');return;}
  if(d.kind==='loaded'){request();return;}
  if(d.kind!=='page')return;
  row=d.row;col=d.col;
  const wrapper=document.createElement('div');wrapper.className='sheet-app';
  wrapper.innerHTML=`<div class="sheet-ribbon"><b>Spreadsheet</b><span>Hanya baca · ${d.names.length} lembar</span></div><div class="sheet-formula"><b id="cellAddress">A1</b><span>fx</span><input id="cellValue" readonly aria-label="Isi atau rumus sel" placeholder="Klik sel untuk membaca nilai atau rumus"></div><div class="sheet-grid-wrap"><table class="sheet-grid"><colgroup><col style="width:48px">${d.widths.map(w=>`<col style="width:${w}px">`).join('')}</colgroup><thead><tr><th></th>${d.widths.map((_,c)=>`<th>${previewColumn(c+col)}</th>`).join('')}</tr></thead><tbody></tbody></table></div><div class="sheet-tabs">${d.names.map((n,i)=>`<button data-sheet="${i}" class="${i===active?'selected':''}">${escapeHtml(n)}</button>`).join('')}</div><div class="sheet-status"><button data-move="up" ${row===0?'disabled':''}>↑ Baris sebelumnya</button><button data-move="down" ${d.endRow>=d.maxRow?'disabled':''}>↓ Baris berikutnya</button><button data-move="left" ${col===0?'disabled':''}>← Kolom</button><button data-move="right" ${d.endCol>=d.maxCol?'disabled':''}>Kolom →</button><span>Baris ${row+1}–${d.endRow+1} dari ${d.maxRow+1} · Kolom ${previewColumn(col)}–${previewColumn(d.endCol)}${d.limited?' · Pratinjau dibatasi 10.001 baris':''}</span></div>`;
  const tbody=wrapper.querySelector('tbody');
  for(let ri=0;ri<d.cells.length;ri++){
   const r=row+ri,tr=document.createElement('tr'),rh=document.createElement('th');rh.textContent=r+1;tr.append(rh);
   for(let ci=0;ci<d.cells[ri].length;ci++){
    const c=col+ci,cell=d.cells[ri][ci];const merge=d.merges.find(m=>r>=m.s.r&&r<=m.e.r&&c>=m.s.c&&c<=m.e.c);
    if(merge&&(r!==Math.max(row,merge.s.r)||c!==Math.max(col,merge.s.c)))continue;
    const td=document.createElement('td');td.textContent=cell?.text||'';td.tabIndex=0;
    if(merge){td.rowSpan=Math.min(d.endRow,merge.e.r)-r+1;td.colSpan=Math.min(d.endCol,merge.e.c)-c+1;}
    if(cell?.fill)td.style.backgroundColor='#'+cell.fill;
    td.onclick=()=>{wrapper.querySelector('.cell-selected')?.classList.remove('cell-selected');td.classList.add('cell-selected');wrapper.querySelector('#cellAddress').textContent=previewColumn(c)+(r+1);wrapper.querySelector('#cellValue').value=cell?.formula?'='+cell.formula:(cell?.text||'');};tr.append(td);
   }tbody.append(tr);
  }
  wrapper.addEventListener('click',event=>{const tab=event.target.closest('[data-sheet]');if(tab){active=Number(tab.dataset.sheet);row=0;col=0;request();return;}const move=event.target.closest('[data-move]')?.dataset.move;if(!move)return;if(move==='up')row=Math.max(0,row-100);if(move==='down')row+=100;if(move==='left')col=Math.max(0,col-40);if(move==='right')col+=40;request();});
  evidencePreviewContent().replaceChildren(wrapper);evidencePreviewUi.viewerProvider='Spreadsheet lokal · worker terpisah, sheet dan navigasi sel';
 };
 resetTimer();worker.postMessage({kind:'load',buffer},[buffer]);return true;
}
