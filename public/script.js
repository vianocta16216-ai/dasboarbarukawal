// ====== STATUS GLOBAL ======
let rows = [];
let currentYear = new Date().getFullYear().toString();
let SUBUNSUR_DATA = {};
let PARAM_LIST = [];
let saveTimer = null;

// ====== AUTOSAVE OFFLINE / KONEKSI LAMBAT ======
// Perubahan disimpan ke browser terlebih dahulu saat server tidak dapat dihubungi.
// Antrian ini kemudian dikirim ulang otomatis ketika koneksi kembali normal.
const OFFLINE_QUEUE_KEY = 'kawal-spip-offline-save-v1';
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
  // Hanya aksi data yang aman untuk diputar ulang tanpa File object.
  const allowed = new Set(['saveData','saveRow','saveSubunsur','saveField']);
  if (!allowed.has(action)) return;

  const item = {
    action,
    params,
    year: params?.year || currentYear,
    queuedAt: Date.now(),
    reason
  };

  // Gabungkan perubahan yang identik agar antrian tidak membesar.
  let key = `${action}:${item.year}`;
  if (action === 'saveRow') key += `:${params?.row?.id || ''}`;
  if (action === 'saveSubunsur') key += `:${params?.opdId || ''}`;
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
      try {
        const savedRows = typeof p.rows === 'string' ? JSON.parse(p.rows) : p.rows;
        if (Array.isArray(savedRows) && String(item.year) === String(currentYear)) rows = savedRows;
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
        });
        row.nilaiStrukturProses = calculateSA(row);
        row.sa = row.nilaiStrukturProses;
      } else if (row && p.subunsurs) {
        row.subunsurs = p.subunsurs;
        row.nilaiStrukturProses = calculateSA(row);
        row.sa = row.nilaiStrukturProses;
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
  setInterval(() => { autoRetryPendingDriveBackups(); retryIndexedDbUploads(); }, 60000);
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
  const pending=await getPendingUploadsFromIndexedDB();
  for(const rec of pending.slice(0,5)){
    const row=rows.find(r=>r.id===rec.opdId); if(!row) continue;
    try{
      const result=await uploadFile(row,rec.subCode,rec.paramId,rec.level,rec.file,rec.uploadId);
      const container=row.subunsurs=row.subunsurs||{}; container[rec.subCode]=container[rec.subCode]||{}; container[rec.subCode][rec.paramId]=container[rec.subCode][rec.paramId]||{level:0};
      const key='files'+rec.level; container[rec.subCode][rec.paramId][key]=Array.isArray(container[rec.subCode][rec.paramId][key])?container[rec.subCode][rec.paramId][key]:[];
      const existing=container[rec.subCode][rec.paramId][key].find(x=>typeof x==='object'&&x.uploadId===rec.uploadId);
      const item={url:result.url||rec.url||'',fileName:result.fileName||rec.fileName,gdriveId:result.gdriveId||null,syncStatus:result.syncStatus||'retrying',syncError:result.driveError||null,r2Key:result.r2Key||rec.r2Key||null,fileType:rec.fileType||rec.file.type||'application/octet-stream',uploadId:rec.uploadId,uploadedAt:rec.createdAt||new Date().toISOString()};
      if(existing) Object.assign(existing,item); else container[rec.subCode][rec.paramId][key].push(item);
      pendingUploadFiles.delete(rec.uploadId); await deletePendingUploadFromIndexedDB(rec.uploadId);
      renderFileList(row,rec.subCode,rec.paramId,rec.level); render();
    }catch(e){ console.warn('Retry offline file gagal:',rec.uploadId,e); }
  }
}

// ===== TEMPLATE KERTAS KERJA PM TERINTEGRASI (embedded, no network fetch) =====

// ============================================================
// PERUBAHAN KEAMANAN: TAMBAHKAN FUNGSI ESCAPE HTML
// ============================================================
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
  const readOnlyActions=new Set(['getYears','getData','getSubunsurData','getKkSheets','getRtpKkSheets','getRtpEvidence','listBackups']);
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
    const query=new URLSearchParams({action,...params}).toString();
    return fetch(`${functionUrl}?${query}`,{method:'GET'});
  };
  return makeRequest().then(async response=>{
    const text=await response.text();
    let data=null;
    try{data=JSON.parse(text);}catch{}
    if(!response.ok){
      const msg=(data&&data.message)||text.slice(0,200)||`HTTP ${response.status}`;
      const err=new Error(`HTTP ${response.status}: ${msg}`);
      err.status=response.status;
      err.transient=[408,425,429,500,502,503,504].includes(response.status);
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
      await new Promise(r=>setTimeout(r,500*Math.pow(2,attempt)+Math.floor(Math.random()*250)));
    }
  }
  throw lastError;
}

// ====== REALTIME MULTI-USER SYNC ======
let realtimeSocket = null;
let realtimeReconnectTimer = null;
let realtimeReconnectAttempt = 0;
let realtimeStarted = false;
let realtimeServerActive = false;

