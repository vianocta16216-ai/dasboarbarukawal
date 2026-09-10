// ====== STATUS GLOBAL ======
let rows = [];
let currentYear = new Date().getFullYear().toString();
let SUBUNSUR_DATA = {};
let PARAM_LIST = [];
let saveTimer = null;
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
    if(!response.ok){const err=new Error(`HTTP ${response.status}: ${text.slice(0,160)}`);err.status=response.status;err.transient=[429,500,502,503,504].includes(response.status);throw err;}
    let data;try{data=JSON.parse(text);}catch{throw new Error('Server error: '+text.substring(0,200));}
    if(data&&data.status==='error')throw new Error(data.message);
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
    rows = [];
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
        <td><button class="btn-kk-pm" data-id="${r.id}" title="Buka PM SPIP Terintegrasi">🗂️</button></td>
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
          showIndicator(e.target, '✗ Gagal', 'error');
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
          showIndicator(e.target, '✗ Gagal', 'error');
          console.error('Error saveField:', err);
        });
    };
  });
}

// ====== GRAFIK KPI (FINAL - 400x400 ANTI GEPENG) ======
function showChart(type) {
  const titles={nilaiStrukturProses:'Nilai Struktur dan Proses per OPD',nilaiMaturitas:'Nilai Maturitas Penyelenggaraan SPIP Terintegrasi per OPD',rataMRI:'Nilai MRI per OPD',rataIEPK:'Nilai IEPK per OPD',nilaiKapabilitasApip:'Nilai Kapabilitas APIP per OPD',qaApip:'Persentase QA APIP Selesai',statusSelesai:'Persentase OPD Selesai (Status)',rtpSelesai:'Persentase RTP Selesai',evidenceRtp:'Persentase OPD dengan Evidence RTP'};
  
  let labels = [];
  let data = [];
  let backgroundColor = [];
  let borderColor = [];
  let typeChart = 'bar';
  let totalCount = 0;
  let countTrue = 0;
  let countFalse = 0;

  if (!rows || rows.length === 0) {
    alert('Data OPD belum tersedia!');
    return;
  }

  const isLineChart=['nilaiStrukturProses','nilaiMaturitas','rataMRI','rataIEPK','nilaiKapabilitasApip'].includes(type);
  
  if (isLineChart) {
    let chartData = [...rows];
    const field=type==='nilaiStrukturProses'?'nilaiStrukturProses':type==='nilaiMaturitas'?'nilaiMaturitas':type==='rataMRI'?'mri':type==='rataIEPK'?'iepk':'nilaiKapabilitasApip'; chartData.sort((a,b)=>(parseFloat(a[field])||0)-(parseFloat(b[field])||0));
    
    labels = chartData.map(r => r.opd);
    data=chartData.map(r=>parseFloat(r[field])||0);
    typeChart = 'line';
  } 
  else if (type === 'opdLevel3') {
    totalCount = rows.length;
    countTrue = rows.filter(r => (parseFloat(r.sa) || 0) >= 3).length;
    countFalse = totalCount - countTrue;
    labels = ['Level >= 3', 'Level < 3'];
    data = [countTrue, countFalse];
    backgroundColor = ['#10b981', '#e2e8f0'];
    borderColor = ['#ffffff', '#ffffff'];
    typeChart = 'pie';
  } else if (type === 'qaApip') {
    totalCount = rows.length;
    countTrue = rows.filter(r => r.qaApip === 'Selesai').length;
    countFalse = totalCount - countTrue;
    labels = ['Selesai', 'Proses/Belum'];
    data = [countTrue, countFalse];
    backgroundColor = ['#f59e0b', '#e2e8f0'];
    borderColor = ['#ffffff', '#ffffff'];
    typeChart = 'pie';
    } else if (type === 'statusSelesai') {
    totalCount = rows.length;
    countTrue = rows.filter(r => r.status === 'Selesai').length;
    countFalse = totalCount - countTrue;
    labels = ['Selesai', 'Proses/Belum'];
    data = [countTrue, countFalse];
    backgroundColor = ['#6366f1', '#e2e8f0'];
    borderColor = ['#ffffff', '#ffffff'];
    typeChart = 'pie';
    } else if (type === 'rtpSelesai') { totalCount=rows.length; countTrue=rows.filter(r=>r.rtp==='Selesai').length; countFalse=totalCount-countTrue; labels=['Selesai','Belum']; data=[countTrue,countFalse]; backgroundColor=['#f97316','#e2e8f0']; borderColor=['#ffffff','#ffffff']; typeChart='pie'; } else if (type === 'evidenceRtp') { totalCount=rows.length; countTrue=rows.filter(r=>Array.isArray(r.rtpEvidence)&&r.rtpEvidence.length>0).length; countFalse=totalCount-countTrue; labels=['Terisi','Belum']; data=[countTrue,countFalse]; backgroundColor=['#10b981','#e2e8f0']; borderColor=['#ffffff','#ffffff']; typeChart='pie'; }

  document.getElementById('kpiChartTitle').textContent = titles[type] || 'Grafik';
  document.getElementById('kpiChartModal').classList.add('active');

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const canvas = document.getElementById('kpiChartCanvas');
  const ctx = canvas.getContext('2d');

  if (isLineChart) {
      let chartWidth = canvas.parentElement.clientWidth; 
      if (!chartWidth || chartWidth < 800) chartWidth = 800;
      let chartHeight = 600; 

      canvas.width = chartWidth;
      canvas.height = chartHeight;
      canvas.style.width = chartWidth + 'px';
      canvas.style.height = chartHeight + 'px';
      canvas.parentElement.style.overflowX = 'hidden';

      let lineGradient = ctx.createLinearGradient(0, 0, 0, 600);
      lineGradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
      lineGradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: titles[type],
            data: data,
            backgroundColor: lineGradient,
            borderColor: 'rgba(37, 99, 235, 1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: 'rgba(37, 99, 235, 1)',
            pointBorderColor: '#ffffff',
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          indexAxis: 'x',
          layout: { padding: { bottom: 60 } }, 
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#0f172a' }
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { display: false },
              ticks: {
                autoSkip: false, 
                maxRotation: 45,
                minRotation: 45,
                align: 'end',
                font: { size: 11, weight: 'bold' },
                padding: 5
              }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(226, 232, 240, 0.6)' },
              ticks: { font: { size: 13 } }
            }
          },
          animation: { duration: 800, easing: 'easeOutQuart' }
        }
      });

   } else {
      canvas.width = 380;
      canvas.height = 380;
      canvas.style.width = '380px';
      canvas.style.height = '380px';
      canvas.style.minWidth = '0';

      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';

      canvas.parentElement.style.overflowX = 'hidden';
      canvas.parentElement.style.overflowY = 'hidden';

      chartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            label: titles[type],
            data: data,
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            borderWidth: 2
          }]
        },
        options: {
          responsive: false, 
          maintainAspectRatio: false,
          layout: { padding: { bottom: 20 } }, 
          plugins: {
            legend: { 
              display: true, 
              position: 'bottom',
              labels: {
                color: '#1e293b',
                usePointStyle: true,
                pointStyle: 'circle',
                padding: 15,
                font: { size: 12, weight: 'bold' }
              }
            },
            tooltip: { 
              backgroundColor: '#0f172a',
              position: 'nearest',
              callbacks: {
                label: function(context) {
                  let val = context.parsed;
                  let percent = totalCount > 0 ? Math.round((val / totalCount) * 100) : 0;
                  return ` ${val} OPD (${percent}%)`;
                }
              }
            }
          },
          scales: {
            x: { display: false },
            y: { display: false }
          },
          animation: { duration: 800, easing: 'easeOutQuart' }
        }
      });
  }

  const chartContainer = document.querySelector('.chart-container.chart-scroll');
  if (chartContainer) {
    chartContainer.scrollTop = 0;
  }
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

        try {
          const result = await uploadFile(targetRow, subCode, paramId, level, file);
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
          text.textContent = 'Gagal: ' + err.message;
          showWarning('❌ Upload gagal: ' + err.message);
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

async function uploadFile(row, subCode, paramId, level, file) {
  if(!file)return;
  if(file.size>MAX_FILE_UPLOAD_BYTES)throw new Error('File terlalu besar! Maks 10 MB per file.');
  const uploadId=crypto.randomUUID();
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
    const statusLabel = status === 'done' ? '✅ Google Drive' : (status === 'retrying' ? '🔄 Perlu Retry Google Drive' : '⏳ Mengirim ke Google Drive');
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
    const r = await callServerWithRetry('retryDriveBackup',{opdId,year:currentYear,uploadId,type:'evidence',subunsur:subCode,paramId,level},2);
    item.gdriveId=r.gdriveId||item.gdriveId||null;
    item.syncStatus=r.syncStatus||'retrying';
    item.syncError=r.driveError||null;
    if(item.gdriveId) item.storage='R2 + Google Drive';
    renderFileList(row,subCode,paramId,level); render();
    showWarning(item.gdriveId ? '✅ Backup Google Drive berhasil.' : '🔄 Google Drive belum berhasil. Silakan Retry.');
  } catch(err) {
    item.syncStatus='retrying'; item.syncError=err.message; renderFileList(row,subCode,paramId,level);
    showWarning('❌ Retry Google Drive gagal: '+err.message);
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
  selects.forEach(el => {
    const subCode = el.dataset.sub, paramId = el.dataset.param;
    row.subunsurs[subCode][paramId].level = parseInt(el.value) || 0;
  });
  row.nilaiStrukturProses = calculateSA(row);
  row.sa = row.nilaiStrukturProses;
  textareas.forEach(el => {
    const subCode = el.dataset.sub, paramId = el.dataset.param, field = el.dataset.field;
    row.subunsurs[subCode][paramId][field] = el.value;
  });
  // Nilai Struktur dan Proses tetap dihitung otomatis dari 43 parameter. Nilai Maturitas diisi manual dan tidak ditimpa.
  row.nilaiStrukturProses = calculateSA(row);
  row.sa = row.nilaiStrukturProses;
  let strukturEvidenceCount = 0;
  PARAM_LIST.forEach(param => { const sd=row.subunsurs?.[param.subCode]?.[param.paramId]; if(sd){ for(let lv=1;lv<=5;lv++){ if(Array.isArray(sd['files'+lv]) && sd['files'+lv].length){ strukturEvidenceCount++; break; } } } });
  row.strukturProsesStatus = strukturEvidenceCount === PARAM_LIST.length ? 'Selesai' : (strukturEvidenceCount > 0 ? 'Proses' : 'Belum');
  const modalStatus = document.getElementById('modalSaveStatus');
  modalStatus.style.display = 'block';
  modalStatus.style.color = '#1e40af';
  modalStatus.textContent = '⏳ Menyimpan data...';
  try {
    const saved=await callServerWithRetry('saveSubunsur',{opdId:row.id,year:currentYear,subunsurs:row.subunsurs});
    if(saved?.nilaiStrukturProses!=null){row.nilaiStrukturProses=saved.nilaiStrukturProses;row.sa=saved.nilaiStrukturProses;row.strukturProsesStatus=saved.strukturProsesStatus||row.strukturProsesStatus;}
    modalStatus.style.color = '#16a34a';
    modalStatus.textContent = '✅ Data berhasil disimpan!';
    setTimeout(() => { closeEditModal(); render(); }, 800);
  } catch (err) {
    modalStatus.style.color = '#dc2626';
    modalStatus.textContent = '❌ Gagal menyimpan! ' + err;
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
    await callServerWithRetry('saveRow',{year:currentYear,row:newOpd});
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
      await callServerWithRetry('saveField',{opdId:row.id,field:'opd',value:row.opd,year:currentYear});
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
});document.getElementById('rtpEvidenceList')?.addEventListener('click',async e=>{const rb=e.target.closest('.rtp-retry-btn');if(rb){const row=rows.find(r=>r.id===rtpEvidenceEditingRowId);if(!row)return;const f=(row.rtpEvidence||[]).find(x=>x.uploadId===rb.dataset.uploadId);if(!f)return;try{f.syncStatus='retrying';renderRtpEvidenceList(row);rtpEvidenceSetStatus('Mencoba ulang backup Google Drive...');const d=await callServerWithRetry('retryDriveBackup',{opdId:row.id,year:currentYear,type:'rtp',uploadId:f.uploadId},2);f.gdriveId=d.gdriveId||f.gdriveId||null;f.syncStatus=d.syncStatus||'retrying';f.syncError=d.driveError||null;renderRtpEvidenceList(row);render();rtpEvidenceSetStatus(f.gdriveId?'✅ Backup Google Drive berhasil.':'🔄 Google Drive belum berhasil. Silakan Retry.',f.gdriveId?'success':'');}catch(err){f.syncStatus='retrying';f.syncError=err.message;renderRtpEvidenceList(row);rtpEvidenceSetStatus('Retry gagal: '+err.message,'error');}return;}const b=e.target.closest('.rtp-delete-btn');if(!b)return;const row=rows.find(r=>r.id===rtpEvidenceEditingRowId);if(!row)return;const f=(row.rtpEvidence||[])[Number(b.dataset.index)];if(!f)return;try{rtpEvidenceSetStatus('Menghapus...');const d=await callServerWithRetry('deleteRtpEvidence',{opdId:row.id,year:currentYear,fileUrl:f.url,gdriveId:f.gdriveId||null});row.rtpEvidence=Array.isArray(d.rtpEvidence)?d.rtpEvidence:[];renderRtpEvidenceList(row);render();rtpEvidenceSetStatus('File dihapus.','success');}catch(err){rtpEvidenceSetStatus('Gagal hapus: '+err.message,'error');}});document.getElementById('rtpEvidenceRefresh')?.addEventListener('click',()=>{if(rtpEvidenceEditingRowId)openRtpEvidenceModal(rtpEvidenceEditingRowId);});function closeRtpEvidenceModal(){document.getElementById('rtpEvidenceModal')?.classList.remove('active');rtpEvidenceEditingRowId=null;}document.getElementById('rtpEvidenceClose')?.addEventListener('click',closeRtpEvidenceModal);document.getElementById('rtpEvidenceCloseFooter')?.addEventListener('click',closeRtpEvidenceModal);
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
  else if(btn.classList.contains('btn-kk-pm')) openKkPmModal(btn.getAttribute('data-id'));
  else if(btn.classList.contains('btn-kk-rtp')) openKkRtp(btn.getAttribute('data-id'));
  else if(btn.classList.contains('btn-rtp-evidence')) openRtpEvidenceModal(btn.getAttribute('data-id'));
  else if(btn.classList.contains('del-btn')) openConfirmModal(btn.getAttribute('data-id'));
});

