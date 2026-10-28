> **CATATAN VERSI:** Dokumen ini adalah panduan lama untuk migrasi workbook; ketentuan 26 tab pada bagian master telah digantikan oleh validasi dinamis 28 sheet di `README_PERBAIKAN_MASTER_28_SHEET_SOURCE_GUARD_V4_20261027.md`.

# Laporan Perbaikan Menyeluruh Kawal SPIP

**Tanggal:** 15 Oktober 2026  
**Ruang lingkup:** Sinkronisasi workbook PM Google Sheets, pemutakhiran tautan yang sudah usang/terhapus, operasi multi-akun, dan tahun tindak lanjut LHE SPIP.

## Temuan dari rekaman

Rekaman menampilkan URL Google Sheets yang berisi ID workbook yang sudah dihapus. Itu berarti pointer workbook lama tersimpan pada data aplikasi; memuat ulang browser saja tidak akan memperbaiki masalah. Rekaman LHE juga menunjukkan isi penjelasan yang menyebut tahun sumber lama meskipun Tahun Anggaran aktif aplikasi 2026.

## Perubahan

1. **Tombol buka selalu memvalidasi link server.** Baca ulang `getKkPmSheets` dengan cache dinonaktifkan. Jika workbook tertaut hilang, profil salah, atau sumber/revisi tidak lagi sama dengan master aktif, jalankan sinkronisasi sebelum membuka. Jika pengecekan gagal, URL lama tidak dibuka.
2. **Pemilihan master lebih ketat.** Cari master bernama `KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313` atau suffix rilis eksplisit yang didukung. Catatan pada versi lama ini mensyaratkan 26 tab. Aturan tersebut telah diganti: master PM aktif memakai inventory dinamis yang saat ini berisi 28 sheet; lihat `DEPLOYMENT_KK_PM_SPIP_EXACT.md`. Backup yang hanya memiliki awalan nama sama tidak akan digunakan. Apabila file master bernama lain atau tidak terlihat bagi OAuth, ID `GOOGLE_SHEETS_PM_TEMPLATE_ID` harus ditetapkan secara eksplisit.
3. **Pointer dan histori ditulis atomik.** Link terbaru dicatat pada `kk_pm_data.workbook`; pointer lama ditaruh pada `workbookHistory`. Cell sparse PM yang ada tetap dipertahankan pada D1 dan file Google Drive lama tidak dihapus.
4. **Satu workbook kerja per OPD/tahun.** Workbook untuk setiap OPD disalin dari master; seluruh OPD tidak menggunakan file kerja bersama. Lock D1 mencegah dua sesi membuat dua copy untuk OPD/tahun yang sama. Sesi kedua melakukan retry ketika menerima lock conflict.
5. **Simpan sel dan hasil formula terlindungi.** Patch mempertahankan penggabungan perubahan cell secara atomik dan menolak pembaruan hasil hitung yang berasal dari ID workbook yang tidak lagi menjadi tautan aktif.
6. **LHE menggunakan tahun target dinamis.** Target tindak lanjut mengikuti Tahun Anggaran yang dipilih di aplikasi; input tahun target read-only, teks modal diperbarui saat tahun berganti, dan tanggal usulan template dipetakan ke target year selama tanggal belum diedit manual. `source_year` tetap menunjukkan tahun laporan sumber yang asli (misalnya 2025 atau 2024), dan ditampilkan terpisah dari `Tahun TL`. Data historis tidak diam-diam diubah menjadi tahun berjalan.
7. **Daftar Tahun Anggaran:** API selalu menambahkan tahun kalender berjalan jika belum ada, dan default pembuatan record baru tidak hardcoded ke 2026.

## Hasil validasi lokal

| Pemeriksaan | Hasil |
|---|---:|
| Sintaks `.js` / `.mjs` | Lulus semua file |
| Parsing JSON | 13 file lulus |
| Resolver master PM | 23 pemeriksaan lulus |
| Lock/akses/sinkronisasi serentak | 37 pemeriksaan lulus |
| Hak akses, rollover, LHE dan tahun dinamis | 60 pemeriksaan lulus |
| Integrasi SPIP/RPJMD | 11 pemeriksaan lulus |
| Rollover pointer, preservation metadata dan LHE | 17 pemeriksaan lulus |

Hasil di atas membuktikan pemeriksaan kode dan simulasi lokal lulus. Hasil ini **bukan** bukti tes beban produksi, karena akses Cloudflare D1, OAuth Google, Google Sheets, serta akun live tidak tersedia dari sesi kerja ini.

## Langkah pemasangan

1. Terapkan semua berkas di ZIP ke repositori proyek Cloudflare Pages yang benar, lalu jalankan deployment baru. Jangan hanya mengunggah ZIP sebagai aset statis.
2. Di Production Variables & Secrets, pastikan `GOOGLE_SHEETS_PM_TEMPLATE_ID` menunjuk ID Google Sheets master PM terbaru. Nama master yang benar-benar berbeda dari pola di atas perlu ID eksplisit.
3. Pastikan `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, dan `GOOGLE_DRIVE_FOLDER_ID` benar; akun OAuth mempunyai izin membaca master serta membuat salinan.
4. Setelah deployment sukses, uji satu OPD Inspektorat. Pilih tahun yang sesuai, buka PM, lalu klik Buka Spreadsheet atau Sinkronkan Workbook. Pastikan Google membuka ID yang baru dan tabnya sesuai PM_2026.
5. Ulangi pada OPD umum lain. Kemudian uji dua sesi di OPD/tahun yang sama dan berbeda, termasuk upload serta verifikasi. Link OPD/tahun diganti ketika dibuka/disinkronkan; tidak semua salinan baru dibuat sekaligus saat deployment.
6. Pastikan layar LHE menunjukkan `Tahun Anggaran tindak lanjut: <tahun aktif>` dan daftar memisahkan `Tahun TL` dari `Sumber LHE`.

## Batasan penting

Perubahan kode sudah tersedia di ZIP, tetapi deployment ke situs Anda belum dilakukan dari sini. Saya juga tidak bisa mengidentifikasi ID privat master terbaru selain melalui nama/konfigurasi yang tersedia. Jika resolver tidak menemukan file PM terbaru, pesan error akan meminta ID master yang tepat alih-alih beralih diam-diam ke workbook PK/legacy. Tidak ada Google Sheets lama yang dihapus oleh patch ini.
