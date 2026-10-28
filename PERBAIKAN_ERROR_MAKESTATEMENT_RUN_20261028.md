# Perbaikan Error `makeStatement(...).run is not a function` — Kawal SPIP

Tanggal: 28 Oktober 2026
Build: `20261028-template-update-d1-run-fix-v5`

## Ringkasan

Error muncul pada panel **Sumber Master Google Sheets → Perbarui ID / Link Template KK PM SPIP** ketika backend menyimpan ID master tervalidasi. Penyebabnya adalah kontrak helper D1 yang tidak konsisten: `runD1WithRetry` selalu memanggil `.run()` pada nilai yang dikembalikan callback, sementara beberapa callback sudah memanggil `.run()` dan mengembalikan Promise. Ketika helper memanggil `.run()` untuk kedua kali pada Promise tersebut, JavaScript melempar `makeStatement(...).run is not a function`.

## Perubahan

1. `runD1WithRetry` sekarang mendukung kedua bentuk secara defensif: callback mengembalikan `D1PreparedStatement` (helper menjalankan `.run()`), atau callback mengembalikan hasil/Promise yang sudah berjalan (helper langsung `await`). Kesalahan transient `busy`/`locked` tetap dicoba ulang dengan jitter.
2. Pemanggilan yang diketahui menjalankan `.run()` di dalam callback dibersihkan, termasuk saat menyimpan konfigurasi master, metadata workbook Pemda/OPD, penyimpanan perubahan KK PM, dan pembersihan registry evidence/LHE.
3. Penanda build dinaikkan menjadi `20261028-template-update-d1-run-fix-v5`, dan cache-buster `public/script.js` serta CSS di `public/index.html` diperbarui untuk mengurangi risiko browser menjalankan aset lama.
4. Jalur pembaruan massal tetap memuat seluruh OPD dari tabel `opd_data` untuk tahun aktif melalui `getKkPmWorkbookRefreshTargets`; frontend membatasi pembuatan/pembaruan workbook menjadi dua OPD paralel dan menampilkan hasil/gagal per OPD.

## Pemeriksaan akses serentak dari source

- Workbook Pemda menggunakan lease D1 per tahun dengan `owner_token` dan pemeriksaan versi sebelum tautan ditulis.
- Workbook OPD menggunakan lock D1 per kombinasi tahun dan OPD; sebelum menulis tautan, backend memeriksa kembali kepemilikan lease.
- Data KK PM di D1 diperbarui menggunakan fungsi JSON SQLite agar metadata workbook dan perubahan sel tidak saling menimpa secara kasar; sejumlah operasi evidence juga menggunakan pembanding versi/isi saat menulis atau menghapus.
- Penulisan D1 melalui `runD1WithRetry` mengulang kegagalan sementara seperti `busy`/`locked`.
- Pembaruan massal tidak meluncurkan semua OPD serentak: pool di frontend tetap 2, agar beban Google Drive/Sheets lebih terkendali.

Pengamanan tersebut menekan risiko duplikasi dan penimpaan pada jalur sinkronisasi, tetapi bukan jaminan absolut bahwa tidak ada kegagalan layanan eksternal. Load test produksi Google API/Cloudflare tidak dapat dijalankan dari lingkungan lokal ini. Jika beberapa orang memakai username aplikasi yang sama, audit aktivitas hanya akan mencatat username tersebut; akun individual lebih aman dan lebih mudah diaudit.

## Uji regresi

Jalankan dari root repository:

```bash
node tools/test_d1_retry_recovery.mjs
node --check functions/myCloudinaryHandler.js
node --check public/script.js
```

Tes memeriksa prepared statement normal, Promise dari `.run()` yang sudah dijalankan, retry transient lock, tidak mengulang error non-transient, jalur simpan konfigurasi master, query target semua OPD untuk tahun aktif, penanda build, serta tidak adanya `.run()` bertumpuk pada pemanggilan `runD1WithRetry`.

## Deployment dan pengecekan produksi

1. Commit source code hasil perbaikan ke branch GitHub yang benar-benar terhubung dengan Cloudflare Pages.
2. Pastikan deployment memuat `functions/myCloudinaryHandler.js`, `public/script.js`, dan `public/index.html` versi ini.
3. Setelah deployment, muat ulang dengan `Ctrl+F5` dan login kembali. Rekaman yang dilampirkan juga menampilkan `HTTP 401: Sesi login tidak ditemukan atau sudah berakhir`; itu terpisah dari error D1 dan memerlukan sesi login yang valid.
4. Di panel master, cek bahwa build backend menunjukkan `20261028-template-update-d1-run-fix-v5`, sumber aktif adalah `GOOGLE_SHEETS_PM_TEMPLATE_ID`, dan master tervalidasi.
5. Jalankan **Validasi ID & Perbarui Semua Workbook**. Hasil harus melaporkan workbook Pemda dan jumlah OPD yang berhasil/gagal. Pastikan Google OAuth dan `GOOGLE_DRIVE_FOLDER_ID` memiliki akses ke lokasi tujuan.

Jika penanda V5 tidak muncul, backend produksi belum menjalankan source ini. Jika penanda muncul tetapi ada error lain, salin pesan baru tersebut; masalahnya sudah bukan lagi jalur `.run()` ganda yang diperbaiki di sini.