// ============================================================
// PM SPIP TERINTEGRASI — Excel-like workbook engine (v2)
// Source workbook: KK PM PK SPIP-T 05052026 (2).xlsx
// Features: real workbook metadata, cross-sheet formulas, shared formulas,
// virtualization, formula bar, validations, hidden row/column view,
// insert/delete row & column, and per-OPD persistence.
// ============================================================
let kkPmBaseTemplate=null,kkPmTemplate=null,kkPmEditingRowId=null,kkPmActiveSheet=0,kkPmDirty=false,kkPmDraft={},kkPmCalc=null,kkPmSelected=null;
const KKPM_TEMPLATE_URL='./pm_workbook.json';

const kkPmEsc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const kkPmSetStatus=(msg,type='')=>{const e=document.getElementById('kkPmStatus');if(!e)return;e.textContent=msg||'';e.className='kkpm-status'+(type?' '+type:'');e.style.display=msg?'block':'none'};
const kkPmCellKey=(r,c)=>r+':'+c;
const kkPmEnsureDraft=()=>{if(!kkPmDraft||typeof kkPmDraft!=='object')kkPmDraft={};if(!kkPmDraft.cells||typeof kkPmDraft.cells!=='object')kkPmDraft.cells={};if(!kkPmDraft.structure||typeof kkPmDraft.structure!=='object')kkPmDraft.structure={};};
const kkPmGetOverride=(si,r,c)=>kkPmDraft?.cells?.[String(si)]?.[kkPmCellKey(r,c)];
const kkPmColName=n=>{let x=n+1,s='';while(x){const r=(x-1)%26;s=String.fromCharCode(65+r)+s;x=Math.floor((x-1)/26)}return s};
const kkPmColNum=s=>{let n=0;for(const ch of String(s).replace(/\$/g,''))n=n*26+ch.toUpperCase().charCodeAt(0)-64;return n-1};
const kkPmParseA1=a=>{const m=String(a||'').match(/^\$?([A-Z]{1,3})\$?(\d+)$/i);return m?{r:Number(m[2])-1,c:kkPmColNum(m[1])}:null};
const kkPmA1=(r,c)=>kkPmColName(c)+(r+1);
const kkPmNum=v=>{if(typeof v==='number')return Number.isFinite(v)?v:NaN;const s=String(v??'').trim();if(!s)return NaN;let q=s.replace(/,/g,'');if(/^[-+]?\d+(?:\.\d+)?%$/.test(q))q=String(Number(q.slice(0,-1))/100);const n=Number(q);return Number.isFinite(n)?n:NaN};
const kkPmFlat=x=>{const a=[];const walk=v=>Array.isArray(v)?v.flatMap(walk):a.push(v);walk(x);return a};
const kkPmErr=v=>typeof v==='string'&&/^#(?:DIV\/0!|N\/A|VALUE!|NAME\?|REF!|NUM!|NULL!|CYCLE!)/.test(v);
const kkPmTruth=v=>{if(kkPmErr(v))return false;if(typeof v==='boolean')return v;if(typeof v==='number')return v!==0;const s=String(v??'').trim().toUpperCase();return s!==''&&s!=='FALSE'&&s!=='0'};

