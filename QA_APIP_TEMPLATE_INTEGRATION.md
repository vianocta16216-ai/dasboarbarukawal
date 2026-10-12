# Integrasi QA APIP sesuai Template Excel

## File perubahan
- `public/qa-apip-workbook-master.json` — master data 671 item, 43 parameter, 30 baris rekap unsur/subunsur, metadata petunjuk.
- `public/Template_Penjaminan_Kualitas_QA_APIP_KAWAL_SPIP.xlsx` — template sumber empat sheet untuk ekspor.
- `public/script.js` — form QA, tarikan evidence, formula nilai, rekap parameter/unsur, autosave, pagination, ekspor berbasis patch XML agar struktur workbook sumber tidak dibangun ulang.
- Dependensi JSZip di CDN jsDelivr (`public/index.html`) — mengubah sel input di dalam ZIP XLSX tanpa menulis ulang seluruh workbook.
- `public/index.html` — navigasi modal QA.
- `public/style.css` — format form template, tabel dan pagination yang khusus QA.
- `functions/myCloudinaryHandler.js` — ringkasan QA agar memakai data baru (lihat perubahan backend di ZIP).
- `KK_PM_SPIP_IMPLEMENTASI.md` — dokumentasi integrasi.

## Hubungan evidence
QA mengambil file dari endpoint `getWorkbookEvidenceFiles` dan hanya menggunakan file aktif yang memiliki `r2_key` serta nama file. Pengaitan memakai `subunsur`, `paramId` (nomor parameter), `grade`, dan `targetCode` (`T1` sampai `T4`). Sumber unggah/hapus tetap modul yang sudah ada: **Evidence Struktur dan Proses**. Jangan menambah tab/tempat unggah evidence kedua.

## Ekspor dan validasi input
- Ekspor mempertahankan 4 sheet asli, formula, format/style, merge, print setup, dan dropdown dengan mengedit XML sel input pada salinan template. File evidence ditampilkan pada kolom K dan menjadi hyperlink eksternal pada file pertama yang cocok.
- Template sumber memiliki rentang validasi yang bergeser satu kolom dibanding judul input. Saat ekspor, rentang saja yang diluruskan: Ketersediaan `L6:L676`, Keabsahan/Periode `N6:O676`, dan Substansi `P6:P676`; formula penilaian tidak diubah.

## Perhitungan
- Ketersediaan kosong/N/A: nilai kosong; N/A dihitung terpisah dan dikeluarkan dari penyebut nilai.
- `Tidak Ada` atau `Tidak Sesuai`: nilai 0.
- Keabsahan `Ya` + periode `Ya` + substansi `Sesuai`: nilai 1.
- Item yang telah dinilai dengan kombinasi lainnya: nilai 0,5.
- KPI QA: rata-rata nilai numeric (jumlah nilai dibagi jumlah item dengan nilai numeric), dikali 100.
- Rekap parameter dan unsur dihitung dari state QA per OPD/tahun; data OPD tidak digabung saat menyimpan.

## GitHub Pages / Cloudflare Pages
Unggah/ganti file sesuai jalur di atas dan deploy ulang. Tidak ada migrasi/drop tabel yang dilakukan; tabel QA sparse yang sudah tersedia tetap digunakan. Jangan mengganti atau menghapus file modul Evidence Struktur dan Proses. Setelah deploy, hard-refresh browser untuk mengambil master JSON/JS baru.
