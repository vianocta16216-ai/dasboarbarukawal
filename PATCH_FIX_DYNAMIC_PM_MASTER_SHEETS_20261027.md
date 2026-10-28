> **CATATAN VERSI:** Patch ini adalah tahap sebelumnya. Gunakan `PATCH_FIX_PM_MASTER_SOURCE_BINDING_V4_20261027.md` untuk penguncian ID sumber, versi backend, serta prasyarat ID pada tombol sinkronisasi.

# Perbaikan Sinkronisasi Semua Sheet Master KK PM SPIP — 27 Oktober 2026

## Masalah yang diperbaiki

Master spreadsheet terbaru `KK_PM_Evaluasi_SPIP_Pemda_RPJMD_2026_REVISI_SASARAN.xlsx` memiliki 28 sheet. Validasi lama memaksa susunan tepat 26 sheet, sehingga master ditolak walau nama tab mencerminkan perubahan terbaru (misalnya `CHECKLIST PK`, `KK 4 INSPEKTORAT`, `KK 5.1 A RPJMD (BP4D)`, dan tab khusus Inspektorat untuk KK 6–8).

## Perubahan utama

- Sinkronisasi memakai metadata sheet aktual yang dibaca dari spreadsheet master dan tidak lagi menolak master hanya karena memiliki lebih dari 26 sheet.
- Daftar sheet inti dipakai untuk memeriksa tab kerja/formula wajib. Tab tambahan yang ada pada spreadsheet master diizinkan dan dipertahankan.
- Alias nama tab menyelaraskan nama baru dengan kunci semantik lama, misalnya `KK 5.1 A RPJMD (BP4D)` dan `KK 6 INSPEKTORAT`.
- Manifest penuh dan manifest KK PM diperbarui dari workbook yang dilampirkan pengguna dengan 28 nama sheet beserta urutannya.
- Dashboard menampilkan jumlah sheet berdasarkan workbook aktif, bukan angka tetap 26.
- Cache-buster file JavaScript dan manifest diperbarui agar browser tidak memakai versi kode lama.
- Prioritas `GOOGLE_SHEETS_PM_TEMPLATE_ID` dari konfigurasi environment Cloudflare tetap dipertahankan di atas nilai bootstrap D1.

## Sheet dalam master yang diuji

1. FAQ
2. DAFTAR KK
3. NAMA OPD
4. CHECKLIST PK
5. KKLEAD_SPIP
6. KKLEAD I_PEMDA
7. KKE 1.1 SASTRA PEMDA (BP4D)
8. KKE 1.2 SASTRA OPD
9. KKE 2.1 SASPRO OPD
10. KKE 2.2 SASKEG OPD
11. KKE 2.3 SASSUBKEG OPD
12. KKLEAD II
13. KK3.1 OPD
14. KK3.2 BPKAD AKUN
15. KK3.3 BPKAD ASET
16. KK3.4 (INSPEKTORAT)
17. KK 4 INSPEKTORAT
18. KKLEAD III
19. KK 5.1 A RPJMD (BP4D)
20. KK 5.1 B  OPD
21. KK 5.1 C OPD
22. KK 5.2 OPD
23. KK 6 INSPEKTORAT
24. KK 7 INSPEKTORAT
25. KK 8 INSPEKTORAT
26. Ref PCT
27. REF
28. INDIKATOR HASIL

## Catatan validasi dan deploy

Validasi source code dan pengujian regresi lokal dilakukan. Sinkronisasi nyata tetap perlu diuji setelah deploy karena akses spreadsheet bergantung pada ID di `GOOGLE_SHEETS_PM_TEMPLATE_ID`, kredensial OAuth/refresh token, serta izin akun Google terhadap master.

Setelah deploy:
1. Pastikan `GOOGLE_SHEETS_PM_TEMPLATE_ID` di environment Production menunjuk ke ID spreadsheet master yang benar.
2. Pastikan akun Google yang digunakan OAuth dapat membaca master dan membuat salinannya di lokasi Drive yang dituju.
3. Buka dashboard, muat ulang halaman, lalu pilih **Perbarui Workbook Pemda + Semua OPD**.
4. Pastikan jumlah tab yang ditampilkan sama dengan jumlah tab aktual master dan cek laporan jika ada sheet/formula yang gagal.

Jangan menghapus workbook lama secara manual sampai workbook hasil pembaruan diverifikasi.
