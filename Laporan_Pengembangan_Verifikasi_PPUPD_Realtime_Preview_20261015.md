# Laporan Pengembangan Kawal SPIP — Verifikasi, Nilai Struktur & Proses, Preview, PPUPD, Realtime

Tanggal: 15 Oktober 2026

## Ringkasan perubahan

Paket ini melanjutkan kode proyek Kawal SPIP yang diterima, dengan perubahan terlokalisasi pada handler, UI, endpoint realtime, dan Durable Object. Tidak ada spreadsheet atau record produksi yang dihapus karena pekerjaan dilakukan terhadap salinan kode; integrasi nyata tetap membutuhkan deployment dan pengujian dengan Cloudflare/Google yang aktif.

### 1. Nilai Struktur dan Proses dihitung dari evidence terverifikasi

- Nilai tidak lagi diambil dari pilihan level mandiri pada `parameterLevels`.
- Status yang menyumbang nilai hanyalah `diterima` dan `diterima_catatan`; `dikembalikan`, menunggu, atau status kosong tidak menyumbang nilai.
- Jika parameter memiliki beberapa evidence, nilai parameter mengikuti level tertinggi yang status verifikasinya diterima.
- Satu `uploadId` yang tersimpan di JSON legacy dan tabel evidence terstruktur dinormalisasi menjadi satu keputusan. Keputusan terbaru menang; untuk keputusan terverifikasi digunakan `verification_at`, sehingga perubahan housekeeping/backup pada `updated_at` tidak menghidupkan kembali status lama. Status kosong yang dibuat saat mengganti file tetap dihitung sebagai reset.
- API `getData` sekarang mengirim breakdown dan nilai terverifikasi sebagai sumber resmi bagi UI. UI tidak lagi menimpa nilai server dengan level pilihan operator.
- Status Struktur & Proses ditampilkan berdasar jumlah parameter yang benar-benar diverifikasi, bukan hanya jumlah file/grup yang diunggah.
- Setelah penghapusan/penggantian evidence, nilai dihitung ulang. Setelah pemulihan backup, nilai juga dihitung ulang setelah bukti-bukti dipulihkan agar skor mandiri lama tidak kembali menjadi nilai berjalan.
- Optimistic compare-and-swap memakai fingerprint yang mencakup keputusan verifikasi, timestamp keputusan, timestamp pembaruan, jalur storage, dan nama file agar perubahan operator lain tidak tertimpa oleh proses kalkulasi yang berjalan bersamaan.

### 2. Hak verifikasi Auditor, Irban, dan PPUPD

- UI dan backend secara eksplisit mengenali `admin`, `auditor`, `ppupd`, dan `irban` untuk verifikasi Evidence Struktur dan Proses.
- `PPUPD_ALLOWED_ACTIONS` disamakan dengan izin Auditor; pengamanan cakupan OPD tetap diterapkan oleh server.
- Formulir pengelolaan akun menyediakan role PPUPD.
- Akun Auditor/PPUPD tidak memperoleh hak finalisasi nilai resmi BPKP atau pengelolaan akun hanya karena diberi hak verifikasi.
- Jika verifikasi masih mendapat `403` setelah deployment, periksa role aktif di D1 (`auth_users`) serta cakupan OPD akun tersebut. Perubahan UI saja tidak dapat mengubah role produksi yang tersimpan.

### 3. Login operator/verifikator pada beberapa perangkat

- Sesi disimpan sebagai token hash per perangkat/operator; login baru tidak mengganti sesi perangkat lain.
- Penyimpanan field subunsur menggunakan pembaruan JSON parsial atomik agar pengisian parameter berbeda tidak menimpa seluruh JSON OPD.
- Jalur legacy yang masih mengirim seluruh JSON memakai compare-and-swap dan konflik akan menghasilkan peringatan, bukan diam-diam menghapus edit terbaru.
- Upload, verifikasi, ganti, hapus, dan sinkronisasi skor mengirim event perubahan untuk disegarkan oleh klien lain.

### 4. Realtime dengan pembatasan cakupan OPD

Pemeriksaan menemukan bahwa kanal realtime lama menolak seluruh akun bercakupan OPD, sehingga akun terbatas tidak mendapat notifikasi langsung. Sekarang:

1. `functions/realtime.js` memverifikasi token sesi dengan menggabungkan `auth_sessions` dan `auth_users` yang aktif.
2. Nama/ID OPD yang menjadi cakupan akun diubah menjadi ID OPD yang berlaku untuk tahun yang dipilih.
3. Pages Function hanya meneruskan metadata cakupan tepercaya ke Durable Object dan tidak meneruskan cookie sesi.
4. Durable Object memfilter setiap event berdasarkan tahun dan ID OPD yang ditempelkan pada koneksi; koneksi terbatas tidak menerima event OPD lain.
5. Event tanpa `opdId` hanya disampaikan ke koneksi dengan cakupan penuh.

**Penting:** deploy `functions/realtime.js` dan `realtime-worker/realtime.js` secara bersamaan. Pages dan Worker harus memakai versi protokol cakupan yang sama. Worker terpisah berada pada root proyek `realtime-worker` dan dapat dideploy dengan `npx wrangler deploy` dari folder itu.

### 5. Preview file di browser

