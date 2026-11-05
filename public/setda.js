/* Uses the existing authenticated API client and current year; no credentials in assets. */
let setdaUiBusy=false;
function renderSetdaEntry(){
  let host=document.getElementById('setdaEntry');
  const allowed=currentUser&&(currentUser.role==='admin'||rows.some(r=>String(r.opd||'').trim().toUpperCase()==='SEKRETARIAT DAERAH'));
  if(!host){const table=document.getElementById('tableBody')?.closest('table');if(!table)return;host=document.createElement('section');host.id='setdaEntry';host.className='setda-panel';table.parentElement.before(host);}
  host.hidden=!allowed;
  if(allowed)host.innerHTML='<div><strong>Sekretariat Daerah · 9 Bagian</strong><p>Pengisian dan evidence terpisah per bagian. Hasil dihimpun berurutan dalam workbook induk.</p></div><button type="button" id="setdaOpen">Buka Kompilasi Bagian</button>';
  document.getElementById('setdaOpen')?.addEventListener('click',openSetdaCompilation);
}
function setdaEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function setdaLink(url,label){return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+/.test(url||'')?`<a href="${setdaEscape(url)}" target="_blank" rel="noopener noreferrer">${setdaEscape(label)}</a>`:'Belum dibuat';}
function setdaDialog(){
  let dialog=document.getElementById('setdaDialog');if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id='setdaDialog';dialog.className='setda-dialog';
  dialog.innerHTML='<header><div><h2>Kompilasi Sekretariat Daerah</h2><p id="setdaYear"></p></div><button type="button" id="setdaClose">Tutup</button></header><div class="setda-actions"><button id="setdaSetup" type="button">Aktifkan 9 Bagian</button><button id="setdaImportAccounts" type="button">Perbaiki Login dari Excel (9 Akun)</button><input id="setdaImportFile" type="file" accept=".xlsx" hidden><button id="setdaReload" type="button">Muat Ulang</button><button id="setdaSync" type="button">Sinkronkan Spreadsheet Induk</button><span id="setdaWorkbook"></span></div><p id="setdaStatus" role="status" aria-live="polite"></p><div id="setdaCredentials"></div><div id="setdaContent"></div>';
  document.body.append(dialog);
  document.getElementById('setdaClose').onclick=()=>dialog.close();
  document.getElementById('setdaReload').onclick=()=>loadSetdaCompilation();
  document.getElementById('setdaSetup').onclick=()=>setdaSetup();
  document.getElementById('setdaImportAccounts').onclick=()=>{if(currentUser?.role==='admin')document.getElementById('setdaImportFile').click();};
  document.getElementById('setdaImportFile').addEventListener('change',setdaImportFromExcel);
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
    const state=data.state||{};
    document.getElementById('setdaWorkbook').innerHTML=state.spreadsheetId?setdaLink(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(state.spreadsheetId)}/edit`,'Buka hasil gabungan'):'';
    setdaStatus(!data.enabled?'Belum diaktifkan pada tahun ini. Super Admin dapat mengaktifkan sembilan bagian.':state.error?'Sinkronisasi perlu perhatian: '+state.error:state.busy?'Kompilasi sedang berjalan.':state.lastSuccess?'Spreadsheet terakhir diperbarui '+new Date(state.lastSuccess).toLocaleString('id-ID')+'. Pembaruan otomatis sekitar 5 menit setelah Worker aktif.':'Data aplikasi tergabung otomatis. Buat workbook induk melalui KK PM SPIP, lalu sinkronkan.');
    const parts=data.parts||[],items=data.items||[],files=data.evidence||[];
    document.getElementById('setdaContent').innerHTML=`<div class="setda-grid">${parts.map(p=>`<article><small>BAGIAN ${String(p.order).padStart(2,'0')}</small><h3>${setdaEscape(p.name)}</h3><p>${p.items} parameter · ${p.evidence} evidence aktif</p><p>Akun: <code>${setdaEscape(p.username)}</code></p>${setdaLink(p.workbookUrl,'Buka KK PM SPIP Bagian')}</article>`).join('')}</div>${data.enabled?'<p class="setda-note">Isi melalui akun masing-masing bagian. Tab SETDA_ pada workbook induk adalah hasil kompilasi; perubahan dilakukan pada sumber bagian. Grade tiap bagian tetap ditampilkan terpisah untuk penelaahan Sekretariat Daerah.</p>':''}
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
    if(!window.confirm('Perbarui password 9 akun SETDA pada database Cloudflare D1 sesuai Excel ini? Hanya 9 akun bagian yang berubah. Semua sesi lama dari 9 akun akan diputus.'))return;
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
  if(setdaUiBusy)return;setdaUiBusy=true;const button=document.getElementById('setdaSetup');button.disabled=true;
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
async function setdaSync(){
  if(setdaUiBusy)return;setdaUiBusy=true;const button=document.getElementById('setdaSync');button.disabled=true;
  try{setdaStatus('Membaca sembilan sumber dan memperbarui workbook induk…');const result=await callServer('syncSetdaCompilation',{year:currentYear});setdaStatus(result.message);}
  catch(e){setdaStatus(e.message);}finally{setdaUiBusy=false;button.disabled=false;}
}
setInterval(()=>{if(currentUser&&document.getElementById('setdaDialog')?.open&&!document.hidden)loadSetdaCompilation();if(!currentUser){document.getElementById('setdaDialog')?.remove();const entry=document.getElementById('setdaEntry');if(entry)entry.hidden=true;}},60000);

if(typeof currentUser!=='undefined'&&currentUser&&typeof rows!=='undefined')renderSetdaEntry();
