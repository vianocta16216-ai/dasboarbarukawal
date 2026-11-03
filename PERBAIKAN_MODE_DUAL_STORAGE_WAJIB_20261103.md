# Ketentuan dual storage wajib — KAWAL SPIP

Tanggal 3 November 2026.

Setiap evidence wajib tersimpan pada Cloudflare R2 **dan** Google Drive. R2 adalah jalur penerimaan pertama untuk melindungi byte file dan memungkinkan antrean persisten bekerja; ini bukan pernyataan bahwa Google Drive opsional atau hanya backup. Upload belum dinyatakan berhasil penuh sampai file Google Drive diverifikasi ada pada folder yang ditentukan dengan ukuran byte sama dengan R2.

Pengguna cukup upload sekali. Google Drive diproses melalui D1 durable outbox + Cloudflare Queue + `kawal-spip-drive-backup` Worker. Jika Google Drive/Queue sementara gagal, file tetap di R2, status tetap `pending`/`retrying`, dan D1 outbox melakukan retry otomatis. Tidak ada alur operasional normal untuk klik **Ulangi Sinkronisasi**.

Detail implementasi, prasyarat Cloudflare, langkah deploy, pengujian, serta batasan pengujian produksi ada pada `PERBAIKAN_DUAL_STORAGE_QUEUE_FIRST_PERFORMANCE_20261103.md`.
