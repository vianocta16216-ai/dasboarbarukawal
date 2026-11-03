# Perbaikan login, performa, dan pemetaan KAWAL SPIP — 4 November 2026

Paket ini memperbaiki kode pada `dasboarbarukawal-main (73)(1).zip`. Belum dideploy ke Cloudflare produksi. Pertahankan secrets, binding, database D1, bucket R2, Queue, dan data pengguna yang sudah ada.

## Temuan yang didukung kode dan rekaman

Rekaman 032251 memperlihatkan tombol “Memeriksa akun…” tertahan pada tampilan browser. Rekaman 025138 tidak tersedia untuk dibaca. Rekaman tidak memuat log Network/Functions yang cukup untuk memastikan penyebab tunggal pada server produksi.

1. Permintaan API frontend tidak memiliki deadline. Koneksi yang menggantung dapat membuat tombol login terus nonaktif.
2. Jalur login melewati migrasi skema aplikasi dan backfill historis. Penyiapan akun awal dapat menghitung hash untuk seluruh akun konfigurasi sebelum satu akun masuk.
3. Dashboard membaca JSON dan agregat seluruh OPD terlebih dahulu, baru menyaring akses di akhir. Ini memboroskan pembacaan dan pemrosesan pada akun dengan cakupan kecil.
4. Beberapa pemicu dapat memuat dashboard bersamaan. URL portal juga menjalankan inisialisasi kedua sebelum verifikasi sesi selesai. Pengulangan login dapat memasang listener dan timer autosave berulang.
5. Pages EventContext menyediakan `waitUntil` langsung; handler lama hanya membaca properti `ctx`. Pekerjaan latar belakang tidak selalu menerima lifecycle yang semestinya.
6. Refresh master menggunakan bypass cache setiap kali. Evidence/QA mengambil master PK, sedangkan permintaan terbaru menghendaki PM KK3.1–KK3.4. Snapshot kolom L lama juga diterapkan kembali setelah refresh.
7. Rekonsiliasi live membuat beberapa variant dengan evidenceKey yang sama; indeks `Map.set` hanya menyisakan target terakhir. Evidence yang dahulu digunakan bersama bisa kehilangan hubungan ke target sebelumnya.

## Perubahan

- Browser tanpa cookie dapat menampilkan login tanpa query D1. Login hanya menyiapkan tabel autentikasi, terpisah dari skema bisnis.
- Login menyiapkan akun bootstrap yang diminta saja. Password tetap memakai PBKDF2 100.000 iterasi; status nonaktif dan password hasil reset admin tidak ditimpa.
- Deadline autentikasi 20 detik, pembacaan data 30 detik, operasi tulis/upload 180 detik. **Ini batas tunggu, bukan janji login memerlukan 20 detik.** Operasi tulis yang timeout tidak otomatis dianggap gagal tersimpan.
- Error inisialisasi mengembalikan form login yang dapat dicoba lagi. Data gagal dimuat tidak lagi dilaporkan sebagai inisialisasi sukses. Respons dashboard dari akun/tahun lama tidak diterapkan.
- Pembacaan dashboard identik digabung ketika masih berjalan. Data OPD disaring sebelum JSON besar dibaca, lalu lima query ringkasan diproses dalam satu batch D1 dengan cakupan OPD pada SQL.
- Inisialisasi portal memakai alur sesi yang sama, timer autosave dipasang satu kali, polling tidak berjalan sebelum login, dan refresh realtime memakai jeda acak pendek.
- `waitUntil` mengikuti EventContext Pages. Pembersihan sesi kedaluwarsa dibatasi frekuensinya. API memberi header `Server-Timing` dan `private, no-store`.
- `_routes.json` membatasi pemanggilan Functions ke endpoint API dan realtime; aset publik dilayani sebagai aset statis. `_headers` mengatur revalidasi HTML/JS dan cache vendor.
- Evidence/QA mengambil master PM. Refresh otomatis menggunakan cache singkat server; tombol refresh eksplisit meminta sumber baru. Nilai kolom L live tidak ditimpa snapshot lama.
- Semua target pada evidenceKey bersama dipertahankan. Master kosong/parsial atau Grade A–E yang tidak lengkap tidak menimpa pemetaan terakhir yang valid.
- Tab **Pemetaan Evidence** menampilkan seluruh file unik, pencarian, target sumber, parameter, Grade, dan status pemetaan, maksimal 40 baris per halaman.
- Tombol **Perbarui Pemetaan 3.1–3.4** memperbarui metadata master tanpa menulis ulang file evidence atau penilaian yang tersimpan.

