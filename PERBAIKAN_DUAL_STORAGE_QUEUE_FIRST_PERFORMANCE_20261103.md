# KAWAL SPIP — Penyempurnaan penyimpanan wajib R2 + Google Drive
Tanggal: 3 November 2026

## Sasaran perilaku aplikasi

R2 dan Google Drive adalah dua tujuan penyimpanan wajib. Setiap upload evidence harus berakhir dengan objek yang sama di R2 dan Google Drive. Pengguna hanya melakukan satu kali upload. Tidak ada langkah operasional normal berupa klik **Ulangi Sinkronisasi**.

Status antarmuka dibedakan secara jujur:
- `pending` / `retrying`: R2 telah diverifikasi dan pekerjaan Google Drive tersimpan di outbox D1, tetapi Drive belum terverifikasi. File belum boleh ditampilkan sebagai berhasil penuh.
- `done`: file Google Drive ditemukan kembali melalui API, berada pada folder tujuan yang benar, dan ukuran byte-nya sama dengan objek R2.
- Error kredensial, izin, kuota, atau gangguan jaringan tidak boleh mengubah status menjadi `done`. Pekerjaan tetap tercatat agar dapat dicoba kembali otomatis.

## Arsitektur upload baru

1. Pages menerima file dan membuat identitas `uploadId` yang idempotent.
2. Pekerjaan dicatat pada D1 outbox sebelum pengiriman, sehingga kehilangan respons HTTP tidak menghilangkan jejak tugas.
3. File ditulis ke R2 menggunakan retry terbatas dan diverifikasi dengan `head()`.
4. Baris outbox ditandai `r2_ready=1`, lalu pesan dikirim ke Cloudflare Queue.
5. Worker mengambil antrean, membaca objek R2, memperoleh token Google Drive, lalu membuat file di folder yang ditentukan.
6. Worker membaca ulang metadata file Google Drive dan memverifikasi folder induk serta ukuran file sebelum menandai D1 dan metadata evidence sebagai `done`.
7. Jika Queue gagal/tidak tersedia, D1 outbox tetap menjadi sumber kebenaran. Cron Worker memulihkan dan mengirim ulang pekerjaan yang jatuh tempo. Retry memakai exponential backoff dengan jitter; tidak memerlukan tindakan pengguna.
8. Worker mengirim event realtime untuk memperbarui panel evidence terkait. Polling dashboard penuh hanya menjadi fallback ketika realtime terputus.

R2 adalah penerimaan teknis pertama agar byte file tidak hilang selama API Google Drive lambat. Ini **bukan** kebijakan backup opsional: upload belum berhasil penuh sampai Drive terverifikasi.

## Perbaikan akar masalah dari rekaman 3 November

- Menghindari dua jalur retry Drive yang saling bersaing: browser tidak lagi memanggil endpoint `retryDriveBackup` untuk mengulangi pengiriman Drive. Pengiriman Drive dikendalikan outbox/Queue/Worker.
- Menangani klaim registry yang berlomba dengan insert idempotent dan pemeriksaan pemilik upload ID.
- Memperbaiki query retry workbook dengan alias kolom `year` dan `opd_id` yang eksplisit.
- Menghindari status berhasil semu: ID Google Drive saja tidak cukup; objek harus tetap ada, tidak berada di Trash, berada di folder sasaran, dan ukuran byte harus sama.
- Menghubungkan Drive Worker dengan Durable Object realtime agar peristiwa penyelesaian upload dapat mencapai browser.
- Memastikan dashboard tidak menjalankan `loadData()` penuh setiap 20 detik ketika websocket realtime sedang aktif. Polling pemulihan berlangsung lebih jarang dan hanya saat realtime terputus serta tab sedang aktif.
- Queue consumer memproses pesan secara terbatas dan D1 outbox tetap menyimpan retry bila layanan eksternal atau D1 sementara gagal.

## Jenis evidence yang diarahkan melalui outbox otomatis

- Evidence umum Struktur dan Proses.
- Evidence workbook OPD.
- Evidence workbook Pemda.
- Evidence RTP.
- Laporan PM SPIP dan RR-RTP.
- Evidence tindak lanjut LHE.

Penggantian file existing menggunakan jalur pembaruan file Drive yang sama dan verifikasi ukuran setelah update; jalur penggantian tetap mempunyai rollback R2 jika pembaruan langsung gagal. Penggantian ini merupakan alur khusus, bukan alur upload baru.

## Pengaturan Cloudflare yang WAJIB ada

