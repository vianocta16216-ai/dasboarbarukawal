# Perbaikan `GOOGLE_SHEETS_PM_TEMPLATE_ID` dan Sinkronisasi Master — 27 Oktober 2026

> **Versi terbaru:** Gunakan source guard build `20261027-pm-master-source-guard-v4`. Panduan lama yang mengharuskan 26 tab telah diganti oleh daftar master dinamis 28 sheet.

## Akar masalah yang teridentifikasi

1. D1 `kk_pm_template_config` memiliki nilai bootstrap lama yang sebelumnya bisa mengalahkan variable Cloudflare.
2. Validasi produksi yang tampak pada rekaman pengguna masih menuntut 26 tab dan menolak nama resmi pada master 28 tab. Ini menunjukkan backend yang melayani dashboard masih menjalankan validasi lama, atau deployment Pages Function belum diperbarui bersama front-end.
3. Tombol reload sebelumnya tidak memberikan bukti yang cukup mengenai ID efektif dan versi backend yang sedang berjalan.

## Perubahan source terbaru

- `GOOGLE_SHEETS_PM_TEMPLATE_ID` menang atas D1 jika terisi.
- Endpoint `getKkPmTemplateConfig` membaca metadata sheet langsung dari ID efektif dan mengembalikan ID, sumber, jumlah/nama sheet, diagnosis validasi, waktu inspeksi, dan `codeVersion`.
- Daftar semua 28 tab master pengguna masuk ke inventory 2026; alias untuk nama tab khusus Inspektorat/RPJMD dikenali. Tab tambahan ke depan boleh ada dan dipertahankan.
- **Muat Ulang** memaksa pembacaan konfigurasi master dan metadata workbook terkini.
- **Sinkronkan Master** menolak eksekusi jika build backend baru belum terdeteksi, master tidak berasal dari Cloudflare environment, master gagal validasi, atau ID master yang diminta berbeda dari sumber efektif.
- Pembaruan massal mengirim ID master tervalidasi yang sama ke workbook Pemda dan OPD. Workbook baru harus lulus validasi sebelum pointer D1 diganti; workbook lama tetap tercatat sebagai riwayat pemulihan.
- Asset frontend mendapat cache-buster baru untuk menghindari script lama tersaji dari cache.

## Langkah deploy

1. Ganti/merge seluruh source repository dengan ZIP terbaru, bukan hanya satu file HTML.
2. Push ke branch produksi repository GitHub yang benar-benar terhubung ke Cloudflare Pages; pastikan deploy hijau dan fungsi `functions/myCloudinaryHandler.js` ikut terdeploy.
3. Pada Cloudflare Pages Production, pastikan `GOOGLE_SHEETS_PM_TEMPLATE_ID` menunjuk ke Google Sheets master 28 tab yang baru. ID master harus berupa ID Google Sheets native, bukan ID file Excel mentah.
4. Pastikan OAuth (`GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`) dapat membaca serta menyalin master ke folder `GOOGLE_DRIVE_FOLDER_ID`.
5. Muat ulang dengan `Ctrl+F5`, buka panel master dan tekan **Muat Ulang**. Panel harus menunjukkan `Sumber aktif: GOOGLE_SHEETS_PM_TEMPLATE_ID dari Cloudflare`, jumlah tab master aktual, dan **Build backend `20261027-pm-master-source-guard-v4`**.
6. Jika versi backend tidak tampil, deployment salah/belum terbaru. Jangan coba ulang sinkronisasi sampai Pages Function yang benar melayani API.
7. Setelah master dinyatakan valid, tekan **Sinkronkan Master**. Lalu lakukan pembaruan semua OPD hanya setelah workbook Pemda berhasil dicek.

## Batas verifikasi

Validasi lokal tidak dapat memastikan izin Google OAuth, isi secret Cloudflare, atau keberhasilan deployment produksi. Hasil akhir harus diperiksa pada panel live setelah commit/deploy. Bila ID tidak dapat dibaca, source terbaru akan menampilkan diagnosis khusus; ia tidak memilih spreadsheet berbeda secara diam-diam.
