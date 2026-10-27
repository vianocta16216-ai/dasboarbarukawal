# Panduan Perbaikan Master KK PM SPIP dan Evidence Pemda

Tanggal: 27 Oktober 2026

## Perubahan utama

1. ID master PM default mengikuti ID yang diberikan: `1hLqUceQprwRxh1q5y0ZmW6PdI2-28H9mkYdA227vg1s`.
2. Pemda dan seluruh workbook OPD menggunakan satu resolver master yang sama. Jika ID yang dikonfigurasi valid, aplikasi mempertahankannya sebagai sumber utama dan tidak menggantinya diam-diam hanya karena menemukan spreadsheet lain yang lebih baru.
3. Tombol pengaturan master menyimpan ID/URL baru ke D1 setelah validasi Google Sheets. Validasi memeriksa tipe file Google Sheets, profil 26 tab `PM_2026`, urutan/nama tab, serta formula inti berikut:
   - `KKLEAD_SPIP!I11` = `=H16+H50+H64`
   - `KKLEAD_SPIP!I68` = `=F83`
   - `KKLEAD_SPIP!I85` = `=F104`
   - `KKLEAD_SPIP!I106` = `='KKLEAD II'!L35`
4. Pembuatan ulang workbook dilakukan sebagai salinan dari master yang tervalidasi. Workbook lama tidak ditimpa atau dihapus; riwayat tautannya dipertahankan.
5. Dashboard KK PM SPIP Pemda memiliki penyimpanan evidence terpisah dari evidence OPD. Upload dibatasi server ke T2/KK3.2, T3/KK3.3, dan T4/KK3.4.
6. Form evidence Pemda mendukung nama pemeriksa, catatan pemeriksa, status `Diterima`, `Diterima dengan Catatan`, dan `Dikembalikan`, serta percobaan ulang sinkronisasi Google Drive ketika diperlukan.

## Cara menerapkan di Cloudflare Pages

1. Ekstrak ZIP ini dan unggah/push semua isinya ke repository GitHub yang terhubung dengan Cloudflare Pages. Jangan mengunggah file rahasia atau file `.dev.vars`.
2. Pastikan konfigurasi Pages tetap menggunakan direktori keluaran `public` dan Cloudflare Functions tetap aktif.
3. Periksa bindings yang sudah dipakai aplikasi:
   - D1 `DB` mengarah ke database `kawal-spip-db`.
   - R2 `EVIDENCE_BUCKET` mengarah ke bucket `kawal-spip-files`.
   - Kredensial Google OAuth tetap tersedia sebagai secrets/environment variables: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, dan `GOOGLE_DRIVE_FOLDER_ID`.
   - `GOOGLE_SHEETS_PM_TEMPLATE_ID` merupakan fallback konfigurasi lama. Setelah tabel konfigurasi D1 terisi, ID aktif dikelola dari panel dashboard, bukan dengan mengedit secret setiap kali master berubah.
4. Tabel baru akan dibuat oleh bootstrap schema aplikasi. File migration manual juga tersedia di `database/migrations/20261027_kk_pm_template_config_and_pemda_evidence.sql` apabila prosedur deployment Anda menerapkan migrasi D1 secara manual.
5. Tunggu deployment selesai, lalu login sebagai Super Admin (`admin`) atau Irban.

## Validasi dan pembaruan workbook

1. Buka dashboard **KK PM SPIP Pemda**.
2. Di panel **Pengaturan Master KK PM SPIP**, periksa ID yang tampil. ID awalnya adalah `1hLqUceQprwRxh1q5y0ZmW6PdI2-28H9mkYdA227vg1s`.
3. Tekan **Validasi ID & Perbarui Workbook**. Aplikasi akan meminta Google Drive/Sheets memvalidasi ID, 26 tab, dan formula. Jika validasi gagal, ID tidak disimpan dan workbook lama tidak dilepas.
4. Akun Super Admin dapat menggunakan **Perbarui Workbook Pemda + Semua OPD** atau tombol validasi/pembaruan yang berlabel memperbarui semua workbook. Pemrosesan OPD dilakukan bertahap dan hasil gagal/berhasil dilaporkan.
5. Akun Irban hanya memperbarui konfigurasi master dan workbook khusus Pemda. Sinkronisasi workbook OPD tetap mengikuti cakupan kewenangan akunnya.
6. Bila ada OPD yang gagal, baca nama OPD dan pesan error yang tampil. Periksa izin Google OAuth, akses folder tujuan, dan validitas master; kemudian jalankan sinkronisasi ulang untuk OPD tersebut. Jangan menghapus workbook lama secara manual sebelum tautan baru terverifikasi.

## Upload evidence Struktur dan Proses pada dashboard Pemda

1. Di dashboard **KK PM SPIP Pemda**, buka panel **Evidence Struktur dan Proses Pemda**.
2. Pilih target:
   - **T2 → KK3.2**
   - **T3 → KK3.3**
   - **T4 → KK3.4**
3. Pilih subunsur dan parameter dari data master, pilih grade A–E, lalu pilih file. Batas ukuran per file adalah 10 MB.
4. Upload disimpan di R2 dan disinkronkan ke Google Drive ke folder Pemda dengan subfolder target, unsur, subunsur, parameter, dan level. Jika sinkronisasi Drive tertunda, file tetap tersedia di R2 dan tombol **Ulangi Sinkronisasi Drive** dapat digunakan.
5. Pemeriksa yang berwenang dapat menyimpan nama pemeriksa, catatan, dan status verifikasi. `Diterima dengan Catatan` dan `Dikembalikan` memerlukan catatan.
6. Upload Pemda memakai tabel evidence terpisah dan tidak menulis data ke baris/penyimpanan evidence OPD. Backend menolak target selain T2, T3, dan T4, walaupun permintaan dikirim langsung ke API.

## Batasan validasi

Source code dan tes regresi lokal telah diperiksa. Validasi live terhadap ID Google Sheets, izin OAuth, serta folder Google Drive hanya dapat dipastikan setelah kode berjalan di deployment Cloudflare dengan kredensial Google Anda. Bila master di ID tersebut tidak dapat dibaca atau tidak lolos profil 26 tab/formula, aplikasi akan menolak pembaruan dan menyampaikan pesan error daripada mengubah tautan workbook secara diam-diam.