function kkPmTranslateFormula(formula,dr,dc){
  const refRe=/(?<![A-Za-z0-9_])(?:(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_. ]*))!)?(\$?[A-Z]{1,3}\$?\d+)/g;
  return String(formula).replace(refRe,(m,sq,ss,a)=>{
    const x=a.match(/^(\$?)([A-Z]{1,3})(\$?)(\d+)$/);if(!x)return m;
    const ac=x[1],letters=x[2],ar=x[3];let c=kkPmColNum(letters),r=Number(x[4])-1;if(!ac)c+=dc;if(!ar)r+=dr;
    const aa=ac+kkPmColName(c)+ar+(r+1);return (sq!=null?`'${sq}'!`:(ss?ss+'!':''))+aa;
  });
}

class KkPmParser{
  constructor(t,getCell,getRange){this.t=t;this.i=0;this.getCell=getCell;this.getRange=getRange}
  peek(v){return this.t[this.i]?.v===v||this.t[this.i]?.k===v}
  eat(){return this.t[this.i++]}
  expect(v){if(!this.peek(v))throw new Error('#VALUE!');return this.eat()}
  parse(){const v=this.cmp();if(this.i<this.t.length)throw new Error('#VALUE!');return v}
  cmp(){let a=this.concat();while(this.peek('=')||this.peek('<>')||this.peek('>')||this.peek('<')||this.peek('>=')||this.peek('<=')){const o=this.eat().v,b=this.concat();a=this.cmpv(a,o,b)}return a}
  concat(){let a=this.add();while(this.peek('&')){this.eat();const b=this.add();a=String(a??'')+String(b??'')}return a}
  add(){let a=this.mul();while(this.peek('+')||this.peek('-')){const o=this.eat().v,b=this.mul();if(kkPmErr(a))return a;if(kkPmErr(b))return b;const nb=this.num(b),na=this.num(a);a=o==='+'?na+nb:na-nb}return a}
  mul(){let a=this.pow();while(this.peek('*')||this.peek('/')){const o=this.eat().v,b=this.pow();if(kkPmErr(a))return a;if(kkPmErr(b))return b;const na=this.num(a),nb=this.num(b);if(o==='/'&&nb===0)return '#DIV/0!';a=o==='*'?na*nb:na/nb}return a}
  pow(){let a=this.unary();if(this.peek('^')){this.eat();const b=this.pow();if(kkPmErr(a))return a;if(kkPmErr(b))return b;a=Math.pow(this.num(a),this.num(b))}return a}
  unary(){if(this.peek('+')){this.eat();return this.unary()}if(this.peek('-')){this.eat();const v=this.unary();return kkPmErr(v)?v:-this.num(v)}return this.primary()}
  primary(){const x=this.t[this.i];if(!x)throw new Error('#VALUE!');if(x.k==='num'){this.i++;return x.pct?x.v/100:x.v}if(x.k==='str'){this.i++;return x.v}if(x.k==='ref'){this.i++;return x.ref2?this.getRange(x.sheet,x.ref,x.sheet2,x.ref2):this.getCell(x.sheet,x.ref)}if(x.k==='id'){const n=x.v.toUpperCase();this.i++;this.expect('(');const a=[];if(!this.peek(')')){for(;;){a.push(this.cmp());if(this.peek(',')){this.eat();continue}break}}this.expect(')');return this.fn(n,a)}if(this.peek('(')){this.eat();const v=this.cmp();this.expect(')');return v}throw new Error('#VALUE!')}
  num(v){const n=kkPmNum(v);return Number.isFinite(n)?n:0}
  cmpv(a,o,b){if(kkPmErr(a)||kkPmErr(b))return false;const na=kkPmNum(a),nb=kkPmNum(b),both=Number.isFinite(na)&&Number.isFinite(nb);const A=both?na:String(a??'').toLowerCase(),B=both?nb:String(b??'').toLowerCase();return o==='='?A===B:o==='<'?A<B:o==='>'?A>B:o==='<='?A<=B:o==='>='?A>=B:o==='<>'?A!==B:false}
  fn(n,a){const flat=kkPmFlat(a),scalar=x=>Array.isArray(x)?(x.find(y=>y!==''&&y!=null)??''):x;
    if(n==='SUM')return flat.map(kkPmNum).filter(Number.isFinite).reduce((x,y)=>x+y,0);
    if(n==='AVERAGE'){const q=flat.map(kkPmNum).filter(Number.isFinite);return q.length?q.reduce((x,y)=>x+y,0)/q.length:0}
    if(n==='COUNTA')return flat.filter(x=>x!==''&&x!=null).length;
    if(n==='COUNT')return flat.map(kkPmNum).filter(Number.isFinite).length;
    if(n==='COUNTIF'){const arr=kkPmFlat(a[0]||[]),crit=scalar(a[1]??'');return arr.filter(x=>kkPmCriteriaMatch(x,crit,this.cmpv.bind(this))).length}
    if(n==='MODE.SNGL'||n==='_XLFN.MODE.SNGL'){const q=flat.map(kkPmNum).filter(Number.isFinite);if(!q.length)return 0;const m=new Map();q.forEach(x=>m.set(x,(m.get(x)||0)+1));let best=q[0],bc=m.get(best);for(const [x,c] of m)if(c>bc){best=x;bc=c}return best}
    if(n==='IF')return kkPmTruth(a[0])?(a[1]??''):(a[2]??'');
    if(n==='IFERROR')return kkPmErr(a[0])?(a[1]??''):a[0];
    if(n==='IFNA')return a[0]==='#N/A'?(a[1]??''):a[0];
    if(n==='MAX'){const q=flat.map(kkPmNum).filter(Number.isFinite);return q.length?Math.max(...q):0}
    if(n==='MIN'){const q=flat.map(kkPmNum).filter(Number.isFinite);return q.length?Math.min(...q):0}
    if(n==='AND')return a.every(kkPmTruth);
    if(n==='OR')return a.some(kkPmTruth);
    if(n==='LEN')return String(scalar(a[0])??'').length;
    if(n==='SUBSTITUTE'){const text=String(scalar(a[0])??''),old=String(scalar(a[1])??''),neu=String(scalar(a[2])??'');if(a.length<4||a[3]===''||a[3]==null)return text.split(old).join(neu);const k=Math.max(1,Number(a[3]));let count=0;return text.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),m=>{count++;return count===k?neu:m})}
    if(n==='ISBLANK')return scalar(a[0])==='';
    if(n==='VLOOKUP'){
      const key=scalar(a[0]),range=a[1]||[],colIndex=Math.max(1,Math.trunc(this.num(a[2]))),exact= a.length<4 ? true : !kkPmTruth(a[3]);
      const rows=Array.isArray(range)?range:[];const wanted=String(key??'').toLowerCase();
      for(const row of rows){const first=row?.[0];const same=(kkPmNum(first)!==undefined&&Number.isFinite(kkPmNum(first))&&Number.isFinite(kkPmNum(key)))?kkPmNum(first)===kkPmNum(key):String(first??'').toLowerCase()===wanted;if(same)return row?.[colIndex-1]??'#N/A'}
      if(exact===false){let best=null;for(const row of rows){const n1=kkPmNum(row?.[0]);const nk=kkPmNum(key);if(Number.isFinite(n1)&&Number.isFinite(nk)&&n1<=nk)best=row}if(best)return best[colIndex-1]??'#N/A'}
      return '#N/A';
    }
    if(n==='INDEX'){const arr=a[0]||[],r=Math.trunc(this.num(a[1]??1)),c=Math.trunc(this.num(a[2]??1));if(!Array.isArray(arr))return '#REF!';if(r===0)return c>0?arr.map(x=>x?.[c-1]??''):arr;if(Array.isArray(arr[0]))return arr[r-1]?.[Math.max(0,c-1)]??'#REF!';return arr[r-1]??'#REF!'}
    if(n==='MATCH'){
      const key=scalar(a[0]),arr=kkPmFlat(a[1]||[]),mode=Math.trunc(this.num(a[2]??1));if(mode===0){for(let i=0;i<arr.length;i++){if(this.cmpv(arr[i],'=',key))return i+1}return '#N/A'}
      let best=-1;for(let i=0;i<arr.length;i++){const na=kkPmNum(arr[i]),nk=kkPmNum(key);if(Number.isFinite(na)&&Number.isFinite(nk)&&((mode===1&&na<=nk)||(mode===-1&&na>=nk)))best=i+1}return best<0?'#N/A':best;
    }
    throw new Error('#NAME? '+n);
  }
}
function kkPmCriteriaMatch(v,crit,cmp){const s=String(crit??'');const m=s.match(/^(<=|>=|<>|=|<|>)(.*)$/);if(m)return cmp(v,m[1],m[2]);if(s.includes('*')||s.includes('?')){const re=new RegExp('^'+s.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.')+'$','i');return re.test(String(v??''))}return cmp(v,'=',crit)}

function kkPmFindShared(sheet,addr){
  if(!sheet._sharedMap){sheet._sharedMap=new Map();for(const sf of sheet.sharedFormulas||[]){const [a,b]=(sf.ref||sf.master).split(':');const aa=kkPmParseA1(a),bb=kkPmParseA1(b||a);if(!aa||!bb)continue;for(let r=Math.min(aa.r,bb.r);r<=Math.max(aa.r,bb.r);r++)for(let c=Math.min(aa.c,bb.c);c<=Math.max(aa.c,bb.c);c++){const key=kkPmA1(r,c);sheet._sharedMap.set(key,{formula:sf.formula,master:aa,anchorSheet:sf.ref});}}}
  return sheet._sharedMap.get(addr)||null;
}
function kkPmFormulaAt(si,addr){const sh=kkPmTemplate.sheets[si];const f=sh?.formulas?.[addr];if(f)return f;const sf=kkPmFindShared(sh,addr);if(!sf)return null;const a=kkPmParseA1(addr);return kkPmTranslateFormula(sf.formula,a.r-sf.master.r,a.c-sf.master.c)}

function kkPmBuildCalc(){
  const sheets=kkPmTemplate.sheets||[],idx={};sheets.forEach((s,i)=>idx[s.name.toLowerCase()]=i);
  const memo=new Map(),vis=new Set(),lookupCache=new Map();
  const cell=(si,r,c)=>{if(si==null||si<0||si>=sheets.length)return '#REF!';const key=si+':'+r+':'+c;if(memo.has(key))return memo.get(key);if(vis.has(key))return '#CYCLE!';vis.add(key);const sh=sheets[si],addr=kkPmA1(r,c);const over=kkPmGetOverride(si,r,c);let v=over!==undefined?over:(sh.cells?.[addr]?.v??'');const f=kkPmFormulaAt(si,addr);if(f){try{v=new KkPmParser(kkPmTokenize(String(f).replace(/^=/,'')),(sn,ref)=>{const si2=sn==null?si:idx[String(sn).toLowerCase()];const a=kkPmParseA1(ref);return a?cell(si2,a.r,a.c):'#REF!'},(sn,ref,sn2,ref2)=>{const si2=sn==null?si:idx[String(sn).toLowerCase()],si3=sn2==null?si2:idx[String(sn2).toLowerCase()];const a=kkPmParseA1(ref),b=kkPmParseA1(ref2);if(!a||!b||si2!==si3)return [['#REF!']];const out=[];for(let rr=Math.min(a.r,b.r);rr<=Math.max(a.r,b.r);rr++){const row=[];for(let cc=Math.min(a.c,b.c);cc<=Math.max(a.c,b.c);cc++)row.push(cell(si2,rr,cc));out.push(row)}return out}).parse()}catch(e){v=String(e.message||'#VALUE!').startsWith('#')?e.message:'#VALUE!'}}vis.delete(key);memo.set(key,v);return v};
  return {getCell:cell,memo,lookupCache};
}

function kkPmTokenize(src){const t=[];let i=0;while(i<src.length){const ch=src[i];if(/\s/.test(ch)){i++;continue}if(ch==='"'){let j=i+1,s='';while(j<src.length){if(src[j]==='"'&&src[j+1]==='"'){s+='"';j+=2;continue}if(src[j]==='"')break;s+=src[j++]}t.push({k:'str',v:s});i=j+1;continue}const o2=src.slice(i,i+2);if(['>=','<=','<>'].includes(o2)){t.push({k:'op',v:o2});i+=2;continue}if('+-*/^%=><&(),:!'.includes(ch)){t.push({k:['(',')',',',':','!'].includes(ch)?'p':'op',v:ch});i++;continue}const rest=src.slice(i);const rm=rest.match(/^(?:(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_. ]*))!)?(\$?[A-Z]{1,3}\$?\d+)(?::(?:(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_. ]*))!)?(\$?[A-Z]{1,3}\$?\d+))?/);if(rm){t.push({k:'ref',sheet:rm[1]||rm[2]||null,ref:rm[3],ref2:rm[6]||null,sheet2:rm[4]||rm[5]||rm[1]||rm[2]||null});i+=rm[0].length;continue}const nm=rest.match(/^(?:_xlfn\.)?[A-Za-z_][A-Za-z0-9_.]*/);if(nm){t.push({k:'id',v:nm[0]});i+=nm[0].length;continue}const num=rest.match(/^[-+]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?%?/);if(num){const raw=num[0];t.push({k:'num',v:Number(raw.endsWith('%')?raw.slice(0,-1):raw),pct:raw.endsWith('%')});i+=raw.length;continue}throw new Error('#VALUE!')}return t}

