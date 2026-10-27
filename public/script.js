// ====== STATUS GLOBAL ======
let rows = [];
let currentYear = new Date().getFullYear().toString();
let currentUser = null;
let appInitializedAfterAuth = false;
let dashboardMode = 'internal';
let bpkpOfficialScore = null;
let bpkpScoreLoadedAt = 0;
let bpkpScoreLoadedYear = '';
let SUBUNSUR_DATA = {};
let PARAM_LIST = [];
let saveTimer = null;


// ====== REALTIME MULTI-USER ======
let realtimeSocket = null;
let realtimeReconnectTimer = null;
let realtimeReconnectAttempt = 0;
let realtimeRefreshTimer = null;
let realtimeRefreshPending = false;
let realtimeHeartbeatTimer = null;
let realtimeConnectingYear = null;

function isEditingFormField() {
  const el = document.activeElement;
  return !!(el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

function ensureRealtimeBadge() {
  let badge = document.getElementById('realtimeStatusBadge');
  if (badge) return badge;
  badge = document.createElement('div');
  badge.id = 'realtimeStatusBadge';
  badge.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.96);box-shadow:0 4px 16px rgba(15,23,42,.14);font:600 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;color:#475569;border:1px solid #e2e8f0;pointer-events:none;transition:opacity .2s ease;';
  document.body.appendChild(badge);
  return badge;
}

function setRealtimeBadge(text, state='idle') {
  const badge = ensureRealtimeBadge();
  badge.textContent = text;
  badge.dataset.state = state;
  badge.style.color = state === 'online' ? '#166534' : state === 'error' ? '#b91c1c' : '#475569';
  badge.style.borderColor = state === 'online' ? '#bbf7d0' : state === 'error' ? '#fecaca' : '#e2e8f0';
}

function scheduleRealtimeRefresh(reason='Pembaruan operator lain') {
  realtimeRefreshPending = true;
  if (isEditingFormField() || isEditModalOpen() || isSaving) {
    setRealtimeBadge('🔄 Perubahan lain menunggu', 'idle');
    return;
  }
  clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer = setTimeout(async () => {
    if (isEditingFormField() || isEditModalOpen() || isSaving) return;
    realtimeRefreshPending = false;
    try {
      await loadData();
      setRealtimeBadge('🟢 Realtime aktif (cakupan akun diterapkan server)', 'online');
    } catch (e) {
      setRealtimeBadge('🟠 Realtime menunggu sinkron', 'error');
    }
  }, 250);
}

function closeRealtimeSocket() {
  clearTimeout(realtimeReconnectTimer);
  clearInterval(realtimeHeartbeatTimer);
  realtimeReconnectTimer = null;
  realtimeHeartbeatTimer = null;
  if (realtimeSocket) {
    try { realtimeSocket.close(1000, 'change-year'); } catch {}
  }
  realtimeSocket = null;
}

function connectRealtime() {
  if (!currentUser) { closeRealtimeSocket(); setRealtimeBadge('Realtime menunggu login', 'idle'); return; }
  // Pages Function authenticates the socket and the Durable Object filters each
  // event by OPD scope. Scoped users can therefore receive safe realtime updates.
  const year = String(currentYear || document.getElementById('yearSelect')?.value || new Date().getFullYear());
  if (!year || typeof WebSocket === 'undefined') return;
  if (realtimeSocket && realtimeConnectingYear === year && [WebSocket.OPEN, WebSocket.CONNECTING].includes(realtimeSocket.readyState)) return;

  closeRealtimeSocket();
  realtimeConnectingYear = year;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}/realtime?year=${encodeURIComponent(year)}`;
  setRealtimeBadge('🟡 Menghubungkan realtime…', 'idle');

  let ws;
  try { ws = new WebSocket(wsUrl); } catch (err) {
    setRealtimeBadge('🟠 Realtime menunggu koneksi', 'error');
    scheduleRealtimeReconnect();
    return;
  }
  realtimeSocket = ws;

  ws.addEventListener('open', () => {
    realtimeReconnectAttempt = 0;
    setRealtimeBadge('🟢 Realtime aktif (cakupan akun diterapkan server)', 'online');
    clearInterval(realtimeHeartbeatTimer);
    realtimeHeartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
      }
    }, 25000);
  });

  ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'connected' || msg.type === 'pong') return;
      if (msg.type === 'data-changed' && String(msg.year) === String(currentYear)) {
        // The server filters every event by the session's OPD scope before it reaches
        // this handler; reload the selected year for durable consistency.
        // QA APIP is stored in a sparse table. Update only its OPD summary so a QA
        // edit from another user does not force all viewers to reload the full dataset.
        if ((msg.action === 'saveQaApipChecklistItem' || msg.action === 'deleteQaApipChecklistItem' || msg.action === 'saveQaApipItem' || msg.action === 'deleteQaApipItem') && msg.opdId && msg.summary) {
          const row = rows.find(r => String(r.id) === String(msg.opdId));
          if (row) {
            row.qaApipSummary = msg.summary;
            row.qaApip = msg.summary.status || row.qaApip || 'Belum';
            updateQaApipTableSummary(row, msg.summary);
            updateKpisLocal();
          }
          if (msg.action === 'saveQaApipItem' || msg.action === 'deleteQaApipItem') qaApipSyncActiveItem(msg);
          setRealtimeBadge('🟢 QA APIP tersinkron', 'online');
          return;
        }
        if ((msg.action === 'saveKkPmItem' || msg.action === 'deleteKkPmItem') && msg.opdId && msg.summary) {
          const row = rows.find(r => String(r.id) === String(msg.opdId));
          if (row) { row.kkPmSummary = msg.summary; updateKkPmTableSummary(row, msg.summary); updateKpisLocal(); }
          setRealtimeBadge('🟢 KK PM SPIP tersinkron', 'online');
          return;
        }
        if (['savePemdaSampling','savePemdaVerification','createPemdaKkPmWorkbook','updateKkPmTemplateConfig','uploadPemdaWorkbookEvidence','deletePemdaWorkbookEvidence','savePemdaWorkbookEvidenceVerification','retryDriveBackup'].includes(msg.action)) {
          if (document.getElementById('pemdaWorkflowModal')?.classList.contains('active') && !isEditingFormField()) loadPemdaWorkflow(false).catch(()=>{});
          if (document.getElementById('pemdaPmDashboardModal')?.classList.contains('active') && !isEditingFormField()) loadPemdaPmDashboard(false).catch(()=>{});
          setRealtimeBadge('🟢 Alur verifikasi Pemda tersinkron', 'online');
          return;
        }
        if (msg.action === 'uploadWorkbookEvidence' || msg.action === 'deleteWorkbookEvidence' || msg.action === 'saveWorkbookEvidenceVerification' || msg.action === 'replaceWorkbookEvidenceFile' || msg.action === 'retryDriveBackup') {
          scheduleRealtimeRefresh('Evidence workbook diperbarui operator lain');
          if (msg.opdId && typeof qaApipCurrentRow !== 'undefined' && qaApipCurrentRow && String(qaApipCurrentRow.id) === String(msg.opdId) && document.getElementById('qaApipModal')?.classList.contains('active')) {
            refreshQaApipEvidenceFiles(true);
          }
          return;
        }
        scheduleRealtimeRefresh('Perubahan dari operator lain');
      }
    } catch {}
  });

  ws.addEventListener('error', () => {
    setRealtimeBadge('🟠 Realtime terputus sementara', 'error');
  });

  ws.addEventListener('close', () => {
    clearInterval(realtimeHeartbeatTimer);
    realtimeHeartbeatTimer = null;
    if (realtimeSocket === ws) realtimeSocket = null;
    scheduleRealtimeReconnect();
  });
}

function scheduleRealtimeReconnect() {
  clearTimeout(realtimeReconnectTimer);
  const delay = Math.min(15000, 1000 * (2 ** Math.min(realtimeReconnectAttempt++, 4))) + Math.floor(Math.random() * 400);
  realtimeReconnectTimer = setTimeout(() => connectRealtime(), delay);
}

window.addEventListener('online', () => {
  flushOfflineSaves();
  retryIndexedDbUploads();
  connectRealtime();
});
window.addEventListener('offline', () => setRealtimeBadge('📴 Offline — realtime menunggu', 'error'));
document.addEventListener('focusout', () => {
  if (realtimeRefreshPending && !isEditingFormField() && !isSaving) scheduleRealtimeRefresh();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    connectRealtime();
    if (realtimeRefreshPending && !isEditingFormField() && !isSaving) scheduleRealtimeRefresh();
  }
});


// ====== AUTOSAVE OFFLINE / KONEKSI LAMBAT ======
// Perubahan disimpan ke browser terlebih dahulu saat server tidak dapat dihubungi.
// Antrian ini kemudian dikirim ulang otomatis ketika koneksi kembali normal.
const OFFLINE_QUEUE_KEY = 'kawal-spip-offline-save-v1';
const MODAL_DRAFT_KEY = 'kawal-spip-modal-draft-v2';
let modalDraftTimer = null;

function isEditModalOpen() {
  const el = document.getElementById('editModal');
  return !!(el && el.classList.contains('active'));
}

function readModalDraft() {
  try {
    const raw = localStorage.getItem(MODAL_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.year && d.opdId ? d : null;
  } catch { return null; }
}

function getModalFieldValueFromSnapshot(subCode,paramId,field) {
  const v = editingSubunsurSnapshot?.[subCode]?.[paramId]?.[field];
  return field === 'level' ? String(Number(v ?? 0) || 0) : String(v ?? '');
}

function writeModalDraftNow() {
  if (!editingRowId || !isEditModalOpen()) return;
  try {
    const draft = { year:String(currentYear), opdId:String(editingRowId), savedAt:Date.now(), fields:[] };
    document.querySelectorAll('#subunsurContainer select[data-sub], #subunsurContainer textarea[data-sub]').forEach(el => {
      const subCode=el.dataset.sub, paramId=el.dataset.param, field=el.dataset.field || 'level';
      const value=String(el.value ?? '');
      const baseValue=getModalFieldValueFromSnapshot(subCode,paramId,field);
      if(value !== baseValue){
        draft.fields.push({ subCode, paramId, field, value, baseValue });
      }
    });
    if (draft.fields.length) {
      localStorage.setItem(MODAL_DRAFT_KEY, JSON.stringify(draft));
    } else {
      localStorage.removeItem(MODAL_DRAFT_KEY);
    }
  } catch(e) {
    console.warn('Draft autosave modal gagal:', e);
  }
}

function scheduleModalDraftSave() {
  clearTimeout(modalDraftTimer);
  modalDraftTimer = setTimeout(writeModalDraftNow, 250);
}

function restoreModalDraft() {
  const d = readModalDraft();
  if (!d || String(d.year)!==String(currentYear) || String(d.opdId)!==String(editingRowId)) return;
  let restored = 0, skipped = 0;
  for (const f of (Array.isArray(d.fields) ? d.fields : [])) {
    const sel = `#subunsurContainer [data-sub="${CSS.escape(String(f.subCode||''))}"][data-param="${CSS.escape(String(f.paramId||''))}"][data-field="${CSS.escape(String(f.field||''))}"]`;
    const el = document.querySelector(sel);
    if (!el) continue;
    const currentServerValue=getModalFieldValueFromSnapshot(String(f.subCode||''),String(f.paramId||''),String(f.field||'level'));
    const baseValue=String(f.baseValue ?? '');
    // A stale draft is never allowed to overwrite a newer server value.
    if(baseValue && currentServerValue !== baseValue){ skipped++; continue; }
    el.value = f.value ?? '';
    restored++;
  }
  if (skipped) {
    clearModalDraft();
  }
  if (restored) {
    const st=document.getElementById('modalSaveStatus');
    if(st){ st.style.display='block'; st.style.color='#b45309'; st.textContent='📦 Draft lokal dipulihkan. Perubahan yang lebih baru dari server tetap dipertahankan.'; }
  }
}

function clearModalDraft() {
  clearTimeout(modalDraftTimer);
  modalDraftTimer = null;
  try { localStorage.removeItem(MODAL_DRAFT_KEY); } catch {}
}

let offlineSaveQueue = [];
let offlineFlushTimer = null;
let offlineFlushRunning = false;

function isNetworkError(err) {
  return !err || err.name === 'TypeError' || /failed to fetch|network|offline|load failed|fetch/i.test(String(err.message || err));
}

function setConnectionStatus(message, type='') {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  el.textContent = message;
  el.dataset.statusType = type;
}

function loadOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    offlineSaveQueue = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Tidak dapat membaca autosave lokal:', e);
    offlineSaveQueue = [];
  }
}

function persistOfflineQueue() {
  try {
    if (offlineSaveQueue.length) {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineSaveQueue));
    } else {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    }
  } catch (e) {
    console.warn('Autosave lokal gagal disimpan:', e);
    setConnectionStatus('⚠️ Penyimpanan lokal browser penuh', 'error');
  }
}

function queueOfflineSave(action, params, reason='Koneksi terputus') {
  const allowed = new Set(['saveData','saveRow','saveSubunsur','saveField']);
  if (!allowed.has(action)) return;

  // Simpan perubahan subunsur satu field per item. Ini mencegah dua perubahan
  // pada parameter yang berbeda saling menggantikan ketika offline.
  if (action === 'saveSubunsur' && Array.isArray(params?.changes) && params.changes.length > 1) {
    for (const change of params.changes) {
      queueOfflineSave('saveSubunsur', { opdId:params.opdId, year:params.year || currentYear, changes:[change] }, reason);
    }
    return;
  }

  const item = { action, params, year: params?.year || currentYear, queuedAt: Date.now(), reason };
  let key = `${action}:${item.year}`;
  if (action === 'saveRow') key += `:${params?.row?.id || ''}`;
  if (action === 'saveSubunsur') {
    const c = params?.changes?.[0] || {};
    key += `:${params?.opdId || ''}:${c.subCode || ''}:${c.paramId || ''}:${c.field || ''}`;
  }
  if (action === 'saveField') key += `:${params?.opdId || ''}:${params?.field || ''}`;
  if (action === 'saveData') key += ':all';

  item.key = key;
  offlineSaveQueue = offlineSaveQueue.filter(x => x.key !== key);
  offlineSaveQueue.push(item);
  persistOfflineQueue();
  setConnectionStatus(`📴 Offline — perubahan disimpan di perangkat (${offlineSaveQueue.length})`, 'offline');
  if (navigator.onLine) scheduleOfflineFlush(1200);
}

function applyOfflineQueueToRows() {
  if (!Array.isArray(rows) || !offlineSaveQueue.length) return;

  // Urutan mengikuti waktu antrian.
  [...offlineSaveQueue].sort((a,b) => a.queuedAt - b.queuedAt).forEach(item => {
    const p = item.params || {};
    if (item.action === 'saveData') {
      // Never replace the entire current `rows` array from an offline snapshot.
      // Merge only scalar/top-level values by OPD id so nested evidence cannot jump
      // between OPDs/columns when an old browser reconnects.
      try {
        const savedRows = typeof p.rows === 'string' ? JSON.parse(p.rows) : p.rows;
        if (Array.isArray(savedRows) && String(item.year) === String(currentYear)) {
          savedRows.forEach(sr => {
            if (!sr?.id) return;
            const row = rows.find(r => r.id === sr.id);
            if (!row) return;
            for (const field of ['opd','evidence','qaApip','rtp','status']) {
              if (Object.prototype.hasOwnProperty.call(sr, field)) row[field] = sr[field];
            }
          });
        }
      } catch {}
      return;
    }

    if (String(item.year) !== String(currentYear)) return;

    if (item.action === 'saveRow' && p.row?.id) {
      const idx = rows.findIndex(r => r.id === p.row.id);
      if (idx >= 0) rows[idx] = p.row;
      else rows.push(p.row);
    }

    if (item.action === 'saveSubunsur' && p.opdId) {
      const row = rows.find(r => r.id === p.opdId);
      if (row && Array.isArray(p.changes)) {
        p.changes.forEach(c => {
          if (!c?.subCode || !c?.paramId || !c?.field) return;
          row.subunsurs = row.subunsurs || {};
          row.subunsurs[c.subCode] = row.subunsurs[c.subCode] || {};
          row.subunsurs[c.subCode][c.paramId] = row.subunsurs[c.subCode][c.paramId] || {level:0};
          row.subunsurs[c.subCode][c.paramId][c.field] = c.value;
          if (c.field === 'level') {
            row.parameterLevels = row.parameterLevels || {};
            row.parameterLevels[`${c.subCode}|${c.paramId}`] = Math.max(0,Math.min(5,Number(c.value)||0));
          }
        });
        if(p.structureProcessBreakdown?.source==='verified_evidence_only')row.structureProcessBreakdown=p.structureProcessBreakdown;
        if(p.nilaiStrukturProses!=null){row.nilaiStrukturProses=Number(p.nilaiStrukturProses)||0;row.sa=row.nilaiStrukturProses;}
        else {row.nilaiStrukturProses=calculateSA(row);row.sa=row.nilaiStrukturProses;}
      } else if (row && p.subunsurs) {
        row.subunsurs = p.subunsurs;
        if(p.structureProcessBreakdown?.source==='verified_evidence_only')row.structureProcessBreakdown=p.structureProcessBreakdown;
        if(p.nilaiStrukturProses!=null){row.nilaiStrukturProses=Number(p.nilaiStrukturProses)||0;row.sa=row.nilaiStrukturProses;}
        else {row.nilaiStrukturProses=calculateSA(row);row.sa=row.nilaiStrukturProses;}
      }
    }

    if (item.action === 'saveField' && p.opdId && p.field) {
      const row = rows.find(r => r.id === p.opdId);
      if (row) row[p.field] = p.value;
    }
  });
}

function scheduleOfflineFlush(delay=300) {
  clearTimeout(offlineFlushTimer);
  offlineFlushTimer = setTimeout(flushOfflineSaves, delay);
}

async function flushOfflineSaves() {
  if (offlineFlushRunning || !offlineSaveQueue.length || !navigator.onLine) return;
  offlineFlushRunning = true;
  setConnectionStatus(`🔄 Mengirim ${offlineSaveQueue.length} perubahan tersimpan...`, 'syncing');

  try {
    while (offlineSaveQueue.length && navigator.onLine) {
      const item = offlineSaveQueue[0];
      try {
        await callServerWithRetry(item.action, item.params, 2);
        offlineSaveQueue.shift();
        persistOfflineQueue();
      } catch (err) {
        // Jangan menghapus data lokal jika koneksi masih bermasalah.
        if (isNetworkError(err) || err.transient || !navigator.onLine) {
          setConnectionStatus(`📴 Menunggu koneksi — ${offlineSaveQueue.length} perubahan aman di perangkat`, 'offline');
        } else {
          // Error server non-network tetap ditahan untuk mencegah kehilangan perubahan.
          setConnectionStatus(`⚠️ ${offlineSaveQueue.length} perubahan belum tersimpan ke server`, 'error');
        }
        break;
      }
    }

    if (!offlineSaveQueue.length) {
      setConnectionStatus('✅ Semua perubahan tersimpan', 'success');
      setTimeout(() => {
        const el = document.getElementById('saveStatus');
        if (el && el.dataset.statusType === 'success') el.textContent = '';
      }, 2500);
      render();
      updateKpisLocal();
    }
  } finally {
    offlineFlushRunning = false;
  }
}

function queueCurrentRowsForAutosave(reason='Koneksi terputus') {
  if (!Array.isArray(rows)) return;
  queueOfflineSave('saveData', { rows: JSON.stringify(rows), year: currentYear }, reason);
}

function initOfflineAutosave() {
  loadOfflineQueue();

  window.addEventListener('offline', () => {
    setConnectionStatus('📴 Koneksi terputus — perubahan berikutnya akan disimpan otomatis di perangkat', 'offline');
  });

  window.addEventListener('online', () => {
    setConnectionStatus('🌐 Koneksi kembali — menyinkronkan perubahan...', 'syncing');
    scheduleOfflineFlush(150);
  });

  // Coba sinkronisasi saat tab kembali aktif.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleOfflineFlush(100);
  });

  if (offlineSaveQueue.length) {
    applyOfflineQueueToRows();
    setConnectionStatus(`📴 ${offlineSaveQueue.length} perubahan menunggu sinkronisasi`, 'offline');
    scheduleOfflineFlush(500);
  }

  // Pengaman tambahan: jika server sempat 5xx/429 atau koneksi sangat lambat,
  // antrian akan dicoba lagi berkala tanpa pengguna perlu menekan tombol apa pun.
  setInterval(() => {
    if (navigator.onLine && offlineSaveQueue.length) flushOfflineSaves();
  }, 30000);

  // Drive backup retry: only a few pending files per cycle to avoid creating
  // another traffic spike when many OPD users are online at once.
  setInterval(() => { autoRetryPendingDriveBackups(); retryIndexedDbUploads(); }, 15000);
  window.addEventListener('online', () => setTimeout(() => { autoRetryPendingDriveBackups(); retryIndexedDbUploads(); }, 3000));
  setTimeout(retryIndexedDbUploads, 1500);
}

let isAddingOpd = false;
let isAddingYear = false;
let isDeletingYear = false;
let isCreatingBackup = false;
let isRestoringBackup = false;
let isDeletingFile = false;
let isSaving = false;
let pendingSave = false;
let kkPmDirty = false;
let chartInstance = null;
let originalRows = [];
const pendingUploadFiles = new Map();

// ====== OFFLINE FILE QUEUE (IndexedDB) ======
const OFFLINE_FILE_DB = 'kawal-spip-offline-files-v1';
const OFFLINE_FILE_STORE = 'uploads';
let offlineFileDbPromise = null;
function openOfflineFileDb(){
  if(offlineFileDbPromise) return offlineFileDbPromise;
  offlineFileDbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){ reject(new Error('IndexedDB tidak tersedia')); return; }
    const req=indexedDB.open(OFFLINE_FILE_DB,1);
    req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains(OFFLINE_FILE_STORE)) db.createObjectStore(OFFLINE_FILE_STORE,{keyPath:'uploadId'}); };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error||new Error('IndexedDB gagal dibuka'));
  });
  return offlineFileDbPromise;
}
async function savePendingUploadToIndexedDB(record){
  try{ const db=await openOfflineFileDb(); await new Promise((resolve,reject)=>{const tx=db.transaction(OFFLINE_FILE_STORE,'readwrite');tx.objectStore(OFFLINE_FILE_STORE).put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);}); return true; }catch(e){ console.warn('Gagal menyimpan file offline:',e); return false; }
}
async function deletePendingUploadFromIndexedDB(uploadId){
  try{ const db=await openOfflineFileDb(); await new Promise((resolve,reject)=>{const tx=db.transaction(OFFLINE_FILE_STORE,'readwrite');tx.objectStore(OFFLINE_FILE_STORE).delete(uploadId);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);}); }catch(e){ console.warn('Gagal menghapus file offline:',e); }
}
async function getPendingUploadsFromIndexedDB(){
  try{ const db=await openOfflineFileDb(); return await new Promise((resolve,reject)=>{const tx=db.transaction(OFFLINE_FILE_STORE,'readonly');const req=tx.objectStore(OFFLINE_FILE_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);}); }catch(e){ console.warn('Gagal membaca file offline:',e); return []; }
}
async function retryIndexedDbUploads(){
  if(!navigator.onLine || !Array.isArray(rows)) return;
  const now=Date.now();
  const pending=await getPendingUploadsFromIndexedDB();
  for(const rec of pending){
    if (Number(rec.nextRetryAt||0) > now) continue;
    const row=rows.find(r=>r.id===rec.opdId); if(!row) continue;
    try{
      if(rec.type==='report'){
        const type=rec.reportType||'pm_spip';
        const result=await uploadReportFileClient(row,type,rec.file,rec.uploadId);
        const list=reportListForRow(row,type);
        const existing=list.find(x=>x&&x.uploadId===rec.uploadId);
        const item={url:result.url||rec.url||'',fileName:result.fileName||rec.fileName,gdriveId:result.gdriveId||null,syncStatus:result.syncStatus||'retrying',syncError:result.syncError||result.driveError||null,r2Key:result.r2Key||rec.r2Key||null,fileType:rec.fileType||rec.file.type||'application/octet-stream',uploadId:rec.uploadId,folderName:result.folderName||REPORT_CONFIG[type].folder,gdriveFolderId:result.gdriveFolderId||null,uploadedAt:rec.createdAt||new Date().toISOString()};
        if(existing)Object.assign(existing,item);else list.push(item);setReportListForRow(row,type,list);
        if(result.gdriveId && result.syncStatus==='done'){pendingUploadFiles.delete(rec.uploadId);await deletePendingUploadFromIndexedDB(rec.uploadId);}else{rec.r2Key=item.r2Key;rec.url=item.url;rec.lastError=result.driveError||rec.lastError||'Menunggu Google Drive';rec.nextRetryAt=Date.now()+15000;await savePendingUploadToIndexedDB(rec);}
        render();
      }else{
        const result=await uploadFile(row,rec.subCode,rec.paramId,rec.level,rec.file,rec.uploadId);
        const container=row.subunsurs=row.subunsurs||{};
        const key='files'+rec.level;
        const fileArray=ensureEvidenceFileArray(container,rec.subCode,rec.paramId,rec.level);
        const existing=fileArray.find(x=>typeof x==='object'&&x.uploadId===rec.uploadId);
        const item={url:result.url||rec.url||'',fileName:result.fileName||rec.fileName,gdriveId:result.gdriveId||null,syncStatus:result.syncStatus||'retrying',syncError:result.driveError||null,r2Key:result.r2Key||rec.r2Key||null,fileType:rec.fileType||rec.file.type||'application/octet-stream',uploadId:rec.uploadId,uploadedAt:rec.createdAt||new Date().toISOString()};
        if(existing) Object.assign(existing,item); else fileArray.push(item);
        if(result.gdriveId && result.syncStatus==='done'){
          pendingUploadFiles.delete(rec.uploadId);
          await deletePendingUploadFromIndexedDB(rec.uploadId);
        }else{
          rec.r2Key=item.r2Key; rec.url=item.url; rec.lastError=result.driveError||rec.lastError||'Menunggu Google Drive'; rec.nextRetryAt=Date.now()+15000;
          await savePendingUploadToIndexedDB(rec);
        }
        renderFileList(row,rec.subCode,rec.paramId,rec.level);
      }
    }catch(e){
      const attempt=Number(rec.retryCount||0)+1;
      rec.retryCount=attempt;
      const delay=Math.min(300000,1500*Math.pow(2,Math.min(attempt,8))) + Math.floor(Math.random()*1000);
      rec.nextRetryAt=Date.now()+delay;
      rec.lastError=e?.message||String(e);
      await savePendingUploadToIndexedDB(rec);
      console.warn('Retry offline file gagal; akan mencoba lagi otomatis:',rec.uploadId,e);
    }
  }
}

// ===== TEMPLATE KERTAS KERJA PM TERINTEGRASI (embedded, no network fetch) =====

// ============================================================
// PERUBAHAN KEAMANAN: TAMBAHKAN FUNGSI ESCAPE HTML
// ============================================================
// ====== VERIFIKASI INSPEKTORAT EVIDENCE ======
// Bobot persentase dibuat eksplisit agar mudah disesuaikan tanpa menyentuh
// alur upload. Diterima = penuh, Diterima dengan Catatan = sebagian,
// Dikembalikan/Belum Diverifikasi = 0.
const VERIFICATION_WEIGHTS = Object.freeze({
  diterima: 1,
  diterima_catatan: 0.75,
  dikembalikan: 0,
  '': 0,
  pending: 0
});
const VERIFICATION_LABELS = Object.freeze({
  diterima: 'Diterima',
  diterima_catatan: 'Diterima dengan Catatan',
  dikembalikan: 'Dikembalikan',
  '': 'Belum Diverifikasi',
  pending: 'Belum Diverifikasi'
});

function normalizeVerification(raw) {
  const v = raw && typeof raw === 'object' ? raw : {};
  // Evidence workbook stores its status at verificationStatus, while legacy/RTP
  // evidence stores it inside verification.status. Accept both formats.
  const rawStatus = v.status ?? v.verificationStatus ?? v.verification_status ?? '';
  const status = Object.prototype.hasOwnProperty.call(VERIFICATION_LABELS, String(rawStatus || '')) ? String(rawStatus || '') : '';
  return {
    examinerName: String(v.examinerName || v.namaPemeriksa || v.verificationExaminer || v.verification_examiner || '').trim(),
    note: String(v.note || v.catatanPemeriksa || v.verificationNote || v.verification_note || '').trim(),
    status,
    verifiedAt: v.verifiedAt || v.verificationAt || v.verification_at || null,
    updatedAt: v.updatedAt || v.updated_at || null
  };
}

// Count actual file records only. Empty objects/status-only placeholders must not
// inflate the dashboard denominator. Older records with a URL or filename remain valid.
function isUploadedDocumentRecord(file) {
  if (typeof file === 'string') return file.trim().length > 0;
  if (!file || typeof file !== 'object' || Array.isArray(file)) return false;
  const identityFields = ['uploadId','upload_id','url','fileUrl','file_url','r2Key','r2_key','gdriveId','gdrive_id','filePath','file_path','path'];
  if (identityFields.some(key => String(file[key] || '').trim() && String(file[key]).trim() !== '#')) return true;
  const name = String(file.fileName || file.file_name || file.name || '').trim();
  return Boolean(name && !/^file$/i.test(name));
}

function verificationStatusLabel(status) {
  return VERIFICATION_LABELS[String(status || '')] || VERIFICATION_LABELS[''];
}
function verificationStatusClass(status) {
  return ['diterima','diterima_catatan','dikembalikan'].includes(String(status || '')) ? String(status) : 'pending';
}
function verificationScoreFromStatus(status) {
  return Math.round((Number(VERIFICATION_WEIGHTS[String(status || '')] || 0)) * 100);
}

function getVerificationScore(file) {
  const v = normalizeVerification(file?.verification || file);
  return verificationScoreFromStatus(v.status);
}

function getFileVerificationSummary(files) {
  const arr = Array.isArray(files) ? files.filter(isUploadedDocumentRecord) : [];
  const summary = {
    total: arr.length,
    verified: 0,
    accepted: 0,
    withNotes: 0,
    returned: 0,
    percentage: 0,
    progress: 0
  };
  if (!arr.length) return summary;
  let scoreSum = 0;
  arr.forEach(file => {
    const v = normalizeVerification(file?.verification || file);
    const status = v.status;
    const verified = ['diterima','diterima_catatan','dikembalikan'].includes(status);
    if (verified) summary.verified++;
    if (status === 'diterima') summary.accepted++;
    else if (status === 'diterima_catatan') summary.withNotes++;
    else if (status === 'dikembalikan') summary.returned++;
    scoreSum += getVerificationScore(file);
  });
  summary.percentage = Math.round((scoreSum / arr.length) * 100) / 100;
  summary.progress = Math.round((summary.verified / arr.length) * 10000) / 100;
  return summary;
}

function getAllStructureEvidenceFiles(row) {
  const out = [];
  const source = row?.subunsurs || {};
  const subs = Object.keys(SUBUNSUR_DATA || {});
  const paramSource = PARAM_LIST.length ? PARAM_LIST : subs.flatMap(subCode =>
    (SUBUNSUR_DATA[subCode]?.params || []).map(param => ({subCode, paramId:String(param.id)}))
  );
  paramSource.forEach(param => {
    const item = source?.[param.subCode]?.[param.paramId];
    for (let lv = 1; lv <= 5; lv++) {
      const files = item?.['files' + lv];
      if (Array.isArray(files)) out.push(...files);
      else if (typeof files === 'string') {
        try { const parsed = JSON.parse(files); if (Array.isArray(parsed)) out.push(...parsed); } catch (_) {}
      }
    }
  });
  return out;
}

function getRowStructureVerificationSummary(row) {
  return getFileVerificationSummary(getAllStructureEvidenceFiles(row));
}

function getRtpEvidenceVerificationSummary(row) {
  return getFileVerificationSummary(Array.isArray(row?.rtpEvidence) ? row.rtpEvidence : []);
}

// Ringkasan KPI dokumen verifikasi: seluruh evidence yang memang memiliki
// mekanisme verifikasi Inspektorat (Evidence Struktur & Proses + Evidence RTP).
// Persentase dihitung berdasarkan JUMLAH DOKUMEN, bukan rata-rata persentase OPD:
// dokumen terverifikasi / seluruh dokumen yang di-upload x 100.
function getRowDocumentVerificationSummary(row) {
  // Dashboard aggregate is based on uploaded workbook files registered by the
  // server, plus real Evidence RTP file records. Legacy parameter placeholders
  // and empty JSON objects are excluded from the denominator.
  const workbookSummary = row?.workbookEvidenceSummary || {};
  const structureTotal = Math.max(0, Number(workbookSummary.totalFiles) || 0);
  const structureReviewedRaw = Number(workbookSummary.reviewedFiles ?? workbookSummary.verifiedFiles) || 0;
  const structureReviewed = Math.min(structureTotal, Math.max(0, structureReviewedRaw));
  const rtpFiles = Array.isArray(row?.rtpEvidence) ? row.rtpEvidence : [];
  const rtpSummary = getFileVerificationSummary(rtpFiles);
  const total = structureTotal + rtpSummary.total;
  const verified = structureReviewed + rtpSummary.verified;
  const accepted = Math.min(structureTotal, Number(workbookSummary.verifiedFiles) || 0) + rtpSummary.accepted;
  const withNotes = Math.min(structureTotal, Number(workbookSummary.withNotesFiles) || 0) + rtpSummary.withNotes;
  const returned = Math.min(structureTotal, Number(workbookSummary.returnedFiles) || 0) + rtpSummary.returned;
  const summary = {
    total, verified, accepted, withNotes, returned,
    structureTotal, structureReviewed,
    rtpTotal: rtpSummary.total, rtpReviewed: rtpSummary.verified,
    percentage: total ? Math.round((verified / total) * 10000) / 100 : 0,
    progress: total ? Math.round((verified / total) * 10000) / 100 : 0
  };
  return {
    ...summary,
    documentPercentage: total ? Math.round((verified / total) * 10000) / 100 : 0
  };
}

function verificationStatusOptions(current='') {
  return `<option value="" style="background:#f8fafc;color:#475569" ${current === '' ? 'selected' : ''}>Belum Diverifikasi · 0%</option>
    <option value="diterima" style="background:#f0fdf4;color:#166534" ${current === 'diterima' ? 'selected' : ''}>Diterima · 100%</option>
    <option value="diterima_catatan" style="background:#fffbeb;color:#92400e" ${current === 'diterima_catatan' ? 'selected' : ''}>Diterima dengan Catatan · 75%</option>
    <option value="dikembalikan" style="background:#fff7f7;color:#b91c1c" ${current === 'dikembalikan' ? 'selected' : ''}>Dikembalikan · 0%</option>`;
}

function formatVerificationDate(value) {
  if (!value) return '';
  try { return new Date(value).toLocaleString('id-ID', { dateStyle:'medium', timeStyle:'short' }); }
  catch (_) { return String(value); }
}

function updateStructureVerificationTableSummary(row) {
  if (!row) return;
  const summary = getRowStructureVerificationSummary(row);
  const el = document.querySelector(`.structure-evidence-summary[data-id="${CSS.escape(String(row.id))}"]`);
  if (el) {
    el.innerHTML = `${summary.percentage.toFixed(0)}%<small>${summary.total} file</small>`;
    el.title = `Persentase verifikasi evidence: ${summary.percentage.toFixed(2)}%. Diterima ${summary.accepted}, catatan ${summary.withNotes}, dikembalikan ${summary.returned}.`;
  }
}

function updateRtpVerificationTableSummary(row) {
  if (!row) return;
  const summary = getRtpEvidenceVerificationSummary(row);
  const el = document.querySelector(`.rtp-evidence-summary[data-id="${CSS.escape(String(row.id))}"]`);
  if (el) {
    el.innerHTML = `${summary.percentage.toFixed(0)}%<small>${summary.total} file</small>`;
    el.title = `Persentase verifikasi Evidence RTP: ${summary.percentage.toFixed(2)}%. Diterima ${summary.accepted}, catatan ${summary.withNotes}, dikembalikan ${summary.returned}.`;
  }
}

async function saveEvidenceVerification(row, subCode, paramId, level, uploadId, controls) {
  if (!row || !uploadId) throw new Error('Identitas file verifikasi tidak ditemukan.');
  const examinerName = String(controls?.name?.value || '').trim();
  const note = String(controls?.note?.value || '').trim();
  const status = String(controls?.status?.value || '');
  if (!status) throw new Error('Pilih hasil verifikasi terlebih dahulu.');
  if (!examinerName) throw new Error('Nama pemeriksa wajib diisi.');
  if ((status === 'diterima_catatan' || status === 'dikembalikan') && !note) {
    throw new Error('Catatan pemeriksa wajib diisi untuk status ini.');
  }
  const saveBtn = controls?.button;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Menyimpan...'; }
  try {
    const d = await callServerWithRetry('saveEvidenceVerification', {
      opdId: row.id, year: currentYear, subunsur: subCode, paramId, level, uploadId,
      examinerName, note, status
    }, 3);
    const item = row.subunsurs?.[subCode]?.[paramId]?.['files' + level];
    const fileObj = Array.isArray(item) ? item.find(x => x && typeof x === 'object' && x.uploadId === uploadId) : null;
    if (fileObj) fileObj.verification = d.verification || { examinerName, note, status, verifiedAt: new Date().toISOString() };
    if(d?.structureProcessBreakdown?.source==='verified_evidence_only'){
      row.structureProcessBreakdown=d.structureProcessBreakdown;
      row.nilaiStrukturProses=Number(d.nilaiStrukturProses)||0;row.sa=row.nilaiStrukturProses;
      row.strukturProsesStatus=d.strukturProsesStatus||row.strukturProsesStatus;
    }
    renderFileList(row, subCode, paramId, level);
    const rowSummary = getRowStructureVerificationSummary(row);
    row.structureVerificationSummary = rowSummary;
    updateStructureVerificationTableSummary(row);
    render();
    return d;
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Simpan Verifikasi'; }
  }
}

async function saveRtpEvidenceVerification(row, uploadId, controls) {
  if (!row || !uploadId) throw new Error('Identitas file verifikasi tidak ditemukan.');
  const examinerName = String(controls?.name?.value || '').trim();
  const note = String(controls?.note?.value || '').trim();
  const status = String(controls?.status?.value || '');
  if (!status) throw new Error('Pilih hasil verifikasi terlebih dahulu.');
  if (!examinerName) throw new Error('Nama pemeriksa wajib diisi.');
  if ((status === 'diterima_catatan' || status === 'dikembalikan') && !note) {
    throw new Error('Catatan pemeriksa wajib diisi untuk status ini.');
  }
  const saveBtn = controls?.button;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Menyimpan...'; }
  try {
    const d = await callServerWithRetry('saveRtpEvidenceVerification', {
      opdId: row.id, year: currentYear, uploadId, examinerName, note, status
    }, 3);
    const fileObj = (row.rtpEvidence || []).find(x => x && typeof x === 'object' && x.uploadId === uploadId);
    if (fileObj) fileObj.verification = d.verification || { examinerName, note, status, verifiedAt: new Date().toISOString() };
    renderRtpEvidenceList(row);
    updateRtpVerificationTableSummary(row);
    render();
    return d;
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Simpan Verifikasi'; }
  }
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ====== PANGGIL SERVER ======
// PERUBAHAN KEAMANAN: GANTI VERSI SEBELUMNYA DENGAN VERSI AMAN INI
function callServer(action, params = {}) {
  const functionUrl='/myCloudinaryHandler';
  const readOnlyActions=new Set(['getYears','getData','getSubunsurData','getKkSheets','getRtpKkSheets','getRtpEvidence','getReportFiles','listBackups','getPemdaWorkflow','getPemdaWorkflowAudit','getPemdaKkPmWorkbook']);
  const isForm=params instanceof FormData;
  const isBinary=params && params.__binaryFile instanceof File;
  const cleanParams=isBinary ? Object.fromEntries(Object.entries(params).filter(([k])=>k!=='__binaryFile')) : params;
  const method=(isForm||isBinary)?'POST':((params.fileData||params.rows||!readOnlyActions.has(action))?'POST':'GET');
  const makeRequest=()=>{
    if(method==='POST'){
      if(isBinary){
        const query=new URLSearchParams({action,...cleanParams}).toString();
        return fetch(`${functionUrl}?${query}`,{method:'POST',headers:{'Content-Type':params.__binaryFile.type||'application/octet-stream','X-Upload-Id':params.uploadId||'','X-File-Name':params.fileName||params.__binaryFile.name||'evidence'},body:params.__binaryFile});
      }
      return fetch(functionUrl,{method:'POST',headers:isForm?{}:{'Content-Type':'application/json'},body:isForm?params:JSON.stringify({action,...params})});
    }
    const queryParams = new URLSearchParams({action,...params});
    // getData/getSubunsurData must always be authoritative; never allow an old
    // browser/CDN cache to put a previous 0/default value back into the UI.
    queryParams.set('_ts', String(Date.now()));
    const query=queryParams.toString();
    return fetch(`${functionUrl}?${query}`,{method:'GET', cache:'no-store', headers:{'Cache-Control':'no-cache'}});
  };
  return makeRequest().then(async response=>{
    const text=await response.text();
    let data=null;
    try{data=JSON.parse(text);}catch{}
    if(!response.ok){
      const msg=(data&&data.message)||text.slice(0,200)||`HTTP ${response.status}`;
      const err=new Error(`HTTP ${response.status}: ${msg}`);
      err.status=response.status;
      err.transient=[408,425,429,500,502,503,504].includes(response.status) || (action==='createKkPmSheets' && data?.code==='WORKBOOK_SYNC_IN_PROGRESS');
      err.data=data;
      throw err;
    }
    if(!data)throw new Error('Server error: '+text.substring(0,200));
    if(data&&data.status==='error'){
      const err=new Error(data.message||'Server error');
      err.status=response.status;
      err.data=data;
      throw err;
    }
    return data;
  });
}


async function callServerWithRetry(action, params={}, retries=2){
  let lastError;
  for(let attempt=0;attempt<=retries;attempt++){
    try{return await callServer(action,params);}catch(err){
      lastError=err;
      if(!err.transient || attempt===retries)throw err;
      const lockRetryMs=err?.data?.code==='WORKBOOK_SYNC_IN_PROGRESS'?Math.min(5000,Math.max(1000,Number(err.data.retryAfterSeconds||3)*1000)):0;
      const retryDelay=lockRetryMs|| (500*Math.pow(2,attempt)+Math.floor(Math.random()*250));
      await new Promise(r=>setTimeout(r,retryDelay));
    }
  }
  throw lastError;
}


// ====== VERIFIKASI PASSWORD ======
async function verifyAccess(password) {
  try {
    const result = await callServer('verifyAccess', { password });
    return result.status === 'success';
  } catch (e) {
    console.error(e);
    return false;
  }
}

async function verifyDelete(password) {
  try {
    const result = await callServer('verifyDelete', { password });
    return result.status === 'success';
  } catch (e) {
    console.error(e);
    return false;
  }
}

// ====== NAVIGASI VIEW ======
let opdUnlocked = false;

function showDashboard() {
  document.getElementById('dashboardView').classList.remove('hidden');
  document.getElementById('opdListView').classList.add('hidden');
  document.getElementById('btnDashboardNav').style.display = 'none';
  document.getElementById('btnOpdListNav').style.display = 'inline-block';
  document.getElementById('btnAdd').style.display = 'none';
  document.getElementById('btnBackup').style.display = 'none';
  document.getElementById('btnClear').style.display = 'none';
  document.getElementById('btnDeleteYear').style.display = 'none';
  document.getElementById('btnAddYear').style.display = 'none';
  updateKpisLocal();
}

function showOpdList() {
  if (!opdUnlocked) {
    document.getElementById('opdAccessOverlay').style.display = 'flex';
    return;
  }
  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('opdListView').classList.remove('hidden');
  document.getElementById('btnDashboardNav').style.display = 'inline-block';
  document.getElementById('btnOpdListNav').style.display = 'none';
  const isAdmin=currentUser?.role==='admin';
  ['btnAdd','btnBackup','btnClear','btnDeleteYear','btnAddYear'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display=isAdmin?'inline-block':'none';});
  render();
}

// ====== LOGIN SERVER-SIDE SESUAI ROLE ======
async function finishLogin(user){
  currentUser=user||null;opdUnlocked=!!currentUser;
  const badge=document.getElementById('currentUserLabel');
  if(badge){badge.style.display=currentUser?'inline-block':'none';badge.textContent=currentUser?`${currentUser.displayName||currentUser.username} · ${String(currentUser.role||'').toUpperCase()}`:'';}
  const logout=document.getElementById('btnLogout');if(logout)logout.style.display=currentUser?'inline-block':'none';
  const accountNav=document.getElementById('btnAccountManagementNav');if(accountNav)accountNav.style.display=currentUser?.role==='admin'?'inline-block':'none';
  const pemdaNav=document.getElementById('btnPemdaWorkflow');if(pemdaNav)pemdaNav.style.display=currentUser?'inline-flex':'none';
  const pemdaPmNav=document.getElementById('btnPemdaPmKk');if(pemdaPmNav)pemdaPmNav.style.display=(currentUser&&['admin','irban','auditor','ppupd','bpkp'].includes(String(currentUser.role||'')))?'inline-flex':'none';
  document.getElementById('opdAccessOverlay').style.display='none';
  document.getElementById('loadingOverlay').classList.remove('hidden');
  await initializeAppAfterAuth();
  if(currentUser?.role==='opd'||currentUser?.scoped)showOpdList();else showDashboard();
}
document.getElementById('btnOpdAccess').addEventListener('click', async function() {
  const username=document.getElementById('opdAccessUsername')?.value.trim()||'';
  const password=document.getElementById('opdAccessPassword').value;
  const errorDiv=document.getElementById('opdAccessError');
  const button=this;button.disabled=true;button.textContent='Memeriksa akun…';
  errorDiv.style.display='none';
  try{
    let result;
    if(username){result=await callServer('login',{username,password});}
    else{result=await callServer('login',{username:'',password});}
    if(result?.status==='success'&&result.user){await finishLogin(result.user);}
    else throw new Error(result?.message||'Username atau password tidak sesuai.');
  }catch(err){
    errorDiv.textContent=err.message||'Login gagal.';errorDiv.style.display='block';errorDiv.style.background='#fee2e2';errorDiv.style.color='#dc2626';
  }finally{button.disabled=false;button.textContent='Masuk';}
});
document.getElementById('opdAccessPassword').addEventListener('keyup',(e)=>{if(e.key==='Enter')document.getElementById('btnOpdAccess').click();});
document.getElementById('opdAccessUsername')?.addEventListener('keyup',(e)=>{if(e.key==='Enter')document.getElementById('btnOpdAccess').click();});

// Toggle tampil/sembunyikan password khusus akses Daftar OPD.
const toggleOpdAccessPassword = document.getElementById('toggleOpdAccessPassword');
const opdAccessPasswordInput = document.getElementById('opdAccessPassword');
const toggleOpdAccessPasswordIcon = document.getElementById('toggleOpdAccessPasswordIcon');
if (toggleOpdAccessPassword && opdAccessPasswordInput) {
  toggleOpdAccessPassword.addEventListener('click', function () {
    const showing = opdAccessPasswordInput.type === 'text';
    opdAccessPasswordInput.type = showing ? 'password' : 'text';
    toggleOpdAccessPassword.setAttribute('aria-pressed', String(!showing));
    toggleOpdAccessPassword.setAttribute('aria-label', showing ? 'Tampilkan password' : 'Sembunyikan password');
    if (toggleOpdAccessPasswordIcon) {
      toggleOpdAccessPasswordIcon.innerHTML = showing
        ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><path d="M3 3l18 18"></path>';
    }
    opdAccessPasswordInput.focus();
  });
}
document.getElementById('btnOpdAccessCancel').addEventListener('click', function() {
  const username=document.getElementById('opdAccessUsername');const password=document.getElementById('opdAccessPassword');
  if(username)username.value='';if(password)password.value='';
  const err=document.getElementById('opdAccessError');if(err){err.textContent='';err.style.display='none';}
  document.getElementById('opdAccessOverlay').style.display='flex';
  username?.focus();
});
document.getElementById('btnLogout')?.addEventListener('click',async()=>{
  try{await callServer('logout',{});}catch(e){console.warn('Logout server:',e.message);}
  closeRealtimeSocket();currentUser=null;opdUnlocked=false;appInitializedAfterAuth=false;rows=[];
  const pemdaNav=document.getElementById('btnPemdaWorkflow');if(pemdaNav)pemdaNav.style.display='none';
  const pemdaPmNav=document.getElementById('btnPemdaPmKk');if(pemdaPmNav)pemdaPmNav.style.display='none';
  const accountNav=document.getElementById('btnAccountManagementNav');if(accountNav)accountNav.style.display='none';
  closePemdaPmDashboard();
  const badge=document.getElementById('currentUserLabel');if(badge)badge.style.display='none';
  document.getElementById('btnLogout').style.display='none';
  document.getElementById('loadingOverlay').classList.add('hidden');
  document.getElementById('opdAccessOverlay').style.display='flex';
  document.getElementById('opdAccessPassword').value='';document.getElementById('opdAccessUsername').value='';
});

// ====== LOAD TAHUN ======
async function loadYears() {
  try {
    let years = await callServer('getYears');
    const select = document.getElementById('yearSelect');
    select.innerHTML = '';
    if (!years || years.length === 0) years = [currentYear];
    const calendarYear=String(new Date().getFullYear());
    const uniqueYears = [...new Set([...(Array.isArray(years)?years:[]).map(String),calendarYear])].sort((a,b) => b.localeCompare(a));
    uniqueYears.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      select.appendChild(option);
    });
    // On a fresh calendar year, prefer the current year even before historical rows
    // exist. The backend seeds the year record and getData ensures the default OPD rows.
    if (!uniqueYears.includes(currentYear)) currentYear=calendarYear;
    select.value=currentYear;
  } catch (e) {
    console.error('Gagal memuat tahun:', e);
  }
}

// ====== NILAI WORKBOOK TERHITUNG (READ-ONLY) ======
function computedWorkbookOf(row){
  return (row && row.computedWorkbook && typeof row.computedWorkbook==='object') ? row.computedWorkbook : {};
}
function computedValueOf(row,key){
  const cv=computedWorkbookOf(row).values||{};
  const computedKeys=new Set(['nilaiMaturitas','mri','iepk','nilaiKapabilitasApip']);
  const v=computedKeys.has(key) ? cv[key] : (cv[key] ?? row?.[key]);
  const n=Number(v);
  return Number.isFinite(n)&&n>0?n:null;
}
function computedDisplay(row,key){
  const v=computedValueOf(row,key); return v==null?'—':v.toFixed(2);
}
function computedTitle(row,key){
  const cv=computedWorkbookOf(row); const cell=cv?.cells?.[key] || ({nilaiMaturitas:'KKLEAD_SPIP!I11',mri:'KKLEAD_SPIP!I68',iepk:'KKLEAD_SPIP!I85',nilaiKapabilitasApip:'KKLEAD_SPIP!I106'}[key]||'');
  const source=cv?.source||'formula workbook';
  return (cv?.status==='ok'?`Otomatis dari ${source} · ${cell}`:(cv?.error?`Belum tersinkron: ${cv.error}`:`Belum tersinkron · sumber ${source} · ${cell}`));
}
async function syncKkComputedValues(row, silent=false){
  if(!row?.id)return null;
  try{
    const res=await callServerWithRetry('syncKkComputedValues',{opdId:row.id,year:currentYear},2);
    if(res?.computed){
      const before={nilaiMaturitas:row.nilaiMaturitas,mri:row.mri,iepk:row.iepk,nilaiKapabilitasApip:row.nilaiKapabilitasApip,source:row.computedWorkbook?.source,spreadsheetId:row.computedWorkbook?.spreadsheetId,status:row.computedWorkbook?.status};
      row.computedWorkbook=res.computed;
      const v=res.computed.values||{};
      row.nilaiMaturitas=Number.isFinite(Number(v.nilaiMaturitas))&&Number(v.nilaiMaturitas)>0?Number(v.nilaiMaturitas):null;
      row.mri=Number.isFinite(Number(v.mri))&&Number(v.mri)>0?Number(v.mri):null;
      row.iepk=Number.isFinite(Number(v.iepk))&&Number(v.iepk)>0?Number(v.iepk):null;
      row.nilaiKapabilitasApip=Number.isFinite(Number(v.nilaiKapabilitasApip))&&Number(v.nilaiKapabilitasApip)>0?Number(v.nilaiKapabilitasApip):null;
      const changed=['nilaiMaturitas','mri','iepk','nilaiKapabilitasApip'].some(k=>Number(before[k]??0)!==Number(row[k]??0)) || before.source!==res.computed.source || before.spreadsheetId!==res.computed.spreadsheetId || before.status!==res.computed.status;
      if(changed&&!silent){render();updateKpisLocal();}
      return res.computed;
    }
  }catch(err){ if(!silent) console.warn('Sinkronisasi nilai workbook gagal:',err); }
  return null;
}
let computedSyncBusy=false;
async function backgroundSyncKkComputedValues(){
  if(computedSyncBusy || !Array.isArray(rows) || !rows.length)return;
  computedSyncBusy=true;
  try{
    // Batasi dua OPD sekaligus agar tidak menekan API Google Sheets/Cloudflare saat dashboard besar.
    for(let i=0;i<rows.length;i+=2){
      const chunk=rows.slice(i,i+2).filter(r=>r?.kkPmData?.workbook?.workbookSpreadsheetId || r?.kkPmData?.workbookSpreadsheetId || r?.kkData?.workbookSpreadsheetId || r?.kkData?.spreadsheetId);
      if(!chunk.length)continue;
      const before=chunk.map(r=>({id:r.id,vals:{nilaiMaturitas:r.nilaiMaturitas,mri:r.mri,iepk:r.iepk,nilaiKapabilitasApip:r.nilaiKapabilitasApip},source:r.computedWorkbook?.source,spreadsheetId:r.computedWorkbook?.spreadsheetId,status:r.computedWorkbook?.status}));
      await Promise.all(chunk.map(r=>syncKkComputedValues(r,true)));
      const changed=chunk.some(r=>{const b=before.find(x=>x.id===r.id)||{};return ['nilaiMaturitas','mri','iepk','nilaiKapabilitasApip'].some(k=>Number(b.vals?.[k]??0)!==Number(r[k]??0)) || b.source!==r.computedWorkbook?.source || b.spreadsheetId!==r.computedWorkbook?.spreadsheetId || b.status!==r.computedWorkbook?.status;});
      if(changed){ render(); updateKpisLocal(); }
    }
  }finally{computedSyncBusy=false;}
}

// ====== LOAD DATA ======
async function loadData() {
  const status = document.getElementById('saveStatus');
  status.textContent = '⏳ Memuat data...';
  const previousRows = Array.isArray(rows) ? rows : [];
  const year = document.getElementById('yearSelect').value;
  currentYear = year;
  document.getElementById('currentYearLabel').textContent = year;
  if (realtimeConnectingYear !== String(year)) connectRealtime();
  
  try {
    const data = await callServer('getData', { year });
    rows = [];
    if (Array.isArray(data)) {
      rows = data.map(r => {
        const row = { ...r, nilaiMaturitas:(r.nilaiMaturitas??null), nilaiKapabilitasApip:(r.nilaiKapabilitasApip??null), mri:(r.nilaiMRI??r.mri??null), iepk:(r.nilaiIEPK??r.iepk??null), computedWorkbook:r.computedWorkbook||{}, workbookEvidenceSummary:r.workbookEvidenceSummary||{totalFiles:0,evidenceGroups:0,verifiedFiles:0,reviewedFiles:0,syncedFiles:0}, rtp:r.rtp||'Belum', status:r.status||'Belum', assessmentStatus:r.assessment_status||r.assessmentStatus||'Belum Mengisi', evidence:r.evidence||'Belum', qaApip:r.qaApip||'Belum', kkData:r.kkData||{}, kkRtpData:r.kkRtpData||{}, kkPmData:r.kkPmData||{},kkPmSummary:r.kkPmSummary||{total:183,evaluated:0,na:0,pending:183,sum:0,percentage:0,completion:0,status:'Belum'}, rtpEvidence:Array.isArray(r.rtpEvidence)?r.rtpEvidence:[], rtpEvidenceFolder:r.rtpEvidenceFolder||'Evidence RTP', pmSpipReports:Array.isArray(r.pmSpipReports)?r.pmSpipReports:[], pmSpipFolder:r.pmSpipFolder||'Laporan Hasil PM SPIP', rrRtpReports:Array.isArray(r.rrRtpReports)?r.rrRtpReports:[], rrRtpFolder:r.rrRtpFolder||'Laporan Pemantauan RR_RTP', strukturProsesStatus:r.strukturProsesStatus||'Belum' };
        const bd = getRowStructureProcessBreakdown(row);
        row.nilaiStrukturProses = bd.value;
        row.sa = row.nilaiStrukturProses;
        row.structureProcessBreakdown = getRowStructureProcessBreakdown(row);
        return row;
      });
      rows.sort((a,b)=>{ const x=(Number(computedValueOf(b,'nilaiMaturitas'))||0)-(Number(computedValueOf(a,'nilaiMaturitas'))||0); return x || (parseFloat(b.nilaiStrukturProses)||0)-(parseFloat(a.nilaiStrukturProses)||0); });
      applyOfflineQueueToRows();
    } else {
      console.warn('Data bukan array, rows diset kosong', data);
    }
    originalRows = JSON.parse(JSON.stringify(rows));
    status.textContent = '✅ Data dimuat';
    setTimeout(() => { status.textContent = ''; }, 1500);
    render();
    updateKpisLocal();
    await loadBpkpOfficialScore(true);
    setDashboardMode(dashboardMode);
    backgroundSyncKkComputedValues().catch(()=>{});
  } catch (e) {
    status.textContent = '⚠️ ' + e.message;
    console.error(e);
    // JANGAN pernah mengosongkan UI hanya karena satu request GET gagal.
    // Pertahankan data yang sedang tampil dan overlay-kan antrean offline.
    rows = Array.isArray(previousRows) ? previousRows : [];
    applyOfflineQueueToRows();
    render();
    updateKpisLocal();
  }
}

// ====== FUNGSI: Hitung SA berdasarkan 43 total parameter ======
function getStructureProcessBreakdown(subunsurs) {
  return getRowStructureProcessBreakdown({subunsurs:subunsurs||{}});
}

// Nilai Struktur dan Proses memakai 43 parameter master sebagai denominator;
// hanya level evidence yang diterima/diterima dengan catatan dihitung.
function getRowStructureProcessBreakdown(row) {
  // The server score is authoritative and represents accepted evidence only.
  // Never replace it with a self-selected input level from parameterLevels.
  const authoritative=row?.structureProcessBreakdown;
  if(authoritative&&authoritative.source==='verified_evidence_only'&&Number.isFinite(Number(authoritative.value))){
    const total=Math.max(0,Number(authoritative.totalParams)||PARAM_LIST.length||43);
    const verified=Math.max(0,Number(authoritative.verifiedParams??authoritative.selectedParams)||0);
    return {...authoritative,totalParams:total,selectedParams:verified,verifiedParams:verified,sumLevels:Number(authoritative.sumLevels)||0,value:Math.max(0,Number(authoritative.value)||0),byLevel:authoritative.byLevel||{1:0,2:0,3:0,4:0,5:0}};
  }
  // Compatibility fallback for older API snapshots: compute from files with an
  // accepted verification decision; level selectors alone never contribute.
  const master=Array.isArray(PARAM_LIST)&&PARAM_LIST.length?PARAM_LIST:Object.entries(SUBUNSUR_DATA||{}).flatMap(([subCode,info])=>(info?.params||[]).map(param=>({subCode,paramId:param.id})));
  const b={totalParams:master.length||43,selectedParams:0,verifiedParams:0,sumLevels:0,byLevel:{1:0,2:0,3:0,4:0,5:0}};
  for(const param of master){
    let maxLevel=0;
    for(let level=1;level<=5;level++){
      const files=row?.subunsurs?.[param.subCode]?.[param.paramId]?.['files'+level];
      if(!Array.isArray(files))continue;
      if(files.some(file=>{const status=normalizeVerification(file?.verification||file).status;return status==='diterima'||status==='diterima_catatan';}))maxLevel=level;
    }
    if(maxLevel>0){b.selectedParams++;b.verifiedParams++;b.sumLevels+=maxLevel;b.byLevel[maxLevel]++;}
  }
  b.value=b.totalParams?Math.round((b.sumLevels/b.totalParams)*100)/100:0;
  b.source='verified_evidence_only';
  return b;
}

function calculateSA(row) {
  return getRowStructureProcessBreakdown(row).value;
}

// ====== HITUNG KPI LOKAL ======
function updateKpisLocal(){
  const total = rows.length;
  const avgAll = field => total ? rows.reduce((sum,r)=>sum + (Number(r[field]) || 0),0) / total : 0;
  const avgFilled = field => { const a=rows.map(r=>Number(computedValueOf(r,field))).filter(v=>Number.isFinite(v)&&v>0); return a.length?a.reduce((x,y)=>x+y,0)/a.length:0; };
  const pct=(n,d)=>d?Math.round(n/d*100):0;
  const struktur = rows.map(r=>Number(getRowStructureProcessBreakdown(r).value)||0);
  const maturitas = rows.map(r=>Number(computedValueOf(r,'nilaiMaturitas'))||0).filter(v=>v>0);
  const mri = rows.map(r=>Number(computedValueOf(r,'mri'))||0).filter(v=>v>0);
  const iepk = rows.map(r=>Number(computedValueOf(r,'iepk'))||0).filter(v=>v>0);
  const kap = rows.filter(r=>assessmentOrgProfile(r)==='INSPEKTORAT').map(r=>Number(computedValueOf(r,'nilaiKapabilitasApip'))||0).filter(v=>v>0);
  const qaSummaries=rows.map(r=>r.qaApipSummary||{total:671,evaluated:0,na:0,pending:671,sum:0,percentage:0,completion:0,status:'Belum'});
  // KPI is a weighted aggregate across the whole QA scope, not an average of
  // OPD percentages. This prevents a small OPD with one completed item from
  // pulling the overall KPI to 100%.
  const qaScoredItems=qaSummaries.reduce((sum,s)=>sum+Math.max(0,Number(s.evaluated)||0),0);
  const qaScoreSum=qaSummaries.reduce((sum,s)=>sum+(Number(s.sum)||0),0);
  const qaApip=qaScoredItems?Math.round((qaScoreSum/qaScoredItems)*10000)/100:0;
  const qaApipFilled=qaSummaries.filter(s=>Number(s.evaluated||0)+Number(s.na||0)>0).length;
  const qaEvidenceFiles=rows.reduce((sum,r)=>sum+Number(r.qaApipSummary?.evidenceFiles||0),0);
  const status=rows.filter(r=>r.status==='Selesai').length, rtp=rows.filter(r=>r.rtp==='Selesai').length, ev=rows.filter(r=>getFileVerificationSummary(r.rtpEvidence).total>0).length;

  const documentSummaries = rows.map(getRowDocumentVerificationSummary);
  const totalDocuments = documentSummaries.reduce((sum,s)=>sum+s.total,0);
  const verifiedDocuments = documentSummaries.reduce((sum,s)=>sum+s.verified,0);
  const structureDocuments = documentSummaries.reduce((sum,s)=>sum+s.structureTotal,0);
  const rtpDocuments = documentSummaries.reduce((sum,s)=>sum+s.rtpTotal,0);
  const verificationDocumentsPct = pct(verifiedDocuments,totalDocuments);

  applyKpis({
    rataStrukturProses:total ? struktur.reduce((a,b)=>a+b,0)/total : 0,
    rataMaturitas:avgFilled('nilaiMaturitas'),
    rataMRI:avgFilled('mri'),
    rataIEPK:avgFilled('iepk'),
    rataKapabilitasApip:avgFilled('nilaiKapabilitasApip'),
    qaApip:Math.round(qaApip*100)/100, qaApipFilled, qaEvidenceFiles, statusSelesai:pct(status,total), rtpSelesai:pct(rtp,total), evidenceRtp:pct(ev,total),
    verifikasiDokumen:verificationDocumentsPct, totalDocuments, verifiedDocuments, structureDocuments, rtpDocuments,
    total, strukturCount:total, maturitasCount:maturitas.length, mriCount:mri.length, iepkCount:iepk.length, kapabilitasCount:kap.length,
    statusSelesaiCount:status,rtpSelesaiCount:rtp,evidenceRtpCount:ev
  });
  updateAssessmentProgress();
}
function updateAssessmentProgress(){
  const valid=['Selesai Verifikasi'];
  const done=rows.filter(r=>valid.includes(String(r.assessmentStatus||r.assessment_status||'Belum Mengisi'))).length;
  const total=rows.length;const pct=total?Math.round(done/total*100):0;
  const label=document.getElementById('assessmentProgressText');const bar=document.getElementById('assessmentProgressBar');
  if(label)label.textContent=`${pct}% · ${done} dari ${total} OPD selesai verifikasi`;
  if(bar)bar.style.width=`${pct}%`;
}
function applyKpis(k){const t=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;},b=(id,v)=>{const e=document.getElementById(id);if(e)e.style.width=Math.max(0,Math.min(100,v))+'%';};t('kpiStrukturProses',k.rataStrukturProses.toFixed(2));b('kpiStrukturProsesBar',k.rataStrukturProses/5*100);t('kpiStrukturProsesNote',k.total+' OPD');t('kpiMaturitas',k.rataMaturitas.toFixed(2));b('kpiMaturitasBar',k.rataMaturitas/5*100);t('kpiMaturitasNote',k.maturitasCount+' OPD terisi');t('kpiMRI',k.rataMRI.toFixed(2));b('kpiMRIBar',k.rataMRI/5*100);t('kpiMRINote',k.mriCount+' OPD terisi');t('kpiIEPK',k.rataIEPK.toFixed(2));b('kpiIEPKBar',k.rataIEPK/5*100);t('kpiIEPKNote',k.iepkCount+' OPD terisi');t('kpiKapabilitasApip',k.rataKapabilitasApip.toFixed(2));b('kpiKapabilitasApipBar',k.rataKapabilitasApip/5*100);t('kpiKapabilitasApipNote',k.kapabilitasCount+' OPD terisi');t('kpiQaApip',Number(k.qaApip||0).toFixed(2)+'%');b('kpiQaApipBar',k.qaApip);t('kpiQaApipNote',k.qaEvidenceFiles+' dokumen evidence · '+k.qaApipFilled+' dari '+k.total+' OPD terisi');t('kpiStatusSelesai',k.statusSelesai+'%');b('kpiStatusSelesaiBar',k.statusSelesai);t('kpiStatusSelesaiNote',k.statusSelesaiCount+' dari '+k.total+' OPD');t('kpiRtpSelesai',k.rtpSelesai+'%');b('kpiRtpSelesaiBar',k.rtpSelesai);t('kpiRtpSelesaiNote',k.rtpSelesaiCount+' dari '+k.total+' OPD');t('kpiEvidenceRtp',k.evidenceRtp+'%');b('kpiEvidenceRtpBar',k.evidenceRtp);t('kpiEvidenceRtpNote',k.evidenceRtpCount+' dari '+k.total+' OPD');t('kpiVerifikasiDokumen',k.verifikasiDokumen+'%');b('kpiVerifikasiDokumenBar',k.verifikasiDokumen);t('kpiVerifikasiDokumenNote',`${k.verifiedDocuments} dari ${k.totalDocuments} dokumen · Struktur & Proses ${k.structureDocuments||0} · RTP ${k.rtpDocuments||0}`);applyDashboardModeToKpis();}

function applyDashboardModeToKpis(){
  const official=dashboardMode==='bpkp';
  const lbl=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  const val=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  const bar=(id,value)=>{const el=document.getElementById(id);if(el)el.style.width=Math.max(0,Math.min(100,Number(value)||0))+'%';};
  const card1=document.getElementById('kpi-card-1');if(card1)card1.style.display=official?'none':'';
  lbl('kpiMaturitasLabel',official?'Nilai SPIP Resmi Pemda (BPKP)':'Rata-rata Nilai Maturitas Penyelenggaraan SPIP Terintegrasi');
  lbl('kpiMRILabel',official?'Indeks MRI Resmi Pemda (BPKP)':'Rata-rata MRI');
  lbl('kpiIEPKLabel',official?'Indeks IEPK Resmi Pemda (BPKP)':'Rata-rata IEPK');
  lbl('kpiKapabilitasApipLabel',official?'Kapabilitas APIP Resmi — Inspektorat':'Kapabilitas APIP — Inspektorat (Pemda)');
  if(!official)return;
  const score=bpkpOfficialScore;
  const finalized=Number(score?.finalized||0)===1;
  const scoreVal=k=>finalized&&Number.isFinite(Number(score?.[k]))?Number(score[k]):null;
  const spip=scoreVal('spip'),mri=scoreVal('mri'),iepk=scoreVal('iepk'),apip=scoreVal('apip');
  val('kpiMaturitas',spip===null?'—':spip.toFixed(2));bar('kpiMaturitasBar',spip===null?0:spip/5*100);val('kpiMaturitasNote',finalized?'Nilai final resmi tingkat Pemda':'Belum ada nilai final BPKP');
  val('kpiMRI',mri===null?'—':mri.toFixed(2));bar('kpiMRIBar',mri===null?0:mri/5*100);val('kpiMRINote',finalized?'Nilai final resmi tingkat Pemda':'Belum ada nilai final BPKP');
  val('kpiIEPK',iepk===null?'—':iepk.toFixed(2));bar('kpiIEPKBar',iepk===null?0:iepk/5*100);val('kpiIEPKNote',finalized?'Nilai final resmi tingkat Pemda':'Belum ada nilai final BPKP');
  val('kpiKapabilitasApip',apip===null?'—':`Level ${Math.round(apip)}`);bar('kpiKapabilitasApipBar',apip===null?0:apip/5*100);val('kpiKapabilitasApipNote',finalized?`Nilai resmi Pemda · Inspektorat${score.updated_at?' · '+new Date(Number(score.updated_at)).toLocaleDateString('id-ID'):''}`:'Belum ada nilai final Kapabilitas APIP');
}

async function loadBpkpOfficialScore(force=false){
  const year=String(currentYear||document.getElementById('yearSelect')?.value||'2026');
  if(!force&&bpkpScoreLoadedYear===year&&Date.now()-bpkpScoreLoadedAt<60000){applyDashboardModeToKpis();return bpkpOfficialScore;}
  try{const response=await callServer('getBpkpOfficialScore',{year});bpkpOfficialScore=response.score||null;bpkpScoreLoadedAt=Date.now();bpkpScoreLoadedYear=year;applyDashboardModeToKpis();return bpkpOfficialScore;}
  catch(err){console.warn('Nilai resmi BPKP belum dapat dimuat:',err.message);return null;}
}
function setDashboardMode(mode){dashboardMode=mode==='bpkp'?'bpkp':'internal';const internal=document.getElementById('modeInternalBtn'),official=document.getElementById('modeBpkpBtn'),banner=document.getElementById('dashboardModeBanner');if(internal)internal.classList.toggle('active',dashboardMode==='internal');if(official)official.classList.toggle('active',dashboardMode==='bpkp');if(banner){banner.className='dashboard-mode-banner '+(dashboardMode==='bpkp'?(Number(bpkpOfficialScore?.finalized||0)===1?'official':'pending'):'internal');banner.textContent=dashboardMode==='internal'?'Menampilkan data berjalan / Self-Assessment per OPD. Nilai mandiri tidak sama dengan nilai final Pemda.':(Number(bpkpOfficialScore?.finalized||0)===1?`Data Resmi Hasil Evaluasi BPKP RI Tahun ${currentYear} · Dicatat oleh ${bpkpOfficialScore.updated_by||'Admin Inspektorat'}${bpkpOfficialScore.updated_at?' · '+new Date(Number(bpkpOfficialScore.updated_at)).toLocaleDateString('id-ID'):''}`:`Mode hasil resmi BPKP — nilai Tahun ${currentYear} belum difinalisasi; nilai mandiri OPD tidak ditampilkan sebagai nilai resmi.`);}applyDashboardModeToKpis();}

// ====== SAVE DATA ======
function debounceSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveData, 800);
}
function syncData() { debounceSave(); }
async function saveData() {
  if (isSaving) { pendingSave = true; return; }
  isSaving = true;
  const status = document.getElementById('saveStatus');
  if (status) status.textContent = '⏳ Menyimpan...';
  const year = currentYear;
  try {
    if (!Array.isArray(rows)) rows = [];
    const result = await callServer('saveData', { rows: JSON.stringify(rows), year });
    if (result.status === 'error') throw new Error(result.message);
    if (status) status.textContent = '✅ Data tersimpan';
    originalRows = JSON.parse(JSON.stringify(rows));
    updateKpisLocal();
    setTimeout(() => { if (status && status.textContent.startsWith('✅')) status.textContent = ''; }, 2000);
  } catch (err) {
    if (isNetworkError(err) || !navigator.onLine || err.transient) {
      queueCurrentRowsForAutosave(err.message || 'Koneksi bermasalah');
      if (status) status.textContent = `📴 Tersimpan di perangkat — akan disinkronkan otomatis`;
      return;
    }
    if (status) status.textContent = '⚠️ ' + err.message;
    throw err;
  } finally {
    isSaving = false;
    if (pendingSave) { pendingSave = false; saveData(); }
  }
}

function getAssessmentEvidenceScopeSummary(row){
  const allowed=assessmentAllowedTargets(row||'');
  const raw=row?.workbookEvidenceSummary||{};const stats=raw.targetStats||{};
  const targetTotal={T1:43,T2:42,T3:43,T4:55};
  const scoped=allowed.reduce((out,target)=>{const v=stats[target]||{};out.groups+=Number(v.groups||0);out.files+=Number(v.files||0);out.verifiedFiles+=Number(v.verifiedFiles||0);out.totalParameters+=targetTotal[target]||0;return out;},{groups:0,files:0,verifiedFiles:0,totalParameters:0});
  // Legacy evidence made before target_code existed is still treated as T1 by the backend query.
  if(!Object.keys(stats).some(k=>Number(stats[k]?.groups||0)>0)&&scoped.files===0){scoped.groups=Number(raw.evidenceGroups||0);scoped.files=Number(raw.totalFiles||0);scoped.verifiedFiles=Number(raw.verifiedFiles||0);}
  return scoped;
}

// ====== RENDER TABEL ======
// PERUBAHAN KEAMANAN: GANTI FUNGSI RENDER DENGAN VERSI YANG MENGGUNAKAN escapeHtml
function render() {
  const tbody = document.getElementById('tableBody');
  const empty = document.getElementById('emptyState');
  if (!Array.isArray(rows)) {
    console.error('rows bukan array di render, diset kosong');
    rows = [];
  }
  if (rows.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; }
  else {
    empty.style.display = 'none';
    tbody.innerHTML = rows.map((r, index) => {
      const structureBreakdown = getRowStructureProcessBreakdown(r);
      const hasAuthoritativeLevels = r && r.parameterLevels && typeof r.parameterLevels === 'object';
      const struktur = hasAuthoritativeLevels ? Number(structureBreakdown.value || 0) : Number(r.nilaiStrukturProses ?? structureBreakdown.value) || 0;
      r.nilaiStrukturProses = struktur;
      r.sa = struktur;
      r.structureProcessBreakdown = structureBreakdown;
      const totalParams = PARAM_LIST.length || 43;
      const wbEv = r.workbookEvidenceSummary || {totalFiles:0,evidenceGroups:0,verifiedFiles:0,syncedFiles:0};
      const scopedEvidence = getAssessmentEvidenceScopeSummary(r);
      const countEvidence = Number(scopedEvidence.groups||0);
      const evidenceFiles = Number(scopedEvidence.files||0);
      const scopeTotal = Math.max(1,Number(structureBreakdown.totalParams||totalParams||43));
      const verifiedParams = Math.max(0,Number(structureBreakdown.verifiedParams??structureBreakdown.selectedParams)||0);
      const strukturStatus = verifiedParams >= scopeTotal ? 'Selesai' : (verifiedParams > 0 ? 'Proses' : 'Belum');
      let badgeClass = countEvidence >= scopeTotal ? 'badge-lengkap' : (countEvidence > 0 ? 'badge-sebagian' : 'badge-kosong');
      let badgeLabel = countEvidence >= scopeTotal ? `Lengkap (${countEvidence}/${scopeTotal})` : (countEvidence > 0 ? `Sebagian (${countEvidence}/${scopeTotal})` : `Belum (0/${scopeTotal})`);
      return `<tr>
        <td style="text-align:center;">${index + 1}</td>
        <td><div style="display:flex; align-items:center; gap:8px;"><span style="font-weight:500;">${escapeHtml(r.opd || 'Tanpa Nama')}</span>${currentUser?.role==='admin'?`<button class="btn-edit-name" data-id="${escapeHtml(r.id)}" title="Ubah Nama" style="background:none;border:none;cursor:pointer;font-size:18px;padding:0;">✏️</button>`:''}</div></td>
        <td>${selectHtml(r.id,'assessmentStatus',r.assessmentStatus||'Belum Mengisi',['Belum Mengisi','Proses Pengisian','Proses Review','Selesai Verifikasi'])}</td>
        <td><div class="computed-value-cell" title="${escapeHtml(computedTitle(r,'nilaiMaturitas'))}">${computedDisplay(r,'nilaiMaturitas')}<small>otomatis</small></div></td>
        <td><div class="computed-value-cell" title="${escapeHtml(computedTitle(r,'mri'))}">${computedDisplay(r,'mri')}<small>otomatis</small></div></td>
        <td><div class="computed-value-cell" title="${escapeHtml(computedTitle(r,'iepk'))}">${computedDisplay(r,'iepk')}<small>otomatis</small></div></td>
        <td><div class="computed-value-cell" title="${escapeHtml(computedTitle(r,'nilaiKapabilitasApip'))}">${assessmentOrgProfile(r)==='INSPEKTORAT'?computedDisplay(r,'nilaiKapabilitasApip'):'—'}<small>${assessmentOrgProfile(r)==='INSPEKTORAT'?'khusus Inspektorat':'level Pemda'}</small></div></td>
        <td>${selectHtml(r.id,'status',r.status,['Selesai','Proses','Belum'])}</td>
        <td>${selectHtml(r.id,'evidence',r.evidence,['Lengkap','Sebagian','Belum'])}</td>
        <td>${selectHtml(r.id,'rtp',r.rtp,['Selesai','Belum'])}</td>
        <td><input class="auto-structure-value" type="number" data-id="${r.id}" value="${Number(struktur).toFixed(2)}" readonly aria-label="Nilai Struktur dan Proses otomatis" title="Otomatis dari evidence yang diterima, denominator 43 parameter"></td>
        <td><span class="badge ${strukturStatus==='Selesai'?'badge-lengkap':(strukturStatus==='Proses'?'badge-sebagian':'badge-kosong')}">${strukturStatus}</span></td>
        <td><span class="badge ${badgeClass}" title="Evidence Struktur & Proses workbook: 55 grup merged dari KK3.1–KK3.4">${badgeLabel}</span></td>
        <td><div class="evidence-cell"><button class="btn-detail" data-id="${r.id}" title="Evidence Struktur dan Proses">📁</button><span class="structure-evidence-summary" data-id="${r.id}">${(evidenceFiles?(Number(scopedEvidence.verifiedFiles||0)/evidenceFiles*100):0).toFixed(0)}%<small>${evidenceFiles} file · ${countEvidence}/${scopeTotal} grup sesuai T${assessmentAllowedTargets(r)[0]==='T1'&&assessmentAllowedTargets(r).length===1?'1':assessmentAllowedTargets(r).join('+')}</small></span></div></td>
        <td><div class="qa-apip-table-cell"><button class="btn-qa-apip" data-id="${r.id}" title="Penjaminan Kualitas / Quality Assurance APIP">🛡️</button><span class="qa-apip-table-summary" data-id="${r.id}">${Number(r.qaApipSummary?.percentage||0).toFixed(2)}%<small>${Number(r.qaApipSummary?.checked??r.qaApipSummary?.evaluated??0)}/${Number(r.qaApipSummary?.total||671)} item · ${Number(r.qaApipSummary?.evidenceFiles||0)} file</small></span></div></td>
        <td><button class="btn-kk" data-id="${r.id}" title="Buka Spreadsheet Kertas Kerja SPIP">📊</button></td>
        <td><div class="kk-pm-table-cell"><button class="btn-kk-pm-spip" data-id="${r.id}" title="Buka Kertas Kerja PM SPIP">📝</button><span class="kk-pm-table-summary" data-id="${r.id}">${Number(r.kkPmSummary?.percentage||0).toFixed(2)}%<small>${Number(r.kkPmSummary?.evaluated||0)}/${Number(r.kkPmSummary?.total||183)} parameter</small></span></div></td>
        <td><button class="btn-report-pm" data-id="${r.id}" title="Upload Laporan Hasil PM SPIP">📄</button><div class="report-count pm">${Array.isArray(r.pmSpipReports)?r.pmSpipReports.length:0}</div></td>
        <td><button class="btn-kk-rtp" data-id="${r.id}" title="Buka Spreadsheet Kertas Kerja RTP">📋</button></td>
        <td><button class="btn-report-rr" data-id="${r.id}" title="Upload Laporan Pemantauan RR_RTP">📄</button><div class="report-count rr">${Array.isArray(r.rrRtpReports)?r.rrRtpReports.length:0}</div></td>
        <td><div class="evidence-cell"><button class="btn-rtp-evidence" data-id="${r.id}" title="Evidence RTP dan alur verifikasi">📤</button><span class="rtp-evidence-summary" data-id="${r.id}">${getRtpEvidenceVerificationSummary(r).percentage.toFixed(0)}%<small>${getRtpEvidenceVerificationSummary(r).total} file</small></span></div></td>
        <td><button class="btn-lhe-followup" data-id="${escapeHtml(r.id)}" title="Tindak Lanjut LHE SPIP tahun ${Number(currentYear)} dan ${Number(currentYear)-1}">🧾 <small>${Number(r.lheFollowupCount||0)} butir</small></button></td>
        <td>${currentUser?.role==='admin'?`<button class="del-btn" data-id="${escapeHtml(r.id)}" title="Hapus">&times;</button>`:''}</td>
      </tr>`;
    }).join('');
  }
  attachHandlers();
  updateKpisLocal();
}

function selectHtml(id, field, value, options) {
  const role=String(currentUser?.role||'');
  const canAssessment=['admin','irban'].includes(role);
  const canEdit=['admin','auditor','opd'].includes(role);
  const disabled=(field==='assessmentStatus'&&!canAssessment)||(['status','evidence','rtp'].includes(field)&&!canEdit);
  const opts = options.map(o => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
  return `<select data-id="${escapeHtml(id)}" data-field="${field}" ${disabled?'disabled':''}>${opts}</select>`;
}

function attachHandlers() {
  function showIndicator(target, text, className) {
    let ind = target.parentNode.querySelector('.save-indicator');
    if (!ind) {
      ind = document.createElement('span');
      ind.className = 'save-indicator';
      target.parentNode.appendChild(ind);
    }
    ind.textContent = text;
    ind.className = 'save-indicator ' + className;
    if (className === 'success' || className === 'error') {
      setTimeout(() => {
        ind.remove();
      }, 2000);
    }
  }

  document.querySelectorAll('input[data-id]').forEach(el => {
    if (!['nilaiMaturitas','mri','iepk','nilaiKapabilitasApip'].includes(el.dataset.field)) return;
    return;
    el.onchange = (e) => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      const row = rows.find(r => r.id === id);
      if (!row) return;
      let val = e.target.value;
      if (['nilaiMaturitas','mri','iepk','nilaiKapabilitasApip'].includes(field)) val = Math.max(0, Math.min(5, parseFloat(val) || 0));
      else val = e.target.value;
      row[field] = val;

      showIndicator(e.target, '⏳ Menyimpan...', 'saving');

      callServerWithRetry('saveField', { opdId: id, field: field, value: val, year: currentYear }, 3)
        .then(res => {
          if (res.status === 'error') {
            showIndicator(e.target, '✗ Gagal', 'error');
            console.error('Gagal simpan field:', res.message);
          } else {
            showIndicator(e.target, '✓', 'success');
          }
        })
        .catch(err => {
          if (isNetworkError(err) || !navigator.onLine || err.transient) {
            queueOfflineSave('saveField', { opdId: id, field: field, value: val, year: currentYear }, err.message);
            showIndicator(e.target, '📴 Tersimpan lokal', 'saving');
          } else {
            showIndicator(e.target, '✗ Gagal', 'error');
          }
          console.error('Error saveField:', err);
        });
    };
  });

  document.querySelectorAll('select[data-id]').forEach(el => {
    el.onchange = (e) => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      const row = rows.find(r => r.id === id);
      if (!row) return;
      const previousValue=row[field];
      row[field] = e.target.value;
      if(field==='assessmentStatus'){
        if(!['admin','irban'].includes(currentUser?.role)){row[field]=previousValue||'Belum Mengisi';e.target.value=row[field];return;}
        showIndicator(e.target,'⏳ Menyimpan...','saving');
        callServerWithRetry('saveAssessmentStatus',{opdId:id,assessmentStatus:e.target.value,year:currentYear},2).then(()=>{row.assessmentStatus=e.target.value;showIndicator(e.target,'✓','success');updateAssessmentProgress();}).catch(err=>{row.assessmentStatus=previousValue||'Belum Mengisi';e.target.value=row.assessmentStatus;showIndicator(e.target,'✗ Gagal','error');alert('Status tidak tersimpan: '+err.message);});
        return;
      }
      showIndicator(e.target, '⏳ Menyimpan...', 'saving');

      callServerWithRetry('saveField', { opdId: id, field: field, value: e.target.value, year: currentYear }, 3)
        .then(res => {
          if (res.status === 'error') {
            showIndicator(e.target, '✗ Gagal', 'error');
            console.error('Gagal simpan field:', res.message);
          } else {
            showIndicator(e.target, '✓', 'success');
          }
        })
        .catch(err => {
          if (isNetworkError(err) || !navigator.onLine || err.transient) {
            queueOfflineSave('saveField', { opdId: id, field: field, value: e.target.value, year: currentYear }, err.message);
            showIndicator(e.target, '📴 Tersimpan lokal', 'saving');
          } else {
            showIndicator(e.target, '✗ Gagal', 'error');
          }
          console.error('Error saveField:', err);
        });
    };
  });
}

// ====== GRAFIK KPI – MODERN GRADIENT LINE CHART ======
const kpiGlowPlugin = {
  id: 'kpiGlow',
  beforeDatasetsDraw(chart) {
    if (!chart.config || chart.config.type !== 'line') return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(79, 70, 229, 0.22)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
  },
  afterDatasetsDraw(chart) {
    if (!chart.config || chart.config.type !== 'line') return;
    chart.ctx.restore();
  }
};

function showChart(type) {
  const titles={
    nilaiStrukturProses:'Nilai Struktur dan Proses per OPD',
    nilaiMaturitas:'Nilai Maturitas Penyelenggaraan SPIP Terintegrasi per OPD',
    rataMRI:'Nilai MRI per OPD',
    rataIEPK:'Nilai IEPK per OPD',
    nilaiKapabilitasApip:'Nilai Kapabilitas APIP per OPD',
    qaApip:'Persentase Hasil QA APIP per OPD',
    statusSelesai:'Persentase OPD Selesai (Status)',
    rtpSelesai:'Persentase RTP Selesai',
    evidenceRtp:'Persentase OPD dengan Evidence RTP',
    verifikasiDokumen:'Persentase Verifikasi Dokumen per OPD'
  };

  let labels=[];
  let data=[];
  let backgroundColor=[];
  let borderColor=[];
  let typeChart='bar';
  let totalCount=0;
  let countTrue=0;
  let countFalse=0;
  let verificationMeta=[];
  let qaMeta=[];

  if (!rows || rows.length===0) {
    alert('Data OPD belum tersedia!');
    return;
  }

  const isLineChart=['nilaiStrukturProses','nilaiMaturitas','rataMRI','rataIEPK','nilaiKapabilitasApip'].includes(type);
  const isVerificationByOpdChart=type==='verifikasiDokumen';
  const isQaByOpdChart=type==='qaApip';

  if (isLineChart) {
    let chartData=[...rows];
    const field=type==='nilaiStrukturProses'?'nilaiStrukturProses':type==='nilaiMaturitas'?'nilaiMaturitas':type==='rataMRI'?'mri':type==='rataIEPK'?'iepk':'nilaiKapabilitasApip';
    chartData.sort((a,b)=>(parseFloat(b[field])||0)-(parseFloat(a[field])||0));
    labels=chartData.map(r=>r.opd||'OPD Tanpa Nama');
    data=chartData.map(r=>Math.max(0,Math.min(5,parseFloat(r[field])||0)));
    typeChart='line';
  } else if (isVerificationByOpdChart) {
    const chartData=[...rows].map(r=>({row:r,summary:getRowDocumentVerificationSummary(r)}));
    chartData.sort((a,b)=>b.summary.documentPercentage-a.summary.documentPercentage);
    labels=chartData.map(x=>x.row.opd||'OPD Tanpa Nama');
    data=chartData.map(x=>Math.round(Math.max(0,Math.min(100,x.summary.documentPercentage))));
    verificationMeta=chartData.map(x=>({total:x.summary.total,verified:x.summary.verified}));
    typeChart='bar';
  } else if (type==='opdLevel3') {
    totalCount=rows.length;
    countTrue=rows.filter(r=>(parseFloat(r.sa)||0)>=3).length;
    countFalse=totalCount-countTrue;
    labels=['Level >= 3','Level < 3']; data=[countTrue,countFalse];
    backgroundColor=['#10b981','#e2e8f0']; borderColor=['#ffffff','#ffffff']; typeChart='pie';
  } else if (isQaByOpdChart) {
    // QA APIP sengaja menggunakan bentuk grafik BAR HORIZONTAL yang sama
    // dengan KPI Verifikasi Dokumen per OPD. Tidak memakai pie/doughnut.
    const chartData=[...rows].map(r=>({
      row:r,
      summary:r.qaApipSummary||{percentage:0,evaluated:0,checked:0,na:0,total:671,evidenceFiles:0}
    }));
    chartData.sort((a,b)=>(Number(b.summary.percentage)||0)-(Number(a.summary.percentage)||0));
    labels=chartData.map(x=>x.row.opd||'OPD Tanpa Nama');
    data=chartData.map(x=>Math.round(Math.max(0,Math.min(100,Number(x.summary.percentage)||0))*100)/100);
    qaMeta=chartData.map(x=>({
      total:Number(x.summary.total)||671,
      evaluated:Number(x.summary.evaluated)||0,
      na:Number(x.summary.na)||0,
      evidenceFiles:Number(x.summary.evidenceFiles)||0
    }));
    typeChart='bar';
  } else if (type==='statusSelesai') {
    totalCount=rows.length;
    countTrue=rows.filter(r=>r.status==='Selesai').length;
    countFalse=totalCount-countTrue;
    labels=['Selesai','Proses/Belum']; data=[countTrue,countFalse];
    backgroundColor=['#6366f1','#e2e8f0']; borderColor=['#ffffff','#ffffff']; typeChart='pie';
  } else if (type==='rtpSelesai') {
    totalCount=rows.length; countTrue=rows.filter(r=>r.rtp==='Selesai').length; countFalse=totalCount-countTrue;
    labels=['Selesai','Belum']; data=[countTrue,countFalse];
    backgroundColor=['#f97316','#e2e8f0']; borderColor=['#ffffff','#ffffff']; typeChart='pie';
  } else if (type==='evidenceRtp') {
    totalCount=rows.length; countTrue=rows.filter(r=>Array.isArray(r.rtpEvidence)&&r.rtpEvidence.length>0).length; countFalse=totalCount-countTrue;
    labels=['Terisi','Belum']; data=[countTrue,countFalse];
    backgroundColor=['#10b981','#e2e8f0']; borderColor=['#ffffff','#ffffff']; typeChart='pie';
  }

  document.getElementById('kpiChartTitle').textContent=titles[type]||'Grafik';
  document.getElementById('kpiChartModal').classList.add('active');

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance=null;
  }

  const canvas=document.getElementById('kpiChartCanvas');
  const ctx=canvas.getContext('2d');
  const container=canvas.parentElement;

  if (isLineChart) {
    // Kanvas responsif: tidak lagi dipaksa 800x600 sehingga modal tetap proporsional.
    const chartWidth=Math.max(320, container.clientWidth-2);
    const chartHeight=430;
    canvas.width=chartWidth;
    canvas.height=chartHeight;
    canvas.style.width='100%';
    canvas.style.height=chartHeight+'px';
    canvas.style.minWidth='0';
    canvas.style.display='block';
    canvas.style.margin='0';
    container.style.overflow='hidden';

    // Gradient utama mengikuti identitas biru–ungu website.
    const fillGradient=ctx.createLinearGradient(0,0,0,chartHeight);
    fillGradient.addColorStop(0,'rgba(59,130,246,0.34)');
    fillGradient.addColorStop(0.42,'rgba(99,102,241,0.18)');
    fillGradient.addColorStop(1,'rgba(139,92,246,0.015)');

    const lineGradient=ctx.createLinearGradient(0,0,chartWidth,0);
    lineGradient.addColorStop(0,'#2563eb');
    lineGradient.addColorStop(0.45,'#4f46e5');
    lineGradient.addColorStop(1,'#7c3aed');

    chartInstance=new Chart(ctx,{
      type:'line',
      plugins:[kpiGlowPlugin],
      data:{
        labels,
        datasets:[{
          label:titles[type],
          data,
          fill:true,
          backgroundColor:fillGradient,
          borderColor:lineGradient,
          borderWidth:3.5,
          tension:0.42,
          cubicInterpolationMode:'monotone',
          pointRadius:3,
          pointHoverRadius:7,
          pointHitRadius:18,
          pointBackgroundColor:'#ffffff',
          pointBorderColor:'#4f46e5',
          pointBorderWidth:2.5,
          spanGaps:true
        }]
      },
      options:{
        responsive:false,
        maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        layout:{padding:{top:18,right:20,bottom:8,left:10}},
        plugins:{
          legend:{display:false},
          tooltip:{
            enabled:true,
            backgroundColor:'rgba(15,23,42,0.94)',
            titleColor:'#ffffff',
            bodyColor:'#e2e8f0',
            borderColor:'rgba(129,140,248,0.55)',
            borderWidth:1,
            padding:12,
            displayColors:false,
            cornerRadius:10,
            titleFont:{size:12,weight:'700'},
            bodyFont:{size:13,weight:'600'},
            callbacks:{
              title:items=>items.length?labels[items[0].dataIndex]:'',
              label:context=>`Nilai: ${Number(context.parsed.y||0).toFixed(2)}`
            }
          }
        },
        scales:{
          x:{
            grid:{display:false,drawBorder:false},
            border:{display:false},
            ticks:{
              color:'#64748b',
              autoSkip:true,
              maxTicksLimit:8,
              maxRotation:0,
              minRotation:0,
              padding:10,
              font:{size:10,weight:'600'},
              callback:function(value,index){
                const label=labels[index]||'';
                return label.length>18?label.slice(0,16)+'…':label;
              }
            }
          },
          y:{
            min:0,
            max:5,
            border:{display:false},
            grid:{color:'rgba(148,163,184,0.14)',drawBorder:false},
            ticks:{
              color:'#64748b',
              stepSize:1,
              padding:8,
              font:{size:11,weight:'600'},
              callback:value=>Number(value).toFixed(0)
            }
          }
        },
        animation:{
          duration:1700,
          easing:'easeOutQuart',
          y:{duration:1500,from:0},
          x:{duration:1200,from:0}
        },
        transitions:{
          active:{animation:{duration:350}}
        }
      }
    });
  } else if (isVerificationByOpdChart) {
    const chartWidth=Math.max(520, container.clientWidth-2);
    const chartHeight=Math.max(430, Math.min(620, 170 + labels.length * 24));
    canvas.width=chartWidth;
    canvas.height=chartHeight;
    canvas.style.width='100%';
    canvas.style.height=chartHeight+'px';
    canvas.style.minWidth='0';
    canvas.style.display='block';
    canvas.style.margin='0';
    container.style.overflow='auto';

    chartInstance=new Chart(ctx,{
      type:'bar',
      data:{labels,datasets:[{label:titles[type],data,backgroundColor:'#6366f1',borderColor:'#4f46e5',borderWidth:1.5,borderRadius:7,maxBarThickness:28}]},
      options:{
        responsive:false,
        maintainAspectRatio:false,
        indexAxis:'y',
        layout:{padding:{top:12,right:24,bottom:18,left:12}},
        interaction:{mode:'nearest',intersect:false},
        plugins:{
          legend:{display:false},
          tooltip:{backgroundColor:'#0f172a',position:'nearest',callbacks:{label:function(context){const m=verificationMeta[context.dataIndex]||{total:0,verified:0};return ` ${Number(context.parsed.x||0).toFixed(0)}% · ${m.verified} dari ${m.total} dokumen terverifikasi`;}}}
        },
        scales:{
          x:{min:0,max:100,border:{display:false},grid:{color:'rgba(148,163,184,0.14)'},ticks:{color:'#64748b',stepSize:20,font:{size:11,weight:'600'},callback:value=>Number(value)+'%'}},
          y:{border:{display:false},grid:{display:false},ticks:{color:'#334155',font:{size:10,weight:'600'},callback:function(value){const label=labels[value]||'';return label.length>34?label.slice(0,31)+'…':label;}}}
        },
        animation:{duration:1000,easing:'easeOutQuart'}
      }
    });
  } else if (isQaByOpdChart) {
    // QA APIP: bentuk wajib BAR HORIZONTAL seperti KPI Verifikasi Dokumen per OPD.
    // Branch ini terpisah agar renderer KPI lain tidak berubah.
    const chartWidth=Math.max(520, container.clientWidth-2);
    const chartHeight=Math.max(430, Math.min(900, 170 + labels.length * 24));
    canvas.width=chartWidth;
    canvas.height=chartHeight;
    canvas.style.width='100%';
    canvas.style.height=chartHeight+'px';
    canvas.style.minWidth='0';
    canvas.style.display='block';
    canvas.style.margin='0';
    container.style.overflow='auto';

    chartInstance=new Chart(ctx,{
      type:'bar',
      data:{
        labels,
        datasets:[{
          label:titles[type],
          data,
          backgroundColor:'#0f766e',
          borderColor:'#0f766e',
          borderWidth:1.5,
          borderRadius:7,
          maxBarThickness:28
        }]
      },
      options:{
        responsive:false,
        maintainAspectRatio:false,
        indexAxis:'y',
        layout:{padding:{top:12,right:24,bottom:18,left:12}},
        interaction:{mode:'nearest',intersect:false},
        plugins:{
          legend:{display:false},
          tooltip:{
            backgroundColor:'#0f172a',
            position:'nearest',
            padding:10,
            callbacks:{
              label:function(context){
                const m=qaMeta[context.dataIndex]||{total:671,evaluated:0,checked:0,na:0,evidenceFiles:0};
                return ` ${Number(context.parsed.x||0).toFixed(2)}% · ${m.evaluated}/${m.total} item dinilai · ${m.evidenceFiles} file evidence`;
              }
            }
          }
        },
        scales:{
          x:{
            min:0,
            max:100,
            border:{display:false},
            grid:{color:'rgba(148,163,184,0.14)'},
            ticks:{color:'#64748b',stepSize:20,font:{size:11,weight:'600'},callback:value=>Number(value)+'%'}
          },
          y:{
            border:{display:false},
            grid:{display:false},
            ticks:{color:'#334155',font:{size:10,weight:'600'},callback:function(value){const label=labels[value]||'';return label.length>34?label.slice(0,31)+'…':label;}}
          }
        },
        animation:{duration:1000,easing:'easeOutQuart'}
      }
    });
  } else {
    canvas.width=380;
    canvas.height=380;
    canvas.style.width='380px';
    canvas.style.height='380px';
    canvas.style.minWidth='0';
    canvas.style.display='block';
    canvas.style.margin='0 auto';
    container.style.overflow='hidden';

    chartInstance=new Chart(ctx,{
      type:'pie',
      data:{labels,datasets:[{label:titles[type],data,backgroundColor,borderColor,borderWidth:2}]},
      options:{
        responsive:false,
        maintainAspectRatio:false,
        layout:{padding:{bottom:20}},
        plugins:{
          legend:{display:true,position:'bottom',labels:{color:'#1e293b',usePointStyle:true,pointStyle:'circle',padding:15,font:{size:12,weight:'bold'}}},
          tooltip:{backgroundColor:'#0f172a',position:'nearest',callbacks:{label:function(context){let val=context.parsed;let percent=totalCount>0?Math.round((val/totalCount)*100):0;return ` ${val} OPD (${percent}%)`;}}}
        },
        scales:{x:{display:false},y:{display:false}},
        animation:{duration:1000,easing:'easeOutQuart'}
      }
    });
  }

  const chartContainer=document.querySelector('.chart-container.chart-scroll');
  if(chartContainer){chartContainer.scrollTop=0;chartContainer.scrollLeft=0;}
}

document.getElementById('kpiChartClose').addEventListener('click', function() {
  document.getElementById('kpiChartModal').classList.remove('active');
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
});

// ====== INISIALISASI SETELAH SESI SERVER TERVERIFIKASI ======
async function initializeAppAfterAuth(){
  if(appInitializedAfterAuth)return;
  appInitializedAfterAuth=true;
  const loadingOverlay=document.getElementById('loadingOverlay');
  const loadingFill=document.getElementById('loadingFill');
  const loadingPercent=document.getElementById('loadingPercent');
  const loadingStatus=document.getElementById('loadingStatus');
  const loadingError=document.getElementById('loadingError');
  function setProgress(pct,status){loadingFill.style.width=pct+'%';loadingPercent.textContent=Math.round(pct)+'%';loadingStatus.textContent=status;}
  const timeoutId=setTimeout(()=>{loadingError.style.display='block';loadingError.textContent='Terlalu lama memuat data. Periksa server / koneksi internet Anda.';loadingStatus.textContent='Gagal memuat…';},15000);
  try{
    initOfflineAutosave();
    setProgress(10,'Memuat data subunsur…');
    SUBUNSUR_DATA=await callServer('getSubunsurData');
    PARAM_LIST=[];Object.keys(SUBUNSUR_DATA).forEach(subCode=>{SUBUNSUR_DATA[subCode].params.forEach(param=>PARAM_LIST.push({subCode,paramId:param.id,desc:param.desc,levels:param.levels}));});
    setProgress(45,'Memuat daftar tahun…');await loadYears();
    setProgress(70,'Memuat data sesuai hak akses…');await loadData();
    clearTimeout(timeoutId);setProgress(100,'Selesai memuat data.');
    setTimeout(()=>{loadingOverlay.classList.add('hidden');},250);
  }catch(e){
    clearTimeout(timeoutId);appInitializedAfterAuth=false;console.error('Inisialisasi gagal:',e);
    loadingError.style.display='block';loadingError.textContent='Terjadi kesalahan: '+e.message;loadingStatus.textContent='Gagal memuat data';
    document.getElementById('saveStatus').textContent='⚠️ '+e.message;
    setTimeout(()=>{loadingOverlay.classList.add('hidden');},300);
  }
}
(async function bootstrapAuth(){
  const overlay=document.getElementById('opdAccessOverlay');
  const loading=document.getElementById('loadingOverlay');
  try{
    const me=await callServer('authMe',{});
    if(me?.authenticated&&me.user){await finishLogin(me.user);}
    else{loading.classList.add('hidden');overlay.style.display='flex';document.getElementById('opdAccessUsername')?.focus();}
  }catch(err){console.warn('Sesi belum tersedia:',err.message);loading.classList.add('hidden');overlay.style.display='flex';}
})();

// ====== EVENT NAVIGASI ======
document.getElementById('btnOpdListNav').addEventListener('click', showOpdList);
document.getElementById('btnDashboardNav').addEventListener('click', showDashboard);

// ====== MANAJEMEN AKUN OPD (D1 / HASH PASSWORD) ======
const accountRoleField=document.getElementById('accountRole');
const accountOpdField=document.getElementById('accountOpdField');
function populateAccountOpdOptions(){
  const select=document.getElementById('accountOpdName');if(!select)return;
  const selected=select.value;const seen=new Set();const list=(Array.isArray(rows)?rows:[]).map(r=>String(r.opd||'').trim()).filter(n=>{const k=n.toLocaleUpperCase('id-ID').replace(/[^A-Z0-9]+/g,' ').trim();if(!n||seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>a.localeCompare(b,'id'));
  select.innerHTML='<option value="">Pilih OPD yang ada</option>'+list.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
  if(list.includes(selected))select.value=selected;
}
function updateAccountRoleFields(){const role=String(accountRoleField?.value||'opd');if(accountOpdField)accountOpdField.style.display=role==='opd'?'block':'none';}
function accountRoleLabel(role){return ({admin:'Super Admin',auditor:'Auditor',ppupd:'PPUPD',opd:'Operator OPD',irban:'Irban',bpkp:'BPKP'})[role]||role;}
function accountScopeLabel(user){if(user.role==='admin')return 'Semua OPD + konfigurasi';if((user.opdNames||[]).includes('*')||(user.opdIds||[]).includes('*'))return 'Semua OPD (termasuk OPD baru)';const names=[...(user.opdNames||[])];if(names.length)return names.join(', ');if((user.opdIds||[]).length)return `ID: ${(user.opdIds||[]).join(', ')}`;return user.role==='opd'?'Cakupan OPD belum diatur':'Lintas OPD sesuai role';}
function accountDate(value){if(!value)return 'Belum pernah';try{return new Date(Number(value)).toLocaleString('id-ID');}catch{return '-';}}
function setAccountStatus(message,kind=''){const el=document.getElementById('accountUserStatus');if(el){el.textContent=message;el.style.color=kind==='error'?'#b91c1c':(kind==='success'?'#047857':'var(--text-secondary)');}}
async function loadAuthUsers(){
  const tbody=document.getElementById('accountUsersTable');if(tbody)tbody.innerHTML='<tr><td colspan="6" style="padding:14px;text-align:center;">Memuat akun...</td></tr>';
  try{const result=await callServer('listAuthUsers',{});const users=Array.isArray(result.users)?result.users:[];if(!tbody)return;
    if(!users.length){tbody.innerHTML='<tr><td colspan="6" style="padding:14px;text-align:center;">Belum ada akun yang terdaftar.</td></tr>';return;}
    tbody.innerHTML=users.map(u=>{const self=String(u.username||'').toLowerCase()===String(currentUser?.username||'').toLowerCase();const status=u.enabled?'<span style="color:#047857;font-weight:700;">Aktif</span>':'<span style="color:#b91c1c;font-weight:700;">Nonaktif</span>';return `<tr style="border-top:1px solid var(--border);"><td style="padding:10px;"><strong>${escapeHtml(u.username)}</strong><br><span style="color:var(--text-secondary);">${escapeHtml(u.displayName||'')}</span></td><td style="padding:10px;">${escapeHtml(accountRoleLabel(u.role))}</td><td style="padding:10px;max-width:300px;white-space:normal;">${escapeHtml(accountScopeLabel(u))}</td><td style="padding:10px;">${status}</td><td style="padding:10px;white-space:nowrap;">${escapeHtml(accountDate(u.lastLoginAt))}</td><td style="padding:10px;white-space:nowrap;"><button type="button" class="account-reset-btn" data-username="${escapeHtml(u.username)}" style="padding:7px 9px;margin:2px;">Reset sandi</button>${self?'':`<button type="button" class="account-toggle-btn" data-username="${escapeHtml(u.username)}" data-enabled="${u.enabled?'false':'true'}" style="padding:7px 9px;margin:2px;">${u.enabled?'Nonaktifkan':'Aktifkan'}</button>`}</td></tr>`;}).join('');
    tbody.querySelectorAll('.account-reset-btn').forEach(button=>button.addEventListener('click',()=>openAccountPasswordReset(button.dataset.username)));
    tbody.querySelectorAll('.account-toggle-btn').forEach(button=>button.addEventListener('click',async()=>{const username=button.dataset.username;const enabled=button.dataset.enabled==='true';if(!confirm(`${enabled?'Aktifkan':'Nonaktifkan'} akun ${username}?${enabled?'':' Sesi aktif akun akan dicabut.'}`))return;button.disabled=true;try{const r=await callServer('setAuthUserEnabled',{username,enabled});setAccountStatus(r.message||'Status akun diperbarui.','success');await loadAuthUsers();}catch(e){alert('Gagal mengubah status akun: '+e.message);}finally{button.disabled=false;}}));
  }catch(err){if(tbody)tbody.innerHTML=`<tr><td colspan="6" style="padding:14px;color:#b91c1c;">Gagal memuat daftar akun: ${escapeHtml(err.message||String(err))}</td></tr>`;}
}
document.getElementById('btnAccountManagementNav')?.addEventListener('click',async()=>{if(currentUser?.role!=='admin'){alert('Hanya Super Admin yang dapat mengelola akun.');return;}populateAccountOpdOptions();updateAccountRoleFields();document.getElementById('accountManagementModal')?.classList.add('active');setAccountStatus('');await loadAuthUsers();});
document.getElementById('accountManagementClose')?.addEventListener('click',()=>document.getElementById('accountManagementModal')?.classList.remove('active'));
document.getElementById('accountReloadBtn')?.addEventListener('click',loadAuthUsers);
let accountResetTargetUsername='';
function openAccountPasswordReset(username){accountResetTargetUsername=String(username||'');document.getElementById('accountResetPasswordTarget').textContent=`Akun: ${accountResetTargetUsername}`;document.getElementById('accountResetPassword1').value='';document.getElementById('accountResetPassword2').value='';document.getElementById('accountResetPasswordStatus').textContent='';document.getElementById('accountResetPasswordStatus').style.color='var(--text-secondary)';document.getElementById('accountResetPasswordModal').classList.add('active');setTimeout(()=>document.getElementById('accountResetPassword1')?.focus(),50);}
function closeAccountPasswordReset(){document.getElementById('accountResetPasswordModal')?.classList.remove('active');accountResetTargetUsername='';document.getElementById('accountResetPassword1').value='';document.getElementById('accountResetPassword2').value='';}
document.getElementById('accountResetPasswordCancel')?.addEventListener('click',closeAccountPasswordReset);
document.getElementById('accountResetPasswordForm')?.addEventListener('submit',async event=>{event.preventDefault();if(currentUser?.role!=='admin'||!accountResetTargetUsername){document.getElementById('accountResetPasswordStatus').textContent='Akses tidak diizinkan.';return;}const password=document.getElementById('accountResetPassword1').value;const confirmPassword=document.getElementById('accountResetPassword2').value;const status=document.getElementById('accountResetPasswordStatus');if(password.length<16){status.textContent='Password minimal 16 karakter.';status.style.color='#b91c1c';return;}if(password!==confirmPassword){status.textContent='Konfirmasi password tidak sama.';status.style.color='#b91c1c';return;}const button=document.getElementById('accountResetPasswordSubmit');button.disabled=true;button.textContent='Menyimpan…';status.textContent='Memproses reset password…';try{const result=await callServer('resetAuthUserPassword',{username:accountResetTargetUsername,password});status.textContent=result.message||'Password berhasil direset.';status.style.color='#047857';await loadAuthUsers();setTimeout(closeAccountPasswordReset,700);}catch(err){status.textContent=err.message||'Reset password gagal.';status.style.color='#b91c1c';}finally{button.disabled=false;button.textContent='Simpan Password';}});
accountRoleField?.addEventListener('change',updateAccountRoleFields);
document.getElementById('accountUserForm')?.addEventListener('submit',async event=>{event.preventDefault();if(currentUser?.role!=='admin'){setAccountStatus('Akses hanya untuk Super Admin.','error');return;}const username=document.getElementById('accountUsername').value.trim();const displayName=document.getElementById('accountDisplayName').value.trim();const role=String(accountRoleField?.value||'opd');const password=document.getElementById('accountPassword').value;const opdName=document.getElementById('accountOpdName').value;
  if(password.length<16){setAccountStatus('Password minimal 16 karakter.','error');return;}if(role==='opd'&&!opdName){setAccountStatus('Pilih OPD untuk akun Operator.','error');return;}const button=document.getElementById('accountCreateBtn');button.disabled=true;button.textContent='Menyimpan…';setAccountStatus('Membuat akun…');
  try{const r=await callServer('createAuthUser',{username,displayName,role,password,opdName,year:String(currentYear)});setAccountStatus(r.message||'Akun berhasil dibuat.','success');document.getElementById('accountUsername').value='';document.getElementById('accountDisplayName').value='';document.getElementById('accountPassword').value='';document.getElementById('accountOpdName').value='';await loadAuthUsers();}catch(err){setAccountStatus(err.message||'Gagal membuat akun.','error');}finally{button.disabled=false;button.textContent='＋ Buat Akun';}
});
updateAccountRoleFields();

// ====== MODAL HAPUS OPD ======
let deleteTargetId = null;
function openConfirmModal(id) {
  deleteTargetId = id;
  let message = '';
  if (id === 'all') {
    message = 'Yakin ingin menghapus SEMUA data OPD?';
  } else {
    const row = rows.find(r => r.id === id);
    const opdName = row ? row.opd : 'OPD ini';
    message = `Yakin ingin menghapus OPD "${opdName}"?`;
  }
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmPassword').value = '';
  document.getElementById('confirmError').style.display = 'none';
  document.getElementById('confirmModal').classList.add('active');
}
function closeConfirmModal() {
  document.getElementById('confirmModal').classList.remove('active');
  document.getElementById('confirmPassword').value = '';
  document.getElementById('confirmError').style.display = 'none';
}
document.getElementById('togglePassword').addEventListener('click', function() {
  const input = document.getElementById('confirmPassword');
  if (input.type === 'password') {
    input.type = 'text';
    this.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  } else {
    input.type = 'password';
    this.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
});
document.getElementById('confirmOk').addEventListener('click', async function() {
  const password = document.getElementById('confirmPassword').value.trim();
  const errorDiv = document.getElementById('confirmError');
  const btnOk = this;

  btnOk.disabled = true;
  btnOk.textContent = '⏳ Menghapus...';

  try {
    const valid = await verifyDelete(password);
    if (!valid) {
      errorDiv.textContent = '❌ Password hapus salah!';
      errorDiv.style.display = 'block';
      errorDiv.style.background = '#fee2e2';
      errorDiv.style.color = '#dc2626';
      return;
    }

    const result = await callServer('deleteOpd', { opdId: deleteTargetId, year: currentYear });
    if (result.status === 'error') {
      errorDiv.textContent = '❌ ' + result.message;
      errorDiv.style.display = 'block';
      errorDiv.style.background = '#fee2e2';
      errorDiv.style.color = '#dc2626';
      return;
    }

    await loadData();
    closeConfirmModal();
  } catch (err) {
    errorDiv.textContent = '❌ Terjadi kesalahan: ' + err.message;
    errorDiv.style.display = 'block';
    errorDiv.style.background = '#fee2e2';
    errorDiv.style.color = '#dc2626';
  } finally {
    btnOk.disabled = false;
    btnOk.textContent = 'Ya, Hapus';
  }
});

// ====== MODAL EDIT SUBUNSUR ======
// Pengurutan kode SPIP bertingkat harus berdasarkan setiap segmen angka.
// Contoh: 3.2 < 3.10 < 3.11 (bukan berdasarkan nilai desimal).
function compareSpipCode(a, b) {
  const pa = String(a ?? '').split('.').map(v => Number(v));
  const pb = String(b ?? '').split('.').map(v => Number(v));
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const va = Number.isFinite(pa[i]) ? pa[i] : 0;
    const vb = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

let editingRowId = null;
let editingSubunsurSnapshot = null;
let fileToDelete = null;
let modalAutosaveTimer = null;
let modalAutosaveRunning = false;
async function fetchAuthoritativeRow(opdId){
  try{
    const data=await callServer('getData',{year:currentYear});
    if(!Array.isArray(data)) return null;
    const fresh=data.find(r=>String(r.id)===String(opdId));
    if(!fresh) return null;
    const idx=rows.findIndex(r=>String(r.id)===String(opdId));
    if(idx>=0) rows[idx]=fresh;
    return fresh;
  }catch(err){
    console.warn('Gagal memuat data OPD terbaru:',err);
    return null;
  }
}


// ====== NAVIGASI EVIDENCE STRUKTUR & PROSES ======
// 25 sub-unsur dibagi menjadi 5 unsur SPIP agar pengguna tidak perlu melihat
// seluruh parameter/evidence dalam satu halaman. Struktur data lama tetap dipakai.
const SPIP_UNSUR_INFO = {
  '1': { code:'1', icon:'🧭', title:'Lingkungan Pengendalian', subtitle:'Membangun lingkungan pengendalian yang sehat dan berintegritas' },
  '2': { code:'2', icon:'⚠️', title:'Penilaian Risiko', subtitle:'Mengidentifikasi dan menganalisis risiko pencapaian tujuan' },
  '3': { code:'3', icon:'🛠️', title:'Kegiatan Pengendalian', subtitle:'Menjalankan pengendalian atas proses dan transaksi penting' },
  '4': { code:'4', icon:'💬', title:'Informasi dan Komunikasi', subtitle:'Menjamin informasi relevan dan komunikasi yang efektif' },
  '5': { code:'5', icon:'🔎', title:'Pemantauan', subtitle:'Memantau efektivitas pengendalian secara berkelanjutan' }
};

function parseEvidenceFilesForNavigation(rawFiles) {
  if (Array.isArray(rawFiles)) return rawFiles;
  if (typeof rawFiles === 'string') {
    try {
      const parsed = JSON.parse(rawFiles);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  if (rawFiles && typeof rawFiles === 'object') {
    if (Array.isArray(rawFiles.files)) return rawFiles.files;
    return Object.values(rawFiles).filter(v => typeof v === 'string' || (v && typeof v === 'object'));
  }
  return [];
}

function getSubunsurNavigationSummary(row, subCode) {
  const subInfo = SUBUNSUR_DATA[subCode];
  const files = [];
  let parameters = 0;
  (subInfo?.params || []).forEach(param => {
    parameters++;
    for (let lv = 1; lv <= 5; lv++) {
      files.push(...parseEvidenceFilesForNavigation(row?.subunsurs?.[subCode]?.[param.id]?.['files' + lv]));
    }
  });
  const verification = getFileVerificationSummary(files);
  return { parameters, totalFiles: verification.total, verifiedFiles: verification.verified, percentage: verification.percentage || 0 };
}

function getUnsurNavigationSummary(row, unsurCode) {
  const subCodes = Object.keys(SUBUNSUR_DATA || {}).filter(code => String(code).split('.')[0] === String(unsurCode)).sort(compareSpipCode);
  let parameters = 0, totalFiles = 0, verifiedFiles = 0;
  subCodes.forEach(subCode => {
    const summary = getSubunsurNavigationSummary(row, subCode);
    parameters += summary.parameters;
    totalFiles += summary.totalFiles;
    verifiedFiles += summary.verifiedFiles;
  });
  return {
    subunsurs: subCodes.length,
    parameters,
    totalFiles,
    verifiedFiles,
    percentage: totalFiles ? Math.round((verifiedFiles / totalFiles) * 10000) / 100 : 0
  };
}

function getUnsurNavigationData() {
  return Object.keys(SPIP_UNSUR_INFO).map(code => ({
    ...SPIP_UNSUR_INFO[code],
    subCodes: Object.keys(SUBUNSUR_DATA || {}).filter(subCode => String(subCode).split('.')[0] === code).sort(compareSpipCode)
  }));
}

async function openEditModal(id) {
  let row = rows.find(r => r.id === id);
  if (!row) return;
  const freshRow = await fetchAuthoritativeRow(id);
  if (freshRow) row = freshRow;
  if (!row.subunsurs) row.subunsurs = {};
  Object.keys(SUBUNSUR_DATA).forEach(subCode => {
    if (!row.subunsurs[subCode]) row.subunsurs[subCode] = {};
    SUBUNSUR_DATA[subCode].params.forEach(param => {
      if (!row.subunsurs[subCode][param.id]) row.subunsurs[subCode][param.id] = { level: 0 };
    });
  });
  editingRowId = row.id;
  // Snapshot dipakai untuk mengirim hanya field yang benar-benar berubah.
  editingSubunsurSnapshot = JSON.parse(JSON.stringify(row.subunsurs));
  document.getElementById('modalOpdName').textContent = row.opd || 'Tanpa Nama';
  const container = document.getElementById('subunsurContainer');
  container.innerHTML = '';

  const sortedSubs = Object.keys(SUBUNSUR_DATA).sort(compareSpipCode);

  sortedSubs.forEach(subCode => {
    const subInfo = SUBUNSUR_DATA[subCode];
    const subDiv = document.createElement('div');
    subDiv.className = 'sub-item evidence-sub-panel';
    subDiv.dataset.element = String(subCode).split('.')[0];
    subDiv.dataset.subCode = String(subCode);
    subDiv.innerHTML = `<label>${subInfo.label}</label>`;
    
    const sortedParams = [...subInfo.params].sort((a,b) => compareSpipCode(a.id, b.id));
    
    sortedParams.forEach(param => {
      const rawData = (row.subunsurs[subCode] && row.subunsurs[subCode][param.id]) || { level: 0 };
      const data = { ...rawData, level: Math.max(0, Math.min(5, Number(rawData.level) || 0)) };
      const paramDiv = document.createElement('div');
      paramDiv.style.borderTop = '1px solid var(--border)';
      paramDiv.style.paddingTop = '10px';
      paramDiv.style.marginTop = '10px';
      const paramsHtml = `<div class="parameter-context" aria-label="Identitas sub-unsur dan parameter">
  <div class="parameter-subunsur-title"><span class="parameter-context-label">Sub-Unsur</span><strong>${subInfo.label}</strong></div>
  <div class="params-box"><p><strong style="font-size:14px;">Parameter:</strong> <span class="param-desc-text">${param.desc}</span></p></div>
</div>`;
      const levelSelect = `<div class="level-select"><span style="font-size:12px;color:var(--text-secondary)">Level:</span><select data-sub="${subCode}" data-param="${param.id}" data-field="level"><option value="0" ${data.level === 0 ? 'selected' : ''}>0</option>${[1,2,3,4,5].map(lv => `<option value="${lv}" ${data.level === lv ? 'selected' : ''}>${lv}</option>`).join('')}</select></div>`;
      let evidHtml = `<div class="evid-group">`;
      for (let lv = 1; lv <= 5; lv++) {
        const evid = data['evid' + lv] || '';
        const levelInfo = (param.levels && param.levels[lv - 1]) ? param.levels[lv - 1] : { grade: '?', desc: 'Tidak ada kriteria', evidence: 'Tidak ada evidence', note: 'Tidak ada catatan' };
        evidHtml += `<div class="evid-row" data-sub="${subCode}" data-param="${param.id}" data-level="${lv}">
  <label>Level ${lv} (${levelInfo.grade})</label>
  <div class="guide-box"><strong>📖 Kriteria:</strong><p>${levelInfo.desc}</p><strong>📎 Evidence yang Disarankan:</strong><p>${levelInfo.evidence}</p><strong>📝 Tahapan Grade:</strong><p>${levelInfo.note}</p></div>
  <textarea data-sub="${subCode}" data-param="${param.id}" data-field="evid${lv}" placeholder="Uraian evidence...">${evid}</textarea>
  <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
    <input type="file" multiple data-sub="${subCode}" data-param="${param.id}" data-level="${lv}" accept=".pdf,.doc,.docx,.jpg,.png,.mp4,.webm,.mov,.avi,.mkv,.xlsx,.pptx">
    <small style="color:#64748b;">Maks. 10 MB/file • total pilihan maks. 10 MB • bisa pilih banyak file dengan Ctrl/Shift</small>
  </div>
  <div class="evid-upload-progress" data-sub="${subCode}" data-param="${param.id}" data-level="${lv}"></div>
  <div class="verification-level-summary" data-sub="${subCode}" data-param="${param.id}" data-level="${lv}"></div>
  <div class="file-list" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
</div>`;
      }
      evidHtml += `</div>`;
      paramDiv.innerHTML = paramsHtml + levelSelect + evidHtml;
      subDiv.appendChild(paramDiv);
    });
    container.appendChild(subDiv);
  });

  // Pisahkan tampilan menjadi: 5 Unsur -> daftar Sub-Unsur -> detail parameter/evidence.
  // Semua input lama tetap berada di DOM supaya fitur simpan, draft, autosave, upload,
  // dan verifikasi tetap memakai selector/data-* yang sama.
  const allSubPanels = Array.from(container.querySelectorAll('.evidence-sub-panel'));
  const navRoot = document.createElement('div');
  navRoot.className = 'evidence-structure-nav';

  const navHeader = document.createElement('div');
  navHeader.className = 'evidence-nav-header';
  navHeader.innerHTML = `
    <div class="evidence-nav-title-row">
      <div>
        <div class="evidence-nav-kicker">📁 EVIDENCE STRUKTUR & PROSES</div>
        <h4 class="evidence-nav-title">Pilih Unsur yang ingin dikerjakan</h4>
        <p class="evidence-nav-description">Tampilan dipisah bertahap agar tidak penuh: pilih 1 Unsur → pilih Sub-Unsur → kelola parameter, uraian, upload, dan verifikasi evidence.</p>
      </div>
      <div class="evidence-nav-total-badge"><strong>${Object.keys(SUBUNSUR_DATA || {}).length}</strong><span>Sub-Unsur</span></div>
    </div>
    <div class="evidence-breadcrumb" aria-label="Navigasi Evidence Struktur dan Proses">
      <button type="button" class="evidence-crumb is-active" data-nav-target="unsur">5 Unsur</button>
      <span>›</span>
      <button type="button" class="evidence-crumb" data-nav-target="sub" disabled>Sub-Unsur</button>
      <span>›</span>
      <button type="button" class="evidence-crumb" data-nav-target="detail" disabled>Detail Evidence</button>
    </div>
  `;
  navRoot.appendChild(navHeader);

  const unsurScreen = document.createElement('div');
  unsurScreen.className = 'evidence-nav-screen';
  unsurScreen.dataset.screen = 'unsur';

  const unsurGrid = document.createElement('div');
  unsurGrid.className = 'evidence-unsur-grid';

  const unsurData = getUnsurNavigationData();
  unsurData.forEach(info => {
    const summary = getUnsurNavigationSummary(row, info.code);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'evidence-unsur-card';
    card.dataset.unsur = info.code;
    card.innerHTML = `
      <span class="evidence-unsur-icon">${info.icon}</span>
      <span class="evidence-unsur-code">UNSUR ${info.code}</span>
      <span class="evidence-unsur-title">${escapeHtml(info.title)}</span>
      <span class="evidence-unsur-subtitle">${escapeHtml(info.subtitle)}</span>
      <span class="evidence-unsur-meta">
        <span>${summary.subunsurs} Sub-Unsur</span>
        <span>${summary.parameters} Parameter</span>
      </span>
      <span class="evidence-unsur-progress">
        <span class="evidence-unsur-progress-bar"><i style="width:${Math.max(0, Math.min(100, summary.percentage))}%"></i></span>
        <strong>${summary.totalFiles ? summary.percentage.toFixed(0) + '% terverifikasi' : 'Belum ada file'}</strong>
      </span>
      <span class="evidence-unsur-action">Buka Unsur <span>→</span></span>
    `;
    unsurGrid.appendChild(card);
  });
  unsurScreen.appendChild(unsurGrid);

  const subScreen = document.createElement('div');
  subScreen.className = 'evidence-nav-screen hidden';
  subScreen.dataset.screen = 'sub';

  const subScreenHead = document.createElement('div');
  subScreenHead.className = 'evidence-sub-screen-head';
  subScreenHead.innerHTML = `
    <button type="button" class="evidence-back-btn" data-back="unsur">← Kembali ke 5 Unsur</button>
    <div>
      <div class="evidence-nav-kicker" id="evidenceSelectedUnsurKicker">UNSUR</div>
      <h4 class="evidence-nav-title" id="evidenceSelectedUnsurTitle">Sub-Unsur</h4>
      <p class="evidence-nav-description" id="evidenceSelectedUnsurDescription">Pilih Sub-Unsur.</p>
    </div>
  `;
  subScreen.appendChild(subScreenHead);

  const subGrid = document.createElement('div');
  subGrid.className = 'evidence-subunsur-grid';
  unsurData.forEach(info => {
    info.subCodes.forEach(subCode => {
      const summary = getSubunsurNavigationSummary(row, subCode);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'evidence-subunsur-card';
      card.dataset.element = info.code;
      card.dataset.sub = subCode;
      const label = SUBUNSUR_DATA[subCode]?.label || subCode;
      card.innerHTML = `
        <span class="evidence-subunsur-code">${escapeHtml(subCode)}</span>
        <span class="evidence-subunsur-title">${escapeHtml(label.slice(String(subCode).length).trim())}</span>
        <span class="evidence-subunsur-meta">
          <span>${summary.parameters} Parameter</span>
          <span>${summary.totalFiles} File</span>
        </span>
        <span class="evidence-subunsur-progress">
          <strong>${summary.totalFiles ? summary.percentage.toFixed(0) + '%' : '0%'} verifikasi</strong>
          <span class="evidence-subunsur-progressbar"><i style="width:${Math.max(0, Math.min(100, summary.percentage))}%"></i></span>
        </span>
        <span class="evidence-unsur-action">Buka Sub-Unsur <span>→</span></span>
      `;
      subGrid.appendChild(card);
    });
  });
  subScreen.appendChild(subGrid);

  const detailScreen = document.createElement('div');
  detailScreen.className = 'evidence-nav-screen hidden';
  detailScreen.dataset.screen = 'detail';

  const detailHead = document.createElement('div');
  detailHead.className = 'evidence-detail-head';
  detailHead.innerHTML = `
    <button type="button" class="evidence-back-btn" data-back="sub">← Kembali ke Sub-Unsur</button>
    <div>
      <div class="evidence-nav-kicker" id="evidenceSelectedSubKicker">SUB-UNSUR</div>
      <h4 class="evidence-nav-title" id="evidenceSelectedSubTitle">Detail Evidence</h4>
      <p class="evidence-nav-description">Kelola level, uraian evidence, upload file, serta verifikasi dokumen untuk Sub-Unsur ini.</p>
    </div>
  `;
  detailScreen.appendChild(detailHead);

  const detailBody = document.createElement('div');
  detailBody.className = 'evidence-detail-body';
  allSubPanels.forEach(panel => {
    panel.hidden = true;
    detailBody.appendChild(panel);
  });
  detailScreen.appendChild(detailBody);

  navRoot.appendChild(unsurScreen);
  navRoot.appendChild(subScreen);
  navRoot.appendChild(detailScreen);
  container.innerHTML = '';
  container.appendChild(navRoot);

  const breadcrumbButtons = Array.from(navRoot.querySelectorAll('.evidence-crumb'));
  const screens = {
    unsur: unsurScreen,
    sub: subScreen,
    detail: detailScreen
  };

  function setScreen(name) {
    Object.entries(screens).forEach(([key, screen]) => screen.classList.toggle('hidden', key !== name));
    breadcrumbButtons.forEach(btn => {
      const target = btn.dataset.navTarget;
      btn.classList.toggle('is-active', target === name);
    });
  }

  function selectUnsur(unsurCode) {
    const info = SPIP_UNSUR_INFO[unsurCode];
    if (!info) return;
    subScreen.querySelector('#evidenceSelectedUnsurKicker').textContent = `UNSUR ${info.code}`;
    subScreen.querySelector('#evidenceSelectedUnsurTitle').textContent = info.title;
    subScreen.querySelector('#evidenceSelectedUnsurDescription').textContent = info.subtitle;
    subGrid.querySelectorAll('.evidence-subunsur-card').forEach(card => {
      card.classList.toggle('hidden', card.dataset.element !== String(unsurCode));
    });
    breadcrumbButtons.forEach(btn => {
      if (btn.dataset.navTarget === 'sub') btn.disabled = false;
      if (btn.dataset.navTarget === 'detail') btn.disabled = true;
    });
    setScreen('sub');
    subScreen.scrollIntoView({ block:'start', behavior:'smooth' });
  }

  function selectSubunsur(subCode) {
    const info = SUBUNSUR_DATA[subCode];
    if (!info) return;
    detailScreen.querySelector('#evidenceSelectedSubKicker').textContent = `SUB-UNSUR ${subCode}`;
    detailScreen.querySelector('#evidenceSelectedSubTitle').textContent = info.label;
    allSubPanels.forEach(panel => { panel.hidden = panel.dataset.subCode !== String(subCode); });
    const subElementCode = String(subCode).split('.')[0];
    breadcrumbButtons.forEach(btn => {
      if (btn.dataset.navTarget === 'sub') btn.disabled = false;
      if (btn.dataset.navTarget === 'detail') btn.disabled = false;
    });
    setScreen('detail');
    detailScreen.scrollIntoView({ block:'start', behavior:'smooth' });
  }

  navRoot.querySelectorAll('.evidence-unsur-card').forEach(card => {
    card.addEventListener('click', () => selectUnsur(card.dataset.unsur));
  });
  navRoot.querySelectorAll('.evidence-subunsur-card').forEach(card => {
    card.addEventListener('click', () => selectSubunsur(card.dataset.sub));
  });
  navRoot.querySelectorAll('[data-back="unsur"]').forEach(btn => btn.addEventListener('click', () => {
    breadcrumbButtons.forEach(crumb => {
      if (crumb.dataset.navTarget !== 'unsur') crumb.disabled = true;
    });
    setScreen('unsur');
    unsurScreen.scrollIntoView({ block:'start', behavior:'smooth' });
  }));
  navRoot.querySelectorAll('[data-back="sub"]').forEach(btn => btn.addEventListener('click', () => {
    breadcrumbButtons.forEach(crumb => {
      if (crumb.dataset.navTarget === 'detail') crumb.disabled = true;
      if (crumb.dataset.navTarget === 'sub') crumb.disabled = false;
    });
    setScreen('sub');
    subScreen.scrollIntoView({ block:'start', behavior:'smooth' });
  }));
  breadcrumbButtons.forEach(btn => btn.addEventListener('click', () => {
    if (btn.disabled) return;
    if (btn.dataset.navTarget === 'unsur') {
      breadcrumbButtons.forEach(crumb => { if (crumb.dataset.navTarget !== 'unsur') crumb.disabled = true; });
      setScreen('unsur');
    } else if (btn.dataset.navTarget === 'sub') {
      breadcrumbButtons.forEach(crumb => { if (crumb.dataset.navTarget === 'detail') crumb.disabled = true; });
      setScreen('sub');
    }
  }));

  setScreen('unsur');

  document.getElementById('editModal').classList.add('active');
  sortedSubs.forEach(subCode => {
    SUBUNSUR_DATA[subCode].params.forEach(param => {
      for (let lv = 1; lv <= 5; lv++) renderFileList(row, subCode, param.id, lv);
    });
  });

  restoreModalDraft();
  const syncLiveStructureValue = (el) => {
    if (!el || el.dataset.field !== 'level' || !editingRowId) return;
    const liveRow = rows.find(r => String(r.id) === String(editingRowId));
    if (!liveRow) return;
    liveRow.subunsurs = liveRow.subunsurs || {};
    liveRow.subunsurs[el.dataset.sub] = liveRow.subunsurs[el.dataset.sub] || {};
    liveRow.subunsurs[el.dataset.sub][el.dataset.param] = liveRow.subunsurs[el.dataset.sub][el.dataset.param] || {level:0};
    liveRow.subunsurs[el.dataset.sub][el.dataset.param].level = Math.max(0, Math.min(5, Number(el.value) || 0));
    liveRow.parameterLevels = liveRow.parameterLevels || {};
    liveRow.parameterLevels[`${el.dataset.sub}|${el.dataset.param}`] = liveRow.subunsurs[el.dataset.sub][el.dataset.param].level;
    const bd = getRowStructureProcessBreakdown(liveRow);
    // Selecting a level is an assessment input, not a verified score.
    liveRow.nilaiStrukturProses = bd.value;
    liveRow.sa = bd.value;
    liveRow.strukturProsesStatus = bd.verifiedParams>=bd.totalParams&&bd.totalParams>0?'Selesai':(bd.verifiedParams>0?'Proses':'Belum');
    const tableInput = document.querySelector(`.auto-structure-value[data-id=\"${CSS.escape(String(liveRow.id))}\"]`);
    if (tableInput) tableInput.value = bd.value.toFixed(2);
    updateKpisLocal();
  };
  container.addEventListener('input', (e) => { syncLiveStructureValue(e.target); scheduleModalDraftSave(); });
  container.addEventListener('change', (e) => { syncLiveStructureValue(e.target); scheduleModalDraftSave(); });
  container.addEventListener('input', scheduleModalServerAutosave);
  container.addEventListener('change', scheduleModalServerAutosave);

  container.querySelectorAll('input[type="file"]').forEach(input => {
    input.onchange = async (e) => {
      const fileInput = e.target;
      const subCode = fileInput.dataset.sub;
      const paramId = fileInput.dataset.param;
      const level = fileInput.dataset.level;
      const targetRow = rows.find(r => r.id === editingRowId);
      if (!targetRow) return;
      const fileList = Array.from(fileInput.files);
      if (fileList.length === 0) return;
      try {
        validateSelectedUploadFiles(fileList, 'file');
      } catch (err) {
        showWarning('❌ ' + err.message);
        fileInput.value = '';
        return;
      }

      const progressContainer = document.querySelector(`.evid-upload-progress[data-sub="${subCode}"][data-param="${paramId}"][data-level="${level}"]`);
      if (!progressContainer) {
        showWarning('❌ Area progress upload tidak ditemukan. Silakan buka ulang detail subunsur.');
        fileInput.value = '';
        return;
      }
      progressContainer.classList.add('active');
      progressContainer.innerHTML = '';

      let completed = 0;
      for (const file of fileList) {
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.innerHTML = `
          <div class="progress-label">${file.name}</div>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:0%"></div></div>
          <div class="progress-text">0%</div>
        `;
        progressContainer.appendChild(progressItem);
        const fill = progressItem.querySelector('.progress-bar-fill');
        const text = progressItem.querySelector('.progress-text');

        fill.style.width = '15%';
        text.textContent = 'Mengirim…';
        const sessionUploadId=crypto.randomUUID();

        try {
          const result = await uploadFile(targetRow, subCode, paramId, level, file, sessionUploadId);
          if (result.syncStatus === 'done') await deletePendingUploadFromIndexedDB(sessionUploadId);
          else await savePendingUploadToIndexedDB({uploadId:sessionUploadId,opdId:targetRow.id,opdName:targetRow.opd||'OPD',subCode,paramId,level:String(level),year:currentYear,file,fileName:file.name,fileType:file.type||'application/octet-stream',createdAt:Date.now(),r2Key:result.r2Key||null,url:result.url||''});
          fill.style.width = '100%';
          text.textContent = result.syncStatus === 'done' ? '100% • Drive OK' : '100% • Retry Drive';
           const fileArray=ensureEvidenceFileArray(targetRow.subunsurs=targetRow.subunsurs||{},subCode,paramId,level);
           const uploadItem={
             url: result.url,
             fileName: result.fileName || file.name,
             gdriveId: result.gdriveId || null,
             syncStatus: result.syncStatus || 'pending',
             syncError: result.driveError || null,
             r2Key: result.r2Key || null,
             fileType: file.type || 'application/octet-stream',
             uploadId: result.uploadId || sessionUploadId,
             uploadedAt: new Date().toISOString()
           };
           const existingUpload=fileArray.find(x=>x && typeof x==='object' && x.uploadId===uploadItem.uploadId);
           if(existingUpload) Object.assign(existingUpload,uploadItem); else fileArray.push(uploadItem);
          renderFileList(targetRow, subCode, paramId, level);
          completed++;
          setTimeout(() => {
            progressItem.remove();
            if (progressContainer.children.length === 0) progressContainer.classList.remove('active');
          }, 1000);
        } catch (err) {
          // Retry otomatis dengan uploadId yang SAMA. Ini aman terhadap response 500
          // yang sebenarnya sudah sempat menyimpan file di R2/D1/Drive.
          let recovered=false;
          for(let retry=1; retry<=2; retry++) {
            if(!err?.transient) break;
            text.textContent=`Retry ${retry}/2…`;
            try {
              await new Promise(r=>setTimeout(r,700*retry));
              const result=await uploadFile(targetRow,subCode,paramId,level,file,sessionUploadId);
               const fileArray=ensureEvidenceFileArray(targetRow.subunsurs=targetRow.subunsurs||{},subCode,paramId,level);
               const uploadItem={url:result.url,fileName:result.fileName||file.name,gdriveId:result.gdriveId||null,syncStatus:result.syncStatus||'pending',syncError:result.driveError||null,r2Key:result.r2Key||null,fileType:file.type||'application/octet-stream',uploadId:result.uploadId||sessionUploadId,uploadedAt:new Date().toISOString()};
               const existingUpload=fileArray.find(x=>x && typeof x==='object' && x.uploadId===uploadItem.uploadId);
               if(existingUpload) Object.assign(existingUpload,uploadItem); else fileArray.push(uploadItem);
              renderFileList(targetRow,subCode,paramId,level);
              fill.style.width='100%'; text.textContent=result.syncStatus==='done'?'100% • Drive OK':'100% • Retry Drive';
              pendingUploadFiles.delete(sessionUploadId); await deletePendingUploadFromIndexedDB(sessionUploadId); recovered=true; completed++; break;
            } catch(e) { err=e; }
          }
          if(!recovered){
            // Simpan File asli selama halaman masih terbuka agar tombol Retry dapat
            // mengulang upload dengan uploadId yang sama.
            pendingUploadFiles.set(sessionUploadId,file);
            await savePendingUploadToIndexedDB({uploadId:sessionUploadId,opdId:targetRow.id,opdName:targetRow.opd||'OPD',subCode,paramId,level:String(level),year:currentYear,file,fileName:file.name,fileType:file.type||'application/octet-stream',createdAt:Date.now()});
             const list=ensureEvidenceFileArray(targetRow.subunsurs=targetRow.subunsurs||{},subCode,paramId,level);
             const pendingItem={url:'',fileName:file.name,gdriveId:null,syncStatus:'retrying',syncError:err.message,r2Key:null,fileType:file.type||'application/octet-stream',uploadId:sessionUploadId,localPending:true,uploadedAt:new Date().toISOString()};
             const existingPending=list.find(x=>x && typeof x==='object' && x.uploadId===sessionUploadId);
             if(existingPending) Object.assign(existingPending,pendingItem); else list.push(pendingItem);
            renderFileList(targetRow,subCode,paramId,level);
            fill.style.width='100%'; text.textContent='100% • Retry tersedia';
            showWarning('⚠️ Upload gagal sementara. File tidak dibuang. Tombol Retry tersedia.');
          }
        }

      }
      fileInput.value = '';
    };
  });
}

// ====== UPLOAD FILE ======
// Pertahankan aturan upload yang sudah ada: maksimal 10 MB per file dan
// maksimal total 10 MB per satu sesi pemilihan. File dalam satu sesi tetap diproses berurutan.
const MAX_FILE_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_BATCH_UPLOAD_BYTES = 10 * 1024 * 1024;

function validateSelectedUploadFiles(files, label='file') {
  const list = Array.from(files || []);
  if (!list.length) return;
  const tooBig = list.filter(f => (Number(f.size) || 0) > MAX_FILE_UPLOAD_BYTES);
  if (tooBig.length) {
    throw new Error(`${tooBig.length} ${label} melebihi 10 MB per file: ${tooBig[0].name}`);
  }
  const total = list.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
  if (total > MAX_BATCH_UPLOAD_BYTES) {
    const totalMb = (total / 1024 / 1024).toFixed(2);
    throw new Error(`Total ${label} yang dipilih ${totalMb} MB. Maksimal total 10 MB per sekali pilih/upload; pecah menjadi beberapa sesi.`);
  }
}

async function uploadFile(row, subCode, paramId, level, file, existingUploadId=null) {
  if(!file)return;
  if(file.size>MAX_FILE_UPLOAD_BYTES)throw new Error('File terlalu besar! Maks 10 MB per file.');
  const uploadId=existingUploadId||crypto.randomUUID();
  const payload={__binaryFile:file,opdId:row.id,opdName:row.opd||'OPD',subunsur:subCode,paramId,level:String(level),year:currentYear,fileName:file.name,fileType:file.type||'application/octet-stream',uploadId};
  const result=await callServerWithRetry('uploadFile',payload,3);
  return {url:result.url,fileName:result.fileName,gdriveId:result.googleDriveId||result.gdriveId||null,syncStatus:result.syncStatus||'pending',uploadId:result.uploadId||uploadId,r2Key:result.r2Key||null,driveError:result.driveError||null};
}

// Fungsi untuk membuat URL preview berdasarkan jenis file
function getPreviewUrl(fileUrl, fileName) {
  const ext = fileName.split('.').pop().toLowerCase();

  if (['pdf', 'doc', 'docx', 'ppt', 'pptx'].includes(ext)) {
    const encodedUrl = encodeURIComponent(fileUrl);
    return `https://docs.google.com/viewer?embedded=true&url=${encodedUrl}`;
  }

  if (['xls', 'xlsx'].includes(ext)) {
    const encodedUrl = encodeURIComponent(fileUrl);
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodedUrl}`;
  }

  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return fileUrl;
  }

  return fileUrl;
}

function ensureEvidenceFileArray(container, subCode, paramId, level){
  container = container || {};
  container[subCode] = container[subCode] || {};
  container[subCode][paramId] = container[subCode][paramId] || {};
  const key = 'files' + level;
  const current = container[subCode][paramId][key];
  if (Array.isArray(current)) return current;
  if (typeof current === 'string') {
    try{
      const parsed = JSON.parse(current);
      if(Array.isArray(parsed)){
        container[subCode][paramId][key] = parsed;
        return parsed;
      }
    }catch(_){}
  }
  const arr = [];
  container[subCode][paramId][key] = arr;
  return arr;
}


async function replaceStructureEvidenceFile(row, subCode, paramId, level, uploadId, file, ui) {
  if (!row || !uploadId || !file) return;
  if (file.size > MAX_FILE_UPLOAD_BYTES) throw new Error('File terlalu besar! Maks 10 MB per file.');
  if (ui?.button) { ui.button.disabled = true; ui.button.textContent = '⏳ Mengganti...'; }
  try {
    const d = await callServerWithRetry('replaceEvidenceFile', {
      __binaryFile: file,
      opdId: row.id,
      subunsur: subCode,
      paramId,
      level: String(level),
      year: currentYear,
      uploadId,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream'
    }, 3);
    const item = row.subunsurs?.[subCode]?.[paramId]?.['files' + level];
    const fileObj = Array.isArray(item) ? item.find(x => x && typeof x === 'object' && x.uploadId === uploadId) : null;
    if (fileObj && d.file) Object.assign(fileObj, d.file);
    renderFileList(row, subCode, paramId, level);
    const summary = getRowStructureVerificationSummary(row);
    row.structureVerificationSummary = summary;
    updateStructureVerificationTableSummary(row);
    render();
    showWarning('✅ File sudah diganti di R2 dan Google Drive. File lama tidak dibuat sebagai file tambahan. Menunggu verifikasi Inspektorat.');
  } finally {
    if (ui?.button) { ui.button.disabled = false; ui.button.textContent = '↻ Ganti File'; }
  }
}

function attachStructureReplacementInput(div, row, subCode, paramId, level, uploadId) {
  const button = div.querySelector('.replace-evidence-btn');
  const input = div.querySelector('.replace-evidence-input');
  if (!button || !input) return;
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await replaceStructureEvidenceFile(row, subCode, paramId, level, uploadId, file, {button});
    } catch (err) {
      showWarning('❌ Ganti file gagal: ' + (err.message || err));
    }
  });
}

function renderFileList(row, subCode, paramId, level) {
  const rowEl = document.querySelector(`.evid-row[data-sub="${subCode}"][data-param="${paramId}"][data-level="${level}"]`);
  if (!rowEl) return;
  const fileListEl = rowEl.querySelector('.file-list');
  if (!fileListEl) return;

  const rawFiles = (row.subunsurs?.[subCode]?.[paramId]?.['files' + level]);
  let files = [];
  if (Array.isArray(rawFiles)) {
    files = rawFiles;
  } else if (typeof rawFiles === 'string') {
    try { const parsed = JSON.parse(rawFiles); files = Array.isArray(parsed) ? parsed : []; } catch (_) { files = []; }
  } else if (rawFiles && typeof rawFiles === 'object') {
    if (Array.isArray(rawFiles.files)) files = rawFiles.files;
    else files = Object.values(rawFiles).filter(v => typeof v === 'string' || (v && typeof v === 'object'));
  }

  const summaryEl = rowEl.querySelector('.verification-level-summary');
  const summary = getFileVerificationSummary(files);
  if (summaryEl) {
    summaryEl.innerHTML = files.length
      ? `<strong>Persentase Verifikasi Level ${escapeHtml(level)}: ${summary.percentage.toFixed(0)}%</strong><span>Verifikasi selesai ${summary.progress.toFixed(0)}% · ${summary.total} file · Diterima ${summary.accepted} · Catatan ${summary.withNotes} · Dikembalikan ${summary.returned}</span>`
      : `<span>Belum ada file untuk diverifikasi pada Level ${escapeHtml(level)}.</span>`;
  }

  fileListEl.innerHTML = '';
  if (!files.length) {
    fileListEl.innerHTML = '<span style="font-size:12px;color:#64748b;">Belum ada file.</span>';
    return;
  }

  files.forEach((fileObj, index) => {
    let fileUrl = '', fileName = '';
    const isObject = fileObj && typeof fileObj === 'object';
    if (typeof fileObj === 'string') {
      fileUrl = fileObj;
      const urlParts = fileUrl.split('?')[0].split('/');
      fileName = decodeURIComponent(urlParts[urlParts.length - 1]) || `File ${index + 1}`;
    } else {
      fileUrl = fileObj?.url || '';
      fileName = fileObj?.fileName || fileObj?.name || `File ${index + 1}`;
    }

    const ext = fileName.split('.').pop().toLowerCase();
    const fileType = String(fileObj?.fileType || 'application/octet-stream');
    const previewAction = isObject && fileObj.uploadId
      ? `<button type="button" class="file-action evidence-preview-btn" data-opd-id="${escapeHtml(row.id)}" data-upload-id="${escapeHtml(fileObj.uploadId)}" data-file-name="${escapeHtml(fileName)}" data-file-type="${escapeHtml(fileType)}">👁 Pratinjau</button>`
      : '';
    const fileTitle = isObject && fileObj.uploadId
      ? `<button type="button" class="file-name-preview" data-opd-id="${escapeHtml(row.id)}" data-upload-id="${escapeHtml(fileObj.uploadId)}" data-file-name="${escapeHtml(fileName)}" data-file-type="${escapeHtml(fileType)}">📎 ${escapeHtml(fileName)}</button>`
      : `<a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer" class="file-link">📎 ${escapeHtml(fileName)}</a>`;

    const div = document.createElement('div');
    div.className = 'evidence-file-card';
    const status = isObject ? (fileObj.syncStatus || (fileObj.gdriveId ? 'done' : 'pending')) : 'pending';
    const statusLabel = status === 'done' ? '✅ R2 + Google Drive' : (status === 'retrying' ? '🔄 Perlu Retry Google Drive' : '⏳ Menyimpan ke R2 + Google Drive');
    const retryButton = (status !== 'done') && isObject && fileObj.uploadId ? `<button type="button" onclick="retryUploadedFile('${row.id}','${subCode}','${paramId}',${level},'${fileObj.uploadId}')" class="file-action retry">↻ Retry</button>` : '';

    const verification = normalizeVerification(fileObj?.verification);
    const verifiedClass = verification.status ? ` is-${verification.status}` : '';
    const canVerify = isObject && !!fileObj.uploadId;
    const canReplace = canVerify && verification.status === 'dikembalikan';
    const replacementNotice = fileObj?.replacementStatus === 'menunggu_verifikasi'
      ? `<div class="file-replacement-notice">✅ File sudah diganti${fileObj.replacedAt ? ' pada ' + escapeHtml(formatVerificationDate(fileObj.replacedAt)) : ''}. File lama tidak diduplikasi. Menunggu verifikasi Inspektorat.</div>`
      : '';
    const replaceHtml = canReplace ? `<button type="button" class="file-action replace-evidence-btn">↻ Ganti File</button><input type="file" class="replace-evidence-input" hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.webm,.mov,.avi,.mkv,.xlsx,.xls,.ppt,.pptx">` : '';
    const canLegacyVerify = ['admin','auditor','ppupd','irban'].includes(String(currentUser?.role||''));
    const workflowButton = canVerify ? `<button type="button" class="file-action evidence-workflow-btn" data-opd-id="${escapeHtml(row.id)}" data-upload-id="${escapeHtml(fileObj.uploadId)}" data-file-name="${escapeHtml(fileName)}">🛡️ Alur Verifikasi</button>` : '';
    const verifyHtml = (canVerify && canLegacyVerify) ? `
      <div class="file-verification-panel${verifiedClass}">
        <div class="file-verification-head"><strong>🛡️ Verifikasi Inspektorat</strong><span class="verification-score-badge">${getVerificationScore(fileObj)}%</span></div>
        ${replacementNotice}
        <div class="verification-form-grid">
          <label>Nama Pemeriksa<input type="text" maxlength="100" class="verify-examiner" value="${escapeHtml(verification.examinerName)}" placeholder="Ketik nama pemeriksa"></label>
          <label>Hasil Verifikasi<select class="verify-status">${verificationStatusOptions(verification.status)}</select></label>
        </div>
        <label class="verify-note-label">Catatan Pemeriksa<textarea maxlength="1000" class="verify-note" placeholder="Catatan, alasan pengembalian, atau koreksi yang perlu ditindaklanjuti...">${escapeHtml(verification.note)}</textarea></label>
        <div class="verification-save-row"><span class="verification-updated">${verification.verifiedAt ? 'Diverifikasi: ' + escapeHtml(formatVerificationDate(verification.verifiedAt)) : 'Belum diverifikasi'}</span><button type="button" class="verification-save-btn" data-verify-evidence="1">💾 Simpan Verifikasi</button>${replaceHtml}</div>
      </div>` : (canVerify ? `<div class="file-verification-legacy">Alur audit: Auditor mengirim → Irban memverifikasi → BPKP memutuskan verifikasi akhir.${replacementNotice}${replaceHtml}</div>` : `
      <div class="file-verification-legacy">⚠️ File lama belum memiliki identitas upload. Upload ulang file ini untuk mengaktifkan verifikasi per file.</div>`);

    div.innerHTML = `
      <div class="evidence-file-main">
        ${fileTitle}
        ${previewAction}
        ${workflowButton}
        <span class="evidence-storage-status">${statusLabel}</span>
        ${retryButton}
        <button type="button" class="file-action delete" onclick="removeUploadedFile('${row.id}', '${subCode}', '${paramId}', ${level}, '${String(fileUrl).replace(/'/g, "\\'")}', ${index})">🗑️ Hapus</button>
      </div>
      ${verifyHtml}
    `;
    if (canVerify && canLegacyVerify) {
      const saveBtn = div.querySelector('.verification-save-btn');
      div.dataset.uploadId = fileObj.uploadId;
      saveBtn.dataset.uploadId = fileObj.uploadId;
      saveBtn.dataset.sub = subCode;
      saveBtn.dataset.param = paramId;
      saveBtn.dataset.level = String(level);
      saveBtn.addEventListener('click', async () => {
        const statusEl = div.querySelector('.verification-updated');
        try {
          statusEl.textContent = '⏳ Menyimpan verifikasi...';
          await saveEvidenceVerification(row, subCode, paramId, level, fileObj.uploadId, {
            name: div.querySelector('.verify-examiner'),
            note: div.querySelector('.verify-note'),
            status: div.querySelector('.verify-status'),
            button: saveBtn
          });
        } catch (err) {
          statusEl.textContent = '❌ ' + (err.message || err);
          statusEl.style.color = '#b91c1c';
        }
      });
    }
    if (canReplace) attachStructureReplacementInput(div, row, subCode, paramId, level, fileObj.uploadId);
    fileListEl.appendChild(div);
  });
}

async function retryUploadedFile(opdId, subCode, paramId, level, uploadId) {
  const row = rows.find(r => r.id === opdId); if(!row) return;
  const rawFiles = row.subunsurs?.[subCode]?.[paramId]?.['files'+level];
  const files = Array.isArray(rawFiles) ? rawFiles : [];
  const item = files.find(f => typeof f === 'object' && f.uploadId === uploadId); if(!item) return;
  try {
    item.syncStatus='retrying'; renderFileList(row,subCode,paramId,level);
    if(item.localPending){
      const localFile=pendingUploadFiles.get(uploadId);
      if(!localFile) throw new Error('File lokal untuk retry sudah tidak tersedia. Silakan pilih file kembali.');
      const r=await uploadFile(row,subCode,paramId,level,localFile,uploadId);
      Object.assign(item,{url:r.url||item.url,fileName:r.fileName||item.fileName,gdriveId:r.gdriveId||null,syncStatus:r.syncStatus||'pending',syncError:r.driveError||null,r2Key:r.r2Key||null,localPending:false});
      pendingUploadFiles.delete(uploadId);
      await deletePendingUploadFromIndexedDB(uploadId);
      renderFileList(row,subCode,paramId,level); render();
      showWarning(item.gdriveId?'✅ R2 + Google Drive tersimpan.':'🔄 Google Drive belum berhasil. Silakan Retry.');
      return;
    }
    const r = await callServerWithRetry('retryDriveBackup',{opdId,year:currentYear,uploadId,type:'evidence',subunsur:subCode,paramId,level,r2Key:item.r2Key,url:item.url,fileName:item.fileName,fileType:item.fileType},2);
    item.gdriveId=r.gdriveId||item.gdriveId||null;
    item.syncStatus=r.syncStatus||'retrying';
    item.syncError=r.driveError||null;
    if(item.gdriveId) item.storage='R2 + Google Drive';
    renderFileList(row,subCode,paramId,level); render();
    showWarning(item.gdriveId ? '✅ R2 + Google Drive tersimpan.' : '🔄 Google Drive belum berhasil. Silakan Retry.');
  } catch(err) {
    item.syncStatus='retrying'; item.syncError=err.message; renderFileList(row,subCode,paramId,level);
    showWarning('❌ Retry Google Drive gagal: '+err.message);
  }
}

async function autoRetryPendingDriveBackups(){
  if(!navigator.onLine || !Array.isArray(rows)) return;
  const tasks=[];
  for(const row of rows){
    const subunsurs=row?.subunsurs||{};
    for(const subCode of Object.keys(subunsurs)){
      const params=subunsurs[subCode]||{};
      for(const paramId of Object.keys(params)){
        for(let level=1;level<=5;level++){
          const files=params[paramId]?.['files'+level];
          if(!Array.isArray(files)) continue;
          for(const pending of files){
            if(!pending || typeof pending!=='object' || !pending.uploadId || pending.syncStatus==='done') continue;
            tasks.push({row,subCode,paramId,level,pending});
          }
        }
      }
    }
  }
  for(const row of rows){
    for(const type of ['pm_spip','rr_rtp']){
      for(const pending of reportListForRow(row,type)){
        if(!pending || typeof pending!=='object' || !pending.uploadId || pending.syncStatus==='done') continue;
        tasks.push({row,reportType:type,pending});
      }
    }
  }
  // Drive retry is continuous, but concurrency is deliberately limited to 3 files at a time.
  const worker=async(task)=>{
    if(task.reportType){
      const {row,reportType,pending}=task;
      try{
        const r=await callServerWithRetry('retryDriveBackup',{opdId:row.id,year:currentYear,uploadId:pending.uploadId,type:'report',reportType},1);
        if(r?.gdriveId){pending.gdriveId=r.gdriveId;pending.syncStatus='done';pending.storage='R2 + Google Drive';pending.syncError=null;}
        else{pending.syncStatus='retrying';pending.syncError=r?.driveError||pending.syncError||'Menunggu Google Drive';const attempt=Number(pending.retryCount||0)+1;pending.retryCount=attempt;pending.nextRetryAt=Date.now()+Math.min(300000,2000*Math.pow(2,Math.min(attempt,8)))+Math.floor(Math.random()*1500);}
        setReportListForRow(row,reportType,reportListForRow(row,reportType));
        return;
      }catch(err){pending.syncStatus='retrying';pending.syncError=err?.message||String(err);const attempt=Number(pending.retryCount||0)+1;pending.retryCount=attempt;pending.nextRetryAt=Date.now()+Math.min(300000,2000*Math.pow(2,Math.min(attempt,8)))+Math.floor(Math.random()*1500);return;}
    }
    const {row,subCode,paramId,level,pending}=task;
    try{
      const r=await callServerWithRetry('retryDriveBackup',{
        opdId:row.id,year:currentYear,uploadId:pending.uploadId,type:'evidence',subunsur:subCode,paramId,level
      },1);
      if(r?.gdriveId){
        pending.gdriveId=r.gdriveId;
        pending.syncStatus='done';
        pending.storage='R2 + Google Drive';
        pending.syncError=null;
      }else{
        pending.syncStatus='retrying';
        pending.syncError=r?.driveError||pending.syncError||'Menunggu Google Drive';
        const attempt=Number(pending.retryCount||0)+1;
        pending.retryCount=attempt;
        pending.nextRetryAt=Date.now()+Math.min(300000,2000*Math.pow(2,Math.min(attempt,8)))+Math.floor(Math.random()*1500);
      }
      renderFileList(row,subCode,paramId,level);
    }catch(err){
      pending.syncStatus='retrying';
      pending.syncError=err?.message||String(err);
      const attempt=Number(pending.retryCount||0)+1;
      pending.retryCount=attempt;
      pending.nextRetryAt=Date.now()+Math.min(300000,2000*Math.pow(2,Math.min(attempt,8)))+Math.floor(Math.random()*1500);
      renderFileList(row,subCode,paramId,level);
    }
  };
  let index=0;
  const workers=Array.from({length:Math.min(3,tasks.length)},async()=>{
    while(index<tasks.length){
      const task=tasks[index++];
      await worker(task);
    }
  });
  await Promise.all(workers);
}
function removeUploadedFile(opdId, subCode, paramId, level, fileUrl, fileIndex) {
  const row = rows.find(r => String(r.id) === String(opdId));
  if (!row) return;
  const holder = row.subunsurs?.[subCode]?.[paramId];
  const files = Array.isArray(holder?.['files' + level]) ? holder['files' + level] : [];
  // Support BOTH formats that exist in older data: plain URL strings and
  // modern file objects {url, fileName, gdriveId, uploadId, ...}.
  const parsedFileIndex = Number.isInteger(Number(fileIndex)) ? Number(fileIndex) : -1;
  const indexedFile = parsedFileIndex >= 0 && parsedFileIndex < files.length ? files[parsedFileIndex] : null;
  const fileObj = indexedFile ?? files.find(f =>
    (typeof f === 'string' && f === fileUrl) ||
    (f && typeof f === 'object' && f.url === fileUrl)
  );
  const fileName = typeof fileObj === 'string'
    ? (decodeURIComponent(String(fileObj).split('?')[0].split('/').pop() || 'File'))
    : (fileObj?.fileName || fileObj?.name || 'File');
  fileToDelete = {
    opdId,
    subCode,
    paramId,
    level,
    fileUrl,
    fileName,
    gdriveId: (fileObj && typeof fileObj === 'object') ? (fileObj.gdriveId || fileObj.googleDriveId || null) : null,
    uploadId: (fileObj && typeof fileObj === 'object') ? (fileObj.uploadId || null) : null,
    r2Key: (fileObj && typeof fileObj === 'object') ? (fileObj.r2Key || null) : null,
    fileIndex: parsedFileIndex
  };
  document.getElementById('fileDeleteMessage').textContent = `Yakin ingin menghapus file "${fileName}"?`;
  document.getElementById('fileDeleteModal').classList.add('active');
}

function closeFileDeleteModal() {
  document.getElementById('fileDeleteModal')?.classList.remove('active');
  fileToDelete = null;
  isDeletingFile = false;
  const btnOk = document.getElementById('fileDeleteOk');
  if (btnOk) {
    btnOk.disabled = false;
    btnOk.textContent = 'Ya, Hapus';
  }
}

document.getElementById('fileDeleteCancel')?.addEventListener('click', closeFileDeleteModal);

document.getElementById('fileDeleteOk').addEventListener('click', async function() {
  if (isDeletingFile || !fileToDelete) return;
  isDeletingFile = true;
  const btnOk = this;
  const resetDeleteUi = () => {
    document.getElementById('fileDeleteModal')?.classList.remove('active');
    fileToDelete = null;
    isDeletingFile = false;
    btnOk.disabled = false;
    btnOk.textContent = 'Ya, Hapus';
  };

  btnOk.disabled = true;
  btnOk.textContent = '⏳ Menghapus...';

  const { opdId, subCode, paramId, level, fileUrl, fileName, gdriveId, uploadId, r2Key, fileIndex } = fileToDelete;
  const row = rows.find(r => String(r.id) === String(opdId));

  if (!row) {
    resetDeleteUi();
    showWarning('❌ OPD/file tidak ditemukan pada data yang sedang tampil.');
    return;
  }

  try {
    const result = await callServerWithRetry('deleteFile', {
      fileUrl,
      fileName,
      gdriveId,
      uploadId,
      r2Key,
      fileIndex,
      opdId,
      subunsur: subCode,
      paramId,
      level,
      year: currentYear
    }, 3);

    if (result.status === 'error') {
      throw new Error(result.message || 'Gagal menghapus file.');
    }

    // Jangan mengandalkan snapshot browser untuk menentukan file yang terhapus.
    // Ambil ulang data authoritative dari D1 agar file lama/legacy dan
    // posisi array yang berubah tetap konsisten.
    await loadData();
    resetDeleteUi();

    if (result.r2DeleteWarning || result.driveDeleteWarning) {
      showWarning(
        '✅ File dihapus dari daftar evidence.' +
        (result.driveDeleteWarning ? ' Peringatan Google Drive: ' + result.driveDeleteWarning : '') +
        (result.r2DeleteWarning ? ' Peringatan R2: ' + result.r2DeleteWarning : '')
      );
    } else {
      showWarning('✅ File berhasil dihapus.');
    }
  } catch (err) {
    // Backend versi sebelumnya dapat mengembalikan 409 setelah metadata terhapus.
    // Tangani partial-delete agar modal tidak terkunci pada "Menghapus...".
    if (err?.status === 409 && err?.data?.metadataDeleted) {
      try { await loadData(); } catch {}
      resetDeleteUi();
      showWarning(
        '✅ File sudah dihapus dari daftar evidence, tetapi salinan Google Drive belum terhapus. ' +
        (err.data?.message || 'Periksa koneksi/akses Google Drive lalu hapus salinan tersebut.')
      );
      return;
    }

    resetDeleteUi();
    showWarning('❌ Gagal hapus: ' + (err.message || err));
  }
});

function collectModalChanges() {
  if (!editingRowId) return [];
  const row = rows.find(r => r.id === editingRowId);
  if (!row) return [];
  const changes = [];
  document.querySelectorAll('#subunsurContainer select[data-sub]').forEach(el => {
    const subCode=el.dataset.sub, paramId=el.dataset.param;
    const value=parseInt(el.value)||0;
    const oldValue=Number(editingSubunsurSnapshot?.[subCode]?.[paramId]?.level||0);
    if(value!==oldValue) changes.push({subCode,paramId,field:'level',value});
  });
  document.querySelectorAll('#subunsurContainer textarea[data-sub]').forEach(el => {
    const subCode=el.dataset.sub, paramId=el.dataset.param, field=el.dataset.field;
    const value=el.value;
    const oldValue=String(editingSubunsurSnapshot?.[subCode]?.[paramId]?.[field]||'');
    if(value!==oldValue) changes.push({subCode,paramId,field,value});
  });
  return changes;
}

function scheduleModalServerAutosave() {
  clearTimeout(modalAutosaveTimer);
  if (!editingRowId || !isEditModalOpen()) return;
  writeModalDraftNow();
  modalAutosaveTimer=setTimeout(async()=>{
    if(modalAutosaveRunning || !editingRowId || !isEditModalOpen()) return;
    const row=rows.find(r=>r.id===editingRowId); if(!row) return;
    const changes=collectModalChanges();
    if(!changes.length) return;
    modalAutosaveRunning=true;
    const st=document.getElementById('modalSaveStatus');
    if(st){st.style.display='block';st.style.color='#1e40af';st.textContent='💾 Autosave: menyimpan perubahan...';}
    const saveParams={opdId:row.id,year:currentYear,changes};
    try{
      const saved=await callServerWithRetry('saveSubunsur',saveParams,3);
      if(saved?.subunsurs && typeof saved.subunsurs==='object'){ row.subunsurs = saved.subunsurs; }
      if(saved?.nilaiStrukturProses!=null){row.nilaiStrukturProses=saved.nilaiStrukturProses;row.sa=saved.nilaiStrukturProses;}
      if(saved?.strukturProsesStatus!=null) row.strukturProsesStatus=saved.strukturProsesStatus;
      // Pull the authoritative row after the write so the UI snapshot can never
      // fall back to a stale/default value.
      const fresh=await fetchAuthoritativeRow(row.id);
      if(fresh){ row=fresh; }
      editingSubunsurSnapshot=JSON.parse(JSON.stringify(row.subunsurs||{}));
      clearModalDraft();
      if(st){st.style.color='#16a34a';st.textContent='✅ Autosave tersimpan di server';}
      render();
      updateKpisLocal();
    }catch(err){
      if(isNetworkError(err)||!navigator.onLine||err.transient){
        queueOfflineSave('saveSubunsur',saveParams,err.message||'Koneksi bermasalah');
        if(st){st.style.color='#b45309';st.textContent='📴 Offline: perubahan tersimpan di perangkat dan akan dikirim otomatis.';}
      }else if(st){st.style.color='#dc2626';st.textContent='⚠️ Autosave gagal: '+(err.message||err);}
    }finally{
      modalAutosaveRunning=false;
    }
  },1200);
}

// ====== MODAL SAVE EDIT SUBUNSUR ======
document.getElementById('modalSave').addEventListener('click', async function() {
  if (!editingRowId || this.disabled) return;
  // If autosave is currently writing, wait for that write instead of silently
  // ignoring the user's explicit Save click.
  while (modalAutosaveRunning) {
    await new Promise(resolve => setTimeout(resolve, 50));
    if (!isEditModalOpen()) return;
  }
  clearTimeout(modalAutosaveTimer);
  const saveBtn = this;
  saveBtn.disabled = true;
  const originalSaveText = saveBtn.textContent;
  saveBtn.textContent = '⏳ Menyimpan...';
  writeModalDraftNow();
  const row = rows.find(r => r.id === editingRowId);
  if (!row) return;

  const selects = document.querySelectorAll('#subunsurContainer select[data-sub]');
  const textareas = document.querySelectorAll('#subunsurContainer textarea[data-sub]');
  const changes = [];

  selects.forEach(el => {
    const subCode = el.dataset.sub, paramId = el.dataset.param;
    if (!row.subunsurs[subCode]) row.subunsurs[subCode] = {};
    if (!row.subunsurs[subCode][paramId]) row.subunsurs[subCode][paramId] = { level: 0 };
    const value = parseInt(el.value) || 0;
    const oldValue = Number(editingSubunsurSnapshot?.[subCode]?.[paramId]?.level || 0);
    row.subunsurs[subCode][paramId].level = value;
    row.parameterLevels = row.parameterLevels || {};
    row.parameterLevels[`${subCode}|${paramId}`] = value;
    if (value !== oldValue) changes.push({subCode, paramId, field:'level', value});
  });

  textareas.forEach(el => {
    const subCode = el.dataset.sub, paramId = el.dataset.param, field = el.dataset.field;
    if (!row.subunsurs[subCode]) row.subunsurs[subCode] = {};
    if (!row.subunsurs[subCode][paramId]) row.subunsurs[subCode][paramId] = { level: 0 };
    const value = el.value;
    const oldValue = String(editingSubunsurSnapshot?.[subCode]?.[paramId]?.[field] || '');
    row.subunsurs[subCode][paramId][field] = value;
    if (value !== oldValue) changes.push({subCode, paramId, field, value});
  });

  row.nilaiStrukturProses = calculateSA(row);
  row.sa = row.nilaiStrukturProses;
  const modalStatus = document.getElementById('modalSaveStatus');
  modalStatus.style.display = 'block';
  modalStatus.style.color = '#1e40af';

  if (!changes.length) {
    modalStatus.style.color = '#16a34a';
    modalStatus.textContent = '✅ Tidak ada perubahan baru.';
    clearModalDraft();
    setTimeout(() => { closeEditModal(); render(); }, 500);
    saveBtn.disabled = false;
    saveBtn.textContent = originalSaveText;
    return;
  }

  modalStatus.textContent = '⏳ Menyimpan perubahan...';
  const saveParams = {opdId:row.id, year:currentYear, changes};
  try {
    const saved=await callServerWithRetry('saveSubunsur', saveParams);
    if(saved?.subunsurs && typeof saved.subunsurs==='object') row.subunsurs=saved.subunsurs;
    if(saved?.nilaiStrukturProses!=null){row.nilaiStrukturProses=saved.nilaiStrukturProses;row.sa=saved.nilaiStrukturProses;}
    if(saved?.strukturProsesStatus!=null) row.strukturProsesStatus=saved.strukturProsesStatus;
    const fresh=await fetchAuthoritativeRow(row.id);
    if(fresh) rows[rows.findIndex(r=>r.id===row.id)] = fresh;
    modalStatus.style.color = '#16a34a';
    modalStatus.textContent = '✅ Perubahan berhasil disimpan!';
    clearModalDraft();
    if(fresh) editingSubunsurSnapshot=JSON.parse(JSON.stringify(fresh.subunsurs||{}));
    updateKpisLocal();
    render();
    setTimeout(() => { closeEditModal(); }, 600);
  } catch (err) {
    if (isNetworkError(err) || !navigator.onLine || err.transient) {
      queueOfflineSave('saveSubunsur', saveParams, err.message);
      modalStatus.style.color = '#b45309';
      modalStatus.textContent = '📴 Koneksi bermasalah. Perubahan tersimpan di perangkat dan akan dikirim otomatis.';
    } else {
      modalStatus.style.color = '#dc2626';
      modalStatus.textContent = '❌ Gagal menyimpan! ' + (err.message || err);
    }
  }
  saveBtn.disabled = false;
  saveBtn.textContent = originalSaveText;
});

// ====== TAMBAH OPD ======
document.getElementById('btnAdd').addEventListener('click', () => {
  const nameInput=document.getElementById('addOpdNameInput');if(nameInput)nameInput.value='';
  document.getElementById('addOpdModal').classList.add('active');
  setTimeout(()=>nameInput?.focus(),50);
});
document.getElementById('addOpdCancel').addEventListener('click', function() {
  document.getElementById('addOpdModal').classList.remove('active');
});
document.getElementById('addOpdOk').addEventListener('click', async function() {
  if (isAddingOpd) return;
  const nameInput=document.getElementById('addOpdNameInput');
  const opdName=String(nameInput?.value||'').trim();
  if(!opdName){alert('Nama OPD wajib diisi.');nameInput?.focus();return;}
  const normalized=opdName.toLocaleUpperCase('id-ID').replace(/[^A-Z0-9]+/g,' ').trim();
  if(rows.some(r=>String(r.opd||'').toLocaleUpperCase('id-ID').replace(/[^A-Z0-9]+/g,' ').trim()===normalized)){alert('Nama OPD sudah ada pada tahun yang dipilih.');return;}
  isAddingOpd = true;
  const btnOk = document.getElementById('addOpdOk');
  btnOk.disabled = true;
  btnOk.textContent = '⏳ Menambahkan...';
  try {
    const newOpd = { id:'r'+Math.random().toString(36).slice(2,9), opd:opdName, sa:0, nilaiStrukturProses:0, nilaiMaturitas:0, nilaiKapabilitasApip:0, evidence:'Belum', qaApip:'Belum', mri:0, iepk:0, rtp:'Belum', status:'Belum', strukturProsesStatus:'Belum', subunsurs:{}, kkData:{}, kkRtpData:{}, rtpEvidence:[], pmSpipReports:[], pmSpipFolder:'Laporan Hasil PM SPIP', rrRtpReports:[], rrRtpFolder:'Laporan Pemantauan RR_RTP' };
    Object.keys(SUBUNSUR_DATA).forEach(subCode => {
      newOpd.subunsurs[subCode] = {};
      SUBUNSUR_DATA[subCode].params.forEach(param => { newOpd.subunsurs[subCode][param.id] = { level: 0 }; });
    });
    rows.push(newOpd);
    render();
    try {
      await callServerWithRetry('saveRow',{year:currentYear,row:newOpd});
    } catch (err) {
      if (isNetworkError(err) || !navigator.onLine || err.transient) {
        queueOfflineSave('saveRow', { year: currentYear, row: newOpd }, err.message);
      } else {
        throw err;
      }
    }
    document.getElementById('addOpdModal').classList.remove('active');
    if(nameInput)nameInput.value='';
    if(document.getElementById('accountManagementModal')?.classList.contains('active'))populateAccountOpdOptions();
  } catch(err) {
    alert('Gagal menambahkan OPD: '+(err?.message||err));
  } finally {
    isAddingOpd = false;
    btnOk.disabled = false;
    btnOk.textContent = 'Ya, Tambahkan';
  }
});

// ====== KOSONGKAN ======
document.getElementById('btnClear').addEventListener('click', function() {
  deleteTargetId = 'all';
  document.getElementById('confirmMessage').textContent = 'Yakin ingin menghapus semua data OPD?';
  document.getElementById('confirmModal').classList.add('active');
});

// ====== TAMBAH TAHUN ======
document.getElementById('btnAddYear').addEventListener('click', function() {
  const select = document.getElementById('yearSelect');
  const options = Array.from(select.options).map(o => o.value);
  let maxYear = options.length ? Math.max(...options.map(Number)).toString() : currentYear;
  const newYear = (parseInt(maxYear) + 1).toString();
  document.getElementById('newYearPreview').textContent = newYear;
  document.getElementById('newYearBadge').textContent = newYear;
  document.getElementById('addYearModal').classList.add('active');
});
document.getElementById('addYearCancel').addEventListener('click', function() {
  document.getElementById('addYearModal').classList.remove('active');
});
document.getElementById('addYearOk').addEventListener('click', async function() {
  if (isAddingYear) return;
  isAddingYear = true;
  const btnOk = document.getElementById('addYearOk');
  btnOk.disabled = true;
  btnOk.textContent = '⏳ Menambahkan...';
  const newYear = document.getElementById('newYearBadge').textContent;
  const status = document.getElementById('saveStatus');
  status.textContent = '⏳ Menambahkan tahun...';
  try {
    const result = await callServer('addYear', { year: newYear });
    if (result.status === 'success') {
      await loadYears();
      currentYear = newYear;
      document.getElementById('yearSelect').value = newYear;
      await loadData();
    } else {
      showWarning('❌ ' + result.message);
    }
    status.textContent = '✅ ' + result.message;
    setTimeout(() => { status.textContent = ''; }, 2000);
  } catch (err) {
    status.textContent = '⚠️ ' + err.message;
    showWarning('❌ Gagal menambahkan tahun: ' + err.message);
  }
  document.getElementById('addYearModal').classList.remove('active');
  isAddingYear = false;
  btnOk.disabled = false;
  btnOk.textContent = 'Ya, Tambahkan';
});

// ====== HAPUS TAHUN ======
document.getElementById('btnDeleteYear').addEventListener('click', function() {
  const year = document.getElementById('yearSelect').value;
  if (!year) return;
  if (year === String(new Date().getFullYear())) {
    showWarning('Tahun berjalan tidak dapat dihapus.');
    return;
  }
  document.getElementById('deleteYearMessage').textContent = `Yakin ingin menghapus tahun ${year}? Semua data OPD untuk tahun ini akan hilang.`;
  document.getElementById('deleteYearPassword').value = '';
  document.getElementById('deleteYearError').style.display = 'none';
  document.getElementById('deleteYearModal').classList.add('active');
});
document.getElementById('deleteYearCancel').addEventListener('click', function() {
  document.getElementById('deleteYearModal').classList.remove('active');
});
document.getElementById('toggleDeleteYearPassword').addEventListener('click', function() {
  const input = document.getElementById('deleteYearPassword');
  if (input.type === 'password') {
    input.type = 'text';
    this.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  } else {
    input.type = 'password';
    this.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
});
document.getElementById('deleteYearOk').addEventListener('click', async function() {
  if (isDeletingYear) return;
  isDeletingYear = true;
  const btnOk = this;
  btnOk.disabled = true;
  btnOk.textContent = '⏳ Menghapus...';
  const year = document.getElementById('yearSelect').value;
  const password = document.getElementById('deleteYearPassword').value.trim();
  const errorDiv = document.getElementById('deleteYearError');
  try {
    const valid = await verifyDelete(password);
    if (!valid) {
      errorDiv.textContent = '❌ Password hapus salah!';
      errorDiv.style.display = 'block';
      errorDiv.style.background = '#fee2e2';
      errorDiv.style.color = '#dc2626';
      return;
    }
    const result = await callServer('deleteYear', { year });
    if (result.status === 'error') {
      errorDiv.textContent = '❌ ' + result.message;
      errorDiv.style.display = 'block';
      errorDiv.style.background = '#fee2e2';
      errorDiv.style.color = '#dc2626';
      return;
    }
    await loadYears();
    currentYear = String(new Date().getFullYear());
    document.getElementById('yearSelect').value = currentYear;
    await loadData();
    document.getElementById('deleteYearModal').classList.remove('active');
    showWarning('✅ Tahun berhasil dihapus.');
  } catch (err) {
    errorDiv.textContent = '❌ ' + err.message;
    errorDiv.style.display = 'block';
    errorDiv.style.background = '#fee2e2';
    errorDiv.style.color = '#dc2626';
  } finally {
    isDeletingYear = false;
    btnOk.disabled = false;
    btnOk.textContent = 'Ya, Hapus Tahun';
  }
});

// ====== GANTI TAHUN ======
document.getElementById('yearSelect').addEventListener('change', function() {
  currentYear = this.value;
  document.getElementById('currentYearLabel').textContent = currentYear;
  connectRealtime();
  loadData();
  // If the LHE follow-up modal stays open while the budget year changes, refresh its
  // target-year banner and load the rows that actually belong to the newly selected year.
  if(document.getElementById('lheFollowupModal')?.classList.contains('active')){
    lheRefreshYearLabels();
    loadLheTemplates().catch(err=>lheStatus('Gagal memperbarui tahun tindak lanjut: '+(err.message||err),'error'));
    loadLheFollowups();
  }
});

// ====== BACKUP ======
let backupToRestore = null;
let backupToDelete = null;

document.getElementById('btnBackup').addEventListener('click', function() {
  document.getElementById('backupYearLabel').textContent = currentYear;
  document.getElementById('backupModal').classList.add('active');
  loadBackupList();
});
document.getElementById('backupCancel').addEventListener('click', function() {
  document.getElementById('backupModal').classList.remove('active');
});

document.getElementById('backupNew').addEventListener('click', function() {
  document.getElementById('confirmBackupModal').classList.add('active');
});

document.getElementById('confirmBackupCancel').addEventListener('click', function() {
  document.getElementById('confirmBackupModal').classList.remove('active');
});

document.getElementById('confirmBackupOk').addEventListener('click', async function() {
  document.getElementById('confirmBackupModal').classList.remove('active');
  if (isCreatingBackup) return;
  isCreatingBackup = true;
  const btnOk = this;
  btnOk.disabled = true;
  btnOk.textContent = '⏳ Membuat...';
  
  const year = currentYear;
  const status = document.getElementById('saveStatus');
  status.textContent = '⏳ Membuat backup...';
  try {
    const result = await callServer('createBackup', { year });
    status.textContent = '✅ ' + result.message;
    setTimeout(() => { status.textContent = ''; }, 2000);
    loadBackupList();
  } catch (err) {
    status.textContent = '⚠️ ' + err.message;
  } finally {
    isCreatingBackup = false;
    btnOk.disabled = false;
    btnOk.textContent = 'Ya, Buat';
  }
});

        async function loadBackupList() {
      const container = document.getElementById('backupListContainer');
      const empty = document.getElementById('backupEmpty');
      const year = currentYear;
      try {
        const backups = await callServer('listBackups', { year });
        
        if (!Array.isArray(backups) || backups.length === 0) {
          container.innerHTML = '';
          empty.style.display = 'block';
          return;
        }
        
        empty.style.display = 'none';
        container.innerHTML = '';
        
        backups.forEach(backup => {
          if (!backup) return;
          
          const div = document.createElement('div');
          div.className = 'backup-item';
          const safeFileName = backup.fileName ? backup.fileName.replace(/'/g, "\\'") : '';
          
          div.innerHTML = `
            <span class="backup-info">
              <strong>${backup.timestamp || 'Tanggal tidak valid'}</strong><br>
              <small>${backup.size || 0} KB · ${backup.count || 0} OPD</small>
            </span>
            <div class="backup-actions">
              <button class="restore-btn" onclick="restoreBackup('${safeFileName}', '${year}')">🔄 Pulihkan</button>
              <button class="delete-btn" onclick="openConfirmDeleteBackup('${safeFileName}', '${year}')">🗑️</button>
            </div>
          `;
          container.appendChild(div);
        });
      } catch (e) {
        console.error('Gagal load backup:', e);
        container.innerHTML = '<div style="color:red; text-align:center; padding:20px;">Gagal memuat daftar backup: ' + (e.message || 'Error tidak diketahui') + '</div>';
        empty.style.display = 'none';
      }
    }

function restoreBackup(fileName, year) {
  backupToRestore = { fileName, year };
  document.getElementById('confirmRestoreMessage').textContent = `Yakin ingin memulihkan data dari backup "${fileName}"?`;
  document.getElementById('confirmRestoreModal').classList.add('active');
}

document.getElementById('confirmRestoreCancel').addEventListener('click', function() {
  document.getElementById('confirmRestoreModal').classList.remove('active');
  backupToRestore = null;
});

document.getElementById('confirmRestoreOk').addEventListener('click', async function() {
  if (!backupToRestore) return;
  if (isRestoringBackup) return;
  isRestoringBackup = true;
  const btnOk = this;
  btnOk.disabled = true;
  btnOk.textContent = '⏳ Memulihkan...';
  const { fileName, year } = backupToRestore;
  document.getElementById('confirmRestoreModal').classList.remove('active');
  const status = document.getElementById('saveStatus');
  status.textContent = '⏳ Memulihkan backup...';
  try {
    const result = await callServer('restoreBackup', { fileName, year });
    if (result.status === 'success') {
      await loadData();
      status.textContent = '✅ Data berhasil dipulihkan!';
    } else {
      status.textContent = '⚠️ ' + result.message;
    }
    setTimeout(() => { status.textContent = ''; }, 2000);
    loadBackupList();
  } catch (err) {
    status.textContent = '⚠️ ' + err.message;
  } finally {
    isRestoringBackup = false;
    btnOk.disabled = false;
    btnOk.textContent = 'Ya, Pulihkan';
    backupToRestore = null;
  }
});

function openConfirmDeleteBackup(fileName, year) {
  backupToDelete = { fileName, year };
  document.getElementById('confirmDeleteBackupModal').classList.add('active');
}

document.getElementById('confirmDeleteBackupCancel').addEventListener('click', function() {
  document.getElementById('confirmDeleteBackupModal').classList.remove('active');
  backupToDelete = null;
});

document.getElementById('confirmDeleteBackupOk').addEventListener('click', async function() {
  if (backupToDelete) {
    const { fileName, year } = backupToDelete;
    const btnOk = this;
    btnOk.disabled = true;
    btnOk.textContent = '⏳ Menghapus...';
    document.getElementById('confirmDeleteBackupModal').classList.remove('active');
    const status = document.getElementById('saveStatus');
    status.textContent = '⏳ Menghapus backup...';
    try {
      const result = await callServer('deleteBackup', { fileName, year });
      status.textContent = '✅ ' + result.message;
      setTimeout(() => { status.textContent = ''; }, 2000);
      loadBackupList();
    } catch (err) {
      status.textContent = '⚠️ ' + err.message;
    } finally {
      btnOk.disabled = false;
      btnOk.textContent = 'Ya, Hapus';
    }
    backupToDelete = null;
  }
});

// ====== UBAH NAMA OPD ======
let editingNameRowId = null;
function openEditNameModal(id) {
  editingNameRowId = id;
  const row = rows.find(r => r.id === id);
  if (!row) return;
  document.getElementById('editNameInput').value = row.opd || '';
  document.getElementById('editNameModal').classList.add('active');
}
document.getElementById('editNameCancel').addEventListener('click', function() {
  document.getElementById('editNameModal').classList.remove('active');
});
document.getElementById('editNameOk').addEventListener('click', function() {
  const row = rows.find(r => r.id === editingNameRowId);
  if (!row) return;
  const newName = document.getElementById('editNameInput').value.trim();
  if (newName === '' || newName === row.opd) {
    document.getElementById('editNameModal').classList.remove('active');
    return;
  }
  document.getElementById('confirmNameMessage').textContent = `Apakah Anda yakin ingin mengubah nama dari "${row.opd}" menjadi "${newName}"?`;
  document.getElementById('confirmNameModal').classList.add('active');
  window._pendingName = { id: row.id, newName: newName };
});
document.getElementById('confirmNameCancel').addEventListener('click', function() {
  document.getElementById('confirmNameModal').classList.remove('active');
});
document.getElementById('confirmNameOk').addEventListener('click', async function() {
  if (window._pendingName) {
    const row = rows.find(r => r.id === window._pendingName.id);
    if (row) {
      row.opd = window._pendingName.newName;
      render();
      try {
        await callServerWithRetry('saveField',{opdId:row.id,field:'opd',value:row.opd,year:currentYear});
      } catch (err) {
        if (isNetworkError(err) || !navigator.onLine || err.transient) {
          queueOfflineSave('saveField',{opdId:row.id,field:'opd',value:row.opd,year:currentYear},err.message);
        } else {
          throw err;
        }
      }
    }
    window._pendingName = null;
  }
  document.getElementById('confirmNameModal').classList.remove('active');
  document.getElementById('editNameModal').classList.remove('active');
});

window.addEventListener('beforeunload', () => { if (isEditModalOpen()) writeModalDraftNow(); });
window.addEventListener('pagehide', () => { if (isEditModalOpen()) writeModalDraftNow(); });

// ====== MODAL WARNING ======
document.getElementById('warningOk').addEventListener('click', function() {
  document.getElementById('warningModal').classList.remove('active');
});

function showWarning(message) {
  document.getElementById('warningMessage').textContent = message;
  document.getElementById('warningModal').classList.add('active');
}

// Tarik nilai master live dari Google Sheets (jika ID master dikonfigurasi). Snapshot lokal tetap menjadi fallback agar aplikasi dapat terbuka saat layanan Google sementara gagal.
function liveEvidenceLines(value){const out=[];String(value??'').replace(/\r/g,'').split('\n').forEach(raw=>{const line=raw.trim().replace(/^[•●▪◦\-–—*\d]+[.)\s-]*/,'').trim();if(line&&!out.includes(line))out.push(line);});return out;}
function applyLiveKkMasterRows(master,payload){
  if(!master||!payload?.live||!payload.sheets)return master;
  const stageMap={A:'A – Perbaikan Berkelanjutan',B:'B – Evaluasi & Tindak Lanjut',C:'C – Implementasi',D:'D – Komunikasi & Pemahaman',E:'E – Kebijakan/Formalitas'};
  const prevGroups=new Map((master.mergedEvidence?.groups||[]).map(g=>[`${g.subCode}|${g.parameterKey}`,g]));
  (master.targets||[]).forEach(target=>{
    const code=String(target.code||'').toUpperCase();const sourceRows=payload.sheets[code];if(!Array.isArray(sourceRows)||!sourceRows.length)return;
    const oldMap=new Map((target.parameters||[]).map(p=>[`${p.subCode}|${p.paramId}`,p]));
    const parsed=[];let currentSubCode='',currentSubName='',currentParam=null;
    sourceRows.forEach((row,index)=>{
      const vals=Array.isArray(row)?row:[];const val=i=>String(vals[i]??'').trim();
      if(/^\d+\.\d+$/.test(val(0))){currentSubCode=val(0);currentSubName=val(1);currentParam=null;}
      if(currentSubCode&&/^\d+$/.test(val(2))&&val(3)){
        const no=Number(val(2));const paramId=`${currentSubCode}.${no}`;const old=oldMap.get(`${currentSubCode}|${paramId}`)||{};
        currentParam={...old,subCode:currentSubCode,subunsur:currentSubName||old.subunsur||'',no,paramId,uraianParameter:val(3),kodeParameter:val(4),mri:val(5)||'-',iepk:val(6)||'-',target:code,sheet:payload.sheetNames?.[code]||target.sheet||'',workbookRow:index+1,gradeRows:[],grades:{}};
        parsed.push(currentParam);
      }
      const grade=val(7).toUpperCase();if(currentParam&&['A','B','C','D','E'].includes(grade)){
        const oldGrade=currentParam.grades?.[grade]||oldMap.get(`${currentParam.subCode}|${currentParam.paramId}`)?.grades?.[grade]||{};
        const lines=liveEvidenceLines(val(11));const rowNo=index+1;currentParam.gradeRows.push(rowNo);
        currentParam.grades[grade]={...oldGrade,grade,level:{A:5,B:4,C:3,D:2,E:1}[grade],stage:oldGrade.stage||stageMap[grade],kriteria:val(8),penjelasan:val(9),caraPengujian:val(10),evidenceDisarankan:lines,evidenceSource:`Google Sheets · ${payload.sheetNames?.[code]||target.sheet||code} · kolom L · baris ${rowNo}`,workbookRow:rowNo,evidenceByTarget:[{targetCode:code,targetLabel:`${code} · ${payload.sheetNames?.[code]||target.sheet||code}`,workbookRow:rowNo,lines}]};
      }
    });
    // The live master is authoritative for structure as well as text: newly added source parameters appear on the next load.
    const valid=parsed.filter(p=>Object.keys(p.grades||{}).length>0).map(p=>{
      p.evidenceKey=p.evidenceKey||`SP-${String(p.subCode).replace(/\./g,'_')}-${p.no}-${code}`;
      p.gradeRows=['A','B','C','D','E'].map(g=>Number(p.grades?.[g]?.workbookRow||0)).filter(Boolean);
      p.workbookRow=Number(p.grades?.A?.workbookRow||p.workbookRow||0);
      p.resultInput=p.resultInput||{hasilPengujianColumn:'M',gradeResultColumn:'N',aoiClusterColumn:'O',aoiDescColumn:'P',causeClusterColumn:'Q',causeDescColumn:'R',conclusionColumn:'R'};
      return p;
    });
    if(valid.length){target.parameters=valid;target.parameterCount=valid.length;target.sheet=payload.sheetNames?.[code]||target.sheet;target.subunsurCount=new Set(valid.map(p=>p.subCode)).size;}
  });
  const grouped=new Map();
  (master.targets||[]).forEach(target=>(target.parameters||[]).forEach(p=>{
    const key=`${p.subCode}|${p.paramId}`;let group=grouped.get(key);
    if(!group){const old=prevGroups.get(key);group={...(old||{}),groupId:old?.groupId||`SP-${String(p.subCode).replace(/\./g,'_')}-${p.no}`,subCode:p.subCode,subunsur:p.subunsur,parameterNo:p.no,parameterKey:p.paramId,targets:[],variantCount:0,sharedAcrossTargets:false,evidenceKeys:[],variants:[]};grouped.set(key,group);}
    const code=String(target.code||'').toUpperCase();const variantKey=p.evidenceKey||`SP-${String(p.subCode).replace(/\./g,'_')}-${p.no}-${code}`;
    const grades={};Object.entries(p.grades||{}).forEach(([g,value])=>{grades[g]={...value,evidenceByTarget:[{targetCode:code,targetLabel:`${code} · ${target.sheet||code}`,workbookRow:value.workbookRow,lines:Array.isArray(value.evidenceDisarankan)?value.evidenceDisarankan:[]}]};});
    const variant={variantKey,targets:[code],shared:false,primaryTarget:code,targetLabels:[`${code} · ${target.sheet||code}`],uraianParameter:p.uraianParameter,kodeParameter:p.kodeParameter,mri:p.mri,iepk:p.iepk,sourceRows:{[code]:p.workbookRow},grades,resultInput:p.resultInput};
    group.variants.push(variant);if(!group.targets.includes(code))group.targets.push(code);if(!group.evidenceKeys.includes(variantKey))group.evidenceKeys.push(variantKey);group.variantCount=group.variants.length;
  }));
  master.mergedEvidence={...(master.mergedEvidence||{}),groups:[...grouped.values()]};
  master.parameterBlocksTotal=(master.targets||[]).reduce((sum,t)=>sum+(t.parameters||[]).length,0);
  master.liveSourceStatus={live:true,masterKind:payload.masterKind,updatedAt:payload.updatedAt,sheetNames:payload.sheetNames};
  return master;
}
async function refreshMasterFromGoogleSheet(master,kind){
  try{const result=await callServerWithRetry('getKkMasterSheetRows',{masterKind:kind,forceRefresh:true},1);if(result?.live)return applyLiveKkMasterRows(master,result);if(master)master.liveSourceStatus={live:false,message:result?.message||'Memakai snapshot master lokal.'};}
  catch(err){if(master)master.liveSourceStatus={live:false,message:String(err?.message||err).slice(0,200)};}
  return master;
}

// Pemisahan target berdasarkan OPD. Satu master tetap dipakai bersama, tetapi target input dan evidence ditampilkan sesuai lingkup.
function normalizeAssessmentOrgName(value){return String(value?.opd||value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();}
function assessmentOrgProfile(value){const n=normalizeAssessmentOrgName(value);if(n.includes('INSPEKTORAT'))return 'INSPEKTORAT';if(n.includes('BPKAD')||(n.includes('PENGELOLA KEUANGAN')&&n.includes('ASET DAERAH')))return 'BPKAD';if(n.includes('BP4D')||n.includes('BAPPELITBANGDA')||(n.includes('BADAN PERENCANAAN PEMBANGUNAN')&&n.includes('PENELITIAN')&&n.includes('PENGEMBANGAN')))return 'BP4D';return 'OPD';}
function assessmentAllowedTargets(value){const p=assessmentOrgProfile(value);if(p==='BPKAD')return ['T1','T2','T3'];if(p==='INSPEKTORAT')return ['T1','T4'];return ['T1'];}
function assessmentTargetLabel(code){return ({T1:'T1 · KK3.1 (seluruh OPD)',T2:'T2 · KK3.2 (BPKAD)',T3:'T3 · KK3.3 (BPKAD)',T4:'T4 · KK3.4 (Inspektorat)'})[String(code||'').toUpperCase()]||String(code||'');}
function assessmentScopeDescription(value){const p=assessmentOrgProfile(value);if(p==='BPKAD')return 'Cakupan penilaian: T1 untuk seluruh OPD, T2 (keuangan) dan T3 (aset) khusus BPKAD.';if(p==='INSPEKTORAT')return 'Cakupan penilaian: T1 untuk seluruh OPD dan T4 (ketaatan) khusus Inspektorat.';if(p==='BP4D')return 'Cakupan penilaian: T1 serta KKE 1.1 Sasaran Strategis Pemda sebagai master BP4D/Bappelitbangda.';return 'Cakupan penilaian: T1 · KK3.1 untuk OPD umum.';}
function isPemdaStrategicSheet(sheetName){const n=String(sheetName||'').toUpperCase();return /KKE?\s*1\.1/.test(n)&&(/SASTRA/.test(n)||/PEMDA/.test(n));}
function assessmentSheetVisibleForOpd(sheetName,value){const n=String(sheetName||'').toUpperCase().replace(/\s+/g,' ');const allowed=assessmentAllowedTargets(value);if(/KK\s*3\.1/.test(n))return allowed.includes('T1');if(/KK\s*3\.2/.test(n))return allowed.includes('T2');if(/KK\s*3\.3/.test(n))return allowed.includes('T3');if(/KK\s*3\.4/.test(n))return allowed.includes('T4');if(isPemdaStrategicSheet(sheetName))return assessmentOrgProfile(value)==='BP4D';return true;}
function findBp4dMasterRow(){return (Array.isArray(rows)?rows:[]).find(r=>assessmentOrgProfile(r)==='BP4D')||null;}
function bp4dMasterWorkbookUrl(){const r=findBp4dMasterRow();return r?.kkPmData?.workbookUrl||r?.kkPmData?.workbook?.workbookUrl||r?.kkPmWorkbook?.workbookUrl||'';}

// ====== EVIDENCE STRUKTUR & PROSES — WORKBOOK MERGED 3.1–3.4 ======
let workbookEvidenceMaster=null;
let workbookEvidenceRow=null;
let workbookEvidenceFiles=[];
let workbookEvidenceNav={screen:'unsur',unsur:'',sub:'',groupId:''};
async function ensureWorkbookEvidenceMasterLoaded(forceRefresh=true){
  if(!workbookEvidenceMaster){
    const r=await fetch('/workbook-structure-process-master.json?v=20261014.1',{cache:'no-store'});
    if(!r.ok)throw new Error(`Master Struktur & Proses workbook tidak dapat dimuat (HTTP ${r.status}). Pastikan file master ikut ter-deploy.`);
    workbookEvidenceMaster=await r.json();
  }
  // Ambil snapshot Google Sheets terbaru setiap kali kolom dibuka. Backend memakai cache singkat
  // agar perubahan master segera terlihat tanpa mengunduh ulang workbook statis.
  if(forceRefresh)await refreshMasterFromGoogleSheet(workbookEvidenceMaster,'PK');
  if(!workbookEvidenceMaster?.mergedEvidence?.groups?.length)throw new Error('Master merged Evidence workbook tidak valid.');
  return workbookEvidenceMaster;
}
async function loadWorkbookEvidenceFiles(row){
  const res=await callServerWithRetry('getWorkbookEvidenceFiles',{opdId:row.id,year:currentYear},2);
  workbookEvidenceFiles=Array.isArray(res?.files)?res.files:[];
  return workbookEvidenceFiles;
}
function refreshWorkbookEvidenceCountsOnRow(row){
  if(!row)return;
  const files=(Array.isArray(workbookEvidenceFiles)?workbookEvidenceFiles:[]).filter(isUploadedDocumentRecord);
  const summary=row.workbookEvidenceSummary||{};
  summary.totalFiles=files.length;
  summary.evidenceGroups=new Set(files.map(f=>String(f.evidenceKey||'')).filter(Boolean)).size;
  summary.verifiedFiles=files.filter(f=>normalizeVerification(f).status==='diterima').length;
  summary.reviewedFiles=files.filter(f=>['diterima','diterima_catatan','dikembalikan'].includes(normalizeVerification(f).status)).length;
  summary.withNotesFiles=files.filter(f=>normalizeVerification(f).status==='diterima_catatan').length;
  summary.returnedFiles=files.filter(f=>normalizeVerification(f).status==='dikembalikan').length;
  summary.syncedFiles=files.filter(f=>f.syncStatus==='done').length;
  row.workbookEvidenceSummary=summary;
  render();
  updateKpisLocal();
}
function wbGroups(){const raw=workbookEvidenceMaster?.mergedEvidence?.groups||[];const allowed=new Set(assessmentAllowedTargets(workbookEvidenceRow||''));return raw.map(g=>{const variants=(g.variants||[]).filter(v=>(v.targets||[v.primaryTarget]).some(t=>allowed.has(String(t||'').toUpperCase())));const evidenceKeys=[...new Set(variants.map(v=>v.variantKey).filter(Boolean))];return {...g,variants,evidenceKeys,targets:variants.flatMap(v=>v.targets||[v.primaryTarget]).filter((v,i,a)=>v&&a.indexOf(v)===i),variantCount:variants.length};}).filter(g=>g.variants.length);}
function wbGroupById(id){return wbGroups().find(g=>g.groupId===id)||null;}
function wbFilesForKey(key){return workbookEvidenceFiles.filter(f=>isUploadedDocumentRecord(f)&&String(f.evidenceKey||'')===String(key));}
function wbSummaryForGroups(groups){
  const keys=new Set(groups.flatMap(g=>g.evidenceKeys||[]));
  const files=workbookEvidenceFiles.filter(f=>isUploadedDocumentRecord(f)&&keys.has(String(f.evidenceKey||'')));
  const verified=files.filter(f=>f.verificationStatus==='diterima').length;
  const reviewed=files.filter(f=>['diterima','diterima_catatan','dikembalikan'].includes(normalizeVerification(f).status)).length;
  return {files:files.length,verified:reviewed,groups:groups.filter(g=>files.some(f=>(g.evidenceKeys||[]).includes(String(f.evidenceKey||'')))).length};
}
function wbTargetsForGroup(g){
  return (g?.variants||[]).flatMap(v=>v.targetLabels||[]).filter(Boolean);
}
function wbGradeEntries(v){return Object.values(v?.grades||{}).sort((a,b)=>({A:1,B:2,C:3,D:4,E:5}[a.grade]-({A:1,B:2,C:3,D:4,E:5}[b.grade])));}
const wbUploadProgressByKey=new Map();
function wbUploadProgressMarkup(key){
  const st=wbUploadProgressByKey.get(String(key));
  const total=Math.max(0,Number(st?.total)||0),completed=Math.max(0,Number(st?.completed)||0);
  const percent=total?Math.max(0,Math.min(100,Math.round(completed/total*100))):0;
  return `<div class="wb-upload-progress" data-wb-upload-progress="${escapeHtml(String(key))}" ${st?'':'hidden'}><div class="wb-upload-progress-meta"><span data-wb-progress-count>${st?`${completed}/${total} file diproses`:'0/0 file diproses'}</span><b data-wb-progress-percent>${percent}%</b></div><div class="wb-upload-progress-track" role="progressbar" aria-label="Progres upload evidence" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span data-wb-progress-fill style="width:${percent}%"></span></div><small data-wb-progress-message>${escapeHtml(st?.message||'')}</small></div>`;
}
function wbUpdateUploadProgress(key,state){
  const stableKey=String(key);const old=wbUploadProgressByKey.get(stableKey)||{};const next={...old,...state};
  next.total=Math.max(0,Number(next.total)||0);next.completed=Math.max(0,Number(next.completed)||0);
  next.percent=next.total?Math.max(0,Math.min(100,Math.round(next.completed/next.total*100))):0;
  wbUploadProgressByKey.set(stableKey,next);
  const root=Array.from(document.querySelectorAll('[data-wb-upload-progress]')).find(el=>el.dataset.wbUploadProgress===stableKey);
  if(root){root.hidden=false;const count=root.querySelector('[data-wb-progress-count]');const percent=root.querySelector('[data-wb-progress-percent]');const fill=root.querySelector('[data-wb-progress-fill]');const track=root.querySelector('[role=progressbar]');const message=root.querySelector('[data-wb-progress-message]');if(count)count.textContent=`${next.completed}/${next.total} file diproses`+(Number(next.failed)?` · ${next.failed} gagal`:'' );if(percent)percent.textContent=`${next.percent}%`;if(fill)fill.style.width=`${next.percent}%`;if(track)track.setAttribute('aria-valuenow',String(next.percent));if(message)message.textContent=next.message||'';}
  const statusEl=Array.from(document.querySelectorAll('[data-wb-upload-status]')).find(el=>el.dataset.wbUploadStatus===stableKey);
  if(statusEl&&next.message){statusEl.textContent=next.message;statusEl.className='wb-upload-status '+(next.error?'error':(next.finished&&Number(next.failed)===0?'success':''));}
}
function wbEvidenceFileHtml(file){
  const url=file?.url||'';
  const name=escapeHtml(file?.fileName||'Evidence');
  const syncStatus=file?.syncStatus==='done'?'Tersinkron ke Drive':file?.syncStatus==='retrying'?'Perlu sinkron ulang':'Tersimpan di R2';
  const status=normalizeVerification(file).status;
  const statusClass=verificationStatusClass(status);
  const score=getVerificationScore(file);
  const uploadId=escapeHtml(file.uploadId||'');
  const opdId=escapeHtml(workbookEvidenceRow?.id||'');
  const previewButton=file?.uploadId?`<button type="button" class="wb-action-preview evidence-preview-btn" data-opd-id="${opdId}" data-upload-id="${uploadId}" data-file-name="${name}" data-file-type="${escapeHtml(file.fileType||'application/octet-stream')}">👁 Pratinjau</button>`:'';
  const workflowButton=file?.uploadId?`<button type="button" class="evidence-workflow-btn wb-action-preview" data-opd-id="${opdId}" data-upload-id="${uploadId}" data-file-name="${name}">🛡️ Alur Verifikasi</button>`:'';
  const retryButton=file?.syncStatus==='done'?'':`<button type="button" class="wb-action-retry" data-wb-action="retry" data-upload-id="${uploadId}" aria-label="Ulangi sinkronisasi Google Drive" title="Ulangi sinkronisasi Google Drive">↻ Ulangi Sinkronisasi</button>`;
  const canDirectVerify=['admin','auditor','ppupd','irban'].includes(String(currentUser?.role||''));
  const replaceControl=status==='dikembalikan'&&canDirectVerify?`<button type="button" class="wb-action-replace" data-wb-action="replace" data-upload-id="${uploadId}">↻ Ganti File</button><input type="file" hidden data-wb-replace-input="1" data-upload-id="${uploadId}" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp">`:'';
  const verificationPanel=canDirectVerify?`<details class="wb-verification"><summary>🛡️ Penjaminan / Verifikasi Inspektorat</summary><div class="wb-verification-grid">
      <label>Hasil Verifikasi<select class="wb-verify-status is-${statusClass}" data-wb-ver-status="${uploadId}">${verificationStatusOptions(status)}</select></label>
      <label>Nama Pemeriksa<input type="text" maxlength="100" data-wb-ver-examiner="${uploadId}" value="${escapeHtml(file.verificationExaminer||'')}" placeholder="Ketik nama pemeriksa"></label>
      <label class="wb-verification-note-label">Catatan Pemeriksa<textarea maxlength="2000" data-wb-ver-note="${uploadId}" placeholder="Catatan, alasan pengembalian, atau koreksi yang perlu ditindaklanjuti">${escapeHtml(file.verificationNote||'')}</textarea></label>
      <button type="button" class="wb-action-save" data-wb-action="verify" data-upload-id="${uploadId}">💾 Simpan Verifikasi</button>
    </div></details>`:`<div class="wb-verification-readonly">${workflowButton}<span>${escapeHtml(verificationStatusLabel(status))}</span></div>`;
  return `<div class="wb-evidence-file is-${statusClass}" data-wb-file-id="${uploadId}">
    <div class="wb-evidence-file-main">
      <span class="wb-evidence-file-name">${name}</span>
      <div class="wb-evidence-file-badges"><span class="wb-sync-pill ${file?.syncStatus==='done'?'is-synced':file?.syncStatus==='retrying'?'is-retry':'is-pending'}">${escapeHtml(syncStatus)}</span><span class="wb-verification-pill" data-wb-status-pill>${escapeHtml(verificationStatusLabel(status))}</span><span class="wb-score-badge" data-wb-score>Skor ${score}%</span></div>
    </div>
    <div class="wb-verification-meter" role="progressbar" aria-label="Skor verifikasi dokumen" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${score}"><span data-wb-score-fill style="width:${score}%"></span></div>
    <div class="wb-evidence-file-actions">${previewButton}${canDirectVerify?workflowButton:''}${replaceControl}${retryButton}${canDirectVerify?`<button type="button" class="wb-action-delete" data-wb-action="delete" data-upload-id="${uploadId}" aria-label="Hapus file evidence" title="Hapus file evidence">🗑 Hapus File</button>`:''}</div>
    ${verificationPanel}
  </div>`;
}

function updateWorkbookVerificationPreview(select){
  const card=select?.closest('.wb-evidence-file');
  if(!card)return;
  const status=select.value||'';
  const statusClass=verificationStatusClass(status);
  const score=verificationScoreFromStatus(status);
  card.classList.remove('is-pending','is-diterima','is-diterima_catatan','is-dikembalikan');
  card.classList.add(`is-${statusClass}`);
  select.classList.remove('is-pending','is-diterima','is-diterima_catatan','is-dikembalikan');
  select.classList.add(`is-${statusClass}`);
  const label=card.querySelector('[data-wb-status-pill]');
  const scoreLabel=card.querySelector('[data-wb-score]');
  const fill=card.querySelector('[data-wb-score-fill]');
  const meter=card.querySelector('.wb-verification-meter');
  if(label)label.textContent=verificationStatusLabel(status);
  if(scoreLabel)scoreLabel.textContent=`Skor ${score}%`;
  if(fill)fill.style.width=`${score}%`;
  if(meter)meter.setAttribute('aria-valuenow',String(score));
}
function wbGradeCardHtml(group,variant,g){
  const files=wbFilesForKey(variant.variantKey).filter(f=>String(f.grade||'')===String(g.grade));
  const evidence=(Array.isArray(g.evidenceDisarankan)?g.evidenceDisarankan:[]);
  const targetLabel=(variant.targetLabels||[]).join(', ');
  const progressKey=`${variant.variantKey}-${g.grade}`;
  return `<div class="wb-grade-card"><div class="wb-grade-head"><span class="kk-pm-grade-pill grade-${g.grade}">${g.grade}</span><b>Level ${g.level}</b><span>${escapeHtml(g.stage||'')}</span><em>${escapeHtml(targetLabel)}</em></div><div class="wb-grade-grid"><div><b>Kriteria</b><p>${escapeHtml(g.kriteria||'')}</p></div><div><b>Penjelasan</b><p>${escapeHtml(g.penjelasan||'')}</p></div><div><b>Cara Pengujian</b><p>${escapeHtml(g.caraPengujian||'')}</p></div><div><b>Evidence yang Disarankan</b>${Array.isArray(g.evidenceByTarget)&&g.evidenceByTarget.length>1?g.evidenceByTarget.map(src=>`<section class="wb-evidence-suggestion-target"><strong>${escapeHtml(src.targetLabel)}</strong>${src.lines?.length?`<ul>${src.lines.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:'<p class="muted">Tidak ada rekomendasi pada baris sumber.</p>'}</section>`).join(''):evidence.length?`<ul>${evidence.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:'<p class="muted">Tidak ada daftar evidence eksplisit pada sheet sumber; gunakan dokumen yang membuktikan kriteria.</p>'}</div></div><div class="wb-upload-row"><input type="file" multiple data-wb-file="1" data-evidence-key="${escapeHtml(variant.variantKey)}" data-target="${escapeHtml(variant.primaryTarget||'T1')}" data-sub="${escapeHtml(group.subCode)}" data-param="${escapeHtml(group.parameterKey)}" data-grade="${escapeHtml(g.grade)}" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"><span>Maks. 10 MB/file · total 10 MB per sesi pilihan; upload berurutan</span></div>${wbUploadProgressMarkup(progressKey)}<div class="wb-upload-status" data-wb-upload-status="${escapeHtml(progressKey)}"></div><div class="wb-files-list">${files.length?files.map(wbEvidenceFileHtml).join(''):'<div class="muted">Belum ada evidence pada grade ini.</div>'}</div></div>`;
}
function wbVariantHtml(group,variant){
  const vGrades=wbGradeEntries(variant); const shared=variant.shared?'Identik di '+(variant.targetLabels||[]).join(', '):'Berbeda per target';
  return `<details class="wb-variant" open><summary><div><strong>${escapeHtml(variant.uraianParameter||group.parameterKey)}</strong><small>${escapeHtml(shared)} · ${escapeHtml(variant.targetLabels?.join(' · ')||variant.primaryTarget||'')}</small></div><span>${escapeHtml(variant.variantKey)}</span></summary><div class="wb-variant-body"><div class="wb-param-ident"><span><b>Kode</b> ${escapeHtml(group.subCode)}</span><span><b>Subunsur</b> ${escapeHtml(group.subunsur)}</span><span><b>No</b> ${escapeHtml(String(group.parameterNo))}</span><span><b>Kode Parameter</b> ${escapeHtml(variant.kodeParameter||'')}</span><span><b>MRI</b> ${escapeHtml(variant.mri||'-')}</span><span><b>IEPK</b> ${escapeHtml(variant.iepk||'-')}</span><span><b>Evidence Key</b> ${escapeHtml(variant.variantKey)}</span></div>${vGrades.map(g=>wbGradeCardHtml(group,variant,g)).join('')}</div></details>`;
}
function wbRenderUnsur(){
  const info=SPIP_UNSUR_INFO; const groups=wbGroups().filter(g=>String(g.subCode).split('.')[0]===workbookEvidenceNav.unsur);
  return `<div class="wb-nav-head"><button data-wb-nav="root">← Semua Unsur</button><div><span class="kk-pm-kicker">UNSUR ${escapeHtml(workbookEvidenceNav.unsur)}</span><h4>${escapeHtml(info[workbookEvidenceNav.unsur]?.title||'')}</h4><p>${escapeHtml(info[workbookEvidenceNav.unsur]?.subtitle||'')}</p></div></div><div class="wb-sub-grid">${[...new Set(groups.map(g=>g.subCode))].sort(compareSpipCode).map(sc=>{const gs=groups.filter(g=>g.subCode===sc);const ss=wbSummaryForGroups(gs);return `<button type="button" class="wb-sub-card" data-wb-nav="sub" data-wb-sub="${escapeHtml(sc)}"><b>${escapeHtml(sc)}</b><strong>${escapeHtml(gs[0]?.subunsur||sc)}</strong><span>${gs.length} grup parameter · ${ss.files} file · ${ss.verified} terverifikasi</span>→</button>`;}).join('')}</div>`;
}
function wbRenderRoot(){
  const groups=wbGroups();
  return `<div class="wb-root-head"><div><div class="kk-pm-kicker">WORKBOOK SINGLE SOURCE OF TRUTH</div><h4>Evidence Struktur dan Proses</h4><p>55 grup parameter gabungan dari KK3.1–KK3.4. Item identik digabung; item berbeda diberi label T1–T4. Upload hanya dilakukan di sini dan otomatis ditarik ke KK PM SPIP. Bobot skor: Diterima 100%, Diterima dengan Catatan 75%, Dikembalikan 0%.</p></div><div class="wb-root-stat"><b>${workbookEvidenceFiles.filter(isUploadedDocumentRecord).length}</b><span>file diunggah</span><small>${workbookEvidenceFiles.filter(f=>isUploadedDocumentRecord(f)&&['diterima','diterima_catatan','dikembalikan'].includes(normalizeVerification(f).status)).length} sudah diverifikasi</small></div></div><div class="wb-unsur-grid">${Object.values(SPIP_UNSUR_INFO).map(info=>{const gs=groups.filter(g=>String(g.subCode).split('.')[0]===info.code);const ss=wbSummaryForGroups(gs);return `<button type="button" class="wb-unsur-card" data-wb-nav="unsur" data-wb-unsur="${info.code}"><span>${info.icon}</span><b>UNSUR ${info.code}</b><strong>${escapeHtml(info.title)}</strong><small>${gs.length} grup · ${ss.files} file · ${ss.verified} terverifikasi</small></button>`;}).join('')}</div>`;
}
function wbRenderSub(){
  const groups=wbGroups().filter(g=>g.subCode===workbookEvidenceNav.sub);
  const info=SPIP_UNSUR_INFO[workbookEvidenceNav.unsur]||{};
  return `<div class="wb-nav-head"><button data-wb-nav="back-unsur">← ${escapeHtml(info.title||'Kembali')}</button><div><span class="kk-pm-kicker">SUB-UNSUR ${escapeHtml(workbookEvidenceNav.sub)}</span><h4>${escapeHtml(groups[0]?.subunsur||'')}</h4><p>${groups.length} grup parameter workbook pada Sub-Unsur ini.</p></div></div><div class="wb-param-list">${groups.map(g=>{const ss=wbSummaryForGroups([g]);return `<button type="button" class="wb-param-card" data-wb-nav="group" data-wb-group="${escapeHtml(g.groupId)}"><span>${escapeHtml(g.parameterKey)}</span><strong>${escapeHtml(g.parameterNo+' · '+g.subunsur)}</strong><small>${g.variantCount>1?'T1–T4 berbeda':'T1–T4 identik'} · ${g.variantCount} variant · ${ss.files} file</small>→</button>`;}).join('')}</div>`;
}
function wbRenderGroup(){
  const group=wbGroupById(workbookEvidenceNav.groupId); if(!group)return '<div class="muted">Parameter tidak ditemukan.</div>';
  const ss=wbSummaryForGroups([group]);
  return `<div class="wb-nav-head"><button data-wb-nav="back-sub">← Kembali ke ${escapeHtml(group.subCode)}</button><div><span class="kk-pm-kicker">${escapeHtml(group.groupId)}</span><h4>${escapeHtml(group.parameterKey)} · ${escapeHtml(group.subunsur)}</h4><p>${group.sharedAcrossTargets?'Parameter identik lintas T1–T4; evidence disimpan satu kali.':'Parameter berbeda lintas target; setiap variant mempertahankan label T1–T4 dan evidence key masing-masing.'}</p></div><div class="wb-group-stat"><b>${ss.files}</b> file<br><small>${ss.verified} terverifikasi</small></div></div><div class="wb-variants">${group.variants.map(v=>wbVariantHtml(group,v)).join('')}</div>`;
}
function wbRender(){
  const c=document.getElementById('subunsurContainer'); if(!c)return;
  if(workbookEvidenceNav.screen==='unsur')c.innerHTML=wbRenderRoot();
  else if(workbookEvidenceNav.screen==='sub')c.innerHTML=wbRenderUnsur();
  else if(workbookEvidenceNav.screen==='param')c.innerHTML=wbRenderSub();
  else c.innerHTML=wbRenderGroup();
}
async function openWorkbookEvidenceModal(id){
  let row=rows.find(r=>String(r.id)===String(id)); if(!row)return;
  try{const fresh=await fetchAuthoritativeRow(id); if(fresh)row=fresh;}catch{}
  workbookEvidenceRow=row; workbookEvidenceNav={screen:'unsur',unsur:'',sub:'',groupId:''};
  const modal=document.getElementById('editModal'); if(!modal)return;
  modal.dataset.mode='workbook'; modal.classList.add('active');
  document.getElementById('modalOpdName').textContent=`${row.opd||'Tanpa Nama'} · Tahun ${currentYear}`;
  document.getElementById('modalSave').style.display='none'; document.getElementById('modalCancel').textContent='Tutup';
  const status=document.getElementById('modalSaveStatus');status.style.display='block';status.style.color='var(--text-secondary)';status.textContent='⏳ Memuat master workbook dan evidence...';
  try{await Promise.all([ensureWorkbookEvidenceMasterLoaded(),loadWorkbookEvidenceFiles(row)]);status.style.display='none';wbRender();}
  catch(err){status.style.display='block';status.style.color='#dc2626';status.textContent='❌ '+(err.message||err);}
}
async function wbUploadSelected(input){
  if(!workbookEvidenceRow||!input||input.dataset.uploading==='1')return;
  const files=Array.from(input.files||[]); if(!files.length)return;
  const progressKey=`${input.dataset.evidenceKey}-${input.dataset.grade}`;
  let success=0,failed=0,pending=0,completed=0;const failedFiles=[];
  try{
    validateSelectedUploadFiles(files,'evidence workbook');
    input.dataset.uploading='1';input.disabled=true;
    wbUpdateUploadProgress(progressKey,{total:files.length,completed:0,success:0,failed:0,pending:0,message:`Menyiapkan ${files.length} file · batas 10 MB per file`,finished:false,error:false});
    for(let i=0;i<files.length;i++){
      const file=files[i];
      wbUpdateUploadProgress(progressKey,{total:files.length,completed,success,failed,pending,message:`Mengunggah ${i+1}/${files.length}: ${file.name}`,finished:false,error:false});
      const uploadId=crypto.randomUUID();
      const payload={__binaryFile:file,opdId:workbookEvidenceRow.id,opdName:workbookEvidenceRow.opd||'OPD',year:currentYear,sourceModel:'workbook',evidenceKey:input.dataset.evidenceKey,targetCode:input.dataset.target,subunsur:input.dataset.sub,paramId:input.dataset.param,grade:input.dataset.grade,level:String(({A:5,B:4,C:3,D:2,E:1})[input.dataset.grade]||0),fileName:file.name,fileType:file.type||'application/octet-stream',uploadId};
      try{
        const result=await callServerWithRetry('uploadFile',payload,3);
        if(result?.status==='pending'||result?.syncStatus==='retrying'||result?.syncStatus==='pending')pending++;else success++;
      }catch(err){failed++;failedFiles.push(`${file.name}: ${err.message||err}`);}
      completed=i+1;
      const tail=failed?` · ${failed} gagal`:'';
      const latestError=failedFiles.length?` · Terakhir gagal: ${failedFiles[failedFiles.length-1]}`:'';
      wbUpdateUploadProgress(progressKey,{total:files.length,completed,success,failed,pending,message:`${completed}/${files.length} diproses · ${success} berhasil${pending?`, ${pending} menunggu sinkronisasi Drive`:''}${tail}${latestError}`,finished:completed===files.length,error:failed>0});
    }
    input.value='';
    try{await loadWorkbookEvidenceFiles(workbookEvidenceRow);}catch(err){wbUpdateUploadProgress(progressKey,{total:files.length,completed,success,failed,pending,message:`Upload selesai, tetapi daftar file gagal dimuat ulang: ${err.message||err}`,finished:true,error:true});}
    wbRender();
    const row=rows.find(r=>String(r.id)===String(workbookEvidenceRow.id));if(row)refreshWorkbookEvidenceCountsOnRow(row);
    const finalMessage=`Selesai: ${success} berhasil${pending?`, ${pending} tersimpan di R2 menunggu sinkronisasi Drive`:''}${failed?`, ${failed} gagal`:''}.`;
    wbUpdateUploadProgress(progressKey,{total:files.length,completed:files.length,success,failed,pending,message:finalMessage,finished:true,error:failed>0});
    if(failed||pending){
      const errorDetail=failedFiles.length?'\n\nRincian file gagal:\n'+failedFiles.slice(0,5).join('\n')+(failedFiles.length>5?'\n…dan file gagal lainnya.':''):'';
      showWarning(`Upload evidence selesai diproses. ${finalMessage}${errorDetail} Periksa status masing-masing file sebelum menutup halaman.`);
    }
  }catch(err){
    input.value='';wbUpdateUploadProgress(progressKey,{total:files.length,completed,success,failed:failed+1,pending,message:err.message||String(err),finished:true,error:true});
    showWarning(`Upload tidak dapat dimulai: ${err.message||err}`);
  }finally{input.disabled=false;delete input.dataset.uploading;}
}
async function wbReplaceEvidenceSelected(input){
  if(!workbookEvidenceRow||!input||input.dataset.replacing==='1')return;
  const file=input.files?.[0];input.value='';if(!file)return;
  if(Number(file.size||0)>MAX_FILE_UPLOAD_BYTES){showWarning(`File ${file.name} melebihi batas 10 MB per file.`);return;}
  const card=input.closest('.wb-evidence-file');const uploadId=String(input.dataset.uploadId||card?.dataset.wbFileId||'');
  if(!uploadId){showWarning('Identitas file yang akan diganti tidak ditemukan.');return;}
  const button=card?.querySelector('[data-wb-action="replace"]');
  try{
    input.dataset.replacing='1';if(button){button.disabled=true;button.textContent='Mengganti file…';}
    const result=await callServerWithRetry('replaceWorkbookEvidenceFile',{__binaryFile:file,opdId:workbookEvidenceRow.id,year:currentYear,uploadId,fileName:file.name,fileType:file.type||'application/octet-stream'},3);
    const row=rows.find(r=>String(r.id)===String(workbookEvidenceRow.id));if(row&&result?.structureProcessBreakdown?.source==='verified_evidence_only'){row.structureProcessBreakdown=result.structureProcessBreakdown;row.nilaiStrukturProses=Number(result.nilaiStrukturProses)||0;row.sa=row.nilaiStrukturProses;row.strukturProsesStatus=result.strukturProsesStatus||row.strukturProsesStatus;}
    await loadWorkbookEvidenceFiles(workbookEvidenceRow);wbRender();if(row)refreshWorkbookEvidenceCountsOnRow(row);
    showWarning(result?.status==='success'?'✅ File berhasil diganti pada tautan yang sama. Salinan R2/Google Drive diperbarui tanpa menambah record baru; status verifikasi direset agar Inspektorat memeriksa file pengganti.':'File pengganti sudah diproses. Periksa status sinkronisasi.');
  }catch(err){
    showWarning(`❌ File belum berhasil diganti: ${err.message||err}`);
  }finally{delete input.dataset.replacing;if(button){button.disabled=false;button.textContent='↻ Ganti File';}}
}

async function wbVerify(uploadId){
  const st=document.querySelector(`[data-wb-ver-status="${CSS.escape(uploadId)}"]`);const ex=document.querySelector(`[data-wb-ver-examiner="${CSS.escape(uploadId)}"]`);const note=document.querySelector(`[data-wb-ver-note="${CSS.escape(uploadId)}"]`);if(!st||!ex||!note)return;
  try{
    const result=await callServerWithRetry('saveWorkbookEvidenceVerification',{opdId:workbookEvidenceRow.id,year:currentYear,uploadId,verificationStatus:st.value,verificationExaminer:ex.value.trim(),verificationNote:note.value.trim()},3);
    const row=rows.find(r=>String(r.id)===String(workbookEvidenceRow.id));
    if(row&&result?.structureProcessBreakdown?.source==='verified_evidence_only'){row.structureProcessBreakdown=result.structureProcessBreakdown;row.nilaiStrukturProses=Number(result.nilaiStrukturProses)||0;row.sa=row.nilaiStrukturProses;row.strukturProsesStatus=result.strukturProsesStatus||row.strukturProsesStatus;}
    await loadWorkbookEvidenceFiles(workbookEvidenceRow);wbRender();if(row)refreshWorkbookEvidenceCountsOnRow(row);
  }catch(err){alert('Gagal menyimpan verifikasi: '+(err.message||err));}
}
async function wbRetry(uploadId){try{await callServerWithRetry('retryDriveBackup',{type:'workbook_evidence',opdId:workbookEvidenceRow.id,year:currentYear,uploadId},3);await loadWorkbookEvidenceFiles(workbookEvidenceRow);wbRender();const row=rows.find(r=>String(r.id)===String(workbookEvidenceRow.id));if(row)refreshWorkbookEvidenceCountsOnRow(row);}catch(err){alert('Retry Drive gagal: '+(err.message||err));}}
async function wbDelete(uploadId){
  if(!confirm('Hapus evidence ini? File R2/Google Drive dan tautan di KK PM akan dihapus.'))return;
  try{
    const result=await callServerWithRetry('deleteWorkbookEvidence',{opdId:workbookEvidenceRow.id,year:currentYear,uploadId},3);
    const row=rows.find(r=>String(r.id)===String(workbookEvidenceRow.id));
    if(row&&result?.structureProcessBreakdown?.source==='verified_evidence_only'){row.structureProcessBreakdown=result.structureProcessBreakdown;row.nilaiStrukturProses=Number(result.nilaiStrukturProses)||0;row.sa=row.nilaiStrukturProses;row.strukturProsesStatus=result.strukturProsesStatus||row.strukturProsesStatus;}
    await loadWorkbookEvidenceFiles(workbookEvidenceRow);wbRender();if(row)refreshWorkbookEvidenceCountsOnRow(row);
  }catch(err){alert('Gagal menghapus evidence: '+(err.message||err));}
}
document.addEventListener('click',e=>{
  const nav=e.target.closest('#subunsurContainer [data-wb-nav]');
  if(nav){
    const kind=nav.dataset.wbNav;
    if(kind==='unsur'){workbookEvidenceNav.screen='sub';workbookEvidenceNav.unsur=nav.dataset.wbUnsur;}
    else if(kind==='root'){workbookEvidenceNav={screen:'unsur',unsur:'',sub:'',groupId:''};}
    else if(kind==='back-unsur'){workbookEvidenceNav.screen='sub';}
    else if(kind==='sub'){workbookEvidenceNav.screen='param';workbookEvidenceNav.sub=nav.dataset.wbSub;}
    else if(kind==='back-sub'){workbookEvidenceNav.screen='param';workbookEvidenceNav.groupId='';}
    else if(kind==='group'){workbookEvidenceNav.screen='group';workbookEvidenceNav.groupId=nav.dataset.wbGroup;}
    wbRender(); return;
  }
  const action=e.target.closest('#subunsurContainer [data-wb-action]');
  if(action){const uploadId=action.dataset.uploadId;if(action.dataset.wbAction==='verify')wbVerify(uploadId);else if(action.dataset.wbAction==='retry')wbRetry(uploadId);else if(action.dataset.wbAction==='delete')wbDelete(uploadId);else if(action.dataset.wbAction==='replace'){const card=action.closest('.wb-evidence-file');const picker=card?.querySelector('[data-wb-replace-input]');if(picker)picker.click();}}
});
document.addEventListener('change',e=>{const statusSelect=e.target.closest('#subunsurContainer [data-wb-ver-status]');if(statusSelect){updateWorkbookVerificationPreview(statusSelect);return;}const replacement=e.target.closest('#subunsurContainer [data-wb-replace-input]');if(replacement){wbReplaceEvidenceSelected(replacement);return;}const input=e.target.closest('#subunsurContainer [data-wb-file]');if(input)wbUploadSelected(input).catch(err=>showWarning(err.message||err));});

// ====== MODAL CLOSE EDIT ======
document.getElementById('modalClose').addEventListener('click', closeEditModal);
document.getElementById('modalCancel').addEventListener('click', closeEditModal);
function closeEditModal() {
  const modal=document.getElementById('editModal');
  const workbookMode=modal?.dataset.mode==='workbook';
  if (!workbookMode && isEditModalOpen()) writeModalDraftNow();
  clearTimeout(modalAutosaveTimer);
  modalAutosaveTimer=null;
  modal?.classList.remove('active');
  if(modal)delete modal.dataset.mode;
  const save=document.getElementById('modalSave'); if(save)save.style.display='';
  const cancel=document.getElementById('modalCancel'); if(cancel)cancel.textContent='Batal';
  editingRowId = null;
  editingSubunsurSnapshot = null;
  workbookEvidenceRow=null;
  workbookEvidenceFiles=[];
}

// ====== AKSES LANGSUNG VIA PORTAL ======
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('access') === 'portal') {
  (async function init() {
    try {
      SUBUNSUR_DATA = await callServer('getSubunsurData');
      PARAM_LIST = [];
      Object.keys(SUBUNSUR_DATA).forEach(subCode => {
        SUBUNSUR_DATA[subCode].params.forEach(param => {
          PARAM_LIST.push({ subCode: subCode, paramId: param.id, desc: param.desc, levels: param.levels });
        });
      });
      await loadYears();
      await loadData();
      connectRealtime();
      showDashboard();
    } catch (e) {
      console.error('Inisialisasi gagal:', e);
      document.getElementById('saveStatus').textContent = '⚠️ ' + e.message;
    }
  })();
}
// ====== SINKRONISASI OTOMATIS ======
setInterval(async function() {
  if (!isSaving && !pendingSave && !kkPmDirty && !isEditModalOpen()) {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT')) {
      return;
    }
    await loadData();
  }
}, 20000);

// ============================================================
// GOOGLE SPREADSHEET KERTAS KERJA — 1 FILE PER OPD
// ============================================================
let sheetLinksEditingRowId = null;
function sheetLinksEsc(v){
  return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function sheetLinksGetWorkbook(row){
  const d=row&&row.kkData;
  if(!d || typeof d!=='object') return null;
  if(d.workbookSpreadsheetId) return d;
  return null;
}
function sheetLinksSetStatus(msg,type=''){
  const el=document.getElementById('sheetLinksStatus');
  if(!el)return;
  el.textContent=msg||'';
  el.className='sheet-links-status'+(type?' '+type:'');
  el.style.display=msg?'block':'none';
}
function renderSheetLinks(row){
  const list=document.getElementById('sheetLinksList');
  if(!list)return;
  const wb=sheetLinksGetWorkbook(row);
  if(wb){
    const url=wb.workbookUrl || `https://docs.google.com/spreadsheets/d/${encodeURIComponent(wb.workbookSpreadsheetId)}/edit`;
    list.innerHTML=`<div class="sheet-link-card" style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px;border:1px solid #dbe2ea;border-radius:12px;background:#fff;">
      <div class="sheet-link-name">
        <div style="font-size:15px;font-weight:800;color:#0f172a;">📊 ${sheetLinksEsc(wb.workbookName||'Kertas Kerja SPIP')}</div>
        <div style="font-size:12px;color:#64748b;margin-top:5px;">${sheetLinksEsc(row.opd||'OPD')} · ${sheetLinksEsc(currentYear)} · seluruh sheet KK berada di dalam satu file</div>
      </div>
      <a class="sheet-link-open" style="white-space:nowrap;" href="${sheetLinksEsc(url)}" target="_blank" rel="noopener noreferrer">Buka Spreadsheet ↗</a>
    </div>`;
  }else{
    list.innerHTML=`<div class="sheet-link-card" style="padding:16px;border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc;color:#64748b;">
      Spreadsheet Kertas Kerja untuk OPD ini belum dibuat pada tahun ${sheetLinksEsc(currentYear)}.
    </div>`;
  }
}
async function loadSheetLinksForRow(row){
  if(!row)return;
  renderSheetLinks(row);
  try{
    const data=await callServer('getKkSheets',{opdId:row.id,year:currentYear});
    if(data&&data.kkData)row.kkData=data.kkData;
    renderSheetLinks(row);
    return data;
  }catch(err){
    sheetLinksSetStatus('Gagal memuat link spreadsheet: '+err.message,'error');
    return null;
  }
}
function openSpreadsheetModal(id){
  const row=rows.find(r=>r.id===id);if(!row)return;
  const modal=document.getElementById('sheetLinksModal');
  modal.dataset.mode='spip';
  sheetLinksEditingRowId=id;
  modal.querySelector('.sheet-links-header h3').innerHTML='📊 SPREADSHEET KERTAS KERJA - <span id="sheetLinksOpdName"></span>';
  modal.querySelector('.sheet-links-body').innerHTML=`
    <div class="sheet-links-info">
      Satu OPD memiliki <b>satu Google Spreadsheet Kertas Kerja</b> untuk setiap tahun.
      Di dalam satu file tersebut tetap terdapat seluruh sheet KK sesuai workbook template.
      Website hanya menyimpan ID dan link spreadsheet, sehingga workbook tidak lagi dimuat/dirender di halaman ini.
    </div>
    <div class="sheet-links-status" id="sheetLinksStatus"></div>
    <div id="sheetLinksList"></div>
    <div style="margin-top:10px;font-size:11px;color:#64748b;line-height:1.45;">
      Template workbook dikendalikan oleh backend. Setiap OPD dibuat sebagai salinan <b>satu file</b> Google Spreadsheet, bukan satu file per sheet.
    </div>`;
  modal.querySelector('.sheet-links-footer').innerHTML='<button id="sheetLinksRefresh">↻ Muat Link</button><button class="primary" id="sheetLinksCreate">＋ Buat/Sinkronkan Spreadsheet OPD</button><button id="sheetLinksCancel">Tutup</button>';
  document.getElementById('sheetLinksOpdName').textContent=row.opd||'Tanpa Nama';
  modal.classList.add('active');
  sheetLinksSetStatus('Memuat link spreadsheet...');
  loadSheetLinksForRow(row).then(data=>{
    if(!data?.kkData?.workbookSpreadsheetId && modal.classList.contains('active')) createSheetLinksForCurrentRow(true);
    else if(data) sheetLinksSetStatus('Spreadsheet OPD siap dibuka.','success');
  });
}
async function createSheetLinksForCurrentRow(auto=false){
  const row=rows.find(r=>r.id===sheetLinksEditingRowId);if(!row)return;
  const btn=document.getElementById('sheetLinksCreate'),refresh=document.getElementById('sheetLinksRefresh');
  if(btn)btn.disabled=true;if(refresh)refresh.disabled=true;
  sheetLinksSetStatus(auto?'Membuat satu Google Spreadsheet untuk OPD ini…':'Membuat/sinkronkan Google Spreadsheet OPD…');
  try{
    const result=await callServer('createKkSheets',{opdId:row.id,opd:row.opd||'OPD',year:currentYear});
    row.kkData=result.kkData||{};
    renderSheetLinks(row);
    sheetLinksSetStatus('Selesai. Satu spreadsheet berisi seluruh sheet KK sudah tersedia di Google Drive.','success');
  }catch(err){
    sheetLinksSetStatus('Gagal membuat spreadsheet: '+err.message,'error');
  }finally{
    if(btn)btn.disabled=false;if(refresh)refresh.disabled=false;
  }
}
function closeSpreadsheetModal(){
  document.getElementById('sheetLinksModal')?.classList.remove('active');
  sheetLinksEditingRowId=null;
}


// ===== KK RTP =====
async function openKkRtp(id){const row=rows.find(r=>r.id===id);if(!row)return;const modal=document.getElementById('sheetLinksModal');modal.dataset.mode='rtp';document.querySelector('#sheetLinksModal .sheet-links-header h3').innerHTML=`📋 SPREADSHEET KERTAS KERJA RTP - <span id="sheetLinksOpdName">${sheetLinksEsc(row.opd||'Tanpa Nama')}</span>`;document.querySelector('#sheetLinksModal .sheet-links-body').innerHTML='<div class="sheet-links-info">Satu OPD memiliki satu Google Spreadsheet <b>Kertas Kerja RTP</b> per tahun. Workbook dibuat dari template RTP dan ditempatkan pada folder OPD/tahun yang sama.</div><div class="sheet-links-status" id="sheetLinksStatus"></div><div id="sheetLinksList"></div>';document.querySelector('#sheetLinksModal .sheet-links-footer').innerHTML='<button id="sheetLinksRefresh">↻ Muat Link</button><button class="primary" id="sheetLinksCreate">＋ Buat/Sinkronkan KK RTP</button><button id="sheetLinksCancel">Tutup</button>';sheetLinksEditingRowId=id;modal.classList.add('active');sheetLinksSetStatus('Memuat KK RTP...');try{const d=await callServer('getRtpKkSheets',{opdId:id,year:currentYear});row.kkRtpData=d.kkRtpData||{};renderRtpSheetLinks(row);if(!row.kkRtpData.workbookSpreadsheetId)await createRtpSheetLinksForCurrentRow(true);else sheetLinksSetStatus('KK RTP siap dibuka.','success');}catch(err){sheetLinksSetStatus('Gagal memuat KK RTP: '+err.message,'error');}}
function renderRtpSheetLinks(row){const l=document.getElementById('sheetLinksList');if(!l)return;const w=row.kkRtpData;if(w&&w.workbookSpreadsheetId){const u=w.workbookUrl||`https://docs.google.com/spreadsheets/d/${encodeURIComponent(w.workbookSpreadsheetId)}/edit`;l.innerHTML=`<div class="sheet-link-card"><div class="sheet-link-name"><div style="font-size:15px;font-weight:800;color:#0f172a;">📋 ${sheetLinksEsc(w.workbookName||'Kertas Kerja RTP')}</div><div style="font-size:12px;color:#64748b;margin-top:5px;">${sheetLinksEsc(row.opd||'OPD')} · ${sheetLinksEsc(currentYear)} · workbook RTP</div></div><a class="sheet-link-open" href="${sheetLinksEsc(u)}" target="_blank" rel="noopener noreferrer">Buka Spreadsheet ↗</a></div>`;}else l.innerHTML=`<div class="sheet-link-card">KK RTP belum dibuat pada tahun ${sheetLinksEsc(currentYear)}.</div>`;}
async function createRtpSheetLinksForCurrentRow(auto=false){const row=rows.find(r=>r.id===sheetLinksEditingRowId);if(!row)return;const b=document.getElementById('sheetLinksCreate'),rf=document.getElementById('sheetLinksRefresh');if(b)b.disabled=true;if(rf)rf.disabled=true;sheetLinksSetStatus(auto?'Membuat KK RTP…':'Membuat/sinkronkan KK RTP…');try{const d=await callServer('createRtpKkSheets',{opdId:row.id,opd:row.opd||'OPD',year:currentYear});row.kkRtpData=d.kkRtpData||{};renderRtpSheetLinks(row);sheetLinksSetStatus('KK RTP berhasil tersedia.','success');}catch(err){sheetLinksSetStatus('Gagal membuat KK RTP: '+err.message,'error');}finally{if(b)b.disabled=false;if(rf)rf.disabled=false;}}

// ===== LAPORAN PM SPIP & LAPORAN PEMANTAUAN RR_RTP =====
let reportUploadEditingRowId=null;
let reportUploadEditingType='pm_spip';

const REPORT_CONFIG={
  pm_spip:{title:'LAPORAN HASIL PM SPIP',folder:'Laporan Hasil PM SPIP',button:'📄 Upload Laporan PM SPIP',icon:'📘',desc:'File akan otomatis disimpan ke Google Drive berdasarkan Tahun → Nama OPD → Laporan Hasil PM SPIP.'},
  rr_rtp:{title:'LAPORAN PEMANTAUAN RR_RTP',folder:'Laporan Pemantauan RR_RTP',button:'📄 Upload Laporan RR_RTP',icon:'📙',desc:'File akan otomatis disimpan ke Google Drive berdasarkan Tahun → Nama OPD → Laporan Pemantauan RR_RTP.'}
};
function reportListForRow(row,type){return type==='pm_spip'?(Array.isArray(row.pmSpipReports)?row.pmSpipReports:[]):(Array.isArray(row.rrRtpReports)?row.rrRtpReports:[]);}
function setReportListForRow(row,type,list){if(type==='pm_spip')row.pmSpipReports=list;else row.rrRtpReports=list;}
function reportSetStatus(msg,type=''){const e=document.getElementById('reportUploadStatus');if(!e)return;e.textContent=msg||'';e.className='sheet-links-status'+(type?' '+type:'');e.style.display=msg?'block':'none';}
function renderReportUploadList(row,type){const e=document.getElementById('reportUploadList');if(!e)return;const a=reportListForRow(row,type);const cfg=REPORT_CONFIG[type];if(!a.length){e.innerHTML=`<div class="sheet-link-card">Belum ada file pada folder <b>${sheetLinksEsc(cfg.folder)}</b>.</div>`;return;}e.innerHTML='<div class="rtp-file-list">'+a.map((f,i)=>{const done=!!f.gdriveId&&f.syncStatus==='done';const status=done?'✅ Google Drive + R2':(f.syncStatus==='retrying'?'🔄 Perlu Retry Google Drive':'⏳ Menyimpan ke Google Drive');const retry=(done||!f.uploadId||!['admin','auditor','opd'].includes(String(currentUser?.role||'')))?'':`<button class="report-retry-btn" data-upload-id="${sheetLinksEsc(f.uploadId)}">↻ Retry</button>`;const open=f.uploadId&&f.url?f.url:(f.gdriveId?`https://drive.google.com/file/d/${encodeURIComponent(f.gdriveId)}/view`:(f.url||'#'));const workflow=f.uploadId?`<button class="evidence-workflow-btn" data-opd-id="${sheetLinksEsc(row.id)}" data-upload-id="${sheetLinksEsc(f.uploadId)}" data-file-name="${sheetLinksEsc(f.fileName||'Laporan')}">🛡️ Alur Verifikasi</button>`:'';const preview=f.uploadId?`<button type="button" class="evidence-preview-btn" data-opd-id="${sheetLinksEsc(row.id)}" data-upload-id="${sheetLinksEsc(f.uploadId)}" data-file-name="${sheetLinksEsc(f.fileName||'Laporan')}" data-file-type="${sheetLinksEsc(f.fileType||'application/octet-stream')}">👁 Pratinjau</button>`:'';const canDelete=!['irban','bpkp'].includes(String(currentUser?.role||''));return `<div class="rtp-file-item"><div><div class="rtp-file-name">${cfg.icon} ${sheetLinksEsc(f.fileName||'Laporan')}</div><div class="rtp-file-meta">${status}${f.uploadedAt?' · '+sheetLinksEsc(f.uploadedAt):''}</div></div><div class="rtp-file-actions">${preview}<a href="${sheetLinksEsc(open)}" target="_blank" rel="noopener noreferrer">Buka</a>${workflow}${retry}${canDelete?`<button class="report-delete-btn" data-index="${i}">Hapus</button>`:''}</div></div>`;}).join('')+'</div>';}
async function openReportUploadModal(id,type){const row=rows.find(r=>r.id===id);if(!row)return;reportUploadEditingRowId=id;reportUploadEditingType=type;const cfg=REPORT_CONFIG[type],modal=document.getElementById('reportUploadModal');if(!modal)return;const canUpload=['admin','auditor','opd'].includes(String(currentUser?.role||''));const chooser=document.getElementById('reportUploadChoose');if(chooser)chooser.style.display=canUpload?'inline-flex':'none';document.getElementById('reportUploadTitle').innerHTML=`${cfg.icon} ${cfg.title} - <span id="reportUploadOpdName">${sheetLinksEsc(row.opd||'Tanpa Nama')}</span>`;document.getElementById('reportUploadDescription').textContent=cfg.desc;document.getElementById('reportUploadChoose').textContent=cfg.button;modal.classList.add('active');reportSetStatus(`Memuat folder ${cfg.folder}...`);try{const d=await callServer('getReportFiles',{opdId:id,year:currentYear,reportType:type});const list=Array.isArray(d.reports)?d.reports:[];setReportListForRow(row,type,list);row[type==='pm_spip'?'pmSpipFolder':'rrRtpFolder']=d.folderName||cfg.folder;row[type==='pm_spip'?'pmSpipFolderId':'rrRtpFolderId']=d.folderId||null;const driveLink=document.getElementById('reportUploadDriveLink');if(driveLink){driveLink.href=d.folderUrl||'#';driveLink.style.display=d.folderUrl?'inline-flex':'none';}renderReportUploadList(row,type);reportSetStatus(d.folderUrl?`✅ Folder Google Drive terhubung: ${cfg.folder}.`:`Folder ${cfg.folder} siap dibuat saat upload.`,d.folderUrl?'success':'');}catch(err){reportSetStatus('Gagal memuat: '+err.message,'error');}}
function closeReportUploadModal(){document.getElementById('reportUploadModal')?.classList.remove('active');reportUploadEditingRowId=null;}
async function uploadReportFileClient(row,type,file,existingUploadId=null){if(!file)return null;if(file.size>MAX_FILE_UPLOAD_BYTES)throw new Error('File terlalu besar! Maks 10 MB per file.');const uploadId=existingUploadId||crypto.randomUUID();const payload={__binaryFile:file,opdId:row.id,opdName:row.opd||'OPD',reportType:type,year:currentYear,fileName:file.name,fileType:file.type||'application/octet-stream',uploadId};const result=await callServerWithRetry('uploadReportFile',payload,3);return{url:result.url,fileName:result.fileName,gdriveId:result.gdriveId||null,syncStatus:result.syncStatus||'pending',syncError:result.driveError||null,uploadId:result.uploadId||uploadId,r2Key:result.r2Key||null,folderName:result.folderName||REPORT_CONFIG[type].folder,gdriveFolderId:result.folderId||null};}
async function retryReportFile(row,type,item){try{item.syncStatus='retrying';renderReportUploadList(row,type);if(item.localPending){const localFile=pendingUploadFiles.get(item.uploadId);if(!localFile)throw new Error('File lokal untuk retry sudah tidak tersedia. Silakan pilih file kembali.');const r=await uploadReportFileClient(row,type,localFile,item.uploadId);Object.assign(item,{url:r.url||item.url,fileName:r.fileName||item.fileName,gdriveId:r.gdriveId||null,syncStatus:r.syncStatus||'pending',syncError:r.syncError||null,r2Key:r.r2Key||item.r2Key,localPending:false});pendingUploadFiles.delete(item.uploadId);await deletePendingUploadFromIndexedDB(item.uploadId);renderReportUploadList(row,type);render();reportSetStatus(item.gdriveId?'✅ R2 + Google Drive tersimpan.':'🔄 Google Drive belum berhasil. Silakan Retry.',item.gdriveId?'success':'');return;}
const r=await callServerWithRetry('retryDriveBackup',{opdId:row.id,year:currentYear,uploadId:item.uploadId,type:'report',reportType:type},2);item.gdriveId=r.gdriveId||item.gdriveId||null;item.syncStatus=r.syncStatus||'retrying';item.syncError=r.driveError||null;if(item.gdriveId)item.storage='R2 + Google Drive';renderReportUploadList(row,type);render();reportSetStatus(item.gdriveId?'✅ R2 + Google Drive tersimpan.':'🔄 Google Drive belum berhasil. Silakan Retry.',item.gdriveId?'success':'');}catch(err){item.syncStatus='retrying';item.syncError=err.message;renderReportUploadList(row,type);reportSetStatus('Retry gagal: '+err.message,'error');}}

document.getElementById('reportUploadChoose')?.addEventListener('click',()=>document.getElementById('reportUploadInput')?.click());
document.getElementById('reportUploadInput')?.addEventListener('change',async e=>{const row=rows.find(r=>r.id===reportUploadEditingRowId),type=reportUploadEditingType;if(!row||!e.target.files?.length)return;const files=Array.from(e.target.files);try{validateSelectedUploadFiles(files,'file laporan');}catch(err){reportSetStatus('❌ '+err.message,'error');e.target.value='';return;}let done=0,failed=0;for(const file of files){const uploadId=crypto.randomUUID();try{reportSetStatus(`Mengunggah ${done+failed+1}/${files.length}: ${file.name}`);const r=await uploadReportFileClient(row,type,file,uploadId);const list=reportListForRow(row,type);const item={url:r.url||'',fileName:r.fileName||file.name,gdriveId:r.gdriveId||null,syncStatus:r.syncStatus||'pending',syncError:r.syncError||null,r2Key:r.r2Key||null,fileType:file.type||'application/octet-stream',uploadId:r.uploadId||uploadId,folderName:r.folderName||REPORT_CONFIG[type].folder,gdriveFolderId:r.gdriveFolderId||null,uploadedAt:new Date().toISOString()};const existing=list.find(x=>x&&x.uploadId===item.uploadId);if(existing)Object.assign(existing,item);else list.push(item);setReportListForRow(row,type,list);renderReportUploadList(row,type);render();done++;if(r.gdriveId){pendingUploadFiles.delete(uploadId);await deletePendingUploadFromIndexedDB(uploadId);}else{pendingUploadFiles.set(uploadId,file);await savePendingUploadToIndexedDB({uploadId,opdId:row.id,opdName:row.opd||'OPD',reportType:type,type:'report',year:currentYear,file,fileName:file.name,fileType:file.type||'application/octet-stream',createdAt:Date.now()});}}catch(err){failed++;pendingUploadFiles.set(uploadId,file);await savePendingUploadToIndexedDB({uploadId,opdId:row.id,opdName:row.opd||'OPD',reportType:type,type:'report',year:currentYear,file,fileName:file.name,fileType:file.type||'application/octet-stream',createdAt:Date.now()});const list=reportListForRow(row,type);list.push({url:'',fileName:file.name,gdriveId:null,syncStatus:'retrying',syncError:err.message,r2Key:null,fileType:file.type||'application/octet-stream',uploadId,localPending:true,folderName:REPORT_CONFIG[type].folder,uploadedAt:new Date().toISOString()});setReportListForRow(row,type,list);renderReportUploadList(row,type);}}reportSetStatus(failed?`Selesai: ${done} berhasil, ${failed} gagal.`:`✅ ${done} file diproses; yang belum masuk Google Drive dapat di-Retry.`,failed?'error':'success');e.target.value='';});
document.getElementById('reportUploadList')?.addEventListener('click',async e=>{const rb=e.target.closest('.report-retry-btn');if(rb){const row=rows.find(r=>r.id===reportUploadEditingRowId);if(!row)return;const list=reportListForRow(row,reportUploadEditingType),f=list.find(x=>x.uploadId===rb.dataset.uploadId);if(f)await retryReportFile(row,reportUploadEditingType,f);return;}const db=e.target.closest('.report-delete-btn');if(db){const row=rows.find(r=>r.id===reportUploadEditingRowId);if(!row)return;const list=reportListForRow(row,reportUploadEditingType),f=list[Number(db.dataset.index)];if(!f)return;try{reportSetStatus('Menghapus...');const d=await callServerWithRetry('deleteReportFile',{opdId:row.id,year:currentYear,fileUrl:f.url,uploadId:f.uploadId||null,r2Key:f.r2Key||null,gdriveId:f.gdriveId||null,reportType:reportUploadEditingType},2);setReportListForRow(row,reportUploadEditingType,Array.isArray(d.reports)?d.reports:[]);renderReportUploadList(row,reportUploadEditingType);render();reportSetStatus('File laporan dihapus.','success');}catch(err){reportSetStatus('Gagal hapus: '+err.message,'error');}}});
document.getElementById('reportUploadRefresh')?.addEventListener('click',()=>{if(reportUploadEditingRowId)openReportUploadModal(reportUploadEditingRowId,reportUploadEditingType);});
document.getElementById('reportUploadClose')?.addEventListener('click',closeReportUploadModal);document.getElementById('reportUploadCloseFooter')?.addEventListener('click',closeReportUploadModal);

// ===== EVIDENCE RTP =====
let rtpEvidenceEditingRowId=null;function rtpEvidenceSetStatus(msg,type=''){const e=document.getElementById('rtpEvidenceStatus');if(!e)return;e.textContent=msg||'';e.className='sheet-links-status'+(type?' '+type:'');e.style.display=msg?'block':'none';}

async function replaceRtpEvidenceFile(row, uploadId, file, ui) {
  if (!row || !uploadId || !file) return;
  if (file.size > MAX_FILE_UPLOAD_BYTES) throw new Error('File terlalu besar! Maks 10 MB per file.');
  if (ui?.button) { ui.button.disabled = true; ui.button.textContent = '⏳ Mengganti...'; }
  try {
    const d = await callServerWithRetry('replaceRtpEvidence', {
      __binaryFile: file,
      opdId: row.id,
      year: currentYear,
      uploadId,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream'
    }, 3);
    row.rtpEvidence = Array.isArray(d.rtpEvidence) ? d.rtpEvidence : (row.rtpEvidence || []);
    renderRtpEvidenceList(row);
    updateRtpVerificationTableSummary(row);
    render();
    rtpEvidenceSetStatus('✅ File sudah diganti di R2 dan Google Drive. File lama tidak dibuat sebagai file tambahan. Menunggu verifikasi Inspektorat.','success');
  } finally {
    if (ui?.button) { ui.button.disabled = false; ui.button.textContent = '↻ Ganti File'; }
  }
}

function renderRtpEvidenceList(row){
  const e=document.getElementById('rtpEvidenceList');
  if(!e)return;
  const a=Array.isArray(row.rtpEvidence)?row.rtpEvidence:[];
  const summary=getFileVerificationSummary(a);
  const summaryHtml=`<div class="rtp-verification-summary"><div><strong>Persentase Verifikasi Evidence RTP</strong><b>${summary.percentage.toFixed(0)}%</b></div><div class="rtp-verification-stats">${summary.total} file · Verifikasi selesai ${summary.progress.toFixed(0)}% · Diterima ${summary.accepted} · Catatan ${summary.withNotes} · Dikembalikan ${summary.returned}</div><div class="rtp-verification-legend">Bobot otomatis: Diterima 100% · Diterima dengan Catatan 75% · Dikembalikan 0%</div></div>`;
  if(!a.length){e.innerHTML=summaryHtml+'<div class="sheet-link-card">Belum ada evidence RTP.</div>';updateRtpVerificationTableSummary(row);return;}
  e.innerHTML=summaryHtml+'<div class="rtp-file-list">'+a.map((f,i)=>{
    const status=f.gdriveId?'✅ Google Drive + R2':(f.syncStatus==='retrying'?'🔄 Perlu Retry Google Drive':'⏳ Mengirim ke Google Drive');
    const retry=(f.gdriveId||!f.uploadId)?'':`<button class="rtp-retry-btn" data-upload-id="${sheetLinksEsc(f.uploadId)}">↻ Retry</button>`;
    const v=normalizeVerification(f?.verification);
    const verifyScore=getVerificationScore(f);
    const canReplace=f?.uploadId && v.status==='dikembalikan';
    const replacementNotice=f?.replacementStatus==='menunggu_verifikasi' ? `<div class="file-replacement-notice">✅ File sudah diganti${f.replacedAt?' pada '+sheetLinksEsc(formatVerificationDate(f.replacedAt)):''}. File lama tidak diduplikasi. Menunggu verifikasi Inspektorat.</div>` : '';
    const replaceHtml=canReplace ? `<button class="rtp-replace-btn" data-upload-id="${sheetLinksEsc(f.uploadId)}">↻ Ganti File</button><input type="file" class="rtp-replace-input" hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.webm,.mov,.avi,.mkv,.xlsx,.xls,.ppt,.pptx">` : '';
    const canLegacyVerify=['admin','auditor','ppupd','irban'].includes(String(currentUser?.role||''));
    const workflowButton=f?.uploadId?`<button class="evidence-workflow-btn" data-opd-id="${sheetLinksEsc(row.id)}" data-upload-id="${sheetLinksEsc(f.uploadId)}" data-file-name="${sheetLinksEsc(f.fileName||'Evidence RTP')}">🛡️ Alur Verifikasi</button>`:'';const previewButton=f?.uploadId?`<button type="button" class="evidence-preview-btn" data-opd-id="${sheetLinksEsc(row.id)}" data-upload-id="${sheetLinksEsc(f.uploadId)}" data-file-name="${sheetLinksEsc(f.fileName||'Evidence RTP')}" data-file-type="${sheetLinksEsc(f.fileType||'application/octet-stream')}">👁 Pratinjau</button>`:'';
    const verifyHtml=(f?.uploadId&&canLegacyVerify)?`<div class="file-verification-panel rtp-verification-panel is-${v.status||'pending'}">
      <div class="file-verification-head"><strong>🛡️ Verifikasi Inspektorat</strong><span class="verification-score-badge">${verifyScore}%</span></div>
      ${replacementNotice}
      <div class="verification-form-grid">
        <label>Nama Pemeriksa<input type="text" maxlength="100" class="rtp-verify-examiner" value="${sheetLinksEsc(v.examinerName)}" placeholder="Ketik nama pemeriksa"></label>
        <label>Hasil Verifikasi<select class="rtp-verify-status">${verificationStatusOptions(v.status)}</select></label>
      </div>
      <label class="verify-note-label">Catatan Pemeriksa<textarea maxlength="1000" class="rtp-verify-note" placeholder="Catatan, alasan pengembalian, atau koreksi yang perlu ditindaklanjuti...">${sheetLinksEsc(v.note)}</textarea></label>
      <div class="verification-save-row"><span class="verification-updated">${v.verifiedAt ? 'Diverifikasi: '+sheetLinksEsc(formatVerificationDate(v.verifiedAt)) : 'Belum diverifikasi'}</span><button class="verification-save-btn rtp-verification-save" data-upload-id="${sheetLinksEsc(f.uploadId)}">💾 Simpan Verifikasi</button>${replaceHtml}</div>
    </div>`:(f?.uploadId?`<div class="file-verification-legacy">Alur audit: Auditor mengirim → Irban memverifikasi → BPKP verifikator akhir.${replacementNotice}${replaceHtml}</div>`:'<div class="file-verification-legacy">⚠️ File lama belum memiliki identitas upload. Upload ulang untuk mengaktifkan verifikasi.</div>');
    const canDeleteRtp=!['irban','bpkp'].includes(String(currentUser?.role||''));
    return `<div class="rtp-file-item rtp-file-item-expanded"><div class="rtp-file-top"><div><div class="rtp-file-name">📄 ${sheetLinksEsc(f.fileName||'File')}</div><div class="rtp-file-meta">${status}${f.uploadedAt?' · '+sheetLinksEsc(f.uploadedAt):''}</div></div><div class="rtp-file-actions">${previewButton}<a href="${sheetLinksEsc(f.url||'#')}" target="_blank" rel="noopener noreferrer">Buka</a>${workflowButton}${retry}${canDeleteRtp?`<button class="rtp-delete-btn" data-index="${i}">Hapus</button>`:''}</div></div>${verifyHtml}</div>`;
  }).join('')+'</div>';
  updateRtpVerificationTableSummary(row);
}

async function openRtpEvidenceModal(id){const row=rows.find(r=>r.id===id);if(!row)return;const canUpload=['admin','auditor','opd'].includes(String(currentUser?.role||''));['rtpEvidenceChoose','rtpEvidenceFolderSave'].forEach(k=>{const el=document.getElementById(k);if(el)el.style.display=canUpload?'inline-flex':'none';});const modal=document.getElementById('rtpEvidenceModal');const opdName=document.getElementById('rtpEvidenceOpdName');if(!modal||!opdName){console.error('Modal Evidence RTP belum tersedia di DOM.');return;}rtpEvidenceEditingRowId=id;opdName.textContent=row.opd||'Tanpa Nama';const folderInput=document.getElementById('rtpEvidenceFolderName');const preview=document.getElementById('rtpEvidenceFolderPreview');const setPreview=()=>{if(preview)preview.textContent=(folderInput?.value||'').trim()||'Evidence RTP';};if(folderInput){folderInput.value=row.rtpEvidenceFolder||'Evidence RTP';folderInput.oninput=setPreview;}setPreview();modal.classList.add('active');rtpEvidenceSetStatus('Memuat daftar evidence RTP...');try{const d=await callServer('getRtpEvidence',{opdId:id,year:currentYear});row.rtpEvidence=Array.isArray(d.rtpEvidence)?d.rtpEvidence:[];row.rtpEvidenceFolder=d.folderName||row.rtpEvidenceFolder||'Evidence RTP';row.rtpEvidenceFolderId=d.folderId||row.rtpEvidenceFolderId||null;row.rtpEvidenceFolderUrl=d.folderUrl||row.rtpEvidenceFolderUrl||null;if(folderInput)folderInput.value=row.rtpEvidenceFolder;setPreview();renderRtpEvidenceList(row);rtpEvidenceSetStatus(row.rtpEvidenceFolderUrl?'✅ Folder Google Drive terhubung. Silakan upload file.':'Silakan tulis nama folder, lalu upload file.','success');}catch(err){rtpEvidenceSetStatus('Gagal memuat: '+err.message,'error');}}
async function uploadRtpEvidence(file){
  const row=rows.find(r=>r.id===rtpEvidenceEditingRowId);
  if(!row||!file)return;
  if(file.size>MAX_FILE_UPLOAD_BYTES)throw new Error('File melebihi 10 MB per file');
  const folderInput=document.getElementById('rtpEvidenceFolderName');
  const folderName=(folderInput?.value||row.rtpEvidenceFolder||'Evidence RTP').trim()||'Evidence RTP';
  if(folderName.length>100)throw new Error('Nama folder maksimal 100 karakter');
  row.rtpEvidenceFolder=folderName;
  rtpEvidenceSetStatus('Mengunggah ke R2...');
  const uploadId=crypto.randomUUID();
  const d=await callServer('uploadRtpEvidence',{__binaryFile:file,opdId:row.id,opdName:row.opd||'OPD',year:currentYear,folderName,fileName:file.name,fileType:file.type||'application/octet-stream',uploadId});
  row.rtpEvidence=Array.isArray(d.rtpEvidence)?d.rtpEvidence:[];row.rtpEvidenceFolder=d.folderName||folderName;row.rtpEvidenceFolderId=d.gdriveFolderId||row.rtpEvidenceFolderId||null;row.rtpEvidenceFolderUrl=d.folderUrl||row.rtpEvidenceFolderUrl||null;renderRtpEvidenceList(row);render();
  rtpEvidenceSetStatus(d.syncStatus==='done'?'✅ File masuk Google Drive + R2.':(d.syncStatus==='retrying'?'⚠️ File aman di R2; Google Drive belum berhasil. Retry tersedia.':'⚠️ File aman di R2; retry Google Drive tersedia.'),'success');
}

document.getElementById('rtpEvidenceFolderSave')?.addEventListener('click',async()=>{const row=rows.find(r=>r.id===rtpEvidenceEditingRowId);const input=document.getElementById('rtpEvidenceFolderName');const preview=document.getElementById('rtpEvidenceFolderPreview');if(!row||!input)return;const folderName=(input.value||'').trim()||'Evidence RTP';if(folderName.length>100){rtpEvidenceSetStatus('Nama folder maksimal 100 karakter.','error');return;}try{rtpEvidenceSetStatus('Menyimpan nama folder...');const d=await callServerWithRetry('saveRtpEvidenceFolder',{opdId:row.id,year:currentYear,folderName});row.rtpEvidenceFolder=d.folderName||folderName;row.rtpEvidenceFolderId=d.gdriveFolderId||null;row.rtpEvidenceFolderUrl=d.folderUrl||null;input.value=row.rtpEvidenceFolder;if(preview)preview.textContent=row.rtpEvidenceFolder;rtpEvidenceSetStatus(d.folderUrl?'✅ Folder Google Drive berhasil dibuat/ditautkan. File berikutnya akan masuk ke folder ini.':'Nama folder tersimpan.','success');}catch(err){rtpEvidenceSetStatus('Gagal menyimpan nama folder: '+err.message,'error');}});document.getElementById('rtpEvidenceChoose')?.addEventListener('click',()=>document.getElementById('rtpEvidenceInput')?.click());document.getElementById('rtpEvidenceInput')?.addEventListener('change',async e=>{
  const files=Array.from(e.target.files||[]);
  try {
    validateSelectedUploadFiles(files, 'file Evidence RTP');
  } catch(err) {
    rtpEvidenceSetStatus('❌ ' + err.message, 'error');
    e.target.value='';
    return;
  }
  let cursor=0, failed=0, done=0;
  const worker=async()=>{
    while(cursor<files.length){
      const f=files[cursor++];
      try{await uploadRtpEvidence(f);done++;}
      catch(err){failed++;rtpEvidenceSetStatus(`Upload ${done+failed}/${files.length} — gagal: ${err.message}`,'error');}
    }
  };
  const workers=Array.from({length:Math.min(3,Math.max(1,files.length))},()=>worker());
  await Promise.all(workers);
  rtpEvidenceSetStatus(failed?`Selesai: ${done} berhasil, ${failed} gagal.`:`✅ ${done} file diproses; yang belum masuk Google Drive dapat di-Retry.` ,failed?'error':'success');
  e.target.value='';
});document.getElementById('rtpEvidenceList')?.addEventListener('click',async e=>{
  const vb=e.target.closest('.rtp-verification-save');
  if(vb){
    const row=rows.find(r=>r.id===rtpEvidenceEditingRowId); if(!row)return;
    const file=(row.rtpEvidence||[]).find(x=>x&&x.uploadId===vb.dataset.uploadId); if(!file)return;
    const panel=vb.closest('.file-verification-panel');
    const statusEl=panel?.querySelector('.verification-updated');
    try{
      if(statusEl)statusEl.textContent='⏳ Menyimpan verifikasi...';
      await saveRtpEvidenceVerification(row,file.uploadId,{
        name:panel?.querySelector('.rtp-verify-examiner'),
        note:panel?.querySelector('.rtp-verify-note'),
        status:panel?.querySelector('.rtp-verify-status'),
        button:vb
      });
      if(statusEl)statusEl.style.color='#166534';
    }catch(err){if(statusEl){statusEl.textContent='❌ '+(err.message||err);statusEl.style.color='#b91c1c';}}
    return;
  }
  const rpb=e.target.closest('.rtp-replace-btn');
  if(rpb){
    const input=rpb.parentElement?.querySelector('.rtp-replace-input');
    if(input) input.click();
    return;
  }
  const rpi=e.target.closest('.rtp-replace-input');
  if(rpi) return;
  const rb=e.target.closest('.rtp-retry-btn');
  if(rb){const row=rows.find(r=>r.id===rtpEvidenceEditingRowId);if(!row)return;const f=(row.rtpEvidence||[]).find(x=>x.uploadId===rb.dataset.uploadId);if(!f)return;try{f.syncStatus='retrying';renderRtpEvidenceList(row);rtpEvidenceSetStatus('Mencoba ulang backup Google Drive...');const d=await callServerWithRetry('retryDriveBackup',{opdId:row.id,year:currentYear,type:'rtp',uploadId:f.uploadId},2);f.gdriveId=d.gdriveId||f.gdriveId||null;f.syncStatus=d.syncStatus||'retrying';f.syncError=d.driveError||null;renderRtpEvidenceList(row);render();rtpEvidenceSetStatus(f.gdriveId?'✅ R2 + Google Drive tersimpan.':'🔄 Google Drive belum berhasil. Silakan Retry.',f.gdriveId?'success':'');}catch(err){f.syncStatus='retrying';f.syncError=err.message;renderRtpEvidenceList(row);rtpEvidenceSetStatus('Retry gagal: '+err.message,'error');}return;}
  const b=e.target.closest('.rtp-delete-btn');if(!b)return;const row=rows.find(r=>r.id===rtpEvidenceEditingRowId);if(!row)return;const f=(row.rtpEvidence||[])[Number(b.dataset.index)];if(!f)return;try{rtpEvidenceSetStatus('Menghapus...');const d=await callServerWithRetry('deleteRtpEvidence',{opdId:row.id,year:currentYear,fileUrl:f.url,uploadId:f.uploadId||null,r2Key:f.r2Key||null,gdriveId:f.gdriveId||null});row.rtpEvidence=Array.isArray(d.rtpEvidence)?d.rtpEvidence:[];renderRtpEvidenceList(row);render();rtpEvidenceSetStatus('File dihapus.','success');}catch(err){rtpEvidenceSetStatus('Gagal hapus: '+err.message,'error');}});
document.getElementById('rtpEvidenceList')?.addEventListener('change',async e=>{
  const input=e.target.closest('.rtp-replace-input');
  if(!input) return;
  const row=rows.find(r=>r.id===rtpEvidenceEditingRowId); if(!row) return;
  const file=input.files?.[0]; input.value=''; if(!file) return;
  const fileObj=(row.rtpEvidence||[]).find(x=>x&&x.uploadId===input.closest('.rtp-file-item')?.querySelector('.rtp-replace-btn')?.dataset.uploadId);
  if(!fileObj) return;
  const button=input.closest('.rtp-file-item')?.querySelector('.rtp-replace-btn');
  try{await replaceRtpEvidenceFile(row,fileObj.uploadId,file,{button});}
  catch(err){rtpEvidenceSetStatus('Gagal ganti file: '+(err.message||err),'error');}
});
document.getElementById('rtpEvidenceRefresh')?.addEventListener('click',()=>{if(rtpEvidenceEditingRowId)openRtpEvidenceModal(rtpEvidenceEditingRowId);});function closeRtpEvidenceModal(){document.getElementById('rtpEvidenceModal')?.classList.remove('active');rtpEvidenceEditingRowId=null;}document.getElementById('rtpEvidenceClose')?.addEventListener('click',closeRtpEvidenceModal);document.getElementById('rtpEvidenceCloseFooter')?.addEventListener('click',closeRtpEvidenceModal);

// ============================================================
// PENJAMINAN KUALITAS / QUALITY ASSURANCE APIP
// Berbasis langsung pada Template_Penjaminan_Kualitas_QA_APIP_KAWAL_SPIP.xlsx.
// Evidence tetap diunggah melalui kolom Evidence Struktur & Proses; QA hanya
// menarik dan menautkan evidence dari API yang sama (read-only).
// ============================================================
function qaApipParseFiles(value){
  if(Array.isArray(value)) return value.filter(Boolean);
  if(typeof value==='string' && value.trim()){try{const x=JSON.parse(value);return Array.isArray(x)?x.filter(Boolean):[];}catch{}}
  return [];
}
function qaApipLinkedFiles(row,subCode,paramId,level){
  const item=row?.subunsurs?.[subCode]?.[paramId];
  return qaApipParseFiles(item?.['files'+level]);
}
function qaApipFileUrl(file){return String(file?.url||file?.webViewLink||file?.driveUrl||'');}
function qaApipFileName(file,index=0){return String(file?.fileName||file?.name||`Evidence ${index+1}`);}
function countStructureEvidenceFiles(subunsurs){
  let total=0;const source=subunsurs||{};
  Object.keys(SUBUNSUR_DATA||{}).forEach(subCode=>{
    (SUBUNSUR_DATA[subCode]?.params||[]).forEach(p=>{
      const item=source?.[subCode]?.[p.id];
      for(let lv=1;lv<=5;lv++) total+=qaApipParseFiles(item?.['files'+lv]).length;
    });
  });
  return total;
}
let qaApipMaster=null;
let qaApipCurrentRow=null;
let qaApipEditingRowId=null;
let qaApipStateMap=new Map();
let qaApipSaveTimers=new Map();
let qaApipPendingRows=new Map();
let qaApipTab='form';
let qaApipEvidenceFiles=[];
let qaApipEvidenceIndex=new Map();
let qaApipMasterIndex=new Map();
let qaApipFilters={search:'',subCode:'all',grade:'all',target:'all',page:0};
const QA_APIP_PAGE_SIZE=35;
const QA_APIP_GRADE_ORDER=['E','D','C','B','A'];
const QA_APIP_TARGET_LABEL={T1:'KK3.1',T2:'KK3.2',T3:'KK3.3',T4:'KK3.4'};
function qaApipSetStatus(msg,type=''){
  const el=document.getElementById('qaApipStatus');if(!el)return;
  el.textContent=msg||'';el.className='qa-apip-status'+(type?' '+type:'');el.style.display=msg?'block':'none';
}
function qaApipKey(itemId){return String(itemId||'');}
function qaApipGetState(itemId){return qaApipStateMap.get(qaApipKey(itemId))||{};}
function qaApipSetState(itemId,value){qaApipStateMap.set(qaApipKey(itemId),{...value});}
function qaApipLocationKey(subCode,paramId,grade,itemNo){return `${String(subCode||'')}|${String(paramId||'')}|${String(grade||'').toUpperCase()}|${Number(itemNo)||0}`;}
function qaApipToScore(state={}){
  const availability=String(state.availability||'');
  if(!availability||availability==='N/A')return null;
  if(availability==='Tidak Ada')return 0;
  const substance=String(state.substance||'');
  if(!substance)return null;
  if(substance==='Tidak Sesuai')return 0;
  return state.validity==='Ya'&&state.periodOk==='Ya'&&substance==='Sesuai'?1:0.5;
}
function qaApipConclusion(state={},score=qaApipToScore(state)){
  if(state.availability==='N/A')return 'N/A';
  if(score===null||score===undefined)return 'Belum dinilai';
  if(score===1)return 'Memenuhi';
  if(score===0.5)return 'Memenuhi Sebagian';
  return 'Tidak Memenuhi';
}
function qaApipNormalizeState(x={}){
  const s={availability:x.availability||'',identityDoc:x.identityDoc||'',validity:x.validity||'',periodOk:x.periodOk||'',substance:x.substance||'',note:x.note||'',updatedAt:Number(x.updatedAt||0)};
  s.score=qaApipToScore(s);s.conclusion=qaApipConclusion(s,s.score);return s;
}
async function ensureQaApipMasterLoaded(forceReload=false){
  if(qaApipMaster&&!forceReload)return qaApipMaster;
  // Versi dinamis mencegah browser/CDN memakai master QA APIP lama setelah deploy.
  const asset='/qa-apip-workbook-master.json';
  let data=null,lastError='';
  for(const url of [`${asset}?v=20261014.1`,`${asset}?retry=${Date.now()}`]){
    try{
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok){lastError=`HTTP ${response.status} pada ${url}`;continue;}
      data=await response.json();
      if(data&&Array.isArray(data.items)&&data.items.length===671&&Array.isArray(data.rekapParameters)&&Array.isArray(data.rekapUnsur))break;
      data=null;lastError='Isi master tidak cocok dengan template 671 item.';
    }catch(err){lastError=String(err?.message||err);}
  }
  if(!data)throw new Error(`Master QA APIP tidak dapat dimuat atau tidak valid (${lastError||'respons kosong'}). Pastikan qa-apip-workbook-master.json ikut ter-deploy di folder public.`);
  qaApipMaster=data;
  qaApipMasterIndex=new Map();
  qaApipMaster.items.forEach(it=>qaApipMasterIndex.set(qaApipLocationKey(it.subCode,it.paramId,it.grade,it.itemNo),it));
  return qaApipMaster;
}
function qaApipNormalizeSubCode(value){
  return String(value??'').trim().replace(/\s+/g,'');
}
function qaApipNormalizeParamId(value,subCode=''){
  let result=String(value??'').trim().replace(/\s+/g,'');
  if(!result)return '';
  // Kompatibilitas untuk ID lama berbentuk 3.1-1; format workbook adalah 3.1.1.
  result=result.replace(/^(\d+(?:\.\d+)*)-(\d+)$/,'$1.$2');
  if(/^\d+$/.test(result)&&subCode)result=`${subCode}.${result}`;
  return result;
}
function qaApipEvidenceKey(subCode,paramId,grade){
  return `${qaApipNormalizeSubCode(subCode)}|${qaApipNormalizeParamId(paramId,qaApipNormalizeSubCode(subCode))}|${String(grade||'').trim().toUpperCase()}`;
}
function qaApipIndexEvidence(files){
  // Indeks berbasis identitas workbook lengkap; target T1-T4 tetap melekat ke masing-masing file.
  qaApipEvidenceIndex=new Map();const seen=new Set();const uniqueFiles=[];
  const targetOrder={T1:1,T2:2,T3:3,T4:4};
  (Array.isArray(files)?files:[]).forEach(file=>{
    if(!file)return;
    const subCode=qaApipNormalizeSubCode(file.subunsur);
    const paramId=qaApipNormalizeParamId(file.paramId,subCode);
    const grade=String(file.grade||'').trim().toUpperCase();
    const evidenceKey=String(file.evidenceKey||file.evidence_key||'');
    const targetMatch=evidenceKey.match(/(?:^|[-_])(T[1-4])$/i);
    const targetCode=String(file.targetCode||file.target_code||targetMatch?.[1]||'').trim().toUpperCase();
    if(!subCode||!paramId||!['A','B','C','D','E'].includes(grade))return;
    // Hanya lampiran aktif yang benar-benar memiliki alamat file dan nama dokumen.
    if(!String(file.r2Key||file.r2_key||file.url||'').trim()||!String(file.fileName||file.name||'').trim())return;
    const normalized={...file,subunsur:subCode,paramId,grade,targetCode};
    const unique=String(normalized.uploadId||`${targetCode}|${subCode}|${paramId}|${grade}|${normalized.fileName}`);
    if(seen.has(unique))return;seen.add(unique);uniqueFiles.push(normalized);
    const key=qaApipEvidenceKey(subCode,paramId,grade);
    if(!qaApipEvidenceIndex.has(key))qaApipEvidenceIndex.set(key,[]);
    qaApipEvidenceIndex.get(key).push(normalized);
  });
  uniqueFiles.sort((a,b)=>(targetOrder[a.targetCode]||9)-(targetOrder[b.targetCode]||9)||String(a.subunsur).localeCompare(String(b.subunsur),undefined,{numeric:true})||String(a.paramId).localeCompare(String(b.paramId),undefined,{numeric:true})||String(a.grade).localeCompare(String(b.grade))||String(a.fileName||'').localeCompare(String(b.fileName||'')));
  for(const fileList of qaApipEvidenceIndex.values()){
    fileList.sort((a,b)=>(targetOrder[a.targetCode]||9)-(targetOrder[b.targetCode]||9)||String(a.fileName||'').localeCompare(String(b.fileName||'')));
  }
  qaApipEvidenceFiles=uniqueFiles;
}
let qaApipVariantTargetMap=null;
function qaApipFileTargetCodes(file){
  const key=String(file?.evidenceKey||file?.evidence_key||'');
  if(!qaApipVariantTargetMap){
    qaApipVariantTargetMap=new Map();
    for(const group of (workbookEvidenceMaster?.mergedEvidence?.groups||[])){
      for(const variant of (group.variants||[])){
        const targets=[...new Set((variant.targets||[]).map(x=>String(x).toUpperCase()).filter(x=>['T1','T2','T3','T4'].includes(x)))];
        if(variant.variantKey)qaApipVariantTargetMap.set(String(variant.variantKey),targets);
      }
    }
  }
  const mapped=qaApipVariantTargetMap.get(key);if(mapped?.length)return mapped;
  const raw=String(file?.targetCode||file?.target_code||'').toUpperCase();
  return ['T1','T2','T3','T4'].includes(raw)?[raw]:[];
}
function qaApipFilesForItem(item,targetFilter='all'){
  if(!item)return [];
  const key=qaApipEvidenceKey(item.subCode,item.paramId||`${item.subCode}.${item.paramNo}`,item.grade);
  const files=qaApipEvidenceIndex.get(key)||[];const allowed=new Set(assessmentAllowedTargets(qaApipCurrentRow||''));
  return files.filter(file=>{const codes=qaApipFileTargetCodes(file);const inScope=codes.some(code=>allowed.has(code));return inScope&&(targetFilter==='all'||codes.includes(String(targetFilter).toUpperCase()));});
}
function qaApipFileSyncLabel(file){
  const status=String(file?.syncStatus||file?.sync_status||'pending').toLowerCase();
  if(status==='done')return {label:'Drive tersinkron',className:'is-synced'};
  if(status==='retrying'||status==='error'||status==='failed')return {label:'Drive perlu retry',className:'is-retry'};
  return {label:'Drive menunggu',className:'is-pending'};
}
async function loadQaApipData(row){
  const [qaData,evidenceData]=await Promise.all([
    callServerWithRetry('getQaApipData',{opdId:row.id,year:currentYear},2),
    callServerWithRetry('getWorkbookEvidenceFiles',{opdId:row.id,year:currentYear},2)
  ]);
  qaApipStateMap=new Map();
  (Array.isArray(qaData?.items)?qaData.items:[]).forEach(saved=>{
    const item=qaApipMasterIndex.get(qaApipLocationKey(saved.subunsur,saved.paramId,saved.grade,saved.itemNo));
    if(item)qaApipSetState(item.id,qaApipNormalizeState(saved));
  });
  qaApipIndexEvidence(evidenceData?.files||[]);
  return {qaData,evidenceData};
}
function qaApipMetrics(items){
  const list=Array.isArray(items)?items:[];let evaluated=0,na=0,pending=0,pass=0,partial=0,fail=0,sum=0;
  list.forEach(it=>{
    const st=qaApipGetState(it.id);const score=qaApipToScore(st);
    if(st.availability==='N/A'){na++;return;}
    if(score===null||score===undefined){pending++;return;}
    evaluated++;sum+=score;if(score===1)pass++;else if(score===0.5)partial++;else fail++;
  });
  const total=list.length;const percentage=evaluated?Math.round((sum/evaluated)*10000)/100:0;
  const completion=total?Math.round(((evaluated+na)/total)*10000)/100:0;
  return {total,checked:evaluated+na,evaluated,na,pending,pass,partial,fail,sum:Math.round(sum*10000)/10000,percentage,completion,status:completion>=100?'Selesai':(evaluated+na>0?'Proses':'Belum')};
}
function qaApipSummary(){return qaApipMetrics(qaApipMaster?.items||[]);}
function updateQaApipTableSummary(row,summary){
  const s=summary||row?.qaApipSummary||{};const el=document.querySelector(`.qa-apip-table-summary[data-id="${CSS.escape(String(row?.id||''))}"]`);
  if(el)el.innerHTML=`${Number(s.percentage||0).toFixed(2)}%<small>${Number((s.checked ?? ((Number(s.evaluated)||0)+(Number(s.na)||0))) || 0)}/${Number(s.total||671)} item dinilai · ${Number(s.evidenceFiles||0)} file</small>`;
}
function qaApipTargetCounts(row=qaApipCurrentRow){
  const allowed=new Set(assessmentAllowedTargets(row||''));const out={T1:0,T2:0,T3:0,T4:0};qaApipEvidenceFiles.forEach(f=>qaApipFileTargetCodes(f).forEach(code=>{if(allowed.has(code)&&Object.prototype.hasOwnProperty.call(out,code))out[code]++;}));return out;
}
function qaApipUpdateModalSummary(row){
  const s=qaApipSummary();const allowed=assessmentAllowedTargets(row||'');const targets=qaApipTargetCounts(row);const ev=Object.values(targets).reduce((a,n)=>a+n,0);
  const el=document.getElementById('qaApipSummary');if(!el)return;
  el.innerHTML=`<div class="qa-summary-card qa-summary-result"><span>Hasil QA APIP</span><strong>${s.percentage.toFixed(2)}%</strong><small>Rata-rata nilai item yang sudah dinilai</small></div><div class="qa-summary-card"><span>Total Item Template</span><strong>${s.total}</strong><small>4 sheet · 671 baris evidence</small></div><div class="qa-summary-card"><span>Progres Evaluasi</span><strong>${s.completion.toFixed(2)}%</strong><small>${s.checked}/${s.total} termasuk N/A</small></div><div class="qa-summary-card"><span>Nilai Item</span><strong>${s.pass} / ${s.partial} / ${s.fail}</strong><small>Memenuhi / sebagian / tidak memenuhi</small></div><div class="qa-summary-card"><span>Evidence Terhubung</span><strong>${ev}</strong><small>Ditautkan dari kolom Evidence Struktur & Proses</small></div><div class="qa-summary-card"><span>Target Sumber</span><strong>${allowed.map(code=>`${code} ${targets[code]}`).join(' · ')}</strong><small>${allowed.map(code=>assessmentTargetLabel(code)).join(' · ')}</small></div>`;
  const enriched={...s,evidenceFiles:ev};updateQaApipTableSummary(row,enriched);if(row)row.qaApipSummary=enriched;
}
function renderQaApipPetunjuk(){
  const info=qaApipMaster?.petunjuk?.fields||{};
  return `<div class="qa-sheet-head"><div><div class="qa-kicker">PETUNJUK TEMPLATE EXCEL</div><h4>Kertas Kerja Penjaminan Kualitas / Quality Assurance APIP</h4><p>Tampilan, struktur parameter, alur penilaian, dan perhitungan memakai template <b>Template_Penjaminan_Kualitas_QA_APIP_KAWAL_SPIP.xlsx</b>. Tahun aktif: <b>${escapeHtml(String(currentYear))}</b> · OPD: <b>${escapeHtml(String(qaApipCurrentRow?.opd||''))}</b>.</p></div></div><div class="qa-workbook-note"><b>1. Sumber evidence.</b> Unggah, ganti, dan hapus dokumen hanya dari kolom <b>Evidence Struktur dan Proses</b>. QA APIP menarik dokumen yang cocok secara otomatis dan hanya menampilkan tautan baca-saja; tidak ada tab atau tempat upload evidence kedua.</div><div class="qa-instruction-table-wrap"><table class="qa-instruction-table"><thead><tr><th>No.</th><th>Bagian template</th><th>Aturan di aplikasi</th></tr></thead><tbody><tr><td>1</td><td>KK Penjaminan Kualitas</td><td>671 item penilaian. Kode subunsur, parameter, Grade A–E, tahapan, kriteria, fokus, dan nomor item berasal dari template QA; Nama Evidence yang Disarankan diambil dari kolom L workbook KK3.1–KK3.4 sesuai target dan level. Filter dan halaman digunakan agar tidak memuat ratusan input sekaligus.</td></tr><tr><td>2</td><td>Tarikan file evidence (kolom K)</td><td>File ditautkan berdasarkan kode subunsur, kode parameter lengkap, Grade, dan target T1–T4. Lampiran dikelompokkan per target agar file T1 · KK3.1 tidak tercampur tanpa label dengan T2 · KK3.2, T3 · KK3.3, atau T4 · KK3.4. Hanya file aktif yang tersimpan di sistem evidence yang ditarik.</td></tr><tr><td>3</td><td>Kolom L–Q</td><td>Pilih Ketersediaan (Ada/Tidak Ada/N/A), isi Identitas Dokumen, Keabsahan, Periode Sesuai, Substansi terhadap Kriteria, dan Catatan QA APIP.</td></tr><tr><td>4</td><td>Kolom R–S</td><td>Nilai dan kesimpulan dihitung otomatis: kosong/N/A = tanpa nilai; Tidak Ada = 0; Tidak Sesuai = 0; Ya + Ya + Sesuai = 1; kombinasi lain yang sudah dinilai = 0,5.</td></tr><tr><td>5</td><td>Rekap Parameter & Rekap Unsur</td><td>Persentase dihitung dari nilai numerik yang sudah dinilai, N/A dan item kosong tidak masuk penyebut nilai. Level indikatif memeriksa Grade E→D→C→B→A dengan ambang ${Math.round(Number(qaApipMaster?.gradeThreshold??1)*100)}%.</td></tr><tr><td>6</td><td>Ekspor Excel</td><td>Mengunduh workbook template empat sheet dan mengisi data OPD, tahun, tautan evidence, serta isian QA. Rumus asli pada kolom R, S, U dan formula rekap dipertahankan untuk dihitung kembali ketika file dibuka di Excel.</td></tr></tbody></table></div><div class="qa-formula-box"><b>Catatan sumber:</b> File tidak ditemukan bila belum diunggah pada Evidence Struktur & Proses untuk kombinasi subunsur/parameter/grade terkait. Pastikan dokumen ditempatkan pada target KK3.1–KK3.4 yang benar. Data QA disimpan terpisah per OPD dan tahun; rekap satu OPD tidak tercampur dengan OPD lain.</div>`;
}
function qaApipSelect(field,value,options,label){
  return `<label class="qa-input-label"><span>${escapeHtml(label)}</span><select data-qa-field="${field}" aria-label="${escapeHtml(label)}"><option value="">— Pilih —</option>${options.map(o=>`<option value="${escapeHtml(o)}" ${String(value||'')===o?'selected':''}>${escapeHtml(o)}</option>`).join('')}</select></label>`;
}
function qaApipFileMarkup(item){
  const files=qaApipFilesForItem(item,qaApipFilters.target);
  const allowedTargets=assessmentAllowedTargets(qaApipCurrentRow||'');const targetCodes=qaApipFilters.target==='all'?allowedTargets:[qaApipFilters.target];
  const targetLabel=code=>assessmentTargetLabel(code);
  if(!files.length){
    const targetMsg=qaApipFilters.target==='all'?'untuk parameter dan grade ini':`pada ${targetLabel(qaApipFilters.target)}`;
    return `<div class="qa-file-empty"><span class="qa-no-file">Belum ada file dari Evidence Struktur & Proses ${targetMsg}.</span><small class="qa-file-count">Kunci: ${escapeHtml(item.subCode)} · ${escapeHtml(item.paramId||`${item.subCode}.${item.paramNo}`)} · Grade ${escapeHtml(item.grade)}</small></div>`;
  }
  const groups=targetCodes.map(code=>({code,files:files.filter(f=>qaApipFileTargetCodes(f).includes(code))})).filter(g=>g.files.length||qaApipFilters.target!=='all');
  const renderFile=(file,index)=>{
    const name=qaApipFileName(file,index);const url=qaApipFileUrl(file);const sync=qaApipFileSyncLabel(file);
    const link=url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Buka evidence: ${escapeHtml(name)}">${escapeHtml(name)}</a>`:`<span class="qa-file-name">${escapeHtml(name)}</span>`;
    const error=file.syncError||file.sync_error||'';
    return `<div class="qa-target-file-row">${link}<span class="qa-drive-pill ${sync.className}" title="${escapeHtml(error||sync.label)}">${escapeHtml(sync.label)}</span></div>`;
  };
  const groupHtml=groups.map(group=>{
    const items=group.files;const visible=items.slice(0,3).map(renderFile).join('');
    const more=items.length>3?`<details class="qa-file-more"><summary>Lihat ${items.length-3} file lainnya</summary>${items.slice(3).map((f,i)=>renderFile(f,i+3)).join('')}</details>`:'';
    return `<section class="qa-target-file-group"><div class="qa-target-file-head"><b>${escapeHtml(targetLabel(group.code))}</b><span>${items.length} file</span></div>${visible}${more}</section>`;
  }).join('');
  return `<div class="qa-file-stack qa-file-stack-targets">${groupHtml}<small class="qa-file-count">${files.length} file terhubung · sumber baca-saja</small></div>`;
}
function qaApipRecommendedEvidenceGroups(item){
  const master=workbookEvidenceMaster;const selected=qaApipFilters?.target||'all';const allowed=assessmentAllowedTargets(qaApipCurrentRow||'');
  const targetCodes=(selected==='all'?allowed:allowed.filter(code=>code===selected));
  const result=[];
  for(const code of targetCodes){
    const target=(master?.targets||[]).find(t=>String(t.code)===String(code));if(!target)continue;
    const param=(target.parameters||[]).find(p=>String(p.subCode||'')===String(item?.subCode||'')&&String(p.paramId||'')===String(item?.paramId||''));
    const lines=param?.grades?.[String(item?.grade||'')]?.evidenceDisarankan;
    if(Array.isArray(lines)&&lines.length)result.push({code,label:`${code} · ${target.sheet||({'T1':'KK3.1','T2':'KK3.2','T3':'KK3.3','T4':'KK3.4'}[code]||code)}`,lines});
  }
  return result;
}
function qaApipRecommendedEvidenceMarkup(item){
  const groups=qaApipRecommendedEvidenceGroups(item);
  if(!groups.length)return escapeHtml(item?.recommendedEvidence||'—');
  return groups.map(g=>`<div class="qa-suggested-group"><b>${escapeHtml(g.label)}</b><ul>${g.lines.map(line=>`<li>${escapeHtml(line)}</li>`).join('')}</ul></div>`).join('');
}
function qaApipRecommendedEvidenceSearchText(item){
  const groups=qaApipRecommendedEvidenceGroups(item);
  return groups.length?groups.flatMap(g=>[g.label,...g.lines]).join(' '):String(item?.recommendedEvidence||'');
}
function qaApipFilteredItems(){
  let list=qaApipMaster?.items||[];const f=qaApipFilters;
  if(f.subCode!=='all')list=list.filter(x=>x.subCode===f.subCode);
  if(f.grade!=='all')list=list.filter(x=>x.grade===f.grade);
  if(f.search.trim()){
    const q=f.search.trim().toLocaleLowerCase('id');
    list=list.filter(x=>[x.id,x.subCode,x.subunsur,x.paramNo,x.parameter,x.grade,x.stage,x.criteria,x.focus,x.itemNo,x.recommendedEvidence,qaApipRecommendedEvidenceSearchText(x)].some(v=>String(v??'').toLocaleLowerCase('id').includes(q)));
  }
  return list;
}
function renderQaApipChecklist(){
  const all=qaApipMaster?.items||[];const filtered=qaApipFilteredItems();const pages=Math.max(1,Math.ceil(filtered.length/QA_APIP_PAGE_SIZE));qaApipFilters.page=Math.max(0,Math.min(qaApipFilters.page,pages-1));const start=qaApipFilters.page*QA_APIP_PAGE_SIZE;const pageItems=filtered.slice(start,start+QA_APIP_PAGE_SIZE);const s=qaApipSummary();
  const codes=[...new Map(all.map(x=>[x.subCode,x.subunsur])).entries()];
  const allowedTargets=assessmentAllowedTargets(qaApipCurrentRow||'');if(qaApipFilters.target!=='all'&&!allowedTargets.includes(qaApipFilters.target))qaApipFilters.target='all';
  const targetOptions=allowedTargets.map(code=>`<option value="${code}" ${qaApipFilters.target===code?'selected':''}>${escapeHtml(assessmentTargetLabel(code))}</option>`).join('');
  let html=`<div class="qa-sheet-head"><div><div class="qa-kicker">KK PENJAMINAN KUALITAS</div><h4>Form Penjaminan Kualitas / Quality Assurance APIP</h4><p>${escapeHtml(assessmentScopeDescription(qaApipCurrentRow))} Evidence rekomendasi dan tautan file ditarik dari master Structure &amp; Process sesuai target yang berwenang; data antar OPD tidak dicampur.</p></div><div class="qa-param-score-box"><span>Nilai QA APIP</span><strong>${s.percentage.toFixed(2)}%</strong><small>${s.evaluated} dinilai · ${s.na} N/A · ${s.pending} belum dinilai</small></div></div><div class="qa-apip-filter-bar"><label><span>Cari kode / parameter / evidence</span><input id="qaApipSearch" type="search" placeholder="Mis. 3.1, risiko, dokumen..." value="${escapeHtml(qaApipFilters.search)}"></label><label><span>Subunsur</span><select id="qaApipSubFilter"><option value="all">Semua subunsur</option>${codes.map(([code,name])=>`<option value="${escapeHtml(code)}" ${qaApipFilters.subCode===code?'selected':''}>${escapeHtml(code)} — ${escapeHtml(name)}</option>`).join('')}</select></label><label><span>Grade</span><select id="qaApipGradeFilter"><option value="all">Semua Grade</option>${QA_APIP_GRADE_ORDER.slice().reverse().map(g=>`<option value="${g}" ${qaApipFilters.grade===g?'selected':''}>Grade ${g}</option>`).join('')}</select></label><label><span>Target sumber evidence</span><select id="qaApipTargetFilter"><option value="all" ${qaApipFilters.target==='all'?'selected':''}>Semua target yang berlaku</option>${targetOptions}</select></label><div class="qa-apip-filter-count"><b>${filtered.length.toLocaleString('id-ID')}</b><span>dari ${all.length} item</span><small>Rekomendasi dan lampiran dibatasi sesuai cakupan OPD ini.</small></div></div><div class="qa-table-wrap qa-apip-item-table-wrap"><table class="qa-item-table qa-apip-template-table"><thead><tr><th>Kode Subunsur / Parameter</th><th>Grade / Tahapan / Kriteria / Fokus</th><th>No. Item</th><th>Nama Evidence yang Disarankan</th><th>File Evidence · Tarikan Evidence Struktur & Proses</th><th>Ketersediaan</th><th>Identitas Dokumen yang Diperiksa</th><th>Keabsahan</th><th>Periode Sesuai</th><th>Substansi vs Kriteria</th><th>Catatan Penjamin Kualitas / QA APIP</th><th>Nilai</th><th>Kesimpulan Item</th></tr></thead><tbody>`;
  pageItems.forEach(it=>{
    const st=qaApipGetState(it.id);const score=qaApipToScore(st);const concl=qaApipConclusion(st,score);
    html+=`<tr class="qa-item-row" data-qa-item="${it.id}"><td><div class="qa-stage"><b>${escapeHtml(it.subCode)} · ${escapeHtml(String(it.paramNo))}</b><span>${escapeHtml(it.subunsur)}</span><small>${escapeHtml(it.parameter)}</small><small>Kunci: ${escapeHtml(it.paramId)} · baris template ${it.sourceRow}</small></div></td><td><div class="qa-stage"><b>Grade ${escapeHtml(it.grade)} · ${escapeHtml(it.stage)}</b><span>${escapeHtml(it.criteria)}</span><small><b>Fokus:</b> ${escapeHtml(it.focus)}</small></div></td><td class="qa-item-no">${it.itemNo}</td><td><div class="qa-suggested">${qaApipRecommendedEvidenceMarkup(it)}</div></td><td>${qaApipFileMarkup(it)}</td><td>${qaApipSelect('availability',st.availability,['Ada','Tidak Ada','N/A'],'Ketersediaan')}</td><td><label class="qa-input-label"><span>Identitas dokumen</span><input type="text" data-qa-field="identityDoc" maxlength="500" value="${escapeHtml(st.identityDoc||'')}" placeholder="Judul, nomor, tanggal" /></label></td><td>${qaApipSelect('validity',st.validity,['Ya','Tidak'],'Keabsahan')}</td><td>${qaApipSelect('periodOk',st.periodOk,['Ya','Tidak'],'Periode')}</td><td>${qaApipSelect('substance',st.substance,['Sesuai','Sebagian','Tidak Sesuai'],'Substansi')}</td><td><label class="qa-input-label"><span>Catatan / alasan N/A</span><textarea data-qa-field="note" rows="2" maxlength="1000" placeholder="Catatan penjamin kualitas">${escapeHtml(st.note||'')}</textarea></label></td><td class="qa-score"><b data-qa-score>${score===null?'—':score.toLocaleString('id-ID',{maximumFractionDigits:1})}</b></td><td class="qa-conclusion"><span class="qa-conclusion-badge" data-qa-conclusion>${escapeHtml(concl)}</span></td></tr>`;
  });
  if(!pageItems.length)html+=`<tr><td colspan="13" class="qa-empty-filter">Tidak ada item yang sesuai pencarian/filter.</td></tr>`;
  html+=`</tbody></table></div><div class="qa-apip-pagination"><span>Menampilkan ${filtered.length?start+1:0}–${Math.min(start+QA_APIP_PAGE_SIZE,filtered.length)} dari ${filtered.length} item · halaman ${qaApipFilters.page+1}/${pages}</span><div><button type="button" class="qa-apip-page-btn" data-qa-page="prev" ${qaApipFilters.page<=0?'disabled':''}>← Sebelumnya</button><button type="button" class="qa-apip-page-btn" data-qa-page="next" ${qaApipFilters.page>=pages-1?'disabled':''}>Berikutnya →</button></div></div><div class="qa-formula-box"><b>Formula nilai:</b> N/A atau ketersediaan kosong tidak menghasilkan nilai; Tidak Ada = 0; Tidak Sesuai = 0; Keabsahan = Ya + Periode = Ya + Substansi = Sesuai menghasilkan 1; kombinasi lain yang sudah dinilai menghasilkan 0,5. Perubahan tersimpan otomatis.</div>`;
  return html;
}
function qaApipGroupMetrics(items){
  const metrics=qaApipMetrics(items);const grade={};
  QA_APIP_GRADE_ORDER.forEach(g=>{const gi=items.filter(x=>x.grade===g);const gm=qaApipMetrics(gi);grade[g]={...gm,percent:gm.evaluated?gm.percentage:null,items:gi.length};});
  let level=0;
  QA_APIP_GRADE_ORDER.forEach((g,i)=>{if(level===i&&grade[g].percent!==null&&grade[g].percent+1e-8>=Number(qaApipMaster?.gradeThreshold??1)*100)level=i+1;});
  return {...metrics,grade,level};
}
function qaApipLevelNext(level,items){
  if(!items.length)return 'Tidak ada item';
  if(level>=5)return 'Seluruh Grade E–A terpenuhi';
  const next=QA_APIP_GRADE_ORDER[level];const gradeItems=items.filter(x=>x.grade===next);const m=qaApipMetrics(gradeItems);
  if(!gradeItems.length)return `Grade ${next} tidak memiliki item`;
  const pending=m.pending;return pending?`Lengkapi ${pending} item Grade ${next}`:`Periksa pemenuhan Grade ${next}`;
}
function renderQaApipRekapParameter(){
  const master=qaApipMaster?.rekapParameters||[];const rows=master.map(p=>{
    const items=(qaApipMaster.items||[]).filter(it=>it.parameterKey===p.parameterKey);const m=qaApipGroupMetrics(items);
    return {p,items,m};
  });
  const all=qaApipSummary();
  return `<div class="qa-sheet-head"><div><div class="qa-kicker">REKAP PARAMETER · SHEET EXCEL 3</div><h4>Rekap Parameter</h4><p>43 parameter mengikuti susunan template. Nilai per grade dihitung dari item yang sudah mempunyai nilai numerik; N/A dan item kosong tidak masuk penyebut persentase.</p></div><div class="qa-param-score-box"><span>Nilai QA APIP</span><strong>${all.percentage.toFixed(2)}%</strong><small>${all.evaluated}/${all.total} item dinilai</small></div></div><div class="qa-summary-table-wrap"><table><thead><tr><th>No</th><th class="qa-left">Kode Subunsur</th><th class="qa-left">Uraian Subunsur</th><th>No Par.</th><th class="qa-left">Uraian Parameter</th><th>Jml Item</th><th>N/A</th><th>Dinilai</th><th>Belum</th><th>% Grade E</th><th>% Grade D</th><th>% Grade C</th><th>% Grade B</th><th>% Grade A</th><th>% Pemenuhan Parameter</th><th>Grade Indikatif</th><th>Level</th><th>Grade Berikutnya</th></tr></thead><tbody>${rows.map(({p,items,m})=>`<tr><td>${p.no}</td><td class="qa-left">${escapeHtml(p.subCode)}</td><td class="qa-left">${escapeHtml(p.subunsur)}</td><td>${p.paramNo}</td><td class="qa-left">${escapeHtml(items[0]?.parameter||p.paramId)}</td><td>${m.total}</td><td>${m.na}</td><td>${m.evaluated}</td><td>${m.pending}</td>${QA_APIP_GRADE_ORDER.map(g=>`<td>${m.grade[g].percent===null?'—':m.grade[g].percent.toFixed(2)+'%'}</td>`).join('')}<td>${m.evaluated?m.percentage.toFixed(2)+'%':'—'}</td><td><b>${m.level?QA_APIP_GRADE_ORDER[m.level-1]:'—'}</b></td><td>${m.level||0}</td><td class="qa-left">${escapeHtml(qaApipLevelNext(m.level,items))}</td></tr>`).join('')}</tbody></table></div><div class="qa-formula-box">Urutan indikatif grade: E → D → C → B → A. Ambang yang dipakai adalah ${Math.round(Number(qaApipMaster?.gradeThreshold??1)*100)}%, mengikuti nilai awal pada template. Data tersimpan per OPD/tahun.</div>`;
}
function renderQaApipRekapUnsur(){
  const master=qaApipMaster?.rekapUnsur||[];const allItems=qaApipMaster?.items||[];const rows=master.map(u=>{
    const items=allItems.filter(it=>u.isElement?it.subCode.startsWith(u.code+'.'):it.subCode===u.code);const m=qaApipGroupMetrics(items);
    const paramRows=(qaApipMaster.rekapParameters||[]).filter(p=>u.isElement?p.subCode.startsWith(u.code+'.'):p.subCode===u.code);
    const paramsWithLevel3=paramRows.filter(p=>{const its=allItems.filter(it=>it.parameterKey===p.parameterKey);return qaApipGroupMetrics(its).level>=3;}).length;
    const category=m.evaluated===0?'Belum dinilai':m.percentage>=80?'Tinggi':m.percentage>=60?'Cukup':m.percentage>=40?'Kurang':'Rendah';
    return {u,items,m,paramCount:paramRows.length,paramsWithLevel3,category};
  });
  const overall=qaApipSummary();
  return `<div class="qa-sheet-head"><div><div class="qa-kicker">REKAP UNSUR · SHEET EXCEL 4</div><h4>Rekap Unsur dan KPI QA APIP</h4><p>Ringkasan lima unsur serta seluruh subunsur, mengikuti baris rekap pada template.</p></div><div class="qa-param-score-box"><span>KPI QA APIP</span><strong>${overall.percentage.toFixed(2)}%</strong><small>Σ nilai / jumlah item bernilai numerik</small></div></div><div class="qa-summary-table-wrap"><table><thead><tr><th class="qa-left">Kode</th><th class="qa-left">Unsur / Subunsur</th><th>Jml Parameter</th><th>Jml Item Evidence</th><th>Item N/A</th><th>Item Dinilai</th><th>Σ Nilai</th><th>% Pemenuhan Dokumen</th><th>Parameter ≥ Level 3</th><th>Kategori</th><th>Progress</th></tr></thead><tbody>${rows.map(({u,items,m,paramCount,paramsWithLevel3,category})=>`<tr class="${u.isElement?'qa-unsur-row':''}"><td class="qa-left">${escapeHtml(u.code)}</td><td class="qa-left">${escapeHtml(u.name)}</td><td>${paramCount}</td><td>${items.length}</td><td>${m.na}</td><td>${m.evaluated}</td><td>${m.sum.toLocaleString('id-ID',{maximumFractionDigits:2})}</td><td>${m.evaluated?m.percentage.toFixed(2)+'%':'—'}</td><td>${paramsWithLevel3}/${paramCount}</td><td><span class="qa-category ${category.toLocaleLowerCase('id').replace(/[^a-z0-9]+/g,'-')}">${category}</span></td><td>${m.completion.toFixed(2)}%</td></tr>`).join('')}</tbody></table></div><div class="qa-formula-box"><b>Perhitungan KPI:</b> jumlah nilai numerik dibagi jumlah item dengan nilai numerik, dikali 100. Nilai kosong dan N/A dikecualikan dari penyebut, sesuai formula KPI pada template Excel.</div>`;
}
function qaApipReadStateFromRow(rowEl){
  const get=f=>rowEl.querySelector(`[data-qa-field="${f}"]`)?.value||'';
  return qaApipNormalizeState({availability:get('availability'),identityDoc:get('identityDoc'),validity:get('validity'),periodOk:get('periodOk'),substance:get('substance'),note:get('note'),updatedAt:Date.now()});
}
function qaApipUpdateItemRow(rowEl){
  if(!rowEl)return;const id=String(rowEl.dataset.qaItem||'');const item=(qaApipMaster?.items||[]).find(x=>x.id===id);if(!item)return;
  const st=qaApipReadStateFromRow(rowEl);qaApipSetState(id,st);
  const score=rowEl.querySelector('[data-qa-score]');if(score)score.textContent=st.score===null?'—':st.score.toLocaleString('id-ID',{maximumFractionDigits:1});
  const conclusion=rowEl.querySelector('[data-qa-conclusion]');if(conclusion)conclusion.textContent=st.conclusion;
  qaApipUpdateModalSummary(qaApipCurrentRow);
}
async function saveQaApipChecklistFromDom(rowEl){
  if(!rowEl||!qaApipCurrentRow)return;
  const targetRow=qaApipCurrentRow;const targetYear=currentYear;const itemId=String(rowEl.dataset.qaItem||'');const item=(qaApipMaster?.items||[]).find(x=>x.id===itemId);if(!item)return;
  const state=qaApipReadStateFromRow(rowEl);qaApipSetState(itemId,state);qaApipUpdateModalSummary(targetRow);
  const params={opdId:targetRow.id,year:targetYear,subunsur:item.subCode,paramId:item.paramId,grade:item.grade,itemNo:item.itemNo,availability:state.availability,identityDoc:state.identityDoc,validity:state.validity,periodOk:state.periodOk,substance:state.substance,note:state.note,examinerName:''};
  const isSameContext=()=>Boolean(qaApipCurrentRow&&String(qaApipCurrentRow.id)===String(targetRow.id)&&String(currentYear)===String(targetYear));
  if(isSameContext())qaApipSetStatus('⏳ Menyimpan perubahan QA APIP...');
  try{
    const d=await callServerWithRetry('saveQaApipItem',params,3);
    if(d?.item&&isSameContext())qaApipSetState(itemId,qaApipNormalizeState(d.item));
    if(d?.summary){
      const enriched={...d.summary,evidenceFiles:Number(d.summary.evidenceFiles??targetRow.qaApipSummary?.evidenceFiles??0)};
      targetRow.qaApipSummary=enriched;targetRow.qaApip=d.summary.status||targetRow.qaApip;updateQaApipTableSummary(targetRow,enriched);
    }
    if(isSameContext()){qaApipUpdateModalSummary(qaApipCurrentRow);qaApipSetStatus('✓ Perubahan QA APIP tersimpan otomatis.','success');}
  }catch(err){if(isSameContext())qaApipSetStatus('❌ Gagal menyimpan QA APIP: '+(err.message||err),'error');}
}
function scheduleQaApipSave(rowEl){
  if(!rowEl)return;const key=String(rowEl.dataset.qaItem||'');clearTimeout(qaApipSaveTimers.get(key));
  qaApipPendingRows.set(key,rowEl);
  qaApipSaveTimers.set(key,setTimeout(()=>{qaApipSaveTimers.delete(key);qaApipPendingRows.delete(key);saveQaApipChecklistFromDom(rowEl);},550));
}
async function refreshQaApipEvidenceFiles(silent=false){
  if(!qaApipCurrentRow)return;
  try{const d=await callServerWithRetry('getWorkbookEvidenceFiles',{opdId:qaApipCurrentRow.id,year:currentYear},2);qaApipIndexEvidence(d?.files||[]);qaApipUpdateModalSummary(qaApipCurrentRow);if(qaApipTab==='form')renderQaApipModal();if(!silent)qaApipSetStatus('✓ Tarikan Evidence Struktur & Proses diperbarui.','success');}
  catch(err){if(!silent)qaApipSetStatus('Tidak dapat memperbarui tarikan evidence: '+(err.message||err),'error');}
}
function qaApipXmlEscape(value){
  return String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function qaApipCellXmlFromAttrs(attrs,value,kind='string'){
  const cleanAttrs=String(attrs||'').replace(/\s+t="[^"]*"/g,'');
  if(value===null||value===undefined||value==='')return `<c${cleanAttrs}></c>`;
  if(kind==='number')return `<c${cleanAttrs} t="n"><v>${String(Number(value))}</v></c>`;
  return `<c${cleanAttrs} t="inlineStr"><is><t xml:space="preserve">${qaApipXmlEscape(value)}</t></is></c>`;
}
function qaApipPatchCellXml(xml,address,value,kind='string'){
  const safeAddress=String(address).replace(/[^A-Z0-9]/g,'');
  const rx=new RegExp(`<c\\b([^>]*\\br="${safeAddress}"[^>]*)>([\\s\\S]*?)<\\/c>|<c\\b([^>]*\\br="${safeAddress}"[^>]*)\\s*\\/>`);
  let changed=false;
  const next=xml.replace(rx,(whole,normalAttrs,_body,selfAttrs)=>{changed=true;return qaApipCellXmlFromAttrs(normalAttrs??selfAttrs,value,kind);});
  if(!changed)throw new Error(`Sel ${safeAddress} tidak ditemukan di workbook template.`);
  return next;
}
function qaApipPatchCellsXml(xml,updates){
  const found=new Set();
  const rx=/<c\b([^>]*\br="([A-Z]+[0-9]+)"[^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*\br="([A-Z]+[0-9]+)"[^>]*)\s*\/>/g;
  const next=xml.replace(rx,(whole,attrs1,address1,_body,attrs2,address2)=>{
    const address=address1||address2;if(!updates.has(address))return whole;
    found.add(address);return qaApipCellXmlFromAttrs(attrs1??attrs2,updates.get(address).value,updates.get(address).kind||'string');
  });
  const missing=[...updates.keys()].filter(address=>!found.has(address));
  if(missing.length)throw new Error(`Sel input template tidak ditemukan: ${missing.slice(0,8).join(', ')}${missing.length>8?'…':''}.`);
  return next;
}
function qaApipCorrectValidationRanges(sheetXml){
  // Rentang validasi pada berkas sumber bergeser: opsi Ketersediaan, Ya/Tidak, dan Substansi harus mengikuti kolom input berjudulnya.
  const ranges=[['K6:K676','L6:L676'],['M6:N676','N6:O676'],['O6:O676','P6:P676']];
  for(const [from,to] of ranges){
    const needle=`sqref="${from}"`;
    if(!sheetXml.includes(needle))throw new Error(`Validasi Excel untuk rentang ${from} tidak ditemukan.`);
    sheetXml=sheetXml.replace(needle,`sqref="${to}"`);
  }
  return sheetXml;
}
function qaApipAppendExternalLinks(sheetXml,relationshipsXml,entries){
  const rows=(Array.isArray(entries)?entries:[]).filter(x=>x&&/^K[0-9]+$/.test(x.address)&&/^https?:\/\//i.test(String(x.url||'')));
  if(!rows.length)return {sheetXml,relationshipsXml};
  const used=new Set();
  for(const match of relationshipsXml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"/g))used.add(match[1]);
  const relationshipParts=[];const hyperlinkParts=[];let counter=1;
  rows.forEach(entry=>{
    let id=`rIdQA${counter++}`;while(used.has(id))id=`rIdQA${counter++}`;used.add(id);
    relationshipParts.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${qaApipXmlEscape(entry.url)}" TargetMode="External"/>`);
    hyperlinkParts.push(`<hyperlink ref="${entry.address}" r:id="${id}" tooltip="${qaApipXmlEscape(entry.tooltip||'Buka file evidence terhubung')}"/>`);
  });
  if(!/xmlns:r="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships"/.test(sheetXml.slice(0,sheetXml.indexOf('>')+1))){
    sheetXml=sheetXml.replace('<worksheet','<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"');
  }
  const existing=sheetXml.match(/<hyperlinks(?:\s[^>]*)?>([\s\S]*?)<\/hyperlinks>/);
  if(existing)sheetXml=sheetXml.replace(existing[0],existing[0].replace('</hyperlinks>',`${hyperlinkParts.join('')}</hyperlinks>`));
  else if(sheetXml.includes('</dataValidations>'))sheetXml=sheetXml.replace('</dataValidations>',`</dataValidations><hyperlinks>${hyperlinkParts.join('')}</hyperlinks>`);
  else if(sheetXml.includes('<printOptions'))sheetXml=sheetXml.replace('<printOptions',`<hyperlinks>${hyperlinkParts.join('')}</hyperlinks><printOptions`);
  else throw new Error('Lokasi hyperlink pada sheet template tidak ditemukan.');
  relationshipsXml=relationshipsXml.replace('</Relationships>',`${relationshipParts.join('')}</Relationships>`);
  return {sheetXml,relationshipsXml};
}
async function exportQaApipExcel(){
  if(!qaApipCurrentRow||!window.JSZip||!qaApipMaster){qaApipSetStatus('Export Excel QA APIP tidak tersedia. Pastikan pustaka ekspor dimuat.','error');return;}
  const btn=document.getElementById('qaApipExport');if(btn){btn.disabled=true;btn.textContent='⏳ Menyiapkan Excel...';}
  try{
    // Muat ulang sumber file sekali agar isi export mengikutkan upload Evidence Struktur & Proses yang paling baru.
    await refreshQaApipEvidenceFiles(true);
    const res=await fetch('/Template_Penjaminan_Kualitas_QA_APIP_KAWAL_SPIP.xlsx?v=20261012.3',{cache:'no-cache'});
    if(!res.ok)throw new Error(`Template Excel tidak ditemukan (HTTP ${res.status}).`);
    const zip=await JSZip.loadAsync(await res.arrayBuffer());
    const sheet1File=zip.file('xl/worksheets/sheet1.xml');
    const sheet2File=zip.file('xl/worksheets/sheet2.xml');
    const relFile=zip.file('xl/worksheets/_rels/sheet2.xml.rels');
    if(!sheet1File||!sheet2File||!relFile)throw new Error('Bagian worksheet template tidak lengkap; export dibatalkan agar file tidak rusak.');
    let sheet1=await sheet1File.async('string');
    let sheet2=await sheet2File.async('string');
    let relationships=await relFile.async('string');
    // Hanya mengganti sel input. Semua formula, format, merge, petunjuk cetak dan sheet rekap berasal dari Excel asli; rentang validasi input diperbaiki agar sesuai judul kolom.
    sheet1=qaApipPatchCellXml(sheet1,'C5',qaApipCurrentRow.opd||'','string');
    sheet1=qaApipPatchCellXml(sheet1,'C6',Number(currentYear)||Number(new Date().getFullYear()),'number');
    const hyperlinks=[];const cellUpdates=new Map();
    (qaApipMaster.items||[]).forEach(it=>{
      const state=qaApipGetState(it.id);const files=qaApipFilesForItem(it);const row=Number(it.sourceRow);
      const fileText=files.map((f,i)=>`${f.targetCode||'Target'}${QA_APIP_TARGET_LABEL[String(f.targetCode||'')]?' · '+QA_APIP_TARGET_LABEL[String(f.targetCode)]:''} — ${qaApipFileName(f,i)}`).join('\n').slice(0,30000);
      [['K',fileText],['L',state.availability||''],['M',state.identityDoc||''],['N',state.validity||''],['O',state.periodOk||''],['P',state.substance||''],['Q',state.note||'']].forEach(([col,value])=>cellUpdates.set(`${col}${row}`,{value,kind:'string'}));
      const firstLink=files.find(file=>/^https?:\/\//i.test(String(qaApipFileUrl(file)||'')));
      if(firstLink)hyperlinks.push({address:`K${row}`,url:qaApipFileUrl(firstLink),tooltip:`Buka evidence ${firstLink.targetCode||'target belum tercatat'}: ${qaApipFileName(firstLink)}`});
    });
    sheet2=qaApipPatchCellsXml(sheet2,cellUpdates);
    sheet2=qaApipCorrectValidationRanges(sheet2);
    const linked=qaApipAppendExternalLinks(sheet2,relationships,hyperlinks);
    sheet2=linked.sheetXml;relationships=linked.relationshipsXml;
    zip.file('xl/worksheets/sheet1.xml',sheet1);
    zip.file('xl/worksheets/sheet2.xml',sheet2);
    zip.file('xl/worksheets/_rels/sheet2.xml.rels',relationships);
    // Workbook dihitung ulang saat dibuka di Excel; formula sel R/S/U dan semua sheet rekap tetap persis dari template sumber.
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
    const safe=(qaApipCurrentRow.opd||'OPD').replace(/[\\/:*?"<>|]/g,' ').trim().substring(0,65)||'OPD';
    const filename=`${safe}-${currentYear}-Penjaminan-Kualitas-QA-APIP.xlsx`;
    const objectUrl=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=objectUrl;anchor.download=filename;anchor.style.display='none';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1500);
    qaApipSetStatus('✓ Ekspor Excel QA APIP berhasil. Template, rumus, format sel, merge dan seluruh rumus Excel asli dipertahankan; validasi input disejajarkan dengan judul kolom dan file evidence menjadi tautan pada kolom K.','success');
  }catch(err){qaApipSetStatus('❌ Export QA APIP gagal: '+(err.message||err),'error');}
  finally{if(btn){btn.disabled=false;btn.textContent='⬇️ Export Excel';}}
}
function renderQaApipModal(){
  const row=qaApipCurrentRow;if(!row)return;document.querySelectorAll('#qaApipTabs [data-qa-tab]').forEach(b=>b.classList.toggle('active',b.dataset.qaTab===qaApipTab));qaApipUpdateModalSummary(row);const c=document.getElementById('qaApipContent');if(!c)return;
  if(qaApipTab==='petunjuk')c.innerHTML=renderQaApipPetunjuk();else if(qaApipTab==='rekapParameter')c.innerHTML=renderQaApipRekapParameter();else if(qaApipTab==='rekapUnsur')c.innerHTML=renderQaApipRekapUnsur();else c.innerHTML=renderQaApipChecklist();
}
function qaApipSyncActiveItem(msg){
  if(!qaApipCurrentRow||String(qaApipCurrentRow.id)!==String(msg.opdId)||!qaApipMaster)return;
  const item=qaApipMasterIndex.get(qaApipLocationKey(msg.subunsur,msg.paramId,msg.grade,msg.itemNo));if(!item)return;
  // A local edit with a pending autosave takes precedence to avoid erasing typing.
  if(qaApipSaveTimers.has(item.id))return;
  if(msg.deleted)qaApipStateMap.delete(item.id);
  else if(msg.item)qaApipSetState(item.id,qaApipNormalizeState(msg.item));
  const st=qaApipGetState(item.id);const rowEl=document.querySelector(`#qaApipContent [data-qa-item="${CSS.escape(item.id)}"]`);
  if(rowEl){['availability','identityDoc','validity','periodOk','substance','note'].forEach(field=>{const control=rowEl.querySelector(`[data-qa-field="${field}"]`);if(control)control.value=st[field]||'';});qaApipUpdateItemRow(rowEl);}
  else qaApipUpdateModalSummary(qaApipCurrentRow);
  if(qaApipTab!=='form')renderQaApipModal();
}
async function openQaApipModal(id){
  const row=rows.find(r=>String(r.id)===String(id));if(!row)return;qaApipCurrentRow=row;qaApipEditingRowId=row.id;qaApipTab='form';qaApipFilters={search:'',subCode:'all',grade:'all',target:'all',page:0};
  const modal=document.getElementById('qaApipModal');if(!modal)return;document.getElementById('qaApipModalOpdName').textContent=`${row.opd||'Tanpa Nama'} · Tahun ${currentYear}`;modal.classList.add('active');qaApipSetStatus('Memuat template QA APIP dan tarikan evidence...');
  try{await Promise.all([ensureQaApipMasterLoaded(),ensureWorkbookEvidenceMasterLoaded()]);await loadQaApipData(row);qaApipSetStatus('✓ Template QA APIP dan sumber rekomendasi KK3.1–KK3.4 siap; evidence terkait sudah ditarik.','success');renderQaApipModal();}
  catch(err){qaApipSetStatus('Gagal memuat QA APIP: '+(err.message||err),'error');}
}
function closeQaApipModal(){
  // Flush the currently rendered dirty rows before releasing the OPD context.
  qaApipSaveTimers.forEach((timer,id)=>{clearTimeout(timer);const rowEl=qaApipPendingRows.get(String(id))||document.querySelector(`#qaApipContent [data-qa-item="${CSS.escape(String(id))}"]`);if(rowEl)saveQaApipChecklistFromDom(rowEl);});
  qaApipSaveTimers.clear();qaApipPendingRows.clear();document.getElementById('qaApipModal')?.classList.remove('active');qaApipEditingRowId=null;qaApipCurrentRow=null;qaApipStateMap=new Map();qaApipEvidenceFiles=[];qaApipEvidenceIndex=new Map();
}
document.addEventListener('click',e=>{
  const tab=e.target.closest('#qaApipTabs [data-qa-tab]');if(tab){qaApipTab=tab.dataset.qaTab;renderQaApipModal();return;}
  const exp=e.target.closest('#qaApipExport');if(exp){exportQaApipExcel();return;}
  const pageBtn=e.target.closest('.qa-apip-page-btn');if(pageBtn&&!pageBtn.disabled){qaApipFilters.page=Math.max(0,qaApipFilters.page+(pageBtn.dataset.qaPage==='next'?1:-1));renderQaApipModal();return;}
  const qbtn=e.target.closest('.btn-qa-apip');if(qbtn){openQaApipModal(qbtn.dataset.id);return;}
});
document.addEventListener('input',e=>{
  const target=e.target;
  if(target?.id==='qaApipSearch'){
    const value=target.value;const pos=target.selectionStart;qaApipFilters.search=value;qaApipFilters.page=0;renderQaApipModal();const next=document.getElementById('qaApipSearch');if(next){next.focus();try{next.setSelectionRange(pos,pos);}catch{}}return;
  }
  const f=target?.closest?.('#qaApipContent [data-qa-field]');if(f){const rowEl=f.closest('.qa-item-row');if(rowEl){qaApipUpdateItemRow(rowEl);scheduleQaApipSave(rowEl);}}
});
document.addEventListener('change',e=>{
  const target=e.target;
  if(target?.id==='qaApipSubFilter'||target?.id==='qaApipGradeFilter'||target?.id==='qaApipTargetFilter'){
    if(target.id==='qaApipSubFilter')qaApipFilters.subCode=target.value;else if(target.id==='qaApipGradeFilter')qaApipFilters.grade=target.value;else qaApipFilters.target=target.value;qaApipFilters.page=0;renderQaApipModal();return;
  }
  const f=target?.closest?.('#qaApipContent [data-qa-field]');if(f){const rowEl=f.closest('.qa-item-row');if(rowEl){qaApipUpdateItemRow(rowEl);scheduleQaApipSave(rowEl);}}
});
document.addEventListener('blur',e=>{const f=e.target?.closest?.('#qaApipContent [data-qa-field]');if(f)scheduleQaApipSave(f.closest('.qa-item-row'));},true);
document.getElementById('qaApipClose')?.addEventListener('click',closeQaApipModal);document.getElementById('qaApipCloseFooter')?.addEventListener('click',closeQaApipModal);
// ===== KERTAS KERJA PM SPIP — WORKBOOK SHAPE KK3.1–KK3.4 =====
// PM tidak menggunakan bentuk checklist QA APIP. Master dan alur mengikuti
// sheet KK3.1, KK3.2, KK3.3, KK3.4 pada workbook: satu parameter = satu
// blok 5 Grade (A–E), dengan input Hasil Pengujian + Grade Hasil + AoI/Penyebab.
// Evidence hanya ditarik read-only dari Evidence Struktur & Proses.
let kkPmMaster=null;
let kkRpjmdMaster=null;
let kkRpjmdMappings=new Map();
let kkFullWorkbookManifest=null;
let kkPmWorkbookData=null;
let kkPmWorkbookSheets=[];
let kkPmWorkbookNeedsSync=false;
let kkPmWorkbookSyncReason='';
let kkPmWorkbookOpenBusy=false;
let kkPmSelectedSheet='';
const KK_PM_TOTAL_PARAMETERS=183;
let kkPmCurrentRow=null;
let kkPmEditingRowId=null;
let kkPmTab='allSheets';
let kkPmStateMap=new Map();
let kkPmMetaMap=new Map();
let kkPmSaveTimers=new Map();
let kkPmMetaSaveTimers=new Map();
let kkPmFilters={search:'',unsur:'all',subunsur:'all'};
const KK_PM_TARGETS=['T1','T2','T3','T4'];
const KK_PM_GRADE_LEVEL={A:5,B:4,C:3,D:2,E:1};
const KK_PM_GRADE_STAGE={A:'A – Perbaikan Berkelanjutan',B:'B – Evaluasi & Tindak Lanjut',C:'C – Implementasi',D:'D – Komunikasi & Pemahaman',E:'E – Kebijakan/Formalitas'};

function kkPmSetStatus(msg,type=''){
  const el=document.getElementById('kkPmStatus'); if(!el)return;
  el.textContent=msg||''; el.className='kk-pm-status'+(type?' '+type:''); el.style.display=msg?'block':'none';
}
function kkPmStateKey(target,sub,paramId){return `${target}|${sub}|${paramId}`;}
function kkPmGetState(target,sub,paramId){return kkPmStateMap.get(kkPmStateKey(target,sub,paramId))||{};}
function kkPmSetState(target,sub,paramId,value){kkPmStateMap.set(kkPmStateKey(target,sub,paramId),{...value});}
function kkPmMetaKey(target){return String(target||'');}
function kkPmGetMeta(target){return kkPmMetaMap.get(kkPmMetaKey(target))||{};}
function kkPmGradeText(g){return g?`${g} · Level ${KK_PM_GRADE_LEVEL[g]}`:'—';}
function kkPmTarget(target){return (kkPmMaster?.targets||[]).find(t=>t.code===target);}
function kkPmParamCount(target){return Number(kkPmTarget(target)?.parameterCount||0);}
function kkPmParamList(target){return kkPmTarget(target)?.parameters||[];}
let kkPmEvidenceFiles=[];
function kkPmLinkedFilesForParam(row,p){
  const out=[]; const seen=new Set();
  const key=p?.evidenceKey || `${p?.target||''}|${p?.subCode||''}|${p?.paramId||''}`;
  const files=(kkPmEvidenceFiles||[]).filter(f=>String(f.evidenceKey||'')===String(key));
  files.forEach((file,i)=>{const url=file?.url||file?.gdriveUrl||'';const id=file?.uploadId||file?.gdriveId||url||`${p.paramId}-${file.grade||''}-${i}`;if(seen.has(id))return;seen.add(id);out.push({file,grade:String(file.grade||''),level:Number(file.level||0),url,name:file.fileName||'Evidence'});});
  return out;
}
function kkPmEvidenceHtml(row,p,selectedGrade=''){
  const files=kkPmLinkedFilesForParam(row,p);
  if(!files.length)return `<div class="kk-pm-evidence-empty">Belum ada file yang terhubung dari <b>Evidence Struktur &amp; Proses</b> untuk parameter ini.</div>`;
  return `<div class="kk-pm-evidence-list">${files.map(f=>{const name=escapeHtml(f.name);const href=f.url?escapeHtml(f.url):'';const active=selectedGrade===f.grade?' active':'';return `<div class="kk-pm-evidence-item${active}"><span class="kk-pm-evidence-grade">${escapeHtml(f.grade)}</span><span>${href?`<a href="${href}" target="_blank" rel="noopener">${name}</a>`:name}</span></div>`;}).join('')}</div>`;
}
function kkPmMasterKey(target,p){return `${target}|${p.subCode}|${p.paramId}`;}
let kkPmMasterRefreshPromise=null;
async function ensureKkPmMasterLoaded(forceRefresh=true){
  // Muat snapshot statis tanpa cache browser ketika master belum ada; refresh live harus terjadi
  // setiap modal PM dibuka agar perubahan master tidak tertahan pada objek kkPmMaster lama.
  if(!kkPmMaster){
    const r=await fetch('/kk-pm-exact-workbook-master.json?v=20261015.2',{cache:'no-store'});
    if(!r.ok)throw new Error(`Master KK PM SPIP tidak dapat dimuat (HTTP ${r.status})`);
    kkPmMaster=await r.json();
  }
  if(forceRefresh){
    // Satu refresh bersama untuk beberapa modal/call yang berimpit, bukan request live duplikat.
    if(!kkPmMasterRefreshPromise){
      const masterAtStart=kkPmMaster;
      kkPmMasterRefreshPromise=refreshMasterFromGoogleSheet(masterAtStart,'PM').finally(()=>{kkPmMasterRefreshPromise=null;});
    }
    await kkPmMasterRefreshPromise;
  }
  return kkPmMaster;
}
async function ensureKkRpjmdMasterLoaded(){
  if(kkRpjmdMaster)return kkRpjmdMaster;
  const r=await fetch('/rpjmd-mahakam-ulu-2025-2029-master.json',{cache:'no-cache'});
  if(!r.ok)throw new Error('Master sasaran RPJMD Mahakam Ulu tidak dapat dimuat.');
  kkRpjmdMaster=await r.json(); return kkRpjmdMaster;
}
async function loadKkRpjmdMappings(row){
  const d=await callServerWithRetry('getKkRpjmdMappings',{opdId:row.id,year:currentYear},2);
  kkRpjmdMappings=new Map((Array.isArray(d?.mappings)?d.mappings:[]).map(x=>[String(x.workpaperCode||''),x]));
  return d;
}
const KK_RPJMD_WORKPAPERS=[
 {code:'KKE 1.1 SASTRA',title:'KKE 1.1 · Sasaran Strategis Pemda',hint:'Koordinasi utama: BP4D/Bappelitbangda'},
 {code:'KKE 1.2 SASTRA OPD',title:'KKE 1.2 · Sasaran Strategis OPD',hint:'OPD mengaitkan Renstra/Renja dengan sasaran daerah'},
 {code:'KKE 2.1 SASPRO',title:'KKE 2.1 · Sasaran Program',hint:'Keterkaitan program dengan hasil/sasaran RPJMD'},
 {code:'KKE 2.2 SASKEG',title:'KKE 2.2 · Sasaran Kegiatan',hint:'Keterkaitan kegiatan dengan program dan sasaran'},
 {code:'KKE 2.3 SASSUBKEG',title:'KKE 2.3 · Sasaran Subkegiatan',hint:'Keterkaitan subkegiatan dengan output dan sasaran'},
 {code:'KK 5.1 A',title:'KK 5.1 A · Capaian RPJMD',hint:'Gunakan indikator resmi dan sumber data pemilik indikator'},
 {code:'KK 5.1 B',title:'KK 5.1 B · Capaian OPD',hint:'Gunakan indikator/target Renstra dan sumber data OPD'},
 {code:'KK 5.1 C',title:'KK 5.1 C · Capaian terkait',hint:'Pilih hanya sasaran yang benar-benar didukung isi kertas kerja'}
];
function kkRpjmdGoals(){return (kkRpjmdMaster?.objectives||[]).flatMap(o=>(o.goals||[]).map(g=>({...g,objectiveCode:o.code,objectiveName:o.name})));}
function kkRpjmdRenderMapping(){
 const goals=kkRpjmdGoals(); const canVerify=['admin','auditor','ppupd','irban'].includes(String(currentUser?.role||''));
 const options=goals.map(g=>`<option value="${escapeHtml(g.code)}">${escapeHtml(g.code+' · '+g.name)}</option>`).join('');
 const referenceHtml=`<details class="kk-pm-rpjmd-reference"><summary>Lihat daftar indikator dan target tahunan RPJMD</summary>${(kkRpjmdMaster?.objectives||[]).map(o=>`<section><h5>${escapeHtml(o.code+' · '+o.name)}</h5>${(o.objectiveIndicators||[]).map(i=>`<div class="kk-pm-rpjmd-indicator"><b>Indikator tujuan: ${escapeHtml(i.name)}</b><span>${Object.entries(i.targets||{}).map(([y,v])=>escapeHtml(y+': '+v)).join(' · ')}</span></div>`).join('')}${(o.goals||[]).map(g=>`<div class="kk-pm-rpjmd-indicator"><b>${escapeHtml(g.code+' · '+g.name)}</b>${(g.indicators||[]).map(i=>`<span>${escapeHtml(i.name)} — ${Object.entries(i.targets||{}).map(([y,v])=>escapeHtml(y+': '+v)).join(' · ')}</span>`).join('')}</div>`).join('')}</section>`).join('')}</details>`;
 return `<div class="kk-pm-rpjmd-intro"><div class="kk-pm-kicker">MASTER DOKUMEN PERENCANAAN</div><h4>${escapeHtml(kkRpjmdMaster?.vision||'RPJMD 2025–2029')}</h4><p>Sumber: Perda Kabupaten Mahakam Ulu Nomor 1 Tahun 2026, Bab III §3.1.2, Tabel 3.6 (halaman tercetak 195–198). Pemetaan ini menghubungkan kertas kerja penetapan tujuan dengan sasaran daerah. Pemetaan <b>tidak otomatis menentukan grade, skor SPIP, MRI, IEPK, atau nilai resmi</b>; penilaian tetap mengikuti parameter dan formula workbook BPKP.</p><div class="kk-pm-rpjmd-stats"><span><b>${(kkRpjmdMaster?.objectives||[]).length}</b> tujuan RPJMD</span><span><b>${goals.length}</b> sasaran strategis</span><span><b>2025–2029</b> periode RPJMD</span></div></div>${referenceHtml}
 ${KK_RPJMD_WORKPAPERS.map(w=>{const m=kkRpjmdMappings.get(w.code)||{};const selected=new Set(Array.isArray(m.goalCodes)?m.goalCodes:[]);return `<section class="kk-pm-rpjmd-card" data-rpjmd-card="${escapeHtml(w.code)}"><div class="kk-pm-rpjmd-card-head"><div><h5>${escapeHtml(w.title)}</h5><p>${escapeHtml(w.hint)}</p></div><span class="kk-pm-rpjmd-status ${m.status==='Terverifikasi'?'is-verified':m.status==='Perlu Perbaikan'?'is-returned':'is-pending'}">${escapeHtml(m.status||'Belum Diajukan')}</span></div><label for="rpjmd-goals-${escapeHtml(w.code.replace(/[^A-Za-z0-9]/g,''))}">Sasaran/tujuan RPJMD terkait (pilih satu atau lebih)</label><select multiple size="5" id="rpjmd-goals-${escapeHtml(w.code.replace(/[^A-Za-z0-9]/g,''))}" data-rpjmd-goals="${escapeHtml(w.code)}">${options.replace(/<option value="([^"]+)">/g,(all,code)=>`<option value="${code}"${selected.has(code)?' selected':''}>`)}</select><small>Pilih dengan Ctrl (Windows) untuk beberapa sasaran. Jangan pilih sasaran hanya karena nama mirip; pastikan ada hubungan logis dengan sasaran, program, kegiatan atau indikator.</small><label for="rpjmd-rationale-${escapeHtml(w.code.replace(/[^A-Za-z0-9]/g,''))}">Uraian hubungan/keterkaitan</label><textarea id="rpjmd-rationale-${escapeHtml(w.code.replace(/[^A-Za-z0-9]/g,''))}" data-rpjmd-rationale="${escapeHtml(w.code)}" rows="3" maxlength="3000" placeholder="Jelaskan hubungan sasaran dengan Renstra/Renja, program/kegiatan, indikator, risiko, dan bukti pendukung.">${escapeHtml(m.rationale||'')}</textarea><div class="kk-pm-rpjmd-card-foot"><small>${m.updatedAt?'Diperbarui '+escapeHtml(new Date(m.updatedAt).toLocaleString('id-ID')):'Belum ada data tersimpan'}${m.verifierName?' · Verifikator: '+escapeHtml(m.verifierName):''}</small><button type="button" class="kk-pm-action" data-rpjmd-save="${escapeHtml(w.code)}">Simpan & Ajukan Verifikasi</button></div>${m.verifierNote?`<div class="kk-pm-rpjmd-note"><b>Catatan verifikasi:</b> ${escapeHtml(m.verifierNote)}</div>`:''}${canVerify&&m.status==='Menunggu Verifikasi'?`<div class="kk-pm-rpjmd-verify"><input data-rpjmd-verifier="${escapeHtml(w.code)}" value="${escapeHtml(currentUser?.displayName||currentUser?.username||'')}" placeholder="Nama verifikator"/><input data-rpjmd-verifier-note="${escapeHtml(w.code)}" placeholder="Catatan (wajib bila perlu perbaikan)" value=""/><button type="button" data-rpjmd-verify="${escapeHtml(w.code)}" data-rpjmd-decision="Terverifikasi">✓ Verifikasi</button><button type="button" data-rpjmd-verify="${escapeHtml(w.code)}" data-rpjmd-decision="Perlu Perbaikan">↩ Kembalikan</button></div>`:''}</section>`;}).join('')}
 <div class="kk-pm-rpjmd-note"><b>Alur peran:</b> OPD mengisi dan mengajukan; BP4D/Bappelitbangda mengoordinasikan konsistensi sasaran dan perencanaan; BPKAD menjadi pemilik data/validasi untuk ranah keuangan dan aset sesuai kewenangan; Inspektorat melakukan penelaahan/penjaminan kualitas. Akses verifikasi pada aplikasi saat ini dibatasi ke Admin dan Irban. Setiap pengajuan/keputusan dicatat pada audit trail.</div>`;
}
async function kkRpjmdSaveMapping(workpaperCode){
 if(!kkPmCurrentRow)return; const select=document.querySelector(`[data-rpjmd-goals="${CSS.escape(workpaperCode)}"]`),rationale=document.querySelector(`[data-rpjmd-rationale="${CSS.escape(workpaperCode)}"]`);
 const goalCodes=Array.from(select?.selectedOptions||[]).map(o=>o.value); const text=String(rationale?.value||'').trim();
 if(!goalCodes.length){kkPmSetStatus('Pilih minimal satu sasaran RPJMD yang terkait.','error');return;}if(text.length<10){kkPmSetStatus('Uraian hubungan/keterkaitan wajib diisi minimal 10 karakter.','error');return;}
 const btn=document.querySelector(`[data-rpjmd-save="${CSS.escape(workpaperCode)}"]`);if(btn){btn.disabled=true;btn.textContent='Menyimpan…';}
 try{await callServerWithRetry('saveKkRpjmdMapping',{opdId:kkPmCurrentRow.id,year:currentYear,workpaperCode,goalCodes,rationale:text},2);await loadKkRpjmdMappings(kkPmCurrentRow);kkPmSetStatus('Pemetaan RPJMD tersimpan dan diajukan untuk verifikasi.','success');kkPmRenderModal();}catch(err){kkPmSetStatus('Gagal menyimpan pemetaan: '+(err.message||err),'error');}finally{if(btn){btn.disabled=false;btn.textContent='Simpan & Ajukan Verifikasi';}}
}
async function kkRpjmdVerifyMapping(workpaperCode,decision){
 if(!kkPmCurrentRow||!['admin','irban'].includes(String(currentUser?.role||''))){kkPmSetStatus('Hanya Admin/Irban yang dapat memverifikasi pemetaan.','error');return;}
 const verifier=document.querySelector(`[data-rpjmd-verifier="${CSS.escape(workpaperCode)}"]`)?.value||'';const note=document.querySelector(`[data-rpjmd-verifier-note="${CSS.escape(workpaperCode)}"]`)?.value||'';
 try{await callServerWithRetry('verifyKkRpjmdMapping',{opdId:kkPmCurrentRow.id,year:currentYear,workpaperCode,decision,verifierName:verifier,note},2);await loadKkRpjmdMappings(kkPmCurrentRow);kkPmSetStatus('Keputusan verifikasi tersimpan.','success');kkPmRenderModal();}catch(err){kkPmSetStatus('Verifikasi gagal: '+(err.message||err),'error');}
}
function kkPmCanonicalSheetKey(value){
  const key=String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const aliases={
    KKLEADSPIPPEMDA:'KKLEADSPIP',KKLEADSPIPPEMERINTAHDAERAH:'KKLEADSPIP',KKLEADIP:'KKLEADI',KKLEADIPEMDA:'KKLEADI',KKLEADIPPEMDA:'KKLEADI',KKLEADIPOPD:'KKLEADI',
    KKE11SASTRAPEMDA:'KKE11SASTRA',KKE11SASTRAPEMDABP4D:'KKE11SASTRA',KKE11SASTRABP4D:'KKE11SASTRA',KKE11SASTRAOPD:'KKE11SASTRA',
    KKE21SASPROGRAMP:'KKE21SASPRO',KKE21SASPROGRAM:'KKE21SASPRO',KKE21SASPROOPD:'KKE21SASPRO',KKE22SASKEGOPD:'KKE22SASKEG',KKE22SASKEGIATAN:'KKE22SASKEG',
    KKE23SASSUBKES:'KKE23SASSUBKEG',KKE23SASSUBKEGIATAN:'KKE23SASSUBKEG',KKE23SASARANSUBKEGIATAN:'KKE23SASSUBKEG',KKE23SASSUBKEGOPD:'KKE23SASSUBKEG',
    KK31OPD:'KK31',KK32BPKAD:'KK32',KK32BPKADAKUN:'KK32',KK33BPKAD:'KK33',KK33BPKADASET:'KK33',KK34INSPEKTORAT:'KK34',
    KK51ALAKIPRPJMD:'KK51A',KK51ARPJMD:'KK51A',KK51ARPJMDBP4D:'KK51A',KK51ALAKIPRPJMDBP4D:'KK51A',KK51BOPD:'KK51B',KK51COPD:'KK51C',KK52OPD:'KK52',
    KK6INSP:'KK6',KK6INSPEKTORAT:'KK6',KK6APIP:'KK6',KK7INSP:'KK7',KK7INSPEKTORAT:'KK7',KK7APIP:'KK7',KK8INSP:'KK8',KK8INSPEKTORAT:'KK8',KK8APIP:'KK8',
    REFPEMANTAUANCAPAIANTUJUAN:'REFPCT',REFPENCAPAIANTUJUAN:'REFPCT'
  };
  return aliases[key]||key;
}
function kkPmHasDecoratedCoreAlias(sheetMeta){
  const rawKeys=(Array.isArray(sheetMeta)?sheetMeta:[]).map(x=>String(x?.title||x?.properties?.title||x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,''));
  return rawKeys.some(k=>['KK51ARPJMDBP4D','KK51ALAKIPRPJMD','KK6INSPEKTORAT','KK7INSPEKTORAT','KK8INSPEKTORAT'].includes(k));
}
async function ensureKkFullWorkbookManifestLoaded(sheetMeta=kkPmWorkbookSheets){
  const sheetCount=Array.isArray(sheetMeta)?sheetMeta.length:0;
  // The customized current PM master can contain 28 physical tabs: the 26 required
  // PM sheets plus administrative tabs, with some core tabs decorated by BP4D/Inspektorat.
  // Do not misclassify that current template as the old PK manifest based on count alone.
  const legacy=sheetCount===28&&!kkPmHasDecoratedCoreAlias(sheetMeta);
  const file=legacy?'/kk-full-workbook-manifest.json?v=20261008.6':'/kk-pm-full-workbook-manifest.json?v=20261015.2';
  const expectedKey=legacy?'legacy28':'pm26';
  if(kkFullWorkbookManifest?.__profile===expectedKey)return kkFullWorkbookManifest;
  const r=await fetch(file,{cache:'force-cache'});
  if(!r.ok)throw new Error('Manifest seluruh workbook KK tidak dapat dimuat');
  const manifest=await r.json();
  if(legacy){if(Number(manifest.allSheetCount)!==28||Number(manifest.workpaperSheetCount)!==21)throw new Error('Manifest workbook legacy tidak valid.');}
  else if(Number(manifest.allSheetCount)!==26||Number(manifest.workpaperSheetCount)!==20)throw new Error('Manifest KK PM terbaru tidak valid: seharusnya 26 sheet total dan 20 sheet kertas kerja.');
  kkFullWorkbookManifest={...manifest,__profile:expectedKey};
  return kkFullWorkbookManifest;
}
async function loadKkPmWorkbookData(row){
  const d=await callServerWithRetry('getKkPmSheets',{opdId:row.id,year:currentYear},2);
  kkPmWorkbookData=d?.kkPmData||{};
  kkPmWorkbookSheets=Array.isArray(d?.sheets)?d.sheets:[];
  kkPmWorkbookNeedsSync=Boolean(d?.needsSync);
  kkPmWorkbookSyncReason=String(d?.needsSyncReason||'');
  // Replace the stale in-memory row pointer with the authoritative D1 link. Other
  // account sessions will similarly re-read D1 before opening a workbook.
  row.kkPmData={...(row.kkPmData||{}),workbook:kkPmWorkbookData};
  if(d?.needsSync)kkPmSetStatus('⚠️ '+(d.needsSyncReason||'Workbook perlu disinkronkan dengan master PM terbaru.')+' Klik Buka Spreadsheet PM untuk memperbarui tautan otomatis; jika master tidak tersedia, aplikasi akan menampilkan penyebabnya dan tidak membuka file lama.','error');
  await ensureKkFullWorkbookManifestLoaded(kkPmWorkbookSheets);
  return d;
}
async function loadKkPmData(row){
  const [d,ev]=await Promise.all([callServerWithRetry('getKkPmDataDetailed',{opdId:row.id,year:currentYear},2),callServerWithRetry('getWorkbookEvidenceFiles',{opdId:row.id,year:currentYear},2)]);
  kkPmEvidenceFiles=Array.isArray(ev?.files)?ev.files:[];
  kkPmStateMap=new Map(); kkPmMetaMap=new Map();
  (Array.isArray(d?.items)?d.items:[]).forEach(item=>kkPmSetState(item.target,item.subunsur,item.paramId,{hasilPengujian:item.hasilPengujian||'',gradeResult:item.gradeResult||'',aoiCluster:item.aoiCluster||'',aoiDesc:item.aoiDesc||'',causeCluster:item.causeCluster||'',causeDesc:item.causeDesc||'',conclusion:item.conclusion||'',note:item.note||'',updatedBy:item.updatedBy||'',updatedAt:Number(item.updatedAt||0)}));
  (Array.isArray(d?.meta)?d.meta:[]).forEach(item=>kkPmMetaMap.set(kkPmMetaKey(item.target),{sectorFocus:item.sectorFocus||'',preparedBy:item.preparedBy||'',preparedDate:item.preparedDate||'',reviewedBy:item.reviewedBy||'',reviewedDate:item.reviewedDate||'',approvedBy:item.approvedBy||'',approvedDate:item.approvedDate||'',updatedAt:Number(item.updatedAt||0)}));
  return d;
}
function kkPmTargetsForRow(row=kkPmCurrentRow){return assessmentAllowedTargets(row||'');}
function kkPmTargetSummary(target){
  const ps=kkPmParamList(target); let evaluated=0,sum=0; const dist={A:0,B:0,C:0,D:0,E:0}; let evidence=0;
  ps.forEach(p=>{const st=kkPmGetState(target,p.subCode,p.paramId); const g=String(st.gradeResult||'').toUpperCase(); if(KK_PM_GRADE_LEVEL[g]){evaluated++; sum+=KK_PM_GRADE_LEVEL[g]; dist[g]++;} evidence+=kkPmLinkedFilesForParam(kkPmCurrentRow,p).length;});
  const total=ps.length; const completion=total?Math.round(evaluated/total*10000)/100:0; const avg= evaluated?Math.round(sum/evaluated*100)/100:0;
  return {target,total,evaluated,pending:Math.max(0,total-evaluated),completion,avgLevel:avg,avgPercent:Math.round(avg/5*10000)/100,dist,evidence};
}
function kkPmOverallSummary(){
  const arr=kkPmTargetsForRow().map(kkPmTargetSummary); const total=arr.reduce((a,x)=>a+x.total,0); const evaluated=arr.reduce((a,x)=>a+x.evaluated,0); const pending=total-evaluated; const sum=arr.reduce((a,x)=>a+x.avgLevel*x.evaluated,0); const avg=evaluated?sum/evaluated:0;
  return {targets:arr,total,evaluated,pending,completion:total?Math.round(evaluated/total*10000)/100:0,avgLevel:Math.round(avg*100)/100,avgPercent:Math.round(avg/5*10000)/100,evidence:arr.reduce((a,x)=>a+x.evidence,0)};
}
function kkPmSummaryCard(label,value,note,cls=''){return `<div class="kk-pm-summary-card ${cls}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;}
function kkPmUpdateSummary(){
  if(!kkPmCurrentRow)return; const s=kkPmOverallSummary(); const structure=Number(getRowStructureProcessBreakdown(kkPmCurrentRow).value||0); const maturity=computedValueOf(kkPmCurrentRow,'nilaiMaturitas'),mri=computedValueOf(kkPmCurrentRow,'mri'),iepk=computedValueOf(kkPmCurrentRow,'iepk'),kap=computedValueOf(kkPmCurrentRow,'nilaiKapabilitasApip');
  const fmt=v=>v==null?'—':v.toFixed(2);
  const el=document.getElementById('kkPmSummary'); if(!el)return;
  el.innerHTML=kkPmSummaryCard('Progress KK PM',`${s.completion.toFixed(2)}%`,`${s.evaluated}/${s.total} parameter telah diberi grade`,'kk-pm-summary-result')+
    kkPmSummaryCard('Rata-rata Level PM',s.avgLevel?s.avgLevel.toFixed(2):'—','A=5 · B=4 · C=3 · D=2 · E=1')+
    kkPmSummaryCard('Evidence Tarikan',String(s.evidence),'file dari Struktur & Proses')+
    kkPmSummaryCard('Nilai Struktur & Proses',structure.toFixed(2),'derived dari Evidence Struktur & Proses')+
    kkPmSummaryCard('Maturitas SPIP',fmt(maturity),'formula workbook · read-only')+
    kkPmSummaryCard('MRI · IEPK · Kap. APIP',`${fmt(mri)} · ${fmt(iepk)} · ${fmt(kap)}`,'formula workbook · read-only');
  const rowEl=document.querySelector(`.kk-pm-table-summary[data-id="${CSS.escape(String(kkPmCurrentRow.id||''))}"]`); if(rowEl)rowEl.innerHTML=`${s.completion.toFixed(2)}%<small>${s.evaluated}/${s.total} parameter</small>`;
  kkPmCurrentRow.kkPmSummary={total:s.total,evaluated:s.evaluated,na:0,pending:s.pending,sum:s.avgLevel,percentage:s.completion,completion:s.completion,status:s.completion>=100?'Selesai':(s.evaluated?'Proses':'Belum')};
}
function kkPmMetaForm(target){
  const m=kkPmGetMeta(target);
  return `<div class="kk-pm-meta-card"><div class="kk-pm-meta-title"><b>Identitas lembar kerja</b><span>mengikuti bagian atas sheet KK3.x</span></div><div class="kk-pm-meta-grid">
    <label>Sektor/Fokus<input data-pm-meta="sectorFocus" data-pm-meta-target="${target}" value="${escapeHtml(m.sectorFocus||'')}"></label>
    <label>Disusun oleh<input data-pm-meta="preparedBy" data-pm-meta-target="${target}" value="${escapeHtml(m.preparedBy||'')}"></label>
    <label>Tanggal<input type="date" data-pm-meta="preparedDate" data-pm-meta-target="${target}" value="${escapeHtml(m.preparedDate||'')}"></label>
    <label>Direviu oleh<input data-pm-meta="reviewedBy" data-pm-meta-target="${target}" value="${escapeHtml(m.reviewedBy||'')}"></label>
    <label>Tanggal<input type="date" data-pm-meta="reviewedDate" data-pm-meta-target="${target}" value="${escapeHtml(m.reviewedDate||'')}"></label>
    <label>Disetujui oleh<input data-pm-meta="approvedBy" data-pm-meta-target="${target}" value="${escapeHtml(m.approvedBy||'')}"></label>
    <label>Tanggal<input type="date" data-pm-meta="approvedDate" data-pm-meta-target="${target}" value="${escapeHtml(m.approvedDate||'')}"></label>
  </div></div>`;
}
function kkPmRenderSummary(){
  const s=kkPmOverallSummary();
  return `<div class="kk-pm-sheet-head"><div><div class="kk-pm-kicker">WORKBOOK-BASED PM</div><h4>Ringkasan Kertas Kerja PM SPIP</h4><p>Struktur mengikuti <b>KK3.1–KK3.4</b> pada workbook. QA APIP hanya menjadi pola interaksi; isi/kriteria PM berasal dari workbook.</p></div></div>
  <div class="kk-pm-target-grid">${s.targets.map(x=>`<button type="button" class="kk-pm-target-card" data-pm-tab-target="${x.target}"><span>${x.target} · ${kkPmTarget(x.target)?.sheet||''}</span><b>${x.evaluated}/${x.total}</b><small>${x.completion.toFixed(2)}% selesai · Avg level ${x.avgLevel?x.avgLevel.toFixed(2):'—'}</small><div class="kk-pm-progress"><i style="width:${x.completion}%"></i></div></button>`).join('')}</div>
  ${kkPmTargetsForRow().map(t=>kkPmMetaForm(t)).join('')}
  <div class="kk-pm-reconcile"><div class="kk-pm-reconcile-head"><b>Rekonsiliasi nilai OPD</b><span>referensi existing — KK PM tidak menimpa nilai ini</span></div><div class="kk-pm-reconcile-grid">
    ${kkPmSummaryCard('Nilai Struktur & Proses',Number(getRowStructureProcessBreakdown(kkPmCurrentRow).value||0).toFixed(2),'berdasarkan level evidence yang diterima dari 43 parameter')}
    ${kkPmSummaryCard('Nilai Maturitas SPIP',computedDisplay(kkPmCurrentRow,'nilaiMaturitas'),'formula workbook · read-only')}
    ${kkPmSummaryCard('MRI',computedDisplay(kkPmCurrentRow,'mri'),'formula workbook · read-only')}
    ${kkPmSummaryCard('IEPK',computedDisplay(kkPmCurrentRow,'iepk'),'formula workbook · read-only')}
    ${kkPmSummaryCard('Kapabilitas APIP',computedDisplay(kkPmCurrentRow,'nilaiKapabilitasApip'),'formula workbook · read-only')}
  </div></div>
  <div class="kk-pm-instruction"><b>Alur utama:</b> pilih KK3.x → Subunsur → parameter → baca 5 Grade A–E → isi Hasil Pengujian + Grade Hasil + AoI/Penyebab → evidence Struktur & Proses muncul otomatis → kesimpulan dan rekap diperbarui otomatis.</div>`;
}
function kkPmRenderGradeRows(p,st){
  return `<div class="kk-pm-grade-table-wrap"><table class="kk-pm-grade-table"><thead><tr><th>Grade</th><th>Kriteria</th><th>Penjelasan</th><th>Cara Pengujian</th><th>Evidence yang Disarankan</th></tr></thead><tbody>${Object.values(p.grades||{}).map(g=>`<tr class="${st.gradeResult===g.grade?'is-selected':''}"><td><span class="kk-pm-grade-pill grade-${g.grade}">${g.grade}</span><b>Level ${g.level}</b><small>${escapeHtml(g.stage||KK_PM_GRADE_STAGE[g.grade]||'')}</small></td><td>${escapeHtml(g.kriteria||'')}</td><td>${escapeHtml(g.penjelasan||'')}</td><td><span class="kk-pm-test-badge">${escapeHtml(g.caraPengujian||'W/D/O')}</span></td><td><ul>${(Array.isArray(g.evidenceDisarankan)?g.evidenceDisarankan:[]).map(e=>`<li>${escapeHtml(e)}</li>`).join('')}</ul></td></tr>`).join('')}</tbody></table></div>`;
}
function kkPmRenderParameter(target,p){
  const st=kkPmGetState(target,p.subCode,p.paramId); const files=kkPmLinkedFilesForParam(kkPmCurrentRow,p); const structureKey=`${p.subCode}|${p.paramId}`; const structureLevel=Number(kkPmCurrentRow.parameterLevels?.[structureKey]||0);
  return `<details class="kk-pm-param-card"><summary><span class="kk-pm-param-no">${escapeHtml(p.subCode)} · ${escapeHtml(String(p.no))}</span><span class="kk-pm-param-desc">${escapeHtml(p.uraianParameter)}</span><span class="kk-pm-param-meta">${st.gradeResult?`Grade ${escapeHtml(st.gradeResult)} · Level ${KK_PM_GRADE_LEVEL[st.gradeResult]}`:'Belum dinilai'} · Evidence ${files.length}${structureLevel?` · S&P ${structureLevel}`:''}</span></summary>
    <div class="kk-pm-param-body">
      <div class="kk-pm-workbook-line"><span><b>Kode</b> ${escapeHtml(p.subCode)}</span><span><b>Subunsur</b> ${escapeHtml(p.subunsur)}</span><span><b>No</b> ${escapeHtml(String(p.no))}</span><span><b>Kode Parameter</b> ${escapeHtml(p.kodeParameter||'')}</span><span><b>MRI</b> ${escapeHtml(p.mri||'-')}</span><span><b>IEPK</b> ${escapeHtml(p.iepk||'-')}</span><span><b>Level S&P existing</b> ${structureLevel||'—'}</span></div>
      <div class="kk-pm-param-title"><b>Uraian Parameter</b><p>${escapeHtml(p.uraianParameter)}</p></div>
      ${kkPmRenderGradeRows(p,st)}
      <div class="kk-pm-input-grid">
        <label class="kk-pm-span-2"><b>Hasil Pengujian</b><textarea rows="4" data-pm-field="hasilPengujian" data-pm-target="${target}" data-pm-sub="${escapeHtml(p.subCode)}" data-pm-param="${escapeHtml(p.paramId)}">${escapeHtml(st.hasilPengujian||'')}</textarea></label>
        <label><b>Grade Hasil</b><select data-pm-field="gradeResult" data-pm-target="${target}" data-pm-sub="${escapeHtml(p.subCode)}" data-pm-param="${escapeHtml(p.paramId)}"><option value="">— Pilih —</option>${['A','B','C','D','E'].map(g=>`<option value="${g}" ${st.gradeResult===g?'selected':''}>${g} · Level ${KK_PM_GRADE_LEVEL[g]}</option>`).join('')}</select></label>
        <label><b>Kluster AoI</b><input data-pm-field="aoiCluster" data-pm-target="${target}" data-pm-sub="${escapeHtml(p.subCode)}" data-pm-param="${escapeHtml(p.paramId)}" value="${escapeHtml(st.aoiCluster||'')}"></label>
        <label class="kk-pm-span-2"><b>Uraian AoI</b><textarea rows="2" data-pm-field="aoiDesc" data-pm-target="${target}" data-pm-sub="${escapeHtml(p.subCode)}" data-pm-param="${escapeHtml(p.paramId)}">${escapeHtml(st.aoiDesc||'')}</textarea></label>
        <label><b>Kluster Penyebab</b><input data-pm-field="causeCluster" data-pm-target="${target}" data-pm-sub="${escapeHtml(p.subCode)}" data-pm-param="${escapeHtml(p.paramId)}" value="${escapeHtml(st.causeCluster||'')}"></label>
        <label class="kk-pm-span-2"><b>Uraian Penyebab</b><textarea rows="2" data-pm-field="causeDesc" data-pm-target="${target}" data-pm-sub="${escapeHtml(p.subCode)}" data-pm-param="${escapeHtml(p.paramId)}">${escapeHtml(st.causeDesc||'')}</textarea></label>
        <label class="kk-pm-span-2"><b>Catatan</b><textarea rows="2" data-pm-field="note" data-pm-target="${target}" data-pm-sub="${escapeHtml(p.subCode)}" data-pm-param="${escapeHtml(p.paramId)}">${escapeHtml(st.note||'')}</textarea></label>
      </div>
      <div class="kk-pm-linked-panel"><div class="kk-pm-linked-head"><b>Evidence Struktur &amp; Proses — Tarikan Otomatis</b><span>${files.length} file</span></div>${kkPmEvidenceHtml(kkPmCurrentRow,p,st.gradeResult||'')}<div class="kk-pm-linked-note">File ini <b>read-only</b>. Upload/replacement tetap dilakukan di kolom Evidence Struktur dan Proses agar satu sumber file digunakan oleh semua workpaper.</div></div>
      <div class="kk-pm-auto-conclusion"><span>Kesimpulan Akhir</span><strong>${escapeHtml(st.gradeResult?`Grade ${st.gradeResult} · Level ${KK_PM_GRADE_LEVEL[st.gradeResult]} · ${KK_PM_GRADE_STAGE[st.gradeResult]}`:'Belum ditetapkan')}</strong></div>
    </div></details>`;
}
function kkPmSubSummary(target,subCode){
  const ps=kkPmParamList(target).filter(p=>p.subCode===subCode);let evaluated=0,sum=0;
  ps.forEach(p=>{const g=String(kkPmGetState(target,p.subCode,p.paramId).gradeResult||'').toUpperCase();if(KK_PM_GRADE_LEVEL[g]){evaluated++;sum+=KK_PM_GRADE_LEVEL[g];}});
  return {total:ps.length,evaluated,pending:Math.max(0,ps.length-evaluated),avg:evaluated?Math.round(sum/evaluated*100)/100:0,completion:ps.length?Math.round(evaluated/ps.length*10000)/100:0};
}
function kkPmUnsurCode(subCode){return String(subCode||'').split('.')[0];}
function kkPmRenderTarget(target){
  if(!kkPmTargetsForRow().includes(String(target).toUpperCase()))return `<div class="kk-pm-empty">${escapeHtml(assessmentTargetLabel(target))} tidak berlaku untuk ${escapeHtml(kkPmCurrentRow?.opd||'OPD')}.</div>`;
  const t=kkPmTarget(target); if(!t)return '<div class="kk-pm-empty">Master target tidak ditemukan.</div>';
  const params=(t.parameters||[]).filter(p=>{
    if(kkPmFilters.unsur!=='all'&&kkPmUnsurCode(p.subCode)!==kkPmFilters.unsur)return false;
    if(kkPmFilters.subunsur!=='all'&&p.subCode!==kkPmFilters.subunsur)return false;
    if(kkPmFilters.search){const q=kkPmFilters.search.toLowerCase();const hay=`${p.subCode} ${p.subunsur} ${p.paramId} ${p.uraianParameter}`.toLowerCase();if(!hay.includes(q))return false;}
    return true;
  });
  const subs=[...new Map((t.parameters||[]).map(p=>[p.subCode,p.subunsur])).entries()];
  const summary=kkPmTargetSummary(target);
  return `<div class="kk-pm-sheet-head"><div><div class="kk-pm-kicker">${escapeHtml(t.sheet||target)}</div><h4>${escapeHtml(t.title||'Penilaian Struktur dan Proses')}</h4><p>${summary.evaluated}/${summary.total} parameter selesai · Rata-rata level ${summary.avgLevel?summary.avgLevel.toFixed(2):'—'} · ${summary.evidence} evidence terhubung</p></div></div>
  ${kkPmMetaForm(target)}
  <div class="kk-pm-filter-bar"><input id="kkPmSearch" value="${escapeHtml(kkPmFilters.search)}" placeholder="Cari kode / subunsur / parameter..."/><select id="kkPmFilterUnsur"><option value="all">Semua Unsur</option>${['1','2','3','4','5'].map(u=>`<option value="${u}" ${kkPmFilters.unsur===u?'selected':''}>Unsur ${u} · ${escapeHtml(SPIP_UNSUR_INFO[u]?.title||'')}</option>`).join('')}</select><select id="kkPmFilterSub"><option value="all">Semua Subunsur</option>${subs.map(([code,name])=>`<option value="${escapeHtml(code)}" ${kkPmFilters.subunsur===code?'selected':''}>${escapeHtml(code)} · ${escapeHtml(name)}</option>`).join('')}</select><span>${params.length} parameter tampil</span></div>
  <div class="kk-pm-subsections">${[...new Set(params.map(p=>p.subCode))].map(sc=>{const name=params.find(p=>p.subCode===sc)?.subunsur||sc;const ps=params.filter(p=>p.subCode===sc);const ss=kkPmSubSummary(target,sc);return `<details class="kk-pm-subsection" open><summary><span class="kk-pm-sub-code">${escapeHtml(sc)}</span><b>${escapeHtml(name)}</b><small>${ss.evaluated}/${ss.total} dinilai · ${ss.completion.toFixed(0)}% · Avg ${ss.avg?ss.avg.toFixed(2):'—'}</small></summary>${ps.map(p=>kkPmRenderParameter(target,p)).join('')}</details>`;}).join('')}</div>`;
}

function kkPmWorkbookSheetByName(name){
  return (kkFullWorkbookManifest?.sheets||[]).find(x=>String(x.sheetName)===String(name));
}
function kkPmWorkbookGid(name){
  const key=kkPmCanonicalSheetKey(name);
  return (kkPmWorkbookSheets||[]).find(x=>kkPmCanonicalSheetKey(x.title||x.properties?.title)===key)?.sheetId;
}
function kkPmWorkbookUrl(name=''){
  const base=kkPmWorkbookData?.workbookUrl||''; if(!base)return '';
  const gid=kkPmWorkbookGid(name); return gid ? `${base}#gid=${encodeURIComponent(gid)}` : base;
}
function kkPmRenderAllSheets(){
  const allSheets=kkFullWorkbookManifest?.sheets||[];
  const sheets=allSheets.filter(x=>assessmentSheetVisibleForOpd(x.sheetName,kkPmCurrentRow));
  if(!sheets.some(x=>x.sheetName===kkPmSelectedSheet))kkPmSelectedSheet=sheets[0]?.sheetName||'';
  const wb=kkPmWorkbookData||{};
  const scopeNote=assessmentScopeDescription(kkPmCurrentRow);
  const bp4dUrl=bp4dMasterWorkbookUrl();
  const isBp4d=assessmentOrgProfile(kkPmCurrentRow)==='BP4D';
  const strategicLink=!isBp4d?`<div class="kk-pm-workbook-alert"><b>KKE 1.1 Sasaran Strategis Pemda:</b> dikelola satu pintu oleh BP4D/Bappelitbangda agar seluruh OPD mengacu pada master yang sama. ${bp4dUrl?`<a href="${escapeHtml(bp4dUrl)}" target="_blank" rel="noopener">↗️ Buka workbook master BP4D</a>`:'Workbook master BP4D belum tertaut; tambahkan/siapkan spreadsheet PM pada OPD BP4D terlebih dahulu.'}</div>`:'';
  const openUrl=kkPmWorkbookUrl(kkPmSelectedSheet||'');
  const current=kkPmWorkbookSheetByName(kkPmSelectedSheet||'');
  const sample=current?.sampleRows||[];
  const preview=current
    ? `<div class="kk-pm-workbook-preview"><div class="kk-pm-workbook-preview-head"><div><div class="kk-pm-kicker">SHEET ${current.order} / ${sheets.length}</div><h4>${escapeHtml(current.sheetName)}</h4><p>${escapeHtml(current.description||'')}</p></div><div class="kk-pm-preview-actions">${openUrl?`<button type="button" class="kk-pm-action-link" data-pm-open-workbook="${escapeHtml(current.sheetName)}">↗️ Buka Sheet Ini</button>`:''}</div></div><div class="kk-pm-preview-meta"><span>Jenis <b>${escapeHtml(current.type==='workpaper'?'Kertas Kerja':'Pendukung/Referensi')}</b></span><span>Dimensi <b>${escapeHtml(current.dimension||'')}</b></span><span>Formula <b>${Number(current.formulaCount||0).toLocaleString('id-ID')}</b></span><span>Mode <b>Lazy-load</b></span></div><div class="kk-pm-sample-rows">${sample.map(r=>`<div class="kk-pm-sample-row"><b>Baris ${r.row}</b><div>${(r.cells||[]).map(c=>`<span><em>${escapeHtml(c[0])}</em> ${escapeHtml(String(c[1]).slice(0,220))}</span>`).join('')}</div></div>`).join('')}</div><div class="kk-pm-workbook-note"><b>Seluruh isi dan formula tetap utuh di Spreadsheet sumber.</b> Sheet besar seperti KK 5.2 tidak dimuat seluruh sel ke browser. Dashboard hanya memuat metadata + preview kecil, lalu operator membuka sheet asli saat perlu mengisi/menelusuri seluruh baris. Ini mencegah lag ketika banyak operator aktif.</div></div>`
    : `<div class="kk-pm-workbook-empty">Pilih sheet dari daftar yang sesuai jenis OPD untuk melihat metadata, preview, dan membuka sheet aslinya.</div>`;
  const workbookReady=!!wb.workbookUrl;
  const sheetCards=`<div class="kk-pm-sheet-group"><div class="kk-pm-sheet-group-title">Sheet tersedia untuk OPD ini · ${sheets.length} sheet</div>${sheets.map(x=>`<button type="button" class="kk-pm-workbook-sheet-card ${kkPmSelectedSheet===x.sheetName?'active':''}" data-pm-sheet="${escapeHtml(x.sheetName)}"><span class="kk-pm-sheet-order">${x.order}</span><div><b>${escapeHtml(x.sheetName)}</b><strong>${escapeHtml(x.description||'')}</strong><small>${escapeHtml(x.phase||'')} · ${escapeHtml(x.type==='workpaper'?'Kertas Kerja':'Pendukung/Referensi')} · ${escapeHtml(x.dimension||'—')} · ${Number(x.formulaCount||0).toLocaleString('id-ID')} formula</small></div><span class="kk-pm-sheet-arrow">→</span></button>`).join('')}</div>`;
  return `<div class="kk-pm-sheet-head"><div><div class="kk-pm-kicker">WORKBOOK SINGLE SOURCE OF TRUTH</div><h4>Seluruh Workbook dari Awal sampai Akhir</h4><p>${escapeHtml(scopeNote)} Workbook terbaru mengikuti template KK PM dengan <b>${sheets.length} sheet yang ditampilkan untuk cakupan OPD ini</b>; master global tetap satu sumber dan data isian per OPD tetap terpisah.</p></div><div class="kk-pm-workbook-overview-actions">${workbookReady?`<button type="button" class="kk-pm-action-link" data-pm-open-workbook="">↗️ Buka Seluruh Workbook</button>`:'<span class="kk-pm-disabled-link">Spreadsheet PM belum dibuat</span>'}</div></div><div class="kk-pm-workbook-alert"><b>Hubungan data:</b> upload tetap dilakukan melalui <b>Evidence Struktur &amp; Proses</b>. Evidence yang memiliki evidenceKey yang sama akan muncul otomatis di KK PM. Nilai Maturitas SPIP, MRI, IEPK, dan Kapabilitas APIP dibaca dari <b>sel formula workbook KKLEAD_SPIP</b> dan tidak tersedia sebagai input manual.</div>${strategicLink}<div class="kk-pm-workbook-layout"><div class="kk-pm-workbook-sheet-list">${sheetCards}</div><div class="kk-pm-workbook-detail">${preview}</div></div>`;
}
function kkPmRenderModal(){
  if(!kkPmCurrentRow)return;const allowed=new Set(kkPmTargetsForRow());
  document.querySelectorAll('#kkPmTabs [data-pm-tab]').forEach(b=>{const target=b.dataset.pmTab;const scoped=/^T[1-4]$/.test(target);b.hidden=scoped&&!allowed.has(target);b.classList.toggle('active',target===kkPmTab);});
  if(/^T[1-4]$/.test(kkPmTab)&&!allowed.has(kkPmTab))kkPmTab='summary';
  kkPmUpdateSummary();const c=document.getElementById('kkPmContent');if(!c)return;
  if(kkPmTab==='allSheets')c.innerHTML=kkPmRenderAllSheets();else if(kkPmTab==='summary')c.innerHTML=kkPmRenderSummary();else if(kkPmTab==='rpjmd')c.innerHTML=kkRpjmdRenderMapping();else if(allowed.has(kkPmTab))c.innerHTML=kkPmRenderTarget(kkPmTab);else c.innerHTML=kkPmRenderSummary();
}
function kkPmReadDomValue(target,sub,paramId,field){return document.querySelector(`#kkPmContent [data-pm-field="${field}"][data-pm-target="${CSS.escape(String(target))}"][data-pm-sub="${CSS.escape(String(sub))}"][data-pm-param="${CSS.escape(String(paramId))}"]`)?.value||'';}
function kkPmCollectDom(target,sub,paramId){
  const get=f=>kkPmReadDomValue(target,sub,paramId,f); return {hasilPengujian:get('hasilPengujian'),gradeResult:get('gradeResult').toUpperCase(),aoiCluster:get('aoiCluster'),aoiDesc:get('aoiDesc'),causeCluster:get('causeCluster'),causeDesc:get('causeDesc'),note:get('note')};
}
function markAssessmentInProgressLocally(opdId){const row=rows.find(r=>String(r.id)===String(opdId));if(!row||['Proses Review','Selesai Verifikasi'].includes(String(row.assessmentStatus||'')))return;row.assessmentStatus='Proses Pengisian';const select=document.querySelector(`#tableBody select[data-id="${CSS.escape(String(opdId))}"][data-field="assessmentStatus"]`);if(select)select.value='Proses Pengisian';updateAssessmentProgress();}
async function kkPmSaveParameter(target,sub,paramId){
  if(!kkPmCurrentRow)return;if(!kkPmTargetsForRow().includes(String(target).toUpperCase()))return kkPmSetStatus(`Target ${target} tidak berlaku untuk ${kkPmCurrentRow.opd}.`, 'error'); const data=kkPmCollectDom(target,sub,paramId); const p=kkPmParamList(target).find(x=>x.subCode===sub&&x.paramId===paramId); if(!p)return;
  const level=KK_PM_GRADE_LEVEL[data.gradeResult]||0; const prev={...kkPmGetState(target,sub,paramId),...data,conclusion:data.gradeResult?`Grade ${data.gradeResult} · Level ${level}`:'Belum ditetapkan',updatedAt:Date.now()}; kkPmSetState(target,sub,paramId,prev);
  const card=document.querySelector(`.kk-pm-param-card details`); // no-op; state drives re-render on the next blur/change if needed
  try{
    kkPmSetStatus('⏳ Menyimpan perubahan KK PM SPIP...');
    const d=await callServerWithRetry('saveKkPmItem',{opdId:kkPmCurrentRow.id,year:currentYear,target,subunsur:sub,paramId,...data,updatedBy:''},3);
    if(d?.item)kkPmSetState(target,sub,paramId,d.item);markAssessmentInProgressLocally(kkPmCurrentRow.id); kkPmSetStatus('✓ Tersimpan otomatis.','success'); kkPmUpdateSummary();
  }catch(err){kkPmSetStatus('❌ Gagal menyimpan KK PM: '+(err.message||err),'error');}
}
function kkPmScheduleSave(target,sub,paramId){const key=kkPmStateKey(target,sub,paramId);clearTimeout(kkPmSaveTimers.get(key));kkPmSaveTimers.set(key,setTimeout(()=>{kkPmSaveTimers.delete(key);kkPmSaveParameter(target,sub,paramId);},500));}
function kkPmCollectMeta(target){const out={};document.querySelectorAll(`#kkPmContent [data-pm-meta-target="${CSS.escape(String(target))}"][data-pm-meta]`).forEach(el=>{out[el.dataset.pmMeta]=el.value||'';});return out;}
function kkPmScheduleMetaSave(target){if(!kkPmTargetsForRow().includes(String(target).toUpperCase()))return;const key=String(target);clearTimeout(kkPmMetaSaveTimers.get(key));kkPmMetaSaveTimers.set(key,setTimeout(async()=>{kkPmMetaSaveTimers.delete(key);const meta=kkPmCollectMeta(target);kkPmMetaMap.set(key,meta);try{await callServerWithRetry('saveKkPmMeta',{opdId:kkPmCurrentRow.id,year:currentYear,target,...meta},3);markAssessmentInProgressLocally(kkPmCurrentRow.id);kkPmSetStatus('✓ Identitas lembar kerja tersimpan.','success');}catch(err){kkPmSetStatus('❌ Gagal menyimpan identitas: '+(err.message||err),'error');}},500));}
function kkPmExportCellValue(aoa,rowIndex,col,value,link){if(!link){aoa.push(value);return;} }

async function createKkPmWorkbookForCurrentRow(options={}){
  if(!kkPmCurrentRow)return null;
  const btn=document.getElementById('kkPmSyncWorkbook');
  if(btn)btn.disabled=true;
  kkPmSetStatus('⏳ Memeriksa master terbaru dan menautkan workbook PM yang sesuai…');
  try{
    const d=await callServerWithRetry('createKkPmSheets',{opdId:kkPmCurrentRow.id,year:currentYear,opd:kkPmCurrentRow.opd||'OPD'},2);
    kkPmWorkbookData=d?.kkPmData||{};
    kkPmWorkbookSheets=Array.isArray(d?.sheets)?d.sheets:[];
    kkPmWorkbookNeedsSync=false;kkPmWorkbookSyncReason='';
    kkPmCurrentRow.kkPmData={...(kkPmCurrentRow.kkPmData||{}),workbook:kkPmWorkbookData};
    const idx=rows.findIndex(r=>String(r.id)===String(kkPmCurrentRow.id));
    if(idx>=0)rows[idx].kkPmData={...(rows[idx].kkPmData||{}),workbook:kkPmWorkbookData};
    // Refresh authoritative D1 link after the write, avoiding a stale URL kept by another tab.
    const verified=await callServerWithRetry('getKkPmSheets',{opdId:kkPmCurrentRow.id,year:currentYear,forceRefresh:true},1);
    if(verified?.needsSync)throw new Error(verified.needsSyncReason||'Tautan workbook masih belum sesuai master PM terbaru setelah sinkronisasi.');
    kkPmWorkbookData=verified?.kkPmData||kkPmWorkbookData;
    kkPmWorkbookSheets=Array.isArray(verified?.sheets)?verified.sheets:kkPmWorkbookSheets;
    kkPmCurrentRow.kkPmData={...(kkPmCurrentRow.kkPmData||{}),workbook:kkPmWorkbookData};
    if(idx>=0)rows[idx].kkPmData={...(rows[idx].kkPmData||{}),workbook:kkPmWorkbookData};
    await syncKkComputedValues(kkPmCurrentRow,false);
    render();updateKpisLocal();
    const replaced=d?.syncDisposition==='created';
    kkPmSetStatus(replaced?'✓ Workbook baru dari master PM terbaru sudah ditautkan. Workbook lama tetap tersimpan untuk pemulihan.':'✓ Workbook PM telah diverifikasi dan masih sesuai master terbaru.','success');
    kkPmRenderModal();
    return verified;
  }catch(err){
    kkPmWorkbookNeedsSync=true;kkPmWorkbookSyncReason=err?.message||String(err);
    kkPmSetStatus('❌ Sinkronisasi belum berhasil: '+kkPmWorkbookSyncReason+' Workbook lama tidak dihapus; tautan lama tidak akan dibuka otomatis.','error');
    throw err;
  }finally{if(btn)btn.disabled=false;}
}
async function openLatestKkPmWorkbook(sheetName=''){
  if(!kkPmCurrentRow||kkPmWorkbookOpenBusy)return;
  // Open synchronously from the click handler so browsers do not block the eventual URL.
  const newTab=window.open('about:blank','_blank');
  kkPmWorkbookOpenBusy=true;
  const openBtn=document.getElementById('kkPmOpenWorkbook');
  if(openBtn)openBtn.disabled=true;
  try{
    kkPmSetStatus('⏳ Memeriksa tautan workbook terbaru di server…');
    let data=await callServerWithRetry('getKkPmSheets',{opdId:kkPmCurrentRow.id,year:currentYear,forceRefresh:true},2);
    if(data?.needsSync){
      kkPmSetStatus('🔄 '+(data.needsSyncReason||'Workbook belum terbaru')+' Menjalankan sinkronisasi sebelum membuka…');
      await createKkPmWorkbookForCurrentRow();
      data=await callServerWithRetry('getKkPmSheets',{opdId:kkPmCurrentRow.id,year:currentYear,forceRefresh:true},1);
    }
    if(data?.needsSync)throw new Error(data.needsSyncReason||'Workbook masih belum sesuai master PM terbaru.');
    const wb=data?.kkPmData||{};
    let url=wb.workbookUrl||(wb.workbookSpreadsheetId?`https://docs.google.com/spreadsheets/d/${encodeURIComponent(wb.workbookSpreadsheetId)}/edit`:'');
    if(!url)throw new Error('Server belum memiliki tautan Google Spreadsheet PM untuk OPD/tahun ini.');
    if(sheetName){
      const targetSheetKey=kkPmCanonicalSheetKey(sheetName);
      const exactSheet=(data.sheets||[]).find(x=>kkPmCanonicalSheetKey(x.title||x.properties?.title)===targetSheetKey);
      if(!exactSheet)throw new Error(`Tab inti ${sheetName} tidak ditemukan pada workbook PM terbaru. Periksa alias nama tab master; tautan workbook lama tidak dibuka.`);
      if(exactSheet.sheetId!==undefined&&exactSheet.sheetId!==null)url+=`#gid=${encodeURIComponent(exactSheet.sheetId)}`;
    }
    kkPmWorkbookData=wb;kkPmWorkbookSheets=Array.isArray(data.sheets)?data.sheets:kkPmWorkbookSheets;kkPmWorkbookNeedsSync=false;kkPmWorkbookSyncReason='';
    kkPmCurrentRow.kkPmData={...(kkPmCurrentRow.kkPmData||{}),workbook:wb};
    const idx=rows.findIndex(r=>String(r.id)===String(kkPmCurrentRow.id));if(idx>=0)rows[idx].kkPmData={...(rows[idx].kkPmData||{}),workbook:wb};
    kkPmSetStatus('✓ Tautan resmi dari server sudah diperiksa. Membuka workbook PM terbaru…','success');kkPmRenderModal();
    if(newTab&&!newTab.closed)newTab.location.replace(url);else window.open(url,'_blank','noopener,noreferrer');
  }catch(err){
    if(newTab&&!newTab.closed)newTab.close();
    kkPmSetStatus('❌ Spreadsheet tidak dibuka karena tautan terbaru belum tervalidasi: '+(err?.message||err)+' Periksa ID/link master, izin Google Drive, 26 tab inti dan formula utama. Tab tambahan diperbolehkan; file lama tetap aman.','error');
  }finally{kkPmWorkbookOpenBusy=false;if(openBtn)openBtn.disabled=false;}
}
async function exportKkPmFullWorkbook(){
  if(!kkPmCurrentRow)return; kkPmSetStatus('⏳ Menyiapkan export workbook lengkap...');
  try{const response=await fetch('/myCloudinaryHandler',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'exportKkPmWorkbook',opdId:kkPmCurrentRow.id,year:currentYear})}); if(!response.ok){const tx=await response.text();throw new Error(tx||`HTTP ${response.status}`);} const blob=await response.blob();const name=`${(kkPmCurrentRow.opd||'OPD').replace(/[\\/:*?"<>|]/g,' ').trim().substring(0,65)||'OPD'}-${currentYear}-KK-PM-SPIP-FULL.xlsx`;const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);kkPmSetStatus('✓ Export workbook lengkap berhasil.','success');}catch(err){kkPmSetStatus('❌ Export workbook lengkap gagal: '+(err.message||err),'error');}
}
function exportKkPmExcel(){
  if(!kkPmCurrentRow||!window.XLSX||!kkPmMaster)return kkPmSetStatus('Export Excel tidak tersedia.','error');
  try{
    const wb=XLSX.utils.book_new(); const s=kkPmOverallSummary();
    const recap=[['KERTAS KERJA PM SPIP',''],['OPD',kkPmCurrentRow.opd||''],['Tahun',currentYear],[],['Target','Total Parameter','Dinilai','Pending','Progress','Rata-rata Level','Evidence Terhubung'],...s.targets.map(x=>[x.target,x.total,x.evaluated,x.pending,x.completion,x.avgLevel||'',x.evidence])];
    recap.push([],['Nilai Existing','Nilai'],['Nilai Struktur & Proses',Number(getRowStructureProcessBreakdown(kkPmCurrentRow).value||0)],['Nilai Maturitas SPIP',computedValueOf(kkPmCurrentRow,'nilaiMaturitas')??''],['MRI',computedValueOf(kkPmCurrentRow,'mri')??''],['IEPK',computedValueOf(kkPmCurrentRow,'iepk')??''],['Nilai Kapabilitas APIP',computedValueOf(kkPmCurrentRow,'nilaiKapabilitasApip')??'']);
    const wsRecap=XLSX.utils.aoa_to_sheet(recap);wsRecap['!cols']=[{wch:24},{wch:18},{wch:14},{wch:14},{wch:14},{wch:18},{wch:24}];wsRecap['!freeze']={xSplit:0,ySplit:5};XLSX.utils.book_append_sheet(wb,wsRecap,'Rekap PM');
    if(kkRpjmdMaster){
      const rp=[['PEMETAAN KERTAS KERJA DENGAN RPJMD MAHAKAM ULU 2025–2029'],['Sumber','Perda Kabupaten Mahakam Ulu Nomor 1 Tahun 2026 · Bab III · Tabel 3.6 · hlm. tercetak 195–198'],['Visi',kkRpjmdMaster.vision||''],[],['Kertas Kerja','Kode Sasaran','Nama Sasaran RPJMD','Uraian Keterkaitan','Status Verifikasi','Verifikator','Catatan Verifikasi','Waktu Pembaruan']];
      KK_RPJMD_WORKPAPERS.forEach(w=>{const m=kkRpjmdMappings.get(w.code)||{};const codes=Array.isArray(m.goalCodes)?m.goalCodes:[];if(!codes.length){rp.push([w.title,'','','',m.status||'Belum Diajukan',m.verifierName||'',m.verifierNote||'',m.updatedAt?new Date(m.updatedAt).toLocaleString('id-ID'):'']);return;}codes.forEach(code=>{const g=kkRpjmdGoals().find(x=>x.code===code);rp.push([w.title,code,g?.name||'',m.rationale||'',m.status||'Belum Diajukan',m.verifierName||'',m.verifierNote||'',m.updatedAt?new Date(m.updatedAt).toLocaleString('id-ID'):'']);});});
      const wr=XLSX.utils.aoa_to_sheet(rp);wr['!cols']=[{wch:32},{wch:12},{wch:55},{wch:65},{wch:22},{wch:24},{wch:55},{wch:24}];wr['!freeze']={xSplit:0,ySplit:5};XLSX.utils.book_append_sheet(wb,wr,'Pemetaan RPJMD');
    }
    kkPmTargetsForRow().forEach(target=>{
      const rowsOut=[['OPD',kkPmCurrentRow.opd||'','Tahun',currentYear,'Target',target],[],['Kode','Uraian Subunsur','No','Uraian Parameter','Kode Parameter','MRI','IEPK','Grade','Kriteria','Penjelasan','Cara Pengujian','Hasil Pengujian','Grade Hasil','Kluster AoI','Uraian AoI','Kluster Penyebab','Uraian Penyebab','Kesimpulan Akhir','Evidence Disarankan','Evidence Struktur & Proses']];
      kkPmParamList(target).forEach(p=>{
        const st=kkPmGetState(target,p.subCode,p.paramId);
        Object.values(p.grades||{}).forEach((g,i)=>{
          const files=kkPmLinkedFilesForParam(kkPmCurrentRow,p).filter(f=>f.grade===g.grade);
          const evidence=Array.isArray(g.evidenceDisarankan)?g.evidenceDisarankan.join(' | '):'';
          const links=files.map(f=>f.url||f.name).join(' | ');
          rowsOut.push([p.subCode,p.subunsur,p.no,p.uraianParameter,p.kodeParameter||'',p.mri||'-',p.iepk||'-',g.grade,g.kriteria||'',g.penjelasan||'',g.caraPengujian||'',i===0?st.hasilPengujian||'':'',i===0?st.gradeResult||'':'',i===0?st.aoiCluster||'':'',i===0?st.aoiDesc||'':'',i===0?st.causeCluster||'':'',i===0?st.causeDesc||'':'',i===0?(st.gradeResult?`Grade ${st.gradeResult} · Level ${KK_PM_GRADE_LEVEL[st.gradeResult]}`:''):'',evidence,links]);
        });
      });
      const ws=XLSX.utils.aoa_to_sheet(rowsOut);ws['!freeze']={xSplit:0,ySplit:3};ws['!cols']=[{wch:10},{wch:32},{wch:8},{wch:62},{wch:16},{wch:8},{wch:8},{wch:8},{wch:60},{wch:68},{wch:18},{wch:55},{wch:12},{wch:20},{wch:35},{wch:20},{wch:35},{wch:24},{wch:45},{wch:42}];XLSX.utils.book_append_sheet(wb,ws,`KK3.${target.slice(1)} ${target}`);
    });
    const safe=(kkPmCurrentRow.opd||'OPD').replace(/[\\/:*?"<>|]/g,' ').trim().substring(0,65)||'OPD'; XLSX.writeFile(wb,`${safe}-${currentYear}-KK-PM-SPIP.xlsx`);kkPmSetStatus('✓ Export Excel berhasil: Rekap + KK3.1–KK3.4.','success');
  }catch(err){kkPmSetStatus('❌ Export gagal: '+(err.message||err),'error');}
}
function kkPmMasterUpdateStatus(message,state=''){
  const el=document.getElementById('kkPmMasterUpdateStatus');if(el){el.textContent=message||'';el.className='kk-pm-account-master-status'+(state?' '+state:'');}
}
async function loadKkPmAccountTemplateConfig({force=false}={}){
  const input=document.getElementById('kkPmMasterIdInput');if(!input)return;
  const panel=input.closest('.kk-pm-account-master-panel');
  const role=String(currentUser?.role||'').toLowerCase();
  const allowed=['admin','irban'].includes(role);
  if(panel)panel.hidden=!allowed;
  if(!allowed)return;
  try{
    const config=await callServerWithRetry('getKkPmTemplateConfig',{},2);
    if(force||!input.value||!input.dataset.dirty)input.value=String(config.spreadsheetId||'');
    const updated=config.updatedAt?` · diperbarui ${new Date(config.updatedAt).toLocaleString('id-ID')}${config.updatedBy?' oleh '+config.updatedBy:''}`:'';
    kkPmMasterUpdateStatus(`Master aktif: ${config.spreadsheetId||'belum dikonfigurasi'}${updated}. Profil: ${config.validationProfile||'belum divalidasi'}. Hanya akun Pemda/Irban dapat mengganti master dan memperbarui seluruh workbook.`,'success');
    input.dataset.currentMaster=String(config.spreadsheetId||'');
  }catch(err){kkPmMasterUpdateStatus('Gagal membaca ID master aktif: '+(err.message||err),'error');throw err;}
}
async function updateKkPmAccountMasterAndWorkbook(){
  const role=String(currentUser?.role||'').toLowerCase();
  if(!['admin','irban'].includes(role))return kkPmMasterUpdateStatus('Aksi ini khusus akun Pemda (Super Admin Daerah) dan Irban.','error');
  const input=document.getElementById('kkPmMasterIdInput'),button=document.getElementById('kkPmMasterUpdateAndSync');
  const submitted=String(input?.value||'').trim();
  if(!submitted)return kkPmMasterUpdateStatus('Masukkan ID atau URL Google Sheets master terlebih dahulu.','error');
  const confirmed=confirm('Tindakan ini mengganti master global, memperbarui workbook Pemda dan SELURUH OPD untuk tahun yang dipilih, lalu mengganti mirror XLSX di R2. Workbook sebelumnya disimpan sebagai riwayat pemulihan dan evidence R2 tidak dihapus. Lanjutkan?');
  if(!confirmed)return;
  if(button)button.disabled=true;
  try{
    const dashboardInput=document.getElementById('pemdaPmTemplateId');
    if(dashboardInput){dashboardInput.value=submitted;dashboardInput.dataset.dirty='1';}
    kkPmMasterUpdateStatus('Memvalidasi master, lalu memperbarui workbook Pemda dan seluruh OPD…');
    const result=await refreshPemdaPmWorkbooks({bulk:true,masterId:submitted,throwOnError:true,accountModal:true});
    if(input){input.value=result?.config?.spreadsheetId||submitted;input.dataset.currentMaster=String(result?.config?.spreadsheetId||submitted);delete input.dataset.dirty;}
    kkPmMasterUpdateStatus(`Selesai. OPD: ${result?.updatedOpd||0}/${result?.totalOpd||0}; kegagalan workbook ${result?.failedOpd?.length||0}; kegagalan mirror R2 ${result?.failedR2?.length||0}; kegagalan arsip Drive ${result?.failedDriveArchive?.length||0}.`,(result?.ok?'success':'error'));
  }catch(err){kkPmMasterUpdateStatus('Pembaruan gagal: '+(err.message||err)+'. Periksa rincian error; referensi lama tetap dipertahankan bila proses belum selesai.','error');}
  finally{if(button)button.disabled=false;}
}

async function openKkPmModal(id){
  const row=rows.find(r=>String(r.id)===String(id)); if(!row)return; kkPmCurrentRow=row;kkPmEditingRowId=row.id;kkPmTab='allSheets';kkPmSelectedSheet='FAQ';kkPmFilters={search:'',unsur:'all',subunsur:'all'};const modal=document.getElementById('kkPmModal');if(!modal)return;
  document.getElementById('kkPmModalOpdName').textContent=`${row.opd||'Tanpa Nama'} · Tahun ${currentYear}`;modal.classList.add('active');kkPmSetStatus('Memuat workbook lengkap, PM detail, evidence terhubung, dan nilai formula...');
  const masterPanel=document.querySelector('.kk-pm-account-master-panel');if(masterPanel)masterPanel.hidden=!['admin','irban'].includes(String(currentUser?.role||'').toLowerCase());
  loadKkPmAccountTemplateConfig().catch(()=>{});
  try{
    const results=await Promise.all([ensureKkPmMasterLoaded(true),ensureKkRpjmdMasterLoaded(),loadKkPmData(row),loadKkPmWorkbookData(row),loadKkRpjmdMappings(row),syncKkComputedValues(row,false)]);
    const workbookState=results[3]||{};
    if(workbookState.needsSync||kkPmWorkbookNeedsSync){
      kkPmSetStatus('⚠️ '+(workbookState.needsSyncReason||kkPmWorkbookSyncReason||'Workbook PM perlu diperbarui dari master terbaru.')+' Tekan “Buka Spreadsheet PM” untuk membuat/menautkan workbook yang sudah tervalidasi. Workbook lama disimpan untuk pemulihan.','error');
    }else if(kkPmMaster?.liveSourceStatus?.live===true){
      kkPmSetStatus('✓ Data KK PM siap; master live berhasil diperbarui dari Google Sheets. Sheet dan target ditampilkan sesuai OPD.','success');
    }else{
      const detail=String(kkPmMaster?.liveSourceStatus?.message||'Google Sheets master belum mengembalikan data live.');
      kkPmSetStatus(`⚠️ Data KK PM ditampilkan dari snapshot lokal karena refresh master live gagal. Jangan gunakan sebagai konfirmasi bahwa master terbaru sudah tersinkron. Detail: ${detail}`,'error');
    }
    kkPmRenderModal();
  }catch(err){kkPmSetStatus('Gagal memuat KK PM SPIP: '+(err.message||err),'error');kkPmRenderModal();}
}

function closeKkPmModal(){document.getElementById('kkPmModal')?.classList.remove('active');kkPmEditingRowId=null;kkPmCurrentRow=null;kkPmWorkbookData=null;kkPmWorkbookSheets=[];kkPmSelectedSheet='';kkPmStateMap=new Map();kkPmMetaMap=new Map();kkPmSaveTimers.forEach(t=>clearTimeout(t));kkPmSaveTimers.clear();kkPmMetaSaveTimers.forEach(t=>clearTimeout(t));kkPmMetaSaveTimers.clear();}

document.getElementById('kkPmMasterReload')?.addEventListener('click',()=>loadKkPmAccountTemplateConfig({force:true}).catch(()=>{}));
document.getElementById('kkPmMasterIdInput')?.addEventListener('input',e=>{e.target.dataset.dirty='1';});
document.getElementById('kkPmMasterUpdateAndSync')?.addEventListener('click',()=>updateKkPmAccountMasterAndWorkbook());

document.addEventListener('click',e=>{
  const sheet=e.target.closest('#kkPmContent [data-pm-sheet]'); if(sheet){kkPmSelectedSheet=sheet.dataset.pmSheet||''; kkPmTab='allSheets'; kkPmRenderModal(); return;}
  const openW=e.target.closest('#kkPmOpenWorkbook'); if(openW){openLatestKkPmWorkbook();return;}
  const openSheet=e.target.closest('#kkPmContent [data-pm-open-workbook]'); if(openSheet){openLatestKkPmWorkbook(openSheet.dataset.pmOpenWorkbook||'');return;}
  const syncW=e.target.closest('#kkPmSyncWorkbook'); if(syncW){createKkPmWorkbookForCurrentRow().catch(()=>{}); return;}
  const expFull=e.target.closest('#kkPmExportFull'); if(expFull){exportKkPmFullWorkbook(); return;}
  const tab=e.target.closest('#kkPmTabs [data-pm-tab]');if(tab){kkPmTab=tab.dataset.pmTab;kkPmFilters={search:'',unsur:'all',subunsur:'all'};kkPmRenderModal();return;}
  const rpjmdSave=e.target.closest('[data-rpjmd-save]');if(rpjmdSave){kkRpjmdSaveMapping(rpjmdSave.dataset.rpjmdSave);return;}
  const rpjmdVerify=e.target.closest('[data-rpjmd-verify]');if(rpjmdVerify){kkRpjmdVerifyMapping(rpjmdVerify.dataset.rpjmdVerify,rpjmdVerify.dataset.rpjmdDecision);return;}
  const targetBtn=e.target.closest('#kkPmContent [data-pm-tab-target]');if(targetBtn){kkPmTab=targetBtn.dataset.pmTabTarget;kkPmFilters={search:'',unsur:'all',subunsur:'all'};kkPmRenderModal();return;}
  const exp=e.target.closest('#kkPmExport');if(exp){exportKkPmExcel();return;}
  const btn=e.target.closest('.btn-kk-pm-spip');if(btn){openKkPmModal(btn.dataset.id);return;}
});
document.addEventListener('change',e=>{
  const field=e.target.closest('#kkPmContent [data-pm-field]');if(field){kkPmScheduleSave(field.dataset.pmTarget,field.dataset.pmSub,field.dataset.pmParam);return;}
  const meta=e.target.closest('#kkPmContent [data-pm-meta]');if(meta){kkPmScheduleMetaSave(meta.dataset.pmMetaTarget);return;}
  if(e.target.id==='kkPmFilterUnsur'||e.target.id==='kkPmFilterSub'){
    if(e.target.id==='kkPmFilterUnsur'){kkPmFilters.unsur=e.target.value;kkPmFilters.subunsur='all';}else kkPmFilters.subunsur=e.target.value;kkPmRenderModal();
  }
});
document.addEventListener('blur',e=>{
  const field=e.target.closest?.('#kkPmContent [data-pm-field]');if(field){kkPmScheduleSave(field.dataset.pmTarget,field.dataset.pmSub,field.dataset.pmParam);return;}
  const meta=e.target.closest?.('#kkPmContent [data-pm-meta]');if(meta)kkPmScheduleMetaSave(meta.dataset.pmMetaTarget);
},true);
document.addEventListener('input',e=>{if(e.target.id==='kkPmSearch'){kkPmFilters.search=e.target.value||'';clearTimeout(window.__kkPmSearchTimer);window.__kkPmSearchTimer=setTimeout(()=>kkPmRenderModal(),180);}});
document.getElementById('kkPmClose')?.addEventListener('click',closeKkPmModal);document.getElementById('kkPmCloseFooter')?.addEventListener('click',closeKkPmModal);

document.addEventListener('click',function(e){
  const close=e.target.closest('#sheetLinksClose,#sheetLinksCancel');
  if(close){closeSpreadsheetModal();return;}
  const refresh=e.target.closest('#sheetLinksRefresh');
  if(refresh){const row=rows.find(r=>r.id===sheetLinksEditingRowId);if(row){sheetLinksSetStatus('Memuat ulang link…');loadSheetLinksForRow(row).then(()=>sheetLinksSetStatus('Link diperbarui.','success'));}return;}
  const create=e.target.closest('#sheetLinksCreate');
  if(create){if(document.getElementById('sheetLinksModal')?.dataset.mode==='rtp')createRtpSheetLinksForCurrentRow(false);else createSheetLinksForCurrentRow(false);return;}
  const btn=e.target.closest('button');
  if(!btn)return;
  if(btn.classList.contains('btn-edit-name')) openEditNameModal(btn.getAttribute('data-id'));
  else if(btn.classList.contains('btn-detail')) openWorkbookEvidenceModal(btn.getAttribute('data-id'));
  else if(btn.classList.contains('btn-kk')) openSpreadsheetModal(btn.getAttribute('data-id'));
  else if(btn.classList.contains('btn-report-pm')) openReportUploadModal(btn.getAttribute('data-id'),'pm_spip');
  else if(btn.classList.contains('btn-kk-rtp')) openKkRtp(btn.getAttribute('data-id'));
  else if(btn.classList.contains('btn-report-rr')) openReportUploadModal(btn.getAttribute('data-id'),'rr_rtp');
  else if(btn.classList.contains('btn-rtp-evidence')) openRtpEvidenceModal(btn.getAttribute('data-id'));
  else if(btn.classList.contains('btn-lhe-followup')) openLheFollowupModal(btn.getAttribute('data-id'));
  else if(btn.classList.contains('evidence-preview-btn')||btn.classList.contains('file-name-preview')) openEvidencePreview({opdId:btn.dataset.opdId,uploadId:btn.dataset.uploadId,fileName:btn.dataset.fileName||'Evidence',fileType:btn.dataset.fileType||'application/octet-stream'});
  else if(btn.classList.contains('evidence-workflow-btn')) openEvidenceWorkflowModal({opdId:btn.dataset.opdId,uploadId:btn.dataset.uploadId,fileName:btn.dataset.fileName||'Evidence'});
  else if(btn.classList.contains('del-btn')) openConfirmModal(btn.getAttribute('data-id'));
});


// ====== TINDAK LANJUT LHE SPIP (tahun berjalan + tahun sebelumnya) ======
function lheYearPair(){const y=Number(currentYear)||new Date().getFullYear();return {current:String(y),previous:String(y-1),calendarCurrent:String(new Date().getFullYear()),calendarPrevious:String(new Date().getFullYear()-1),label:`${y} / ${y-1}`};}
function lheMapDueDateToTargetYear(rawDate,sourceYear,targetYear){const target=String(targetYear);if(!/^\d{4}$/.test(target))return String(rawDate||'');return String(rawDate||'').replace(/\b(?:19|20)\d{2}\b/g,()=>target).replace(/\btahun berjalan\b/gi,target).replace(/\btahun berikutnya\b/gi,String(Number(target)+1));}
function lheRefreshYearLabels(){const years=lheYearPair();const target=lheField('lheTargetYear');if(target)target.value=years.current;const banner=lheField('lheFollowupYearLabel');if(banner)banner.textContent=`Tahun Anggaran tindak lanjut: ${years.current} (otomatis mengikuti Tahun Anggaran aktif aplikasi).`;const modalTitle=lheField('lheFollowupOpdName');if(modalTitle){const row=rows.find(r=>String(r.id)===String(lheUi.opdId));modalTitle.textContent=`${row?.opd||'Tanpa Nama'} · Tahun ${years.current}`;}if(lheUi?.templateDueDateAuto){const select=lheField('lheTemplateSelect'),t=select&&select.value!==''?lheUi.templates[Number(select.value)]:null,due=lheField('lheDueDate');if(t&&due&&due.value===lheUi.templateDueDateValue){due.value=lheMapDueDateToTargetYear(t.dueDate,years.current,years.current);lheUi.templateDueDateValue=due.value;}}}
const lheUi={opdId:null,items:[],templates:[],templateLoaded:false,editingId:null,selectedFollowupId:null,templateDueDateAuto:false,templateDueDateValue:''};
function lheStatus(message,type=''){const el=document.getElementById('lheFollowupStatus');if(!el)return;el.textContent=message||'';el.className='sheet-links-status'+(type?' '+type:'');el.style.display=message?'block':'none';}
function lheCanEdit(){return ['admin','auditor','ppupd','opd','irban'].includes(String(currentUser?.role||''));}
function lheCanDelete(){return ['admin','auditor','ppupd','irban','opd'].includes(String(currentUser?.role||''));}
function lheField(id){return document.getElementById(id);}
function lheSetForm(item={}){
  lheUi.templateDueDateAuto=false;lheUi.templateDueDateValue='';
  lheUi.editingId=item.id||null;lheUi.selectedFollowupId=item.id||null;
  lheField('lheEditorTitle').textContent=item.id?'Ubah tindak lanjut':'Tambah tindak lanjut';
  lheRefreshYearLabels();
  const sourceYearValue=String(item.source_year||item.sourceYear||lheYearPair().current);
  const sourceYearSelect=lheField('lheSourceYear');
  if(sourceYearSelect&&!Array.from(sourceYearSelect.options).some(option=>option.value===sourceYearValue)){const option=document.createElement('option');option.value=sourceYearValue;option.textContent=`Tahun LHE ${sourceYearValue} (data tersimpan)`;option.dataset.legacyYear='true';sourceYearSelect.add(option);}
  if(sourceYearSelect)sourceYearSelect.value=sourceYearValue;
  if(lheField('lheTargetYear'))lheField('lheTargetYear').value=lheYearPair().current;
  lheField('lheRef').value=item.recommendation_ref||item.recommendationRef||'';
  lheField('lheRecommendation').value=item.recommendation||'';
  lheField('lheActionPlan').value=item.action_plan||item.actionPlan||'';
  lheField('lheIndicator').value=item.indicator||'';
  lheField('lheEvidenceRequired').value=item.evidence_required||item.evidenceRequired||'';
  lheField('lhePic').value=item.pic||'';
  lheField('lheDueDate').value=item.due_date||item.dueDate||'';
  lheField('lheActualAction').value=item.actual_action||item.actualAction||'';
  lheField('lheStatus').value=item.status||'Belum diverifikasi';
  const readOnly=!lheCanEdit();
  ['lheSourceYear','lheRef','lheRecommendation','lheActionPlan','lheIndicator','lheEvidenceRequired','lhePic','lheDueDate','lheActualAction','lheStatus'].forEach(id=>{lheField(id).disabled=readOnly;});
  lheField('lheSaveButton').style.display=readOnly?'none':'inline-flex';
  lheField('lheNewButton').style.display=readOnly?'none':'inline-flex';
  lheField('lheEvidenceChoose').style.display=currentUser?.role==='bpkp'?'none':'inline-flex';
  renderLheEvidenceList(item.evidence||[]);
  const baseline=lheField('lheTemplateBaseline');if(baseline)baseline.textContent='';
}
function renderLheEvidenceList(files=[]){
  const root=lheField('lheEvidenceList');if(!root)return;
  if(!lheUi.selectedFollowupId){root.innerHTML='<div class="sheet-link-card">Pilih atau simpan satu butir tindak lanjut terlebih dahulu untuk mengaitkan bukti.</div>';return;}
  const arr=Array.isArray(files)?files:[];
  if(!arr.length){root.innerHTML='<div class="sheet-link-card">Belum ada bukti dukung untuk butir ini.</div>';return;}
  root.innerHTML=arr.map(f=>{
    const workflow=f.uploadId?`<button type="button" class="evidence-workflow-btn" data-opd-id="${sheetLinksEsc(lheUi.opdId)}" data-upload-id="${sheetLinksEsc(f.uploadId)}" data-file-name="${sheetLinksEsc(f.fileName||'Bukti LHE')}">🛡️ Alur Verifikasi</button>`:'';const preview=f.uploadId?`<button type="button" class="evidence-preview-btn" data-opd-id="${sheetLinksEsc(lheUi.opdId)}" data-upload-id="${sheetLinksEsc(f.uploadId)}" data-file-name="${sheetLinksEsc(f.fileName||'Bukti LHE')}" data-file-type="${sheetLinksEsc(f.fileType||'application/octet-stream')}">👁 Pratinjau</button>`:'';
    const canRetry=['admin','auditor','opd'].includes(String(currentUser?.role||''));
    const retry=f.syncStatus==='retrying'&&canRetry?`<button type="button" class="lhe-evidence-retry" data-upload-id="${sheetLinksEsc(f.uploadId)}">↻ Retry Drive</button>`:'';
    const del=currentUser?.role==='bpkp'?'':`<button type="button" class="lhe-evidence-delete" data-upload-id="${sheetLinksEsc(f.uploadId)}">Hapus</button>`;
    return `<div class="rtp-file-item"><div><div class="rtp-file-name">📎 ${sheetLinksEsc(f.fileName||'Bukti dukung')}</div><div class="rtp-file-meta">${sheetLinksEsc(f.syncStatus||'tersimpan')}${f.uploadedAt?' · '+sheetLinksEsc(f.uploadedAt):''}${f.syncError?' · '+sheetLinksEsc(f.syncError):''}</div></div><div class="rtp-file-actions">${preview}<a href="${sheetLinksEsc(f.url||'#')}" target="_blank" rel="noopener noreferrer">Buka</a>${workflow}${retry}${del}</div></div>`;
  }).join('');
}
function renderLheFollowupList(){
  const root=lheField('lheFollowupList');if(!root)return;
  const items=Array.isArray(lheUi.items)?lheUi.items:[];
  const row=rows.find(r=>String(r.id)===String(lheUi.opdId));if(row){row.lheFollowupCount=items.length;}
  if(!items.length){root.innerHTML='<div class="sheet-link-card">Belum ada butir tindak lanjut. Pilih template rekomendasi di sebelah kanan untuk memulai.</div>';render();return;}
  root.innerHTML=items.map(item=>{
    const evidence=Array.isArray(item.evidence)?item.evidence:[];
    const active=String(item.id)===String(lheUi.selectedFollowupId);
    const deleteBtn=lheCanDelete()?`<button type="button" class="lhe-delete-followup" data-id="${sheetLinksEsc(item.id)}">🗑 Hapus Butir</button>`:'';
    const openLabel=lheCanEdit()?'✏️ Buka / Edit':'👁 Lihat';
    return `<article class="lhe-followup-card" style="${active?'border-color:#2563eb;background:#eff6ff;':''}">
      <h5>${sheetLinksEsc(item.recommendation_ref||'Tanpa Ref.')} · ${sheetLinksEsc(item.recommendation||'Rekomendasi belum diisi')}</h5>
      <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:11px;"><span class="badge">Tahun TL ${sheetLinksEsc(item.year||currentYear)}</span><span class="badge">Tahun LHE ${sheetLinksEsc(item.source_year||'—')}</span><span class="badge">${sheetLinksEsc(item.status||'Belum diverifikasi')}</span><span class="badge">Bukti ${evidence.length}</span></div>
      <p><b>Rencana aksi:</b> ${sheetLinksEsc(item.action_plan||'Belum diisi')}</p>
      <p><b>Indikator:</b> ${sheetLinksEsc(item.indicator||'Belum diisi')}</p>
      <p><b>Bukti dukung yang diperlukan:</b> ${sheetLinksEsc(item.evidence_required||'Belum ditentukan')}</p>
      <p><b>PIC / tenggat:</b> ${sheetLinksEsc(item.pic||'Belum diisi')} · ${sheetLinksEsc(item.due_date||'Belum ditentukan')}</p>
      <p><b>Realisasi aktual:</b> ${sheetLinksEsc(item.actual_action||'Belum diisi')}</p>
      <p><b>Status verifikasi evidence:</b> ${sheetLinksEsc(item.verification_status||'Belum diverifikasi')}</p>
      <div class="lhe-followup-actions"><button type="button" class="lhe-edit-followup" data-id="${sheetLinksEsc(item.id)}">${openLabel}</button>${deleteBtn}</div>
    </article>`;
  }).join('');
  render();
}
async function loadLheFollowups(){
  if(!lheUi.opdId)return;
  lheStatus('Memuat tindak lanjut…');
  try{
    const data=await callServer('getLheFollowups',{opdId:lheUi.opdId,year:currentYear});
    lheUi.items=Array.isArray(data.items)?data.items:[];
    renderLheFollowupList();
    const selected=lheUi.items.find(x=>String(x.id)===String(lheUi.selectedFollowupId));
    if(selected)renderLheEvidenceList(selected.evidence||[]);else renderLheEvidenceList([]);
    lheStatus(`${lheUi.items.length} butir tindak lanjut tersedia untuk tahun aplikasi ${currentYear}.`,'success');
  }catch(err){lheStatus('Gagal memuat tindak lanjut: '+err.message,'error');}
}
async function loadLheTemplates(){
  if(!lheUi.templateLoaded){
    const response=await fetch(`/lhe-followup-templates.json?v=20261015-lhe-neutral-templates-v1&_=${Date.now()}`,{cache:'no-store'});
    if(!response.ok)throw new Error('File template rekomendasi tidak dapat dimuat.');
    const payload=await response.json();lheUi.templates=Array.isArray(payload.templates)?payload.templates:[];lheUi.templateLoaded=true;
  }
  const years=lheYearPair();
  const select=lheField('lheTemplateSelect');
  if(select){
    const prior=select.value;
    select.innerHTML=`<option value="">Pilih templat rekomendasi untuk Tahun Anggaran ${sheetLinksEsc(years.current)}…</option>`+lheUi.templates.map((t,i)=>`<option value="${i}">${sheetLinksEsc(t.category||'Rekomendasi umum')} · Ref. ${sheetLinksEsc(t.recommendationRef||'—')} — ${sheetLinksEsc(String(t.recommendation||'').slice(0,150))}</option>`).join('');
    if(prior!==''&&lheUi.templates[Number(prior)])select.value=prior;
  }
  const sourceSelect=lheField('lheSourceYear');
  if(sourceSelect){
    const current=String(sourceSelect.value||years.current);
    const currentNumber=Number(years.current)||new Date().getFullYear();
    const earliestYear=Math.max(2000,currentNumber-20);
    const yearOptions=[];
    for(let year=currentNumber+2;year>=earliestYear;year--){
      const value=String(year);
      const label=value===years.current?`Tahun berjalan — ${value}`:value===years.previous?`Tahun sebelumnya — ${value}`:`Tahun LHE ${value}`;
      yearOptions.push(`<option value="${value}">${sheetLinksEsc(label)}</option>`);
    }
    sourceSelect.innerHTML=yearOptions.join('');
    sourceSelect.value=yearOptions.some(option=>option.includes(`value="${current}"`))?current:years.current;
  }
  const notice=lheField('lheFollowupNotice');
  if(notice)notice.textContent=`Pilih rekomendasi yang paling sesuai dengan LHE yang sedang ditindaklanjuti. Tahun tindak lanjut otomatis mengikuti Tahun Anggaran aktif ${years.current}. Templat hanya acuan: sesuaikan rumusan, PIC, indikator dan tenggat; realisasi, status serta bukti aktual harus diisi dan diverifikasi terpisah.`;
  lheRefreshYearLabels();
}
async function openLheFollowupModal(id){
  const row=rows.find(r=>String(r.id)===String(id));if(!row)return;
  lheUi.opdId=String(id);lheUi.items=[];lheUi.selectedFollowupId=null;lheUi.editingId=null;
  lheField('lheFollowupOpdName').textContent=`${row.opd||'Tanpa Nama'} · Tahun ${lheYearPair().current}`;
  lheRefreshYearLabels();
  lheField('lheFollowupModal').classList.add('active');if(lheField('lheTemplateSelect'))lheField('lheTemplateSelect').value='';lheSetForm({});
  try{await loadLheTemplates();}catch(err){lheStatus('Templat gagal dimuat: '+err.message,'error');}
  await loadLheFollowups();
}
function chooseLheTemplate(){
  const idx=lheField('lheTemplateSelect').value;if(idx==='')return;
  const t=lheUi.templates[Number(idx)];if(!t)return;
  lheUi.editingId=null;lheUi.selectedFollowupId=null;
  const targetYear=lheYearPair().current;
  const suggestedDueDate=lheMapDueDateToTargetYear(t.dueDate,targetYear,targetYear);
  lheSetForm({sourceYear:targetYear,recommendationRef:t.recommendationRef,recommendation:t.recommendation,actionPlan:t.actionPlan,indicator:t.indicator,evidenceRequired:t.evidenceRequired,pic:t.pic,dueDate:suggestedDueDate,status:'Belum diverifikasi'});
  lheUi.templateDueDateAuto=true;lheUi.templateDueDateValue=suggestedDueDate;
  lheField('lheActualAction').value='';
  let baseline=lheField('lheTemplateBaseline');
  if(!baseline){baseline=document.createElement('div');baseline.id='lheTemplateBaseline';baseline.className='sheet-links-info';lheField('lheTemplateSelect').insertAdjacentElement('afterend',baseline);}
  baseline.textContent=`Templat ini hanya acuan. Status dan realisasi tidak disalin sebagai kondisi aktual. Periksa dan sesuaikan dengan LHE serta keadaan terbaru. Bukti dukung yang disarankan: ${t.evidenceRequired||'tentukan sesuai rekomendasi'}.`;
  renderLheEvidenceList([]);lheStatus(`Templat rekomendasi dimuat untuk Tahun Anggaran ${targetYear}; status dan realisasi tetap perlu diperiksa.`,'success');
}
async function saveLheFollowup(){
  if(!lheCanEdit()){lheStatus('Role akun ini hanya dapat membaca tindak lanjut.','error');return;}
  const payload={opdId:lheUi.opdId,year:currentYear,id:lheUi.editingId||'',sourceYear:lheField('lheSourceYear').value,recommendationRef:lheField('lheRef').value.trim(),recommendation:lheField('lheRecommendation').value.trim(),actionPlan:lheField('lheActionPlan').value.trim(),indicator:lheField('lheIndicator').value.trim(),evidenceRequired:lheField('lheEvidenceRequired').value.trim(),pic:lheField('lhePic').value.trim(),dueDate:lheField('lheDueDate').value.trim(),actualAction:lheField('lheActualAction').value.trim(),status:lheField('lheStatus').value};
  try{
    lheField('lheSaveButton').disabled=true;lheStatus('Menyimpan butir tindak lanjut…');
    const result=await callServer('saveLheFollowup',payload);lheUi.selectedFollowupId=result.id;lheUi.editingId=result.id;
    await loadLheFollowups();lheSetForm(lheUi.items.find(x=>String(x.id)===String(result.id))||{id:result.id,...payload});
    lheStatus(`Tindak lanjut tersimpan untuk Tahun Anggaran ${currentYear}. Status tetap perlu verifikasi sesuai proses.`,'success');
  }catch(err){lheStatus('Gagal menyimpan: '+err.message,'error');}
  finally{lheField('lheSaveButton').disabled=false;}
}
function exportLheFollowupsExcel(){
  if(!Array.isArray(lheUi.items)||!lheUi.items.length){lheStatus('Belum ada butir tersimpan untuk diekspor.','error');return;}
  if(typeof XLSX==='undefined'){lheStatus('Fitur Excel belum termuat. Muat ulang aplikasi lalu coba lagi.','error');return;}
  const row=rows.find(r=>String(r.id)===String(lheUi.opdId));
  const year=String(currentYear||new Date().getFullYear());
  const aoa=[
    ['RENCANA AKSI TINDAK LANJUT SPIP TERINTEGRASI'],
    [`OPD: ${row?.opd||'—'} | Tahun Anggaran Tindak Lanjut: ${year}`],
    ['Rencana aksi, PIC dan waktu merupakan usulan. Realisasi/status harus menggambarkan kondisi aktual; tautan bukti hanya diisi bila tersedia.'],
    ['No.','Ref. rekomendasi','Penanggung jawab / pendukung (usulan)','Rekomendasi laporan (ringkasan)','Rencana aksi / upaya perbaikan yang diusulkan','Target / indikator penyelesaian','Bukti tindak lanjut yang diperlukan','Waktu penyelesaian (usulan)','Realisasi upaya perbaikan','Status terkini','Link bukti tindak lanjut','Catatan verifikasi APIP','Tahun LHE']
  ];
  lheUi.items.forEach((item,i)=>{
    const evidence=Array.isArray(item.evidence)?item.evidence:[];
    const links=evidence.map(f=>f.webViewLink||f.driveUrl||f.publicUrl||'').filter(Boolean).join('\n');
    aoa.push([i+1,item.recommendation_ref||'',item.pic||'',item.recommendation||'',item.action_plan||'',item.indicator||'',item.evidence_required||'',item.due_date||'',item.actual_action||'',item.status||'Belum diverifikasi',links,item.verifier_note||'',item.source_year||'']);
  });
  const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:12}},{s:{r:1,c:0},e:{r:1,c:12}},{s:{r:2,c:0},e:{r:2,c:12}}];
  ws['!freeze']={xSplit:0,ySplit:4};ws['!autofilter']={ref:`A4:M${aoa.length}`};
  ws['!cols']=[{wch:6},{wch:18},{wch:32},{wch:48},{wch:58},{wch:42},{wch:46},{wch:25},{wch:48},{wch:23},{wch:42},{wch:42},{wch:12}];
  for(let r=0;r<aoa.length;r++)for(let c=0;c<13;c++){const cell=ws[XLSX.utils.encode_cell({r,c})];if(cell)cell.s={alignment:{vertical:'top',wrapText:true}};}
  XLSX.utils.book_append_sheet(wb,ws,'Rencana Aksi');
  const safe=String(row?.opd||'OPD').replace(/[\\/:*?"<>|]/g,' ').trim().slice(0,65)||'OPD';
  XLSX.writeFile(wb,`${safe}-${year}-Tindak-Lanjut-LHE-SPIP.xlsx`);
  lheStatus('Ekspor Excel berhasil. Format mengikuti kolom rencana aksi pada contoh workbook, dengan realisasi/status tetap berasal dari data tersimpan.','success');
}
async function uploadLheEvidence(){
  const row=rows.find(r=>String(r.id)===String(lheUi.opdId));const file=lheField('lheEvidenceInput').files?.[0];
  if(!row||!file)return;
  if(!lheUi.selectedFollowupId){lheStatus('Pilih atau simpan butir tindak lanjut sebelum mengunggah bukti.','error');lheField('lheEvidenceInput').value='';return;}
  if(file.size>MAX_FILE_UPLOAD_BYTES){lheStatus('File lebih dari 10 MB. Pilih file yang lebih kecil.','error');lheField('lheEvidenceInput').value='';return;}
  try{
    lheStatus('Mengunggah bukti dukung…');
    const result=await callServerWithRetry('uploadLheEvidence',{__binaryFile:file,opdId:row.id,year:currentYear,followupId:lheUi.selectedFollowupId,fileName:file.name,fileType:file.type||'application/octet-stream',uploadId:crypto.randomUUID()},2);
    await loadLheFollowups();lheStatus(result.syncStatus==='done'?'Bukti tersimpan di R2 dan Google Drive.':'Bukti aman tersimpan di R2; pencadangan Google Drive perlu di-Retry/diperiksa.','success');
  }catch(err){lheStatus('Upload bukti gagal: '+err.message,'error');}
  finally{lheField('lheEvidenceInput').value='';}
}
async function deleteLheAttachment(uploadId){
  if(!confirm('Hapus file bukti dukung ini dari R2 dan Google Drive?'))return;
  try{lheStatus('Menghapus bukti…');const result=await callServer('deleteLheEvidence',{opdId:lheUi.opdId,year:currentYear,followupId:lheUi.selectedFollowupId,uploadId});await loadLheFollowups();lheStatus(result?.cleanupWarnings?.length?'Bukti dihapus dari daftar, tetapi ada file cadangan yang gagal dibersihkan. Hubungi admin untuk pemeriksaan.':'Bukti dukung dihapus.','success');}catch(err){lheStatus('Gagal menghapus bukti: '+err.message,'error');}
}
function closeLheFollowupModal(){lheField('lheFollowupModal')?.classList.remove('active');lheUi.opdId=null;}
lheField('lheTemplateSelect')?.addEventListener('change',chooseLheTemplate);
lheField('lheExportExcel')?.addEventListener('click',exportLheFollowupsExcel);
lheField('lheDueDate')?.addEventListener('input',()=>{lheUi.templateDueDateAuto=false;});
lheField('lheSaveButton')?.addEventListener('click',saveLheFollowup);
lheField('lheNewButton')?.addEventListener('click',()=>{lheField('lheTemplateSelect').value='';lheField('lheTemplateBaseline')?.remove();lheSetForm({});lheStatus('Form baru siap diisi.','');});
lheField('lheEvidenceChoose')?.addEventListener('click',()=>lheField('lheEvidenceInput')?.click());
lheField('lheEvidenceInput')?.addEventListener('change',uploadLheEvidence);
lheField('lheFollowupRefresh')?.addEventListener('click',loadLheFollowups);
lheField('lheFollowupClose')?.addEventListener('click',closeLheFollowupModal);lheField('lheFollowupCloseFooter')?.addEventListener('click',closeLheFollowupModal);
lheField('lheFollowupList')?.addEventListener('click',async e=>{
  const edit=e.target.closest('.lhe-edit-followup');if(edit){const item=lheUi.items.find(x=>String(x.id)===String(edit.dataset.id));if(item){lheField('lheTemplateSelect').value='';lheField('lheTemplateBaseline')?.remove();lheSetForm(item);renderLheEvidenceList(item.evidence||[]);lheStatus(`Sedang mengedit ${item.recommendation_ref||'butir'}; simpan setelah diperiksa.`);}return;}
  const del=e.target.closest('.lhe-delete-followup');if(del){
    if(!lheCanDelete())return;
    const targetId=String(del.dataset.id||'');
    const target=lheUi.items.find(x=>String(x.id)===targetId);
    const label=target?.recommendation_ref||target?.recommendation||'butir ini';
    if(!confirm(`Hapus ${label} beserta seluruh bukti yang terlampir? Tindakan ini tidak dapat dibatalkan.`))return;
    try{
      lheStatus('Menghapus butir…');
      const result=await callServer('deleteLheFollowup',{opdId:lheUi.opdId,year:currentYear,id:targetId});
      if(String(lheUi.selectedFollowupId)===targetId){lheUi.selectedFollowupId=null;lheUi.editingId=null;lheSetForm({});}
      await loadLheFollowups();
      lheStatus(result?.cleanupWarnings?.length?`Butir ${label} dihapus, tetapi sebagian salinan bukti gagal dibersihkan. Minta admin memeriksa Google Drive/R2.`:`Butir ${label} berhasil dihapus.`,'success');
    }catch(err){lheStatus('Gagal menghapus: '+err.message,'error');}
  }
});
lheField('lheEvidenceList')?.addEventListener('click',async e=>{
  const retry=e.target.closest('.lhe-evidence-retry');
  if(retry){const item=lheUi.items.find(x=>String(x.id)===String(lheUi.selectedFollowupId));if(!item)return;try{lheStatus('Mencoba ulang backup Google Drive…');const d=await callServerWithRetry('retryDriveBackup',{opdId:lheUi.opdId,followupId:item.id,uploadId:retry.dataset.uploadId,type:'lhe',year:currentYear},2);await loadLheFollowups();lheStatus(d.syncStatus==='done'?'Backup Google Drive berhasil.':'Backup selesai diproses.','success');}catch(err){lheStatus('Retry Google Drive gagal: '+err.message,'error');}return;}
  const b=e.target.closest('.lhe-evidence-delete');if(b)deleteLheAttachment(b.dataset.uploadId);
});

// ====== PREVIEW FILE PRIVAT DI BROWSER ======
const evidencePreviewUi={objectUrl:null,activeTab:'preview',fileName:'',fileType:'',size:0,previewHtml:'',viewerProvider:''};
function closeEvidencePreview(){const modal=document.getElementById('evidencePreviewModal');if(modal)modal.classList.remove('active');if(evidencePreviewUi.objectUrl){URL.revokeObjectURL(evidencePreviewUi.objectUrl);evidencePreviewUi.objectUrl=null;}evidencePreviewUi.previewHtml='';evidencePreviewUi.viewerProvider='';const body=document.getElementById('evidencePreviewBody');if(body){body.replaceChildren();delete body.dataset.rendered;}}
function evidencePreviewSetTab(tab){evidencePreviewUi.activeTab=tab;document.querySelectorAll('[data-preview-tab]').forEach(b=>b.classList.toggle('active',b.dataset.previewTab===tab));const body=document.getElementById('evidencePreviewBody');if(!body)return;if(tab==='details'){body.innerHTML=`<dl class="preview-file-details"><dt>Nama file</dt><dd>${escapeHtml(evidencePreviewUi.fileName)}</dd><dt>Jenis file</dt><dd>${escapeHtml(evidencePreviewUi.fileType||'Tidak diketahui')}</dd><dt>Ukuran</dt><dd>${(Number(evidencePreviewUi.size||0)/1024).toLocaleString('id-ID',{maximumFractionDigits:1})} KB</dd><dt>Sumber preview</dt><dd>${escapeHtml(evidencePreviewUi.viewerProvider||'Pratinjau privat dari penyimpanan aplikasi')}</dd></dl>`;return;}if(evidencePreviewUi.previewHtml){body.innerHTML=evidencePreviewUi.previewHtml;body.dataset.rendered='1';}else{body.dataset.rendered='0';body.innerHTML='<div class="preview-file-placeholder">Memuat pratinjau…</div>';}}
async function openEvidencePreview(info){
  const modal=document.getElementById('evidencePreviewModal'),body=document.getElementById('evidencePreviewBody');if(!modal||!body)return;
  if(evidencePreviewUi.objectUrl){URL.revokeObjectURL(evidencePreviewUi.objectUrl);evidencePreviewUi.objectUrl=null;}
  evidencePreviewUi.fileName=String(info.fileName||'Evidence');evidencePreviewUi.fileType=String(info.fileType||'application/octet-stream');evidencePreviewUi.size=0;evidencePreviewUi.activeTab='preview';evidencePreviewUi.previewHtml='';evidencePreviewUi.viewerProvider='Pratinjau privat dari penyimpanan aplikasi';
  document.getElementById('evidencePreviewTitle').textContent=`Pratinjau File · ${evidencePreviewUi.fileName}`;modal.classList.add('active');document.querySelectorAll('[data-preview-tab]').forEach(b=>b.classList.toggle('active',b.dataset.previewTab==='preview'));body.dataset.rendered='0';body.innerHTML='<div class="preview-file-placeholder">⏳ Mengambil file privat…</div>';
  try{
    const name=evidencePreviewUi.fileName,ext=(name.split('.').pop()||'').toLowerCase(),type=evidencePreviewUi.fileType.toLowerCase();
    const officeExt=['doc','docx','xls','xlsx','ppt','pptx'];
    const openDocumentExt=['odt','ods','odp','rtf'];
    if(officeExt.includes(ext)||openDocumentExt.includes(ext)){
      const link=await callServerWithRetry('createEvidencePreviewLink',{opdId:info.opdId,uploadId:info.uploadId,year:currentYear},1);
      const isOffice=officeExt.includes(ext);const viewerUrl=isOffice?`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(link.url)}`:`https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(link.url)}`;
      evidencePreviewUi.viewerProvider=isOffice?'Microsoft Office Online Viewer (tautan privat sementara, 10 menit)':'Google Docs Viewer (tautan privat sementara, 10 menit)';
      evidencePreviewUi.previewHtml=`<div class="preview-external-notice"><b>Pratinjau ${isOffice?'Microsoft Office Online':'Google Docs Viewer'}</b><p>Dokumen dibaca oleh layanan viewer pihak ketiga melalui tautan bertanda tangan yang kedaluwarsa otomatis dalam 10 menit. Gunakan hanya untuk dokumen yang boleh diproses oleh layanan tersebut; jangan bagikan URL pratinjau.</p></div><iframe title="Pratinjau ${escapeHtml(name)}" class="evidence-preview-frame" src="${viewerUrl}" referrerpolicy="no-referrer" allowfullscreen sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"></iframe>`;
      body.innerHTML=evidencePreviewUi.previewHtml;body.dataset.rendered='1';evidencePreviewUi.size=0;return;
    }
    const q=new URLSearchParams({action:'previewEvidence',year:String(currentYear),opdId:String(info.opdId),uploadId:String(info.uploadId)});
    const response=await fetch(`/myCloudinaryHandler?${q.toString()}`,{method:'GET',cache:'no-store',credentials:'same-origin',headers:{'Cache-Control':'no-cache'}});
    if(!response.ok){const msg=await response.text();throw new Error(msg.slice(0,240)||`HTTP ${response.status}`);}
    const blob=await response.blob();evidencePreviewUi.size=blob.size;evidencePreviewUi.fileType=blob.type||evidencePreviewUi.fileType;
    const blobUrl=URL.createObjectURL(blob);evidencePreviewUi.objectUrl=blobUrl;
    if(type==='application/pdf'||ext==='pdf'){evidencePreviewUi.viewerProvider='Pratinjau PDF lokal di browser';body.innerHTML=`<iframe title="Pratinjau PDF ${escapeHtml(name)}" class="evidence-preview-frame" src="${blobUrl}#toolbar=0&navpanes=0" referrerpolicy="no-referrer"></iframe>`;}
    else if(type.startsWith('image/')||['png','jpg','jpeg','gif','webp','bmp','avif'].includes(ext)){evidencePreviewUi.viewerProvider='Pratinjau gambar lokal di browser';body.innerHTML=`<div class="evidence-preview-image-wrap"><img src="${blobUrl}" alt="${escapeHtml(name)}" class="evidence-preview-image"></div>`;}
    else if(type.startsWith('video/')||['mp4','webm','mov','m4v','ogv'].includes(ext)){evidencePreviewUi.viewerProvider='Pemutar video browser';body.innerHTML=`<video controls playsinline class="evidence-preview-media" src="${blobUrl}">Browser tidak mendukung video ini.</video>`;}
    else if(type.startsWith('audio/')||['mp3','wav','ogg','m4a','aac'].includes(ext)){evidencePreviewUi.viewerProvider='Pemutar audio browser';body.innerHTML=`<audio controls class="evidence-preview-audio" src="${blobUrl}">Browser tidak mendukung audio ini.</audio>`;}
    else if(['txt','csv','json','xml','log','md','html','htm','svg','yaml','yml','ini','rtf'].includes(ext)||type.startsWith('text/')){evidencePreviewUi.viewerProvider='Pratinjau teks lokal (tidak dieksekusi)';const text=await blob.text();const pre=document.createElement('pre');pre.className='evidence-preview-text';pre.textContent=text.slice(0,2_000_000);body.replaceChildren(pre);if(text.length>2_000_000){const note=document.createElement('p');note.textContent='Pratinjau dibatasi sampai 2 MB teks.';body.append(note);}}
    else body.innerHTML=`<div class="preview-file-placeholder"><h4>Format ini tidak dapat dirender aman secara langsung.</h4><p>Jenis: ${escapeHtml(evidencePreviewUi.fileType)}. Untuk menjaga keamanan file aplikasi, format aktif atau tidak dikenal tidak dieksekusi di dalam website.</p><p>Gunakan aplikasi pembuka resmi untuk format ini atau unggah ulang sebagai PDF jika diperlukan.</p></div>`;
    evidencePreviewUi.previewHtml=body.innerHTML;body.dataset.rendered='1';
  }catch(err){body.innerHTML=`<div class="preview-file-placeholder is-error"><b>Pratinjau gagal dimuat</b><p>${escapeHtml(err.message||String(err))}</p><p>Periksa sesi login, cakupan OPD, dan konfigurasi secret pratinjau/Google OAuth untuk file Office.</p></div>`;evidencePreviewUi.previewHtml=body.innerHTML;body.dataset.rendered='1';}
}
document.getElementById('evidencePreviewClose')?.addEventListener('click',closeEvidencePreview);document.getElementById('evidencePreviewCloseFooter')?.addEventListener('click',closeEvidencePreview);document.querySelectorAll('[data-preview-tab]').forEach(b=>b.addEventListener('click',()=>evidencePreviewSetTab(b.dataset.previewTab)));document.getElementById('evidencePreviewModal')?.addEventListener('click',e=>{if(e.target.id==='evidencePreviewModal')closeEvidencePreview();});

// ====== ALUR VERIFIKASI BERTAHAP: AUDITOR / PPUPD → IRBAN → BPKP ======
const workflowUi={opdId:null,uploadId:null,fileName:'Evidence',data:null};
const workflowStageLabels={auditor:'Auditor / PPUPD (input/pengiriman)',irban:'Irban (verifikator)',bpkp:'BPKP (verifikator akhir)'};
function workflowDate(value){if(!value)return '—';try{return new Date(Number(value)).toLocaleString('id-ID');}catch{return '—';}}
function workflowStatusLabel(status){return ({menunggu:'Menunggu',dikirim:'Dikirim Auditor / PPUPD',diterima:'Diterima',diterima_catatan:'Diterima dengan Catatan',dikembalikan:'Dikembalikan'})[status]||status||'Menunggu';}
function workflowSetStatus(message,type=''){const el=document.getElementById('evidenceWorkflowStatus');if(!el)return;el.textContent=message||'';el.className='sheet-links-status'+(type?' '+type:'');el.style.display=message?'block':'none';}
function workflowCanSubmit(stage,data){
  const role=String(currentUser?.role||'');const roleStage=role==='ppupd'?'auditor':role;if(role!=='admin'&&roleStage!==stage)return false;
  const stages=data?.stages||{};
  if(stage==='irban'&&stages.auditor?.status!=='dikirim')return false;
  if(stage==='bpkp'&&!['diterima','diterima_catatan'].includes(stages.irban?.status))return false;
  return true;
}
function renderWorkflowStageCards(data){
  const root=document.getElementById('evidenceWorkflowStages');if(!root)return;
  root.innerHTML=['auditor','irban','bpkp'].map(stage=>{
    const item=data?.stages?.[stage]||{status:'menunggu'};
    const good=item.status==='diterima'||item.status==='dikirim';
    const color=item.status==='dikembalikan'?'#b91c1c':good?'#166534':'#64748b';
    return `<div class="workflow-stage-card"><div><div class="workflow-stage-title">${workflowStageLabels[stage]}</div><div class="workflow-stage-status" style="color:${color};">${sheetLinksEsc(workflowStatusLabel(item.status))}</div></div><div><div style="font-size:12px;color:#475569;">Pemeriksa: ${sheetLinksEsc(item.examinerName||'—')} · ${sheetLinksEsc(workflowDate(item.updatedAt))}</div><p>${sheetLinksEsc(item.note||'Belum ada catatan.')}</p></div></div>`;
  }).join('');
  const history=document.getElementById('evidenceWorkflowHistory');const events=Array.isArray(data?.history)?data.history:[];
  history.innerHTML=events.length?events.map(item=>`<div class="sheet-link-card" style="margin:6px 0;"><b>${sheetLinksEsc(workflowStageLabels[item.stage]||item.stage)}</b> · ${sheetLinksEsc(workflowStatusLabel(item.status))}<div style="font-size:11px;color:#64748b;margin-top:4px;">${sheetLinksEsc(item.examiner_name||item.updated_by||'')} · ${sheetLinksEsc(workflowDate(item.created_at))}</div><div style="font-size:12px;margin-top:5px;white-space:pre-wrap;">${sheetLinksEsc(item.note||'')}</div></div>`).join(''):'<div class="sheet-link-card">Belum ada riwayat verifikasi.</div>';
  workflowUpdateForm();
}
function workflowUpdateForm(){
  const stageEl=document.getElementById('workflowStageSelect'),statusEl=document.getElementById('workflowStatusSelect'),save=document.getElementById('workflowSaveButton');if(!stageEl||!statusEl||!save)return;
  const role=String(currentUser?.role||'');if(role!=='admin'&&['auditor','ppupd','irban','bpkp'].includes(role))stageEl.value=role==='ppupd'?'auditor':role;
  stageEl.disabled=role!=='admin';
  const stage=stageEl.value;const data=workflowUi.data||{};const statuses=stage==='auditor'?[['dikirim','Kirim ke Irban']]:[['diterima','Diterima'],['diterima_catatan','Diterima dengan Catatan'],['dikembalikan','Dikembalikan / perlu perbaikan']];
  statusEl.innerHTML=statuses.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
  const can=workflowCanSubmit(stage,data);const ready=!['dikembalikan','diterima_catatan'].includes(statusEl.value)||document.getElementById('workflowNote').value.trim().length>=2;
  save.disabled=!can||!ready;save.title=!can?'Role belum sesuai atau tahap sebelumnya belum disetujui':'';
  const me=document.getElementById('workflowExaminer');if(me&&!me.value)me.value=currentUser?.displayName||currentUser?.username||'';
}
async function openEvidenceWorkflowModal(info){
  workflowUi.opdId=String(info.opdId||'');workflowUi.uploadId=String(info.uploadId||'');workflowUi.fileName=String(info.fileName||'Evidence');workflowUi.data=null;
  document.getElementById('evidenceWorkflowFileName').textContent=workflowUi.fileName;
  document.getElementById('workflowExaminer').value=currentUser?.displayName||currentUser?.username||'';document.getElementById('workflowNote').value='';
  const modal=document.getElementById('evidenceWorkflowModal');modal.classList.add('active');workflowSetStatus('Memuat alur verifikasi…');
  try{const data=await callServer('getEvidenceWorkflow',{opdId:workflowUi.opdId,uploadId:workflowUi.uploadId,year:currentYear});workflowUi.data=data;renderWorkflowStageCards(data);workflowSetStatus('Tahapan dan riwayat verifikasi dimuat.','success');}
  catch(err){workflowSetStatus('Gagal memuat alur verifikasi: '+err.message,'error');}
}
async function saveEvidenceWorkflowStep(){
  const stage=document.getElementById('workflowStageSelect').value,status=document.getElementById('workflowStatusSelect').value,note=document.getElementById('workflowNote').value.trim(),examinerName=document.getElementById('workflowExaminer').value.trim();
  if(['dikembalikan','diterima_catatan'].includes(status)&&note.length<2){workflowSetStatus('Catatan wajib diisi untuk Diterima dengan Catatan atau Dikembalikan.','error');return;}
  try{document.getElementById('workflowSaveButton').disabled=true;workflowSetStatus('Menyimpan tahap verifikasi…');await callServer('saveEvidenceWorkflowStep',{opdId:workflowUi.opdId,uploadId:workflowUi.uploadId,year:currentYear,stage,status,note,examinerName});await openEvidenceWorkflowModal(workflowUi);workflowSetStatus('Tahap verifikasi tersimpan dan dicatat pada audit trail.','success');}
  catch(err){workflowSetStatus('Verifikasi gagal: '+err.message,'error');}
  finally{workflowUpdateForm();}
}
document.getElementById('workflowStageSelect')?.addEventListener('change',workflowUpdateForm);
document.getElementById('workflowStatusSelect')?.addEventListener('change',workflowUpdateForm);
document.getElementById('workflowNote')?.addEventListener('input',workflowUpdateForm);
document.getElementById('workflowSaveButton')?.addEventListener('click',saveEvidenceWorkflowStep);
document.getElementById('evidenceWorkflowRefresh')?.addEventListener('click',()=>openEvidenceWorkflowModal(workflowUi));
function closeEvidenceWorkflowModal(){document.getElementById('evidenceWorkflowModal')?.classList.remove('active');}
document.getElementById('evidenceWorkflowClose')?.addEventListener('click',closeEvidenceWorkflowModal);document.getElementById('evidenceWorkflowCloseFooter')?.addEventListener('click',closeEvidenceWorkflowModal);


// ====== KERTAS KERJA PEMDA MAHAKAM ULU: SAMPLING + VERIFIKASI 3 TAHAP ======
const pemdaWorkflowUi={rows:[],permissions:{},selectedOpdId:'',loading:false,saving:false,search:''};
const pemdaStatusLabels={
  pm:{belum:'Belum PM',dalam_proses:'Dalam proses PM',selesai:'PM selesai',perlu_perbaikan:'Perlu perbaikan'},
  qa:{belum:'Belum QA',dalam_proses:'Dalam proses QA',diterima:'QA diterima',diterima_catatan:'Diterima dengan catatan',dikembalikan:'Dikembalikan'},
  bpkp:{belum:'Belum diverifikasi',dalam_proses:'Dalam proses BPKP',diterima:'Diterima BPKP',diterima_catatan:'Diterima dengan catatan',dikembalikan:'Dikembalikan BPKP'}
};
function pemdaText(value){return escapeHtml(String(value??''));}
function pemdaStageBadge(stage,status){const s=String(status||'belum');const label=pemdaStatusLabels[stage]?.[s]||s;const cls=['selesai','diterima'].includes(s)?'done':['diterima_catatan','dalam_proses'].includes(s)?'progress':['perlu_perbaikan','dikembalikan'].includes(s)?'returned':'pending';const icon=cls==='done'?'✓':cls==='progress'?'◷':cls==='returned'?'!':'○';return `<span class="pemda-status-badge ${cls}"><i>${icon}</i>${pemdaText(label)}</span>`;}
function pemdaDate(value){const n=Number(value||0);return n?new Date(n).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'Belum ada catatan';}
function pemdaWorkflowSetStatus(message,type=''){const el=document.getElementById('pemdaWorkflowStatus');if(!el)return;el.textContent=message||'';el.className='sheet-links-status'+(type?' '+type:'');el.style.display=message?'block':'none';}
function pemdaWorkflowCanShowEditor(){return !!(pemdaWorkflowUi.permissions.canPm||pemdaWorkflowUi.permissions.canQa||pemdaWorkflowUi.permissions.canBpkp||currentUser?.role==='admin');}
function renderPemdaWorkflowSummary(){const box=document.getElementById('pemdaWorkflowSummary');if(!box)return;const a=pemdaWorkflowUi.rows||[];const selected=a.filter(r=>r.isSample).length;const pm=a.filter(r=>r.pm?.status==='selesai').length;const qa=a.filter(r=>['diterima','diterima_catatan'].includes(r.qa?.status)).length;const bpkp=a.filter(r=>r.isSample&&['diterima','diterima_catatan'].includes(r.bpkp?.status)).length;const stats=[['Total OPD',a.length,'data OPD pada tahun terpilih'],['OPD Sampel',selected,'ditetapkan Inspektorat'],['PM Internal Selesai',pm,'Verifikasi tahap 1'],['QA Selesai',qa,'Verifikasi tahap 2'],['BPKP Selesai',bpkp,'sampel tahap 3']];box.innerHTML=stats.map(x=>`<div class="pemda-summary-card"><span>${pemdaText(x[0])}</span><strong>${x[1]}</strong><small>${pemdaText(x[2])}</small></div>`).join('');}
function renderPemdaWorkflowTable(){
  const tbody=document.getElementById('pemdaWorkflowTableBody');if(!tbody)return;
  const rows=(pemdaWorkflowUi.rows||[]).filter(r=>String(r.opd||'').toLowerCase().includes(String(pemdaWorkflowUi.search||'').toLowerCase()));
  if(!rows.length){tbody.innerHTML=`<tr><td colspan="8" class="pemda-table-empty">${pemdaWorkflowUi.rows.length?'Tidak ada OPD yang cocok dengan pencarian.':'Belum ada data OPD untuk tahun ini.'}</td></tr>`;renderPemdaWorkflowSummary();return;}
  tbody.innerHTML=rows.map((r,i)=>{
    const draft=!!r.draftIsSample,reason=String(r.draftSampleReason??'');
    const sampleDisabled=!pemdaWorkflowUi.permissions.canChooseSample||pemdaWorkflowUi.saving;
    const samplingChanged=draft!==!!r.isSample||reason!==String(r.sampleReason||'');
    const sourceStatus=String(r.sourceAssessmentStatus||'Belum Mengisi');
    const completeness=`${r.hasWorkbook?'✓ Workbook PM':'○ Workbook PM belum tertaut'} · ${Number(r.pmReportCount||0)} laporan · ${Number(r.evidenceCount||0)} evidence`;
    const selectedMark=r.isSample?'<span class="pemda-sample-pill yes">OPD sampel</span>':'<span class="pemda-sample-pill no">Bukan sampel</span>';
    const locked=r.bpkp?.status&&r.bpkp.status!=='belum';
    return `<tr data-pemda-opd="${pemdaText(r.opdId)}" class="${r.isSample?'is-sample':''}">
      <td class="pemda-num">${i+1}</td>
      <td><div class="pemda-opd-name">${pemdaText(r.opd)}</div><div class="pemda-opd-meta">Status pengisian: ${pemdaText(sourceStatus)}<br>${pemdaText(completeness)}</div>${selectedMark}</td>
      <td>${pemdaStageBadge('pm',r.pm?.status)}${r.pm?.updatedAt?`<small class="pemda-stage-meta">${pemdaText(r.pm.examiner||r.pm.updatedBy)} · ${pemdaText(pemdaDate(r.pm.updatedAt))}</small>`:''}</td>
      <td>${pemdaStageBadge('qa',r.qa?.status)}${r.qa?.updatedAt?`<small class="pemda-stage-meta">${pemdaText(r.qa.examiner||r.qa.updatedBy)} · ${pemdaText(pemdaDate(r.qa.updatedAt))}</small>`:''}</td>
      <td><label class="pemda-sample-toggle"><input type="checkbox" data-pemda-sample="${pemdaText(r.opdId)}" ${draft?'checked':''} ${sampleDisabled?'disabled':''} aria-label="Jadikan ${pemdaText(r.opd)} sampel"><span></span><b>${draft?'Ya':'Tidak'}</b></label>${locked?'<small class="pemda-stage-meta">BPKP sudah memproses</small>':''}</td>
      <td><div class="pemda-sample-reason-wrap"><textarea data-pemda-reason="${pemdaText(r.opdId)}" rows="2" maxlength="1000" placeholder="Dasar pemilihan sampel..." ${sampleDisabled?'disabled':''}>${pemdaText(reason)}</textarea>${samplingChanged&&pemdaWorkflowUi.permissions.canChooseSample?'<small class="pemda-changed-note">Belum tersimpan</small>':''}</div></td>
      <td>${r.isSample?pemdaStageBadge('bpkp',r.bpkp?.status):'<span class="pemda-status-badge not-applicable"><i>—</i>Tidak menjadi sampel</span>'}${r.isSample&&r.bpkp?.updatedAt?`<small class="pemda-stage-meta">${pemdaText(r.bpkp.examiner||r.bpkp.updatedBy)} · ${pemdaText(pemdaDate(r.bpkp.updatedAt))}</small>`:''}${r.isSample&&!r.readyForBpkp&&r.bpkp?.status==='belum'?'<small class="pemda-stage-meta">Menunggu PM dan QA selesai</small>':''}</td>
      <td><button type="button" class="pemda-row-detail" data-pemda-detail="${pemdaText(r.opdId)}">${pemdaWorkflowCanShowEditor()?'📝 Detail / Verifikasi':'📜 Riwayat'}</button></td>
    </tr>`;
  }).join('');
  renderPemdaWorkflowSummary();
}
async function loadPemdaWorkflow(showStatus=true){
  if(pemdaWorkflowUi.loading)return;const modal=document.getElementById('pemdaWorkflowModal');if(!modal)return;
  pemdaWorkflowUi.loading=true;const refresh=document.getElementById('pemdaWorkflowRefresh');if(refresh)refresh.disabled=true;
  if(showStatus)pemdaWorkflowSetStatus('Memuat kertas kerja Pemda dan status verifikasi dari database pusat...');
  try{
    const res=await callServer('getPemdaWorkflow',{year:currentYear});
    pemdaWorkflowUi.permissions=res.permissions||{};
    const previous=new Map((pemdaWorkflowUi.rows||[]).map(r=>[String(r.opdId),r]));
    pemdaWorkflowUi.rows=(Array.isArray(res.rows)?res.rows:[]).map(r=>{
      const p=previous.get(String(r.opdId));
      const hasUnsaved=p&&(p.draftIsSample!==p.isSample||p.draftSampleReason!==p.sampleReason);
      return {...r,draftIsSample:hasUnsaved?p.draftIsSample:!!r.isSample,draftSampleReason:hasUnsaved?p.draftSampleReason:String(r.sampleReason||'')};
    });
    const yr=document.getElementById('pemdaWorkflowYear');if(yr)yr.textContent=`Tahun ${currentYear}`;
    const saveBtn=document.getElementById('pemdaWorkflowSaveSampling');if(saveBtn){saveBtn.style.display=pemdaWorkflowUi.permissions.canChooseSample?'inline-flex':'none';saveBtn.disabled=pemdaWorkflowUi.saving;}
    const note=document.getElementById('pemdaWorkflowFooterNote');if(note)note.textContent=pemdaWorkflowUi.permissions.canChooseSample?'Pilih OPD sampel dan isi dasar pemilihannya, lalu simpan.':'Pemilihan sampel hanya untuk Irban/Super Admin; verifikasi tiap tahap mengikuti peran akun.';
    renderPemdaWorkflowTable();if(showStatus)pemdaWorkflowSetStatus('Data berhasil dimuat. Tahapan tiap OPD ditampilkan terpisah dan mengikuti hak akses akun.','success');
    if(pemdaWorkflowUi.selectedOpdId){const current=pemdaWorkflowUi.rows.find(r=>String(r.opdId)===String(pemdaWorkflowUi.selectedOpdId));if(current)renderPemdaWorkflowEditor(current);else closePemdaWorkflowEditor();}
  }catch(err){pemdaWorkflowSetStatus('Gagal memuat Kertas Kerja Pemda: '+(err?.message||err),'error');}
  finally{pemdaWorkflowUi.loading=false;if(refresh)refresh.disabled=false;}
}
function pemdaSelectOptions(stage,current){const options=stage==='pm'?[['belum','Belum PM'],['dalam_proses','Dalam proses PM'],['selesai','PM selesai'],['perlu_perbaikan','Perlu perbaikan']]:[['belum',stage==='qa'?'Belum QA':'Belum diverifikasi'],['dalam_proses',stage==='qa'?'Dalam proses QA':'Dalam proses BPKP'],['diterima',stage==='qa'?'QA diterima':'Diterima'],['diterima_catatan','Diterima dengan catatan'],['dikembalikan',stage==='qa'?'Dikembalikan / perlu perbaikan':'Dikembalikan / perlu perbaikan']];return options.map(([v,l])=>`<option value="${v}" ${String(current||'belum')===v?'selected':''}>${pemdaText(l)}</option>`).join('');}
function renderPemdaWorkflowEditor(r){
  const editor=document.getElementById('pemdaWorkflowEditor'),forms=document.getElementById('pemdaWorkflowStageForms');if(!editor||!forms)return;
  pemdaWorkflowUi.selectedOpdId=String(r.opdId);editor.hidden=false;
  document.getElementById('pemdaWorkflowEditorTitle').textContent=`Detail Verifikasi — ${r.opd}`;
  document.getElementById('pemdaWorkflowEditorMeta').textContent=`Tahun ${currentYear} · Status PM pengisian saat ini: ${r.sourceAssessmentStatus} · Versi data ${r.version}`;
  const perms=pemdaWorkflowUi.permissions,sections=[];
  const makeForm=(stage,label,desc,canSave)=>{
    const d=r[stage]||{status:'belum',examiner:'',note:'',updatedAt:0};
    const prerequisite=stage==='qa'&&r.pm?.status!=='selesai'?'Verif 1 belum selesai. Asesor OPD harus menandai PM internal selesai.':stage==='bpkp'&&!r.isSample?'OPD belum dipilih sebagai sampel.':stage==='bpkp'&&!r.readyForBpkp?'Verif BPKP terkunci sampai PM internal selesai dan QA diterima.':'';
    return `<section class="pemda-stage-form ${canSave?'editable':'readonly'}"><div class="pemda-stage-form-head"><div><span class="pemda-stage-number">${stage==='pm'?'1':stage==='qa'?'2':'3'}</span><div><h5>${pemdaText(label)}</h5><p>${pemdaText(desc)}</p></div></div>${pemdaStageBadge(stage,d.status)}</div>
      ${prerequisite?`<div class="pemda-prerequisite">🔒 ${pemdaText(prerequisite)}</div>`:''}
      <div class="pemda-stage-form-grid"><label>Hasil tahap<select data-pemda-stage-status="${stage}" ${canSave?'':'disabled'}>${pemdaSelectOptions(stage,d.status)}</select></label><label>Nama pemeriksa<input data-pemda-stage-examiner="${stage}" maxlength="100" value="${pemdaText(d.examiner||currentUser?.displayName||currentUser?.username||'')}" ${canSave?'':'readonly'}></label></div>
      <label class="pemda-stage-note-label">Catatan / alasan pengembalian<textarea data-pemda-stage-note="${stage}" maxlength="2000" rows="2" placeholder="Wajib diisi jika perlu perbaikan, dikembalikan, atau diterima dengan catatan" ${canSave?'':'readonly'}>${pemdaText(d.note||'')}</textarea></label>
      <div class="pemda-stage-form-footer"><small>${d.updatedAt?`Terakhir diubah ${pemdaText(pemdaDate(d.updatedAt))} · ${pemdaText(d.updatedBy||d.examiner||'')}`:'Belum ada catatan tahap ini.'}</small>${canSave?`<button type="button" data-pemda-stage-save="${stage}" class="primary" ${stage==='qa'&&r.pm?.status!=='selesai'||stage==='bpkp'&&!r.readyForBpkp?'disabled':''}>💾 Simpan Verif ${stage==='pm'?'1':stage==='qa'?'2':'3'}</button>`:''}</div>
    </section>`;
  };
  if(perms.canPm)sections.push(makeForm('pm','PM Internal oleh Asesor OPD','Verif 1: periksa dokumen yang diunggah anggota dan kelengkapan pengisian kertas kerja.',true));
  else sections.push(makeForm('pm','PM Internal oleh Asesor OPD','Verif 1: periksa dokumen yang diunggah anggota dan kelengkapan pengisian kertas kerja.',false));
  if(perms.canQa)sections.push(makeForm('qa','Quality Assurance oleh Auditor / PPUPD','Verif 2: aktif setelah PM internal selesai. Catatan pengembalian wajib jelas.',true));
  else sections.push(makeForm('qa','Quality Assurance oleh Auditor / PPUPD','Verif 2: aktif setelah PM internal selesai. Catatan pengembalian wajib jelas.',false));
  if(perms.canBpkp)sections.push(makeForm('bpkp','Verifikasi BPKP atas PM Pemda','Verif 3: hanya aktif bagi OPD yang dipilih sebagai sampel dan sudah lolos QA.',true));
  else sections.push(makeForm('bpkp','Verifikasi BPKP atas PM Pemda','Verif 3: hanya aktif bagi OPD yang dipilih sebagai sampel dan sudah lolos QA.',false));
  forms.innerHTML=sections.join('');
  const audit=document.getElementById('pemdaWorkflowAudit');if(audit)audit.innerHTML='<p>Memuat riwayat audit...</p>';
  callServer('getPemdaWorkflowAudit',{opdId:r.opdId,year:currentYear}).then(res=>{
    if(String(pemdaWorkflowUi.selectedOpdId)!==String(r.opdId))return;
    const list=Array.isArray(res.entries)?res.entries:[];
    audit.innerHTML=list.length?list.map(e=>`<div class="pemda-audit-row"><span class="pemda-audit-dot"></span><div><b>${pemdaText(({sampling:'Perubahan sampling',pm:'PM internal / Verif 1',qa:'QA Auditor/PPUPD / Verif 2',bpkp:'Verifikasi BPKP / Verif 3','qa-reset':'Reset QA','bpkp-reset':'Reset verifikasi BPKP'})[e.action]||e.action)}</b><small>${pemdaText(e.updatedBy||'Pengguna')} · ${pemdaText(String(e.role||'').toUpperCase())} · ${pemdaText(pemdaDate(e.createdAt))}</small>${e.oldValue||e.newValue?`<p>${pemdaText(e.oldValue)} → ${pemdaText(e.newValue)}</p>`:''}${e.note?`<p>${pemdaText(e.note)}</p>`:''}</div></div>`).join(''):'<p>Belum ada riwayat perubahan.</p>';
  }).catch(err=>{audit.innerHTML=`<p>Riwayat belum dapat dimuat: ${pemdaText(err.message||err)}</p>`;});
}
function closePemdaWorkflowEditor(){pemdaWorkflowUi.selectedOpdId='';const editor=document.getElementById('pemdaWorkflowEditor');if(editor)editor.hidden=true;}
async function savePemdaWorkflowStage(stage,button){
  const row=pemdaWorkflowUi.rows.find(r=>String(r.opdId)===String(pemdaWorkflowUi.selectedOpdId));if(!row)return;
  const status=document.querySelector(`[data-pemda-stage-status="${stage}"]`)?.value||'';
  const examinerName=document.querySelector(`[data-pemda-stage-examiner="${stage}"]`)?.value.trim()||'';
  const note=document.querySelector(`[data-pemda-stage-note="${stage}"]`)?.value.trim()||'';
  if(!examinerName){pemdaWorkflowSetStatus('Nama pemeriksa wajib diisi.','error');return;}
  if(['perlu_perbaikan','diterima_catatan','dikembalikan'].includes(status)&&note.length<2){pemdaWorkflowSetStatus('Catatan wajib diisi untuk status ini.','error');return;}
  if(button)button.disabled=true;pemdaWorkflowSetStatus(`Menyimpan Verifikasi ${stage.toUpperCase()}...`);
  try{await callServerWithRetry('savePemdaVerification',{opdId:row.opdId,year:currentYear,stage,status,examinerName,note,version:row.version},1);pemdaWorkflowSetStatus('Tahap verifikasi tersimpan. Riwayat audit sudah dicatat.','success');await loadPemdaWorkflow(false);}
  catch(err){pemdaWorkflowSetStatus('Verifikasi gagal disimpan: '+(err.message||err),'error');}
  finally{if(button)button.disabled=false;}
}
async function savePemdaSamplingChanges(){
  if(pemdaWorkflowUi.saving)return;const changed=pemdaWorkflowUi.rows.filter(r=>!!r.draftIsSample!==!!r.isSample||String(r.draftSampleReason??'')!==String(r.sampleReason||''));
  if(!changed.length){pemdaWorkflowSetStatus('Tidak ada perubahan pilihan sampling untuk disimpan.','success');return;}
  for(const r of changed){if(r.draftIsSample&&String(r.draftSampleReason||'').trim().length<3){pemdaWorkflowSetStatus(`Dasar/catatan sampling untuk “${r.opd}” wajib diisi minimal 3 karakter.`,'error');return;}}
  pemdaWorkflowUi.saving=true;const btn=document.getElementById('pemdaWorkflowSaveSampling');if(btn){btn.disabled=true;btn.textContent='Menyimpan...';}
  const results=[];let index=0;
  try{
    // Small concurrency window keeps a batch of OPD selections responsive under D1 load.
    const workers=Array.from({length:Math.min(4,changed.length)},async()=>{while(index<changed.length){const r=changed[index++];try{const result=await callServerWithRetry('savePemdaSampling',{opdId:r.opdId,year:currentYear,isSample:!!r.draftIsSample,sampleReason:String(r.draftSampleReason||'').trim(),version:r.version},2);results.push({ok:true,opd:r.opd,result});}catch(err){results.push({ok:false,opd:r.opd,error:err.message||String(err)});}}});
    await Promise.all(workers);
    const ok=results.filter(x=>x.ok).length,failed=results.filter(x=>!x.ok);
    if(failed.length){pemdaWorkflowSetStatus(`${ok} perubahan tersimpan, ${failed.length} gagal. ${failed.slice(0,3).map(x=>x.opd+': '+x.error).join(' | ')} Data dimuat ulang agar status server tetap menjadi sumber utama.`,'error');await loadPemdaWorkflow(false);}
    else{pemdaWorkflowSetStatus(`${ok} perubahan sampling berhasil disimpan beserta catatan audit.`,'success');await loadPemdaWorkflow(false);}
  }finally{pemdaWorkflowUi.saving=false;if(btn){btn.disabled=false;btn.textContent='💾 Simpan Pilihan Sampling';}renderPemdaWorkflowTable();}
}
function openPemdaWorkflow(){const modal=document.getElementById('pemdaWorkflowModal');if(!modal)return;if(!currentUser){alert('Silakan login terlebih dahulu.');return;}modal.classList.add('active');pemdaWorkflowUi.search='';const search=document.getElementById('pemdaWorkflowSearch');if(search)search.value='';closePemdaWorkflowEditor();loadPemdaWorkflow(true);}
function closePemdaWorkflow(){document.getElementById('pemdaWorkflowModal')?.classList.remove('active');closePemdaWorkflowEditor();}
document.getElementById('btnPemdaWorkflow')?.addEventListener('click',openPemdaWorkflow);
document.getElementById('pemdaWorkflowClose')?.addEventListener('click',closePemdaWorkflow);
document.getElementById('pemdaWorkflowCloseFooter')?.addEventListener('click',closePemdaWorkflow);
document.getElementById('pemdaWorkflowRefresh')?.addEventListener('click',()=>loadPemdaWorkflow(true));
document.getElementById('pemdaWorkflowSaveSampling')?.addEventListener('click',savePemdaSamplingChanges);
document.getElementById('pemdaWorkflowEditorClose')?.addEventListener('click',closePemdaWorkflowEditor);
document.getElementById('pemdaWorkflowSearch')?.addEventListener('input',e=>{pemdaWorkflowUi.search=e.target.value||'';renderPemdaWorkflowTable();});
document.getElementById('pemdaWorkflowTableBody')?.addEventListener('change',e=>{
  const sample=e.target.closest('[data-pemda-sample]');if(sample){const row=pemdaWorkflowUi.rows.find(r=>String(r.opdId)===String(sample.dataset.pemdaSample));if(row){row.draftIsSample=sample.checked;renderPemdaWorkflowTable();}return;}
  const reason=e.target.closest('[data-pemda-reason]');if(reason){const row=pemdaWorkflowUi.rows.find(r=>String(r.opdId)===String(reason.dataset.pemdaReason));if(row){row.draftSampleReason=reason.value;renderPemdaWorkflowTable();}}
});
document.getElementById('pemdaWorkflowTableBody')?.addEventListener('input',e=>{
  const reason=e.target.closest('[data-pemda-reason]');if(reason){const row=pemdaWorkflowUi.rows.find(r=>String(r.opdId)===String(reason.dataset.pemdaReason));if(row)row.draftSampleReason=reason.value;}
});
document.getElementById('pemdaWorkflowTableBody')?.addEventListener('click',e=>{const btn=e.target.closest('[data-pemda-detail]');if(!btn)return;const row=pemdaWorkflowUi.rows.find(r=>String(r.opdId)===String(btn.dataset.pemdaDetail));if(row)renderPemdaWorkflowEditor(row);});
document.getElementById('pemdaWorkflowStageForms')?.addEventListener('click',e=>{const btn=e.target.closest('[data-pemda-stage-save]');if(btn)savePemdaWorkflowStage(btn.dataset.pemdaStageSave,btn);});
document.addEventListener('click',event=>{if(event.target===document.getElementById('pemdaWorkflowModal'))closePemdaWorkflow();});

// ====== DASHBOARD KK PM SPIP KHUSUS PEMDA (terpisah dari setiap workbook OPD) ======
const pemdaPmDash={loading:false,creating:false,workflow:[],workbook:null,sheets:[],manifest:[],permissions:{canManage:false},templateConfig:null,evidenceFiles:[],evidenceSummary:{total:0,verified:0,returned:0,byTarget:{}},evidenceError:'',lastLoadedAt:0};
let pemdaPmManifestPromise=null;
function pemdaPmDashStatus(message,state=''){const el=document.getElementById('pemdaPmDashboardStatus');if(!el)return;el.textContent=message;el.className='sheet-links-status'+(state?' '+state:'');}
function pemdaPmScore(value){return value===null||value===undefined||value===''||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});}
function pemdaPmScoreCell(value){return value===null||value===undefined||value===''||!Number.isFinite(Number(value))?'<span class="pemda-pm-score-empty">—</span>':`<b>${escapeHtml(pemdaPmScore(value))}</b>`;}
function pemdaPmStatusLabel(stage,status){const map={belum:'Belum',dalam_proses:stage==='pm'?'Dalam proses PM':stage==='qa'?'Dalam proses QA':'Dalam proses BPKP',selesai:'Selesai',diterima:'Diterima',diterima_catatan:'Diterima + catatan',perlu_perbaikan:'Perlu perbaikan',dikembalikan:'Dikembalikan'};return map[String(status||'belum')]||String(status||'Belum');}
function pemdaPmStageClass(status){return ['selesai','diterima','diterima_catatan'].includes(String(status||''))?'done':['dalam_proses'].includes(String(status||''))?'progress':['perlu_perbaikan','dikembalikan'].includes(String(status||''))?'warning':'pending';}
function renderPemdaPmDashboard(){
  const rows=Array.isArray(pemdaPmDash.workflow)?pemdaPmDash.workflow:[];const samples=rows.filter(r=>r.isSample);const wb=pemdaPmDash.workbook||{};const canManage=!!pemdaPmDash.permissions.canManage;
  const templatePanel=document.getElementById('pemdaPmTemplateAdminPanel');if(templatePanel)templatePanel.hidden=!['admin','irban'].includes(pemdaPmRole());
  const evidencePanel=document.getElementById('pemdaPmEvidencePanel');if(evidencePanel)evidencePanel.hidden=!['admin','irban','auditor','ppupd','bpkp'].includes(pemdaPmRole());
  const pmDone=samples.filter(r=>r.pm?.status==='selesai').length;const qaDone=samples.filter(r=>['diterima','diterima_catatan'].includes(r.qa?.status)).length;const bpkpDone=samples.filter(r=>['diterima','diterima_catatan'].includes(r.bpkp?.status)).length;
  const stats=[['OPD dalam cakupan',rows.length,'Data OPD yang dapat diakses akun'],['OPD Sampling Terpilih',samples.length,'Sumber: pilihan sampling tersimpan'],['PM Internal Selesai',pmDone,'Tahap 1 untuk OPD sampling'],['QA Diterima',qaDone,'Tahap 2 untuk OPD sampling'],['BPKP Selesai',bpkpDone,'Tahap 3 untuk OPD sampling']];
  const summary=document.getElementById('pemdaPmDashboardSummary');if(summary)summary.innerHTML=stats.map(x=>`<div class="pemda-pm-stat-card"><span>${escapeHtml(x[0])}</span><strong>${x[1].toLocaleString('id-ID')}</strong><small>${escapeHtml(x[2])}</small></div>`).join('');
  const name=document.getElementById('pemdaPmWorkbookName'),meta=document.getElementById('pemdaPmWorkbookMeta'),notice=document.getElementById('pemdaPmWorkbookNotice');
  const createBtn=document.getElementById('pemdaPmWorkbookCreate'),syncBtn=document.getElementById('pemdaPmWorkbookSync'),openBtn=document.getElementById('pemdaPmWorkbookOpen');
  const exists=!!(wb.workbookSpreadsheetId||wb.workbookUrl);if(name)name.textContent=exists?(wb.workbookName||`PEMERINTAH KABUPATEN MAHAKAM ULU - KK PM SPIP - ${currentYear}`):'KK PM SPIP Pemda belum dibuat';
  if(meta)meta.textContent=exists?`Tahun ${currentYear} · Terakhir disimpan ${pemdaDate(wb.updatedAt||0)}${wb.updatedBy?` oleh ${wb.updatedBy}`:''} · workbook Pemda tersendiri`:`Tahun ${currentYear} · Master template tersedia melalui konfigurasi Google Sheets PM pada server.`;
  if(notice){notice.className='pemda-pm-workbook-notice'+(pemdaPmDash.workbook?.needsSync?' warning':'');notice.textContent=exists?(pemdaPmDash.workbook.needsSync?`⚠️ Workbook saat ini perlu diverifikasi/disinkronkan: ${pemdaPmDash.workbook.needsSyncReason||'revisi master berubah'}. File lama tidak akan dihapus.`:`✅ Workbook aktif tersambung dan telah tervalidasi sebagai master PM_2026 (26 tab inti; tab tambahan diperbolehkan). Isian dilakukan pada Google Spreadsheet khusus Pemda; data workbook OPD tidak ditimpa.`):'Belum ada salinan workbook Pemda pada database. Klik “Buat dari Master” untuk membuat workbook mandiri dari template resmi.';}
  if(createBtn){createBtn.hidden=exists||!canManage;createBtn.disabled=pemdaPmDash.creating;createBtn.textContent=pemdaPmDash.creating?'Membuat...':'＋ Buat dari Master';}
  if(syncBtn){syncBtn.hidden=!exists||!pemdaPmDash.workbook?.needsSync||!canManage;syncBtn.disabled=pemdaPmDash.creating;}
  if(openBtn){openBtn.hidden=!exists||!!pemdaPmDash.workbook?.needsSync;openBtn.disabled=pemdaPmDash.creating;}
  const liveSheets=Array.isArray(pemdaPmDash.sheets)?pemdaPmDash.sheets:[];const fallback=Array.isArray(pemdaPmDash.manifest)?pemdaPmDash.manifest:[];const sheetRows=liveSheets.length?liveSheets.map((x,i)=>({sheetName:x.title||x.sheetName||`Sheet ${i+1}`,sheetId:x.sheetId,order:Number(x.index??i)+1,rowCount:x.rowCount,columnCount:x.columnCount,live:true})):fallback.map((x,i)=>({sheetName:x.sheetName||x.title||'',sheetId:null,order:Number(x.order||i+1),rowCount:x.dimension||'',columnCount:'',live:false})).filter(x=>x.sheetName);
  const list=document.getElementById('pemdaPmSheetList'),count=document.getElementById('pemdaPmSheetCount');if(count)count.textContent=`${liveSheets.length||26} sheet ${liveSheets.length?'terbaca dari workbook aktif':'mengikuti manifest master'}`;
  if(list)list.innerHTML=sheetRows.length?sheetRows.map(x=>`<button type="button" class="pemda-pm-sheet-card ${x.live&&exists&&!pemdaPmDash.workbook?.needsSync?'available':'preview'}" data-pemda-pm-sheet="${escapeHtml(String(x.sheetName))}" ${x.live&&exists&&!pemdaPmDash.workbook?.needsSync?'':'disabled'}><span class="pemda-pm-sheet-order">${x.order}</span><span class="pemda-pm-sheet-text"><b>${escapeHtml(x.sheetName)}</b><small>${x.live?`${Number(x.rowCount||0).toLocaleString('id-ID')} baris · ${Number(x.columnCount||0)} kolom · workbook aktif`:'Struktur dari manifest template master'}</small></span><span class="pemda-pm-sheet-action">${x.live&&exists&&!pemdaPmDash.workbook?.needsSync?'Buka ↗':'Pratinjau'}</span></button>`).join(''):'<div class="pemda-pm-empty">Manifest sheet master belum dapat dimuat. Pembuatan workbook tetap akan divalidasi pada server.</div>';
  const tbody=document.getElementById('pemdaPmSamplingBody');if(!tbody)return;
  if(!samples.length){tbody.innerHTML=`<tr><td colspan="11" class="pemda-pm-empty">Belum ada OPD sampling yang tersimpan untuk tahun ${escapeHtml(String(currentYear))}. Buka “KK Pemda & Sampling”, pilih OPD, isi dasar pemilihan, lalu simpan. Daftar ini akan terisi otomatis.</td></tr>`;return;}
  tbody.innerHTML=samples.map((r,i)=>{const sc=r.scores||{};return `<tr><td>${i+1}</td><td><b>${escapeHtml(r.opd||'OPD')}</b><small>${escapeHtml(r.sampleReason||'Dasar sampling belum tercatat')}</small><span class="pemda-pm-source-status">${escapeHtml(r.sourceAssessmentStatus||'Belum Mengisi')} · ${r.hasWorkbook?'Workbook PM terhubung':'Workbook PM belum terhubung'} · ${Number(r.pmReportCount||0)} laporan · ${Number(r.evidenceCount||0)} evidence</span></td><td>${pemdaPmScoreCell(sc.nilaiStrukturProses)}</td><td>${pemdaPmScoreCell(sc.nilaiMaturitas)}</td><td>${pemdaPmScoreCell(sc.mri)}</td><td>${pemdaPmScoreCell(sc.iepk)}</td><td>${pemdaPmScoreCell(sc.nilaiKapabilitasApip)}</td><td><span class="pemda-pm-stage ${pemdaPmStageClass(r.pm?.status)}">${escapeHtml(pemdaPmStatusLabel('pm',r.pm?.status))}</span></td><td><span class="pemda-pm-stage ${pemdaPmStageClass(r.qa?.status)}">${escapeHtml(pemdaPmStatusLabel('qa',r.qa?.status))}</span></td><td><span class="pemda-pm-stage ${r.isSample?pemdaPmStageClass(r.bpkp?.status):'pending'}">${escapeHtml(pemdaPmStatusLabel('bpkp',r.bpkp?.status))}</span></td><td><button type="button" class="pemda-pm-detail-btn" data-pemda-pm-detail="${escapeHtml(r.opdId)}">Detail / Verifikasi</button></td></tr>`;}).join('');
}
async function loadPemdaPmManifest(){
  if(pemdaPmManifestPromise)return pemdaPmManifestPromise;
  pemdaPmManifestPromise=fetch(`/kk-pm-full-workbook-manifest.json?v=pemda-kkpm-20261026&_=${Date.now()}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Manifest master belum dapat dimuat');return r.json();}).then(d=>Array.isArray(d.sheets)?d.sheets:[]).catch(()=>[]);
  pemdaPmDash.manifest=await pemdaPmManifestPromise;return pemdaPmDash.manifest;
}
const PEMDA_PM_ALLOWED_TARGETS=['T2','T3','T4'];
const PEMDA_PM_TARGET_LABELS={T2:'T2 · KK3.2 — Keandalan Pelaporan Keuangan',T3:'T3 · KK3.3 — Pengamanan Aset Daerah',T4:'T4 · KK3.4 — Ketaatan Peraturan'};
function pemdaPmRole(){return String(currentUser?.role||'').toLowerCase();}
function pemdaPmCanUploadEvidence(){return ['admin','irban','auditor','ppupd'].includes(pemdaPmRole());}
function pemdaPmCanVerifyEvidence(){return ['admin','irban','auditor','ppupd','bpkp'].includes(pemdaPmRole());}
function pemdaPmCanDeleteEvidence(){return ['admin','irban','auditor','ppupd'].includes(pemdaPmRole());}
function pemdaPmMasterTarget(code){return (kkPmMaster?.targets||[]).find(t=>String(t.code)===String(code));}
function pemdaPmTargetParams(code){return pemdaPmMasterTarget(code)?.parameters||[];}
function pemdaPmCurrentParameter(){
  const target=document.getElementById('pemdaEvidenceTarget')?.value||'T2';
  const subCode=document.getElementById('pemdaEvidenceSubunsur')?.value||'';
  const pair=String(document.getElementById('pemdaEvidenceParam')?.value||'').split('|');
  return pemdaPmTargetParams(target).find(p=>String(p.subCode)===subCode&&String(p.paramId)===String(pair[1]||''))||null;
}
function renderPemdaPmEvidenceSelectors(){
  const targetSelect=document.getElementById('pemdaEvidenceTarget'),subSelect=document.getElementById('pemdaEvidenceSubunsur'),paramSelect=document.getElementById('pemdaEvidenceParam');
  if(!targetSelect||!subSelect||!paramSelect)return;
  const target=PEMDA_PM_ALLOWED_TARGETS.includes(targetSelect.value)?targetSelect.value:'T2';targetSelect.value=target;
  const params=pemdaPmTargetParams(target);const oldSub=subSelect.value;const subs=new Map();
  params.forEach(p=>{const key=String(p.subCode||'');if(key&&!subs.has(key))subs.set(key,String(p.subunsur||`Subunsur ${key}`));});
  subSelect.innerHTML=subs.size?[...subs].map(([code,name])=>`<option value="${escapeHtml(code)}">${escapeHtml(code+' — '+name)}</option>`).join(''):'<option value="">Master parameter tidak tersedia</option>';
  if(subs.has(oldSub))subSelect.value=oldSub;
  const subCode=subSelect.value;const oldPair=paramSelect.value;
  const filtered=params.filter(p=>String(p.subCode)===String(subCode));
  paramSelect.innerHTML=filtered.length?filtered.map(p=>{const value=`${p.subCode}|${p.paramId}`;const label=`${p.paramId} — ${p.uraianParameter||p.subunsur||'Parameter'}`;return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;}).join(''):'<option value="">Parameter tidak tersedia</option>';
  if(filtered.some(p=>`${p.subCode}|${p.paramId}`===oldPair))paramSelect.value=oldPair;
  const ready=!!filtered.length;
  ['pemdaEvidenceSubunsur','pemdaEvidenceParam','pemdaEvidenceGrade','pemdaEvidenceInput','pemdaEvidenceUpload'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!ready||!pemdaPmCanUploadEvidence();});
}
function pemdaPmVerificationLabel(status){return ({diterima:'Diterima',diterima_catatan:'Diterima dengan Catatan',dikembalikan:'Dikembalikan'})[String(status||'')]||'Belum diverifikasi';}
function renderPemdaPmEvidenceFiles(){
  const list=document.getElementById('pemdaEvidenceFileList'),summary=document.getElementById('pemdaEvidenceSummary');if(!list)return;
  const files=Array.isArray(pemdaPmDash.evidenceFiles)?pemdaPmDash.evidenceFiles:[];const s=pemdaPmDash.evidenceSummary||{};
  if(summary)summary.innerHTML=[['Total Evidence',Number(s.total||files.length)],['Diterima',files.filter(f=>['diterima','diterima_catatan'].includes(f.verificationStatus)).length],['Dikembalikan',files.filter(f=>f.verificationStatus==='dikembalikan').length],['Menunggu Verifikasi',files.filter(f=>!f.verificationStatus).length]].map(([label,value])=>`<div><span>${escapeHtml(label)}</span><b>${Number(value).toLocaleString('id-ID')}</b></div>`).join('');
  if(pemdaPmDash.evidenceError){list.innerHTML=`<div class="pemda-pm-empty">${escapeHtml(pemdaPmDash.evidenceError)}</div>`;return;}
  if(!files.length){list.innerHTML=`<div class="pemda-pm-empty">Belum ada evidence khusus Pemda untuk tahun ${escapeHtml(String(currentYear))}. Pilih target T2, T3, atau T4 di atas untuk mulai mengunggah.</div>`;return;}
  const canVerify=pemdaPmCanVerifyEvidence(),canDelete=pemdaPmCanDeleteEvidence();
  list.innerHTML=files.map(file=>{
    const id=String(file.uploadId||'');const target=PEMDA_PM_TARGET_LABELS[file.targetCode]||file.targetCode;const status=file.verificationStatus||'';const statusClass=status==='diterima'?'done':status==='diterima_catatan'?'progress':status==='dikembalikan'?'warning':'pending';
    const verify=canVerify?`<div class="pemda-pm-evidence-verification"><label>Status Pemeriksaan<select data-pemda-evidence-status="${escapeHtml(id)}"><option value="" ${!status?'selected':''}>Pilih status…</option><option value="diterima" ${status==='diterima'?'selected':''}>Diterima</option><option value="diterima_catatan" ${status==='diterima_catatan'?'selected':''}>Diterima dengan Catatan</option><option value="dikembalikan" ${status==='dikembalikan'?'selected':''}>Dikembalikan</option></select></label><label>Nama Pemeriksa<input type="text" maxlength="100" data-pemda-evidence-examiner="${escapeHtml(id)}" value="${escapeHtml(file.verificationExaminer||'')}" placeholder="Nama pemeriksa"></label><label class="pemda-pm-evidence-note">Catatan Pemeriksa<textarea rows="2" maxlength="2000" data-pemda-evidence-note="${escapeHtml(id)}" placeholder="Wajib untuk status catatan/dikembalikan">${escapeHtml(file.verificationNote||'')}</textarea></label><button type="button" data-pemda-evidence-verify="${escapeHtml(id)}">Simpan Verifikasi</button></div>`:'';
    const del=canDelete?`<button type="button" class="danger" data-pemda-evidence-delete="${escapeHtml(id)}">Hapus</button>`:'';
    const retry=(file.syncStatus==='retrying'||file.syncStatus==='pending')&&pemdaPmCanUploadEvidence()?`<button type="button" data-pemda-evidence-retry="${escapeHtml(id)}">↻ Ulangi Sinkronisasi Drive</button>`:'';
    const sync=file.syncStatus==='done'?'Tersimpan di R2 + Google Drive':(file.syncStatus==='deleted'?'Dihapus':`Tersimpan di R2 · Sinkronisasi Drive ${file.syncStatus==='retrying'?'tertunda':'menunggu'}`);
    return `<article class="pemda-pm-evidence-card"><div class="pemda-pm-evidence-card-head"><div><span class="pemda-pm-evidence-target">${escapeHtml(target)}</span><h5>${escapeHtml(file.fileName||'Evidence')}</h5><p>Subunsur ${escapeHtml(file.subunsur||'—')} · Parameter ${escapeHtml(file.paramId||'—')} · Grade ${escapeHtml(file.grade||'—')} · Level ${Number(file.level||0)}</p></div><span class="pemda-pm-stage ${statusClass}">${escapeHtml(pemdaPmVerificationLabel(status))}</span></div><div class="pemda-pm-evidence-card-actions"><a href="${escapeHtml(file.url||'#')}" target="_blank" rel="noopener">↗ Buka file</a><small>${escapeHtml(sync)}${file.syncError?' · '+escapeHtml(file.syncError):''}</small>${retry}${del}</div>${file.verificationExaminer?`<p class="pemda-pm-evidence-saved-verification">Pemeriksa: <b>${escapeHtml(file.verificationExaminer)}</b>${file.verificationNote?' · '+escapeHtml(file.verificationNote):''}</p>`:''}${verify}</article>`;
  }).join('');
}
async function loadPemdaPmTemplateConfig(){
  const panel=document.getElementById('pemdaPmTemplateAdminPanel');if(!panel)return;
  const role=pemdaPmRole(),canManage=['admin','irban'].includes(role);panel.hidden=!canManage;if(!canManage)return;
  try{
    const result=await callServer('getKkPmTemplateConfig',{});pemdaPmDash.templateConfig=result;
    const input=document.getElementById('pemdaPmTemplateId'),link=document.getElementById('pemdaPmTemplateLink'),state=document.getElementById('pemdaPmTemplateValidationState'),updated=document.getElementById('pemdaPmTemplateUpdated');
    if(input&&(!input.value||!input.dataset.dirty))input.value=result.spreadsheetId||'';
    if(link){link.href=result.spreadsheetUrl||'#';link.textContent=result.spreadsheetId||'ID master belum dikonfigurasi';}
    if(state){state.textContent=result.validationProfile==='PM_2026'?'Profil PM_2026 tervalidasi':(result.validationProfile==='pending_validation'?'Menunggu validasi pertama':'Perlu validasi');state.className='pemda-pm-template-state'+(result.validationProfile==='PM_2026'?' success':' warning');}
    if(updated)updated.textContent=result.updatedAt?` · Diperbarui ${new Date(result.updatedAt).toLocaleString('id-ID')}${result.updatedBy?' oleh '+result.updatedBy:''}`:'';
    const bulk=document.getElementById('pemdaPmTemplateRefreshAll');if(bulk)bulk.hidden=!['admin','irban'].includes(role);
    const save=document.getElementById('pemdaPmTemplateUpdate');if(save)save.textContent='✓ Validasi ID & Perbarui Semua Workbook';
  }catch(err){const state=document.getElementById('pemdaPmTemplateValidationState');if(state){state.textContent='Gagal memuat konfigurasi';state.className='pemda-pm-template-state warning';}pemdaPmTemplateStatus('Gagal memuat konfigurasi master: '+(err.message||err),'error');}
}
function pemdaPmTemplateStatus(message,state=''){const el=document.getElementById('pemdaPmTemplateStatus');if(el){el.textContent=message||'';el.className='pemda-pm-inline-status'+(state?' '+state:'');}}
async function loadPemdaPmEvidenceFiles(){
  try{const result=await callServer('getPemdaWorkbookEvidenceFiles',{year:currentYear});pemdaPmDash.evidenceFiles=Array.isArray(result.files)?result.files:[];pemdaPmDash.evidenceSummary=result.summary||{};pemdaPmDash.evidenceError='';}
  catch(err){pemdaPmDash.evidenceFiles=[];pemdaPmDash.evidenceSummary={};pemdaPmDash.evidenceError='Gagal memuat evidence Pemda: '+(err.message||err);}
  renderPemdaPmEvidenceFiles();
}
async function uploadPemdaPmEvidence(){
  if(!pemdaPmCanUploadEvidence())return pemdaPmEvidenceStatus('Akun ini hanya dapat melihat/verifikasi evidence Pemda.','error');
  const target=document.getElementById('pemdaEvidenceTarget')?.value||'';if(!PEMDA_PM_ALLOWED_TARGETS.includes(target))return pemdaPmEvidenceStatus('Hanya target T2–T4 (KK3.2–KK3.4) yang diizinkan.','error');
  const p=pemdaPmCurrentParameter();if(!p)return pemdaPmEvidenceStatus('Pilih subunsur dan parameter yang valid dari master KK PM.','error');
  const input=document.getElementById('pemdaEvidenceInput'),files=Array.from(input?.files||[]);if(!files.length)return pemdaPmEvidenceStatus('Pilih minimal satu file evidence terlebih dahulu.','error');
  const grade=String(document.getElementById('pemdaEvidenceGrade')?.value||'C');if(!['A','B','C','D','E'].includes(grade))return pemdaPmEvidenceStatus('Pilih grade evidence A sampai E.','error');
  const button=document.getElementById('pemdaEvidenceUpload');if(button)button.disabled=true;
  let ok=0,pending=0,failed=[];
  try{
    for(let i=0;i<files.length;i++){
      const file=files[i];if(file.size>10*1024*1024){failed.push(`${file.name}: melebihi 10 MB`);continue;}
      pemdaPmEvidenceStatus(`Mengunggah ${i+1}/${files.length}: ${file.name}`);
      const uploadId=crypto.randomUUID();const evidenceKey=`${target}|${p.subCode}|${p.paramId}`;
      try{const result=await callServerWithRetry('uploadPemdaWorkbookEvidence',{__binaryFile:file,year:currentYear,targetCode:target,subunsur:p.subCode,paramId:p.paramId,evidenceKey,grade,level:String(({A:5,B:4,C:3,D:2,E:1})[grade]),subunsurName:p.subunsur||`Subunsur ${p.subCode}`,paramName:p.uraianParameter||`Parameter ${p.paramId}`,fileName:file.name,fileType:file.type||'application/octet-stream',uploadId},3);if(result?.status==='pending'||result?.syncStatus==='retrying')pending++;else ok++;}
      catch(err){failed.push(`${file.name}: ${err.message||err}`);}
    }
    if(input)input.value='';await loadPemdaPmEvidenceFiles();
    const message=`Upload selesai: ${ok} tersinkron${pending?`, ${pending} tersimpan di R2 menunggu sinkronisasi Drive`:''}${failed.length?`, ${failed.length} gagal`:''}.`;
    pemdaPmEvidenceStatus(message+(failed.length?' '+failed.slice(0,3).join(' · '):''),failed.length?'error':'success');
  }catch(err){pemdaPmEvidenceStatus('Upload gagal: '+(err.message||err),'error');}
  finally{if(button)button.disabled=false;renderPemdaPmEvidenceSelectors();}
}
function pemdaPmEvidenceStatus(message,state=''){const el=document.getElementById('pemdaPmEvidenceStatus');if(el){el.textContent=message||'';el.className='pemda-pm-inline-status'+(state?' '+state:'');}}
async function savePemdaPmEvidenceVerification(uploadId){
  const status=document.querySelector(`[data-pemda-evidence-status="${CSS.escape(uploadId)}"]`),examiner=document.querySelector(`[data-pemda-evidence-examiner="${CSS.escape(uploadId)}"]`),note=document.querySelector(`[data-pemda-evidence-note="${CSS.escape(uploadId)}"]`);
  if(!status||!examiner||!note)return;
  try{await callServerWithRetry('savePemdaWorkbookEvidenceVerification',{year:currentYear,uploadId,verificationStatus:status.value,verificationExaminer:examiner.value.trim(),verificationNote:note.value.trim()},3);await loadPemdaPmEvidenceFiles();pemdaPmEvidenceStatus('Verifikasi evidence Pemda berhasil disimpan.','success');}
  catch(err){pemdaPmEvidenceStatus('Gagal menyimpan verifikasi: '+(err.message||err),'error');}
}
async function deletePemdaPmEvidence(uploadId){
  if(!confirm('Hapus evidence Pemda ini dari penyimpanan R2 dan Google Drive?'))return;
  try{await callServerWithRetry('deletePemdaWorkbookEvidence',{year:currentYear,uploadId},3);await loadPemdaPmEvidenceFiles();pemdaPmEvidenceStatus('Evidence Pemda telah dihapus.','success');}
  catch(err){pemdaPmEvidenceStatus('Gagal menghapus evidence: '+(err.message||err),'error');}
}
async function retryPemdaPmEvidenceDrive(uploadId){
  try{await callServerWithRetry('retryDriveBackup',{type:'pemda_workbook_evidence',year:currentYear,uploadId},3);await loadPemdaPmEvidenceFiles();pemdaPmEvidenceStatus('Sinkronisasi Google Drive berhasil.','success');}
  catch(err){pemdaPmEvidenceStatus('Sinkronisasi Google Drive belum berhasil: '+(err.message||err),'error');}
}
async function refreshPemdaPmWorkbooks({bulk=true,masterId=null,throwOnError=false,accountModal=false}={}){
  const role=pemdaPmRole(),canUpdate=['admin','irban'].includes(role);
  if(!canUpdate){const err=new Error('Pembaruan seluruh workbook hanya tersedia untuk akun Pemda (Super Admin Daerah) dan Irban.');pemdaPmTemplateStatus(err.message,'error');if(throwOnError)throw err;return null;}
  if(!bulk){const err=new Error('Pembaruan master global harus memproses workbook Pemda dan seluruh OPD sekaligus.');pemdaPmTemplateStatus(err.message,'error');if(throwOnError)throw err;return null;}
  const btn=document.getElementById('pemdaPmTemplateRefreshAll')||document.getElementById('pemdaPmTemplateUpdate');if(btn)btn.disabled=true;
  const raw=String(masterId||document.getElementById('pemdaPmTemplateId')?.value||pemdaPmDash.templateConfig?.spreadsheetId||'').trim();
  if(!raw){const err=new Error('Masukkan ID atau link master terlebih dahulu.');pemdaPmTemplateStatus(err.message,'error');if(throwOnError)throw err;return null;}
  try{
    pemdaPmTemplateStatus('Memvalidasi master PM_2026: 26 tab inti (tab tambahan diperbolehkan), formula inti, dan izin Google Drive…');
    const config=await callServerWithRetry('updateKkPmTemplateConfig',{spreadsheetId:raw},3);pemdaPmDash.templateConfig=config;
    const link=document.getElementById('pemdaPmTemplateLink');if(link){link.href=config.spreadsheetUrl||'#';link.textContent=config.spreadsheetId||raw;}
    const updated=document.getElementById('pemdaPmTemplateUpdated');if(updated)updated.textContent=` · Diperbarui ${new Date(config.updatedAt||Date.now()).toLocaleString('id-ID')}${config.updatedBy?' oleh '+config.updatedBy:''}`;
    const state=document.getElementById('pemdaPmTemplateValidationState');if(state){state.textContent='Profil PM_2026 tervalidasi';state.className='pemda-pm-template-state success';}
    const input=document.getElementById('pemdaPmTemplateId');if(input){input.value=config.spreadsheetId||raw;delete input.dataset.dirty;}
    pemdaPmTemplateStatus('Master valid. Memperbarui workbook khusus Pemda dan mirror XLSX R2…');
    const pemdaResult=await callServerWithRetry('createPemdaKkPmWorkbook',{year:currentYear,forceRefresh:true},3);
    if(pemdaResult?.status==='error')throw new Error(pemdaResult.message||'Sinkronisasi workbook Pemda gagal.');
    const targetsResult=await callServerWithRetry('getKkPmWorkbookRefreshTargets',{year:currentYear},2);
    const targets=Array.isArray(targetsResult?.targets)?targetsResult.targets:[];
    if(!targets.length)throw new Error('Server tidak menemukan daftar OPD. Tidak ada workbook OPD yang diproses.');
    let updatedOpd=0,r2Updated=Number(pemdaResult?.workbook?.r2MirrorKey&&!pemdaResult?.workbook?.r2MirrorError?1:0),driveArchived=Number(pemdaResult?.workbook?.driveArchiveStatus==='archived'?1:0),failedOpd=[],failedR2=[],failedDriveArchive=[];
    if(pemdaResult?.workbook?.r2MirrorError)failedR2.push(`Pemda: ${pemdaResult.workbook.r2MirrorError}`);
    if(pemdaResult?.workbook?.driveArchiveError)failedDriveArchive.push(`Pemda: ${pemdaResult.workbook.driveArchiveError}`);
    let finished=0;const pool=2;
    for(let offset=0;offset<targets.length;offset+=pool){
      const batch=targets.slice(offset,offset+pool);
      const outcome=await Promise.all(batch.map(async target=>{try{const result=await callServerWithRetry('createKkPmSheets',{opdId:target.id,year:currentYear,massRefresh:true,forceRefresh:true},3);if(result?.status==='error')throw new Error(result.message||'Gagal sinkron');return{ok:true,target,result};}catch(error){return{ok:false,target,error};}}));
      for(const item of outcome){finished++;if(item.ok){updatedOpd++;if(item.result?.kkPmData?.r2MirrorKey&&!item.result?.kkPmData?.r2MirrorError)r2Updated++;if(item.result?.kkPmData?.driveArchiveStatus==='archived')driveArchived++;if(item.result?.kkPmData?.r2MirrorError)failedR2.push(`${item.target.opd||item.target.id}: ${item.result.kkPmData.r2MirrorError}`);if(item.result?.kkPmData?.driveArchiveError)failedDriveArchive.push(`${item.target.opd||item.target.id}: ${item.result.kkPmData.driveArchiveError}`);const row=(Array.isArray(rows)?rows:[]).find(r=>String(r.id)===String(item.target.id));if(row){let root={};try{root=typeof row.kkPmData==='string'?JSON.parse(row.kkPmData):(row.kkPmData||{});}catch{}row.kkPmData={...root,version:3,workbook:item.result.kkPmData,workbookHistory:item.result.workbookHistory||root.workbookHistory||[]};}}else failedOpd.push(`${item.target.opd||item.target.id}: ${item.error?.message||item.error}`);}
      const progress=`Master valid. Pemda selesai; OPD ${Math.min(finished,targets.length)}/${targets.length}. Workbook berhasil ${updatedOpd}, gagal ${failedOpd.length}; mirror R2 ${r2Updated}/${targets.length+1}; file Drive lama diarsipkan ${driveArchived}/${targets.length+1}…`;
      pemdaPmTemplateStatus(progress);if(accountModal)kkPmMasterUpdateStatus(progress);
    }
    try{await loadData();}catch{}
    await loadPemdaPmDashboard(false);
    const hasFailures=failedOpd.length>0||failedR2.length>0||failedDriveArchive.length>0;
    const msg=`Master ${config.spreadsheetId} tervalidasi. Workbook Pemda tertaut; workbook OPD berhasil ${updatedOpd}/${targets.length}, gagal ${failedOpd.length}${failedOpd.length?': '+failedOpd.slice(0,8).join(' · '):'.'} Mirror XLSX R2 berhasil ${r2Updated}/${targets.length+1}, gagal ${failedR2.length}${failedR2.length?': '+failedR2.slice(0,5).join(' · '):'.'} File Drive lama berhasil diarsipkan ${driveArchived}/${targets.length+1}, gagal ${failedDriveArchive.length}${failedDriveArchive.length?': '+failedDriveArchive.slice(0,5).join(' · '):'.'} Workbook lama tidak dihapus permanen dan evidence R2 tidak disentuh.`;
    pemdaPmTemplateStatus(msg,hasFailures?'error':'success');pemdaPmDashStatus(msg,hasFailures?'error':'success');if(accountModal)kkPmMasterUpdateStatus(msg,hasFailures?'error':'success');
    const result={ok:!hasFailures,config,pemdaResult,updatedOpd,totalOpd:targets.length,failedOpd,failedR2,failedDriveArchive,driveArchived,r2Updated,totalR2:targets.length+1};
    if(throwOnError&&hasFailures)throw new Error(msg);
    return result;
  }catch(err){
    pemdaPmTemplateStatus('Pembaruan gagal: '+(err.message||err),'error');if(accountModal)kkPmMasterUpdateStatus('Pembaruan gagal: '+(err.message||err),'error');
    if(throwOnError)throw err;
    return null;
  }finally{if(btn)btn.disabled=false;await loadPemdaPmTemplateConfig().catch(()=>{});renderPemdaPmDashboard();}
}

async function loadPemdaPmDashboard(showStatus=true){
  if(pemdaPmDash.loading)return;pemdaPmDash.loading=true;
  const refresh=document.getElementById('pemdaPmWorkbookRefresh');if(refresh)refresh.disabled=true;
  if(showStatus)pemdaPmDashStatus(`Memuat KK PM SPIP Pemda dan tarikan data OPD sampling tahun ${currentYear}...`);
  try{
    const [workflow,workbook]=await Promise.all([callServer('getPemdaWorkflow',{year:currentYear}),callServer('getPemdaKkPmWorkbook',{year:currentYear})]);
    pemdaPmDash.workflow=Array.isArray(workflow.rows)?workflow.rows:[];pemdaPmDash.workbook={...(workbook?.workbook||{}),exists:!!workbook?.exists,needsSync:!!workbook?.needsSync,needsSyncReason:workbook?.needsSyncReason||'',permissions:workbook?.permissions||{},version:Number(workbook?.version||0),updatedAt:Number(workbook?.updatedAt||0),updatedBy:workbook?.updatedBy||''};pemdaPmDash.sheets=Array.isArray(workbook.sheets)?workbook.sheets:[];pemdaPmDash.permissions=workbook.permissions||{canManage:['admin','irban'].includes(String(currentUser?.role||'')),canRefreshAll:['admin','irban'].includes(String(currentUser?.role||''))};pemdaPmDash.lastLoadedAt=Date.now();
    await loadPemdaPmManifest();
    try{await ensureKkPmMasterLoaded(false);}catch(err){pemdaPmDash.evidenceError='Master parameter KK PM belum dapat dimuat: '+(err.message||err);}
    await Promise.all([loadPemdaPmTemplateConfig(),loadPemdaPmEvidenceFiles()]);
    renderPemdaPmEvidenceSelectors();renderPemdaPmDashboard();
    if(showStatus)pemdaPmDashStatus(`Data tahun ${currentYear} berhasil dimuat. Workbook Pemda, workbook OPD, dan evidence Pemda disimpan terpisah.`, 'success');
  }catch(err){if(showStatus)pemdaPmDashStatus('Dashboard Pemda gagal memuat data: '+(err.message||err),'error');}
  finally{pemdaPmDash.loading=false;if(refresh)refresh.disabled=false;}
}
function openPemdaPmDashboard(){if(!currentUser){alert('Silakan login terlebih dahulu.');return;}const modal=document.getElementById('pemdaPmDashboardModal');if(!modal)return;modal.classList.add('active');loadPemdaPmDashboard(true);}
function closePemdaPmDashboard(){document.getElementById('pemdaPmDashboardModal')?.classList.remove('active');}
async function createOrSyncPemdaPmWorkbook(){if(!['admin','irban'].includes(pemdaPmRole()))return pemdaPmDashStatus('Hanya akun Pemda dan Irban yang dapat memperbarui workbook Pemda.','error');if(pemdaPmDash.creating)return;const btn=document.getElementById(pemdaPmDash.workbook?.exists?'pemdaPmWorkbookSync':'pemdaPmWorkbookCreate');pemdaPmDash.creating=true;if(btn)btn.disabled=true;pemdaPmDashStatus('Membuat / memverifikasi salinan KK PM SPIP Pemda dari master 26 tab inti...');renderPemdaPmDashboard();
  try{const result=await callServerWithRetry('createPemdaKkPmWorkbook',{year:currentYear},2);pemdaPmDash.workbook={...(result.workbook||{}),exists:true,needsSync:!!result.needsSync,needsSyncReason:result.needsSyncReason||'',updatedAt:Number(result.updatedAt||Date.now()),updatedBy:result.updatedBy||'',permissions:{canManage:['admin','irban'].includes(String(currentUser?.role||'')),canRefreshAll:['admin','irban'].includes(String(currentUser?.role||''))}};pemdaPmDash.sheets=Array.isArray(result.sheets)?result.sheets:[];pemdaPmDash.lastLoadedAt=Date.now();renderPemdaPmDashboard();pemdaPmDashStatus(result.message||'Workbook KK PM SPIP Pemda berhasil diverifikasi.','success');}
  catch(err){pemdaPmDashStatus('Workbook Pemda belum berhasil dibuat/disinkronkan: '+(err.message||err),'error');await loadPemdaPmDashboard(false);}
  finally{pemdaPmDash.creating=false;if(btn)btn.disabled=false;renderPemdaPmDashboard();}}
async function openPemdaPmWorkbook(sheetName=''){const win=window.open('about:blank','_blank');try{let d=await callServerWithRetry('getPemdaKkPmWorkbook',{year:currentYear},1);if(!d.exists||d.needsSync){if(!d.permissions?.canManage){throw new Error(d.needsSyncReason||'Workbook Pemda belum dibuat atau perlu disinkronkan oleh Irban/Super Admin.');}d=await callServerWithRetry('createPemdaKkPmWorkbook',{year:currentYear},2);}
  const wb=d.workbook||d;let url=wb.workbookUrl||(wb.workbookSpreadsheetId?`https://docs.google.com/spreadsheets/d/${encodeURIComponent(wb.workbookSpreadsheetId)}/edit`:'');if(!url)throw new Error('Server tidak mengembalikan tautan workbook Pemda.');if(sheetName){const sh=(d.sheets||[]).find(x=>String(x.title||'')===String(sheetName));if(!sh)throw new Error(`Sheet ${sheetName} tidak ditemukan pada workbook aktif.`);if(sh.sheetId!==undefined&&sh.sheetId!==null)url+=`#gid=${encodeURIComponent(sh.sheetId)}`;}
  if(win&&!win.closed)win.location.replace(url);else window.open(url,'_blank','noopener,noreferrer');
  await loadPemdaPmDashboard(false);
}catch(err){if(win&&!win.closed)win.close();pemdaPmDashStatus('Spreadsheet tidak dibuka: '+(err.message||err),'error');}}
document.getElementById('btnPemdaPmKk')?.addEventListener('click',openPemdaPmDashboard);
document.getElementById('pemdaPmDashboardClose')?.addEventListener('click',closePemdaPmDashboard);
document.getElementById('pemdaPmDashboardCloseFooter')?.addEventListener('click',closePemdaPmDashboard);
document.getElementById('pemdaPmTemplateId')?.addEventListener('input',e=>e.target.dataset.dirty='1');
document.getElementById('pemdaPmTemplateUpdate')?.addEventListener('click',()=>refreshPemdaPmWorkbooks({bulk:true}));
document.getElementById('pemdaPmTemplateRefreshAll')?.addEventListener('click',()=>refreshPemdaPmWorkbooks({bulk:true}));
document.getElementById('pemdaPmTemplateOpenLink')?.addEventListener('click',()=>{const id=String(document.getElementById('pemdaPmTemplateId')?.value||pemdaPmDash.templateConfig?.spreadsheetId||'').trim();const found=id.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);const clean=found?found[1]:id;if(/^[A-Za-z0-9_-]{20,}$/.test(clean))window.open(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(clean)}/edit`,'_blank','noopener,noreferrer');else pemdaPmTemplateStatus('ID/URL master belum valid.','error');});
document.getElementById('pemdaEvidenceTarget')?.addEventListener('change',()=>renderPemdaPmEvidenceSelectors());
document.getElementById('pemdaEvidenceSubunsur')?.addEventListener('change',()=>renderPemdaPmEvidenceSelectors());
document.getElementById('pemdaEvidenceParam')?.addEventListener('change',()=>renderPemdaPmEvidenceSelectors());
document.getElementById('pemdaPmEvidenceRefresh')?.addEventListener('click',loadPemdaPmEvidenceFiles);
document.getElementById('pemdaEvidenceUpload')?.addEventListener('click',uploadPemdaPmEvidence);
document.getElementById('pemdaEvidenceFileList')?.addEventListener('click',e=>{const verify=e.target.closest('[data-pemda-evidence-verify]');if(verify){savePemdaPmEvidenceVerification(verify.dataset.pemdaEvidenceVerify);return;}const del=e.target.closest('[data-pemda-evidence-delete]');if(del){deletePemdaPmEvidence(del.dataset.pemdaEvidenceDelete);return;}const retry=e.target.closest('[data-pemda-evidence-retry]');if(retry)retryPemdaPmEvidenceDrive(retry.dataset.pemdaEvidenceRetry);});
document.getElementById('pemdaPmWorkbookRefresh')?.addEventListener('click',()=>loadPemdaPmDashboard(true));
document.getElementById('pemdaPmWorkbookCreate')?.addEventListener('click',createOrSyncPemdaPmWorkbook);
document.getElementById('pemdaPmWorkbookSync')?.addEventListener('click',createOrSyncPemdaPmWorkbook);
document.getElementById('pemdaPmWorkbookOpen')?.addEventListener('click',()=>openPemdaPmWorkbook());
document.getElementById('pemdaPmSamplingManage')?.addEventListener('click',async()=>{closePemdaPmDashboard();const modal=document.getElementById('pemdaWorkflowModal');modal?.classList.add('active');await loadPemdaWorkflow(true);});
document.getElementById('pemdaPmSheetList')?.addEventListener('click',e=>{const btn=e.target.closest('[data-pemda-pm-sheet]');if(btn&&!btn.disabled)openPemdaPmWorkbook(btn.dataset.pemdaPmSheet||'');});
document.getElementById('pemdaPmSamplingBody')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-pemda-pm-detail]');if(!btn)return;closePemdaPmDashboard();document.getElementById('pemdaWorkflowModal')?.classList.add('active');await loadPemdaWorkflow(false);const row=pemdaWorkflowUi.rows.find(x=>String(x.opdId)===String(btn.dataset.pemdaPmDetail));if(row)renderPemdaWorkflowEditor(row);else pemdaWorkflowSetStatus('Detail OPD tidak tersedia pada cakupan akun ini.','error');});
document.addEventListener('click',e=>{if(e.target===document.getElementById('pemdaPmDashboardModal'))closePemdaPmDashboard();});

// ====== MODE NILAI RESMI BPKP TINGKAT PEMDA ======
(function initDashboardModes(){
  const byId=id=>document.getElementById(id);
  byId('modeInternalBtn')?.addEventListener('click',()=>setDashboardMode('internal'));
  byId('modeBpkpBtn')?.addEventListener('click',async()=>{await loadBpkpOfficialScore(true);setDashboardMode('bpkp');});
  const modal=byId('bpkpOfficialModal');
  const status=text=>{const e=byId('bpkpOfficialStatus');if(e)e.textContent=text||'';};
  const setLocked=locked=>{['bpkpOfficialSpip','bpkpOfficialMri','bpkpOfficialIepk','bpkpOfficialApip','bpkpOfficialBy','bpkpOfficialNote','bpkpOfficialFinalize'].forEach(id=>{const e=byId(id);if(e)e.disabled=!!locked;});if(byId('bpkpOfficialUnlock'))byId('bpkpOfficialUnlock').style.display=locked?'inline-flex':'none';if(byId('bpkpOfficialSave'))byId('bpkpOfficialSave').style.display=locked?'none':'inline-flex';if(byId('bpkpOfficialLockedNote')){byId('bpkpOfficialLockedNote').style.display=locked?'block':'none';byId('bpkpOfficialLockedNote').textContent=locked?'Nilai resmi telah dikunci. Gunakan tombol Buka Kunci untuk mengubah data; seluruh tindakan dicatat pada log audit.':'';}};
  const fill=score=>{byId('bpkpOfficialSpip').value=score?.spip??'';byId('bpkpOfficialMri').value=score?.mri??'';byId('bpkpOfficialIepk').value=score?.iepk??'';byId('bpkpOfficialApip').value=score?.apip??'';byId('bpkpOfficialBy').value=score?.updated_by||'Admin Inspektorat';byId('bpkpOfficialNote').value=score?.note||'';byId('bpkpOfficialFinalize').checked=false;setLocked(Number(score?.finalized||0)===1);};
  byId('btnBpkpOfficialInput')?.addEventListener('click',async()=>{await loadBpkpOfficialScore(true);fill(bpkpOfficialScore);byId('bpkpOfficialPassword').value='';const audit=byId('bpkpOfficialAudit');if(audit){audit.style.display='none';audit.innerHTML='';}status('Input nilai resmi Pemda untuk Tahun '+currentYear+'. Masukkan password admin lalu klik Muat Draft & Riwayat untuk mengambil draft yang tersimpan.');modal?.classList.add('active');});
  byId('bpkpOfficialLoadDraft')?.addEventListener('click',async()=>{
    const adminPassword=byId('bpkpOfficialPassword')?.value;if(!adminPassword){status('Masukkan password admin terlebih dahulu.');return;}
    const button=byId('bpkpOfficialLoadDraft');button.disabled=true;status('Memuat draft resmi dan riwayat audit...');
    try{
      const [draft,audit]=await Promise.all([callServer('getBpkpOfficialScoreAdmin',{year:currentYear,adminPassword}),callServer('getBpkpOfficialAudit',{year:currentYear,adminPassword})]);
      if(draft.score)fill(draft.score);else{fill(null);setLocked(false);}
      const box=byId('bpkpOfficialAudit');if(box){box.style.display='block';box.innerHTML='<strong>Riwayat perubahan nilai resmi (maksimal 10 catatan)</strong>'+(audit.entries||[]).map(entry=>`<div class="bpkp-audit-item"><b>${escapeHtml(entry.action||'aksi')}</b><span>${escapeHtml(entry.updatedBy||'Admin')} · ${entry.createdAt?new Date(entry.createdAt).toLocaleString('id-ID'):'waktu tidak tersedia'}</span><small>${escapeHtml(JSON.stringify(entry.payload||{}).slice(0,420))}</small></div>`).join('')||'<p>Belum ada riwayat.</p>';}
      status(draft.score?(Number(draft.score.finalized||0)===1?'Nilai resmi terkunci.':'Draft nilai berhasil dimuat.'):'Belum ada draft nilai untuk tahun ini.');
    }catch(err){status('Gagal memuat draft/riwayat: '+err.message);}
    finally{button.disabled=false;}
  });
  const close=()=>modal?.classList.remove('active');
  byId('bpkpOfficialClose')?.addEventListener('click',close);byId('bpkpOfficialCancel')?.addEventListener('click',close);
  byId('bpkpOfficialSave')?.addEventListener('click',async()=>{
    const btn=byId('bpkpOfficialSave');if(btn.disabled)return;
    const val=id=>byId(id)?.value;const adminPassword=val('bpkpOfficialPassword');
    const params={year:currentYear,spip:val('bpkpOfficialSpip'),mri:val('bpkpOfficialMri'),iepk:val('bpkpOfficialIepk'),apip:val('bpkpOfficialApip'),updatedBy:val('bpkpOfficialBy'),note:val('bpkpOfficialNote'),adminPassword,finalize:byId('bpkpOfficialFinalize')?.checked?'true':'false'};
    if(!adminPassword){status('Password admin wajib diisi.');return;}
    btn.disabled=true;btn.textContent='Menyimpan...';status('Memeriksa dan menyimpan nilai resmi...');
    try{const result=await callServerWithRetry('saveBpkpOfficialScore',params,1);bpkpOfficialScore=result.score||null;bpkpScoreLoadedAt=Date.now();bpkpScoreLoadedYear=String(currentYear);setDashboardMode(dashboardMode);fill(bpkpOfficialScore);status(result.message||'Nilai tersimpan.');byId('bpkpOfficialPassword').value='';}
    catch(err){status('Gagal menyimpan: '+err.message);}
    finally{btn.disabled=false;btn.textContent='Simpan Nilai';}
  });
  byId('bpkpOfficialUnlock')?.addEventListener('click',async()=>{const adminPassword=byId('bpkpOfficialPassword')?.value;if(!adminPassword){status('Masukkan password admin untuk membuka kunci.');return;}const btn=byId('bpkpOfficialUnlock');btn.disabled=true;try{const result=await callServerWithRetry('unlockBpkpOfficialScore',{year:currentYear,adminPassword,updatedBy:byId('bpkpOfficialBy')?.value||'Admin Inspektorat'},1);await loadBpkpOfficialScore(true);fill(bpkpOfficialScore);status(result.message||'Kunci dibuka.');}catch(err){status('Gagal membuka kunci: '+err.message);}finally{btn.disabled=false;}});
  document.addEventListener('click',event=>{if(event.target===modal)close();});
  loadBpkpOfficialScore(true).then(()=>setDashboardMode(dashboardMode)).catch(()=>{});
})();
