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
  dialog.innerHTML='<header><div><h2>Kompilasi Sekretariat Daerah</h2><p id="setdaYear"></p></div><button type="button" id="setdaClose">Tutup</button></header><div class="setda-actions"><button id="setdaSetup" type="button">Aktifkan 9 Bagian</button><button id="setdaReload" type="button">Muat Ulang</button><button id="setdaSync" type="button">Sinkronkan Spreadsheet Induk</button><span id="setdaWorkbook"></span></div><p id="setdaStatus" role="status" aria-live="polite"></p><div id="setdaCredentials"></div><div id="setdaContent"></div>';
  document.body.append(dialog);
  document.getElementById('setdaClose').onclick=()=>dialog.close();
  document.getElementById('setdaReload').onclick=()=>loadSetdaCompilation();
  document.getElementById('setdaSetup').onclick=()=>setdaSetup();
  document.getElementById('setdaSync').onclick=()=>setdaSync();return dialog;
}
function setdaStatus(message){document.getElementById('setdaStatus').textContent=message;}
async function openSetdaCompilation(){const dialog=setdaDialog();document.getElementById('setdaYear').textContent='Tahun '+currentYear+' · urutan Bagian Hukum sampai Bagian Umum';if(!dialog.open)dialog.showModal();await loadSetdaCompilation();}
async function loadSetdaCompilation(){
  if(setdaUiBusy)return;setdaUiBusy=true;
  try{
    setdaStatus('Memuat data bagian…');const data=await callServer('getSetdaCompilation',{year:currentYear});
    document.getElementById('setdaSetup').hidden=currentUser?.role!=='admin';
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