function websocketUrlForYear(year){
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/realtime?year=${encodeURIComponent(year)}`;
}

function scheduleRealtimeReconnect(){
  clearTimeout(realtimeReconnectTimer);
  if(!navigator.onLine || !realtimeStarted) return;
  const delay=Math.min(15000,1000*Math.pow(2,Math.min(realtimeReconnectAttempt,4)));
  realtimeReconnectAttempt++;
  realtimeReconnectTimer=setTimeout(connectRealtime,delay);
}

async function applyRealtimeOpdUpdate(opdId, hint={}){
  if(!opdId || !navigator.onLine) return;
  try{
    const result=await callServer('getOpd',{opdId,year:currentYear});
    if(result?.status!=='success' || !result.row) return;
    const idx=rows.findIndex(r=>String(r.id)===String(opdId));
    if(idx>=0) rows[idx]=result.row;
    else rows.push(result.row);

    // Never overwrite a user's in-progress form just because another operator
    // updated the same OPD. Refresh the visible file list when it is safe.
    if(editingRowId===opdId && hint.subunsur && hint.paramId && hint.level!=null){
      try{ renderFileList(result.row,hint.subunsur,hint.paramId,String(hint.level)); }catch{}
    }
    render();
    updateKpisLocal();
    const status=document.getElementById('saveStatus');
    if(status && !offlineSaveQueue.length){
      status.textContent='🔄 Data diperbarui operator lain';
      status.dataset.statusType='realtime';
      clearTimeout(window.__realtimeStatusTimer);
      window.__realtimeStatusTimer=setTimeout(()=>{ if(status.dataset.statusType==='realtime') status.textContent=''; },1800);
    }
  }catch(err){
    console.warn('Gagal menerapkan pembaruan realtime:',err);
  }
}

function connectRealtime(){
  clearTimeout(realtimeReconnectTimer);
  if(!realtimeStarted || !navigator.onLine || !currentYear) return;
  try{
    if(realtimeSocket){ try{realtimeSocket.close();}catch{} }
    const ws=new WebSocket(websocketUrlForYear(currentYear));
    realtimeSocket=ws;
    ws.onopen=()=>{
      realtimeReconnectAttempt=0;
      realtimeServerActive=true;
      setConnectionStatus('🟢 Realtime aktif — perubahan operator lain diterima otomatis','success');
      setTimeout(()=>{const el=document.getElementById('saveStatus'); if(el && el.dataset.statusType==='success' && el.textContent.includes('Realtime aktif')) el.textContent='';},1800);
    };
    ws.onmessage=(event)=>{
      try{
        const msg=JSON.parse(event.data||'{}');
        if(msg.type==='connected') return;
        const p=msg.payload||msg;
        if(String(p.year||'')!==String(currentYear)) return;
        if(p.opdId) applyRealtimeOpdUpdate(p.opdId,p);
        else if(p.type==='opd-added') loadData();
      }catch(err){ console.warn('Pesan realtime tidak valid:',err); }
    };
    ws.onclose=()=>{ realtimeServerActive=false; scheduleRealtimeReconnect(); };
    ws.onerror=()=>{ realtimeServerActive=false; try{ws.close();}catch{} };
  }catch(err){
    realtimeServerActive=false;
    scheduleRealtimeReconnect();
  }
}

function initRealtimeSync(){
  if(realtimeStarted) return;
  realtimeStarted=true;
  window.addEventListener('online',()=>{realtimeReconnectAttempt=0;connectRealtime();});
  window.addEventListener('offline',()=>{realtimeServerActive=false;});
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden && (!realtimeSocket || realtimeSocket.readyState!==WebSocket.OPEN)) connectRealtime(); });
  connectRealtime();
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
  document.getElementById('btnAdd').style.display = 'inline-block';
  document.getElementById('btnBackup').style.display = 'inline-block';
  document.getElementById('btnClear').style.display = 'inline-block';
  document.getElementById('btnDeleteYear').style.display = 'inline-block';
  document.getElementById('btnAddYear').style.display = 'inline-block';
  render();
}

// ====== PASSWORD DAFTAR OPD ======
document.getElementById('btnOpdAccess').addEventListener('click', async function() {
  const password = document.getElementById('opdAccessPassword').value.trim();
  const errorDiv = document.getElementById('opdAccessError');
  const valid = await verifyAccess(password);
  if (valid) {
    opdUnlocked = true;
    document.getElementById('opdAccessOverlay').style.display = 'none';
    showOpdList();
  } else {
    errorDiv.textContent = '❌ Password salah!';
    errorDiv.style.display = 'block';
    errorDiv.style.background = '#fee2e2';
    errorDiv.style.color = '#dc2626';
  }
});

document.getElementById('opdAccessPassword').addEventListener('keyup', (e) => { if (e.key === 'Enter') document.getElementById('btnOpdAccess').click(); });
document.getElementById('btnOpdAccessCancel').addEventListener('click', function() {
  document.getElementById('opdAccessOverlay').style.display = 'none';
  showDashboard();
});

// ====== LOAD TAHUN ======
async function loadYears() {
  try {
    const years = await callServer('getYears');
    const select = document.getElementById('yearSelect');
    select.innerHTML = '';
    if (!years || years.length === 0) years = [currentYear];
    const uniqueYears = [...new Set(years)].sort((a,b) => b.localeCompare(a));
    uniqueYears.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      select.appendChild(option);
    });
    if (!uniqueYears.includes(currentYear)) {
      select.value = uniqueYears[0];
      currentYear = uniqueYears[0];
    } else {
      select.value = currentYear;
    }
  } catch (e) {
    console.error('Gagal memuat tahun:', e);
  }
}

// ====== LOAD DATA ======
async function loadData() {
  const status = document.getElementById('saveStatus');
  status.textContent = '⏳ Memuat data...';
  const year = document.getElementById('yearSelect').value;
  currentYear = year;
  document.getElementById('currentYearLabel').textContent = year;
  
  try {
    const data = await callServer('getData', { year });
    rows = [];
    if (Array.isArray(data)) {
      rows = data.map(r => {
        const row = { ...r, nilaiMaturitas:Number(r.nilaiMaturitas ?? r.nilai_maturitas ?? 0) || 0, nilaiKapabilitasApip:r.nilaiKapabilitasApip ?? r.nilai_kapabilitas_apip ?? 0, rtp:r.rtp||'Belum', status:r.status||'Belum', evidence:r.evidence||'Belum', qaApip:r.qaApip||'Belum', mri:r.mri||0, iepk:r.iepk||0, kkData:r.kkData||{}, kkRtpData:r.kkRtpData||{}, kkPmData:r.kkPmData||{}, rtpEvidence:Array.isArray(r.rtpEvidence)?r.rtpEvidence:[], rtpEvidenceFolder:r.rtpEvidenceFolder||'Evidence RTP', strukturProsesStatus:r.strukturProsesStatus||'Belum' };
        row.nilaiStrukturProses = calculateSA(row);
        row.sa = row.nilaiStrukturProses;
        return row;
      });
      rows.sort((a,b)=>{ const x=(parseFloat(b.nilaiMaturitas)||0)-(parseFloat(a.nilaiMaturitas)||0); return x || (parseFloat(b.nilaiStrukturProses)||0)-(parseFloat(a.nilaiStrukturProses)||0); });
      applyOfflineQueueToRows();
    } else {
      console.warn('Data bukan array, rows diset kosong', data);
    }
    originalRows = JSON.parse(JSON.stringify(rows));
    status.textContent = '✅ Data dimuat';
    setTimeout(() => { status.textContent = ''; }, 1500);
    render();
    updateKpisLocal();
  } catch (e) {
    status.textContent = '⚠️ ' + e.message;
    console.error(e);
    // Jangan buang perubahan pengguna ketika server sedang tidak dapat diakses.
    applyOfflineQueueToRows();
    if (!offlineSaveQueue.length) rows = [];
    render();
    updateKpisLocal();
  }
}

// ====== FUNGSI: Hitung SA berdasarkan 43 total parameter ======
function calculateSA(row) {
    if (!row.subunsurs) return 0;
    let totalLevel = 0;
    let totalParams = 0;
    Object.keys(SUBUNSUR_DATA).forEach(subCode => {
        if (SUBUNSUR_DATA[subCode].params) {
            totalParams += SUBUNSUR_DATA[subCode].params.length;
        }
    });
    Object.keys(row.subunsurs).forEach(subCode => {
        Object.keys(row.subunsurs[subCode]).forEach(paramId => {
            const level = row.subunsurs[subCode][paramId].level;
            if (level > 0) totalLevel += level;
        });
    });
    return totalParams > 0 ? Math.round((totalLevel / totalParams) * 100) / 100 : 0;
}

// ====== HITUNG KPI LOKAL ======
function updateKpisLocal(){
  const total = rows.length;
  const avgAll = field => total ? rows.reduce((sum,r)=>sum + (Number(r[field]) || 0),0) / total : 0;
  const avgFilled = field => { const a=rows.map(r=>Number(r[field])).filter(v=>Number.isFinite(v)&&v>0); return a.length?a.reduce((x,y)=>x+y,0)/a.length:0; };
  const pct=(n,d)=>d?Math.round(n/d*100):0;
  const struktur = rows.map(r=>Number(r.nilaiStrukturProses)||0);
  const maturitas = rows.map(r=>Number(r.nilaiMaturitas)||0).filter(v=>v>0);
  const mri = rows.map(r=>Number(r.mri)||0).filter(v=>v>0);
  const iepk = rows.map(r=>Number(r.iepk)||0).filter(v=>v>0);
  const kap = rows.map(r=>Number(r.nilaiKapabilitasApip)||0).filter(v=>v>0);
  const qa=rows.filter(r=>r.qaApip==='Selesai').length, status=rows.filter(r=>r.status==='Selesai').length, rtp=rows.filter(r=>r.rtp==='Selesai').length, ev=rows.filter(r=>Array.isArray(r.rtpEvidence)&&r.rtpEvidence.length).length;
  applyKpis({
    rataStrukturProses:avgAll('nilaiStrukturProses'),
    rataMaturitas:avgFilled('nilaiMaturitas'),
    rataMRI:avgFilled('mri'),
    rataIEPK:avgFilled('iepk'),
    rataKapabilitasApip:avgFilled('nilaiKapabilitasApip'),
    qaApip:pct(qa,total), statusSelesai:pct(status,total), rtpSelesai:pct(rtp,total), evidenceRtp:pct(ev,total),
    total, strukturCount:total, maturitasCount:maturitas.length, mriCount:mri.length, iepkCount:iepk.length, kapabilitasCount:kap.length,
    qaApipCount:qa,statusSelesaiCount:status,rtpSelesaiCount:rtp,evidenceRtpCount:ev
  });
}
function applyKpis(k){const t=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;},b=(id,v)=>{const e=document.getElementById(id);if(e)e.style.width=Math.max(0,Math.min(100,v))+'%';};t('kpiStrukturProses',k.rataStrukturProses.toFixed(2));b('kpiStrukturProsesBar',k.rataStrukturProses/5*100);t('kpiStrukturProsesNote',k.total+' OPD');t('kpiMaturitas',k.rataMaturitas.toFixed(2));b('kpiMaturitasBar',k.rataMaturitas/5*100);t('kpiMaturitasNote',k.maturitasCount+' OPD terisi');t('kpiMRI',k.rataMRI.toFixed(2));b('kpiMRIBar',k.rataMRI/5*100);t('kpiMRINote',k.mriCount+' OPD terisi');t('kpiIEPK',k.rataIEPK.toFixed(2));b('kpiIEPKBar',k.rataIEPK/5*100);t('kpiIEPKNote',k.iepkCount+' OPD terisi');t('kpiKapabilitasApip',k.rataKapabilitasApip.toFixed(2));b('kpiKapabilitasApipBar',k.rataKapabilitasApip/5*100);t('kpiKapabilitasApipNote',k.kapabilitasCount+' OPD terisi');t('kpiQaApip',k.qaApip+'%');b('kpiQaApipBar',k.qaApip);t('kpiQaApipNote',k.qaApipCount+' dari '+k.total+' OPD');t('kpiStatusSelesai',k.statusSelesai+'%');b('kpiStatusSelesaiBar',k.statusSelesai);t('kpiStatusSelesaiNote',k.statusSelesaiCount+' dari '+k.total+' OPD');t('kpiRtpSelesai',k.rtpSelesai+'%');b('kpiRtpSelesaiBar',k.rtpSelesai);t('kpiRtpSelesaiNote',k.rtpSelesaiCount+' dari '+k.total+' OPD');t('kpiEvidenceRtp',k.evidenceRtp+'%');b('kpiEvidenceRtpBar',k.evidenceRtp);t('kpiEvidenceRtpNote',k.evidenceRtpCount+' dari '+k.total+' OPD');}

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
      const struktur = calculateSA(r);
      r.nilaiStrukturProses = struktur;
      r.sa = struktur;
      const totalParams = PARAM_LIST.length || 43;
      let countEvidence = 0;
      if (PARAM_LIST.length) {
        PARAM_LIST.forEach(param => {
          const subData = r.subunsurs && r.subunsurs[param.subCode] && r.subunsurs[param.subCode][param.paramId];
          if (subData) {
            let hasFile = false;
            for (let lv = 1; lv <= 5; lv++) {
              const files = subData['files' + lv];
              if (Array.isArray(files) && files.length > 0) { hasFile = true; break; }
            }
            if (hasFile) countEvidence++;
          }
        });
      }
      const strukturStatus = countEvidence === totalParams ? 'Selesai' : (countEvidence > 0 ? 'Proses' : 'Belum');
      r.strukturProsesStatus = strukturStatus;
      let badgeClass = 'badge-kosong';
      let badgeLabel = `Belum (${countEvidence}/${totalParams})`;
      if (countEvidence === totalParams) { badgeClass = 'badge-lengkap'; badgeLabel = `Lengkap (${countEvidence}/${totalParams})`; }
      else if (countEvidence > 0) { badgeClass = 'badge-sebagian'; badgeLabel = `Sebagian (${countEvidence}/${totalParams})`; }
      return `<tr>
        <td style="text-align:center;">${index + 1}</td>
        <td><div style="display:flex; align-items:center; gap:8px;"><span style="font-weight:500;">${escapeHtml(r.opd || 'Tanpa Nama')}</span><button class="btn-edit-name" data-id="${r.id}" title="Ubah Nama" style="background:none;border:none;cursor:pointer;font-size:18px;padding:0;">✏️</button></div></td>
        <td><input class="manual-maturity-value" type="number" step="0.01" min="0" max="5" value="${Number(r.nilaiMaturitas||0).toFixed(2)}" data-id="${r.id}" data-field="nilaiMaturitas" aria-label="Nilai Maturitas manual" title="Isi manual nilai maturitas (0 sampai 5)"></td>
        <td><input type="number" step="0.01" min="0" max="5" value="${Number(r.mri||0).toFixed(2)}" data-id="${r.id}" data-field="mri"></td>
        <td><input type="number" step="0.01" min="0" max="5" value="${Number(r.iepk||0).toFixed(2)}" data-id="${r.id}" data-field="iepk"></td>
        <td><input type="number" step="0.01" min="0" max="5" value="${Number(r.nilaiKapabilitasApip||0).toFixed(2)}" data-id="${r.id}" data-field="nilaiKapabilitasApip"></td>
        <td>${selectHtml(r.id,'qaApip',r.qaApip,['Selesai','Proses','Belum'])}</td>
        <td>${selectHtml(r.id,'status',r.status,['Selesai','Proses','Belum'])}</td>
        <td>${selectHtml(r.id,'evidence',r.evidence,['Lengkap','Sebagian','Belum'])}</td>
        <td>${selectHtml(r.id,'rtp',r.rtp,['Selesai','Belum'])}</td>
        <td><input class="auto-structure-value" type="number" value="${Number(struktur).toFixed(2)}" readonly aria-label="Nilai Struktur dan Proses otomatis" title="Otomatis dari 43 parameter"></td>
        <td><span class="badge ${strukturStatus==='Selesai'?'badge-lengkap':(strukturStatus==='Proses'?'badge-sebagian':'badge-kosong')}">${strukturStatus}</span></td>
        <td><span class="badge ${badgeClass}" title="Jumlah parameter dengan evidence pada 43 parameter">${badgeLabel}</span></td>
        <td><button class="btn-detail" data-id="${r.id}" title="Evidence Struktur dan Proses">📁</button></td>
        <td><button class="btn-kk" data-id="${r.id}" title="Buka Spreadsheet Kertas Kerja SPIP">📊</button></td>
        <td><button class="btn-kk-rtp" data-id="${r.id}" title="Buka Spreadsheet Kertas Kerja RTP">📋</button></td>
        <td><button class="btn-rtp-evidence" data-id="${r.id}" title="Upload Evidence RTP">📤</button><div class="rtp-evidence-count">${Array.isArray(r.rtpEvidence)?r.rtpEvidence.length:0}</div></td>
        <td><button class="del-btn" data-id="${r.id}" title="Hapus">&times;</button></td>
      </tr>`;
    }).join('');
  }
  attachHandlers();
}

function selectHtml(id, field, value, options) {
  const opts = options.map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('');
  return `<select data-id="${id}" data-field="${field}">${opts}</select>`;
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

      callServer('saveField', { opdId: id, field: field, value: val, year: currentYear })
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
      row[field] = e.target.value;

      showIndicator(e.target, '⏳ Menyimpan...', 'saving');

      callServer('saveField', { opdId: id, field: field, value: e.target.value, year: currentYear })
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
    qaApip:'Persentase QA APIP Selesai',
    statusSelesai:'Persentase OPD Selesai (Status)',
    rtpSelesai:'Persentase RTP Selesai',
    evidenceRtp:'Persentase OPD dengan Evidence RTP'
  };

  let labels=[];
  let data=[];
  let backgroundColor=[];
  let borderColor=[];
  let typeChart='bar';
  let totalCount=0;
  let countTrue=0;
  let countFalse=0;

  if (!rows || rows.length===0) {
    alert('Data OPD belum tersedia!');
    return;
  }

  const isLineChart=['nilaiStrukturProses','nilaiMaturitas','rataMRI','rataIEPK','nilaiKapabilitasApip'].includes(type);

  if (isLineChart) {
    let chartData=[...rows];
    const field=type==='nilaiStrukturProses'?'nilaiStrukturProses':type==='nilaiMaturitas'?'nilaiMaturitas':type==='rataMRI'?'mri':type==='rataIEPK'?'iepk':'nilaiKapabilitasApip';
    chartData.sort((a,b)=>(parseFloat(b[field])||0)-(parseFloat(a[field])||0));
    labels=chartData.map(r=>r.opd||'OPD Tanpa Nama');
    data=chartData.map(r=>Math.max(0,Math.min(5,parseFloat(r[field])||0)));
    typeChart='line';
  } else if (type==='opdLevel3') {
    totalCount=rows.length;
    countTrue=rows.filter(r=>(parseFloat(r.sa)||0)>=3).length;
    countFalse=totalCount-countTrue;
    labels=['Level >= 3','Level < 3']; data=[countTrue,countFalse];
    backgroundColor=['#10b981','#e2e8f0']; borderColor=['#ffffff','#ffffff']; typeChart='pie';
  } else if (type==='qaApip') {
    totalCount=rows.length;
    countTrue=rows.filter(r=>r.qaApip==='Selesai').length;
    countFalse=totalCount-countTrue;
    labels=['Selesai','Proses/Belum']; data=[countTrue,countFalse];
    backgroundColor=['#f59e0b','#e2e8f0']; borderColor=['#ffffff','#ffffff']; typeChart='pie';
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

// ====== INISIALISASI AWAL (LANGSUNG KE DASHBOARD) ======
(async function init() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingFill = document.getElementById('loadingFill');
  const loadingPercent = document.getElementById('loadingPercent');
  const loadingStatus = document.getElementById('loadingStatus');
  const loadingError = document.getElementById('loadingError');

  function setProgress(pct, status) {
    loadingFill.style.width = pct + '%';
    loadingPercent.textContent = Math.round(pct) + '%';
    loadingStatus.textContent = status;
  }

  const timeoutId = setTimeout(() => {
    loadingError.style.display = 'block';
    loadingError.textContent = 'Terlalu lama memuat data. Periksa server / koneksi internet Anda.';
    loadingStatus.textContent = 'Gagal memuat...';
  }, 10000);

  initOfflineAutosave();
  initRealtimeSync();

  try {
    setProgress(10, 'Memuat data subunsur...');
    SUBUNSUR_DATA = await callServer('getSubunsurData');
    PARAM_LIST = [];
    Object.keys(SUBUNSUR_DATA).forEach(subCode => {
      SUBUNSUR_DATA[subCode].params.forEach(param => {
        PARAM_LIST.push({ subCode: subCode, paramId: param.id, desc: param.desc, levels: param.levels });
      });
    });
    
    setProgress(50, 'Memuat daftar tahun...');
    await loadYears();
    
    setProgress(80, 'Memuat data OPD...');
    await loadData();
    
    clearTimeout(timeoutId);
    setProgress(100, 'Selesai! Membuka dashboard...');
    setTimeout(() => {
      loadingOverlay.classList.add('hidden');
      showDashboard();
    }, 400);
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('Inisialisasi gagal:', e);
    loadingError.style.display = 'block';
    loadingError.textContent = 'Terjadi kesalahan: ' + e.message;
    loadingStatus.textContent = 'Gagal memuat data';
    document.getElementById('saveStatus').textContent = '⚠️ ' + e.message;
  }
})();

// ====== EVENT NAVIGASI ======
document.getElementById('btnOpdListNav').addEventListener('click', showOpdList);
document.getElementById('btnDashboardNav').addEventListener('click', showDashboard);

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
let editingRowId = null;
let editingSubunsurSnapshot = null;
let fileToDelete = null;
async function openEditModal(id) {
  const row = rows.find(r => r.id === id);
  if (!row) return;
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

  const sortedSubs = Object.keys(SUBUNSUR_DATA).sort((a,b) => parseFloat(a) - parseFloat(b));

  sortedSubs.forEach(subCode => {
    const subInfo = SUBUNSUR_DATA[subCode];
    const subDiv = document.createElement('div');
    subDiv.className = 'sub-item';
    subDiv.innerHTML = `<label>${subInfo.label}</label>`;
    
    const sortedParams = [...subInfo.params].sort((a,b) => parseFloat(a.id) - parseFloat(b.id));
    
    sortedParams.forEach(param => {
      const data = (row.subunsurs[subCode] && row.subunsurs[subCode][param.id]) || { level: 0 };
      const paramDiv = document.createElement('div');
      paramDiv.style.borderTop = '1px solid var(--border)';
      paramDiv.style.paddingTop = '10px';
      paramDiv.style.marginTop = '10px';
      const paramsHtml = `<div class="params-box"><p><strong style="font-size:14px;">Parameter:</strong> <span class="param-desc-text">${param.desc}</span></p></div>`;
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
  <div class="file-list" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
</div>`;
      }
      evidHtml += `</div>`;
      paramDiv.innerHTML = paramsHtml + levelSelect + evidHtml;
      subDiv.appendChild(paramDiv);
    });
    container.appendChild(subDiv);
  });

  document.getElementById('editModal').classList.add('active');
  sortedSubs.forEach(subCode => {
    SUBUNSUR_DATA[subCode].params.forEach(param => {
      for (let lv = 1; lv <= 5; lv++) renderFileList(row, subCode, param.id, lv);
    });
  });

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
          await deletePendingUploadFromIndexedDB(sessionUploadId);
          fill.style.width = '100%';
          text.textContent = result.syncStatus === 'done' ? '100% • Drive OK' : '100% • Retry Drive';
          if (!targetRow.subunsurs[subCode][paramId]['files' + level]) targetRow.subunsurs[subCode][paramId]['files' + level] = [];
          targetRow.subunsurs[subCode][paramId]['files' + level].push({
            url: result.url,
            fileName: result.fileName || file.name,
            gdriveId: result.gdriveId || null,
            syncStatus: result.syncStatus || 'pending',
            syncError: result.driveError || null,
            r2Key: result.r2Key || null,
            fileType: file.type || 'application/octet-stream',
            uploadId: result.uploadId || null,
            uploadedAt: new Date().toISOString()
          });
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
              if (!targetRow.subunsurs[subCode][paramId]['files'+level]) targetRow.subunsurs[subCode][paramId]['files'+level]=[];
              targetRow.subunsurs[subCode][paramId]['files'+level].push({url:result.url,fileName:result.fileName||file.name,gdriveId:result.gdriveId||null,syncStatus:result.syncStatus||'pending',syncError:result.driveError||null,r2Key:result.r2Key||null,fileType:file.type||'application/octet-stream',uploadId:result.uploadId||sessionUploadId,uploadedAt:new Date().toISOString()});
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
            if (!targetRow.subunsurs[subCode][paramId]['files' + level]) targetRow.subunsurs[subCode][paramId]['files' + level] = [];
            const list=targetRow.subunsurs[subCode][paramId]['files'+level];
            list.push({url:'',fileName:file.name,gdriveId:null,syncStatus:'retrying',syncError:err.message,r2Key:null,fileType:file.type||'application/octet-stream',uploadId:sessionUploadId,localPending:true,uploadedAt:new Date().toISOString()});
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
// Batas upload: setiap file maksimal 10 MB DAN total seluruh file yang dipilih dalam satu aksi maksimal 10 MB.
// Tidak ada batas jumlah file; jumlah file mengikuti kapasitas total 10 MB per aksi pilih file.
const MAX_FILE_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_BATCH_UPLOAD_BYTES = 10 * 1024 * 1024;

