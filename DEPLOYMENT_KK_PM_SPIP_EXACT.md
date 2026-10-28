# Deployment KK PM SPIP — Master Dinamis 28 Sheet dan Source Binding

> **Status terbaru per 27 Oktober 2026:** Panduan ini menggantikan instruksi lama yang mewajibkan tepat 26 tab. Master sumber `KK_PM_Evaluasi_SPIP_Pemda_RPJMD_2026_REVISI_SASARAN.xlsx` yang diberikan untuk perbaikan memiliki 28 tab. Source aktif sekarang mengenali daftar 28 tab tersebut, mempertahankan urutan/nama yang dikembalikan Google Sheets, dan tidak menolak tab tambahan di masa mendatang hanya karena jumlahnya bukan 26.

## 1. Sumber master yang benar

`GOOGLE_SHEETS_PM_TEMPLATE_ID` di Cloudflare Production merupakan sumber kebenaran jika terisi. Endpoint dashboard membaca ID efektif dari environment, meminta metadata langsung dari Google Sheets, lalu menampilkan ID, sumber, jumlah sheet, versi backend, serta hasil validasi formula/tab. ID D1 hanya menjadi fallback jika environment variable tidak terisi.

Master harus berupa **Google Sheets native**, bukan berkas `.xlsx` yang hanya diunggah ke Drive. Akun OAuth yang diwakili oleh `GOOGLE_DRIVE_REFRESH_TOKEN` harus dapat membuka master dan menyalinnya ke folder tujuan.

## 2. Inventaris 28 sheet master yang diverifikasi

Urutan nama pada berkas master yang diberikan:

1. `FAQ`
2. `DAFTAR KK`
3. `NAMA OPD`
4. `CHECKLIST PK`
5. `KKLEAD_SPIP`
6. `KKLEAD I_PEMDA`
7. `KKE 1.1 SASTRA PEMDA (BP4D)`
8. `KKE 1.2 SASTRA OPD`
9. `KKE 2.1 SASPRO OPD`
10. `KKE 2.2 SASKEG OPD`
11. `KKE 2.3 SASSUBKEG OPD`
12. `KKLEAD II`
13. `KK3.1 OPD`
14. `KK3.2 BPKAD AKUN`
15. `KK3.3 BPKAD ASET`
16. `KK3.4 (INSPEKTORAT)`
17. `KK 4 INSPEKTORAT`
18. `KKLEAD III`
19. `KK 5.1 A RPJMD (BP4D)`
20. `KK 5.1 B  OPD`
21. `KK 5.1 C OPD`
22. `KK 5.2 OPD`
23. `KK 6 INSPEKTORAT`
24. `KK 7 INSPEKTORAT`
25. `KK 8 INSPEKTORAT`
26. `Ref PCT`
27. `REF`
28. `INDIKATOR HASIL`

Validasi menormalisasi alias tab inti yang memang setara (contoh `KK 5.1 A RPJMD (BP4D)` menjadi anchor KK 5.1 A). Nama sheet aktual tidak diubah. `CHECKLIST PK`, `KK 4 INSPEKTORAT`, dan tab baru lainnya dipertahankan sebagai tab fisik master. Tab inti yang hilang atau duplikat tetap menyebabkan validasi gagal.

## 3. Formula inti

Master PM memeriksa formula berikut:

- `KKLEAD_SPIP!I11` = `=H16+H50+H64`
- `KKLEAD_SPIP!I68` = `=F83`
- `KKLEAD_SPIP!I85` = `=F104`
- `KKLEAD_SPIP!I106` = `='KKLEAD II'!L35`

Variasi ekuivalen yang sudah disetujui kode validator dapat diterima. Periksa formula di Google Sheets jika validasi memberi diagnosis formula.

## 4. Perilaku tombol

- **Muat Ulang:** memuat ulang workbook Pemda dan membaca ulang metadata master dari ID efektif di backend. Panel konfigurasi menampilkan `Sumber aktif`, ID, jumlah sheet, error validasi, dan `Build backend`.
- **Sinkronkan Master:** terlebih dahulu membaca dan memvalidasi `GOOGLE_SHEETS_PM_TEMPLATE_ID`; lalu mengirim ID itu sebagai prasyarat untuk menyalin workbook Pemda. Server menolak proses jika versi backend lama, master tidak lolos validasi, atau ID sumber berubah.
- **Validasi ID & Perbarui Semua Workbook:** memvalidasi master aktif dan menyebarkan salinan baru ke workbook Pemda serta target OPD tahun aktif. Hasil tiap OPD, mirror R2, dan pengarsipan file lama dicatat terpisah.

