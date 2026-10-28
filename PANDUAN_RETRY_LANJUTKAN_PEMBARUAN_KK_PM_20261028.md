# Fitur Retry / Lanjutkan Pembaruan KK PM SPIP — V8

## Tujuan
Menambahkan tombol **Retry / Lanjutkan Pembaruan** untuk melanjutkan pembaruan workbook Pemda dan seluruh OPD ketika proses terhenti atau sebagian gagal, terutama akibat kuota Google Sheets API `429 RESOURCE_EXHAUSTED`.

## Yang dilakukan
- Status proses disimpan pada browser dengan `localStorage`, mencakup tahun anggaran, ID master, status workbook Pemda, daftar ID OPD yang masih tertunda, dan pesan error terakhir.
- Setelah setiap batch maksimal dua OPD selesai, daftar tertunda diperbarui. OPD yang berhasil dan tidak memiliki error mirror/arsip dikeluarkan dari antrean; OPD gagal tetap masuk antrean.
- Jika Google Sheets mengembalikan 429, proses berhenti setelah batch saat ini. OPD yang belum diproses tetap tertunda untuk Retry.
- Retry hanya memproses ID OPD yang tersimpan sebagai tertunda. Workbook Pemda hanya dicoba ulang jika status Pemda masih tertunda.
- ID master diverifikasi sebelum Retry. Jika ID master berubah, Retry ditolak untuk mencegah pembaruan dari sumber yang salah.
- Request tetap membawa `resumeIfCurrentMaster:true`, sehingga backend dapat menggunakan kembali workbook yang sudah sesuai dengan revisi master dan menghindari salinan ganda.
- Tombol tersedia di panel **Sumber Master Google Sheets** dan panel admin KK PM SPIP. Hanya akun `admin` dan `irban` yang dapat menggunakannya.

## Cara menggunakan
1. Unggah source code V8 ke repository GitHub yang terhubung dengan Cloudflare Pages.
2. Commit dan deploy ke branch Production yang benar.
3. Pastikan binding D1 `DB`, variabel `GOOGLE_SHEETS_PM_TEMPLATE_ID`, serta akses akun OAuth Google tetap benar.
4. Muat ulang website dengan `Ctrl + F5`, lalu login kembali menggunakan akun Pemda/Irban.
5. Mulai pembaruan seperti biasa dari **Validasi ID & Perbarui Semua Workbook** atau **Perbarui Workbook Pemda + Semua OPD**.
6. Jika proses gagal sebagian, jangan mulai pembaruan penuh berulang-ulang. Jika muncul 429, tunggu sekitar 60 detik atau sampai kuota pulih, lalu tekan **Retry / Lanjutkan Pembaruan**.
7. Baca ringkasan akhir. Jika masih ada workbook tertunda, tekan Retry lagi setelah penyebab error diperbaiki.

## Pengamanan dan batasan
- Retry menyimpan status pada browser/perangkat yang memulai proses. Gunakan browser dan perangkat yang sama untuk melanjutkan. Jika data situs/browser dihapus, status lokal dapat hilang.
- Retry menolak berjalan jika ID master yang aktif berbeda dari master saat proses tertunda. Untuk mulai dari master baru, periksa dan validasi ID baru lalu jalankan pembaruan penuh yang baru.
- Jangan menekan tombol pembaruan penuh berulang kali saat request masih berjalan. Tombol dinonaktifkan selama proses di tab yang sama; backend tetap memakai lock workbook untuk membatasi konflik antarproses.
- Implementasi mengurangi pengulangan dan meneruskan item yang gagal, tetapi tidak dapat menjamin Google Sheets tidak pernah memberi 429 jika kuota digunakan oleh aplikasi lain.
- ZIP ini memperbarui source code saja. Perbaikan baru aktif di website setelah deployment Cloudflare Pages selesai. Uji produksi tetap perlu dilakukan dengan akses Google/Cloudflare yang sebenarnya.