function validateSelectedUploadFiles(files, label='file') {
  const list = Array.from(files || []);
  if (!list.length) return;
  const tooBig = list.filter(f => f.size > MAX_FILE_UPLOAD_BYTES);
  if (tooBig.length) {
    throw new Error(`${tooBig.length} ${label} melebihi 10 MB per file: ${tooBig[0].name}`);
  }
  const total = list.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
  if (total > MAX_BATCH_UPLOAD_BYTES) {
    const totalMb = (total / 1024 / 1024).toFixed(2);
    throw new Error(`Total ${label} yang dipilih ${totalMb} MB. Maksimal total 10 MB per sekali pilih/upload.`);
  }
}

async function uploadFile(row, subCode, paramId, level, file, existingUploadId=null) {
  if(!file)return;
  if(file.size>MAX_FILE_UPLOAD_BYTES)throw new Error('File terlalu besar! Maks 10 MB per file.');
  const uploadId=existingUploadId||crypto.randomUUID();
  const payload={__binaryFile:file,opdId:row.id,opdName:row.opd||'OPD',subunsur:subCode,paramId,level:String(level),year:currentYear,fileName:file.name,fileType:file.type||'application/octet-stream',uploadId};
  const result=await callServerWithRetry('uploadFile',payload,2);
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

function renderFileList(row, subCode, paramId, level) {
  const rowEl = document.querySelector(`.evid-row[data-sub="${subCode}"][data-param="${paramId}"][data-level="${level}"]`);
  if (!rowEl) return;
  const fileListEl = rowEl.querySelector('.file-list');
  if (!fileListEl) return;

  const files = (row.subunsurs[subCode] && row.subunsurs[subCode][paramId] && row.subunsurs[subCode][paramId]['files' + level]) || [];
  fileListEl.innerHTML = '';
  if (files.length === 0) {
    fileListEl.innerHTML = '<span style="font-size:12px;color:#64748b;">Belum ada file.</span>';
    return;
  }

  files.forEach((fileObj, index) => {
    let fileUrl, fileName;
    if (typeof fileObj === 'string') {
      fileUrl = fileObj;
      const urlParts = fileUrl.split('?')[0].split('/');
      fileName = decodeURIComponent(urlParts[urlParts.length - 1]) || `File ${index + 1}`;
    } else {
      fileUrl = fileObj.url || '';
      fileName = fileObj.fileName || fileObj.name || `File ${index + 1}`;
    }

    const ext = fileName.split('.').pop().toLowerCase();
    let displayUrl = fileUrl;

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
       displayUrl = fileUrl;
    }
    else if (['xls', 'xlsx'].includes(ext)) {
       displayUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
    }
    else if (['pdf', 'doc', 'docx', 'ppt', 'pptx'].includes(ext)) {
       displayUrl = `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(fileUrl)}`;
    }

    const div = document.createElement('div');
    div.style.cssText = 'display:flex; align-items:center; gap:8px; background:#f1f5f9; padding:6px; border-radius:6px; margin-top:6px; flex-wrap:wrap;';
    const status = typeof fileObj === 'object' ? (fileObj.syncStatus || (fileObj.gdriveId ? 'done' : 'pending')) : 'pending';
    const statusLabel = status === 'done' ? '✅ R2 + Google Drive' : (status === 'retrying' ? '🔄 Perlu Retry Google Drive' : '⏳ Menyimpan ke R2 + Google Drive');
    const retryButton = (status !== 'done') && typeof fileObj === 'object' && fileObj.uploadId ? `<button type="button" onclick="retryUploadedFile('${row.id}','${subCode}','${paramId}',${level},'${fileObj.uploadId}')" style="background:#dbeafe;color:#1d4ed8;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;">↻ Retry</button>` : '';
    div.innerHTML = `
      <a href="${displayUrl}" target="_blank" rel="noopener" class="file-link" style="flex-grow:1; min-width:220px; margin:0;">📎 ${escapeHtml(fileName)}</a>
      <span style="font-size:11px;color:#475569;">${statusLabel}</span>
      ${retryButton}
      <button type="button" onclick="removeUploadedFile('${row.id}', '${subCode}', '${paramId}', ${level}, '${fileUrl}')" style="background:#fee2e2; color:#dc2626; border:none; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:12px;">🗑️ Hapus</button>
    `;
    fileListEl.appendChild(div);
  });
}
async function retryUploadedFile(opdId, subCode, paramId, level, uploadId) {
  const row = rows.find(r => r.id === opdId); if(!row) return;
  const files = row.subunsurs?.[subCode]?.[paramId]?.['files'+level] || [];
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

async function autoRetryPendingDriveBackups() {
  if (!navigator.onLine || !Array.isArray(rows)) return;
  let attempted = 0;
  for (const row of rows) {
    if (attempted >= 3) break; // cap background traffic per browser cycle
    const subunsurs = row?.subunsurs || {};
    for (const subCode of Object.keys(subunsurs)) {
      if (attempted >= 3) break;
      const params = subunsurs[subCode] || {};
      for (const paramId of Object.keys(params)) {
        if (attempted >= 3) break;
        for (let level = 1; level <= 5; level++) {
          const files = params[paramId]?.['files' + level];
          if (!Array.isArray(files)) continue;
          const pending = files.find(f => typeof f === 'object' && f.uploadId && f.syncStatus !== 'done');
          if (!pending) continue;
          try {
            const r = await callServerWithRetry('retryDriveBackup', {opdId:row.id,year:currentYear,uploadId:pending.uploadId,type:'evidence',subunsur:subCode,paramId,level},1);
            if (r?.gdriveId) {
              pending.gdriveId = r.gdriveId;
              pending.syncStatus = 'done';
              pending.storage = 'R2 + Google Drive';
              pending.syncError = null;
            } else {
              pending.syncStatus = 'retrying';
              pending.syncError = r?.driveError || pending.syncError || 'Menunggu Google Drive';
            }
            renderFileList(row,subCode,paramId,level);
            attempted++;
          } catch (_) {
            attempted++;
          }
        }
      }
    }
  }
}

function removeUploadedFile(opdId, subCode, paramId, level, fileUrl) {
  const row = rows.find(r => r.id === opdId);
  if (!row) return;
  const files = row.subunsurs[subCode][paramId]['files' + level] || [];
  const fileObj = files.find(f => f.url === fileUrl);
  const fileName = fileObj ? fileObj.fileName : 'File';
  fileToDelete = { 
    opdId, 
    subCode, 
    paramId, 
    level, 
    fileUrl, 
    fileName, 
    gdriveId: fileObj ? fileObj.gdriveId : null   // <---- TAMBAHKAN INI
  };
  document.getElementById('fileDeleteMessage').textContent = `Yakin ingin menghapus file "${fileName}"?`;
  document.getElementById('fileDeleteModal').classList.add('active');
}

document.getElementById('fileDeleteOk').addEventListener('click', async function() {
  if (isDeletingFile) return;
  if (!fileToDelete) return;
  isDeletingFile = true;
  const btnOk = this;
  btnOk.disabled = true;
  btnOk.textContent = '⏳ Menghapus...';
  
  const { opdId, subCode, paramId, level, fileUrl, gdriveId } = fileToDelete;  // <---- Ambil gdriveId
  const row = rows.find(r => r.id === opdId);
  if (row) {
    try {
      const result = await callServerWithRetry('deleteFile', { fileUrl, gdriveId, opdId, subunsur: subCode, paramId, level, year: currentYear });  // <---- Kirim gdriveId
      if (result.status === 'error') { 
        showWarning('❌ ' + result.message); 
        return; 
      }
      const files = row.subunsurs[subCode][paramId]['files' + level] || [];
      const index = files.findIndex(f => f.url === fileUrl);
      if (index > -1) {
        files.splice(index, 1);
        renderFileList(row, subCode, paramId, level);
      }
    } catch (err) {
      showWarning('❌ ' + err.message);
    }
  }
  document.getElementById('fileDeleteModal').classList.remove('active');
  fileToDelete = null;
  isDeletingFile = false;
  btnOk.disabled = false;
  btnOk.textContent = 'Ya, Hapus';
});

// ====== MODAL SAVE EDIT SUBUNSUR ======
document.getElementById('modalSave').addEventListener('click', async function() {
  if (!editingRowId) return;
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
    setTimeout(() => { closeEditModal(); render(); }, 500);
    return;
  }

  modalStatus.textContent = '⏳ Menyimpan perubahan...';
  const saveParams = {opdId:row.id, year:currentYear, changes};
  try {
    const saved=await callServerWithRetry('saveSubunsur', saveParams);
    if(saved?.nilaiStrukturProses!=null){row.nilaiStrukturProses=saved.nilaiStrukturProses;row.sa=saved.nilaiStrukturProses;row.strukturProsesStatus=saved.strukturProsesStatus||row.strukturProsesStatus;}
    modalStatus.style.color = '#16a34a';
    modalStatus.textContent = '✅ Perubahan berhasil disimpan!';
    setTimeout(() => { closeEditModal(); render(); }, 600);
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
});

// ====== TAMBAH OPD ======
document.getElementById('btnAdd').addEventListener('click', () => {
  document.getElementById('addOpdModal').classList.add('active');
});
document.getElementById('addOpdCancel').addEventListener('click', function() {
  document.getElementById('addOpdModal').classList.remove('active');
});
document.getElementById('addOpdOk').addEventListener('click', async function() {
  if (isAddingOpd) return;
  isAddingOpd = true;
  const btnOk = document.getElementById('addOpdOk');
  btnOk.disabled = true;
  btnOk.textContent = '⏳ Menambahkan...';
  try {
    const newOpd = { id:'r'+Math.random().toString(36).slice(2,9), opd:'OPD Baru', sa:0, nilaiStrukturProses:0, nilaiMaturitas:0, nilaiKapabilitasApip:0, evidence:'Belum', qaApip:'Belum', mri:0, iepk:0, rtp:'Belum', status:'Belum', strukturProsesStatus:'Belum', subunsurs:{}, kkData:{}, kkRtpData:{}, rtpEvidence:[] };
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
  if (year === '2026') {
    showWarning('Tahun default 2026 tidak dapat dihapus.');
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
    currentYear = '2026';
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

// ====== MODAL WARNING ======
document.getElementById('warningOk').addEventListener('click', function() {
  document.getElementById('warningModal').classList.remove('active');
});

function showWarning(message) {
  document.getElementById('warningMessage').textContent = message;
  document.getElementById('warningModal').classList.add('active');
}

// ====== MODAL CLOSE EDIT ======
document.getElementById('modalClose').addEventListener('click', closeEditModal);
document.getElementById('modalCancel').addEventListener('click', closeEditModal);
function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
  editingRowId = null;
  editingSubunsurSnapshot = null;
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
      showDashboard();
    } catch (e) {
      console.error('Inisialisasi gagal:', e);
      document.getElementById('saveStatus').textContent = '⚠️ ' + e.message;
    }
  })();
}
// ====== SINKRONISASI OTOMATIS ======
setInterval(async function() {
  if (!isSaving && !pendingSave && !kkPmDirty) {
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

// ===== EVIDENCE RTP =====
let rtpEvidenceEditingRowId=null;function rtpEvidenceSetStatus(msg,type=''){const e=document.getElementById('rtpEvidenceStatus');if(!e)return;e.textContent=msg||'';e.className='sheet-links-status'+(type?' '+type:'');e.style.display=msg?'block':'none';}
function renderRtpEvidenceList(row){const e=document.getElementById('rtpEvidenceList');if(!e)return;const a=Array.isArray(row.rtpEvidence)?row.rtpEvidence:[];if(!a.length){e.innerHTML='<div class="sheet-link-card">Belum ada evidence RTP.</div>';return;}e.innerHTML='<div class="rtp-file-list">'+a.map((f,i)=>{const status=f.gdriveId?'✅ Google Drive + R2':(f.syncStatus==='retrying'?'🔄 Perlu Retry Google Drive':'⏳ Mengirim ke Google Drive');const retry=(f.gdriveId||!f.uploadId)?'':`<button class="rtp-retry-btn" data-upload-id="${sheetLinksEsc(f.uploadId)}">↻ Retry</button>`;return `<div class="rtp-file-item"><div><div class="rtp-file-name">📄 ${sheetLinksEsc(f.fileName||'File')}</div><div class="rtp-file-meta">${status}${f.uploadedAt?' · '+sheetLinksEsc(f.uploadedAt):''}</div></div><div class="rtp-file-actions"><a href="${sheetLinksEsc(f.url||'#')}" target="_blank" rel="noopener noreferrer">Buka</a>${retry}<button class="rtp-delete-btn" data-index="${i}">Hapus</button></div></div>`;}).join('')+'</div>';}
async function openRtpEvidenceModal(id){const row=rows.find(r=>r.id===id);if(!row)return;const modal=document.getElementById('rtpEvidenceModal');const opdName=document.getElementById('rtpEvidenceOpdName');if(!modal||!opdName){console.error('Modal Evidence RTP belum tersedia di DOM.');return;}rtpEvidenceEditingRowId=id;opdName.textContent=row.opd||'Tanpa Nama';const folderInput=document.getElementById('rtpEvidenceFolderName');const preview=document.getElementById('rtpEvidenceFolderPreview');const setPreview=()=>{if(preview)preview.textContent=(folderInput?.value||'').trim()||'Evidence RTP';};if(folderInput){folderInput.value=row.rtpEvidenceFolder||'Evidence RTP';folderInput.oninput=setPreview;}setPreview();modal.classList.add('active');rtpEvidenceSetStatus('Memuat daftar evidence RTP...');try{const d=await callServer('getRtpEvidence',{opdId:id,year:currentYear});row.rtpEvidence=Array.isArray(d.rtpEvidence)?d.rtpEvidence:[];row.rtpEvidenceFolder=d.folderName||row.rtpEvidenceFolder||'Evidence RTP';if(folderInput)folderInput.value=row.rtpEvidenceFolder;setPreview();renderRtpEvidenceList(row);rtpEvidenceSetStatus('Silakan tulis nama folder, lalu upload file.','success');}catch(err){rtpEvidenceSetStatus('Gagal memuat: '+err.message,'error');}}
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
  row.rtpEvidence=Array.isArray(d.rtpEvidence)?d.rtpEvidence:[];row.rtpEvidenceFolder=d.folderName||folderName;renderRtpEvidenceList(row);render();
  rtpEvidenceSetStatus(d.syncStatus==='done'?'✅ File masuk Google Drive + R2.':(d.syncStatus==='retrying'?'⚠️ File aman di R2; Google Drive belum berhasil. Retry tersedia.':'⚠️ File aman di R2; retry Google Drive tersedia.'),'success');
}

document.getElementById('rtpEvidenceFolderSave')?.addEventListener('click',async()=>{const row=rows.find(r=>r.id===rtpEvidenceEditingRowId);const input=document.getElementById('rtpEvidenceFolderName');const preview=document.getElementById('rtpEvidenceFolderPreview');if(!row||!input)return;const folderName=(input.value||'').trim()||'Evidence RTP';if(folderName.length>100){rtpEvidenceSetStatus('Nama folder maksimal 100 karakter.','error');return;}try{rtpEvidenceSetStatus('Menyimpan nama folder...');const d=await callServerWithRetry('saveRtpEvidenceFolder',{opdId:row.id,year:currentYear,folderName});row.rtpEvidenceFolder=d.folderName||folderName;input.value=row.rtpEvidenceFolder;if(preview)preview.textContent=row.rtpEvidenceFolder;rtpEvidenceSetStatus('Nama folder tersimpan. File berikutnya akan masuk ke folder ini.','success');}catch(err){rtpEvidenceSetStatus('Gagal menyimpan nama folder: '+err.message,'error');}});document.getElementById('rtpEvidenceChoose')?.addEventListener('click',()=>document.getElementById('rtpEvidenceInput')?.click());document.getElementById('rtpEvidenceInput')?.addEventListener('change',async e=>{
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
});document.getElementById('rtpEvidenceList')?.addEventListener('click',async e=>{const rb=e.target.closest('.rtp-retry-btn');if(rb){const row=rows.find(r=>r.id===rtpEvidenceEditingRowId);if(!row)return;const f=(row.rtpEvidence||[]).find(x=>x.uploadId===rb.dataset.uploadId);if(!f)return;try{f.syncStatus='retrying';renderRtpEvidenceList(row);rtpEvidenceSetStatus('Mencoba ulang backup Google Drive...');const d=await callServerWithRetry('retryDriveBackup',{opdId:row.id,year:currentYear,type:'rtp',uploadId:f.uploadId},2);f.gdriveId=d.gdriveId||f.gdriveId||null;f.syncStatus=d.syncStatus||'retrying';f.syncError=d.driveError||null;renderRtpEvidenceList(row);render();rtpEvidenceSetStatus(f.gdriveId?'✅ R2 + Google Drive tersimpan.':'🔄 Google Drive belum berhasil. Silakan Retry.',f.gdriveId?'success':'');}catch(err){f.syncStatus='retrying';f.syncError=err.message;renderRtpEvidenceList(row);rtpEvidenceSetStatus('Retry gagal: '+err.message,'error');}return;}const b=e.target.closest('.rtp-delete-btn');if(!b)return;const row=rows.find(r=>r.id===rtpEvidenceEditingRowId);if(!row)return;const f=(row.rtpEvidence||[])[Number(b.dataset.index)];if(!f)return;try{rtpEvidenceSetStatus('Menghapus...');const d=await callServerWithRetry('deleteRtpEvidence',{opdId:row.id,year:currentYear,fileUrl:f.url,gdriveId:f.gdriveId||null});row.rtpEvidence=Array.isArray(d.rtpEvidence)?d.rtpEvidence:[];renderRtpEvidenceList(row);render();rtpEvidenceSetStatus('File dihapus.','success');}catch(err){rtpEvidenceSetStatus('Gagal hapus: '+err.message,'error');}});document.getElementById('rtpEvidenceRefresh')?.addEventListener('click',()=>{if(rtpEvidenceEditingRowId)openRtpEvidenceModal(rtpEvidenceEditingRowId);});function closeRtpEvidenceModal(){document.getElementById('rtpEvidenceModal')?.classList.remove('active');rtpEvidenceEditingRowId=null;}document.getElementById('rtpEvidenceClose')?.addEventListener('click',closeRtpEvidenceModal);document.getElementById('rtpEvidenceCloseFooter')?.addEventListener('click',closeRtpEvidenceModal);
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
  else if(btn.classList.contains('btn-detail')) openEditModal(btn.getAttribute('data-id'));
  else if(btn.classList.contains('btn-kk')) openSpreadsheetModal(btn.getAttribute('data-id'));
  else if(btn.classList.contains('btn-kk-rtp')) openKkRtp(btn.getAttribute('data-id'));
  else if(btn.classList.contains('btn-rtp-evidence')) openRtpEvidenceModal(btn.getAttribute('data-id'));
  else if(btn.classList.contains('del-btn')) openConfirmModal(btn.getAttribute('data-id'));
});
