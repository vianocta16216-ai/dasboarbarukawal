# Kawal SPIP — Perbaikan Master Google Sheets 28 Sheet (v4)

ZIP ini memperbaiki masalah master spreadsheet yang tetap menampilkan 26 sheet, `404 NOT_FOUND` pada workbook Pemda lama, serta tombol **Muat Ulang**/**Sinkronkan Master** yang tidak membuktikan bahwa backend aktif benar-benar membaca `GOOGLE_SHEETS_PM_TEMPLATE_ID`.

## Temuan dari rekaman dan workbook pengguna

- File Excel yang dilampirkan mempunyai 28 sheet dengan nama resmi PM/RPJMD/Inspektorat.
- Rekaman live menampilkan 26 sheet serta error bahwa `CHECKLIST PK`, `KK 4 INSPEKTORAT`, `KK 5.1 A RPJMD (BP4D)`, dan tab Inspektorat KK 6–8 merupakan tab asing. Pesan tersebut berasal dari validator backend lama yang masih mengunci 26 tab.
- Source v4 mengenali 28 nama sheet, mempertahankan sheet tambahan, membaca metadata master langsung dari ID environment, dan memberikan marker versi pada API.

## File yang berubah

`functions/myCloudinaryHandler.js` adalah backend utama untuk endpoint `/myCloudinaryHandler`. `public/script.js` memuat alur reload/sync dan `public/index.html` menggunakan cache-buster baru. Manifest workbook disesuaikan dengan 28 tab.

## Deploy yang benar

1. Backup repository dan database/konfigurasi produksi.
2. Ekstrak ZIP dan commit seluruh project ke branch yang terhubung ke project Cloudflare Pages yang aktif.
3. Pastikan deploy sukses dan variable `GOOGLE_SHEETS_PM_TEMPLATE_ID` pada **Production** menunjuk ke Google Sheets native master baru. Jangan memasukkan link workbook hasil kerja Pemda atau OPD.
4. Pastikan OAuth Google memiliki akses membaca dan menyalin master. Konfigurasi lain yang diperlukan tetap sama: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`.
5. Login Super Admin/Pemda atau Irban; tekan `Ctrl+F5`, buka KK PM SPIP Pemda, tekan **Muat Ulang**.
6. Periksa panel master: sumber harus `GOOGLE_SHEETS_PM_TEMPLATE_ID dari Cloudflare`, nama/count sheet harus berasal dari metadata Google Sheets, dan build harus `20261027-pm-master-source-guard-v4`.
7. Jika build tidak tampil, jangan sync—periksa branch/project/deployment Pages Function. Jika master valid, tekan **Sinkronkan Master** dan cek bahwa workbook baru memiliki semua sheet.
8. Uji satu workbook Pemda terlebih dahulu. Setelah berhasil, **Validasi ID & Perbarui Semua Workbook** akan memperbarui workbook OPD untuk tahun aktif; tinjau daftar sukses/gagal sebelum pekerjaan dilanjutkan.

## Uji lokal

Semua file JavaScript backend/frontend harus lolos `node --check`. Skrip `tools/validate-pm-master-source-binding-v4.mjs` menguji inventory 28 sheet, alias, penambahan tab masa depan, reload, version guard, serta ID prasyarat source. Jalankan seluruh `tools/validate-*.mjs` untuk regresi.

## Batas yang perlu diketahui

Source ini sudah diperbaiki dan dites secara lokal, tetapi tidak bisa mengubah deployment Cloudflare atau membaca secret/private Google Drive dari lingkungan pengeditan. Oleh karena itu perubahan di website live memerlukan commit/deploy dan uji sinkronisasi langsung dengan kredensial produksi Anda.
