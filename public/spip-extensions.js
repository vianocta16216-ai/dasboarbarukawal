const RISK_COLUMNS=[['rr_pa','RR Strategic PA'],['fraud_pa','Risiko Fraud Strategic PA'],['rr_kpa','RR Tactical KPA Program'],['fraud_kpa','Risiko Fraud Tactical KPA Program'],['rr_pptk','RR Operasional PPTK'],['fraud_pptk','Risiko Fraud Operasional PPTK']];
function riskDashboardCells(row){return `<td><button type="button" class="risk-action" data-sk-satgas="${escapeHtml(row.id)}" title="SK Satgas SPIP">📄</button><small style="display:block">${(row.skSatgasReports||[]).length}/1 file</small></td>`+RISK_COLUMNS.map(([kind,label])=>`<td><button type="button" class="risk-action" data-risk-kind="${kind}" data-risk-opd="${escapeHtml(row.id)}" title="${label}">📊</button><small style="display:block">${label}</small></td>`).join('');}
function evidencePeriodControl(){return `<label style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">Berlaku sampai tahun <select data-valid-through aria-label="Tahun akhir masa berlaku evidence">${Array.from({length:5},(_,i)=>Number(currentYear)+i).map(y=>`<option value="${y}">${y}${y===Number(currentYear)?' (tahun ini saja)':''}</option>`).join('')}</select><small>Salinan otomatis per tahun pada parameter dan level yang sama.</small></label>`;}
function evidencePeriodLabel(file){const p=file.period;if(!p)return '';return `<div class="wb-drive-error" style="background:#eff6ff;color:#1e3a8a">Berlaku ${escapeHtml(p.start)}–${escapeHtml(p.end)} · ${p.status==='done'?'Salinan R2 per tahun tersedia; lihat status Google Drive di masing-masing tahun':p.status==='cancelled'?'Penyalinan dibatalkan':'Salinan lintas tahun sedang diproses otomatis'}${p.error?' · '+escapeHtml(p.error):''}</div>`;}
// Shared, accessible Ya/Tidak confirmation for manual Spreadsheet creation/sync.
// Only one confirmation may be open at once; cancelling never calls the server.
let spreadsheetConfirmationOpen=false;
function spreadsheetConfirmEscape(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
globalThis.kawalConfirmSpreadsheet=function({title='Konfirmasi Spreadsheet',description='',detail='',confirmText='Ya, Lanjutkan'}={}){
  if(spreadsheetConfirmationOpen)return Promise.resolve(false);
  spreadsheetConfirmationOpen=true;
  return new Promise(resolve=>{
    const previousFocus=document.activeElement;
    const dialog=document.createElement('dialog');
    dialog.className='kawal-spreadsheet-confirm';
    dialog.setAttribute('aria-labelledby','kawalSpreadsheetConfirmTitle');
    dialog.setAttribute('aria-describedby','kawalSpreadsheetConfirmDescription');
    dialog.innerHTML=`<div class="kawal-spreadsheet-confirm-head"><span class="kawal-spreadsheet-confirm-icon" aria-hidden="true">▦</span><span class="kawal-spreadsheet-confirm-eyebrow">KAWAL SPIP · KONFIRMASI</span><h2 id="kawalSpreadsheetConfirmTitle">${spreadsheetConfirmEscape(title)}</h2><p id="kawalSpreadsheetConfirmDescription">${spreadsheetConfirmEscape(description)}</p></div><div class="kawal-spreadsheet-confirm-body"><div class="kawal-spreadsheet-confirm-detail">${spreadsheetConfirmEscape(detail||'Aplikasi akan mengecek file yang sudah ada agar tidak membuat spreadsheet ganda.')}</div><p class="kawal-spreadsheet-confirm-note">File yang masih tersedia digunakan kembali. File yang hilang akan dibuat ulang setelah pemeriksaan server.</p></div><div class="kawal-spreadsheet-confirm-actions"><button type="button" class="kawal-confirm-no">Tidak, Batalkan</button><button type="button" class="kawal-confirm-yes">${spreadsheetConfirmEscape(confirmText)}</button></div>`;
    document.body.append(dialog);
    let settled=false;
    const finish=answer=>{
      if(settled)return;
      settled=true;spreadsheetConfirmationOpen=false;
      if(dialog.open)dialog.close();dialog.remove();
      if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
      resolve(answer);
    };
    dialog.querySelector('.kawal-confirm-no').addEventListener('click',()=>finish(false));
    dialog.querySelector('.kawal-confirm-yes').addEventListener('click',()=>finish(true));
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
    dialog.addEventListener('click',event=>{if(event.target===dialog)finish(false);});
    try{dialog.showModal();dialog.querySelector('.kawal-confirm-no').focus();}
    catch(error){dialog.remove();spreadsheetConfirmationOpen=false;resolve(false);}
  });
};

let riskDialogSequence=0;
async function openRiskWorkbook(opdId,kind){
  const row=rows.find(r=>r.id===opdId),column=RISK_COLUMNS.find(r=>r[0]===kind);
  if(!row||!column)return;
  let modal=document.getElementById('riskWorkbookDialog');
  if(!modal){modal=document.createElement('dialog');modal.id='riskWorkbookDialog';document.body.append(modal);}
  const seq=++riskDialogSequence,year=currentYear;
  modal.innerHTML=`<div class="risk-dialog-heading"><span class="risk-dialog-kicker">KAWAL SPIP · KERTAS KERJA RISIKO</span><h2>${spreadsheetConfirmEscape(column[1])}</h2><p>${spreadsheetConfirmEscape(row.opd)} · Tahun ${spreadsheetConfirmEscape(year)}</p></div><div class="risk-dialog-content"><p>Workbook tersendiri untuk OPD, tahun, dan jenis kertas kerja ini. Seluruh sheet mengikuti template Excel asli.</p><div data-risk-status class="risk-dialog-status" role="status" aria-live="polite">Memeriksa Google Drive…</div><div data-risk-links class="risk-dialog-links"></div></div><div class="risk-dialog-actions"><button type="button" data-risk-recheck class="risk-dialog-recheck">↻ Muat Ulang</button><span class="risk-dialog-spacer"></span><button type="button" data-risk-create class="risk-dialog-create" hidden>＋ Buat Spreadsheet</button><button type="button" data-risk-close class="risk-dialog-close">Tutup</button></div>`;
  modal.querySelector('[data-risk-close]').onclick=()=>{riskDialogSequence++;modal.close();};
  modal.oncancel=()=>{riskDialogSequence++;};
  if(!modal.open)modal.showModal();
  const status=modal.querySelector('[data-risk-status]'),links=modal.querySelector('[data-risk-links]');
  const create=modal.querySelector('[data-risk-create]'),recheck=modal.querySelector('[data-risk-recheck]');
  const setStatus=(message,type='')=>{if(seq!==riskDialogSequence)return;status.textContent=message;status.className='risk-dialog-status'+(type?' '+type:'');};
  const apply=result=>{
    if(seq!==riskDialogSequence)return;
    links.replaceChildren();
    const template=document.createElement('a');
    template.textContent='↓ Unduh template Excel asli';
    template.href='/risk-templates/'+(kind.startsWith('fraud')?'fraud.xlsx':kind==='rr_pa'?'strategic-pa.xlsx':kind==='rr_kpa'?'tactical-kpa.xlsx':'operational-pptk.xlsx');
    template.download='';links.append(template);
    if(result.workbook){
      const open=document.createElement('a');open.textContent='↗ Buka Spreadsheet';open.href=result.workbook.url;
      open.target='_blank';open.rel='noopener noreferrer';open.className='risk-dialog-open';
      links.prepend(open);setStatus('Spreadsheet aktif ditemukan dan siap dibuka.','success');create.hidden=true;
    }else{
      setStatus(result.needsRecreate?`${result.reason||'File lama tidak ditemukan.'} Anda dapat membuat spreadsheet baru pada folder yang sesuai.`:'Spreadsheet untuk OPD, tahun, dan jenis ini belum dibuat.',result.needsRecreate?'warning':'');
      create.hidden=false;create.textContent=result.needsRecreate?'＋ Buat Ulang Spreadsheet':'＋ Buat Spreadsheet';
    }
  };
  let busy=false;
  async function load(){
    if(busy||seq!==riskDialogSequence)return;
    busy=true;recheck.disabled=true;create.disabled=true;create.hidden=true;
    setStatus('Memeriksa keberadaan file dan folder Google Drive…');
    try{apply(await callServer('getRiskWorkbook',{opdId,kind,year}));}
    catch(e){setStatus('Google Drive belum berhasil diverifikasi: '+e.message+' Tidak membuat file baru untuk mencegah duplikasi. Silakan Muat Ulang.','error');}
    finally{busy=false;if(seq===riskDialogSequence){recheck.disabled=false;create.disabled=false;}}
  }
  recheck.onclick=load;
  create.onclick=async()=>{
    if(busy||create.disabled||seq!==riskDialogSequence)return;
    busy=true;create.disabled=true;recheck.disabled=true;
    try{
      const yes=await window.kawalConfirmSpreadsheet({
        title:'Buat Spreadsheet Kertas Kerja?',
        description:`${column[1]} — ${row.opd} · Tahun ${year}`,
        detail:'Ya: periksa ulang Google Drive dan gunakan file yang sudah ada, atau buat salinan baru bila file/folder sebelumnya hilang. Tidak: batalkan tanpa perubahan.',
        confirmText:'Ya, Buat / Sinkronkan'
      });
      if(!yes||seq!==riskDialogSequence)return;
      setStatus('Memvalidasi folder dan membuat/memulihkan spreadsheet dari template…');
      const result=await callServer('createRiskWorkbook',{opdId,kind,year});
      apply(result);
    }catch(e){
      setStatus('Spreadsheet belum berhasil disinkronkan: '+e.message+' Klik Muat Ulang untuk mengecek keadaan sebenarnya sebelum mencoba ulang.','error');
      // Only reveal Create again after a successful Drive inspection.
      create.hidden=true;
    }finally{busy=false;if(seq===riskDialogSequence){create.disabled=false;recheck.disabled=false;}}
  };
  await load();
}
document.addEventListener('click',event=>{const sk=event.target.closest('[data-sk-satgas]');if(sk){openReportUploadModal(sk.dataset.skSatgas,'sk_satgas');return;}const risk=event.target.closest('[data-risk-kind]');if(risk)openRiskWorkbook(risk.dataset.riskOpd,risk.dataset.riskKind);});

const riskStyle=document.createElement('style');
riskStyle.textContent=`
.risk-action{border:0;border-radius:9px;background:#0f766e;color:white;padding:10px 14px;cursor:pointer}
.risk-action+small{margin-top:6px;line-height:1.4;color:#475569}
[data-valid-through]{min-height:36px;border:1px solid #94a3b8;border-radius:8px;padding:6px;background:white;color:#172554}
#riskWorkbookDialog,.kawal-spreadsheet-confirm{border:1px solid #dbeafe;border-radius:20px;padding:0;background:#fff;color:#0f172a;box-shadow:0 24px 80px #02061750;max-height:min(90vh,900px);overflow:auto}
#riskWorkbookDialog{width:min(650px,94vw)}
#riskWorkbookDialog::backdrop,.kawal-spreadsheet-confirm::backdrop{background:#0f172ab8;backdrop-filter:blur(4px)}
.risk-dialog-heading{background:linear-gradient(120deg,#11274b,#1d4e7c);color:white;padding:25px 28px}
.risk-dialog-kicker,.kawal-spreadsheet-confirm-eyebrow{display:block;font-size:11px;letter-spacing:.1em;font-weight:800;opacity:.8}
.risk-dialog-heading h2{color:#fff;font-size:21px;line-height:1.3;margin:12px 0 6px}
.risk-dialog-heading p{color:#e2e8f0;margin:0;font-size:13px}
.risk-dialog-content{padding:23px 28px 10px}
.risk-dialog-content>p{color:#475569;line-height:1.65;margin:0 0 18px;font-size:14px}
.risk-dialog-status{border:1px solid #dbeafe;border-radius:12px;padding:13px 15px;color:#1e3a8a;background:#eff6ff;line-height:1.5;font-size:13px}
.risk-dialog-status.success{color:#065f46;background:#ecfdf5;border-color:#a7f3d0}
.risk-dialog-status.warning{color:#92400e;background:#fffbeb;border-color:#fcd34d}
.risk-dialog-status.error{color:#991b1b;background:#fef2f2;border-color:#fecaca}
.risk-dialog-links{display:flex;gap:11px;flex-wrap:wrap;margin:20px 0}
.risk-dialog-links a{text-decoration:none;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:10px;padding:10px 13px;font-size:13px;font-weight:700;background:#fff}
.risk-dialog-links .risk-dialog-open{background:#0f766e;color:white;border-color:#0f766e}
.risk-dialog-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:18px 28px 24px;border-top:1px solid #e2e8f0}
.risk-dialog-spacer{flex:1}
#riskWorkbookDialog button,.kawal-spreadsheet-confirm button{border-radius:10px;font-weight:700;padding:11px 15px;cursor:pointer;border:1px solid #cbd5e1;background:white;color:#334155;min-height:41px}
#riskWorkbookDialog button:disabled,.kawal-spreadsheet-confirm button:disabled{opacity:.55;cursor:wait}
#riskWorkbookDialog .risk-dialog-create,.kawal-spreadsheet-confirm .kawal-confirm-yes{color:#fff;background:linear-gradient(120deg,#0f766e,#0d9488);border-color:#0d9488}
#riskWorkbookDialog button:focus-visible,.kawal-spreadsheet-confirm button:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}
.kawal-spreadsheet-confirm{width:min(510px,94vw)}
.kawal-spreadsheet-confirm-head{padding:28px 29px 20px;background:linear-gradient(120deg,#11274b,#154776);color:white}
.kawal-spreadsheet-confirm-icon{display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:13px;background:#ffffff24;border:1px solid #ffffff3b;color:#fff;font-size:27px;margin-bottom:15px}
.kawal-spreadsheet-confirm-head h2{font-size:22px;color:#fff;margin:10px 0}
.kawal-spreadsheet-confirm-head p{margin:0;color:#e2e8f0;font-size:14px;line-height:1.6}
.kawal-spreadsheet-confirm-body{padding:21px 29px 7px}
.kawal-spreadsheet-confirm-detail{background:#eff6ff;border:1px solid #bfdbfe;padding:14px;border-radius:11px;font-size:13px;line-height:1.65;color:#1e3a8a}
.kawal-spreadsheet-confirm-note{color:#64748b;font-size:12px;line-height:1.6;margin:14px 0}
.kawal-spreadsheet-confirm-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;padding:10px 29px 26px}
@media(max-width:480px){.risk-dialog-heading,.risk-dialog-content,.risk-dialog-actions{padding-left:18px;padding-right:18px}.kawal-spreadsheet-confirm-head,.kawal-spreadsheet-confirm-body,.kawal-spreadsheet-confirm-actions{padding-left:19px;padding-right:19px}.kawal-spreadsheet-confirm-actions button{flex:1}}
`;
document.head.append(riskStyle);
