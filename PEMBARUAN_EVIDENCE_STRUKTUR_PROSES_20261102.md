# Pembaruan Evidence Struktur dan Proses — 2 November 2026

## Ruang lingkup perubahan

Pembaruan dibatasi pada isi **Evidence yang Disarankan** di fitur **Evidence Struktur dan Proses**. Sumber yang digunakan adalah kolom **L – EVIDENCE YANG DISARANKAN** dari workbook `KK_PM_Evaluasi_SPIP_Pemda_RPJMD_2026_REVISI_SASARAN (3).xlsx`.

| Target | Sheet sumber | Cakupan |
|---|---|---|
| T1 | KK3.1 OPD | Evidence umum untuk OPD/Pemda sesuai KK3.1 |
| T2 | KK3.2 BPKAD AKUN | Evidence khusus pengelolaan keuangan BPKAD |
| T3 | KK3.3 BPKAD ASET | Evidence khusus pengelolaan aset BPKAD |
| T4 | KK3.4 (INSPEKTORAT) | Evidence khusus penilaian Inspektorat |

## Hasil pemutakhiran

- T1: 43 parameter × 5 grade = 215 rekomendasi.
- T2: 42 parameter × 5 grade = 210 rekomendasi.
- T3: 43 parameter × 5 grade = 215 rekomendasi.
- T4: 55 parameter × 5 grade = 275 rekomendasi.
- Total: **183 parameter dan 915 rekomendasi Grade A–E**.

Teks rekomendasi disalin dari kolom L dan dirapikan menjadi butir daftar agar tampil konsisten di aplikasi. Setiap butir tetap dipetakan ke target, kode parameter, grade, dan baris sumber Excel.

## Aturan cakupan akun

Aturan cakupan yang sudah ada dipertahankan:

- OPD umum: T1.
- BPKAD: T1, T2, dan T3.
- Inspektorat: T1 dan T4.
- BP4D tetap mengikuti cakupan BP4D yang sudah ada (T1 serta lembar sasaran strategis KKE tersendiri).

Workbook yang diberikan tidak mempunyai sheet T0 atau sheet tersendiri bernama Pemda; karena itu T1 tetap menjadi sheet umum OPD/Pemda dan tidak dibuat target baru di luar sumber.

## Perlindungan fitur yang sudah ada

- Seluruh `evidenceKey`, `variantKey`, grup parameter, jumlah parameter, dan struktur Grade A–E dipertahankan.
- Data upload, verifikasi, hapus, retry, dan tautan file tidak dimigrasikan atau diubah.
- Sinkronisasi Google Sheets untuk bidang lain tetap berjalan. Namun setelah refresh, rekomendasi Evidence yang Disarankan ditimpa kembali menggunakan snapshot Excel yang disetujui agar isi live sheet lama tidak mengembalikan rekomendasi lama.
- Cache-buster asset JavaScript diperbarui agar browser memuat script terbaru.

## File proyek yang berubah

1. `public/workbook-structure-process-master.json` — seluruh rekomendasi pada data target dan tampilan merged diperbarui.
2. `public/script.js` — menambahkan overlay sumber Excel setelah refresh live Google Sheets dan menaikkan versi cache master evidence.
3. `public/index.html` — menambahkan query revisi asset JavaScript untuk memaksa pemuatan script terbaru.

## Validasi

- 915/915 rekomendasi target cocok dengan isi kolom L dan baris sumber Excel.
- 915/915 daftar target yang tampil pada grup merged cocok dengan sumber target masing-masing.
- Jumlah parameter per target tetap T1=43, T2=42, T3=43, T4=55.
- 55 grup / 111 varian tetap; seluruh `evidenceKey` dan `variantKey` sama dengan ZIP awal.
- `node --check public/script.js` lulus.
- Seluruh skrip `tools/validate*.mjs` lulus.

## Catatan deployment

Deploy proyek hasil pembaruan ini ke Cloudflare Pages/GitHub sesuai alur deployment yang selama ini digunakan. Perubahan kode dan master statis ini belum dapat dianggap tampil pada website produksi sebelum ZIP hasil pembaruan di-commit dan di-deploy. Untuk perubahan ini tidak perlu menjalankan migrasi database.
