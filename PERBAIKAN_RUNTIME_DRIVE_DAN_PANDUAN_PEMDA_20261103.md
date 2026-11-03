# Perbaikan Google Drive dan panduan evidence Pemda — 3 November 2026

## Kesimpulan pemeriksaan

Berdasarkan ZIP serta cuplikan dua video yang tersedia:
- Video 145628 sekitar detik 10 menunjukkan Settings worker `kawal-spip-drive-backup`: bagian Runtime Variables and secrets kosong. Sekitar detik 15–20, empat GOOGLE_DRIVE_* berada pada bagian Build Variables and secrets.
- Video 142544 sekitar detik 15–20 memperlihatkan `/health` dengan `googleDriveConfigured:false`, sedangkan binding database, R2, Queue dan Realtime terbaca. Antrean memiliki file berstatus retrying.
- Pages memiliki konfigurasi sendiri. Secrets Pages tidak otomatis tersedia pada worker terpisah.
- `directGoogleDriveBackup()` dalam kode lama mengeluarkan pesan umum sebelum mengambil token OAuth bila salah satu dari empat variabel runtime tidak ada. Karena itu, pesan tersebut belum membuktikan token Google salah: proses berhenti sebelum menguji token.
- Video Recording 2026-11-03 142437.mp4 tidak tersedia untuk diperiksa.

**Mengganti kode saja tidak akan mengisi runtime secrets Cloudflare. Pengaturan berikut wajib dilakukan pada proyek yang benar. Tidak ada deployment atau upload Google Drive produksi yang dijalankan dari pemeriksaan lokal ini.**

## 1. Perbaiki lokasi konfigurasi

Buka Cloudflare → Workers & Pages → **kawal-spip-drive-backup** → Settings → **Variables and Secrets pada Runtime**, Production.
Jangan berhenti pada bagian Build → Variables and secrets. Isi nama persis berikut (huruf besar/kecil diperhatikan):

| Nama | Isi | Jenis yang disarankan |
| --- | --- | --- |
| GOOGLE_DRIVE_CLIENT_ID | OAuth Client ID yang digunakan membuat refresh token | Secret |
| GOOGLE_DRIVE_CLIENT_SECRET | Client secret pasangan Client ID tersebut | Secret |
| GOOGLE_DRIVE_REFRESH_TOKEN | Refresh token dari klien dan akun Google yang benar | Secret |
| GOOGLE_DRIVE_FOLDER_ID | ID folder tujuan, bukan URL lengkap | Secret atau Text |

Simpan dan deploy perubahan ke versi Production aktif. Nilai yang hanya tersimpan dalam versi draft belum cukup. Pastikan empat nama muncul pada Runtime worker setelah selesai.
Pada proyek Pages website, pertahankan empat konfigurasi yang sama pada environment Production yang melayani website. Bila mengubah Pages variables, lakukan deployment Pages baru.

Alternatif CLI untuk worker, dari root repository (setiap perintah meminta nilai secara interaktif; jangan tempel nilai ke source/Git):

```sh
npx wrangler secret put GOOGLE_DRIVE_CLIENT_ID --config drive-backup-worker/wrangler.toml
npx wrangler secret put GOOGLE_DRIVE_CLIENT_SECRET --config drive-backup-worker/wrangler.toml
npx wrangler secret put GOOGLE_DRIVE_REFRESH_TOKEN --config drive-backup-worker/wrangler.toml
npx wrangler secret put GOOGLE_DRIVE_FOLDER_ID --config drive-backup-worker/wrangler.toml
```

Nilai kredensial tampak terbuka di salah satu video. Jangan unggah rekaman tersebut ke tempat publik. Ganti kredensial yang telah tersebar dan perbarui pasangan nilainya pada Pages serta Runtime worker; jangan memasukkannya ke GitHub.

## 2. Pasang source perbaikan

Salin isi folder `dasboarbarukawal-main` dari ZIP ke root repository GitHub yang sama. File utama berubah:

1. `functions/myCloudinaryHandler.js`: pemeriksaan runtime terpusat, menolak nilai kosong/spasi, menyebut nama variabel hilang dan petunjuk lokasi; memeriksa konfigurasi sebelum reservasi slot upload.
2. `drive-backup-worker/index.js`: health menampilkan `missingGoogleDriveVariables`, identitas build, serta penjelasan bahwa konfigurasi lengkap belum berarti OAuth telah terverifikasi. Tidak menampilkan nilai secret.
3. `public/script.js`: panduan kriteria, penjelasan, cara pengujian dan evidence sesuai target/parameter/grade Pemda. Mengambil master yang sama, tidak mengarang kriteria baru. Perubahan pilihan memperbarui panduan. Pengguna baca/verifikasi boleh membaca pilihan tanpa diberi izin upload.
4. `public/index.html`: tempat panduan dan penegasan bahwa R2 + Google Drive wajib; status pending belum berarti upload lengkap.
5. `tools/test-drive-runtime-pemda-guidance.mjs`: uji perilaku runtime dan panduan.

Deploy **dua layanan**: Pages untuk website/API dan worker `kawal-spip-drive-backup` untuk consumer/cron. Perubahan handler saja dapat tidak memicu build worker bila Build Watch Paths hanya mencakup folder worker; sertakan `functions/**` atau jalankan deploy worker manual. Jangan mengubah nama D1/R2/Queue atau membuat resource baru.