function kkPmIsFormula(si,r,c){const addr=kkPmA1(r,c);return !!kkPmFormulaAt(si,addr)}
function kkPmCellValue(si,r,c){if(!kkPmCalc&&kkPmTemplate)kkPmCalc=kkPmBuildCalc();return kkPmCalc?.getCell(si,r,c)??''}

function kkPmEffectiveSheet(si){const base=kkPmTemplate.sheets[si];if(!base)return null;if(!kkPmDraft.structure||!kkPmDraft.structure[String(si)])return base;const state=kkPmDraft.structure[String(si)];const clone=Object.assign({},base,{cells:Object.assign({},base.cells||{}),formulas:Object.assign({},base.formulas||{}),sharedFormulas:(base.sharedFormulas||[]).slice()});clone.rows=(base.rows||1)+(state.rowDelta||0);clone.cols=(base.cols||1)+(state.colDelta||0);return clone}
function kkPmApplyStructure(){
  // Rebuild a lightweight sheet overlay from saved insertion/deletion operations.
  // Operations are stored as {axis:'row'|'col',at:0-based index,delta:+1|-1}.
  const ops=kkPmDraft?.structure?.ops||[]; if(!ops.length)return;
  for(const op of ops){const si=Number(op.si),sheet=kkPmTemplate.sheets[si];if(!sheet||op.delta===0)continue;const axis=op.axis;const at=Math.max(0,Number(op.at));const d=Number(op.delta);if(!sheet._structApplied)sheet._structApplied=[];const sig=si+':'+axis+':'+at+':'+d;if(sheet._structApplied.includes(sig))continue;sheet._structApplied.push(sig);
    const cells=sheet.cells||{};const next={};for(const [addr,item] of Object.entries(cells)){const a=kkPmParseA1(addr);if(!a)continue;let nr=a.r,nc=a.c;if(axis==='row'){if(nr>=at)nr+=d}else{if(nc>=at)nc+=d}if(nr<0||nc<0)continue;next[kkPmA1(nr,nc)]=item;}sheet.cells=next;
    const fm=sheet.formulas||{};const nf={};for(const [addr,f] of Object.entries(fm)){const a=kkPmParseA1(addr);if(!a)continue;let nr=a.r,nc=a.c;if(axis==='row'){if(nr>=at)nr+=d}else if(nc>=at)nc+=d;nf[kkPmA1(nr,nc)]=kkPmRewriteRefs(f,sheet.name,axis,at,d);}sheet.formulas=nf;
    for(const other of kkPmTemplate.sheets){for(const [addr,f] of Object.entries(other.formulas||{})){other.formulas[addr]=kkPmRewriteRefs(f,sheet.name,axis,at,d)}}
    if(axis==='row')sheet.rows=Math.max(1,(sheet.rows||1)+d);else sheet.cols=Math.max(1,(sheet.cols||1)+d);
    sheet._sharedMap=null;
  }
}
function kkPmRewriteRefs(formula,sheetName,axis,at,delta){const esc=String(sheetName).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const re=new RegExp(`(?:(?:'${esc}'|${esc})!)?(\\$?[A-Z]{1,3}\\$?\\d+)`,'g');return String(formula).replace(re,(m,a)=>{const p=kkPmParseA1(a);if(!p)return m;if(axis==='row'&&p.r>=at){return m.slice(0,m.length-a.length)+kkPmA1(p.r+delta,p.c)}if(axis==='col'&&p.c>=at){return m.slice(0,m.length-a.length)+kkPmA1(p.r,p.c+delta)}return m})}

