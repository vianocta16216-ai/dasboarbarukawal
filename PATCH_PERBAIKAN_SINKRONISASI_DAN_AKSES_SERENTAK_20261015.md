# Catatan Patch — Sinkronisasi Workbook PM, akses serentak, dan LHE

Tanggal revisi: 15 Oktober 2026.

Catatan ini diperbarui untuk menjelaskan paket terbaru. Petunjuk lama yang menyebut template PM 28 tab atau validator LHE `template_source_year` tidak berlaku untuk provisioning PM_2026 saat ini.

## Akar masalah yang terlihat

1. Rekaman terbaru menampilkan Google Sheets dengan pesan bahwa file sudah dihapus. Karena ID workbook lama tersimpan sebagai pointer di D1, cache browser saja tidak cukup diperbaiki; referensi server harus diperiksa dan diganti.
2. Master yang sebelumnya dipakai tidak konsisten dengan master PM_2026. Resolver lama terlalu longgar terhadap profil sheet dan metadata revisi, sehingga workbook lama bisa tetap dianggap valid hanya karena tabnya ada.
3. Tombol Buka Spreadsheet PM sebelumnya bisa memakai URL dalam memori browser tanpa memeriksa ulang pointer D1.
4. Nama tab T1–T4 dalam Google Sheets dapat bervariasi; membangun A1 range dari alias tetap menimbulkan `Unable to parse range`.
5. Frasa tahun LHE sebelumnya terlihat mengunci pada 2025/2024, sementara tahun target tindak lanjut seharusnya mengikuti Tahun Anggaran aktif aplikasi.
6. Dua permintaan pembuatan workbook pada OPD/tahun sama berpotensi menyalin master dua kali bila tidak diserialisasi.

## Perubahan terkini

- **Master PM kanonis:** pemeriksaan ID master khusus, deteksi master Google Sheets terbaru dengan nama sumber yang disetujui, pengecekan `modifiedTime`, struktur 26 tab PM_2026, dan formula kunci. Resolver menolak file cadangan yang sekadar diawali nama master tetapi memiliki suffix tidak dikenal.
- **Rollover pointer D1:** saat open/sync, backend memastikan workbook masih bisa diakses dan membandingkan ID/revisi sumber dengan master aktif. Jika sumber beda atau file sudah dihapus, ia membuat salinan baru dan memindahkan pointer OPD/tahun setelah validasi. File lama tidak dihapus; riwayat disimpan pada `kk_pm_data.workbookHistory`.
- **URL buka authoritative:** tombol Buka Spreadsheet dan buka tab tertentu meminta ulang data dari server tanpa cache. Jika workbook perlu diperbarui, sinkronisasi dijalankan sebelum URL dibuka. Jika verifikasi gagal, tab baru ditutup—tidak jatuh balik ke URL lama.
- **Akun dan konkurensi:** role Inspektorat/Irban diberi izin hanya untuk aksi yang dibutuhkan dalam cakupan OPD yang diizinkan. Lock D1 per OPD/tahun menyerialisasi pembuatan workbook, memeriksa token pemilik lock sebelum menulis, dan sesi yang terkena konflik dapat retry berdasarkan `retryAfterSeconds`. Penyimpanan cell memakai merge D1 agar data dan pointer workbook tidak saling menimpa.
- **Formula dan skor:** pembacaan nilai formula tidak diperbolehkan menulis hasil dari workbook yang bukan lagi workbook aktif untuk OPD/tahun tersebut.
- **Tahun LHE:** tahun target tindak lanjut menggunakan Tahun Anggaran aktif dan berubah otomatis. `source_year` tetap menjaga tahun laporan asli agar historis tidak dipalsukan. Tahun sumber tidak dibatasi hanya 2024/2025; tahun kalender sekarang dimasukkan otomatis ke pilihan Tahun Anggaran.
- **Cache:** cache-buster aset diperbarui untuk memastikan browser tidak menyajikan versi HTML/JS LHE lama.

## Uji otomatis lokal

Semua pemeriksaan berikut lulus pada paket lokal:

- Sintaks semua berkas `.js` dan `.mjs`.
- Parsing 13 berkas JSON.
- `node tools/validate-pm-template-resolution.mjs` — 23 pemeriksaan.
- `node tools/validate-workbook-concurrency.mjs` — 37 pemeriksaan.
- `node tools/validate-inspektorat-20261014.mjs` — 60 pemeriksaan.
- `node tools/validate-spip-integration.mjs` — 11 pemeriksaan.
- `node tools/validate-workbook-rollover-lhe-years.mjs` — 17 pemeriksaan.

Jumlah tersebut adalah hasil validasi statis, mock Google API, dan simulasi/helper lokal, bukan tes beban terhadap layanan produksi.

## Hal yang tetap wajib diverifikasi saat deploy

- `GOOGLE_SHEETS_PM_TEMPLATE_ID` harus menunjuk ke ID Google Sheets master PM 26 tab terbaru. Resolver otomatis mengenali nama canonical dan beberapa suffix rilis; nama yang benar-benar berbeda memerlukan ID env yang eksplisit.
- `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, dan `GOOGLE_DRIVE_FOLDER_ID` harus valid. OAuth harus dapat membaca master dan menyalin file.
- Deploy seluruh proyek Pages agar backend, HTML, JS, dan cache-buster diperbarui bersamaan.
- Uji secara langsung satu OPD Inspektorat, satu OPD umum, dua sesi bersamaan, upload, dan verifikasi. Credential dan Cloudflare/Google Drive produksi tidak tersedia di lingkungan pembuat ZIP, sehingga saya tidak menyatakan migrasi di server live telah terjadi.

## Perilaku aman

Sinkronisasi hanya membuat workbook kerja terpisah per OPD/tahun dari master bersama. Ia tidak mengarahkan seluruh OPD ke satu file, tidak menghapus Google Sheet lama, dan tidak mengganti template 28 tab menjadi 26 tab secara paksa. Migrasi pointer dilakukan saat OPD/tahun dibuka atau disinkronkan setelah deployment, sehingga tidak membuat puluhan salinan sekaligus secara mendadak.
