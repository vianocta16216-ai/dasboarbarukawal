# Panduan Master PM dan Evidence Pemda — Source Guard v4

> **Pembaruan:** Panduan versi lama mewajibkan 26 tab dan sudah tidak berlaku untuk master baru. Gunakan validasi dinamis 28 sheet dan langkah deploy v4 di dokumen ini.

## Prinsip sumber master

- `GOOGLE_SHEETS_PM_TEMPLATE_ID` adalah sumber utama jika terisi.
- Inventaris ditarik dari metadata Google Sheets langsung; nama/urutan tab fisik dipertahankan.
- Dua puluh delapan tab pada `KK_PM_Evaluasi_SPIP_Pemda_RPJMD_2026_REVISI_SASARAN.xlsx` dikenali. Nama yang berubah untuk RPJMD dan Inspektorat tidak dianggap tab asing, dan tab tambahan di masa depan juga boleh ada.
- Formula inti `KKLEAD_SPIP!I11`, `I68`, `I85`, dan `I106` tetap diperiksa.

## Tombol dashboard

**Muat Ulang** memuat ulang status workbook yang tertaut dan membaca kembali ID master efektif. **Sinkronkan Master** hanya bekerja bila API melaporkan build `20261027-pm-master-source-guard-v4`, sumber `cloudflare-environment`, dan master lolos validasi. Backend memastikan ID prasyarat sama dengan master aktif sebelum menyalin workbook. **Validasi ID & Perbarui Semua Workbook** menerapkan ID tervalidasi yang sama ke salinan Pemda serta workbook OPD untuk tahun aktif.

## Cara deploy

1. Backup repo dan konfigurasi produksi.
2. Commit seluruh source dari ZIP v4 ke branch yang terhubung ke Pages.
3. Periksa variable `GOOGLE_SHEETS_PM_TEMPLATE_ID` pada Cloudflare **Production**. Pastikan nilainya adalah ID Google Sheets native master baru, bukan workbook Pemda/OPD atau file XLSX mentah.
4. Pastikan `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, dan `GOOGLE_DRIVE_FOLDER_ID` memiliki nilai yang benar serta OAuth dapat membaca dan menyalin master.
5. Setelah deploy sukses, tekan `Ctrl+F5`, buka dashboard Pemda, lalu **Muat Ulang**. Verifikasi build, sumber, ID, jumlah sheet, serta status validasi.
6. Sinkronkan workbook Pemda lebih dahulu. Jalankan pembaruan massal OPD hanya setelah hasil Pemda benar.

## Perlindungan data

Workbook baru disalin dan diverifikasi sebelum pointer D1 disimpan. Workbook Drive lama tidak dihapus permanen; referensinya tetap tersedia untuk pemulihan. Evidence R2 tidak dihapus oleh perubahan master. Jika mirror R2 atau pengarsipan Drive gagal, status peringatan dilaporkan terpisah dari status workbook Google Sheets.
