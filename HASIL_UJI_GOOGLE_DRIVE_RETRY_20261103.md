# Hasil pemeriksaan Google Drive upload/retry — KAWAL SPIP
Tanggal: 3 November 2026

## Akar masalah yang terkonfirmasi dari rekaman
1. `UNIQUE constraint failed: evidence_upload_registry.upload_id`: pola SELECT-then-INSERT rentan balapan pada permintaan upload yang memakai uploadId sama.
2. `D1_ERROR: ambiguous column name: year`: query retry `workbook_evidence` JOIN dua tabel yang sama-sama memiliki kolom `year` tetapi WHERE tidak menyebut alias.
3. Jalur upload baru masih menunggu Google Drive secara sinkron pada request operator, sehingga terasa lama walaupun R2 sudah selesai.
4. Worker Queue mengimpor named export `processDriveBackupQueueMessage` dari Pages Function tetapi fungsi sebelumnya tidak diekspor. Ini bisa membuat Worker gagal di-load/build walaupun sintaks file satu per satu valid.

## Perbaikan
- Registry upload OPD, workbook OPD, dan workbook Pemda memakai `INSERT OR IGNORE` diikuti validasi identitas; uploadId yang dipakai tenant/lokasi lain ditolak.
- Query retry workbook memakai `e.upload_id`, `e.year`, `e.opd_id`.
- Retry mencakup evidence umum, report, RTP, workbook OPD, workbook Pemda, dan LHE. Cabang Pemda menulis status ke tabel Pemda yang benar.
- Upload evidence baru dan retry memindahkan kerja Google Drive ke Queue background setelah R2 dan D1 outbox aman. Outbox Cron menjadi jalur pemulihan saat Queue send/binding sementara tidak tersedia.
- Google Drive diverifikasi berdasarkan uploadId stabil dan folder tujuan. Hanya status `done` bersama `gdriveId` yang diakui sebagai berhasil. Setelah consumer selesai, event realtime bertipe dikirim untuk menyegarkan tampilan evidence terkait.
- Retry terlambat tidak boleh menurunkan status `done`; proteksi CAS diterapkan pada payload JSON dan guard SQL pada tabel workbook.
- Named export `processDriveBackupQueueMessage` ditambahkan agar Worker dapat mengimpornya. Queue handler meneruskan `ctx` ke proses backup sehingga pembaruan realtime tidak kehilangan pekerjaan async.
- Penggantian file yang perlu memperbarui konten Drive lama tetap menggunakan mekanisme update + rollback, agar tidak mengubah perilaku penggantian file.

## Validasi lokal setelah perubahan
- 24/24 validator Node (`tools/validate*.mjs`) lulus.
- 32/32 file JavaScript/MJS lolos `node --check`.
- 3/3 konfigurasi TOML valid.
- 13/13 file JSON valid.
- 7/7 migrasi SQL berhasil diterapkan berurutan pada SQLite lokal.
- Dua uji Python regresi lulus dengan `python -S`:
  - Query JOIN retry dan 25 permintaan serentak untuk satu uploadId menghasilkan satu record konsisten.
  - SQL UPSERT outbox idempotent dan menolak benturan lintas OPD/R2.
  - Simulasi 100 klaim upload berbeda, 25 proses untuk uploadId yang sama, dan retensi retry lulus.
- Worker Queue berhasil diimpor sebagai ES module melalui Node setelah named export diperbaiki.

## Batas bukti
Validasi ini membuktikan konsistensi source, konfigurasi, query, serta simulasi SQLite lokal. Ini bukan bukti bahwa file sungguhan telah terkirim ke Google Drive produksi. Pengujian produksi tetap perlu dilakukan setelah Pages dan `kawal-spip-drive-backup` Worker terbaru di-deploy dengan binding Queue, D1, R2 yang benar serta empat Secret Google Drive valid. Uji satu file untuk setiap tipe evidence harus mengecek keberadaan file dan folder di Google Drive sebelum status `done`.
