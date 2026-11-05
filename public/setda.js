/* Uses the existing authenticated API client and current year; no credentials in assets. */
let setdaUiBusy=false;
function setdaOwnerCanView(){
  if(typeof currentUser==='undefined'||!currentUser)return false;
  // The 'Pemda' account from the Excel is admin_daerah (role admin);
  // opd_setda is the separate parent OPD account.
  const name=String(currentUser.opdName||'').trim().toUpperCase();
  return currentUser.role==='admin'||name==='SEKRETARIAT DAERAH'||String(currentUser.username||'').toLowerCase()==='opd_setda';
}
function renderSetdaEntry(){
  const allowed=setdaOwnerCanView();
  const nav=document.getElementById('btnSetdaPartsNav');
  if(nav?.style)nav.style.display=allowed?'inline-flex':'none';
  const dashboard=document.getElementById('setdaDashboardPanel');
  if(dashboard)dashboard.hidden=!allowed;
  const pemda=document.getElementById('pemdaSetdaPanel');
  if(pemda)pemda.hidden=!allowed;
  let host=document.getElementById('setdaEntry');
  if(!host){const table=document.getElementById('tableBody')?.closest('table');
    if(table){host=document.createElement('section');host.id='setdaEntry';host.className='setda-panel';table.parentElement.before(host);}}
  if(!host)return;
  host.hidden=!allowed;
  if(allowed){
    host.innerHTML='<div><strong>Sekretariat Daerah · 9 Bagian</strong><p>9 operator bagian, dokumen dan evidence terpisah, digabung pada workbook induk Setda.</p></div><button type="button" id="setdaOpen">Buka 9 Bagian Setda</button>';
    document.getElementById('setdaOpen')?.addEventListener('click',openSetdaCompilation);
  }
}
function setdaEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function setdaLink(url,label){return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+/.test(url||'')?`<a href="${setdaEscape(url)}" target="_blank" rel="noopener noreferrer">${setdaEscape(label)}</a>`:'Belum dibuat';}
function setdaDialog(){
  let dialog=document.getElementById('setdaDialog');if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id='setdaDialog';dialog.className='setda-dialog';
  dialog.innerHTML='<header><div><h2>Kompilasi Sekretariat Daerah</h2><p id="setdaYear"></p></div><button type="button" id="setdaClose">Tutup</button></header><div class="setda-actions"><button id="setdaSetup" type="button">Aktifkan 9 Bagian</button><button id="setdaImportAccounts" type="button">Perbaiki Login dari Excel (9 Akun)</button><input id="setdaImportFile" type="file" accept=".xlsx" hidden><button id="setdaReload" type="button">Muat Ulang</button><button id="setdaPrepare" type="button" class="setda-primary">Buat / Sinkronkan Workbook Induk</button><button id="setdaSync" type="button" class="setda-primary">Gabungkan 9 Bagian ke Sheet Induk</button><span id="setdaWorkbook"></span></div><p id="setdaStatus" role="status" aria-live="polite"></p><div id="setdaMergeResults" role="region" aria-label="Hasil kompilasi"></div><div id="setdaCredentials"></div><div id="setdaContent"></div>';
  document.body.append(dialog);
  document.getElementById('setdaClose').onclick=()=>dialog.close();
  document.getElementById('setdaReload').onclick=()=>loadSetdaCompilation();
  document.getElementById('setdaSetup').onclick=()=>setdaSetup();
  document.getElementById('setdaImportAccounts').onclick=()=>{if(currentUser?.role==='admin')document.getElementById('setdaImportFile').click();};
  document.getElementById('setdaImportFile').addEventListener('change',setdaImportFromExcel);
  document.getElementById('setdaPrepare').onclick=()=>setdaPrepareWorkbook();
  document.getElementById('setdaSync').onclick=()=>setdaSync();return dialog;
}
function setdaStatus(message){document.getElementById('setdaStatus').textContent=message;}
async function openSetdaCompilation(){const dialog=setdaDialog();document.getElementById('setdaYear').textContent='Tahun '+currentYear+' · urutan Bagian Hukum sampai Bagian Umum';if(!dialog.open)dialog.showModal();await loadSetdaCompilation();}
async function loadSetdaCompilation(){
  if(setdaUiBusy)return;setdaUiBusy=true;
  try{
    setdaStatus('Memuat data bagian…');const data=await callServer('getSetdaCompilation',{year:currentYear});
    document.getElementById('setdaSetup').hidden=currentUser?.role!=='admin';
    document.getElementById('setdaImportAccounts').hidden=currentUser?.role!=='admin';
    document.getElementById('setdaSetup').textContent=data.enabled?'Periksa/Aktifkan Akun yang Belum Ada':'Aktifkan 9 Bagian';
    document.getElementById('setdaSync').disabled=!data.enabled;
    document.getElementById('setdaPrepare').disabled=!data.enabled;
    const state=data.state||{};
    document.getElementById('setdaWorkbook').innerHTML=state.spreadsheetId?setdaLink(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(state.spreadsheetId)}/edit`,'Buka hasil gabungan'):'';
    setdaStatus(!data.enabled?'Belum diaktifkan pada tahun ini. Super Admin dapat mengaktifkan sembilan bagian.':state.error?'Sinkronisasi perlu perhatian: '+state.error:state.busy?'Kompilasi sedang berjalan.':state.lastSuccess&&state.compilationMatchesParent?'Kompilasi terakhir: '+new Date(state.lastSuccess).toLocaleString('id-ID')+'. Otomatis diperiksa Worker sekitar 5 menit sekali.':'Gunakan Buat / Sinkronkan Workbook Induk untuk memeriksa tautan Google Drive; lanjutkan Gabungkan 9 Bagian setelah valid.');
    const parts=data.parts||[],items=data.items||[],files=data.evidence||[];
    const accountSum=data.accountSummary||{};
    if(!data.enabled)setdaStatus(`9 bagian terdaftar pada aplikasi; kompilasi belum diaktifkan. ${accountSum.active||0}/9 akun login aktif di D1. Jalankan SQL aktivasi privat atau impor Excel melalui Super Admin.`);
    document.getElementById('setdaContent').innerHTML=`<div class="setda-grid">${parts.map(p=>`<article><small>BAGIAN ${String(p.order).padStart(2,'0')}</small><h3>${setdaEscape(p.name)}</h3><p>${p.items} parameter · ${p.evidence} evidence aktif</p><p>Akun: <code>${setdaEscape(p.username)}</code> · <strong>${p.accountStatus==='aktif'?'Akun aktif di D1':p.accountStatus==='nonaktif'?'Akun nonaktif':'Belum ada di D1'}</strong></p>${setdaLink(p.workbookUrl,'Buka KK PM SPIP Bagian')}</article>`).join('')}</div>${data.enabled?'<p class="setda-note"><b>Mode tanpa sheet tambahan.</b> Penggabungan dilakukan dalam sel input yang sudah ada pada workbook induk; sel formula tidak diubah. Nilai/grade antarbagian yang berbeda tidak dihitung secara spekulatif, melainkan dilaporkan untuk rekonsiliasi. Seluruh isian asli di 9 bagian tetap tersimpan.</p>':''}
      <details><summary>Isian KK PM SPIP gabungan (${items.length})</summary><div class="setda-scroll"><table><thead><tr><th>Bagian</th><th>Target / Parameter</th><th>Hasil Pengujian</th><th>Grade</th><th>Catatan</th></tr></thead><tbody>${items.map(x=>`<tr><td>${setdaEscape(x.partName)}</td><td>${setdaEscape(x.target+' / '+x.subunsur+' / '+x.param_id)}</td><td>${setdaEscape(x.hasil_pengujian)}</td><td>${setdaEscape(x.grade_result)}</td><td>${setdaEscape(x.note)}</td></tr>`).join('')}</tbody></table></div></details>
      <details><summary>Evidence Struktur dan Proses gabungan (${files.length})</summary><div class="setda-scroll"><table><thead><tr><th>Bagian</th><th>Parameter</th><th>File</th><th>Salinan Drive</th><th>Verifikasi</th></tr></thead><tbody>${files.map(x=>`<tr><td>${setdaEscape(x.partName)}</td><td>${setdaEscape([x.target_code,x.subunsur,x.param_id,x.grade].join(' / '))}</td><td><a href="${setdaEscape(x.url)}" target="_blank" rel="noopener noreferrer">${setdaEscape(x.file_name)}</a></td><td>${setdaEscape(x.sync_status)}</td><td>${setdaEscape(x.verification_status||'Belum')}</td></tr>`).join('')}</tbody></table></div></details>`;
  }catch(e){setdaStatus(e.message||'Gagal memuat kompilasi.');}finally{setdaUiBusy=false;}
}
async function setdaImportFromExcel(event){
  const file=event?.target?.files?.[0];
  if(event?.target)event.target.value='';
  if(!file||setdaUiBusy||currentUser?.role!=='admin')return;
  if(!/\.xlsx$/i.test(file.name)||file.size>2*1024*1024){setdaStatus('Pilih file Excel .xlsx daftar 41 akun (maksimal 2 MB).');return;}
  setdaUiBusy=true;
  const btn=document.getElementById('setdaImportAccounts');if(btn)btn.disabled=true;
  let accounts=[];
  try{
    setdaStatus('Memvalidasi 9 username/password dari Excel di perangkat Anda…');
    // XLSX is an existing, locally hosted asset. The workbook bytes are never
    // transferred to our servers, only 9 selected credentials via authenticated TLS.
    const XLSX=await ensureExportLibrary('XLSX');
    const workbook=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array',cellFormula:false});
    const sheet=workbook.Sheets['Daftar Akun'];
    if(!sheet)throw new Error('Sheet "Daftar Akun" tidak ditemukan dalam Excel.');
    const data=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
    const expected=['setda_hukum','setda_ekonomi_sda','setda_adbang','setda_organisasi','setda_prokopim','setda_pemerintahan','setda_kesra','setda_pbj','setda_umum'];
    const found=new Map();
    for(const row of data){
      const username=String(row[3]||'').trim().toLowerCase();
      if(!expected.includes(username))continue;
      if(found.has(username))throw new Error('Username duplikat pada Excel: '+username);
      const password=String(row[4]||'');
      if(password.length<16||password.length>256)throw new Error('Password '+username+' harus 16–256 karakter.');
      found.set(username,password);
    }
    if(expected.some(username=>!found.has(username)))throw new Error('Excel tidak memuat lengkap kesembilan username Setda.');
    accounts=expected.map(username=>({username,password:found.get(username)}));
    if(!await window.kawalConfirmSpreadsheet({title:'Konfirmasi Impor 9 Akun Setda',description:`Tahun ${currentYear} · 9 akun bagian`,detail:'Hanya 9 password yang dipilih dari Excel akan diperbarui. Sesi akun lama diputus; workbook dan evidence tidak berubah.',confirmText:'Ya, Impor 9 Akun'}))return;
    setdaStatus('Menyinkronkan password terenkripsi dan akses 9 bagian ke Cloudflare D1…');
    const result=await callServer('repairSetdaAccounts',{year:currentYear,accounts});
    setdaStatus(result.message+' Akun diperbarui: '+result.updated+'; akun dibuat: '+result.created+'. Silakan lakukan uji login.');
  }catch(e){setdaStatus(e.message||'Impor akun gagal.');}
  finally{
    accounts=[];setdaUiBusy=false;if(btn)btn.disabled=false;
    // Do not retain passwords in localStorage, app state or visible DOM.
  }
}
async function setdaSetup(){
  if(setdaUiBusy)return;
  if(!await window.kawalConfirmSpreadsheet({title:'Aktifkan 9 Bagian Sekretariat Daerah?',description:`Tahun ${currentYear}`,detail:'Mendaftarkan identitas/akun bagian yang belum ada. Tidak menghapus data atau mengubah workbook lainnya.',confirmText:'Ya, Aktifkan 9 Bagian'}))return;
  setdaUiBusy=true;const button=document.getElementById('setdaSetup');button.disabled=true;
  try{setdaStatus('Menyiapkan akun dan penyimpanan sembilan bagian…');const result=await callServer('setupSetda',{year:currentYear});
    const credentials=result.credentials||[];
    if(credentials.length){
      const box=document.getElementById('setdaCredentials');box.innerHTML='<p><strong>Simpan daftar akun baru sekarang.</strong> Password tidak ditampilkan kembali setelah logout atau halaman dimuat ulang. Akun yang sudah ada tetap memakai password sebelumnya.</p><button type="button" id="setdaDownloadAccounts">Unduh Akun Baru (CSV)</button>';
      const download=()=>{const quote=v=>'"'+String(v).replace(/"/g,'""')+'"';const csv='\uFEFF'+[['Bagian','Username','Password'],...credentials.map(c=>[c.bagian,c.username,c.password])].map(r=>r.map(quote).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='AKUN_SETDA_PRIVAT_'+currentYear+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);};
      document.getElementById('setdaDownloadAccounts').onclick=download;download();
      // Keep the download available until logout/page reload; never persist passwords to localStorage.
    }
    setdaStatus(result.message);
  }catch(e){setdaStatus(e.message);}finally{button.disabled=false;setdaUiBusy=false;}
  await loadSetdaCompilation();
}
function setdaShowMergeResults(result){
  const region=document.getElementById('setdaMergeResults');if(!region)return;
  const warnings=Array.isArray(result.warnings)?result.warnings:[];
  const conflicts=Array.isArray(result.conflicts)?result.conflicts:[];
  const details=[...conflicts.slice(0,30).map(x=>`<li><b>${setdaEscape(x.sheet||'?')}!${setdaEscape(x.cell||'?')}</b>: ${setdaEscape(x.reason||'Butuh penelaahan')}</li>`),...warnings.slice(0,15).map(x=>`<li>${setdaEscape(x)}</li>`)];
  region.innerHTML=`<div class="setda-merge-summary"><strong>${Number(result.written||0)} sel diperbarui · ${Number(result.unchanged||0)} tanpa perubahan</strong><span>${Number(result.conflictCount||0)} konflik · ${Number(result.warningCount||0)} peringatan</span><small>${Number(result.sheetCount||0)} sheet dipertahankan · Formula KK LEAD utama diperiksa · ${Number(result.sourceWorkbooksRead||0)}/9 sumber Google Sheets terbaca</small></div>${details.length?`<details open><summary>Rincian konflik/peringatan yang perlu diperiksa</summary><ol>${details.join('')}</ol></details>`:''}`;
}
async function setdaPrepareWorkbook(){
  if(setdaUiBusy)return;
  const confirmed=await window.kawalConfirmSpreadsheet({
    title:'Buat / Sinkronkan Workbook Induk Setda?',
    description:`Sekretariat Daerah · Tahun ${currentYear}`,
    detail:'Aplikasi memeriksa file Google Drive yang sudah ada. Jika valid, ID yang sama dipakai. Jika terhapus, sistem mencari file pemulihan di folder Setda lalu baru membuat satu salinan dari master resmi bila benar-benar diperlukan. Formula dan data bagian tidak dihapus.',
    confirmText:'Ya, Periksa / Buat Workbook'
  });
  if(!confirmed)return;
  const button=document.getElementById('setdaPrepare');setdaUiBusy=true;button.disabled=true;
  try{
    setdaStatus('Memeriksa workbook induk, Google Drive, dan seluruh formula utama…');
    const result=await callServer('prepareSetdaWorkbook',{year:currentYear});
    setdaStatus(result.message||'Workbook induk telah diperiksa.');
    const box=document.getElementById('setdaWorkbook');
    box.innerHTML=result.workbookUrl?setdaLink(result.workbookUrl,'Buka workbook induk yang valid'):'';
    document.getElementById('setdaMergeResults').innerHTML='<p class="setda-note">Workbook induk sudah siap. Klik Gabungkan 9 Bagian untuk memproses sel input pada sheet asli tanpa menambah sheet baru.</p>';
  }catch(e){setdaStatus('Gagal memeriksa/memulihkan workbook induk: '+(e.message||e));}
  finally{setdaUiBusy=false;button.disabled=false;}
}
async function setdaSync(){
  if(setdaUiBusy)return;
  const confirmed=await window.kawalConfirmSpreadsheet({
    title:'Gabungkan Kompilasi 9 Bagian?',description:`KK PM SPIP Sekretariat Daerah · Tahun ${currentYear}`,
    detail:'Semua sumber bagian dibaca secara berurutan. Hanya sel input pada sheet induk yang sudah ada yang boleh diperbarui; rumus tidak ditimpa, tidak dibuat workbook/sheet ganda. Perbedaan grade dan isian induk yang berubah manual ditandai sebagai konflik.',
    confirmText:'Ya, Gabungkan ke Induk'
  });
  if(!confirmed)return;
  const button=document.getElementById('setdaSync');setdaUiBusy=true;button.disabled=true;
  try{
    setdaStatus('Memvalidasi 9 sumber, area sel input, dan rumus KK LEAD pada workbook induk…');
    const result=await callServer('syncSetdaCompilation',{year:currentYear});
    if(result.compilationStatus==='pending'){setdaStatus(result.message);return;}
    setdaStatus(result.message);
    setdaShowMergeResults(result);
    if(result.spreadsheetUrl)document.getElementById('setdaWorkbook').innerHTML=setdaLink(result.spreadsheetUrl,'Buka hasil kompilasi pada workbook induk');
  }catch(e){setdaStatus('Kompilasi tidak selesai: '+(e.message||e));}
  finally{setdaUiBusy=false;button.disabled=false;}
}
async function loadPemdaSetdaPanel(){
  const panel=document.getElementById('pemdaSetdaPanel');
  if(!panel)return;
  panel.hidden=!setdaOwnerCanView();
  if(panel.hidden)return;
  const summary=document.getElementById('pemdaSetdaSummary');
  const grid=document.getElementById('pemdaSetdaGrid');
  if(!summary||!grid)return;
  summary.textContent='Memuat status 9 bagian dari database D1…';
  try{
    const data=await callServer('getSetdaCompilation',{year:currentYear});
    if(!setdaOwnerCanView()||!document.getElementById('pemdaSetdaPanel'))return;
    const stats=data.accountSummary||{};
    summary.textContent=`Tahun ${currentYear} · ${stats.active||0} dari 9 akun aktif · ${stats.missing||0} belum dibuat · ${stats.disabled||0} nonaktif`;
    grid.innerHTML=(data.parts||[]).map(p=>`<article><small>BAGIAN ${String(p.order||0).padStart(2,'0')}</small><h3>${setdaEscape(p.name)}</h3><p>Akun: <code>${setdaEscape(p.username)}</code></p><p>${p.accountStatus==='aktif'?'Akun aktif':p.accountStatus==='nonaktif'?'Akun dinonaktifkan':'Belum terdaftar di D1'} · ${Number(p.items||0)} parameter · ${Number(p.evidence||0)} evidence</p></article>`).join('');
  }catch(e){summary.textContent='Status bagian belum dapat dimuat: '+String(e.message||e);grid.innerHTML='';}
}
document.getElementById('btnSetdaPartsNav')?.addEventListener('click',openSetdaCompilation);
document.getElementById('setdaDashboardOpen')?.addEventListener('click',openSetdaCompilation);
document.getElementById('pemdaSetdaOpen')?.addEventListener('click',openSetdaCompilation);
document.getElementById('btnPemdaPmKk')?.addEventListener('click',()=>{void loadPemdaSetdaPanel();});
setInterval(()=>{if(currentUser&&document.getElementById('setdaDialog')?.open&&!document.hidden)loadSetdaCompilation();if(!currentUser){document.getElementById('setdaDialog')?.remove();const entry=document.getElementById('setdaEntry');if(entry)entry.hidden=true;}},60000);

if(typeof currentUser!=='undefined'&&currentUser&&typeof rows!=='undefined')renderSetdaEntry();
