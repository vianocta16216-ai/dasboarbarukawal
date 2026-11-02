# Perbaikan upload dan retry Google Drive — KAWAL SPIP
Tanggal: 3 November 2026

## Temuan dari rekaman pengguna

Dua error D1 tampak langsung pada rekaman:

1. `UNIQUE constraint failed: evidence_upload_registry.upload_id`
   - Jalur registrasi upload menggunakan pola baca-lalu-tulis (`SELECT`, lalu `INSERT`) yang dapat berlomba ketika upload dikirim ulang atau dua permintaan untuk upload ID yang sama tiba berdekatan.
   - Satu file dapat tersimpan di R2, tetapi permintaan kedua gagal pada registri sebelum jalur sinkronisasi Drive selesai.

2. `ambiguous column name: year`
   - Handler `retryDriveBackup` untuk `workbook_evidence` menggabungkan `opd_workbook_evidence_items` dan `opd_data`, tetapi menulis `WHERE upload_id=? AND year=? AND opd_id=?` tanpa alias tabel.
   - Kedua tabel mempunyai kolom `year`, sehingga retry gagal saat membaca metadata evidence yang harus disalin ke Drive.

## Perbaikan yang diterapkan

### A. Registrasi upload yang tahan pengiriman bersamaan
- Registrasi `evidence_upload_registry`, `opd_workbook_evidence_items`, dan `pemda_workbook_evidence_items` menggunakan `INSERT OR IGNORE` untuk menangani klaim upload ID yang serentak.
- Setelah insert, handler membaca ulang record dan membandingkan tahun, OPD, parameter, grade/level, target, serta tipe sumber.
- Jika upload ID sudah dimiliki file atau OPD lain, sistem menolak konflik. Sistem tidak mengalihkan file ke record yang salah.
- Ketika upload R2 sementara gagal, metadata dan antrean D1 tidak dihapus. Browser dapat mengirim ulang upload ID yang sama dan Cron dapat memeriksa kembali objek R2.

### B. Perbaikan query retry workbook
- Query retry memakai alias eksplisit `e.upload_id`, `e.year`, dan `e.opd_id`.
- Jalur retry Pemda memperbarui `pemda_workbook_evidence_items` saat gagal, bukan menjalankan pembaruan pada tabel evidence generik.

### C. Pengiriman ulang yang idempotent
- Jika D1 outbox sudah berstatus `done` tetapi browser mengulang permintaan karena respons sebelumnya hilang, handler memeriksa kembali file Google Drive berdasarkan `uploadId` stabil.
- Jika file masih ada dan terverifikasi, handler menyegarkan status D1 dan mengembalikan `gdriveId`, bukan melaporkan error palsu.
- UPSERT outbox hanya memperbarui pekerjaan jika identitas jenis, tahun, OPD, R2 key, target, dan kunci evidence sama. Upload ID yang bentrok tidak dapat mengganti tujuan backup milik OPD lain.

### D. Status retry yang jujur di antarmuka
- Tombol retry pada Evidence Struktur dan Proses, Evidence Pemda, dan LHE hanya menyatakan berhasil apabila respons menyatakan `syncStatus='done'` dan mempunyai `gdriveId`.
- Bila Google Drive belum terverifikasi, pengguna mendapat pesan bahwa file tetap aman di R2 dan sinkronisasi masih dicoba kembali.
- Respons upload Pemda sekarang menyertakan `r2Key` dan `r2Saved`, sehingga antrean lokal browser dapat memilih retry Drive tanpa mengunggah ulang file yang sudah ada di R2.

## Cakupan jalur upload yang diaudit

| Jenis file | Jalur |
|---|---|
| Evidence biasa | `uploadFile` (legacy) |
| Evidence Struktur dan Proses pada workbook OPD | `uploadFile` (`sourceModel=workbook`) |
| Evidence Pemda T2/T3/T4 | `uploadPemdaWorkbookEvidence` |
| Evidence RTP | `uploadRtpEvidence` |
| Laporan PM SPIP / RR-RTP | `uploadReportFile` |
| Bukti Tindak Lanjut LHE | `uploadLheEvidence` |

Seluruh jalur di atas membuat pekerjaan pada D1 outbox sebelum/selama proses upload R2. Setelah R2 diverifikasi, upload baru dan retry menggunakan `queueDriveBackupInBackground`: permintaan operator tidak lagi menunggu Google Drive. Queue consumer mengirim file ke Drive di latar belakang. Jika pengiriman Queue sementara gagal, D1 outbox tetap menyimpan pekerjaan dan Cron Worker memulihkannya. Status hanya `done` setelah proses Drive terverifikasi.

