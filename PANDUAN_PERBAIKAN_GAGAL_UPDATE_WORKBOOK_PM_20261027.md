# Panduan Perbaikan Gagal Perbarui Workbook KK PM SPIP — 27 Oktober 2026

## Akar masalah yang terlihat pada rekaman

Saat tombol pembaruan ditekan, server menolak ID master sebelum pembaruan workbook dimulai. Pesan yang tampak adalah pemeriksaan 26 tab/nama/urutan dan formula inti tidak lolos. Pada tab yang tampak di rekaman, terdapat variasi nama seperti `KKE 2.3 SASSUBKES`, sedangkan nama kanonis manifest adalah `KKE 2.3 SASSUBKEG`. Pemeriksaan lama menganggap variasi tersebut tidak cocok dan memblokir pembaruan karena jumlah tab fisik harus tepat 26. Screenshot terbaru juga memperlihatkan empat tab inti dengan nama alias BP4D/Inspektorat serta dua tab pendukung tambahan.

Source terbaru:
- Menerima perubahan urutan tab karena urutan bukan identitas sheet.
- Menerima variasi nama yang dikenal dan dipetakan secara eksplisit: `KKE 2.3 SASSUBKES` → `KKE 2.3 SASSUBKEG`; `KK 5.1 A RPJMD (BP4D)` → `KK 5.1 A`; `KK 6 INSPEKTORAT` → `KK 6`; `KK 7 INSPEKTORAT` → `KK 7`; `KK 8 INSPEKTORAT` → `KK 8`; termasuk variasi PEMDA/OPD/BPKAD lainnya.
- Mewajibkan seluruh 26 tab inti PM tersedia tepat satu kali; urutan bebas dan tab tambahan (misalnya `CHECKLIST PK` dan `KK 4 INSPEKTORAT`) tidak menggagalkan validasi.
- Menjadikan tab tambahan sebagai informasi diagnostik, bukan alasan penolakan. Namun tab inti yang hilang/duplikat dan formula utama yang salah tetap diblokir. Alias nama tab juga digunakan oleh UI untuk menemukan `gid` saat pengguna membuka sheet dari dashboard.
- Memvalidasi salinan baru sebelum mengubah tautan aktif.

## Perilaku pembaruan yang diperbaiki

1. Hanya role `admin` (akun Pemda/Super Admin Daerah) dan `irban` yang dapat mengganti master global dan menjalankan pembaruan massal workbook Pemda + seluruh OPD untuk tahun yang sedang dipilih.
2. Satu operasi pembaruan memvalidasi master, membuat salinan baru dari master yang valid, menautkan workbook Pemda dan workbook OPD satu per satu di D1, serta menampilkan hasil per OPD.
3. Setelah tautan baru tersimpan, file Google Drive lama yang digantikan diubah namanya dengan awalan `ARSIP <timestamp> -`. File lama tidak dihapus permanen, sehingga masih dapat dipulihkan. ID master aktif maupun master sumber lama dilindungi agar tidak ikut diarsipkan.
4. Mirror XLSX ke R2 ditulis pada kunci stabil `kawal_spip/workbooks/pm_2026/<tahun>/<nama-organisasi>/current.xlsx`; manifest yang bersesuaian adalah `current.json`. PUT ke kunci yang sama mengganti mirror workbook sebelumnya. Berkas evidence tidak disentuh karena disimpan di namespace/kunci yang berbeda.
5. Kegagalan penggantian tautan, mirror R2, dan pengarsipan Drive dicatat terpisah. Kegagalan mirror R2 tidak membatalkan tautan Google Drive baru yang sudah disimpan, dan status akhir tidak diklaim sukses penuh bila ada kegagalan yang perlu ditindaklanjuti.
6. Pembaruan dipaksa membuat workbook baru meskipun ID/revisi master sama, agar seluruh workbook aktif benar-benar disegarkan dari sumber yang telah divalidasi.

## Cara memasang

1. Buat salinan/backup repository GitHub sebelum mengganti source.
2. Ekstrak ZIP perbaikan dan unggah seluruh isi source ke repository yang dipakai Cloudflare Pages.
3. Deploy ulang dari GitHub.
4. Pastikan Cloudflare memiliki binding D1 `DB`, binding R2 `EVIDENCE_BUCKET`, serta secrets OAuth yang telah dipakai aplikasi: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, dan `GOOGLE_DRIVE_FOLDER_ID`.
5. Login dengan akun Pemda (`admin`) atau Irban. Buka dashboard KK PM SPIP Pemda atau modal KK PM, masukkan ID/URL master:
   `1hLqUceQprwRxh1q5y0ZmW6PdI2-28H9mkYdA227vg1s`
6. Klik tombol pembaruan global dan setujui konfirmasi. Operasi ini berlaku untuk tahun aktif yang dipilih.
7. Tunggu sampai status merinci jumlah workbook OPD berhasil/gagal, mirror R2 berhasil/gagal, dan file Drive lama yang berhasil diarsipkan. Jika ada kegagalan, jalankan ulang setelah memperbaiki izin/koneksi untuk entitas yang dilaporkan.

## Batas validasi

Pengujian lokal/source code dapat dijalankan tanpa kredensial produksi. Pada sesi ini, Google Drive, D1 produksi, dan bucket R2 produksi tidak diubah langsung karena koneksi OAuth produksi tidak tersedia di lingkungan pengeditan. Perubahan nyata terjadi saat source hasil perbaikan dideploy dan pembaruan dijalankan di aplikasi menggunakan secrets/bindings Cloudflare Anda.