## Arti 181 dan jumlah parameter

Berkas uji bawaan ZIP menggunakan **514 file buatan**, dengan 181 file T1 dan sisanya T2 pada skenario tertentu. Itu bukan data produksi pengguna, dan bukan bukti bahwa 333 file produksi salah target. Tidak ada batas penarikan 181 yang ditemukan pada jalur tersebut.

Snapshot master dalam ZIP memuat:

| Sheet | Parameter |
| --- | ---: |
| KK3.1 / T1 | 43 |
| KK3.2 / T2 | 42 |
| KK3.3 / T3 | 43 |
| KK3.4 / T4 | 55 |
| Total lintas target | 183 |

**183 parameter berbeda dari jumlah file evidence.** Satu parameter/Grade dapat memiliki banyak file. Jumlah yang ditampilkan setelah refresh live mengikuti master yang berhasil dibaca, bukan dipaksa menjadi 181 atau 183.

Target akun tetap mengikuti aturan existing: OPD umum T1; BPKAD T1/T2/T3; Inspektorat T1/T4. Semua file sumber tetap tercatat pada tab Pemetaan Evidence. File yang betul-betul berada di luar target tidak otomatis dipindah atau diberi nilai pada target lain. Jumlah file produksi yang tepat baru dapat diverifikasi dengan data D1 dan master Google Sheets produksi.

## Cara memasang

1. Simpan commit/cadangan source produksi saat ini. Ekstrak ZIP ini dan gunakan isi folder `dasboarbarukawal-main` sebagai root proyek yang sama.
2. Perbarui repository yang terhubung ke Cloudflare Pages. Jangan hanya menyalin `public`: **`functions/myCloudinaryHandler.js` wajib ikut diperbarui**.
3. Pertahankan build/output proyek existing: folder output Pages adalah `public`, dengan folder `functions` di root. Tidak ada dependensi aplikasi baru atau kewajiban mengubah build command.
4. Pertahankan `wrangler.toml` dan semua binding yang sudah sesuai: DB, EVIDENCE_BUCKET, REALTIME, DRIVE_BACKUP_QUEUE. Jangan membuat database/bucket kosong pengganti.
5. Secrets autentikasi dan Google Drive/Sheets tetap dipasang pada environment Production, bukan hanya Preview. Patch tidak memerlukan password baru. Gunakan akun tersimpan yang sudah ada.
6. Deploy melalui integrasi repository Pages yang digunakan saat ini. Pastikan build Functions berhasil, deployment yang dibuka adalah deployment terbaru, dan `public/_routes.json` serta `_headers` ikut terunggah. Tidak perlu deploy ulang worker Drive/realtime hanya untuk patch ini; kodenya tidak diubah.
7. Jika menggunakan aturan “Cache Everything”, pastikan endpoint `/myCloudinaryHandler*` dan `/realtime*` tidak dicache. Jangan cache data pengguna atau respons login. Paket sudah memberi header no-store pada API, tetapi aturan paksa pada dashboard Cloudflare tetap perlu diperiksa.
8. Buka halaman sekali dengan Ctrl+F5. Pastikan URL script menggunakan `script.js?v=20261104-login-mapping-v2` pada Network browser.
9. Login admin terlebih dahulu untuk memeriksa dashboard dan membiarkan migrasi bisnis existing selesai bila marker skema belum tersedia. Migrasi pertama pada database lama tetap dapat memerlukan waktu; kini tidak menjadi bagian dari pemeriksaan password.
10. Uji dua browser/jendela privat, lalu akun OPD, BPKAD, dan Inspektorat. Buka QA APIP → **Pemetaan Evidence** → **Perbarui Pemetaan 3.1–3.4**. Periksa apakah status menyebut master PM live atau snapshot/fallback.

## Pemeriksaan setelah deploy