Dari root repository:
```sh
npx wrangler deploy --config drive-backup-worker/wrangler.toml
```
Jika build root di dashboard memang `drive-backup-worker`, perintah deploy `npx wrangler deploy` menggunakan konfigurasi di folder tersebut. Pastikan checkout tetap mencakup `../functions/`, karena worker mengimpor handler dari situ.

## 3. Periksa runtime, lalu uji upload nyata

Buka alamat worker yang ada di dashboard dan tambahkan `/health` melalui address bar browser.
Hasil yang diharapkan setelah memasang patch:
```json
{
  "googleDriveConfigured": true,
  "missingGoogleDriveVariables": [],
  "googleDriveAuthenticationVerified": false,
  "build": "20261103-drive-runtime-diagnostics"
}
```
`googleDriveAuthenticationVerified:false` sengaja menunjukkan bahwa endpoint health hanya menguji kehadiran konfigurasi. Ini bukan hasil kegagalan OAuth. Jika `missingGoogleDriveVariables` masih berisi nama, perbaiki runtime pada worker/environment yang sedang dibuka. Jika build marker belum muncul, versi kode belum aktif.

Uji satu file kecil melalui website. Tunggu status `done` / R2 + Google Drive, lalu buka folder Google Drive dan pastikan file, ukuran, serta folder target benar. Kode upload yang sudah ada memeriksa ID, ukuran, dan parent file sebelum menyatakan sinkronisasi selesai; pemeriksaan ini dipertahankan. Jangan menyatakan berhasil hanya karena file ada di R2 atau health mengembalikan 200.

Jika setelah runtime lengkap muncul pesan baru:
- `invalid_grant`: periksa/generasikan ulang refresh token dari akun dan klien OAuth yang benar.
- `invalid_client`: cocokkan Client ID dan Client Secret.
- 403/izin: periksa izin akun OAuth terhadap folder dan scope Google Drive.
- folder tidak ditemukan: periksa ID folder dan akses akun OAuth.
Diagnosis lanjutan harus mengikuti pesan error aktual; empat kemungkinan ini bukan temuan yang sudah terbukti pada akun Anda.

## 4. File lama: tunggu retry atau percepat yang gagal karena konfigurasi

Kode memakai exponential backoff hingga sekitar 6 jam plus jitter. Setelah runtime benar, Cron satu menit akan menjadwalkan pekerjaan yang sudah jatuh tempo. Jangan hapus R2, tabel, atau upload ulang semua file karena dapat membuat duplikat.

Jika perlu mempercepat, setelah runtime sudah benar dan satu upload uji berhasil, buka D1 `kawal-spip-db` → Console. Periksa dulu:
```sql
SELECT upload_id, status, attempts,
       datetime(next_attempt_at / 1000, 'unixepoch') AS retry_utc,
       last_error
FROM drive_backup_jobs
WHERE status IN ('pending', 'retrying')
ORDER BY next_attempt_at;
```

Untuk menjadwalkan ulang hanya pekerjaan yang gagal karena pesan konfigurasi dan tidak sedang dikunci worker:
```sql
UPDATE drive_backup_jobs
SET next_attempt_at = CAST(strftime('%s','now') AS INTEGER) * 1000,
    dispatch_until = 0,
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE status IN ('pending','retrying')
  AND r2_ready = 1
  AND lease_until <= CAST(strftime('%s','now') AS INTEGER) * 1000
  AND last_error LIKE 'Konfigurasi Google Drive belum lengkap%';
```

Ini tidak menghapus file, tidak mengubah pekerjaan done dan tidak mengambil alih lease aktif. Tunggu Cron/Queue memproses, lalu periksa lagi status/error dan file di Drive. SQL ini disediakan untuk dijalankan oleh pengelola; belum dijalankan ke database produksi.

## 5. Panduan evidence Pemda dan OPD

Buka Evidence Pemda, pilih T2/T3/T4, subunsur, parameter dan grade A–E. Panel baru menampilkan kriteria, penjelasan, cara pengujian dan evidence yang disarankan untuk pilihan tersebut, sama sumbernya dengan OPD. Pemilihan grade tidak mencampur evidence target lain. OPD sudah memiliki kartu panduan dan dipertahankan. Jika master tidak menyediakan isi, aplikasi menyatakan belum tersedia, bukan mengisi persyaratan buatan.

## Validasi lokal dan batasan

Lulus:
- Parse ESM handler dan worker, serta sintaks browser script.
- Uji runtime lengkap/hilang/kosong/spasi; respons health 200/503; tidak membocorkan nilai kredensial.
- Render 700 kombinasi parameter/grade Pemda dari master bawaan (T2/T3/T4), fallback data kosong dan escaping HTML.
- 16 pemeriksaan regresi riwayat evidence Pemda.
- Pemeriksaan regresi SQL retry, race upload registry, dan UPSERT antrean durable.

Tidak diuji: deployment Cloudflare produksi, OAuth pengguna, izin folder produksi, tampilan browser end-to-end dan transfer file nyata. Dua video hanya membuktikan keadaan saat direkam, bukan keadaan dashboard saat ini.

Referensi resmi:
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/ (Build variables tidak tersedia saat runtime)
- https://developers.cloudflare.com/workers/configuration/secrets/ (pengaturan runtime secrets)
