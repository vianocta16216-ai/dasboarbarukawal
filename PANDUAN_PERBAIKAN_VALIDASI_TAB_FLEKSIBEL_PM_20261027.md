# Validasi master KK PM SPIP — 27 Oktober 2026

## Aturan source aktif

Gunakan ID master baru yang ditetapkan dalam `GOOGLE_SHEETS_PM_TEMPLATE_ID` di Cloudflare Pages. Nilai environment ini menjadi sumber utama di runtime; ID bootstrap lama pada D1 tidak akan menimpanya. Jangan menanam ID workbook lama secara manual ke frontend.

## Aturan validasi yang berlaku pada source ini

1. Master harus berupa Google Sheets asli yang dapat diakses akun OAuth Google.
2. Master harus memiliki 26 tab PM_2026 kanonis unik, setelah alias nama sheet yang memang didukung dinormalisasi. Urutan tab tidak harus identik, tetapi tab hilang, duplikat, tidak dikenal, atau jumlah tab fisik selain 26 ditolak.
3. Formula inti yang digunakan aplikasi pada `KKLEAD_SPIP!I11`, `I68`, `I85`, dan `I106` harus valid.
4. ID environment yang eksplisit tidak boleh diam-diam diganti dengan hasil pencarian Drive lain. Jika ID itu tidak dapat diakses atau gagal validasi, perbaiki ID/izin OAuth di Cloudflare sebelum mengulang sinkronisasi.
5. Workbook Pemda/OPD lama tidak dihapus permanen. Tautan baru hanya disimpan setelah salinan baru berhasil dibuat dan diverifikasi.

## Langkah pemulihan error 404

1. Periksa `GOOGLE_SHEETS_PM_TEMPLATE_ID` di **Cloudflare Pages → Settings → Variables and Secrets → Production**.
2. Pastikan ID tersebut adalah master baru, bukan ID workbook Pemda/OPD lama, dan beri akun Google pada `GOOGLE_DRIVE_REFRESH_TOKEN` akses baca/menyalin.
3. Deploy ulang setelah mengubah variable, kemudian buka dashboard dan periksa label **Sumber aktif**.
4. Tekan **Sinkronkan Master** untuk membuat ulang workbook Pemda dari master yang aktif. Untuk seluruh OPD, gunakan aksi pembaruan massal setelah workbook Pemda berhasil.

Lihat `PATCH_FIX_GOOGLE_SHEETS_PM_TEMPLATE_ID_20261027.md` dan `DEPLOYMENT_KK_PM_SPIP_EXACT.md` sebagai panduan operasional.
