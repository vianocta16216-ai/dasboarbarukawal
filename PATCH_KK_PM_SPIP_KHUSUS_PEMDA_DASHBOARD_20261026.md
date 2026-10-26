# KK PM SPIP Khusus Pemerintah Kabupaten Mahakam Ulu — 26 Oktober 2026

## Tujuan

Menambahkan menu **KK PM SPIP Pemda** dan dashboard tingkat Kabupaten yang mempunyai satu workbook Google Spreadsheet tersendiri per tahun. Workbook dibuat sebagai salinan template master PM yang sama dengan kertas kerja OPD, bukan menggunakan workbook milik OPD tertentu dan tidak menulis ke data `opd_data.kk_pm_data` milik OPD.

## Apa yang ditambahkan

- Tombol navigasi tersendiri `📘 KK PM SPIP Pemda` untuk role `admin`, `irban`, `auditor`, `ppupd`, dan `bpkp`.
- Dashboard terpisah yang menampilkan status workbook, ringkasan jumlah OPD dalam cakupan, OPD sampling terpilih, PM internal selesai, QA diterima, dan BPKP selesai.
- Salinan template master dibuat melalui helper `ensureKkPmSpreadsheet`, dengan folder Drive `Kertas Kerja Spreadsheet/<tahun>/PEMERINTAH KABUPATEN MAHAKAM ULU/Kertas Kerja PM SPIP`.
- Pemeriksaan workbook: harus cocok dengan profil `PM_2026`, urutan sheet yang diharapkan dan validasi formula yang sama seperti workflow pembuatan workbook OPD. Workbook lama tidak dihapus saat perlu sinkronisasi; referensinya disimpan pada history.
- Daftar tab sheet aktif yang dapat dibuka langsung ke `gid` yang sesuai; ketika workbook belum tersedia, dashboard menampilkan manifest lokal sebagai daftar struktur master.
- Tabel OPD sampling menarik data lewat `getPemdaWorkflow`, termasuk dasar sampling, nilai ringkasan yang tersimpan, kelengkapan workbook PM/laporan/evidence, dan tiga status verifikasi. Dashboard tidak mengubah nilai sumber.
- Penyimpanan workbook Pemda menggunakan tabel D1 `pemda_kk_pm_workbooks`, kunci per tahun, lock lease, nomor versi, dan pengarsipan referensi lama. Tabel terpisah tidak terikat pada satu `opdId`.
- Pembaruan realtime memuat ulang dashboard ketika sampling, verifikasi, atau workbook Pemda berubah.

## File

- `functions/myCloudinaryHandler.js`: tabel D1, endpoint baca dan buat/sinkronkan workbook Pemda, ringkasan score pada endpoint workflow.
- `public/index.html`: tombol dan modal dashboard khusus Pemda.
- `public/script.js`: dashboard, daftar sheet, tarikan data OPD sampling, open workbook, realtime refresh.
- `public/style.css`: layout dashboard responsif.
- `database/migrations/20261026_pemda_kk_pm_workbook.sql`: migrasi idempotent.
- `tools/validate-pemda-kkpm-dashboard.mjs`: validasi regresi statis.

## Hak akses

- Semua role selain `opd` yang diizinkan API dapat membaca dashboard sesuai cakupan sesi server.
- `admin` dan `irban` dapat membuat atau menyinkronkan workbook Pemda.
- Penyimpanan PM per OPD (`opd_kk_pm_workpaper_items`, `opd_kk_pm_meta`, `opd_data.kk_pm_data`) tidak digunakan untuk menyimpan workbook Pemda ini.

## Batasan dan pemeriksaan produksi

Workbook spreadsheet adalah salinan terpisah dari master Google Sheets yang diset melalui konfigurasi backend, kemudian dapat diedit di Google Sheets sesuai hak akses Google Drive. Daftar OPD, nilai, dan status yang diringkas pada dashboard berasal dari database aplikasi; endpoint ini tidak mengubah formula master dan tidak menyalin data tiap sampel ke dalam sel formula master karena lokasi/rentang input sampling pada template belum ditetapkan secara eksplisit.

Setelah deployment, admin/Irban perlu klik **Buat dari Master**, pastikan server berhasil memvalidasi 26 sheet, kemudian uji buka sheet dan periksa izin edit Google Drive. Lakukan uji beban 40 pengguna dan unggah bersamaan pada environment Cloudflare/D1/R2/Google Drive yang sesungguhnya. Pemeriksaan kode lokal tidak dapat membuktikan performa produksi atau izin file Google Drive.
