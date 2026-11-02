# Perbaikan kegagalan deploy Cloudflare Pages — 2 November 2026

## Penyebab yang terkonfirmasi dari rekaman layar

Build dan upload asset Pages berhasil. Kegagalan terjadi pada langkah publikasi Pages Function. Log Cloudflare pada rekaman menampilkan:

`Error: Failed to publish your Function. Got error: Queue 'kawal-spip-drive-backup' not found.`

Jadi, penyebab langsungnya **bukan** folder `drive-backup-worker`, bukan `npm install`, dan bukan kegagalan build JavaScript. File `wrangler.toml` Pages mendefinisikan producer binding `DRIVE_BACKUP_QUEUE` ke Queue bernama `kawal-spip-drive-backup`, tetapi Queue itu belum dibuat pada akun Cloudflare yang menjalankan deployment. Pages membutuhkan Queue resource yang sudah ada sebelum binding dapat dipublikasikan.

Dokumentasi Cloudflare menyatakan Queue harus dibuat terlebih dahulu, lalu producer/consumer Worker dikonfigurasi ke Queue tersebut:
- https://developers.cloudflare.com/queues/get-started/
- https://developers.cloudflare.com/pages/functions/bindings/

## Peringatan tambahan yang diperbaiki dalam source

Build log juga mencatat dua warning `Duplicate key 'status'`:

- `functions/myCloudinaryHandler.js` sekitar baris 3355: properti `status:'success'` ditimpa oleh shorthand `status` yang berisi status verifikasi evidence.
- `functions/myCloudinaryHandler.js` sekitar baris 4538: properti `status:'success'` ditimpa oleh `status:'Menunggu Verifikasi'`.

Dua warning itu bukan error yang menghentikan deploy pada log ini, tetapi memang bug pada bentuk respons JSON. Diperbaiki agar:
- `status` tetap `success` untuk status operasi API;
- status bisnis evidence dipisah menjadi `verificationStatus`;
- status pemetaan RPJMD dipisah menjadi `mappingStatus`.

## Langkah wajib pada akun Cloudflare (jalankan sebelum Retry deployment)

### Cara melalui terminal (disarankan)

Buka terminal pada root repository dan pastikan Wrangler login ke akun Cloudflare yang sama dengan Pages project:

```bash
npx wrangler whoami
npx wrangler queues list
```

Buat antrean utama (jika belum ada):

```bash
npx wrangler queues create kawal-spip-drive-backup
```

Buat Dead Letter Queue (jika belum ada):

```bash
npx wrangler queues create kawal-spip-drive-backup-dlq
```

Jika perintah menyatakan Queue sudah ada, jangan membuat nama Queue lain. Verifikasi dengan:

```bash
npx wrangler queues list
```

Nama harus persis:
- `kawal-spip-drive-backup`
- `kawal-spip-drive-backup-dlq`

Alternatif dashboard: Cloudflare Dashboard → Workers & Pages → Queues → Create Queue. Buat kedua nama tersebut pada akun yang sama dengan Pages dan Worker. Pastikan akun sama dengan project Pages; jangan membuat antrean pada akun Cloudflare lain.

**Jangan klik Retry deployment sebelum Queue utama muncul di daftar Queues.** Pages mengunggah asset lebih dulu, tetapi akan gagal lagi pada publikasi Function jika antrean masih belum tersedia.

### Setelah kedua Queue ada

1. Pastikan binding Pages di root `wrangler.toml` tetap:
   - variable/binding: `DRIVE_BACKUP_QUEUE`
   - Queue: `kawal-spip-drive-backup`
2. Jalankan validasi source:
   ```bash
   node tools/validate-cloudflare-deployment-prereqs.mjs
   ```
3. Klik **Retry deployment** pada deployment Pages yang gagal, atau push commit perbaikan source ini agar Git integration memulai deployment baru.
4. Setelah Pages berhasil, deploy consumer Worker:
   ```bash
   cd drive-backup-worker
   npx wrangler deploy
   ```
5. Pastikan Worker `kawal-spip-drive-backup` memiliki empat secrets yang benar (secret Worker terpisah dari Pages):
   ```bash
   npx wrangler secret put GOOGLE_DRIVE_CLIENT_ID
   npx wrangler secret put GOOGLE_DRIVE_CLIENT_SECRET
   npx wrangler secret put GOOGLE_DRIVE_REFRESH_TOKEN
   npx wrangler secret put GOOGLE_DRIVE_FOLDER_ID
   ```
   Isi dengan nilai yang sama dengan kredensial Google Drive yang telah diverifikasi untuk aplikasi. Jangan menaruh nilai secret di GitHub atau file ZIP.
6. Terapkan migrasi D1 pada database `kawal-spip-db` sesuai kondisi database. Periksa dahulu:
   ```bash
   npx wrangler d1 execute kawal-spip-db --remote --command "PRAGMA table_info(drive_backup_jobs);"
   ```
   - Jika tabel `drive_backup_jobs` belum ada: jalankan migrasi 20261102, lalu 20261103.
   - Jika tabel sudah ada tetapi kolom `r2_ready` belum ada: jalankan migrasi 20261103 saja.
   - Jika kolom `r2_ready` sudah ada: jangan jalankan migrasi ALTER lagi.
   ```bash
   npx wrangler d1 execute kawal-spip-db --remote --file=database/migrations/20261102_durable_drive_backup_queue.sql
   npx wrangler d1 execute kawal-spip-db --remote --file=database/migrations/20261103_durable_drive_queue_dispatch_and_pacing.sql
   ```
7. Periksa Worker → Triggers: cron `* * * * *` aktif, Queue consumer terpasang, DLQ tersedia.
8. Uji endpoint `/health` Worker. Hasil `status: ok` harus menunjukkan D1, R2, dan Google Drive terkonfigurasi. Endpoint health hanya menilai konfigurasi dan koneksi dasar, bukan membuktikan upload Drive end-to-end.

## Validasi lokal

```bash
node --check functions/myCloudinaryHandler.js
node --check drive-backup-worker/index.js
node tools/validate-cloudflare-deployment-prereqs.mjs
```

## Uji akhir produksi sebelum sosialisasi

- Upload file uji unik melalui aplikasi, pastikan file ada di R2 dan folder Google Drive yang benar.
- Buat gangguan sementara Google Drive / gunakan token uji yang tidak valid hanya di staging; pastikan status tetap tertunda dan job tetap di D1.
- Pulihkan kredensial/koneksi; pastikan retry akhirnya memindahkan status menjadi `done` dan file tunggal ada di Drive.
- Ulangi untuk 40, 60, lalu 100 sesi uji (bukan akun produksi peserta).
- Uji dua pengguna pada OPD yang sama, mengubah parameter berbeda dan parameter sama.
- Jangan menganggap status `done` hanya dari antrean. Status final hanya boleh diberikan setelah file R2 dan Google Drive terverifikasi.

## Batas kemampuan yang perlu dipahami

Source code dan pengaturan repository tidak dapat membuat Queue, D1 migration, Worker secret, atau deployment di akun pengguna tanpa autentikasi Cloudflare. Tindakan provisioning di atas harus dilakukan di akun Cloudflare yang benar. Kode lokal yang lolos pemeriksaan bukan bukti bahwa akun Cloudflare/Google Drive produksi sudah sehat.
