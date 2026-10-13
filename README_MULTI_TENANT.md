# Kawal SPIP — Paket Multi-Tenant

## Source
- `functions/myCloudinaryHandler.js` — API, login/session, role authorization, D1, R2, Google Sheets/Drive, verification workflow.
- `public/index.html`, `public/script.js`, `public/style.css` — UI dashboard, login, account management.
- `public/lhe-followup-templates.json` — templates tindak lanjut LHE 2025 dan 2024.
- `realtime-worker/` — Worker Durable Object untuk update realtime.

## Dokumentasi
- `BLUEPRINT_MULTI_TENANT_KAWAL_SPIP.md` — blueprint, relasi data, aliran tarikan data, akun, dan batas pemeriksaan.
- `PANDUAN_PERBAIKAN_AKUN_LHE_VERIFIKASI_ENV_CLOUDFLARE.md` — env vars, bindings, deployment dan uji penerimaan.
- `Panduan_Perbaikan_Kawal_SPIP.md` — ringkasan konfigurasi Cloudflare.
- `database/diagnostic_queries.sql` — query SELECT read-only untuk audit D1 setelah deployment.
- `PERBAIKAN_LOGIN_PBKDF2_CLOUDFLARE.md` — diagnosis dan langkah pemulihan login akibat batas iterasi PBKDF2 Cloudflare Workers.
- `CHECKLIST_VALIDASI_TARIKAN_DATA_28_OPD.csv` — checklist pengujian live per akun/OPD.
- `KAWAL_SPIP_USERS_JSON.example.json` — contoh format dengan placeholder, bukan kredensial yang dapat login.

## Keamanan kredensial
Berkas nyata `KAWAL_SPIP_USERS_JSON.json` dan `DAFTAR_AKUN_KAWAL_SPIP_RAHASIA.csv` diserahkan terpisah. Keduanya sengaja tidak dimasukkan ke ZIP source. Jangan commit keduanya ke GitHub. JSON bootstrap berukuran 4.261 byte dan satu baris agar sesuai batas Cloudflare 5 KB per secret; gunakan persis apa adanya (jangan pretty-print). Field `enabled` dan `displayName` OPD yang opsional dihilangkan; parser menganggap akun aktif secara default, dan nama tampilan Operator OPD akan menggunakan username sedangkan `opdName` tetap nama OPD lengkap. Setelah bootstrap berhasil dan diverifikasi, `KAWAL_SPIP_USERS_JSON` dapat dihapus dari Cloudflare Secrets; akun aktif berikutnya dikelola melalui menu Manajemen Akun dan password disimpan sebagai hash pada D1. Batas ukuran: https://developers.cloudflare.com/workers/platform/limits/.

## Status verifikasi
Pemeriksaan statis mencakup sintaks JavaScript, JSON akun, kesesuaian cakupan 28 OPD dengan master aplikasi, dan pemeriksaan jalur/konfigurasi. Uji live masih perlu dilakukan pada Cloudflare D1/R2/Bindings dan Google Sheets/Drive yang digunakan oleh organisasi.
