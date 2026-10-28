# Perbaikan quota Google Sheets API 429 — Kawal SPIP

Build source: `20261028-sheets-quota-resumable-v7`

## Gejala

Pesan `429 RESOURCE_EXHAUSTED / RATE_LIMIT_EXCEEDED` menunjukkan Google Sheets API menolak permintaan baca karena kuota per menit habis. Pesan pengguna menyebut 60 permintaan baca per menit per akun/proyek. Ini bukan bukti bahwa `GOOGLE_SHEETS_PM_TEMPLATE_ID` salah.

## Apa yang diubah

1. **Pembatas baca bersama di D1.** Permintaan GET ke `sheets.googleapis.com` dari Worker dijadwalkan dengan jarak 1.250 ms (sasaran sekitar 48 baca/menit), bukan sekadar antrean JavaScript lokal yang tidak terlihat oleh isolate Worker lain. Tabel `google_sheets_read_pacer` dibuat idempotent saat skema runtime disiapkan; file migrasi juga tersedia di `database/migrations/20261028_google_sheets_read_pacer.sql`.
2. **Cache metadata 180 detik dan single-flight.** Pembacaan metadata pada spreadsheet yang sama dipakai ulang dan permintaan bersamaan digabungkan. Validasi eksplisit tetap bisa memaksa metadata terbaru.
3. **Formula master dibaca sekaligus.** Empat formula inti diambil dengan satu `values:batchGet`; hasil pembacaan formula dashboard memiliki cache pendek dan permintaan identik digabungkan.
4. **Master divalidasi sekali sebelum pembaruan massal.** Setiap OPD menggunakan bukti validasi D1 yang masih baru selama Drive menyatakan master belum berubah. Salinan workbook OPD kemudian dicek struktur/tabnya, tanpa membaca formula master berulang kali untuk setiap OPD.
5. **Backoff 429.** Jika Google menolak permintaan, kode membaca `Retry-After`/`window_start_time` bila ada dan menunggu sebelum mencoba lagi. Diagnostik UI menjelaskan agar pengguna tidak menekan tombol berulang kali.
6. **Tidak ada pembacaan metadata cadangan saat error kuota.** `getKkPmTemplateConfig` tidak langsung melakukan GET metadata kedua setelah mendeteksi error kuota, agar error tidak memperparah dirinya sendiri.
7. **Pembaruan massal dapat dilanjutkan.** Jika sebagian OPD gagal, jalankan kembali tombol pembaruan setelah kuota tersedia. Workbook yang sudah valid dan memiliki ID master serta revisi yang sama digunakan kembali; OPD yang belum sesuai revisi akan diproses ulang. Ini mencegah salinan baru berulang untuk OPD yang sudah berhasil.
8. **Refresh otomatis setelah error kuota ditekan.** UI tidak langsung melakukan refresh konfigurasi/dashboard tambahan jika error kuota terjadi. Pengguna diminta menunggu sekitar 60 detik sebelum mencoba lagi.
9. **Tidak membuat salinan pengganti hanya karena 429.** Jika metadata workbook lama gagal dibaca akibat kuota, proses langsung dihentikan dan tautan lama dipertahankan; error quota tidak lagi dianggap sebagai bukti workbook rusak.
10. **Build/cache-buster baru.** Backend dan aset frontend memakai penanda `20261028-sheets-quota-resumable-v7` agar mudah memastikan kode terbaru ter-deploy.

## Cara deploy

1. Unggah semua isi ZIP perbaikan ke branch/repository GitHub yang benar-benar terhubung ke project Cloudflare Pages.
2. Pastikan file `functions/myCloudinaryHandler.js`, `public/script.js`, `public/index.html`, dan migrasi D1 ikut ter-commit. Jangan hanya mengunggah file HTML.
3. Deploy branch Production. Pastikan D1 binding `DB` tetap terpasang dan variabel/secrets `GOOGLE_SHEETS_PM_TEMPLATE_ID`, `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, serta `GOOGLE_DRIVE_FOLDER_ID` tetap diatur seperti sebelumnya.
4. Buka dashboard dengan Ctrl+F5. Pastikan status master menampilkan build `20261028-sheets-quota-resumable-v7` dan sumber `GOOGLE_SHEETS_PM_TEMPLATE_ID`.
5. Klik validasi/perbarui master satu kali. Jika muncul error 429, jangan tekan berulang kali. Tunggu sekitar 60 detik, kemudian lanjutkan lagi.
6. Setelah master tervalidasi, jalankan pembaruan Pemda + seluruh OPD. Periksa ringkasan jumlah berhasil dan gagal. Jika sebagian gagal, tunggu kuota tersedia lalu jalankan ulang; workbook yang sudah sesuai revisi master tidak dibuat salinan ulang.

## Batasan dan mitigasi tambahan

- Tidak ada kode yang dapat menghapus kuota yang ditetapkan Google. Pembatas bersama ini mengendalikan permintaan baca yang keluar dari aplikasi Kawal SPIP yang menggunakan D1 tersebut; permintaan eksternal atau aplikasi lain yang memakai proyek/akun Google yang sama tetap dapat menghabiskan kuota.
- Jika 429 terus terjadi setelah deploy dan penggunaan aplikasi lain telah diperiksa, buka Google Cloud Console → APIs & Services → Google Sheets API → Quotas & System Limits dan ajukan peningkatan `Read requests per minute per user`. Persetujuan peningkatan kuota tidak dijamin.
- Untuk traffic yang terus tumbuh, langkah arsitektur berikutnya adalah memindahkan pembaruan massal menjadi antrean job resumable (misalnya Cloudflare Queues/Workflows) agar pekerjaan panjang tidak bergantung pada koneksi browser. Perbaikan ini tidak menambahkan layanan tersebut secara otomatis.
- Workbook Drive lama tetap dipertahankan. Sumber/master baru harus mempunyai izin baca dan formula inti yang valid. Perbaikan quota tidak dapat memperbaiki ID salah atau izin OAuth yang hilang.

Dokumentasi kuota resmi Google: https://developers.google.com/workspace/sheets/api/limits