### Penggantian file
`replaceWorkbookEvidenceFile`, `replaceEvidenceFile`, dan `replaceRtpEvidence` memperbarui file Google Drive yang sudah ada. Jika Drive gagal, handler berusaha mengembalikan objek R2 ke versi sebelumnya dan tidak melaporkan penggantian sebagai berhasil. Ini mencegah R2 dan Drive dianggap sinkron ketika kontennya berbeda.

### E. Pemrosesan background dan perlindungan status selesai
- Upload baru untuk evidence umum, evidence workbook, evidence Pemda, RTP, laporan, dan LHE hanya menunggu R2 dan pencatatan antrean; pemindahan ke Google Drive dikerjakan Queue consumer.
- Retry manual menggunakan jalur Queue background yang sama, sehingga tombol retry tidak menunggu panggilan Google Drive pada request operator.
- Worker mengimpor `processDriveBackupQueueMessage` sebagai named export. Ekspor yang sebelumnya belum dideklarasikan sudah ditambahkan; tanpa ekspor ini Worker Queue dapat gagal dimuat saat build/deploy.
- Status evidence workbook dilindungi di SQL agar catch HTTP yang terlambat tidak dapat mengubah kembali status `done` yang sudah terverifikasi menjadi `retrying`.
- Worker meneruskan execution context ke handler Queue agar notifikasi realtime dari proses background dapat diselesaikan dengan `waitUntil`.
- Event realtime membawa jenis evidence, OPD, `uploadId`, dan status; halaman workbook, Pemda, dan LHE dapat menyegarkan daftar file setelah Drive terverifikasi.
- Jika Queue tidak menerima pesan, respons menjelaskan bahwa outbox D1 tetap tersimpan dan Cron Worker akan mencoba dispatch, bukan mengklaim pesan sudah masuk Queue.

### F. Cakupan penyimpanan Google Drive
Jenis file evidence yang diproses ke Google Drive:
1. Evidence biasa pada Evidence Struktur dan Proses.
2. Evidence workbook OPD (T1 dan cakupan BPKAD/Inspektorat yang diizinkan).
3. Evidence Pemda T2/T3/T4.
4. Evidence RTP.
5. File laporan PM SPIP / RR-RTP sesuai jenis laporan.
6. Bukti Tindak Lanjut LHE.

Penggantian file (`replaceWorkbookEvidenceFile`, `replaceEvidenceFile`, `replaceRtpEvidence`) tetap memakai jalur update file Drive yang sudah ada dan rollback R2 jika Drive gagal. Jalur ini sengaja tidak dialihkan ke upload Queue baru karena perlu menjaga kesesuaian konten file yang sedang diganti.

## Pengujian lokal

- Seluruh validator `tools/validate*.mjs`: 24/24 lulus.
- Pemeriksaan sintaks JavaScript: 32/32 lulus.
- Semua 7 migrasi SQL dapat diterapkan berurutan pada SQLite lokal.
- Simulasi 25 permintaan serentak untuk satu `uploadId` menghasilkan satu klaim registry yang konsisten.
- Simulasi 100 klaim outbox berbeda dan 25 proses serentak untuk satu upload menghasilkan satu pemenang lease.
- SQL UPSERT outbox aktual dari handler diuji: pemanggilan identik idempotent dan upload ID yang dipakai untuk OPD/R2 key berbeda tidak menimpa pekerjaan pertama.
- Query retry workbook teruji terhadap SQLite dan tidak lagi menghasilkan kolom `year` ambigu.\n- Worker Queue berhasil diimpor sebagai ES module setelah named export `processDriveBackupQueueMessage` diperbaiki.

## Catatan batas pengujian

Pengujian di atas adalah validasi source dan simulasi SQLite lokal. Ini bukan upload sungguhan ke Google Drive, bukan uji kredensial OAuth produksi, dan bukan uji beban browser 40–100 pengguna pada Cloudflare. Verifikasi produksi tetap memerlukan deployment Pages dan `kawal-spip-drive-backup` Worker yang terhubung ke D1/R2/Queue yang sama, empat Secret Google Drive yang valid, dan satu upload uji pada setiap jenis fitur.
