# Deployment KK PM SPIP — Master 26 Sheet dan Link Rollover

## Master PM aktif

Provisioning Kertas Kerja **PM_2026** memakai Google Sheets yang berasal dari sumber bernama:

`KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313`

Nama di Drive boleh memiliki ekstensi impor `.xlsx` atau suffix duplikat Google Drive seperti `(1)`. Beberapa suffix rilis eksplisit seperti `- BARU` juga dapat dideteksi. Master yang dipakai harus lolos validasi struktur PM_2026: seluruh 26 tab inti wajib tersedia tepat satu kali; urutan bebas dan tab tambahan diperbolehkan. Variasi nama resmi seperti `KKE 2.3 SASSUBKES`, `KK 5.1 A RPJMD (BP4D)`, `KK 6 INSPEKTORAT`, `KK 7 INSPEKTORAT`, dan `KK 8 INSPEKTORAT` dikenali sebagai alias. Formula inti `KKLEAD_SPIP!I11`, `KKLEAD_SPIP!I68`, `KKLEAD_SPIP!I85`, `KKLEAD_SPIP!I106`.

**Penting:** jumlah 28 tab tidak otomatis berarti salah. Rilis PM dengan 26 tab inti + tab ekstra dan alias BP4D/Inspektorat dapat dipakai setelah formula inti tervalidasi. Workbook PK/legacy 28 tab dengan nama lama persis tetap dikenali sebagai legacy dan tidak diterima sebagai master PM aktif.

## Variabel Cloudflare yang wajib

- `GOOGLE_SHEETS_PM_TEMPLATE_ID`: ID Google Sheets master PM terbaru (bukan URL workbook OPD, bukan file `.xlsx` yang belum diimpor sebagai Google Sheets).
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_FOLDER_ID`

Akun Google yang terhubung melalui OAuth harus dapat membaca master dan membuat salinan di folder output. Kalau nama file master yang sebenarnya tidak termasuk nama dasar/suffix yang didukung, `GOOGLE_SHEETS_PM_TEMPLATE_ID` harus diatur ke ID Google Sheets yang tepat. ID privat tidak bisa ditebak dari kode.

## Cara kerja tautan OPD

- Setiap pasangan **OPD + Tahun Anggaran** memiliki workbook kerja tersendiri, disalin dari satu master. Jangan arahkan seluruh OPD ke file kerja yang sama karena perubahan satu OPD bisa mencampuri data OPD lain.
- Saat workbook PM dibuka atau disinkronkan, aplikasi memeriksa referensi di D1, memastikan file masih bisa diakses, memvalidasi profil, dan membandingkan ID/revisi master.
- Jika link lama sudah dihapus atau bukan berasal dari master terbaru, sinkronisasi membuat salinan baru lalu memperbarui pointer di D1. Link lama disimpan di `kk_pm_data.workbookHistory`; file Drive lama tidak otomatis dihapus.
- Migrasi dilakukan per OPD/tahun ketika digunakan, bukan dengan membuat semua salinan sekaligus saat deploy. Ini menghindari lonjakan API quota dan duplikasi workbook. Semua OPD akan beralih ketika link tiap OPD/tahun dibuka/disinkronkan setelah versi baru aktif.
- Dua sesi yang mencoba menyinkronkan OPD/tahun yang sama dilindungi lock D1. Sesi kedua akan mencoba ulang sesuai petunjuk lock; perubahan cell tetap digabung secara atomik.

## Tahun Tindak Lanjut LHE SPIP

- Tahun target tindak lanjut mengikuti Tahun Anggaran aktif yang dipilih pada aplikasi; input tahun target read-only dan diperbarui saat pilihan tahun berubah.
- `source_year` tetap menyimpan tahun asli laporan sumber (contoh data historis 2025 atau 2024). Itu bukan tahun target tindak lanjut dan tidak boleh diganti hanya agar terlihat seperti tahun berjalan.
- Tanggal tenggat yang diusulkan dari templat diproyeksikan ke tahun target ketika tahun pada tanggal template sesuai dengan tahun sumber atau tahun setelahnya. Tanggal yang sudah diedit manual tidak otomatis ditimpa.
- API `getYears` menambahkan tahun kalender sekarang jika belum ada; penyimpanan LHE tidak lagi membatasi tahun sumber hanya ke 2024/2025.

## Deployment

1. Ganti/merge **seluruh proyek** dari ZIP perbaikan ke repositori Pages yang benar, lalu commit/push atau jalankan cara deploy resmi proyek. Jangan hanya mengunggah ZIP sebagai file statis ke website.
2. Tunggu deployment Cloudflare Pages sukses. Periksa bahwa `public/index.html`, `public/script.js`, dan `functions/myCloudinaryHandler.js` berasal dari revisi yang sama.
3. Di Production Variables & Secrets, validasi semua variabel Google di atas, terutama `GOOGLE_SHEETS_PM_TEMPLATE_ID`.
4. Login sebagai Inspektorat dan buka workbook satu OPD percobaan. Pastikan halaman membuka ID workbook baru, nama tab 26 benar, dan master formula lolos validasi. Ulangi untuk akun OPD lain. Akses OPD yang berbeda akan memiliki salinan berbeda.
5. Uji dua browser/session untuk OPD/tahun sama, kemudian uji upload dan verifikasi. Lock sync mengurangi duplikasi workbook; pengujian produksi tetap perlu untuk memastikan kredensial, kuota Google dan konfigurasi Pages benar.

## Batas pengujian

Pemeriksaan lokal memvalidasi sintaks, JSON, resolver master dengan Google API mock, penggabungan metadata D1, link rollover, tahun LHE, serta beberapa aturan akses/konkurensi. Paket lokal tidak memiliki secret atau akses produksi; karena itu tidak mengklaim bahwa file Google Drive privat sudah ditemukan/dipindahkan di server aktif.
