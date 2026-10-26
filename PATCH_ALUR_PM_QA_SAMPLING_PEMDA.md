# Patch alur PM OPD → QA APIP → Sampling Pemda/BPKP

## Perubahan
- Alur verifikasi evidence diperbarui menjadi: asesor OPD (PM internal) → Auditor/PUPPD (QA) → BPKP (khusus OPD sampel).
- Setiap tahap menyimpan nama pemeriksa, status, catatan, waktu, akun, dan audit trail. Catatan wajib diisi saat dokumen diterima dengan catatan atau dikembalikan.
- Perubahan pada tahap awal membatalkan keputusan tahap berikutnya yang sudah tidak relevan, tetapi audit trail tetap tersimpan.
- Ditambahkan tabel D1 `pemda_opd_sampling` dengan kunci tahun + OPD; tabel dibuat otomatis oleh inisialisasi database aplikasi.
- Ditambahkan modal Kertas Kerja Pemerintah Kabupaten Mahakam Ulu untuk melihat status PM/QA, memilih OPD sampling, dan menyimpan dasar/catatan pemilihan. Hanya Super Admin dan Irban yang dapat mengubah pilihan sampel.
- Endpoint verifikasi BPKP menolak proses jika OPD belum dipilih sebagai sampel.
- Pemilihan sampling dan status QA/BPKP dipisahkan dari nilai PM OPD; tidak menimpa nilai resmi BPKP tingkat Pemda.

## File yang berubah
- `public/index.html` — tombol dan modal Kertas Kerja Pemda/sampling serta label alur verifikasi.
- `public/script.js` — antarmuka sampling dan tahap verifikasi yang baru.
- `functions/myCloudinaryHandler.js` — otorisasi role, tabel D1, endpoint sampling, prasyarat antar tahap, dan pembatasan BPKP pada OPD sampel.
- `tools/validate-lhe-followup-export-score-refresh.mjs` — ekspektasi validator disesuaikan dengan alur baru.

## Deploy ke Cloudflare Pages + D1
1. Ekstrak ZIP dan unggah perubahan ke repository GitHub yang digunakan Cloudflare Pages.
2. Pastikan binding D1 `DB` tetap mengarah ke database produksi yang sama. Jangan membuat database baru jika ingin mempertahankan data aktif.
3. Deploy Pages. Inisialisasi tabel berjalan melalui jalur inisialisasi database yang sudah ada pada handler.
4. Login sebagai Admin/Irban, buka tombol **Kertas Kerja Pemda & Sampling OPD**, pilih sampel dan simpan catatan.
5. Uji akun Operator OPD: hanya dapat menyelesaikan tahap PM internal untuk file milik OPD yang menjadi cakupannya.
6. Uji akun Auditor dan PUPPD: tahap QA hanya dapat dilakukan setelah PM internal diterima.
7. Uji akun BPKP: tahap verifikasi hanya dapat dilakukan pada OPD yang dipilih sebagai sampel dan setelah QA diterima.
8. Uji dua akun pada OPD berbeda dan beberapa upload secara bersamaan. Periksa log Pages, D1, R2, Google Drive, dan realtime Worker.

## Catatan validasi
Pemeriksaan sintaks JavaScript dan validator statis yang tersedia dijalankan. Ini bukan bukti uji beban 40 pengguna atau uji integrasi live Cloudflare. Sebelum dipakai operasional, lakukan uji beban bertahap dengan akun uji dan file contoh, verifikasi binding/secrets, dan siapkan backup D1/R2. Jangan menaruh password atau secret produksi di GitHub.

## Kompatibilitas riwayat lama
Riwayat lama dengan tahap `irban` ditampilkan sebagai QA untuk ringkasan status, sedangkan audit trail lama tetap tersimpan. Tahap lama `auditor` tetap ada di riwayat audit; dokumen lama yang belum mempunyai status PM baru mungkin perlu ditinjau dan diproses ulang sesuai alur baru.
