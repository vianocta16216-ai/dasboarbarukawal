# Panduan Sinkronisasi Workbook KK PM SPIP — Source Guard v4

> Panduan ini menggantikan versi sebelumnya yang menetapkan master 26 tab. Master terbaru dari pengguna berisi 28 tab; ikuti `README_PERBAIKAN_MASTER_28_SHEET_SOURCE_GUARD_V4_20261027.md` dan `DEPLOYMENT_KK_PM_SPIP_EXACT.md`.

## Alur operasional

1. Deploy seluruh repository dengan source guard v4 ke branch produksi Cloudflare Pages.
2. Pastikan `GOOGLE_SHEETS_PM_TEMPLATE_ID` di Cloudflare Production menunjuk ke master Google Sheets baru yang sama dengan yang diinginkan. Berkas `.xlsx` harus dikonversi menjadi Google Sheets terlebih dahulu.
3. Pastikan kredensial OAuth memiliki akses membaca master dan menyalin workbook ke `GOOGLE_DRIVE_FOLDER_ID`.
4. Login sebagai Super Admin/Pemda atau Irban, buka KK PM SPIP Pemda lalu tekan **Muat Ulang**.
5. Periksa panel master. Harus tampak ID aktif, sumber `cloudflare-environment`, jumlah/nama sheet aktual, diagnosis validasi, dan build backend `20261027-pm-master-source-guard-v4`.
6. Bila build tidak tampak, berhenti di sini dan benahi deployment Pages Function. Jangan menekan pembaruan massal saat backend lama masih melayani API.
7. Bila master valid, tekan **Sinkronkan Master**. Server membaca kembali variable, memeriksa seluruh sheet/formula, memastikan ID yang dikirim sama dengan ID efektif, lalu membuat salinan baru untuk Pemda. Workbook lama tetap menjadi riwayat pemulihan.
8. Setelah workbook Pemda berhasil dicek, tekan **Validasi ID & Perbarui Semua Workbook** apabila semua workbook OPD tahun aktif juga perlu disalin ulang dari master baru.

## Mengapa versi v4 berbeda

- Daftar 28 sheet pengguna diterima; sheet tambahan berikutnya tidak ditolak karena jumlahnya berbeda dari 26.
- Alias inti termasuk `KK 5.1 A RPJMD (BP4D)` dan `KK 6/7/8 INSPEKTORAT` dikenali tanpa mengubah nama fisik.
- Tombol sinkronisasi tidak beroperasi menggunakan state lama di browser: ia meminta konfigurasi baru, memeriksa codeVersion dan validasi master, serta mengirim `expectedTemplateSpreadsheetId` ke backend.
- Backend menolak sinkron jika ID prasyarat berbeda dari sumber yang sedang digunakan. Respons juga memuat ID sumber aktual dan versi backend untuk diagnosis.

## Batas verifikasi

Uji lokal tidak mengakses OAuth, D1, R2, atau Cloudflare Production. Status akhir harus diverifikasi di panel live setelah commit/deploy dan satu sinkronisasi uji Pemda berhasil.
