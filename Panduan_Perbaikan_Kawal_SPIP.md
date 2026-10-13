# Panduan Perbaikan Kawal SPIP: Akun per OPD, LHE, Verifikasi Berjenjang, dan Cloudflare

Dokumen ini menjelaskan perubahan pada paket aplikasi dan langkah yang masih perlu dilakukan di Cloudflare sebelum perubahan tersedia di alamat produksi. Perubahan kode yang sudah dibuat **belum otomatis terpasang di situs produksi** sampai ZIP/commit ini dideploy.

## 1. Permintaan Ibu Irban yang diterapkan

1. **Akun dibatasi sesuai penugasan.** Login menggunakan username, password, dan role yang diverifikasi di server. Akun operator `opd` harus terikat ke satu OPD—tidak boleh memakai wildcard `*`. Respons API juga difilter berdasarkan cakupan akses; mengganti ID OPD pada permintaan tidak seharusnya membuka data OPD lain.
2. **Alur verifikasi berjenjang.** Auditor mengirim evidence (`Dikirim`) → Irban memilih `Diterima` atau `Dikembalikan` → BPKP baru dapat melakukan verifikasi akhir jika Irban telah menerima. Catatan wajib jika file dikembalikan. Perubahan di tahap sebelumnya membatalkan keputusan tahap setelahnya. Riwayat tindakan dicatat.
3. **Tindak lanjut LHE SPIP dan RTP terdahulu.** Ditambahkan formulir tindak lanjut berdasarkan sumber Renaksi 2025 dan TL 2024 yang belum tuntas. Kolom yang disimpan meliputi sumber tahun, referensi rekomendasi, rekomendasi, rencana aksi, indikator, bukti dukung yang diperlukan, PIC, tenggat, realisasi aktual, status pelaksanaan, berkas bukti, dan status verifikasi.
4. **Pemisahan status.** Status dari workbook sumber ditampilkan sebagai catatan referensi, bukan dianggap sebagai status terkini yang telah diverifikasi. Realisasi aktual dimulai kosong saat membuat tindak lanjut baru. Status pelaksanaan terpisah dari status verifikasi evidence.
5. **Bukti tidak mengandalkan URL publik R2.** API mengembalikan URL unduhan privat yang memeriksa sesi, OPD, dan ID berkas sebelum mengirim file. Penghapusan/retry menggunakan identitas upload dan kunci penyimpanan yang tersimpan di server.
6. **Kolom Bukti Dukung yang Diperlukan** sekarang masuk formulir, disimpan di database, dan muncul pada ringkasan butir tindak lanjut.

## 2. Variabel yang perlu ditambahkan atau diperiksa

Buka **Cloudflare Dashboard → Workers & Pages → project Pages Kawal SPIP → Settings → Variables and Secrets → Production**. Nama variabel harus cocok persis; beberapa nama di tangkapan layar tampak terpotong karena lebar kolom, jadi buka tombol edit untuk memeriksa nama lengkapnya. Simpan password, token, refresh token, dan JSON akun sebagai **Secret**, bukan di kode sumber.