Setiap OPD tetap memiliki workbook sendiri. Data dari OPD tidak dicampur ke satu file bersama. Workbook Drive lama tidak dihapus permanen; link lama dicatat dalam riwayat pemulihan.

## 5. Langkah deploy dan verifikasi produksi

1. Backup repository dan database sebelum perubahan massal.
2. Unggah/commit seluruh source dari ZIP perbaikan `Kawal_SPIP_FIX_PM_MASTER_SOURCE_BINDING_V4_20261027.zip` ke repository yang benar-benar dipakai Cloudflare Pages.
3. Pastikan commit masuk ke branch produksi dan deployment Cloudflare Pages sukses. Source utama yang harus ikut dalam commit: `functions/myCloudinaryHandler.js`, `public/script.js`, `public/index.html`, serta manifest JSON.
4. Pada **Cloudflare Dashboard → Workers & Pages → project Pages → Settings → Variables and Secrets → Production**, pastikan `GOOGLE_SHEETS_PM_TEMPLATE_ID` berisi ID/URL Google Sheets master baru. Pastikan `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, dan `GOOGLE_DRIVE_FOLDER_ID` aktif pada lingkungan Production. Jika variable diubah, simpan lalu deploy ulang.
5. Login sebagai Super Admin/Pemda atau Irban, buka dashboard KK PM SPIP, tekan **Muat Ulang**. Teks konfigurasi harus menunjukkan sumber `GOOGLE_SHEETS_PM_TEMPLATE_ID dari Cloudflare`, 28 sheet (atau jumlah aktual master), dan **Build backend `20261027-pm-master-source-guard-v4`**.
6. Jika build backend tidak ditampilkan, atau panel menulis `Backend lama / belum terdiagnosis`, deployment yang melayani endpoint `/myCloudinaryHandler` belum menggunakan source terbaru. Periksa branch/project Pages dan Functions deployment; jangan menjalankan pembaruan massal sebelum build terbaru aktif.
7. Bila metadata master terbaca dan validasi lulus, tekan **Sinkronkan Master**. Pastikan respons menunjukkan ID master sumber yang sama dengan ID pada panel konfigurasi dan workbook baru berisi semua sheet master.
8. Jalankan **Validasi ID & Perbarui Semua Workbook** hanya setelah uji workbook Pemda berhasil. Ini operasi massal untuk OPD tahun aktif, sehingga lakukan saat periode kerja aman dan pantau hasil gagal per OPD.

## 6. Interpretasi error

- `404 NOT_FOUND` untuk workbook lama: link workbook Pemda yang tersimpan di D1 tidak dapat dibaca. Muat ulang akan tetap menunjukkan inventory master aktif; sinkronisasi membuat salinan Pemda dari master setelah validasi lulus.
- `ID master aktif ... tidak ditemukan`, bukan Google Sheets, atau metadata gagal dibaca: periksa ID pada variable Production dan akses akun OAuth.
- `Master perlu diperiksa` beserta daftar sheet/formula: ID master terbaca, tetapi tab inti/formula wajib belum lolos validasi.
- `Backend lama / belum terdiagnosis`: UI belum menerima marker versi terbaru dari Pages Function; perbaiki deployment sebelum mencoba sinkron.
- `Sumber master berubah/berbeda`: ID yang dilihat UI tidak sama dengan ID efektif yang dipakai backend. Sinkronisasi dihentikan agar tidak menyalin dari sumber yang berbeda.

## 7. Batas uji

Paket perbaikan menjalankan pemeriksaan sintaks dan skrip validasi lokal, termasuk daftar 28 nama sheet. Pengeditan ini tidak memiliki akses OAuth, D1, R2, atau deployment Cloudflare produksi Anda; oleh karena itu sinkronisasi live harus diverifikasi dari dashboard setelah deployment.
