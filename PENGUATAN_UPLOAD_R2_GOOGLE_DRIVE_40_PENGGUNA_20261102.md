# Penguatan upload evidence R2 + Google Drive untuk 40 pengguna

## Tujuan dan jaminan perilaku

- R2 tetap menjadi penyimpanan utama. Penulisan objek memakai retry hingga 5 percobaan dengan jeda bertahap dan `head()` untuk memastikan objek benar-benar tersedia. Request stream diubah menjadi payload replayable agar percobaan ulang mengirim byte yang sama.
- Setiap upload yang sudah masuk R2 didaftarkan ke antrean D1 `drive_backup_jobs` sebelum proses backup Google Drive dijalankan.
- Google Drive menggunakan `uploadId` stabil pada `appProperties.kawalUploadId`; retry memeriksa file yang sudah ada sebelum POST ulang agar tidak membuat duplikat ketika respons sebelumnya hilang.
- Jika R2 tetap gagal setelah 5 percobaan, permintaan tidak dilaporkan berhasil dan metadata upload tidak boleh dianggap selesai. Jika Drive gagal/429/timeout setelah file aman di R2, pekerjaan tidak dibuang. D1 menyimpan payload, jumlah percobaan, waktu percobaan berikutnya, lease, dan pesan error. Cron Worker mencoba ulang otomatis dengan exponential backoff hingga maksimum 6 jam, lalu terus mencoba lagi (tidak ada batas jumlah percobaan).
- Worker mengunci pekerjaan dengan lease D1 agar beberapa instance tidak memproses upload yang sama bersamaan. Setelah berhasil, status antrean dan metadata evidence diperbarui menjadi `done`.
- Status `retrying` berarti file aman di R2 tetapi salinan Drive belum terkonfirmasi. Status baru `done` setelah Drive mengembalikan ID dan proses verifikasi upload selesai.

## Berkas perubahan

1. `functions/myCloudinaryHandler.js`: retry R2 lima kali + verifikasi objek, antrean D1 persisten, pembungkus upload, retry worker, lease, exponential backoff, dan pembaruan status.
2. `database/migrations/20261102_durable_drive_backup_queue.sql`: tabel antrean dan indeks.
3. `drive-backup-worker/index.js` + `drive-backup-worker/wrangler.toml`: Cron Worker terpisah yang memeriksa antrean setiap menit.
4. `tools/validate-durable-drive-backup-queue.mjs`: source guard untuk antrean dan integrasi upload.

## Langkah deployment wajib

> Jangan menyatakan fitur retry otomatis aktif di produksi sebelum seluruh langkah berikut selesai.

1. Cadangkan D1 dan deploy folder Pages seperti biasa.
2. Terapkan migrasi ke database produksi yang sama dengan Pages:

   ```bash
   npx wrangler d1 execute kawal-spip-db --remote --file=database/migrations/20261102_durable_drive_backup_queue.sql
   ```

3. Masuk ke `drive-backup-worker/`, lalu pasang secret Google Drive pada Worker ini (secret Pages tidak otomatis diwariskan):

   ```bash
   npx wrangler secret put GOOGLE_DRIVE_CLIENT_ID
   npx wrangler secret put GOOGLE_DRIVE_CLIENT_SECRET
   npx wrangler secret put GOOGLE_DRIVE_REFRESH_TOKEN
   npx wrangler secret put GOOGLE_DRIVE_FOLDER_ID
   ```

   Isi nilainya sama dengan konfigurasi Google Drive yang telah tervalidasi di Pages.

4. Deploy Cron Worker:

   ```bash
   npx wrangler deploy
   ```

5. Deploy ulang Pages agar endpoint upload memakai antrean D1. Pastikan binding D1 dan R2 pada Worker mengarah ke database/bucket yang sama seperti `wrangler.toml` Pages.
6. Periksa Cloudflare Worker `kawal-spip-drive-backup` > Triggers: cron `* * * * *` aktif. Periksa Logs untuk `KAWAL SPIP Drive backup queue`.
7. Jalankan upload uji, pastikan metadata menunjukkan `retrying` jika Drive sengaja dibuat gagal sementara, lalu `done` setelah koneksi dipulihkan. Pastikan file terlihat di R2 dan folder Drive yang benar.

## Perhatian operasional

- Secret Pages dan secret Cron Worker adalah dua konfigurasi terpisah. Semua empat secret harus valid pada keduanya.
- Jangan hapus baris `drive_backup_jobs` yang masih `pending` atau `retrying`.
- Backoff mencegah retry agresif saat Google Drive membatasi kuota. Antrean akan terus dicoba, tetapi keberhasilan akhirnya tetap bergantung pada ketersediaan Google API, kuota, token OAuth, dan konfigurasi folder.
- File di atas 10 MB tetap ditolak sesuai batas aplikasi saat ini.
- Backup database penuh (file `SAKIP_DB.json`) bukan evidence upload dan tidak masuk antrean evidence ini.
- Pengujian lokal tidak dapat membuktikan ketersediaan Google OAuth, kuota, D1/R2 produksi, atau Cloudflare deployment. Lakukan uji 40 sesi di staging/produksi setelah deployment dan sebelum sosialisasi.

## Pemeriksaan lokal

```bash
node --check functions/myCloudinaryHandler.js
node --check drive-backup-worker/index.js
node tools/validate-durable-drive-backup-queue.mjs
```

Kemudian jalankan seluruh `tools/validate*.mjs`. Hasil validasi source tidak sama dengan hasil load test produksi.
