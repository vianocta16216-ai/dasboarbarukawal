# Perbaikan Login Produksi — PBKDF2 Cloudflare Workers

## Diagnosis

Rekaman login menunjukkan HTTP 500 dengan pesan `PBKDF2 failed: iteration counts above 100000 are not supported (requested 120000)`. Kode sebelumnya membuat dan memeriksa hash password dengan 120.000 iterasi, melebihi batas runtime Cloudflare Workers. WebSocket 401 yang muncul bersamaan merupakan efek lanjutan karena sesi login belum terbentuk.

## Perbaikan dalam paket ini

- Hash password baru dan reset password memakai 100.000 iterasi PBKDF2-SHA-256.
- Pemeriksaan hash lama tidak lagi melempar HTTP 500 bila row D1 masih menyimpan 120.000 iterasi.
- Akun bootstrap lama yang belum pernah direset dapat dimigrasikan saat login berhasil menggunakan username/password yang cocok persis dengan secret `KAWAL_SPIP_USERS_JSON`. Migrasi hanya berlaku pada akun yang `password_changed_at` sama dengan `created_at`, sehingga password yang pernah direset admin tidak akan ditimpa oleh nilai bootstrap lama.
- Skema D1 baru menggunakan nilai default 100.000. Data OPD, workbook, bukti, dan sesi tidak dihapus oleh patch ini.

## Langkah deploy

1. Jangan hapus database D1, jangan jalankan `DROP TABLE`, dan jangan mengubah `seed_key` untuk memaksa bootstrap ulang. Buat backup D1 sebelum deploy sesuai prosedur organisasi.
2. Ganti/push kode dari paket ini ke repository GitHub yang terhubung ke Cloudflare Pages. Pertahankan `functions/myCloudinaryHandler.js` pada folder `functions` di root proyek dan `public` sebagai build output. Jangan mengunggah file spreadsheet password atau file berisi secret ke repository.
3. Tunggu deployment Production selesai dengan status sukses. Perubahan source lokal tidak memperbaiki website produksi sebelum deploy sukses.
4. Untuk migrasi otomatis password bootstrap lama, pertahankan secret `KAWAL_SPIP_USERS_JSON` di Production sementara. Jangan mengedit atau menempel ulang password ke chat. Nilai secret harus merupakan JSON array valid yang sama dengan daftar akun ketika akun pertama kali dibuat.
5. Coba login admin menggunakan username dan password awal yang benar. Jika hash admin merupakan hash bootstrap yang belum diubah, login pertama akan mengubah hash D1-nya menjadi 100.000 iterasi. Jika admin sebelumnya sudah mengganti password, jangan mencoba password awal berulang-ulang; gunakan mekanisme reset pemulihan admin melalui administrator database yang berwenang.
6. Jalankan query read-only “Status kompatibilitas hash password” dari `database/diagnostic_queries.sql` pada Cloudflare D1 Console. Akun yang masih menunjukkan `password_iterations > 100000` belum bermigrasi. Akun bootstrap dapat bermigrasi saat pemilik login. Jika perlu, admin yang sudah berhasil masuk dapat mereset password akun lain melalui menu Manajemen Akun; reset baru otomatis memakai 100.000 iterasi.
7. Setelah semua akun yang diperlukan sudah kompatibel, dan jumlah akun di atas 100.000 sudah nol, hapus secret `KAWAL_SPIP_USERS_JSON` dari Production untuk mengurangi keberadaan password teks biasa. Sebelum menghapusnya, pastikan tidak ada akun bootstrap yang belum bermigrasi.
8. Setelah akses pulih, minta pengguna mengganti password awal. Password awal ada pada berkas daftar akun yang dibagikan untuk troubleshooting, sehingga tidak sebaiknya dipakai sebagai password jangka panjang.

## Uji penerimaan

- Login benar menghasilkan HTTP 200 dan sesi/cookie terbentuk.
- Password salah menghasilkan HTTP 401, bukan HTTP 500.
- Login akun bootstrap lama bermigrasi menjadi `password_iterations = 100000`.
- Reset password melalui Manajemen Akun menyimpan `password_iterations = 100000`.
- Login admin dan 2–3 akun OPD uji, lalu periksa akses masing-masing tetap terbatas pada OPD yang benar.
- Tes semua 32 akun sebelum menyatakan seluruh akun dapat diakses; kode sudah diperbaiki, tetapi koneksi Cloudflare/D1 produksi harus dibuktikan dengan deployment dan uji langsung.

## Query verifikasi

```sql
SELECT role,
       COUNT(*) AS total_akun,
       SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS aktif,
       SUM(CASE WHEN password_iterations > 100000 THEN 1 ELSE 0 END) AS hash_lama_perlu_diperiksa,
       SUM(CASE WHEN password_iterations <= 100000 THEN 1 ELSE 0 END) AS hash_kompatibel
FROM auth_users
GROUP BY role
ORDER BY role;
```
