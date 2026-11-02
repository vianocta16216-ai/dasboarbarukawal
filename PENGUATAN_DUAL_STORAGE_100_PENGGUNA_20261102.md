# KAWAL SPIP — Penguatan dual storage dan akses serentak (target 100 sesi)

Tanggal paket: 2 November 2026

## Sasaran

Menjaga pengisian Kertas Kerja dan upload evidence saat sedikitnya 40 pengguna aktif, dengan rancangan target pengujian 100 sesi bersamaan. Pengguna boleh berasal dari OPD yang berbeda atau beberapa pengguna bekerja pada OPD yang sama. Penguncian dan pembaruan metadata harus memakai `uploadId`/identitas OPD/parameter, bukan menulis ulang satu workbook penuh untuk setiap file.

## Prinsip penyimpanan wajib

1. **R2 adalah salinan utama.** `PUT` diulang sampai lima kali untuk gangguan sementara, lalu diverifikasi memakai `head()` sebelum dianggap tersimpan.
2. **D1 adalah durable outbox.** Catatan pekerjaan backup dibuat sebelum `R2.put()`. Ini menutup celah proses berhenti setelah R2 berhasil tetapi sebelum antrean tercatat.
3. **Cloudflare Queues adalah jalur cepat, bukan satu-satunya sumber kebenaran.** Worker Cron memeriksa D1 secara periodik. Jika Queue tidak tersedia/kuota penuh, Worker mencoba memproses pekerjaan dari D1 secara langsung dengan laju konservatif.
4. **Google Drive wajib.** Worker hanya menandai `done` setelah file ditemukan kembali menggunakan `kawalUploadId`, tidak terhapus, dan berada pada folder tujuan yang benar.
5. **Retry Drive tidak dibatasi jumlah percobaannya.** D1 menyimpan status, jumlah percobaan, `next_attempt_at`, error terakhir, dan lease. Jeda meningkat secara eksponensial sampai maksimum 6 jam dengan jitter. Setelah mencapai jeda maksimum, sistem tetap mencoba lagi.
6. **Idempotensi.** `uploadId` yang sama dipakai untuk pencarian file di Drive dan mencegah duplikasi setelah respons upload hilang.
7. **Perubahan metadata menggunakan compare-and-swap** agar upload pengguna lain pada OPD yang sama tidak tertimpa ketika dua permintaan berlangsung bersamaan.
8. **Pemulihan browser.** File yang dipilih lebih dahulu disimpan pada IndexedDB. Saat browser online kembali, pengiriman yang belum selesai dicoba ulang. Setelah R2 ada, browser meminta retry Drive saja dan tidak mengirim ulang binari.

## Berkas yang disentuh untuk fitur dual storage

- `functions/myCloudinaryHandler.js`
- `public/script.js`
- `drive-backup-worker/index.js`
- `drive-backup-worker/wrangler.toml`
- `wrangler.toml`
- `database/migrations/20261102_durable_drive_backup_queue.sql`
- `database/migrations/20261103_durable_drive_queue_dispatch_and_pacing.sql`
- `tools/validate-durable-drive-backup-queue.mjs`
- `tools/test_durable_drive_queue_concurrency.py`

Master Evidence Struktur dan Proses serta fitur Kertas Kerja lain yang sudah berada dalam paket sebelumnya tetap dibawa di ZIP lengkap.

## Kapasitas dan pengaturan

- Worker Queue consumer: maksimal 10 invocation bersamaan; setiap invocation mengerjakan maksimal 3 pesan pada satu waktu (sekitar 30 pekerjaan aktif pada handler, tunduk pada autoscaling Cloudflare dan pacing Google Drive).
- Batch consumer: 10 pesan.
- Dispatcher Cron mengirim maksimal 100 pesan per siklus, memakai `sendBatch` dalam batas 100 pesan per panggilan.
- Global pacing Google Drive menggunakan slot D1 250 ms (target awal maksimum sekitar 4 awal pekerjaan upload per detik; panggilan folder dan verifikasi tetap menambah request API).
- D1 outbox fallback memproses maksimal 10 pekerjaan per siklus jika pengiriman Queue gagal/kuota tidak tersedia.
- Batas ukuran evidence aplikasi tetap 10 MB per file.
- File yang gagal di R2 tidak akan dikirim ke Drive. File dengan R2 belum siap tetap berada pada outbox dan diperiksa ulang secara terpisah sehingga tidak menghalangi pekerjaan yang R2-nya sudah siap.

## Status upload

- `pending` / `uploading`: proses awal berjalan.
- `retrying`: R2 tersimpan, tetapi Google Drive belum terkonfirmasi atau pekerjaan sedang menunggu percobaan berikutnya.
- `done`: file telah diverifikasi di R2 dan Google Drive.