| Nama persis | Status | Tipe yang disarankan | Kegunaan dan catatan |
|---|---|---|---|
| `KAWAL_SPIP_USERS_JSON` | **BARU — tambahkan** | **Secret** | Daftar akun dan role untuk login. Ini variabel baru yang belum terlihat pada daftar di screenshot. Nilainya harus berupa array JSON valid; contoh aman ada di `KAWAL_SPIP_USERS_JSON.example.json`. Ganti semua placeholder dan gunakan password unik minimal 16 karakter untuk setiap akun. |
| `ACCESS_PASSWORD` | Pertahankan | Secret | Kompatibilitas login lama saja. Begitu `KAWAL_SPIP_USERS_JSON` berisi akun, password bersama ini tidak dipakai sebagai login utama. Jangan menjadikannya password semua OPD. |
| `DELETE_PASSWORD` | Pertahankan/periksa | Secret | Konfirmasi aksi hapus lama yang memang menggunakan password penghapusan. Gunakan password terpisah dari password login dan BPKP. |
| `BPKP_ADMIN_PASSWORD` | **Wajib untuk fitur nilai resmi BPKP** | Secret | Dipakai oleh endpoint draft/finalisasi/buka kunci nilai resmi dan audit. Kode mensyaratkan sedikitnya 12 karakter; gunakan minimal 16 karakter unik. Akun `bpkp` dari JSON tidak menggantikan secret ini untuk fitur nilai resmi. |
| `GOOGLE_DRIVE_CLIENT_ID` | Pertahankan/periksa | Secret atau text | ID OAuth Client Google yang digunakan integrasi. Nama harus persis. |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Wajib jika upload/backup Google Drive digunakan | Secret | Secret OAuth client. |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Wajib jika upload/backup Google Drive digunakan | **Secret** | Nama lengkap yang dibaca kode. Pastikan variabel yang tampak terpotong di Cloudflare benar-benar bernama `GOOGLE_DRIVE_REFRESH_TOKEN`. Token harus belum dicabut/kedaluwarsa dan memiliki izin Drive yang sesuai. |
| `GOOGLE_DRIVE_FOLDER_ID` | Wajib jika upload/backup Google Drive digunakan | Secret atau text | ID folder induk Drive untuk penyimpanan bukti. Akun OAuth harus memiliki akses ke folder ini. |
| `GOOGLE_SHEETS_TEMPLATE_ID` | Pertahankan bila sudah digunakan | Secret atau text | ID spreadsheet master/template lama untuk integrasi PK sebagai fallback. Jangan hapus jika konfigurasi lama masih bergantung padanya. |
| `GOOGLE_SHEETS_RTP_TEMPLATE_ID` | Pertahankan/periksa | Secret atau text | ID template spreadsheet RTP. Diperlukan untuk fitur yang membuat/menghubungkan workbook RTP. |
| `GOOGLE_SHEETS_PM_TEMPLATE_ID` | **Periksa untuk KK PM SPIP** | Secret atau text | ID template/master KK PM SPIP. Nama harus persis. Fitur live master dan propagasi PM bergantung padanya. Pastikan sheet template cocok dengan spesifikasi pada `DEPLOYMENT_KK_PM_SPIP_EXACT.md`. |
| `GOOGLE_SHEETS_PK_MASTER_ID` | Opsional | Secret atau text | ID master PK live yang diutamakan jika tersedia. Jika kosong, kode mencoba `GOOGLE_SHEETS_PK_TEMPLATE_ID`, lalu `GOOGLE_SHEETS_TEMPLATE_ID`, atau memakai snapshot bawaan. |
| `GOOGLE_SHEETS_PK_TEMPLATE_ID` | Opsional | Secret atau text | Alias/fallback ID template PK. Tidak perlu menambahkannya jika master PK yang dipakai sudah ditentukan dengan benar melalui salah satu nama fallback di atas. |
| `GOOGLE_SHEETS_PM_AUTO_PROPAGATE` | Opsional | Plain text | `true` mengizinkan propagasi perubahan master PM (default kode jika variabel kosong); `false` menonaktifkan propagasi otomatis. Pilih sesuai kebijakan pengelolaan template. |
| `KK_MASTER_SYNC_SECRET` | Wajib hanya jika endpoint sinkronisasi master manual dipakai | **Secret** | Token rahasia untuk sinkronisasi master. Kode menolak token kosong/kurang dari 32 karakter. Gunakan token acak minimal 32 karakter; jangan gunakan password login. |

### Contoh format `KAWAL_SPIP_USERS_JSON`

File contoh di paket ini berisi struktur JSON, bukan kredensial produksi. Anda perlu membuat daftar nyata berdasarkan nama OPD pada aplikasi. **Jangan menempelkan placeholder apa adanya** dan jangan mengunggah password produksi ke GitHub.