Screenshot akun memperlihatkan Pages `dashboardkawalspiptmahulu`, Worker `kawal-spip-drive-backup`, dan Worker `kawal-spip-realtime`. Screenshot daftar aplikasi saja belum membuktikan bahwa Queue, binding, secret, atau deployment versi terbaru sudah aktif.

### A. Buat Queue jika belum ada

Buat dua Queue pada akun Cloudflare yang sama:
- `kawal-spip-drive-backup`
- `kawal-spip-drive-backup-dlq`

Contoh dari terminal pada akun yang benar:

```bash
npx wrangler queues create kawal-spip-drive-backup
npx wrangler queues create kawal-spip-drive-backup-dlq
```

Jika salah satu Queue sudah ada, jangan membuat duplikat; periksa nama persisnya pada menu **Workers & Pages → Queues**.

### B. Secrets pada Worker pemroses Drive

Empat secret berikut harus tersedia pada Worker `kawal-spip-drive-backup` itu sendiri:

- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_FOLDER_ID`

Menambahkan secret hanya pada Pages tidak otomatis menambahkannya pada Worker terpisah. Isi melalui Cloudflare Dashboard atau `wrangler secret put` tanpa membagikan nilainya di chat atau menyimpannya dalam ZIP.

### C. Binding Worker

File `drive-backup-worker/wrangler.toml` harus terhubung ke resource yang sama dengan Pages:

- D1 binding `DB` → database `kawal-spip-db` dengan ID yang sama.
- R2 binding `EVIDENCE_BUCKET` → bucket `kawal-spip-files`.
- Queue consumer dan producer → `kawal-spip-drive-backup`.
- Dead-letter Queue → `kawal-spip-drive-backup-dlq`.
- Durable Object binding `REALTIME` → script `kawal-spip-realtime`.
- Cron pemulihan outbox → setiap menit.

### D. Deploy dan pemeriksaan kesehatan

Dari root proyek:

```bash
npx wrangler deploy --config drive-backup-worker/wrangler.toml
```

Kemudian deploy Pages melalui integrasi Git repository Cloudflare Pages (atau mekanisme deploy Pages yang memang digunakan proyek). Worker dan Pages harus memakai konfigurasi serta migrasi yang cocok.

Setelah deploy, buka endpoint pemeriksaan berikut:

`https://kawal-spip-drive-backup.vianocta16216.workers.dev/health`

Kondisi sehat diharapkan memberi HTTP 200 dan JSON dengan:
- `status: "ok"`
- `database: "ok"`
- `queueProducerBound: true`
- `realtimeBound: true`
- `r2Bound: true`
- `googleDriveConfigured: true`

Jika `status` masih `degraded`, lihat field yang `false`; jangan menguji upload massal sebelum semua binding dan Secret benar.

## Pemeriksaan lokal yang harus dijalankan sebelum rilis

```bash
node --check functions/myCloudinaryHandler.js
node --check drive-backup-worker/index.js
node --check public/script.js
python tools/test_drive_retry_db_regressions.py
python tools/test_durable_drive_queue_concurrency.py
for f in tools/validate-*.mjs; do node "$f" || exit 1; done
```

Pemeriksaan sintaks, source validator, dan simulasi SQLite dapat membuktikan konsistensi kode dan perilaku transaksi/lease pada lingkungan lokal. Pemeriksaan tersebut **tidak** dapat membuktikan bahwa OAuth Google Drive produksi, Queue akun, binding Cloudflare, atau koneksi jaringan sungguhan berhasil.

## Pengujian produksi wajib setelah deployment

1. Upload satu file kecil untuk setiap jenis evidence yang digunakan.
2. Pastikan file muncul di R2 dan di folder Google Drive yang tepat.
3. Pastikan status berubah sendiri dari `pending/retrying` menjadi `done`, tanpa klik ulang dan tanpa refresh manual.
4. Simulasikan gangguan sementara (mis. izin/kuota/API) pada lingkungan uji; pulihkan akses dan pastikan outbox menyelesaikan upload otomatis.
5. Uji upload serentak dari banyak OPD, cek tidak ada file silang OPD, duplikasi, atau status sukses palsu.
6. Periksa DLQ dan antrean D1 bila ada pekerjaan tertunda terlalu lama.

## Batasan dan jaminan yang jujur

Source proyek tidak dapat membuat Google Drive menerima file ketika refresh token dicabut, akses folder ditolak, kuota Google habis, atau API Google mengalami gangguan. Dalam kondisi tersebut, sistem mempertahankan file R2 dan record outbox, menahan status `done`, lalu mencoba kembali otomatis. Kepastian file benar-benar ada di Google Drive produksi baru bisa dibuktikan sesudah Worker yang benar-benar dideploy memiliki empat Secret, binding yang sehat, dan upload uji berhasil.