Jangan menganggap status `retrying` sebagai backup lengkap. Administrator perlu memantau jumlah antrean melalui endpoint `/health` Worker backup. Respons health menyediakan jumlah pending/retrying/due dan waktu pekerjaan tertua. Health memeriksa keberadaan konfigurasi secret, bukan menguji token Google secara langsung.

## Deployment produksi — WAJIB berurutan

> Paket kode lokal dan validasi lokal tidak otomatis mengubah Cloudflare. Jalankan langkah ini pada akun Cloudflare yang memiliki Pages, D1, R2, dan Queue proyek KAWAL SPIP.

### 1. Backup dan cek resource

- Ambil backup/snapshot D1 sebelum migrasi.
- Pastikan database yang dipakai Pages dan backup Worker sama: `kawal-spip-db` (`46bfc2a4-e13a-40b7-b21d-89642702a3a8`).
- Pastikan bucket R2 sama: `kawal-spip-files`.
- Periksa bahwa nama Pages project sesuai konfigurasi deployment yang sudah dipakai organisasi.

### 2. Terapkan migrasi D1

Jalankan dari root proyek:

```bash
npx wrangler d1 execute kawal-spip-db --remote --file=database/migrations/20261102_durable_drive_backup_queue.sql
```

Kemudian periksa kolom tabel:

```bash
npx wrangler d1 execute kawal-spip-db --remote --command "PRAGMA table_info(drive_backup_jobs);"
```

Jika kolom `r2_ready` belum ada, jalankan:

```bash
npx wrangler d1 execute kawal-spip-db --remote --file=database/migrations/20261103_durable_drive_queue_dispatch_and_pacing.sql
```

Jika `r2_ready` sudah ada, jangan jalankan `ALTER TABLE` kedua kali; runtime schema aplikasi juga dapat menambahkan kolom ini secara aman. Pastikan indeks `idx_drive_backup_jobs_dispatch` ada.

### 3. Buat Cloudflare Queues (cukup sekali)

```bash
npx wrangler queues create kawal-spip-drive-backup
npx wrangler queues create kawal-spip-drive-backup-dlq
```

Jika queue dengan nama tersebut sudah ada, jangan membuat queue duplikat. Cocokkan nama dengan `wrangler.toml` dan `drive-backup-worker/wrangler.toml`.

### 4. Pasang secret pada Backup Worker

Secret Worker terpisah dari secret Pages. Jalankan:

```bash
cd drive-backup-worker
npx wrangler secret put GOOGLE_DRIVE_CLIENT_ID
npx wrangler secret put GOOGLE_DRIVE_CLIENT_SECRET
npx wrangler secret put GOOGLE_DRIVE_REFRESH_TOKEN
npx wrangler secret put GOOGLE_DRIVE_FOLDER_ID
npx wrangler deploy
```

Masukkan nilai kredensial dan folder ID yang sama dengan konfigurasi Drive yang sudah benar pada Pages. Jangan menuliskan secret ke file ZIP, Git, atau chat.

### 5. Deploy Pages

Kembali ke root proyek dan deploy memakai nama Pages project yang benar pada akun organisasi. Cara yang lebih aman adalah melakukan deployment melalui pipeline GitHub/Cloudflare Pages yang saat ini dipakai, agar environment variables, build setting, dan custom domain tidak tertimpa. Pastikan `wrangler.toml` root memuat producer `DRIVE_BACKUP_QUEUE` dan D1/R2 binding tetap menunjuk resource produksi yang benar.

### 6. Pemeriksaan health Worker

Buka endpoint `https://<alamat-worker-backup>/health`. Status yang diharapkan:

- `status: ok`
- `database: ok`
- `r2Bound: true`
- `queueProducerBound: true`
- `googleDriveConfigured: true`
- `backupQueue.pending`, `retrying`, dan `due` tersedia sebagai angka.

`status: ok` belum membuktikan Google API benar-benar menerima file. Lakukan tes upload berikut.

### 7. Tes end-to-end di staging dahulu

1. Upload satu PDF kecil. Pastikan objek ada di R2 dan file terletak di folder Google Drive OPD/tahun/parameter yang benar. Status baru boleh `done` jika keduanya terkonfirmasi.
2. Di staging, simulasikan Drive tidak tersedia/429. Pastikan status `retrying`, antrean D1 tetap ada, dan file R2 tetap dapat dibuka.
3. Pulihkan Drive. Pastikan Cron/Queue mengirim ulang dan status berubah ke `done` tanpa file ganda.
4. Restart / redeploy Worker ketika ada pekerjaan antrean. Pastikan D1 outbox memulihkan pengiriman.
5. Uji upload ulang dengan `uploadId` sama. Pastikan tidak membuat duplikat Drive.
6. Periksa file, ukuran, nama, folder, dan OPD tujuan untuk setiap unggahan.

### 8. Uji beban

