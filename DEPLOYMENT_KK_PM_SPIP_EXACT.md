# Deployment KK PM SPIP — Exact Workbook

## Template Google Spreadsheet
KK PM sekarang memerlukan template Google Spreadsheet yang merupakan salinan persis dari workbook:
`KK_PK_dan_Evaluasi_SPIP_Pemda_05052026_FORMULA_TEMPLATE(4).xlsx`

SHA-256 workbook sumber:
`0d6144307a164b356d8e666c868d16191799e6358895517a39a8e8aec414b1e8`

Gunakan environment variable berikut untuk memisahkan template PM dari template KK existing:
`GOOGLE_SHEETS_PM_TEMPLATE_ID=<ID Google Spreadsheet exact workbook>`

Bila variabel ini tidak diisi, kode PM fallback ke `GOOGLE_SHEETS_TEMPLATE_ID`, lalu `DEFAULT_KK_TEMPLATE_SPREADSHEET_ID`.

## Validasi otomatis saat sinkronisasi
Sistem memeriksa:
- 28 sheet dan urutan sheet sesuai workbook.
- 4 formula inti:
  - `KKLEAD_SPIP!I11 = H16+H50+H64`
  - `KKLEAD_SPIP!I68 = F83`
  - `KKLEAD_SPIP!I85 = F104`
  - `KKLEAD_SPIP!I106 = 'KKLEAD II'!L35`

Jika workbook PM lama masih berisi 19/21 sheet atau struktur metadata-nya tidak cocok, aplikasi akan menandainya `needsSync` dan membuat copy template exact baru.

## Performa multi-operator
Jangan menyalin seluruh isi workbook ke DOM dashboard. Workbook besar tetap berada di Google Spreadsheet. Dashboard menggunakan navigator metadata + preview kecil dan hanya menyimpan perubahan PM sebagai record sparse per parameter.

## Database
Tabel aktif PM:
- `opd_kk_pm_workpaper_items`
- `opd_kk_pm_meta`

Kunci utama item:
`tahun + opd_id + target + subunsur + param_id`

Tabel PM legacy tetap dibuat untuk kompatibilitas, tetapi tidak dipakai sebagai sumber aktif workpaper PM baru.

## Evidence
Upload tetap di `Evidence Struktur dan Proses`. KK PM hanya menarik file berdasarkan `evidenceKey`. File tidak di-upload ulang dan tidak diduplikasi.

## Nilai empat KPI
Empat KPI tidak boleh diedit manual. Server menyimpan hasil pembacaan formula sebagai cache read-only dan menolak `saveField` untuk `nilaiMaturitas`, `mri`, `iepk`, dan `nilaiKapabilitasApip`.
