# Pembaruan KAWAL SPIP — 5 November 2026

Paket ini dibuat dari `dasboarbarukawal-main (5).zip` yang dilampirkan. Bukan deploy ke website produksi. Struktur folder repository dipertahankan.

## File GitHub yang wajib diganti

| File | Perubahan |
|---|---|
| `functions/myCloudinaryHandler.js` | Sesi per tab, endpoint enam workbook risiko, SK Satgas, integrasi evidence lintas tahun |
| `public/script.js` | Pengiriman sesi tab, kolom baru, masa berlaku, modal unggah SK |
| `public/index.html` | Urutan judul kolom dan pemuatan script tambahan |
| `drive-backup-worker/index.js` | Pemrosesan otomatis salinan lintas tahun melalui jadwal Worker |

## File GitHub yang wajib ditambahkan

- `functions/_lib/spip-extensions.js`
- `public/spip-extensions.js`
- `public/risk-templates/strategic-pa.xlsx`
- `public/risk-templates/tactical-kpa.xlsx`
- `public/risk-templates/operational-pptk.xlsx`
- `public/risk-templates/fraud.xlsx`

Tiga file `tools/test-*-20261105.mjs`, panduan ini, dan `HASIL_UJI_PEMBARUAN_20261105.txt` adalah berkas pemeriksaan/dokumentasi. Tidak diperlukan untuk menampilkan website, tetapi sebaiknya ikut disimpan di repository. Jangan menyalin folder `dasboarbarukawal-main` sebagai subfolder baru pada root repository; salin ISINYA menurut path di atas.

## Urutan pemasangan

1. Simpan commit/cadangan versi aktif. Upload sepuluh file wajib di atas dalam satu commit agar frontend dan backend serasi. Jangan hanya mengganti `script.js`.
2. Tunggu build/deploy Cloudflare Pages berhasil. Output direktori tetap `public`; jangan mengubah konfigurasi atau secret Google Drive/R2 yang sudah bekerja.
3. Deploy ulang Worker antrean yang terpisah dari Pages menggunakan konfigurasi Worker yang sudah ada: dari folder `drive-backup-worker`, jalankan `npx wrangler deploy`. Perubahan Pages saja tidak memperbarui Worker ini.
4. Pertahankan binding `DB`, `EVIDENCE_BUCKET`, `DRIVE_BACKUP_QUEUE`, konfigurasi OAuth Google, dan cron Worker yang sudah ada. Pages dan Worker harus memakai database dan bucket yang sama.
5. Buka website, login ulang, lalu periksa satu OPD sebelum melanjutkan seluruh akun. Tabel/kolom tambahan dibuat otomatis secara aditif. Tidak perlu menjalankan SQL DROP atau mengganti database.

## Perilaku sesi login

Cookie saja tidak lagi cukup untuk memulihkan dashboard. Login memberikan token sesi yang disimpan di `sessionStorage` tab dan dikirim pada API melalui header. Membuka URL sebagai navigasi baru memerlukan login ulang; refresh pada tab yang masih aktif mempertahankan sesi. Kembali dari back-forward cache memicu pemeriksaan login ulang. Tombol Keluar mencabut sesi terkait di server.

Tidak menggunakan permintaan logout saat `unload`, karena pengiriman saat tab ditutup tidak dapat diandalkan. Penutupan tab tidak menghapus baris sesi server seketika; baris tersebut tetap tunduk pada batas waktu server. Cookie untuk unduhan/pratinjau dan realtime yang sudah ada dipertahankan agar fitur tersebut tetap berfungsi. Ini bukan janji pencabutan seketika seluruh tautan pratinjau saat tab ditutup.

## Evidence Struktur dan Proses lintas tahun

Pada setiap area unggahan level/grade terdapat pilihan **Berlaku sampai tahun**. Default hanya tahun aktif. Untuk 2026–2030 pilih 2030 sebelum memilih file. Batas lima tahun menghitung tahun awal.

- KK3.1/T1 untuk OPD umum; KK3.2/T2 dan KK3.3/T3 mengikuti kewenangan BPKAD; KK3.4/T4 mengikuti kewenangan Inspektorat. Pembatasan target yang sudah ada tetap dipakai.
- Salinan mempertahankan unsur, subunsur, parameter, evidence key, target, grade, dan level. Level wajib sesuai grade.
- File sumber disimpan di R2; rencana penyalinan disimpan di D1. Proses langsung dicoba di latar belakang dan cron Worker memulihkan pekerjaan yang belum selesai.
- Tahun tujuan dan baris OPD dibuat bila belum ada. Bila OPD dengan nama yang sama sudah ada, ID tahun tujuan dipakai. ID bagian Setda tetap mengikuti pola khusus Setda.
- Akun yang memakai daftar ID OPD eksplisit menerima ID tahun tujuan untuk OPD yang sama. Batas nama OPD tidak diubah. Tidak memberikan akses ke OPD lain.
- Setiap tahun mempunyai objek R2 dan pekerjaan Google Drive tersendiri mengikuti folder evidence yang sudah digunakan. File tidak dinyatakan tersimpan di Google Drive sebelum proses antrean memverifikasinya.
- Status periode tampil pada file sumber; status sinkronisasi Drive setiap salinan terlihat di tahun masing-masing. Saat status periode menyebut salinan R2 tersedia, antrean Drive bisa masih berjalan.
- Nilai/verifikasi/QA tahun sumber tidak disalin. Tahun tujuan tetap harus ditelaah. Tahun yang sudah dikunci untuk input akan menunda penyalinan dan menampilkan alasan.
- Berlaku untuk unggahan baru melalui Evidence Struktur dan Proses OPD, termasuk akun yang membuka OPD dalam cakupannya. Unggahan Pemda khusus pada menu terpisah `KK PM SPIP Pemda` tidak diubah oleh paket ini.
- File lama tidak diberi periode secara sepihak. Untuk menjadikannya lintas tahun, unggah dengan periode yang dipilih. Menghapus/mengganti satu salinan tidak menghapus/mengganti seluruh tahun sekaligus; masing-masing tetap mempunyai riwayat sendiri.

