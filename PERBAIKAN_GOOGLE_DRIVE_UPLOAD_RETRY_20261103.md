# Audit perbaikan upload otomatis R2 + Google Drive — KAWAL SPIP
Tanggal: 3 November 2026.

Dokumen ini merangkum akar masalah dan perubahan lanjutan. Untuk kontrak penyimpanan terkini, deployment, dan pengujian yang benar, ikuti `PERBAIKAN_DUAL_STORAGE_QUEUE_FIRST_PERFORMANCE_20261103.md`.

## Temuan rekaman 3 November

- Sebagian file R2 sudah ada, tetapi beberapa upload masih tertahan karena worker lain memegang lease D1.
- Pengulangan proses Drive dari browser dapat bersaing dengan Queue/Worker yang sudah memiliki lease.
- Kegagalan D1 `UNIQUE constraint failed: evidence_upload_registry.upload_id` menunjukkan klaim registri tidak tahan terhadap permintaan serentak.
- Error `ambiguous column name: year` berasal dari query join workbook yang tidak memberi alias eksplisit.

## Perbaikan yang diterapkan

- Registrasi upload memakai klaim idempotent dan memeriksa bahwa upload ID tidak digunakan ulang untuk OPD, evidence, atau R2 key lain.
- Query workbook memakai alias tabel eksplisit untuk `upload_id`, `year`, dan `opd_id`.
- Upload baru pada evidence umum, workbook OPD, workbook Pemda, RTP, laporan, dan LHE membuat pekerjaan pada D1 durable outbox, memverifikasi objek R2, lalu mengirim pesan ke Queue.
- Browser tidak lagi menjalankan retry pengiriman Google Drive. Browser hanya memulihkan file yang belum mendapat konfirmasi tersimpan di R2; retry Drive dikelola Worker dan Cron.
- Cloudflare Worker memproses Queue, dan Cron setiap menit memulihkan pekerjaan yang tertunda dari D1.
- Keberhasilan Drive membutuhkan file yang masih ada, tidak di Trash, berada di folder tujuan, serta memiliki ukuran byte sama dengan R2.
- Worker terhubung ke Durable Object realtime untuk memperbarui panel setelah Drive terverifikasi.
- Polling dashboard penuh dikurangi dan hanya menjadi fallback saat realtime terputus dan tab sedang aktif.

## Jalur penggantian file

Fungsi `replaceWorkbookEvidenceFile`, `replaceEvidenceFile`, dan `replaceRtpEvidence` adalah jalur khusus untuk file yang dikembalikan verifikator. Jalur ini memperbarui objek R2 dan file Drive yang sudah ada, serta memverifikasi ukuran setelah update. Jalur replacement masih mempunyai perlindungan rollback R2 apabila update Drive langsung gagal; ini berbeda dari jalur upload baru berbasis antrean.

## Hasil pengujian lokal pada paket ini

- Pemeriksaan sintaks semua file `.js`/`.mjs` pada `functions`, `drive-backup-worker`, `realtime-worker`, `public`, dan `tools` lulus.
- 25/25 validator `tools/validate-*.mjs` lulus.
- Uji regresi query D1, klaim registry 25 proses serentak, UPSERT outbox idempotent, dan konflik upload lintas OPD lulus.
- Simulasi SQLite: 100 klaim upload berbeda berjalan serentak; untuk satu upload yang sama hanya satu lease menang; pekerjaan retry tetap tersimpan.
- Uji pemulihan `runD1WithRetry` lulus.
- Ketiga konfigurasi TOML dapat diparse.
- Seluruh 7 migrasi SQL proyek berhasil diterapkan berurutan pada SQLite lokal.

## Batas pembuktian

Uji lokal tidak membuktikan kredensial Google OAuth, Queue, binding, dan penyimpanan pada akun produksi. Sebelum menganggap rilis selesai, deploy Worker dan Pages, pastikan dua Queue serta empat Secret Drive dan seluruh binding tersedia, cek endpoint `/health`, kemudian lakukan upload uji nyata dan pastikan file fisik terlihat di folder Google Drive. Checklist ada di `PERBAIKAN_DUAL_STORAGE_QUEUE_FIRST_PERFORMANCE_20261103.md`.