- Login valid berhasil; login salah menghasilkan pesan dan tombol kembali aktif. Keluar dari satu perangkat tidak mematikan sesi perangkat lainnya.
- Cek Network pada request login dan getData. Catat HTTP status, durasi, dan `Server-Timing`. Jika 503/1102/5xx muncul, cocokkan dengan log Functions pada waktu tersebut. Jangan mengirim password, cookie, atau token dalam tangkapan/log.
- Uji upload satu file per akun pada beberapa akun bersamaan. Pastikan hanya satu record per uploadId, file muncul di OPD yang benar, R2 terkonfirmasi, dan Queue menyelesaikan Google Drive.
- Uji simpan penilaian, ganti tahun/OPD, preview Word/Excel/PPT/PDF, ekspor QA, serta buka workbook. File viewer, worker Drive, mekanisme upload, dan rumus penilaian tidak diedit oleh patch ini.
- Pada tab Pemetaan Evidence, bandingkan total file unik dengan daftar Evidence Struktur & Proses OPD/tahun yang sama. Periksa item “metadata perlu diperiksa” atau “di luar target OPD ini” berdasarkan sumber aslinya; jangan mengubah target sekadar menyamakan angka.
- Ukur login dan dashboard dengan koneksi pengguna sebenarnya. Paket ini tidak menetapkan SLA atau menjamin nol lag pada semua kondisi jaringan/layanan Google.

## Hasil uji dan batasnya

Laporan rinci: `HASIL_UJI_LOGIN_PERFORMA_PEMETAAN_20261104.json`.

- Uji handler asli dengan WebCrypto dan SQLite lokal: browser tanpa cookie 0 query D1; penyiapan awal hanya 1 akun dari 40 konfigurasi; 40 login bersamaan berhasil; dua cookie sesi independen; logout satu sesi dan pencabutan akun diuji.
- Query dashboard diuji dengan SQLite: hanya OPD yang diizinkan dikembalikan; query ringkasan dibatasi berdasarkan OPD tersebut.
- Uji frontend VM: timeout dapat membatalkan permintaan; 40 pembacaan identik menjadi satu fetch; request sesudah timeout dapat berjalan kembali.
- Uji state UI memakai fixture DOM: dashboard gagal tidak mengunci tombol login, dan percobaan berikutnya dapat berhasil.
- Uji master: 43/42/43/55 parameter terjaga; 514 file simulasi pada key bersama tetap terhubung T1 setelah refresh; master parsial tidak menimpa master valid.
- Uji antrean existing: 100 klaim job berbeda, 25 perebutan upload yang sama dengan satu pemenang, retensi retry, idempotensi, dan pencegahan tabrakan uploadId antar-OPD lulus.
- Pemeriksaan existing yang sebelumnya lulus tetap lulus. Satu pemeriksaan ekspektasi refresh lama diperbarui agar menguji refresh otomatis bercache dan refresh manual eksplisit.
- **12 pemeriksaan bawaan sudah gagal pada ZIP sumber dan tetap gagal** (termasuk pencocokan versi build lama serta ekspektasi string preview/retry lama). Tidak disembunyikan atau dihapus; lihat nama dan hasilnya di laporan. Ini bukan klaim seluruh fitur telah lolos uji end-to-end.
- Belum menjalankan Chrome/Edge nyata, pengujian beban Cloudflare produksi, atau akses database/Google Drive produksi. Durasi lokal bukan angka kecepatan produksi. Tidak ada konfigurasi Cloudflare pengguna yang diubah langsung.

## Cloudflare berbayar

Workers Paid mencakup Pages Functions dengan biaya minimum US$5/bulan dan alokasi penggunaan; bukan jaminan latensi atau penggunaan tanpa biaya tambahan. Optimasi ini mengurangi pekerjaan pada jalur masuk, jumlah request serupa, dan pembacaan data lintas OPD tanpa mengganti layanan penyimpanan.

Referensi resmi yang diperiksa:

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/pages/functions/routing/
- https://developers.cloudflare.com/d1/best-practices/use-indexes/

## File perubahan

Produksi: `functions/myCloudinaryHandler.js`, `public/script.js`, `public/index.html`, `public/_routes.json`, `public/_headers`.

Pengujian: tiga file `tools/test-*-20261104.mjs` untuk login, frontend/mapping, UI state; pembaruan ekspektasi `tools/validate-inspektorat-20261014.mjs`. Laporan serta panduan ini ditambahkan. Daftar hash/perubahan ada pada `DAFTAR_PERUBAHAN_20261104.json`.

Untuk rollback kode, deploy ulang commit sebelumnya. Patch tidak menghapus database, file evidence, akun, atau penilaian historis. Jangan menghapus data D1/R2 saat rollback.