## Enam kertas kerja risiko

Urutan setelah Laporan Hasil PM SPIP: **SK Satgas SPIP → RR Strategic PA → Fraud Strategic PA → RR Tactical KPA Program → Fraud Tactical KPA Program → RR Operasional PPTK → Fraud Operasional PPTK → KK RTP**.

Semua role yang terdaftar dapat membuka/membuat workbook ini untuk OPD dalam cakupannya. Setiap kombinasi OPD, tahun, dan jenis mempunyai workbook tersendiri. Klik tombol pada kolom, pilih **Buat Spreadsheet**, lalu **Buka Spreadsheet**. Pembuatan dilakukan saat diperlukan agar dashboard tidak memuat enam workbook untuk setiap OPD sekaligus. Klik ulang memakai workbook yang sama; lease database menahan pembuatan bersamaan.

Keempat Excel asli disertakan tanpa perubahan byte. Ketiga workbook fraud menggunakan template fraud yang sama, dengan identitas PA/KPA/PPTK berbeda. Template tactical asli berisi sheet strategic tambahan; sheet tersebut tetap dipertahankan, bukan dibuang. Identitas OPD/tahun pada sheet utama dan label pejabat disesuaikan pada workbook Google. Data contoh pada template tetap merupakan contoh, bukan data nyata OPD.

Google Drive mengimpor Excel menjadi Google Spreadsheet. Keutuhan file Excel sumber sudah diperiksa, tetapi kesetaraan tampilan/rumus setelah konversi Google belum diverifikasi pada akun produksi. Periksa sheet, sel gabungan, dropdown, rumus, dan cetak pada workbook pertama. Tombol unduh template asli tersedia. R2 menyimpan template sumber saat pembuatan; ini bukan sinkronisasi otomatis setiap edit Google Spreadsheet ke R2.

## SK Satgas SPIP

Satu file per OPD per tahun, maksimal 10 MB sesuai batas unggahan yang sudah ada. Tidak menimpa diam-diam: hapus/batalkan file sebelumnya sebelum unggah pengganti. Pembatasan juga ditegakkan di server untuk permintaan bersamaan.

Google Drive: folder root yang dikonfigurasi → **Nama OPD → SK SATGAS SPIP-Nama OPD**.

R2: **kawal_spip/Nama OPD/SK SATGAS SPIP-Nama OPD/uploadId-nama-file**.

Kategori folder SK tidak berada di dalam `Laporan SPIP` dan tidak menambahkan folder tahun, sesuai permintaan. Tampilan dan slot tetap mengikuti tahun dashboard. Unggahan masuk R2 terlebih dahulu, kemudian antrean Google Drive yang sudah digunakan. Hapus slot unggahan yang belum selesai melalui modal jika ingin mengganti file.

## Pemeriksaan setelah deploy

- Login, tutup tab, buka URL lagi: form login muncul. Refresh tab aktif tetap berfungsi.
- Periksa OPD biasa, BPKAD, Inspektorat, dan bagian Setda: akses serta target yang tampil sesuai akun.
- Unggah satu evidence kecil 2026–2030. Pastikan file muncul pada kelima tahun, parameter/level sama, dan hasil verifikasi tahun berikutnya kosong.
- Periksa objek R2 dan folder Drive tahun tujuan; tunggu status Drive selesai. Bila tertunda, cek log Worker dan kolom error pekerjaan periode/antrean.
- Buat enam workbook pada satu OPD. Pastikan ID berbeda per jenis; klik ulang tidak menambah workbook baru. Periksa format terhadap template asli.
- Unggah satu SK, ulangi request/file kedua, lalu hapus dan unggah pengganti. Pastikan hanya satu slot aktif dan folder sesuai OPD.
- Coba pratinjau Word/Excel/PPT/PDF, KK RTP, QA, dan laporan lama.

## Cakupan pengujian lokal

Uji menjalankan handler asli dan SQL SQLite untuk sesi/scope/SK, serta modul penyalinan/workbook dengan layanan R2/Queue/Google tiruan. Termasuk 40 login bersamaan, satu permintaan dashboard untuk 40 pemanggilan identik, pemulihan kegagalan antrean, salinan empat tahun berikutnya, dan 20 perebutan slot SK.

Dua validator lama (`validate-dual-storage-contract.mjs` dan `validate-evidence-ui-preview-fast-upload.mjs`) gagal pada asumsi statis yang sama ketika dijalankan terhadap ZIP asli sebelum perubahan. Temuan ini dicatat dan tidak diklaim lulus. Pengujian frontend lama yang mengekstrak fungsi tanpa helper sesi diganti untuk pemeriksaan ini dengan `test-frontend-extensions-20261105.mjs`; file tes lama tidak diubah.

Browser headless lokal tidak dapat diluncurkan karena pembatasan socket lingkungan. Verifikasi frontend dilakukan pada sintaks, markup, dan VM, bukan pengujian visual browser. Tidak dilakukan benchmark Cloudflare atau unggahan nyata ke Drive/R2 produksi. Tidak ada jaminan seluruh fitur produksi bebas regresi sebelum checklist di atas dilakukan.