- PDF, foto/gambar, video, audio, dan teks pasif dipreview lewat endpoint privat dan object URL browser; teks/HTML/SVG diperlakukan sebagai teks atau konten pasif, bukan dieksekusi sebagai aplikasi.
- Word, Excel, PowerPoint, dan OpenDocument memakai viewer pihak ketiga dengan URL bertanda tangan yang kedaluwarsa dalam 10 menit.
- Tab Preview dan Detail file tersedia; object URL dibersihkan saat preview ditutup atau file diganti.
- Viewer eksternal diberi pemberitahuan bahwa layanan pihak ketiga menerima tautan file sementara. Jangan menggunakan viewer eksternal untuk dokumen rahasia yang kebijakan instansinya melarang pemrosesan pihak ketiga.
- Tidak ada browser preview universal untuk setiap format arbitrer (misalnya berkas executable/arsip khusus). Format yang tidak didukung ditampilkan sebagai placeholder aman alih-alih dieksekusi otomatis atau diunduh oleh fitur preview.

### 6. Hierarki folder evidence

Upload workbook sekarang disimpan dengan pola:

`kawal_spip/<tahun>/<OPD>/Evidence Struktur dan Proses/<Unsur>/<Sub Unsur>/<Parameter>/<T1-T4>/<Level_Grade>/<uploadId>-<nama-file>`

Target ditentukan dari `targetCode` dan diperiksa terhadap OPD/tahun oleh server. Jalur upload legacy kini juga memakai folder `Evidence Struktur dan Proses/Unsur/Sub Unsur/Parameter/Level`; folder target hanya dimasukkan bila target T1-T4 secara eksplisit dikirim dan lolos validasi server. Untuk menghindari salah label, sistem tidak menebak target untuk OPD yang punya beberapa target.

File lama di Google Drive/R2 tidak dipindahkan atau dihapus otomatis. Perubahan hierarki berlaku untuk upload baru; migrasi file lama memerlukan tugas migrasi terpisah agar tautan, bukti audit, dan riwayat tetap dapat dipulihkan.

## Pengujian lokal

Semua pemeriksaan yang dijalankan lulus:

- `node --check`: backend utama, Pages realtime, UI, dan Durable Object realtime.
- `validate-inspektorat-20261014.mjs`: 60 pemeriksaan.
- `validate-pm-template-resolution.mjs`: 23 pemeriksaan.
- `validate-spip-integration.mjs`: 11 pemeriksaan.
- `validate-verification-roles-score.mjs`: 9 assertion.
- `validate-workbook-concurrency.mjs`: 37 pemeriksaan.
- `validate-workbook-rollover-lhe-years.mjs`: 17 pemeriksaan.
- `validate-evidence-score-preview-ppupd.mjs`: 17 pemeriksaan statis serta dua skenario kalkulasi skor fungsional.
- `validate-realtime-scope-isolation.mjs`: 14 pemeriksaan.

Total hitungan yang dilaporkan suite adalah 188 pemeriksaan/assertion, ditambah dua skenario kalkulasi skor. Ini bukan uji beban produksi; uji serentak nyata perlu dilakukan sesudah deployment terhadap D1, R2, dan Google Drive aktif.

## Deployment dan verifikasi produksi

1. Terapkan semua perubahan pada Pages Functions, `public/script.js`, dan `public/index.html` pada branch yang dideploy ke Cloudflare Pages.
2. Deploy Worker terpisah dari folder `realtime-worker`. Pastikan binding `REALTIME` pada Pages menunjuk ke Durable Object Worker yang baru.
3. Pastikan migration/schema D1 telah berjalan melalui alur aplikasi seperti biasa dan credentials Google Drive/R2 masih benar.
4. Buat/aktifkan akun PPUPD melalui pengelolaan akun admin dengan cakupan OPD yang sesuai. Atau tambahkan konfigurasi role `ppupd` ke secret `KAWAL_SPIP_USERS_JSON` menggunakan password baru yang unik, bukan password pada file yang diunggah.
5. Uji dengan dua browser untuk OPD yang sama: ubah parameter, upload, verifikasi, ganti, dan hapus bukti; pastikan perubahan dan skor muncul di kedua sesi. Kemudian lakukan tes dengan dua OPD berbeda dan pastikan akun terbatas tidak menerima notifikasi OPD lain.
6. Uji preview PDF/gambar secara lokal, lalu Word/Excel/PowerPoint dengan viewer eksternal dan periksa tautan 10 menit serta pesan privasi.
7. Jika verifikasi menampilkan `403`, simpan waktu, role, action, kode respons, dan ID OPD untuk audit; jangan tempel password atau cookie sesi ke laporan.

## Catatan keamanan kredensial

Lampiran XLSX/JSON pengguna berisi username dan password dalam bentuk teks biasa. Demi keamanan, paket kode ini **tidak memasukkan** file kredensial tersebut. Anggap seluruh password yang ada di file itu telah terekspos: reset/ganti semua password, perbarui secret `KAWAL_SPIP_USERS_JSON` pada Cloudflare, dan cabut sesi dengan mekanisme reset password/disable-enable akun. Jangan masukkan file kredensial mentah ke repositori publik, Pages assets, atau ZIP distribusi.

## Batasan yang belum dapat dibuktikan dari lingkungan lokal

Belum ada akses ke akun produksi Cloudflare, D1, R2, Google Drive, dan WebSocket deployment pengguna untuk membuktikan operasi langsung atau menjalankan stress test pada beban produksi. Karena itu, status file ini adalah **kode telah divalidasi secara lokal dan siap diuji saat deployment**, bukan klaim bahwa deployment produksi sudah berhasil.
