# Panduan Perbaikan Gagal Perbarui Workbook KK PM SPIP — 27 Oktober 2026

## Akar masalah yang diperbaiki

Tabel D1 `kk_pm_template_config` memiliki baris bootstrap berisi ID template lama. Kode sebelumnya membaca D1 lebih dahulu, sehingga nilai tersebut bisa menimpa ID yang sudah diperbarui pada `GOOGLE_SHEETS_PM_TEMPLATE_ID` di Cloudflare. Selain itu, dashboard bisa menunjukkan error `404 NOT_FOUND` saat membaca workbook Pemda lama yang sudah tidak tersedia.

## Perilaku setelah patch

1. Jika `GOOGLE_SHEETS_PM_TEMPLATE_ID` terisi, nilai Cloudflare menjadi sumber ID master utama; pointer ID lama di D1 tidak menimpanya.
2. Jika ID Cloudflare tidak bisa diakses atau tidak lolos validasi master PM_2026, aplikasi menampilkan error spesifik dan tidak diam-diam memilih file lain.
3. Tombol **Sinkronkan Master** memvalidasi master aktif, membuat salinan workbook Pemda yang baru, lalu menyimpan tautan hanya setelah file baru lolos validasi. Workbook lama tidak dihapus permanen.
4. **Perbarui Workbook Pemda + Semua OPD** menjalankan pembaruan massal untuk tahun aktif; hasil per OPD, mirror R2, dan pengarsipan Drive dilaporkan terpisah.
5. Validasi master tetap mengharuskan 26 tab PM_2026 kanonis dan formula inti sesuai spesifikasi pada `DEPLOYMENT_KK_PM_SPIP_EXACT.md`.

## Cara memasang dan menjalankan

1. Backup repository GitHub yang digunakan Cloudflare Pages.
2. Unggah/commit source terbaru dari ZIP perbaikan, lalu deploy ulang.
3. Buka **Cloudflare Dashboard → Workers & Pages → project Pages Kawal SPIP → Settings → Variables and Secrets → Production**. Pastikan `GOOGLE_SHEETS_PM_TEMPLATE_ID` berisi ID atau URL **master spreadsheet baru** yang benar. Jangan memakai ID workbook OPD/Pemda atau file `.xlsx` yang belum diimpor menjadi Google Sheets.
4. Pastikan `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, dan `GOOGLE_DRIVE_FOLDER_ID` aktif pada lingkungan Production. Akun OAuth harus dapat membaca master dan menyalinnya.
5. Setelah deploy, login sebagai Pemda/Super Admin (`admin`) atau Irban, buka KK PM SPIP Pemda, lalu tekan **Muat Ulang**. Periksa teks **Sumber aktif** dan link master; keduanya harus menunjuk ID dari `GOOGLE_SHEETS_PM_TEMPLATE_ID`.
6. Tekan **Sinkronkan Master** untuk memperbaiki workbook Pemda yang lama/404. Jika berhasil, workbook baru 26 tab akan tertaut sementara workbook lama tetap dipertahankan sebagai arsip/riwayat.
7. Jalankan **Perbarui Workbook Pemda + Semua OPD** hanya jika seluruh workbook OPD tahun aktif juga perlu dibuat ulang dari master baru.

## Batas verifikasi

Uji statis dan regresi source dapat dijalankan tanpa kredensial produksi. Penulisan langsung ke Google Drive, D1, dan R2 produksi tidak dapat dilakukan dari lingkungan pengeditan ini. Perubahan live terjadi setelah source dideploy dan sinkronisasi dijalankan pada aplikasi Anda.

Lihat juga `PATCH_FIX_GOOGLE_SHEETS_PM_TEMPLATE_ID_20261027.md` untuk rincian teknis prioritas ID dan diagnosa `404 NOT_FOUND`.
