# PATCH 2026-11-03 — 40 akun / evidence Pemda / tampilan modal

## Perubahan source

- **Evidence Pemda:** `public/pemda-evidence-recommendations-2026.json` diturunkan langsung dari **kolom L** file XLSX yang dilampirkan pengguna (sheet **KK3.2 BPKAD AKUN**, **KK3.3 BPKAD ASET**, **KK3.4 (INSPEKTORAT)**). Semua 700 kombinasi parameter-grade divalidasi berdasarkan nomor baris yang sama (210 + 215 + 275), bukan dicampur rekomendasi sumber lama. UI Pemda membaca file tersebut dan tetap memperoleh parameter dari master yang telah ada. Rekomendasi OPD tidak diubah.
- **Reset sandi:** masing-masing input memiliki tombol **SVG mata** untuk hide/unhide. Saat modal dibuka/ditutup, input dikembalikan ke mode `password`.
- **Loading Struktur & Proses:** ikon emoji diganti indikator SVG, persentase dan bar animasi. Angka 0/50/100% menggambarkan **2 tahap data yang selesai**, *bukan persentase byte unduhan*.
- **Tutup modal:** tombol `Tutup`, `Tutup detail`, ikon silang, dan klik area luar pada modal aktif kini menampilkan dialog `Ya, tutup` / `Tidak, tetap di sini`. Handler lama tidak diubah; aksi penutupan asli dijalankan setelah konfirmasi.
- **Upload saat keluar dari modal:** upload workbook menyimpan snapshot OPD/tahun sebelum memulai request supaya menutup modal tidak menghilangkan identitas upload. Indikator melayang menunjukkan jumlah file yang **belum terkonfirmasi di R2** selama tab terbuka. Kode membatasi refresh lama agar tidak merender data OPD lain.
- **Tutup browser:** jika ada file belum terkonfirmasi di R2, browser dipicu untuk menampilkan peringatan standar `beforeunload` (browser mengendalikan teks/kapan dialog tampil). File yang berhasil dipersistenkan dalam IndexedDB dapat dicoba kembali ketika aplikasi dibuka; **browser tidak menjamin kelanjutan upload setelah tab ditutup**.
- **Cloudflare / Drive:** file *sudah di R2* dikerjakan server via D1 outbox + Cloudflare Queue + Worker Cron tanpa bergantung pada modal/browser. Parallelisme Google Drive diperkecil dari 3 pesan per worker x 10 worker menjadi 2 x 3 = **maksimal sekitar 6 tugas aktif** melalui Queue agar lebih toleran kuota Google. Antrean bisa menyimpan >40 tugas; kecepatan total bergantung Google Drive dan beban produksi. Cache statis master ditandai versi khusus sehingga reload tidak harus mengunduh ulang master besar pada sesi yang sama.

## Deployment ke Cloudflare

1. Simpan **backup D1 dan source** yang sedang aktif. Extract ZIP patch ini ke repository GitHub aplikasi (jangan unggah ZIP sebagai satu berkas website). Commit perubahan dan deploy Cloudflare Pages sesuai alur repo yang sudah terhubung.
2. Cek Cloudflare Pages **Runtime / Production** memiliki binding `DB` D1, `EVIDENCE_BUCKET` R2, dan producer `DRIVE_BACKUP_QUEUE` sesuai `wrangler.toml`. Periksa tidak ada secret Google disimpan dalam repo.
3. Pastikan migration database yang sebelumnya dipakai untuk outbox D1 telah diterapkan: `database/migrations/20261102_durable_drive_backup_queue.sql` dan `20261103_durable_drive_queue_dispatch_and_pacing.sql`. **Jangan menjalankan ulang migration ADD COLUMN 20261103 bila kolom sudah ada.** Cek dahulu skema D1 dan statusnya; lakukan backup sebelum migration.
4. Deploy **Cloudflare Worker terpisah** dari subfolder `drive-backup-worker/`: `npx wrangler deploy`, setelah login di CLI. Bukan hanya Pages yang perlu di-deploy: perubahan Queue Consumer `max_concurrency=3` adalah perubahan Worker. Cek status Queue producer, consumer, dead-letter queue, Cron `* * * * *`, dan secret Google Drive di Worker. Secret Pages **tidak diwariskan** secara otomatis ke Worker.
5. Lakukan tes akun Pemda dan OPD terpisah. Verifikasi pada target T2/T3/T4 evidence mengikuti kolom L dan baris yang benar. Pastikan semua tombol tutup membuka konfirmasi. Verifikasi bahwa upload yang sudah mencapai R2 tetap diproses ke Google Drive setelah **modal** ditutup, dan bahwa output akhir ditandai `done` dengan ID Drive yang valid.
6. Lakukan uji beban **staging/produksi terkontrol** dengan 40 sesi dan 40 akun berbeda, file uji kecil, termasuk upload bersamaan. Cek R2, D1 `drive_backup_jobs`, Cloudflare Workers Errors/CPU, 429 Google, queue backlog, auth isolation, dan latensi P95. **Tes lokal tidak menjamin kapasitas produksi**.
7. Aktifkan monitoring budget/usage pada Cloudflare Workers Paid. Paket minimum $5 adalah biaya dasar, *bukan* batas biaya tetap untuk penyimpanan dan semua request. Pantau R2, D1, Queues dan Google Drive API.

## Verifikasi lokal

```bash
node --check public/script.js
node --check functions/myCloudinaryHandler.js
node --check drive-backup-worker/index.js
node tools/validate-nov03-pemda-performance-ui.mjs
node tools/test-drive-runtime-pemda-guidance.mjs
python tools/test_durable_drive_queue_concurrency.py
```

Kemudian jalankan semua `tools/validate*.mjs`. Pengujian dilakukan tanpa kredensial produksi dan tanpa koneksi ke D1/R2/Google Drive milik pengguna.

## Batas penting

- **Tidak ada cara yang dapat dijamin lintas browser** agar byte file yang belum sampai ke R2 tetap diunggah setelah tab/browser benar-benar tertutup. Jangan mengartikan penyimpanan IndexedDB sebagai upload yang telah diterima server.
- Google Drive tetap membutuhkan OAuth yang benar, akses folder, kuota mencukupi, dan Worker Queue/Cron yang benar-benar berjalan; `retrying` tidak sama dengan `done`.
- UI rekomendasi ditautkan ke Excel yang diberikan. Jika struktur atau nomor parameter master Google Sheets berubah di masa mendatang, lakukan regenerasi/validasi file referensi agar tidak menampilkan rekomendasi yang tertukar.