function kkPmLoadStructure(){kkPmEnsureDraft();try{kkPmTemplate.sheets.forEach(s=>{s._structApplied=[];s._sharedMap=null});kkPmApplyStructure()}catch(e){console.warn(e)}}

function kkPmTotalWidth(sh){let x=0;for(let c=0;c<(sh.cols||1);c++)x+=kkPmColWidth(sh,c);return x}
function kkPmColWidth(sh,c){const base=Number(sh.colWidths?.[String(c+1)]||sh.colWidths?.[c+1]||0);if(base>0)return Math.max(54,Math.min(220,base*7));return 86}
const kkPmRowHeight=(sh,r)=>Math.max(20,Math.min(90,Number(sh.rowHeights?.[String(r+1)]||sh.rowHeights?.[r+1]||22)));
function kkPmRowIsHidden(sh,r){return (sh.hiddenRows||[]).includes(r+1)}
function kkPmColIsHidden(sh,c){return (sh.hiddenCols||[]).some(([a,b])=>(c+1)>=a&&(c+1)<=b)}
function kkPmRebuildPrefixes(sh){const cp=[0],rp=[0];for(let c=0;c<sh.cols;c++)cp.push(cp[c]+kkPmColWidth(sh,c));for(let r=0;r<sh.rows;r++)rp.push(rp[r]+(kkPmRowIsHidden(sh,r)&&!kkPmShowHidden?0:kkPmRowHeight(sh,r)));sh._cp=cp;sh._rp=rp}
let kkPmShowHidden=false,kkPmViewportRows=55,kkPmViewportCols=34,kkPmScrollRAF=0;
function kkPmVisibleRange(sh){if(!sh._cp||!sh._rp)kkPmRebuildPrefixes(sh);const wrap=document.getElementById('kkPmGridWrap');if(!wrap)return{r0:0,r1:Math.min(sh.rows,55),c0:0,c1:Math.min(sh.cols,34)};const sx=wrap.scrollLeft,sy=wrap.scrollTop,w=wrap.clientWidth,h=wrap.clientHeight;function lower(arr,v){let lo=0,hi=arr.length-1;while(lo<hi){const m=(lo+hi)>>1;if(arr[m]<v)lo=m+1;else hi=m}return Math.max(0,lo-1)}const c0=lower(sh._cp,sx),c1=Math.min(sh.cols,lower(sh._cp,sx+w)+3),r0=lower(sh._rp,sy),r1=Math.min(sh.rows,lower(sh._rp,sy+h)+5);return{r0:r0,r1:r1,c0:c0,c1:c1}}
function kkPmCellClass(si,r,c,addr,v){const f=kkPmIsFormula(si,r,c);return `kkpm-vcell ${f?'is-formula':''} ${kkPmSelected?.si===si&&kkPmSelected?.r===r&&kkPmSelected?.c===c?'selected':''}`}
function kkPmDisplay(v){if(v==null)return '';if(typeof v==='number'){if(Math.abs(v)>0&&Math.abs(v)<1)return v.toLocaleString('id-ID',{maximumFractionDigits:6,useGrouping:false});return v.toLocaleString('id-ID',{maximumFractionDigits:6})}return String(v)}
function kkPmRenderHeader(sh,range){const h=document.getElementById('kkPmHeaderLayer');if(!h)return;let html='';for(let c=range.c0;c<range.c1;c++){if(kkPmColIsHidden(sh,c)&&!kkPmShowHidden)continue;const x=sh._cp[c];const w=kkPmColWidth(sh,c);html+=`<div class="kkpm-head-cell" data-col="${c}" style="left:${x}px;width:${w}px">${kkPmColName(c)}${kkPmColIsHidden(sh,c)?'<span class="kkpm-hidden-mark">H</span>':''}</div>`}h.innerHTML=html}
function kkPmRenderRowNums(sh,range){const h=document.getElementById('kkPmRowNums');if(!h)return;let html='';for(let r=range.r0;r<range.r1;r++){if(kkPmRowIsHidden(sh,r)&&!kkPmShowHidden)continue;const y=sh._rp[r],ht=kkPmRowHeight(sh,r);html+=`<div class="kkpm-rownum-cell" style="top:${y}px;height:${Math.max(1,ht)}px">${r+1}</div>`}h.innerHTML=html}
function kkPmRenderCells(){const sh=kkPmTemplate.sheets[kkPmActiveSheet],wrap=document.getElementById('kkPmGridWrap'),layer=document.getElementById('kkPmCellLayer');if(!sh||!wrap||!layer)return;kkPmRebuildPrefixes(sh);const range=kkPmVisibleRange(sh);kkPmRenderHeader(sh,range);kkPmRenderRowNums(sh,range);const totalW=sh._cp[sh.cols]||0,totalH=sh._rp[sh.rows]||0;const sizer=document.getElementById('kkPmGridSizer');if(sizer){sizer.style.width=totalW+'px';sizer.style.height=totalH+'px'}layer.style.width=totalW+'px';layer.style.height=totalH+'px';let html='';for(let r=range.r0;r<range.r1;r++){if(kkPmRowIsHidden(sh,r)&&!kkPmShowHidden)continue;const y=sh._rp[r],ht=kkPmRowHeight(sh,r);for(let c=range.c0;c<range.c1;c++){if(kkPmColIsHidden(sh,c)&&!kkPmShowHidden)continue;const addr=kkPmA1(r,c),f=kkPmIsFormula(kkPmActiveSheet,r,c),v=kkPmCellValue(kkPmActiveSheet,r,c),x=sh._cp[c],w=kkPmColWidth(sh,c),raw=f?kkPmFormulaAt(kkPmActiveSheet,addr):(kkPmGetOverride(kkPmActiveSheet,r,c)??sh.cells?.[addr]?.v??'');html+=`<div class="${kkPmCellClass(kkPmActiveSheet,r,c,addr,v)}" data-r="${r}" data-c="${c}" style="left:${x}px;top:${y}px;width:${w}px;height:${Math.max(1,ht)}px" title="${f?kkPmEsc(raw):'Klik dua kali untuk mengedit'}"><span>${kkPmEsc(kkPmDisplay(v))}</span>${f?'<b class="kkpm-fbadge">ƒ</b>':''}</div>`}}
layer.innerHTML=html;const meta=document.getElementById('kkPmSheetMeta');if(meta)meta.innerHTML=`<b>${kkPmEsc(sh.name)}</b><span>${sh.rows.toLocaleString('id-ID')} baris × ${sh.cols} kolom</span><span class="kkpm-formula-count">ƒ ${Object.keys(sh.formulas||{}).length + (sh.sharedFormulas||[]).reduce((n,s)=>{const p=(s.ref||s.master).split(':'),a=kkPmParseA1(p[0]),b=kkPmParseA1(p[1]||p[0]);return n+(a&&b?((Math.abs(b.r-a.r)+1)*(Math.abs(b.c-a.c)+1)):1)},0)} formula aktif</span>`;document.getElementById('kkPmStats').textContent=`${kkPmTemplate.sheets.length} lembar · 220.486 formula Excel diadopsi · formula lintas sheet + shared formula aktif`;
}
function kkPmRenderTabs(){const b=document.getElementById('kkPmTabs'),q=(document.getElementById('kkPmSearch')?.value||'').trim().toLowerCase();if(!b||!kkPmTemplate)return;b.innerHTML=kkPmTemplate.sheets.map((s,i)=>{const text=s.name.toLowerCase();if(q&&!text.includes(q))return '';const n=Object.keys(s.formulas||{}).length;const sh=(s.sharedFormulas||[]).length;return `<button type="button" class="kkpm-tab ${i===kkPmActiveSheet?'active':''}" data-index="${i}">${kkPmEsc(s.name)}<small>${(s.rows||0).toLocaleString('id-ID')}×${s.cols||0} · ƒ${(n+sh).toLocaleString('id-ID')}</small></button>`}).join('');}
function kkPmUpdateFormulaBar(){const bar=document.getElementById('kkPmFormulaBar'),ref=document.getElementById('kkPmCellRef'),type=document.getElementById('kkPmCellType');if(!bar||!ref||!kkPmSelected){ref.textContent='—';bar.value='';if(type)type.textContent='';return}const {si,r,c}=kkPmSelected,addr=kkPmA1(r,c);const f=kkPmFormulaAt(si,addr);ref.textContent=addr;bar.value=f||kkPmCellValue(si,r,c)||'';if(type)type.textContent=f?'FORMULA':'INPUT'}
function kkPmSelectCell(el){kkPmSelected={si:kkPmActiveSheet,r:Number(el.dataset.r),c:Number(el.dataset.c)};kkPmUpdateFormulaBar();kkPmRenderCells()}
function kkPmValidationFor(si,r,c){const sh=kkPmTemplate.sheets[si];for(const dv of sh.validations||[]){for(const part of String(dv.sqref||'').split(/\s+/)){const p=part.split(':');const a=kkPmParseA1(p[0]),b=kkPmParseA1(p[1]||p[0]);if(!a||!b)continue;if(r>=Math.min(a.r,b.r)&&r<=Math.max(a.r,b.r)&&c>=Math.min(a.c,b.c)&&c<=Math.max(a.c,b.c))return dv;}}return null}
function kkPmListValues(dv){const f=dv?.formula1||'';if(!f)return[];if(f.startsWith('"')&&f.endsWith('"'))return f.slice(1,-1).split(',');const m=f.match(/^(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_. ]*))!\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)$/);if(m){const sname=m[1]||m[2],si=kkPmTemplate.sheets.findIndex(s=>s.name.toLowerCase()===sname.toLowerCase());if(si>=0){const out=[];const a=kkPmParseA1(m[3]+m[4]),b=kkPmParseA1(m[5]+m[6]);for(let r=Math.min(a.r,b.r);r<=Math.max(a.r,b.r);r++)for(let c=Math.min(a.c,b.c);c<=Math.max(a.c,b.c);c++){const v=kkPmCellValue(si,r,c);if(v!==''&&v!=null)out.push(String(v))}return [...new Set(out)]}}return[]}
function kkPmBeginEdit(){if(!kkPmSelected)return;const layer=document.getElementById('kkPmCellLayer'),el=layer.querySelector(`.kkpm-vcell[data-r="${kkPmSelected.r}"][data-c="${kkPmSelected.c}"]`);if(!el)return;const {r,c}=kkPmSelected,si=kkPmActiveSheet,addr=kkPmA1(r,c),cur=(kkPmFormulaAt(si,addr) ?? kkPmGetOverride(si,r,c) ?? kkPmCellValue(si,r,c) ?? '');const dv=kkPmValidationFor(si,r,c);const box=document.createElement(dv&&dv.type==='list'?'select':'input');box.className='kkpm-editor';box.value=cur; if(box.tagName==='SELECT'){const opts=kkPmListValues(dv);box.innerHTML=opts.map(v=>`<option value="${kkPmEsc(v)}">${kkPmEsc(v)}</option>`).join('');box.value=String(cur)}el.innerHTML='';el.appendChild(box);box.focus();if(box.tagName==='INPUT')box.select();const finish=(ok=true)=>{const val=box.value;el.innerHTML=`<span>${kkPmEsc(kkPmDisplay(val))}</span>${kkPmIsFormula(si,r,c)?'<b class="kkpm-fbadge">ƒ</b>':''}`;if(ok){kkPmEnsureDraft();if(!kkPmDraft.cells[String(si)])kkPmDraft.cells[String(si)]={};kkPmDraft.cells[String(si)][kkPmCellKey(r,c)]=val;kkPmDirty=true;kkPmCalc=null;kkPmUpdateFormulaBar();kkPmSetStatus('Perubahan belum disimpan. Formula terkait akan dihitung ulang.','dirty');kkPmRenderCells()}};box.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish(true)}if(e.key==='Escape'){e.preventDefault();finish(false)}});box.addEventListener('blur',()=>finish(true),{once:true})}
function kkPmFormulaEnter(){if(!kkPmSelected)return;kkPmEnsureDraft();const v=document.getElementById('kkPmFormulaBar').value;const {si,r,c}=kkPmSelected;if(!kkPmDraft.cells[String(si)])kkPmDraft.cells[String(si)]={};kkPmDraft.cells[String(si)][kkPmCellKey(r,c)]=v;kkPmDirty=true;kkPmCalc=null;kkPmSetStatus('Formula/nilai baru diterapkan.','dirty');kkPmRenderCells();}