Jalankan pada staging/lingkungan yang aman, bukan langsung mengirim ribuan file uji ke folder arsip resmi:

- Tahap A: 40 sesi aktif.
- Tahap B: 60 sesi aktif.
- Tahap C: 100 sesi aktif.
- Campur akun OPD berbeda dan 2–3 pengguna pada satu OPD yang sama.
- Buat setiap sesi login, baca dashboard, isi parameter berbeda, simpan, dan upload file uji.
- Buat sebagian sesi sengaja mengubah parameter yang sama untuk menguji konflik.
- Pantau D1 overload, error 429/5xx, Worker exceptions, Queue backlog/DLQ, D1 pending/retrying, dan selisih file R2 vs Drive.

Kriteria lulus: tidak ada data lintas-OPD, tidak ada file hilang/terduplikasi, seluruh R2-ready evidence akhirnya menjadi `done` setelah Drive normal, tidak ada metadata tertimpa, dan error sementara pulih otomatis.

## Batas Cloudflare dan rekomendasi paket

Batas platform yang diperiksa pada 2 November 2026:

- Cloudflare Queues: maksimum batch consumer 100 pesan, `sendBatch` 100 pesan/256 KB, throughput 5.000 pesan/detik per queue, hingga 250 consumer invocation push, maksimal 100 retry Queue sebelum DLQ, durasi wall-clock consumer 15 menit. Free retention 24 jam; Paid dapat dikonfigurasi hingga 14 hari.
- Cloudflare Workers Free: 100.000 request/hari dan 10 ms CPU per request. Workers Paid: tidak ada batas request harian dan CPU dapat dikonfigurasi sampai 5 menit.
- Cloudflare D1 Free: database maksimum 500 MB, 5 juta row reads/hari, 100.000 row writes/hari, dan 50 query/subrequest per invocation. Paid memberi kuota jauh lebih tinggi. Setiap satu database D1 bersifat single-threaded; performa ditentukan durasi query, sehingga query singkat, indeks dan batch penting.
- Cloudflare R2: batas objek platform jauh di atas batas aplikasi ini; aplikasi sendiri membatasi evidence pada 10 MB per file. R2 single-part upload dapat mencapai 5 GiB, tetapi itu bukan alasan menaikkan batas aplikasi tanpa desain multipart.
- Cloudflare Queues Free mencakup 10.000 operasi/hari dan retention 24 jam. Satu pesan yang berhasil biasanya dihitung sebagai write, read, delete (sekitar 3 operasi); retry menambah operasi.
- Google Drive dapat mengembalikan 403/429 ketika rate limit/kuota backend tercapai. Sistem menggunakan pacing dan exponential backoff; kredensial/token yang dicabut atau akses folder yang dicabut tetap membutuhkan perbaikan administrator.

**Rekomendasi:** untuk sosialisasi penting dan pemakaian rutin 40–100+ sesi, gunakan Workers Paid dan pantau pemakaian Queue, D1, serta R2. Free masih dapat dipakai untuk uji coba ringan, tetapi daily quota, CPU 10 ms, D1 quota, dan retention Queue 24 jam dapat menjadi batas nyata jika pemakaian meningkat. Paid pun bukan kapasitas tak terbatas: beban nyata harus diukur dan disesuaikan.

## Batas jaminan dan hal yang belum dapat diuji dari mesin lokal

- Retry di D1 tidak memiliki batas jumlah percobaan; namun file tidak mungkin dijamin masuk Drive ketika Google memblokir akses, token tidak valid, folder tidak dapat diakses, akun/kuota dinonaktifkan, atau layanan mengalami outage. Sistem akan menahan status dan terus mencoba, bukan menandai berhasil.
- IndexedDB bergantung pada ketersediaan storage browser. Jika browser menolak menyimpan file lokal, upload dibatalkan sebelum dikirim agar pengguna tidak kehilangan satu-satunya salinan lokal.
- Pengujian lokal tidak menggunakan akun Cloudflare produksi, D1/R2 live, Queue live, OAuth Google aktual, atau 40–100 browser sungguhan. Karena itu belum boleh dinyatakan lulus load test produksi.
- Sebelum sosialisasi resmi, selesaikan deployment, health-check, uji end-to-end Drive, dan load test bertahap di atas.

## Pemeriksaan lokal yang dijalankan

```bash
node --check functions/myCloudinaryHandler.js
node --check drive-backup-worker/index.js
node --check public/script.js
for f in tools/validate*.mjs; do node "$f"; done
python tools/test_durable_drive_queue_concurrency.py
```

Simulasi Python menjalankan migrasi SQLite, 100 claim upload unik secara serentak, 25 proses yang memperebutkan satu `uploadId` (tepat satu lease winner), serta memeriksa agar retry gagal tetap ada di outbox. Ini adalah uji logika antrean lokal, bukan pengganti load test Cloudflare produksi.
