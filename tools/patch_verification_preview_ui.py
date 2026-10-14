from pathlib import Path
root=Path('/mnt/data/kawal_work_next')
p=root/'public/script.js';s=p.read_text()
# Main Structure & Process evidence: stop navigating to raw attachment; use preview tab and expose workflow action.
s=s.replace("""    const ext = fileName.split('.').pop().toLowerCase();
    let displayUrl = fileUrl;
    if (!String(fileUrl).startsWith('/myCloudinaryHandler?')) {
      if (['xls', 'xlsx'].includes(ext)) displayUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
      else if (['pdf', 'doc', 'docx', 'ppt', 'pptx'].includes(ext)) displayUrl = `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(fileUrl)}`;
    }
""", """    const ext = fileName.split('.').pop().toLowerCase();
    const fileType = String(fileObj?.fileType || 'application/octet-stream');
    const previewAction = isObject && fileObj.uploadId
      ? `<button type=\"button\" class=\"file-action evidence-preview-btn\" data-opd-id=\"${escapeHtml(row.id)}\" data-upload-id=\"${escapeHtml(fileObj.uploadId)}\" data-file-name=\"${escapeHtml(fileName)}\" data-file-type=\"${escapeHtml(fileType)}\">👁 Pratinjau</button>`
      : '';
    const fileTitle = isObject && fileObj.uploadId
      ? `<button type=\"button\" class=\"file-name-preview\" data-opd-id=\"${escapeHtml(row.id)}\" data-upload-id=\"${escapeHtml(fileObj.uploadId)}\" data-file-name=\"${escapeHtml(fileName)}\" data-file-type=\"${escapeHtml(fileType)}\">📎 ${escapeHtml(fileName)}</button>`
      : `<a href=\"${escapeHtml(fileUrl)}\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"file-link\">📎 ${escapeHtml(fileName)}</a>`;
""",1)
# Add workflow button to each main evidence file card and replace clickable link with preview action.
s=s.replace("""      <div class=\"evidence-file-main\">
        <a href=\"${escapeHtml(displayUrl)}\" target=\"_blank\" rel=\"noopener\" class=\"file-link\">📎 ${escapeHtml(fileName)}</a>
        <span class=\"evidence-storage-status\">${statusLabel}</span>
        ${retryButton}
        <button type=\"button\" class=\"file-action delete\" onclick=\"removeUploadedFile('${row.id}', '${subCode}', '${paramId}', ${level}, '${String(fileUrl).replace(/'/g, \"\\\\'\")}', ${index})\">🗑️ Hapus</button>
      </div>
""", """      <div class=\"evidence-file-main\">
        ${fileTitle}
        ${previewAction}
        ${workflowButton}
        <span class=\"evidence-storage-status\">${statusLabel}</span>
        ${retryButton}
        <button type=\"button\" class=\"file-action delete\" onclick=\"removeUploadedFile('${row.id}', '${subCode}', '${paramId}', ${level}, '${String(fileUrl).replace(/'/g, \"\\\\'\")}', ${index})\">🗑️ Hapus</button>
      </div>
""",1)
# Workbook Evidence rows: gate direct verification panel and expose workflow + preview for auditors.
old="""function wbEvidenceFileHtml(file){
  const url=file?.url||'';
  const name=escapeHtml(file?.fileName||'Evidence');
  const syncStatus=file?.syncStatus==='done'?'Tersinkron ke Drive':file?.syncStatus==='retrying'?'Perlu sinkron ulang':'Tersimpan di R2';
  const status=normalizeVerification(file).status;
  const statusClass=verificationStatusClass(status);
  const score=getVerificationScore(file);
  const uploadId=escapeHtml(file.uploadId||'');
  const retryButton=file?.syncStatus==='done'?'':`<button type=\"button\" class=\"wb-action-retry\" data-wb-action=\"retry\" data-upload-id=\"${uploadId}\" aria-label=\"Ulangi sinkronisasi Google Drive\" title=\"Ulangi sinkronisasi Google Drive\">↻ Ulangi Sinkronisasi</button>`;
  const replaceControl=status==='dikembalikan'?`<button type=\"button\" class=\"wb-action-replace\" data-wb-action=\"replace\" data-upload-id=\"${uploadId}\">↻ Ganti File</button><input type=\"file\" hidden data-wb-replace-input=\"1\" data-upload-id=\"${uploadId}\" accept=\".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp\">`:'';
  return `<div class=\"wb-evidence-file is-${statusClass}\" data-wb-file-id=\"${uploadId}\">
    <div class=\"wb-evidence-file-main\">
      <span class=\"wb-evidence-file-name\">${url?`<a href=\"${escapeHtml(url)}\" target=\"_blank\" rel=\"noopener\">📎 ${name}</a>`:`📎 ${name}`}</span>
      <div class=\"wb-evidence-file-badges\"><span class=\"wb-sync-pill ${file?.syncStatus==='done'?'is-synced':file?.syncStatus==='retrying'?'is-retry':'is-pending'}\">${escapeHtml(syncStatus)}</span><span class=\"wb-verification-pill\" data-wb-status-pill>${escapeHtml(verificationStatusLabel(status))}</span><span class=\"wb-score-badge\" data-wb-score>Skor ${score}%</span></div>
    </div>
    <div class=\"wb-verification-meter\" role=\"progressbar\" aria-label=\"Skor verifikasi dokumen\" aria-valuemin=\"0\" aria-valuemax=\"100\" aria-valuenow=\"${score}\"><span data-wb-score-fill style=\"width:${score}%\"></span></div>
    <div class=\"wb-evidence-file-actions\">${replaceControl}${retryButton}<button type=\"button\" class=\"wb-action-delete\" data-wb-action=\"delete\" data-upload-id=\"${uploadId}\" aria-label=\"Hapus file evidence\" title=\"Hapus file evidence\">🗑 Hapus File</button></div>
    <details class=\"wb-verification\"><summary>🛡️ Penjaminan / Verifikasi Inspektorat</summary><div class=\"wb-verification-grid\">
      <label>Hasil Verifikasi<select class=\"wb-verify-status is-${statusClass}\" data-wb-ver-status=\"${uploadId}\">${verificationStatusOptions(status)}</select></label>
      <label>Nama Pemeriksa<input type=\"text\" maxlength=\"100\" data-wb-ver-examiner=\"${uploadId}\" value=\"${escapeHtml(file.verificationExaminer||'')}\" placeholder=\"Ketik nama pemeriksa\"></label>
      <label class=\"wb-verification-note-label\">Catatan Pemeriksa<textarea maxlength=\"2000\" data-wb-ver-note=\"${uploadId}\" placeholder=\"Catatan, alasan pengembalian, atau koreksi yang perlu ditindaklanjuti\">${escapeHtml(file.verificationNote||'')}</textarea></label>
      <button type=\"button\" class=\"wb-action-save\" data-wb-action=\"verify\" data-upload-id=\"${uploadId}\">💾 Simpan Verifikasi</button>
    </div></details>
  </div>`;
}
"""
new="""function wbEvidenceFileHtml(file){
  const url=file?.url||'';
  const name=escapeHtml(file?.fileName||'Evidence');
  const syncStatus=file?.syncStatus==='done'?'Tersinkron ke Drive':file?.syncStatus==='retrying'?'Perlu sinkron ulang':'Tersimpan di R2';
  const status=normalizeVerification(file).status;
  const statusClass=verificationStatusClass(status);
  const score=getVerificationScore(file);
  const uploadId=escapeHtml(file.uploadId||'');
  const opdId=escapeHtml(workbookEvidenceRow?.id||'');
  const previewButton=file?.uploadId?`<button type=\"button\" class=\"wb-action-preview evidence-preview-btn\" data-opd-id=\"${opdId}\" data-upload-id=\"${uploadId}\" data-file-name=\"${name}\" data-file-type=\"${escapeHtml(file.fileType||'application/octet-stream')}\">👁 Pratinjau</button>`:'';
  const workflowButton=file?.uploadId?`<button type=\"button\" class=\"evidence-workflow-btn wb-action-preview\" data-opd-id=\"${opdId}\" data-upload-id=\"${uploadId}\" data-file-name=\"${name}\">🛡️ Alur Verifikasi</button>`:'';
  const retryButton=file?.syncStatus==='done'?'':`<button type=\"button\" class=\"wb-action-retry\" data-wb-action=\"retry\" data-upload-id=\"${uploadId}\" aria-label=\"Ulangi sinkronisasi Google Drive\" title=\"Ulangi sinkronisasi Google Drive\">↻ Ulangi Sinkronisasi</button>`;
  const canDirectVerify=['admin','irban'].includes(String(currentUser?.role||''));
  const replaceControl=status==='dikembalikan'&&canDirectVerify?`<button type=\"button\" class=\"wb-action-replace\" data-wb-action=\"replace\" data-upload-id=\"${uploadId}\">↻ Ganti File</button><input type=\"file\" hidden data-wb-replace-input=\"1\" data-upload-id=\"${uploadId}\" accept=\".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp\">`:'';
  const verificationPanel=canDirectVerify?`<details class=\"wb-verification\"><summary>🛡️ Penjaminan / Verifikasi Inspektorat</summary><div class=\"wb-verification-grid\">
      <label>Hasil Verifikasi<select class=\"wb-verify-status is-${statusClass}\" data-wb-ver-status=\"${uploadId}\">${verificationStatusOptions(status)}</select></label>
      <label>Nama Pemeriksa<input type=\"text\" maxlength=\"100\" data-wb-ver-examiner=\"${uploadId}\" value=\"${escapeHtml(file.verificationExaminer||'')}\" placeholder=\"Ketik nama pemeriksa\"></label>
      <label class=\"wb-verification-note-label\">Catatan Pemeriksa<textarea maxlength=\"2000\" data-wb-ver-note=\"${uploadId}\" placeholder=\"Catatan, alasan pengembalian, atau koreksi yang perlu ditindaklanjuti\">${escapeHtml(file.verificationNote||'')}</textarea></label>
      <button type=\"button\" class=\"wb-action-save\" data-wb-action=\"verify\" data-upload-id=\"${uploadId}\">💾 Simpan Verifikasi</button>
    </div></details>`:`<div class=\"wb-verification-readonly\">${workflowButton}<span>${escapeHtml(verificationStatusLabel(status))}</span></div>`;
  return `<div class=\"wb-evidence-file is-${statusClass}\" data-wb-file-id=\"${uploadId}\">
    <div class=\"wb-evidence-file-main\">
      <span class=\"wb-evidence-file-name\">${name}</span>
      <div class=\"wb-evidence-file-badges\"><span class=\"wb-sync-pill ${file?.syncStatus==='done'?'is-synced':file?.syncStatus==='retrying'?'is-retry':'is-pending'}\">${escapeHtml(syncStatus)}</span><span class=\"wb-verification-pill\" data-wb-status-pill>${escapeHtml(verificationStatusLabel(status))}</span><span class=\"wb-score-badge\" data-wb-score>Skor ${score}%</span></div>
    </div>
    <div class=\"wb-verification-meter\" role=\"progressbar\" aria-label=\"Skor verifikasi dokumen\" aria-valuemin=\"0\" aria-valuemax=\"100\" aria-valuenow=\"${score}\"><span data-wb-score-fill style=\"width:${score}%\"></span></div>
    <div class=\"wb-evidence-file-actions\">${previewButton}${canDirectVerify?workflowButton:''}${replaceControl}${retryButton}${canDirectVerify?`<button type=\"button\" class=\"wb-action-delete\" data-wb-action=\"delete\" data-upload-id=\"${uploadId}\" aria-label=\"Hapus file evidence\" title=\"Hapus file evidence\">🗑 Hapus File</button>`:''}</div>
    ${verificationPanel}
  </div>`;
}
"""
if old not in s: raise SystemExit('wbEvidenceFileHtml block not found')
s=s.replace(old,new,1)
# workflow statuses and UI validation
s=s.replace("function workflowStatusLabel(status){return ({menunggu:'Menunggu',dikirim:'Dikirim Auditor',diterima:'Diterima',dikembalikan:'Dikembalikan'})[status]||status||'Menunggu';}", "function workflowStatusLabel(status){return ({menunggu:'Menunggu',dikirim:'Dikirim Auditor',diterima:'Diterima',diterima_catatan:'Diterima dengan Catatan',dikembalikan:'Dikembalikan'})[status]||status||'Menunggu';}")
s=s.replace("if(stage==='bpkp'&&stages.irban?.status!=='diterima')return false;", "if(stage==='bpkp'&&!['diterima','diterima_catatan'].includes(stages.irban?.status))return false;")
s=s.replace("const statuses=stage==='auditor'?[['dikirim','Kirim ke Irban']]:[['diterima','Diterima'],['dikembalikan','Dikembalikan / perlu perbaikan']];", "const statuses=stage==='auditor'?[['dikirim','Kirim ke Irban']]:[['diterima','Diterima'],['diterima_catatan','Diterima dengan Catatan'],['dikembalikan','Dikembalikan / perlu perbaikan']];")
s=s.replace("const can=workflowCanSubmit(stage,data);const ready=statusEl.value!=='dikembalikan'||document.getElementById('workflowNote').value.trim().length>=2;", "const can=workflowCanSubmit(stage,data);const ready=!['dikembalikan','diterima_catatan'].includes(statusEl.value)||document.getElementById('workflowNote').value.trim().length>=2;")
s=s.replace("if(status==='dikembalikan'&&note.length<2){workflowSetStatus('Catatan wajib diisi jika evidence dikembalikan.','error');return;}", "if(['dikembalikan','diterima_catatan'].includes(status)&&note.length<2){workflowSetStatus('Catatan wajib diisi untuk Diterima dengan Catatan atau Dikembalikan.','error');return;}")
# Preview system: insert helpers before workflow section
marker="// ====== ALUR VERIFIKASI BERTAHAP: AUDITOR → IRBAN → BPKP ======"
preview=r'''// ====== PREVIEW FILE PRIVAT DI BROWSER ======
const evidencePreviewUi={objectUrl:null,activeTab:'preview',fileName:'',fileType:'',size:0};
function closeEvidencePreview(){const modal=document.getElementById('evidencePreviewModal');if(modal)modal.classList.remove('active');if(evidencePreviewUi.objectUrl){URL.revokeObjectURL(evidencePreviewUi.objectUrl);evidencePreviewUi.objectUrl=null;}const body=document.getElementById('evidencePreviewBody');if(body)body.replaceChildren();}
function evidencePreviewSetTab(tab){evidencePreviewUi.activeTab=tab;document.querySelectorAll('[data-preview-tab]').forEach(b=>b.classList.toggle('active',b.dataset.previewTab===tab));const body=document.getElementById('evidencePreviewBody');if(!body)return;if(tab==='details'){body.innerHTML=`<dl class="preview-file-details"><dt>Nama file</dt><dd>${escapeHtml(evidencePreviewUi.fileName)}</dd><dt>Jenis file</dt><dd>${escapeHtml(evidencePreviewUi.fileType||'Tidak diketahui')}</dd><dt>Ukuran</dt><dd>${(Number(evidencePreviewUi.size||0)/1024).toLocaleString('id-ID',{maximumFractionDigits:1})} KB</dd><dt>Sumber preview</dt><dd>${/^application\/(vnd\.openxmlformats|msword|vnd\.ms-)/i.test(evidencePreviewUi.fileType)||/\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(evidencePreviewUi.fileName)?'Microsoft Office Online Viewer (tautan berlaku 10 menit)':'Pratinjau privat dari penyimpanan aplikasi'}</dd></dl>`;}else if(body.dataset.rendered!=='1')body.innerHTML='<div class="preview-file-placeholder">Memuat pratinjau…</div>';}
async function openEvidencePreview(info){
  const modal=document.getElementById('evidencePreviewModal'),body=document.getElementById('evidencePreviewBody');if(!modal||!body)return;
  if(evidencePreviewUi.objectUrl){URL.revokeObjectURL(evidencePreviewUi.objectUrl);evidencePreviewUi.objectUrl=null;}
  evidencePreviewUi.fileName=String(info.fileName||'Evidence');evidencePreviewUi.fileType=String(info.fileType||'application/octet-stream');evidencePreviewUi.size=0;evidencePreviewUi.activeTab='preview';
  document.getElementById('evidencePreviewTitle').textContent=`Pratinjau File · ${evidencePreviewUi.fileName}`;modal.classList.add('active');document.querySelectorAll('[data-preview-tab]').forEach(b=>b.classList.toggle('active',b.dataset.previewTab==='preview'));body.dataset.rendered='0';body.innerHTML='<div class="preview-file-placeholder">⏳ Mengambil file privat…</div>';
  try{
    const name=evidencePreviewUi.fileName,ext=(name.split('.').pop()||'').toLowerCase(),type=evidencePreviewUi.fileType.toLowerCase();
    const officeExt=['doc','docx','xls','xlsx','ppt','pptx'];
    if(officeExt.includes(ext)){
      const link=await callServerWithRetry('createEvidencePreviewLink',{opdId:info.opdId,uploadId:info.uploadId,year:currentYear},1);
      body.innerHTML=`<div class="preview-external-notice"><b>Pratinjau Microsoft Office Online</b><p>Untuk membaca dokumen Office, file sementara diakses oleh layanan Microsoft melalui tautan bertanda tangan yang kedaluwarsa otomatis dalam 10 menit. Jangan bagikan URL pratinjau ini.</p></div><iframe title="Pratinjau ${escapeHtml(name)}" class="evidence-preview-frame" src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(link.url)}" referrerpolicy="no-referrer" allowfullscreen></iframe>`;body.dataset.rendered='1';evidencePreviewUi.size=0;return;
    }
    const q=new URLSearchParams({action:'previewEvidence',year:String(currentYear),opdId:String(info.opdId),uploadId:String(info.uploadId)});
    const response=await fetch(`/myCloudinaryHandler?${q.toString()}`,{method:'GET',cache:'no-store',credentials:'same-origin',headers:{'Cache-Control':'no-cache'}});
    if(!response.ok){const msg=await response.text();throw new Error(msg.slice(0,240)||`HTTP ${response.status}`);}
    const blob=await response.blob();evidencePreviewUi.size=blob.size;evidencePreviewUi.fileType=blob.type||evidencePreviewUi.fileType;
    const blobUrl=URL.createObjectURL(blob);evidencePreviewUi.objectUrl=blobUrl;
    if(type==='application/pdf'||ext==='pdf')body.innerHTML=`<iframe title="Pratinjau PDF ${escapeHtml(name)}" class="evidence-preview-frame" src="${blobUrl}#toolbar=0&navpanes=0" referrerpolicy="no-referrer"></iframe>`;
    else if(type.startsWith('image/')||['png','jpg','jpeg','gif','webp','bmp','avif'].includes(ext))body.innerHTML=`<div class="evidence-preview-image-wrap"><img src="${blobUrl}" alt="${escapeHtml(name)}" class="evidence-preview-image"></div>`;
    else if(type.startsWith('video/')||['mp4','webm','mov','m4v','ogv'].includes(ext))body.innerHTML=`<video controls playsinline class="evidence-preview-media" src="${blobUrl}">Browser tidak mendukung video ini.</video>`;
    else if(type.startsWith('audio/')||['mp3','wav','ogg','m4a','aac'].includes(ext))body.innerHTML=`<audio controls class="evidence-preview-audio" src="${blobUrl}">Browser tidak mendukung audio ini.</audio>`;
    else if(['txt','csv','json','xml','log','md'].includes(ext)||type.startsWith('text/')){const text=await blob.text();const pre=document.createElement('pre');pre.className='evidence-preview-text';pre.textContent=text.slice(0,2_000_000);body.replaceChildren(pre);if(text.length>2_000_000){const note=document.createElement('p');note.textContent='Pratinjau dibatasi sampai 2 MB teks.';body.append(note);}}
    else body.innerHTML=`<div class="preview-file-placeholder"><h4>Format ini tidak dapat dirender aman secara langsung.</h4><p>Jenis: ${escapeHtml(evidencePreviewUi.fileType)}. Untuk menjaga keamanan file aplikasi, format aktif atau tidak dikenal tidak dieksekusi di dalam website.</p><p>Gunakan aplikasi pembuka resmi untuk format ini atau unggah ulang sebagai PDF jika diperlukan.</p></div>`;
    body.dataset.rendered='1';
  }catch(err){body.innerHTML=`<div class="preview-file-placeholder is-error"><b>Pratinjau gagal dimuat</b><p>${escapeHtml(err.message||String(err))}</p><p>Periksa sesi login, akses OPD, dan konfigurasi EVIDENCE_PREVIEW_SECRET/Google OAuth untuk file Office.</p></div>`;body.dataset.rendered='1';}
}
document.getElementById('evidencePreviewClose')?.addEventListener('click',closeEvidencePreview);document.getElementById('evidencePreviewCloseFooter')?.addEventListener('click',closeEvidencePreview);document.querySelectorAll('[data-preview-tab]').forEach(b=>b.addEventListener('click',()=>evidencePreviewSetTab(b.dataset.previewTab)));document.getElementById('evidencePreviewModal')?.addEventListener('click',e=>{if(e.target.id==='evidencePreviewModal')closeEvidencePreview();});

'''+marker
if marker not in s: raise SystemExit('workflow marker not found')
s=s.replace(marker,preview,1)
# add preview event handler to existing global document click dispatcher
old="""  else if(btn.classList.contains('btn-lhe-followup')) openLheFollowupModal(btn.getAttribute('data-id'));
  else if(btn.classList.contains('evidence-workflow-btn')) openEvidenceWorkflowModal({opdId:btn.dataset.opdId,uploadId:btn.dataset.uploadId,fileName:btn.dataset.fileName||'Evidence'});
"""
new="""  else if(btn.classList.contains('btn-lhe-followup')) openLheFollowupModal(btn.getAttribute('data-id'));
  else if(btn.classList.contains('evidence-preview-btn')||btn.classList.contains('file-name-preview')) openEvidencePreview({opdId:btn.dataset.opdId,uploadId:btn.dataset.uploadId,fileName:btn.dataset.fileName||'Evidence',fileType:btn.dataset.fileType||'application/octet-stream'});
  else if(btn.classList.contains('evidence-workflow-btn')) openEvidenceWorkflowModal({opdId:btn.dataset.opdId,uploadId:btn.dataset.uploadId,fileName:btn.dataset.fileName||'Evidence'});
"""
if old not in s: raise SystemExit('click handler marker not found')
s=s.replace(old,new,1)
# Workbook evidence list actions need workflow accessible in auditor; handled by html above.
# Reports/LHE/RTP: add preview button beside any link for uploadId and non-direct link.
s=s.replace("const workflow=f.uploadId?`<button class=\"evidence-workflow-btn\" data-opd-id=\"${sheetLinksEsc(row.id)}\" data-upload-id=\"${sheetLinksEsc(f.uploadId)}\" data-file-name=\"${sheetLinksEsc(f.fileName||'Laporan')}\">🛡️ Alur Verifikasi</button>`:'';const canDelete", "const workflow=f.uploadId?`<button class=\"evidence-workflow-btn\" data-opd-id=\"${sheetLinksEsc(row.id)}\" data-upload-id=\"${sheetLinksEsc(f.uploadId)}\" data-file-name=\"${sheetLinksEsc(f.fileName||'Laporan')}\">🛡️ Alur Verifikasi</button>`:'';const preview=f.uploadId?`<button type=\"button\" class=\"evidence-preview-btn\" data-opd-id=\"${sheetLinksEsc(row.id)}\" data-upload-id=\"${sheetLinksEsc(f.uploadId)}\" data-file-name=\"${sheetLinksEsc(f.fileName||'Laporan')}\" data-file-type=\"${sheetLinksEsc(f.fileType||'application/octet-stream')}\">👁 Pratinjau</button>`:'';const canDelete",1)
s=s.replace("<div class=\"rtp-file-actions\"><a href=\"${sheetLinksEsc(open)}\" target=\"_blank\" rel=\"noopener noreferrer\">Buka</a>${workflow}${retry}", "<div class=\"rtp-file-actions\">${preview}<a href=\"${sheetLinksEsc(open)}\" target=\"_blank\" rel=\"noopener noreferrer\">Buka</a>${workflow}${retry}",1)
# RTP preview buttons alongside direct links (specific markup near renderer)
s=s.replace("const workflowButton=f?.uploadId?`<button class=\"evidence-workflow-btn\" data-opd-id=\"${sheetLinksEsc(row.id)}\" data-upload-id=\"${sheetLinksEsc(f.uploadId)}\" data-file-name=\"${sheetLinksEsc(f.fileName||'Evidence RTP')}\">🛡️ Alur Verifikasi</button>`:'';", "const workflowButton=f?.uploadId?`<button class=\"evidence-workflow-btn\" data-opd-id=\"${sheetLinksEsc(row.id)}\" data-upload-id=\"${sheetLinksEsc(f.uploadId)}\" data-file-name=\"${sheetLinksEsc(f.fileName||'Evidence RTP')}\">🛡️ Alur Verifikasi</button>`:'';const previewButton=f?.uploadId?`<button type=\"button\" class=\"evidence-preview-btn\" data-opd-id=\"${sheetLinksEsc(row.id)}\" data-upload-id=\"${sheetLinksEsc(f.uploadId)}\" data-file-name=\"${sheetLinksEsc(f.fileName||'Evidence RTP')}\" data-file-type=\"${sheetLinksEsc(f.fileType||'application/octet-stream')}\">👁 Pratinjau</button>`:'';",1)
# replace the first matching RTP actions area after workflowButton pattern
s=s.replace("<div class=\"rtp-file-actions\"><a href=\"${sheetLinksEsc(f.url||'#')}\" target=\"_blank\" rel=\"noopener noreferrer\">Buka</a>${workflowButton}", "<div class=\"rtp-file-actions\">${previewButton}<a href=\"${sheetLinksEsc(f.url||'#')}\" target=\"_blank\" rel=\"noopener noreferrer\">Buka</a>${workflowButton}",1)
# LHE evidence renderer: replace direct Buka with preview and workflow still available
s=s.replace("const workflow=f.uploadId?`<button type=\"button\" class=\"evidence-workflow-btn\" data-opd-id=\"${sheetLinksEsc(lheUi.opdId)}\" data-upload-id=\"${sheetLinksEsc(f.uploadId)}\" data-file-name=\"${sheetLinksEsc(f.fileName||'Bukti LHE')}\">🛡️ Alur Verifikasi</button>`:'';", "const workflow=f.uploadId?`<button type=\"button\" class=\"evidence-workflow-btn\" data-opd-id=\"${sheetLinksEsc(lheUi.opdId)}\" data-upload-id=\"${sheetLinksEsc(f.uploadId)}\" data-file-name=\"${sheetLinksEsc(f.fileName||'Bukti LHE')}\">🛡️ Alur Verifikasi</button>`:'';const preview=f.uploadId?`<button type=\"button\" class=\"evidence-preview-btn\" data-opd-id=\"${sheetLinksEsc(lheUi.opdId)}\" data-upload-id=\"${sheetLinksEsc(f.uploadId)}\" data-file-name=\"${sheetLinksEsc(f.fileName||'Bukti LHE')}\" data-file-type=\"${sheetLinksEsc(f.fileType||'application/octet-stream')}\">👁 Pratinjau</button>`:'';",1)
s=s.replace("<div class=\"rtp-file-actions\"><a href=\"${sheetLinksEsc(f.url||'#')}\" target=\"_blank\" rel=\"noopener noreferrer\">Buka</a>${workflow}${retry}${del}", "<div class=\"rtp-file-actions\">${preview}<a href=\"${sheetLinksEsc(f.url||'#')}\" target=\"_blank\" rel=\"noopener noreferrer\">Buka</a>${workflow}${retry}${del}",1)
p.write_text(s)
print('Patched frontend script')

