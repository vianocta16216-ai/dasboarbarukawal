# Patch Kertas Kerja Pemda, Sampling OPD, dan Verifikasi Berjenjang

Tanggal: 26 Oktober 2026

## Alur yang diterapkan

1. **Verif 1 — PM internal oleh Asesor OPD.** Akun `opd` yang terikat pada OPD tersebut atau `admin` dapat mencatat status PM, nama pemeriksa, dan catatan. Panel menampilkan status pengisian kertas kerja, workbook PM, laporan PM, dan evidence yang tercatat agar pemeriksa dapat melakukan pemeriksaan kelengkapan.
2. **Verif 2 — QA Auditor / PPUPD.** Hanya akun `auditor`, `ppupd`, atau `admin` yang dapat menyimpan. Tahap ini ditolak oleh server sebelum PM internal berstatus `selesai`.
3. **Verif 3 — BPKP untuk OPD sampel.** Hanya akun `bpkp` atau `admin` yang dapat menyimpan. Server mewajibkan OPD ditetapkan sebagai sampel serta PM selesai dan QA berstatus `diterima` atau `diterima_catatan`.
4. **Pemilihan sampling.** Hanya `irban` atau `admin` dapat menentukan OPD sampel. Dasar sampling wajib diisi minimal 3 karakter. Sampel tidak dapat dikeluarkan setelah verifikasi BPKP mulai diproses, kecuali tahap itu direset melalui alur resmi.

Perubahan PM akan mengembalikan QA dan BPKP ke status `belum`; perubahan status QA akan mengembalikan BPKP ke `belum`. Reset dan perubahan tahap dicatat ke riwayat audit. Tiap perubahan menggunakan nomor versi (optimistic concurrency) sehingga simpanan bersamaan tidak diam-diam menimpa perubahan pengguna lain.

## Perbaikan error yang terlihat pada rekaman

Rekaman memperlihatkan `makeStatement(...).run is not a function`. Helper `runD1WithRetry` dalam Worker mengharapkan *factory function* yang menghasilkan objek statement D1. Handler fitur baru menggunakan bentuk yang benar, yaitu `runD1WithRetry(() => env.DB.prepare(...).bind(...))`, sehingga helper yang melakukan `.run()` bekerja pada statement, bukan fungsi/objek yang salah. ZIP sumber yang diunggah belum berisi panel sampling yang terlihat di rekaman, maka patch ini memasukkan implementasi panel dan endpoint backend yang utuh ke sumber ZIP tersebut; ia bukan patch terhadap kode live Cloudflare yang tidak disertakan terpisah.

## File yang berubah/ditambahkan

- `functions/myCloudinaryHandler.js` — tabel workflow/audit, endpoint baca/simpan, role checks, prasyarat tiap tahap, optimistic locking, retry D1, audit log, dan broadcast realtime.
- `public/index.html` — navigasi dan modal KK Pemda & Sampling.
- `public/script.js` — ringkasan status, pemilihan sampel, form tiga tahap, audit, retry, dan refresh realtime.
- `public/style.css` — tampilan responsif, badge verifikasi, tabel dan editor.
- `database/migrations/20261026_pemda_sampling_workflow.sql` — migrasi D1 idempotent (tabel dibuat otomatis oleh Worker juga).
- `tools/validate-pemda-sampling-workflow.mjs` — validasi statis untuk patch.

## Deploy ke GitHub / Cloudflare Pages

1. Buat backup/branch dari repository sebelum mengganti file.
2. Salin seluruh isi folder repository dari ZIP patch ini ke repository GitHub, termasuk file migrasi dan validator. Jangan hanya menyalin file `public`; endpoint server juga harus ikut.
3. Pastikan binding D1 `DB` tetap menunjuk ke database produksi yang benar, dan binding R2/variabel/secret lama tidak dihapus atau diganti.
4. Commit dan push. Worker membuat tabel baru saat inisialisasi schema; file SQL disertakan agar perubahan database eksplisit terdokumentasi. Jangan menghapus tabel atau melakukan reset database lama.
5. Setelah deployment, uji dengan akun terpisah: `opd` menyelesaikan PM; `auditor`/`ppupd` menerima QA; Irban menandai OPD sampling; kemudian `bpkp` menyimpan verifikasi tahap 3. Coba juga menolak QA sebelum PM dan BPKP untuk OPD non-sampel.
6. Untuk unggahan 40 akun, gunakan pengujian beban di environment Cloudflare yang sebenarnya. Patch ini memberi retry untuk lock/overload, penyimpanan berbasis versi, serta batas 4 permintaan serentak saat menyimpan daftar sampling, tetapi hasil uji statis bukan pengganti benchmark terhadap D1/R2/Google Drive produksi.

## Verifikasi yang dijalankan saat membuat patch

- Pemeriksaan sintaks Node untuk `public/script.js` dan `functions/myCloudinaryHandler.js`.
- Regresi `validate-verification-roles-score.mjs`, `validate-realtime-scope-isolation.mjs`, `validate-workbook-concurrency.mjs`, dan `validate-spip-integration.mjs`.
- `validate-pemda-sampling-workflow.mjs` dan eksekusi SQL migrasi lokal dengan SQLite.

Catatan: tidak ada kredensial Cloudflare/D1 produksi dalam proses ini, sehingga deploy live, unggah nyata ke Google Drive/R2, dan uji 40 pengguna bersamaan harus divalidasi setelah ZIP ini dipasang di lingkungan Anda.
