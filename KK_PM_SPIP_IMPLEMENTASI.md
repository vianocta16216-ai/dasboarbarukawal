# KK PM SPIP — Integrasi Exact Workbook

## Prinsip utama
Workbook `KK_PK_dan_Evaluasi_SPIP_Pemda_05052026_FORMULA_TEMPLATE(4).xlsx` menjadi **single source of truth** untuk bentuk, nama sheet, kriteria, penjelasan, cara pengujian, grade, dan formula. SHA-256 workbook yang dipakai: `0d6144307a164b356d8e666c868d16191799e6358895517a39a8e8aec414b1e8`.

KK PM bukan lagi hanya KK3.1–KK3.4. Dashboard menyediakan navigator **seluruh 28 sheet** workbook, terdiri dari **21 sheet Kertas Kerja + 7 sheet Pendukung/Referensi**, sementara PM Struktur & Proses tetap mempunyai tampilan input khusus yang terintegrasi dengan Evidence Struktur & Proses.

## 28 sheet yang dipertahankan
Urutan workbook tidak diubah: `FAQ`, `DAFTAR KK`, `NAMA OPD`, `CHECKLIST PK`, `KKLEAD_SPIP`, `KKLEAD I`, `KKE 1.1 SASTRA`, `KKE 1.2 SASTRA OPD`, `KKE 2.1 SASPRO`, `KKE 2.2 SASKEG`, `KKE 2.3 SASSUBKEG`, `KKLEAD II`, `KK3.1`, `KK3.2`, `KK3.3`, `KK3.4`, `KK 4`, `KKLEAD III`, `KK 5.1 A`, `KK 5.1 B `, `KK 5.1 C`, `KK 5.2`, `KK 6`, `KK 7`, `KK 8`, `Ref PCT`, `REF`, `INDIKATOR HASIL`.

Sheet besar tetap disimpan dan dikerjakan pada Google Spreadsheet hasil copy template. Dashboard hanya memuat metadata + preview kecil (lazy-load), sehingga tidak memasukkan puluhan/ratusan ribu sel ke DOM browser.

## PM Struktur & Proses
Sheet target sumber: `KK3.1`, `KK3.2`, `KK3.3`, `KK3.4`.

- **T1 / KK3.1:** 43 parameter block — efektivitas dan efisiensi pencapaian tujuan.
- **T2 / KK3.2:** 42 parameter block — keandalan pelaporan keuangan.
- **T3 / KK3.3:** 43 parameter block — pengamanan aset negara/daerah.
- **T4 / KK3.4:** 55 parameter block — ketaatan pada peraturan perundang-undangan.
- Total: **183 parameter block** dan **915 tahapan Grade A–E**.

Kolom kerja mengikuti struktur sumber: `Kode | Subunsur | No | Uraian Parameter | Kode Parameter | MRI | IEPK | Grade | Kriteria | Penjelasan | Cara Pengujian | Hasil Pengujian | Grade Hasil | Kluster AoI | Uraian AoI | Kluster Penyebab | Uraian Penyebab | Kesimpulan Akhir`.

`Kriteria`, `Penjelasan`, dan `Cara Pengujian` bersifat master/read-only. Operator mengisi hasil pengujian dan kesimpulan pada storage sparse aplikasi.

## Grade
- **A = Level 5** — Perbaikan Berkelanjutan
- **B = Level 4** — Evaluasi & Tindak Lanjut
- **C = Level 3** — Implementasi
- **D = Level 2** — Komunikasi & Pemahaman
- **E = Level 1** — Kebijakan/Formalitas

Progress dihitung dari jumlah parameter block yang sudah memiliki Grade Hasil valid. Rata-rata level dihitung dari level parameter yang sudah dinilai.

## Evidence Struktur & Proses → KK PM
Master Evidence berasal dari gabungan `KK3.1–KK3.4` dan menghasilkan **55 grup parameter / 111 variant evidenceKey**.

Aturannya:
1. Bila struktur parameter lintas T1–T4 identik, evidence memakai satu grup/evidenceKey bersama.
2. Bila berbeda, variant dipisahkan dan diberi label target `T1 · KK3.1`, `T2 · KK3.2`, `T3 · KK3.3`, atau `T4 · KK3.4`.
3. **Upload hanya dilakukan di Evidence Struktur & Proses.** KK PM tidak meminta upload ulang.
4. KK PM menarik file berdasarkan `evidenceKey` dan menampilkannya read-only. Satu file tetap satu sumber sehingga tidak terjadi duplikasi upload.

Dengan pola ini, evidence yang sudah diunggah operator lain dapat langsung terlihat pada KK PM selama berada pada OPD/tahun/parameter yang sama.

## QA APIP
QA APIP tetap terpisah dari PM dan mengikuti sheet `CHECKLIST PK` workbook: **10 butir**, yaitu **3 Persiapan + 4 Pelaksanaan + 3 Pelaporan**. QA tidak dibuat menyerupai KK3.1; pola UX saja yang memanfaatkan accordion, autosave, dan checklist.

## Empat nilai KPI — tidak ada input manual
Empat nilai di dashboard dibaca dari sel formula workbook `KKLEAD_SPIP`:

- **Nilai Maturitas Penyelenggaraan SPIP** → `I11` → `=H16+H50+H64`
- **Nilai MRI** → `I68` → `=F83`
- **Nilai IEPK** → `I85` → `=F104`
- **Nilai Kapabilitas APIP** → `I106` → `='KKLEAD II'!L35`

Rangkaian dependensi formula utama yang diverifikasi dari workbook juga dicatat di `kk-pm-exact-workbook-master.json`. Server membaca nilai hasil formula melalui Google Sheets API dan menyimpannya sebagai cache **read-only**; fungsi `saveField` menolak perubahan manual pada keempat nilai tersebut.

Saat membuat/sinkronisasi Spreadsheet PM, sistem memverifikasi **28 nama/urutan sheet dan 4 formula inti**. Workbook PM lama yang hanya berisi 19/21 sheet akan dianggap stale dan diganti dengan copy template exact.

## Multi-operator dan low-lag
Data input PM disimpan sparse dengan primary key:
`tahun + opd_id + target + subunsur + param_id`.

Dengan demikian satu operator hanya mengubah parameter yang sedang dikerjakan, tanpa menulis ulang seluruh JSON workpaper. Realtime existing tetap dipakai untuk pembaruan status. Sinkronisasi nilai workbook dibatasi concurrency-nya agar tidak membanjiri Google Sheets API.

Untuk workbook yang sangat besar (contoh `KK 5.2` memiliki hingga sekitar 150.000 formula pada template), dashboard tidak melakukan fetch seluruh grid. Operator mengklik **Buka Seluruh Workbook** atau **Buka Sheet Ini** untuk pengisian penuh di Google Spreadsheet.

## Export
Ada dua jalur export:

- **Export Rekap PM**: rekap + PM Struktur & Proses T1–T4 dari data aplikasi.
- **Export Workbook Excel**: export langsung workbook PM lengkap **28 sheet** dari Google Spreadsheet sehingga formula, sheet, dan struktur workbook tetap utuh.

## Backup/restore
Tabel sparse PM (`opd_kk_pm_workpaper_items`, `opd_kk_pm_meta`) dan checklist QA (`opd_qa_apip_checklist_items`) ikut dalam backup/restore. Storage legacy PM tetap dipertahankan untuk kompatibilitas dan tidak dihapus.