function kkPmShiftOp(axis,delta){if(!kkPmSelected)return;const at=axis==='row'?kkPmSelected.r:kkPmSelected.c;const si=kkPmActiveSheet;kkPmEnsureDraft();kkPmDraft.structure.ops=kkPmDraft.structure.ops||[];kkPmDraft.structure.ops.push({si,axis,at,delta});kkPmDirty=true;kkPmLoadStructure();kkPmCalc=null;kkPmSelected={si,r:Math.min(kkPmSelected.r,Math.max(0,(kkPmTemplate.sheets[si].rows||1)+delta-1)),c:Math.min(kkPmSelected.c,Math.max(0,(kkPmTemplate.sheets[si].cols||1)+(axis==='col'?delta:0)-1))};kkPmRenderCells();kkPmSetStatus((delta>0?'✅ Menambah ':'🗑️ Menghapus ')+(axis==='row'?'baris':'kolom')+' pada posisi terpilih.','dirty')}

async function loadKkPmTemplate(){
  if(kkPmBaseTemplate)return kkPmBaseTemplate;
  // 1) Primary source: bundled workbook, so Cloudflare/SPA rewrites cannot turn JSON into index.html.
  if(window.PM_SPIP_WORKBOOK && Array.isArray(window.PM_SPIP_WORKBOOK.sheets)){
    kkPmBaseTemplate=window.PM_SPIP_WORKBOOK;
    if(kkPmBaseTemplate.formulaCount!==220486)console.warn('Formula count berbeda dari sumber:',kkPmBaseTemplate.formulaCount);
    return kkPmBaseTemplate;
  }
  // 2) Fallback for local/manual deployments.
  const urls=['/pm_workbook.json','./pm_workbook.json'];
  let lastError=null;
  for(const url of urls){
    try{
      const res=await fetch(url,{cache:'no-store'});
      const txt=await res.text();
      if(!res.ok||/^\s*<!doctype|^\s*</i.test(txt))throw new Error(`HTTP ${res.status||200} bukan JSON`);
      const data=JSON.parse(txt);
      if(!data||!Array.isArray(data.sheets)||!data.sheets.length)throw new Error('Workbook kosong/tidak valid');
      kkPmBaseTemplate=data;
      if(kkPmBaseTemplate.formulaCount!==220486)console.warn('Formula count berbeda dari sumber:',kkPmBaseTemplate.formulaCount);
      return kkPmBaseTemplate;
    }catch(e){lastError=e}
  }
  throw new Error('Template PM SPIP gagal dimuat. Workbook sudah dibundel; cek deployment/static assets. '+(lastError?.message||''));
}
async function saveKkPmData(){const row=rows.find(r=>r.id===kkPmEditingRowId);if(!row)return;kkPmEnsureDraft();const b=document.getElementById('kkPmSave');b.disabled=true;kkPmSetStatus('Menyimpan PM SPIP...');try{row.kkPmData=JSON.parse(JSON.stringify(kkPmDraft));const res=await callServer('saveRow',{row,year:currentYear});if(res?.status!=='success')throw Error(res?.message||'Server menolak penyimpanan.');kkPmDirty=false;kkPmSetStatus('✅ Tersimpan untuk OPD + tahun aktif.','success');}catch(e){kkPmSetStatus('❌ Gagal menyimpan: '+e.message,'error')}finally{b.disabled=false}}
async function openKkPmModal(id){const row=rows.find(r=>r.id===id);if(!row)return;kkPmEditingRowId=id;kkPmActiveSheet=0;kkPmDirty=false;kkPmSelected={si:0,r:0,c:0};kkPmDraft=JSON.parse(JSON.stringify(row.kkPmData||{}));kkPmEnsureDraft();document.getElementById('kkPmOpdName').textContent=row.opd||'Tanpa Nama';document.getElementById('kkPmSubtitle').textContent=`Tahun ${currentYear} · PM SPIP Terintegrasi · workbook 28 sheet`;document.getElementById('kkPmSearch').value='';document.getElementById('kkPmModal').classList.add('active');try{await loadKkPmTemplate();kkPmTemplate=structuredClone(kkPmBaseTemplate);kkPmLoadStructure();kkPmRenderTabs();kkPmBuildUIOnce();kkPmRenderCells();kkPmUpdateFormulaBar();kkPmSetStatus('✅ Workbook asli termuat. Formula antar-sheet + shared formula aktif.','success')}catch(e){kkPmSetStatus('❌ Gagal memuat PM SPIP: '+e.message,'error')}}
function closeKkPmModal(){if(kkPmDirty&&!confirm('Ada perubahan PM SPIP yang belum disimpan. Tutup tanpa menyimpan?'))return;document.getElementById('kkPmModal')?.classList.remove('active');kkPmEditingRowId=null;kkPmDirty=false;kkPmDraft={};kkPmCalc=null;kkPmSelected=null;kkPmTemplate=null}
let kkPmUIReady=false;
function kkPmBuildUIOnce(){if(kkPmUIReady)return;kkPmUIReady=true;const old=document.getElementById('kkPmGridWrap');if(!old)return;const parent=old.parentElement;parent.innerHTML=`<div id="kkPmGridWrap" class="kkpm-grid-wrap"><div id="kkPmGridSizer" class="kkpm-grid-sizer"><div id="kkPmCellLayer" class="kkpm-cell-layer"></div><div id="kkPmHeaderLayer" class="kkpm-header-layer"></div></div></div><div id="kkPmRowNums" class="kkpm-rownums"></div>`;const wrap=document.getElementById('kkPmGridWrap');wrap.addEventListener('scroll',()=>{cancelAnimationFrame(kkPmScrollRAF);kkPmScrollRAF=requestAnimationFrame(()=>{kkPmRenderCells()})});document.getElementById('kkPmCellLayer').addEventListener('click',e=>{const el=e.target.closest('.kkpm-vcell');if(el)kkPmSelectCell(el)});document.getElementById('kkPmCellLayer').addEventListener('dblclick',e=>{const el=e.target.closest('.kkpm-vcell');if(el)kkPmBeginEdit()});document.getElementById('kkPmFormulaBar')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();kkPmFormulaEnter()}});document.getElementById('kkPmToggleHidden')?.addEventListener('click',()=>{kkPmShowHidden=!kkPmShowHidden;kkPmRenderCells();document.getElementById('kkPmToggleHidden').textContent=kkPmShowHidden?'🙈 Sembunyikan tersembunyi':'👁️ Tampilkan tersembunyi'});document.getElementById('kkPmAddRow')?.addEventListener('click',()=>kkPmShiftOp('row',1));document.getElementById('kkPmDelRow')?.addEventListener('click',()=>kkPmShiftOp('row',-1));document.getElementById('kkPmAddCol')?.addEventListener('click',()=>kkPmShiftOp('col',1));document.getElementById('kkPmDelCol')?.addEventListener('click',()=>kkPmShiftOp('col',-1));document.getElementById('kkPmGo')?.addEventListener('keydown',e=>{if(e.key==='Enter'){const a=kkPmParseA1(e.target.value);if(a){kkPmSelected={si:kkPmActiveSheet,r:a.r,c:a.c};const sh=kkPmTemplate.sheets[kkPmActiveSheet];kkPmRebuildPrefixes(sh);document.getElementById('kkPmGridWrap').scrollLeft=sh._cp[Math.min(a.c,sh.cols-1)];document.getElementById('kkPmGridWrap').scrollTop=sh._rp[Math.min(a.r,sh.rows-1)];kkPmRenderCells();kkPmUpdateFormulaBar()}}});document.getElementById('kkPmSearch')?.addEventListener('input',()=>{kkPmRenderTabs();});document.addEventListener('click',e=>{const tab=e.target.closest('.kkpm-tab');if(tab){kkPmActiveSheet=Number(tab.dataset.index);kkPmSelected={si:kkPmActiveSheet,r:0,c:0};const w=document.getElementById('kkPmGridWrap');if(w)w.scrollTo(0,0);kkPmRenderCells();kkPmUpdateFormulaBar()}})}

document.getElementById('kkPmClose')?.addEventListener('click',closeKkPmModal);document.getElementById('kkPmCloseFooter')?.addEventListener('click',closeKkPmModal);document.getElementById('kkPmSave')?.addEventListener('click',saveKkPmData);