- `role`: hanya `admin`, `auditor`, `opd`, `irban`, atau `bpkp`.
- Akun `opd`: isi `opdName` dengan nama OPD persis seperti yang tampil di dashboard, atau gunakan `opdId` stabil yang benar. Sediakan satu akun per OPD jika memang ingin memisahkan akses.
- Akun `auditor`: isi `opdNames` atau `opdIds` sesuai penugasan jika auditor tidak boleh melihat seluruh OPD. Jika dua field cakupan tersebut tidak diisi, role auditor/Irban/BPKP dapat memiliki cakupan luas sesuai aturan kode.
- `admin`, `irban`, dan `bpkp` pada contoh tidak diberi batas OPD karena umumnya melakukan pengawasan lintas OPD. Jika kebijakan organisasi berbeda, tetapkan cakupan secara eksplisit.
- Jangan gunakan `*` untuk akun `opd`. `opdName` harus menunjuk satu OPD, bukan nama kelompok atau semua OPD.
- Setiap username harus unik (tidak peka huruf besar-kecil), tiap password harus berbeda, dan akun yang tidak dipakai dapat dinonaktifkan dengan `"enabled": false`.

### Environment variables bukan Bindings

Tangkapan layar juga menunjukkan bagian **Bindings**. Pastikan tiga binding ini tetap ada di **Production** (dan Preview jika lingkungan Preview akan diuji):

| Binding | Jenis dan target yang harus cocok |
|---|---|
| `DB` | D1 Database `kawal-spip-db` (di `wrangler.toml`, ID `46bfc2a4-e13a-40b7-b21d-89642702a3a8`) |
| `EVIDENCE_BUCKET` | R2 bucket `kawal-spip-files` |
| `REALTIME` | Durable Object `RealtimeHub` dari Worker `kawal-spip-realtime` |

Ketiganya **bukan** environment variable teks yang perlu ditambah. Pastikan nama binding sama persis dengan kode. Deploy Worker realtime dari direktori `realtime-worker` bila Worker tersebut belum di-publish; binding Pages menunjuk Worker produksi yang benar.

### Apa yang tidak perlu ditambahkan sebagai environment variable?

- Tidak perlu variabel khusus untuk daftar 40 templat LHE: file `public/lhe-followup-templates.json` disajikan bersama aplikasi.
- Tidak perlu variabel baru untuk tabel sesi, tabel alur verifikasi, maupun tabel tindak lanjut LHE. API membuat/migrasikan tabel D1 secara otomatis saat request pertama setelah deploy.
- Password masing-masing OPD tidak dibuat sebagai variabel terpisah; taruh akun tersebut di secret `KAWAL_SPIP_USERS_JSON`.
- Nama file, ID upload, status verifikasi, dan isi formulir bukan environment variable.

## 3. Langkah pemasangan yang jelas