# index modal insertion before </body>
p=root/'public/index.html';html=p.read_text()
modal='''
<!-- ===== PREVIEW EVIDENCE FILE AMAN DI BROWSER ===== -->
<div class="sheet-links-overlay evidence-preview-overlay" id="evidencePreviewModal" role="dialog" aria-modal="true" aria-labelledby="evidencePreviewTitle">
  <div class="sheet-links-modal evidence-preview-modal">
    <div class="sheet-links-header"><h3 id="evidencePreviewTitle">Pratinjau File Evidence</h3><button class="sheet-links-close" id="evidencePreviewClose" aria-label="Tutup pratinjau">&times;</button></div>
    <div class="evidence-preview-tabs" role="tablist" aria-label="Tab pratinjau file"><button type="button" class="active" data-preview-tab="preview" role="tab">👁 Pratinjau</button><button type="button" data-preview-tab="details" role="tab">ℹ️ Detail File</button></div>
    <div id="evidencePreviewBody" class="evidence-preview-body"></div>
    <div class="sheet-links-footer"><span class="evidence-preview-security-note">Pratinjau dilakukan lewat akses terotorisasi. File aktif tidak dieksekusi di dalam website.</span><button type="button" id="evidencePreviewCloseFooter">Tutup</button></div>
  </div>
</div>
'''
if '</body>' not in html: raise SystemExit('body close not found')
html=html.replace('</body>',modal+'\n</body>',1)
p.write_text(html)
print('Patched index modal')
