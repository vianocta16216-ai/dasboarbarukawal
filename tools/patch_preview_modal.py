from pathlib import Path
p=Path('/mnt/data/kawal_work_next/public/index.html');s=p.read_text()
modal='''
<!-- ===== PREVIEW EVIDENCE FILE AMAN DI BROWSER ===== -->
<div class="sheet-links-overlay evidence-preview-overlay" id="evidencePreviewModal" role="dialog" aria-modal="true" aria-labelledby="evidencePreviewTitle">
  <div class="sheet-links-modal evidence-preview-modal">
    <div class="sheet-links-header"><h3 id="evidencePreviewTitle">Pratinjau File Evidence</h3><button class="sheet-links-close" id="evidencePreviewClose" aria-label="Tutup pratinjau">&times;</button></div>
    <div class="evidence-preview-tabs" role="tablist" aria-label="Tab pratinjau file"><button type="button" class="active" data-preview-tab="preview" role="tab">👁 Pratinjau</button><button type="button" data-preview-tab="details" role="tab">ℹ️ Detail File</button></div>
    <div id="evidencePreviewBody" class="evidence-preview-body"></div>
    <div class="sheet-links-footer"><span class="evidence-preview-security-note">Pratinjau melalui akses terotorisasi. File aktif tidak dieksekusi di dalam website.</span><button type="button" id="evidencePreviewCloseFooter">Tutup</button></div>
  </div>
</div>
'''
# Put modal before the final inline CSS block (after existing modals).
idx=s.rfind('<style>')
if idx<0: raise SystemExit('inline style tag not found')
s=s[:idx]+modal+'\n'+s[idx:]
css='''
.evidence-preview-modal{width:min(1100px,96vw);max-width:1100px!important;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;}
.evidence-preview-tabs{display:flex;gap:7px;padding:10px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc;}
.evidence-preview-tabs button{border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;font-weight:700;padding:8px 13px;cursor:pointer;}
.evidence-preview-tabs button.active{background:#1d4ed8;border-color:#1d4ed8;color:#fff;}
.evidence-preview-body{min-height:300px;height:min(68vh,760px);overflow:auto;background:#f1f5f9;padding:12px;}
.evidence-preview-frame{width:100%;height:100%;min-height:420px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;}
.evidence-preview-image-wrap{display:flex;justify-content:center;align-items:center;min-height:100%;}
.evidence-preview-image{max-width:100%;max-height:65vh;object-fit:contain;background:#fff;box-shadow:0 2px 12px #0f172a1c;border-radius:5px;}
.evidence-preview-media{display:block;max-width:100%;max-height:100%;margin:auto;background:#0f172a;border-radius:8px;}
.evidence-preview-audio{display:block;width:min(650px,100%);margin:40px auto;}
.evidence-preview-text{white-space:pre-wrap;overflow-wrap:anywhere;background:#fff;padding:16px;border:1px solid #cbd5e1;border-radius:8px;max-height:100%;overflow:auto;}
.preview-file-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:250px;background:#fff;border:1px dashed #cbd5e1;border-radius:10px;padding:24px;text-align:center;color:#475569;}
.preview-file-placeholder.is-error{border-color:#fca5a5;color:#991b1b;}
.preview-external-notice{padding:9px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;color:#78350f;font-size:12px;margin-bottom:9px;}
.preview-external-notice p{margin:4px 0 0;}
.preview-file-details{display:grid;grid-template-columns:150px 1fr;gap:10px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;margin:0;}
.preview-file-details dt{font-weight:800;color:#334155;}.preview-file-details dd{margin:0;overflow-wrap:anywhere;color:#475569;}
.evidence-preview-security-note{font-size:11px;color:#64748b;margin-right:auto;}
.file-name-preview{border:0;background:transparent;color:#1d4ed8;font-weight:700;text-align:left;text-decoration:underline;cursor:pointer;padding:4px 0;overflow-wrap:anywhere;}
.evidence-preview-btn{white-space:nowrap;}
.wb-verification-readonly{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0;font-size:12px;color:#64748b;}
.wb-action-preview{font-size:11px!important;padding:6px 9px!important;}
@media(max-width:720px){.evidence-preview-modal{width:100vw;max-height:96vh;border-radius:0;}.evidence-preview-body{height:65vh;padding:6px;}.evidence-preview-frame{min-height:350px;}.preview-file-details{grid-template-columns:1fr;gap:4px;}.preview-file-details dd{margin-bottom:8px;}}
'''
# Add inside final inline stylesheet immediately before its closing tag
close=s.rfind('</style>')
if close<0: raise SystemExit('inline style close not found')
s=s[:close]+css+'\n'+s[close:]
p.write_text(s)
print('Added preview modal and CSS')