1. **Cadangkan dahulu.** Buat backup D1, salin nilai konfigurasi Cloudflare yang ada ke pengelola rahasia yang aman, dan jangan menyalin nilai rahasia ke dokumen atau chat.
2. **Atur akun.** Buka `KAWAL_SPIP_USERS_JSON.example.json`, duplikasi strukturnya lalu sesuaikan username, password unik, role, serta cakupan OPD. Tempel seluruh isi JSON sebagai nilai Secret `KAWAL_SPIP_USERS_JSON` di Production. Jangan menempelkan file contoh mentah sebelum mengganti semua placeholder.
3. **Periksa integrasi yang sudah ada.** Jangan hapus `GOOGLE_DRIVE_*`, `GOOGLE_SHEETS_*`, `BPKP_ADMIN_PASSWORD`, `DELETE_PASSWORD`, atau `KK_MASTER_SYNC_SECRET` yang masih digunakan. Cek nama lengkap setiap variabel yang terpotong di UI. Uji apakah folder Drive dan spreadsheet dapat diakses akun OAuth.
4. **Periksa bindings.** Pastikan `DB`, `EVIDENCE_BUCKET`, dan `REALTIME` ditautkan dengan target yang benar. Pastikan D1 yang dipakai oleh Production adalah database produksi, bukan database uji.
5. **Deploy kode ini.** Commit/push folder proyek ke branch GitHub yang terhubung ke Cloudflare Pages, atau gunakan alur deployment yang dipakai tim. Pastikan folder output Pages tetap `public`, sedangkan folder `functions` berada di root proyek dan ikut dideploy. Tunggu deployment berstatus sukses.
6. **Jalankan tes pertama.** Setelah deployment, login sebagai admin. Request pertama akan membuat tabel sesi, audit verifikasi, dan LHE serta menambah kolom `evidence_required` pada database lama secara kompatibel. Jika log mengeluarkan kesalahan D1, hentikan pengujian, periksa log deployment, dan pulihkan backup jika perlu.
7. **Uji LHE.** Buka satu OPD, masuk ke “Tindak Lanjut LHE SPIP”, pilih template 2025 atau 2024, verifikasi kolom rekomendasi/rencana/indikator/bukti yang diperlukan/PIC/tenggat, lalu simpan. Realisasi aktual harus diisi berdasarkan kondisi yang benar-benar terjadi. Upload bukti dan pastikan status backup Drive jelas.
8. **Uji verifikasi berjenjang.** Login sebagai Auditor lalu kirim evidence. Login sebagai Irban dan terima/kembalikan dengan catatan. Coba sebagai BPKP sebelum Irban menerima—permintaan harus ditolak. Setelah Irban menerima, BPKP bisa melakukan verifikasi akhir. Ubah file/rencana aksi setelah disetujui dan pastikan verifikasi lama tidak tetap dianggap berlaku.
9. **Tutup akses publik R2.** Setelah berhasil memverifikasi alur unduh melalui aplikasi, nonaktifkan public development URL/akses publik `r2.dev` untuk bucket bukti `kawal-spip-files`. Sebelum menonaktifkan, pastikan tidak ada lagi alur yang bergantung pada tautan publik. Tautan Google Drive yang pernah dibagikan secara publik harus dibatasi terpisah di Google Drive; proteksi aplikasi tidak otomatis mengubah izin file Drive.

## 4. Uji penerimaan setelah deploy

- Login tanpa sesi menampilkan layar login; logout menghapus sesi.
- Admin dapat melihat daftar OPD dan menu pengelolaan.
- Akun `opd` hanya melihat OPD yang dipasangkan; coba akses ID OPD lain melalui URL/API harus menghasilkan penolakan.
- Akun Auditor dengan `opdNames`/`opdIds` hanya dapat melihat cakupan yang diberikan.
- Template menampilkan **26 rekomendasi 2025 + 14 tindak lanjut 2024 = 40 item**.
- Mengambil template tidak menyalin `sourceActualAction` sebagai realisasi baru dan tidak menganggap `sourceStatus` sebagai hasil verifikasi terbaru.
- Field “Bukti dukung yang diperlukan” tersimpan setelah refresh.
- File bukti dapat diakses ketika sesi berhak masuk, dan tidak dapat diakses oleh pengguna tanpa sesi atau dari OPD berbeda.
- BPKP tidak dapat memverifikasi final sebelum Auditor mengirim dan Irban menerima.
- Pengembalian bukti mewajibkan catatan; perubahan tahap sebelumnya membatalkan persetujuan downstream.
- Upload yang gagal tersinkron ke Google Drive tetap menunjukkan bahwa file tersimpan di R2 tetapi backup Drive perlu diperiksa/retry.
- Uji laporan PM, RTP, dan workbook existing untuk memastikan link bukti masih dapat dibuka melalui endpoint privat.

## 5. Batas verifikasi paket ini

Pemeriksaan yang telah dilakukan pada sumber mencakup validasi sintaks JavaScript, validasi JSON template, hitungan jumlah templat, dan pencarian URL host R2 publik yang ditulis langsung pada kode. Integrasi nyata dengan D1/R2/Google Drive dan login produksi tetap harus dites setelah deployment karena kredensial, izin layanan, serta database berjalan di akun Cloudflare/Google milik organisasi.
