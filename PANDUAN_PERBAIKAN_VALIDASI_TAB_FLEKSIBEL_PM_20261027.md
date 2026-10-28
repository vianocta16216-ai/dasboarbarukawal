# Validasi Master KK PM SPIP — Dinamis, Semua Sheet, 27 Oktober 2026

> **Pembaruan pengganti:** Dokumen ini memperbarui panduan validasi lama yang mengunci jumlah tab pada 26. Master yang diberikan memiliki 28 sheet. Jangan gunakan batas 26 tab lama untuk deployment terbaru.

## Aturan terbaru

1. `GOOGLE_SHEETS_PM_TEMPLATE_ID` di Cloudflare Production adalah sumber utama jika terisi; ID D1 hanya fallback.
2. Backend membaca metadata sheet langsung dari ID aktif dan meneruskan daftar sheet aktual ke dashboard.
3. Seluruh 28 tab pada `KK_PM_Evaluasi_SPIP_Pemda_RPJMD_2026_REVISI_SASARAN.xlsx` dikenali, termasuk `CHECKLIST PK`, `KK 4 INSPEKTORAT`, `KK 5.1 A RPJMD (BP4D)`, serta `KK 6/7/8 INSPEKTORAT`.
4. Nama/urutan fisik sheet tidak diubah oleh validasi. Alias digunakan untuk mencocokkan tab inti saja. Sheet tambahan ke depan diizinkan dan dipertahankan.
5. Tab inti yang wajib tetap harus ada dan tidak boleh duplikat secara kanonis. Formula inti `KKLEAD_SPIP!I11`, `I68`, `I85`, dan `I106` tetap divalidasi.
6. Jika `GOOGLE_SHEETS_PM_TEMPLATE_ID` eksplisit salah atau tidak dapat diakses, aplikasi tidak mencari dan memilih sumber Drive lain secara diam-diam.

## Validasi alur UI/backend

- **Muat Ulang** mengirim `forceRefresh` ke `/myCloudinaryHandler` dan meminta konfigurasi/inventory master lagi.
- **Sinkronkan Master** terlebih dahulu memastikan versi backend `20261027-pm-master-source-guard-v4`, `source=cloudflare-environment`, dan `masterValidationOk=true`.
- Proses pembuatan workbook menerima `expectedTemplateSpreadsheetId`. Backend membandingkan ID prasyarat dengan ID efektif yang dibaca dari `GOOGLE_SHEETS_PM_TEMPLATE_ID`; apabila berbeda, penyalinan dihentikan.
- Pembaruan massal mengirim prasyarat ID yang sama ke workbook Pemda dan setiap OPD agar sumbernya konsisten.

## Jika website masih menunjukkan batas 26

Periksa teks **Build backend** dalam panel master. Jika versi tidak ada atau berbeda, Pages Function yang melayani endpoint belum dideploy dari source terbaru atau front-end dan backend berasal dari deployment berbeda. Commit seluruh proyek ke branch yang dipakai Cloudflare Pages, cek deployment berhasil, lalu tekan `Ctrl+F5` dan **Muat Ulang**. Jangan jalankan pembaruan massal sampai versi terbaru muncul dan master tervalidasi.
