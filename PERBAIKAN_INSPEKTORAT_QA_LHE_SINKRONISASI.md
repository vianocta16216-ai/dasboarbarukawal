# Catatan Perbaikan — Inspektorat, QA APIP, Sinkronisasi KK PM, dan Tahun LHE

Tanggal paket: 14 Oktober 2026.

## Perubahan

1. **HTTP 403 pada Quality Assurance APIP.** Allowlist peran `opd` mencakup pembacaan `getQaApipData`, `getWorkbookEvidenceFiles`, dan nilai resmi dashboard yang memang dipakai antarmuka. Panggilan Kertas Kerja PM (`getKkPmDataDetailed`, pemetaan RPJMD, serta sinkronisasi nilai formula) juga diizinkan untuk akun OPD yang memiliki cakupan akses. Guard `assertSessionCanAccessOpd` tetap aktif sehingga perubahan ini tidak memberi izin lintas-OPD.
2. **Master spreadsheet baru.** Ketika modal Kertas Kerja PM dibuka, aplikasi meminta ulang master live. Webhook Apps Script kini dapat memanggil endpoint sinkronisasi tanpa sesi browser, tetapi tetap wajib memakai secret minimal 32 karakter dan hanya melalui POST. Pembaruan webhook membatalkan cache server; perlindungan generasi cache mencegah pembacaan lama yang masih berjalan menulis ulang cache usang. Permintaan master dari aplikasi membawa tahun yang sedang dipilih agar propagasi menargetkan data OPD pada tahun itu.
3. **Propagasi ke workbook OPD.** Sinkronisasi tetap memperbarui kolom template A:L pada workbook OPD yang telah ditautkan dan tidak menimpa kolom input M ke kanan yang merupakan isian per-OPD. Definisi/parameter master live juga digunakan oleh Kertas Kerja dalam aplikasi sehingga semua akun yang membuka Kertas Kerja mendapatkan struktur template terbaru.
4. **Tindak Lanjut LHE SPIP.** Label kolom dan pilihan tahun tidak lagi dikunci ke 2025/2024 atau ke nilai awal HTML. Aplikasi memakai tahun aktif yang dipilih dan tahun sebelumnya, serta memetakan template lama dengan mencantumkan tahun asalnya secara transparan. Tahun sumber asli template disimpan pada field `source_year` terpisah dari `year` (Tahun Anggaran target tindak lanjut); kode aktif tidak memakai kolom `template_source_year`. Tahun historis yang tersimpan masih dapat dipertahankan ketika mengedit rekaman lama.
5. **Tahun dinamis.** Daftar tahun selalu menambahkan tahun kalender berjalan, default pembuatan workbook mengikuti tahun kalender bila tidak dikirim, dan UI tidak lagi memaksa selector kembali ke 2026 setelah penghapusan tahun data.

## Pemeriksaan lokal

- Sintaks `public/script.js`, `functions/myCloudinaryHandler.js`, dan `tools/KawalSPIP_MasterSync.gs` diperiksa.
- Validasi integrasi RPJMD yang telah tersedia lulus.
- Validasi tambahan untuk izin, pembatasan cakupan OPD, sinkronisasi cache, dan tahun LHE tersedia pada `node tools/validate-inspektorat-20261014.mjs`.
- JSON statis dan jumlah kolom/placeholder SQL LHE diperiksa.

Pemeriksaan tersebut bukan pengganti tes pada Cloudflare Pages/Functions, D1, Google Sheets, serta akun produksi; paket lokal tidak memiliki secret dan kredensial produksi.

## Konfigurasi deploy yang harus dipastikan

1. Deploy seluruh paket proyek ke Cloudflare Pages agar `functions/myCloudinaryHandler.js`, `public/script.js`, `public/index.html`, dan aset master yang terkait dirilis bersama.
2. Pastikan `GOOGLE_SHEETS_PM_TEMPLATE_ID` menunjuk ke **spreadsheet master baru** dan `GOOGLE_SHEETS_PM_AUTO_PROPAGATE` tidak disetel `false`.
3. Pastikan kredensial OAuth Google masih valid dan scope Google Sheets memadai untuk membaca master serta menulis workbook OPD yang ditautkan.
4. Pastikan `KK_MASTER_SYNC_SECRET` di Cloudflare sama dengan `KAWAL_SPIP_SYNC_SECRET` di Script Properties Apps Script (minimal 32 karakter), `KAWAL_SPIP_WEBHOOK_URL` menunjuk endpoint `/myCloudinaryHandler`, dan trigger `onEdit` terpasang pada spreadsheet master baru.
5. Nama tab master yang dibaca harus sesuai pemetaan saat ini: `KK3.1`, `KK3.2`, `KK3.3`, dan `KK3.4`. Jika nama tab pada spreadsheet baru berbeda, sesuaikan `sourceMap` dan `readLiveKkMasterRows` agar konsisten sebelum produksi.
6. Setelah deploy, login memakai akun Inspektorat dan akun OPD uji; buka QA APIP serta KK PM, ubah satu parameter pada master, kemudian pastikan template muncul setelah sinkronisasi. Periksa Console/Network untuk memastikan permintaan QA dan Kertas Kerja tidak lagi mendapat HTTP 403 serta sinkronisasi tidak melaporkan workbook gagal.

**Catatan data:** hanya bagian struktur/template master yang disalin ke workbook OPD. Isian individual tidak disalin massal antar-OPD demi mencegah data satu OPD menimpa data OPD lain.
