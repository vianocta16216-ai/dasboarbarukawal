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
  const functionUrl = '/myCloudinaryHandler';
  // Semua aksi tulis dipaksa POST agar tidak pernah kembali ke GET/query-string.
  const readOnlyActions = new Set([
    'getYears', 'getData', 'getSubunsurData', 'getKkSheets',
    'getRtpKkSheets', 'getRtpEvidence', 'listBackups'
  ]);
  const method = (params.fileData || params.rows || !readOnlyActions.has(action)) ? 'POST' : 'GET';

  if (method === 'POST') {
    return fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params })
    })
    .then(response => response.text())
    .then(text => {
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error('Server error: ' + text.substring(0, 200)); }
      if (data && data.status === 'error') throw new Error(data.message);
      return data;
    });
  } else {
    const query = new URLSearchParams({ action, ...params }).toString();
    return fetch(`${functionUrl}?${query}`, { method: 'GET' })
    .then(response => response.text())
    .then(text => {
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error('Server error: ' + text.substring(0, 200)); }
      if (data && data.status === 'error') throw new Error(data.message);
      return data;
    });
  }
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
        const row = { ...r, nilaiMaturitas:r.nilaiMaturitas ?? r.nilai_maturitas ?? 0, nilaiKapabilitasApip:r.nilaiKapabilitasApip ?? r.nilai_kapabilitas_apip ?? 0, rtp:r.rtp||'Belum', status:r.status||'Belum', evidence:r.evidence||'Belum', qaApip:r.qaApip||'Belum', mri:r.mri||0, iepk:r.iepk||0, kkData:r.kkData||{}, kkRtpData:r.kkRtpData||{}, rtpEvidence:Array.isArray(r.rtpEvidence)?r.rtpEvidence:[], rtpEvidenceFolder:r.rtpEvidenceFolder||'Evidence RTP' };
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
      const avg = r.sa || 0;
      let countLengkap = 0;
      const totalParams = PARAM_LIST.length;
      if (totalParams > 0) {
        PARAM_LIST.forEach(param => {
          const subData = r.subunsurs && r.subunsurs[param.subCode] && r.subunsurs[param.subCode][param.paramId];
          if (subData) {
            let hasFile = false;
            for (let lv = 1; lv <= 5; lv++) {
              if (subData['files' + lv] && subData['files' + lv].length > 0) { hasFile = true; break; }
            }
            if (hasFile) countLengkap++;
          }
        });
      }
      let kelengkapanClass, kelengkapanLabel;
      if (totalParams > 0) {
        if (countLengkap === totalParams) { kelengkapanClass = 'badge-lengkap'; kelengkapanLabel = `Lengkap (${countLengkap}/${totalParams})`; }
        else if (countLengkap === 0) { kelengkapanClass = 'badge-kosong'; kelengkapanLabel = `Belum (0/${totalParams})`; }
        else { kelengkapanClass = 'badge-sebagian'; kelengkapanLabel = `Sebagian (${countLengkap}/${totalParams})`; }
      } else {
        kelengkapanClass = 'badge-kosong'; kelengkapanLabel = 'Belum';
      }
      // PERUBAHAN KEAMANAN: gunakan escapeHtml untuk nama OPD
      return `<tr>
        <td style="text-align:center;">${index + 1}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:500;">${escapeHtml(r.opd || 'Tanpa Nama')}</span>
            <button class="btn-edit-name" data-id="${r.id}" title="Ubah Nama" style="background:none; border:none; cursor:pointer; font-size:18px; padding:0;">✏️</button>
          </div>
        </td>
        <td><input class="auto-structure-value" type="number" value="${Number(r.nilaiStrukturProses||0).toFixed(2)}" readonly aria-label="Nilai Struktur dan Proses otomatis" title="Dihitung otomatis dari level yang dipilih pada 43 parameter"></td>
        <td>${selectHtml(r.id,'evidence',r.evidence,['Lengkap','Sebagian','Belum'])}</td>
        <td><span class="badge ${kelengkapanClass}" title="Jumlah parameter yang sudah memiliki evidence">${kelengkapanLabel}</span></td>
        <td><input type="number" step="0.01" min="0" max="5" value="${Number(r.nilaiMaturitas||0).toFixed(2)}" data-id="${r.id}" data-field="nilaiMaturitas"></td>
        <td><input type="number" step="0.01" min="0" max="5" value="${Number(r.mri||0).toFixed(2)}" data-id="${r.id}" data-field="mri"></td>
        <td><input type="number" step="0.01" min="0" max="5" value="${Number(r.iepk||0).toFixed(2)}" data-id="${r.id}" data-field="iepk"></td>
        <td><input type="number" step="0.01" min="0" max="5" value="${Number(r.nilaiKapabilitasApip||0).toFixed(2)}" data-id="${r.id}" data-field="nilaiKapabilitasApip"></td>
        <td>${selectHtml(r.id,'qaApip',r.qaApip,['Selesai','Proses','Belum'])}</td>
        <td>${selectHtml(r.id,'status',r.status,['Selesai','Proses','Belum'])}</td>
        <td>${selectHtml(r.id,'rtp',r.rtp,['Selesai','Belum'])}</td>
        <td><button class="btn-detail" data-id="${r.id}" title="Evidence Struktur dan Proses">📁</button></td>
        <td><button class="btn-kk" data-id="${r.id}" title="Buka KK SPIP">📊</button></td>
        <td><button class="btn-kk-rtp" data-id="${r.id}" title="Buka KK RTP">📋</button></td>
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
    el.onblur = syncData;
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
    el.onblur = syncData;
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
  <div style="display:flex; gap:8px; align-items:center;">
    <input type="file" multiple data-sub="${subCode}" data-param="${param.id}" data-level="${lv}" accept=".pdf,.doc,.docx,.jpg,.png,.mp4,.webm,.mov,.avi,.mkv,.xlsx,.pptx">
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

      const totalSize = fileList.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > 10 * 1024 * 1024) {
        showWarning('Total ukuran file melebihi 10 MB! Silakan pilih lebih sedikit.');
        fileInput.value = '';
        return;
      }

      const progressContainer = document.querySelector(`.evid-upload-progress[data-sub="${subCode}"][data-param="${paramId}"][data-level="${level}"]`);
      progressContainer.classList.add('active');
      progressContainer.innerHTML = '';

      let completed = 0;
      for (const file of fileList) {
        if (file.size > 20 * 1024 * 1024) {
          showWarning(`File ${file.name} melebihi 20 MB! File dilewati.`);
          continue;
        }
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

        let progress = 0;
        const interval = setInterval(() => {
          progress = Math.min(100, progress + Math.random() * 15 + 5);
          fill.style.width = progress + '%';
          text.textContent = Math.round(progress) + '%';
          if (progress >= 100) {
            clearInterval(interval);
          }
        }, 100);

        try {
          const result = await uploadFile(targetRow, subCode, paramId, level, file);
          clearInterval(interval);
          fill.style.width = '100%';
          text.textContent = '100%';
          if (!targetRow.subunsurs[subCode][paramId]['files' + level]) targetRow.subunsurs[subCode][paramId]['files' + level] = [];
          targetRow.subunsurs[subCode][paramId]['files' + level].push({
  url: result.url,
  fileName: result.fileName || file.name,
  gdriveId: result.gdriveId  // <---- TAMBAHKAN INI
});
          renderFileList(targetRow, subCode, paramId, level);
          completed++;
          setTimeout(() => {
            progressItem.remove();
            if (progressContainer.children.length === 0) progressContainer.classList.remove('active');
          }, 1000);
        } catch (err) {
          clearInterval(interval);
          text.textContent = 'Gagal: ' + err.message;
          showWarning('❌ Upload gagal: ' + err.message);
        }
      }
      fileInput.value = '';
      await saveData();
    };
  });
}

// ====== UPLOAD FILE ======
async function uploadFile(row, subCode, paramId, level, file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) throw new Error('File terlalu besar! Maks 10MB.');
  
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      
      let attempts = 0;
      let success = false;
      let lastError = '';

      while (attempts < 3 && !success) {
        try {
          const result = await callServer('uploadFile', {
            opdId: row.id,
            opdName: row.opd,
            subunsur: subCode,
            paramId,
            level,
            year: currentYear,
            fileName: file.name,
            fileData: base64,
            fileType: file.type || 'application/octet-stream'
          });
          success = true;
          resolve({ url: result.url, fileName: result.fileName, gdriveId: result.googleDriveId || null });
        } catch (err) {
          lastError = err.message;
          attempts++;
          if (attempts < 3) {
            await new Promise(r => setTimeout(r, 1500)); 
          }
        }
      }
      
      if (!success) {
        reject(new Error(lastError));
      }
    };
    reader.readAsDataURL(file);
  });
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
    div.style.cssText = 'display:flex; align-items:center; gap:8px; background:#f1f5f9; padding:6px; border-radius:6px; margin-top:6px;';
    // PERUBAHAN KEAMANAN: gunakan escapeHtml untuk fileName
    div.innerHTML = `
      <a href="${displayUrl}" target="_blank" rel="noopener" class="file-link" style="flex-grow:1; margin:0;">📎 ${escapeHtml(fileName)}</a>
      <button type="button" onclick="removeUploadedFile('${row.id}', '${subCode}', '${paramId}', ${level}, '${fileUrl}')" style="background:#fee2e2; color:#dc2626; border:none; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:12px;">🗑️ Hapus</button>
    `;
    fileListEl.appendChild(div);
  });
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
      const result = await callServer('deleteFile', { fileUrl, gdriveId });  // <---- Kirim gdriveId
      if (result.status === 'error') { 
        showWarning('❌ ' + result.message); 
        return; 
      }
      const files = row.subunsurs[subCode][paramId]['files' + level] || [];
      const index = files.findIndex(f => f.url === fileUrl);
      if (index > -1) {
        files.splice(index, 1);
        renderFileList(row, subCode, paramId, level);
        await saveData();
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
  // Nilai Struktur dan Proses selalu dihitung ulang dari 43 parameter. Tidak boleh diinput manual.
  row.nilaiStrukturProses = calculateSA(row);
  row.sa = row.nilaiStrukturProses;
  const modalStatus = document.getElementById('modalSaveStatus');
  modalStatus.style.display = 'block';
  modalStatus.style.color = '#1e40af';
  modalStatus.textContent = '⏳ Menyimpan data ke Google Drive...';
  try {
    await saveData();
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
    const newOpd = { id:'r'+Math.random().toString(36).slice(2,9), opd:'OPD Baru', sa:0, nilaiStrukturProses:0, nilaiMaturitas:0, nilaiKapabilitasApip:0, evidence:'Belum', qaApip:'Belum', mri:0, iepk:0, rtp:'Belum', status:'Belum', subunsurs:{}, kkData:{}, kkRtpData:{}, rtpEvidence:[] };
    Object.keys(SUBUNSUR_DATA).forEach(subCode => {
      newOpd.subunsurs[subCode] = {};
      SUBUNSUR_DATA[subCode].params.forEach(param => { newOpd.subunsurs[subCode][param.id] = { level: 0 }; });
    });
    rows.push(newOpd);
    render();
    await saveData();
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
      await saveData();
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
  if (!isSaving && !pendingSave) {
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
function renderRtpEvidenceList(row){const e=document.getElementById('rtpEvidenceList');if(!e)return;const a=Array.isArray(row.rtpEvidence)?row.rtpEvidence:[];if(!a.length){e.innerHTML='<div class="sheet-link-card">Belum ada evidence RTP.</div>';return;}e.innerHTML='<div class="rtp-file-list">'+a.map((f,i)=>`<div class="rtp-file-item"><div><div class="rtp-file-name">📄 ${sheetLinksEsc(f.fileName||'File')}</div><div class="rtp-file-meta">${f.gdriveId?'Google Drive + R2':'R2'}${f.uploadedAt?' · '+sheetLinksEsc(f.uploadedAt):''}</div></div><div class="rtp-file-actions"><a href="${sheetLinksEsc(f.url||'#')}" target="_blank" rel="noopener noreferrer">Buka</a><button class="rtp-delete-btn" data-index="${i}">Hapus</button></div></div>`).join('')+'</div>';}
async function openRtpEvidenceModal(id){const row=rows.find(r=>r.id===id);if(!row)return;rtpEvidenceEditingRowId=id;document.getElementById('rtpEvidenceOpdName').textContent=row.opd||'Tanpa Nama';const folderInput=document.getElementById('rtpEvidenceFolderName');const preview=document.getElementById('rtpEvidenceFolderPreview');const setPreview=()=>{if(preview)preview.textContent=(folderInput?.value||'').trim()||'Evidence RTP';};if(folderInput){folderInput.value=row.rtpEvidenceFolder||'Evidence RTP';folderInput.oninput=setPreview;}setPreview();document.getElementById('rtpEvidenceModal').classList.add('active');rtpEvidenceSetStatus('Memuat daftar evidence RTP...');try{const d=await callServer('getRtpEvidence',{opdId:id,year:currentYear});row.rtpEvidence=Array.isArray(d.rtpEvidence)?d.rtpEvidence:[];row.rtpEvidenceFolder=d.folderName||row.rtpEvidenceFolder||'Evidence RTP';if(folderInput)folderInput.value=row.rtpEvidenceFolder;setPreview();renderRtpEvidenceList(row);rtpEvidenceSetStatus('Silakan tulis nama folder, lalu upload file.','success');}catch(err){rtpEvidenceSetStatus('Gagal memuat: '+err.message,'error');}}
async function uploadRtpEvidence(file){const row=rows.find(r=>r.id===rtpEvidenceEditingRowId);if(!row||!file)return;if(file.size>10*1024*1024)throw new Error('File melebihi 10 MB');const folderInput=document.getElementById('rtpEvidenceFolderName');const folderName=(folderInput?.value||row.rtpEvidenceFolder||'Evidence RTP').trim()||'Evidence RTP';if(folderName.length>100)throw new Error('Nama folder maksimal 100 karakter');row.rtpEvidenceFolder=folderName;const rd=new FileReader();const b64=await new Promise((res,rej)=>{rd.onload=()=>res(rd.result.split(',')[1]);rd.onerror=rej;rd.readAsDataURL(file);});rtpEvidenceSetStatus('Mengunggah '+file.name+' ke R2 dan Google Drive...');const d=await callServer('uploadRtpEvidence',{opdId:row.id,opdName:row.opd,year:currentYear,fileName:file.name,folderName,fileData:b64,fileType:file.type||'application/octet-stream'});row.rtpEvidence=Array.isArray(d.rtpEvidence)?d.rtpEvidence:[];row.rtpEvidenceFolder=d.folderName||folderName;renderRtpEvidenceList(row);render();rtpEvidenceSetStatus('Upload berhasil ke R2 dan Google Drive.','success');}
document.getElementById('rtpEvidenceFolderSave')?.addEventListener('click',async()=>{const row=rows.find(r=>r.id===rtpEvidenceEditingRowId);const input=document.getElementById('rtpEvidenceFolderName');const preview=document.getElementById('rtpEvidenceFolderPreview');if(!row||!input)return;const folderName=(input.value||'').trim()||'Evidence RTP';if(folderName.length>100){rtpEvidenceSetStatus('Nama folder maksimal 100 karakter.','error');return;}try{rtpEvidenceSetStatus('Menyimpan nama folder...');const d=await callServer('saveRtpEvidenceFolder',{opdId:row.id,year:currentYear,folderName});row.rtpEvidenceFolder=d.folderName||folderName;input.value=row.rtpEvidenceFolder;if(preview)preview.textContent=row.rtpEvidenceFolder;rtpEvidenceSetStatus('Nama folder tersimpan. File berikutnya akan masuk ke folder ini.','success');}catch(err){rtpEvidenceSetStatus('Gagal menyimpan nama folder: '+err.message,'error');}});document.getElementById('rtpEvidenceChoose')?.addEventListener('click',()=>document.getElementById('rtpEvidenceInput')?.click());document.getElementById('rtpEvidenceInput')?.addEventListener('change',async e=>{for(const f of Array.from(e.target.files||[])){try{await uploadRtpEvidence(f);}catch(err){rtpEvidenceSetStatus('Gagal upload: '+err.message,'error');}}e.target.value='';});document.getElementById('rtpEvidenceList')?.addEventListener('click',async e=>{const b=e.target.closest('.rtp-delete-btn');if(!b)return;const row=rows.find(r=>r.id===rtpEvidenceEditingRowId);if(!row)return;const f=(row.rtpEvidence||[])[Number(b.dataset.index)];if(!f)return;try{rtpEvidenceSetStatus('Menghapus...');const d=await callServer('deleteRtpEvidence',{opdId:row.id,year:currentYear,fileUrl:f.url,gdriveId:f.gdriveId||null});row.rtpEvidence=Array.isArray(d.rtpEvidence)?d.rtpEvidence:[];renderRtpEvidenceList(row);render();rtpEvidenceSetStatus('File dihapus.','success');}catch(err){rtpEvidenceSetStatus('Gagal hapus: '+err.message,'error');}});document.getElementById('rtpEvidenceRefresh')?.addEventListener('click',()=>{if(rtpEvidenceEditingRowId)openRtpEvidenceModal(rtpEvidenceEditingRowId);});function closeRtpEvidenceModal(){document.getElementById('rtpEvidenceModal')?.classList.remove('active');rtpEvidenceEditingRowId=null;}document.getElementById('rtpEvidenceClose')?.addEventListener('click',closeRtpEvidenceModal);document.getElementById('rtpEvidenceCloseFooter')?.addEventListener('click',closeRtpEvidenceModal);

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
