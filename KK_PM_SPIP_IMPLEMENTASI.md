> **STATUS DOKUMEN:** Catatan ini merekam rancangan/workbook legacy 28 tab. Untuk provisioning dan sinkronisasi workbook PM aktif, ikuti `DEPLOYMENT_KK_PM_SPIP_EXACT.md`: sumber aktif `PM_2026` harus tepat 26 tab dan formula inti tervalidasi. Jangan gunakan instruksi 28 tab di bawah untuk menetapkan `GOOGLE_SHEETS_PM_TEMPLATE_ID`.

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
QA APIP tetap terpisah dari PM, tetapi modul Penjaminan Kualitas kini mengikuti file `Template_Penjaminan_Kualitas_QA_APIP_KAWAL_SPIP.xlsx` (4 sheet: `Petunjuk`, `KK Penjaminan Kualitas`, `Rekap Parameter`, `Rekap Unsur`). Master web berisi 671 item QA dan 43 parameter. Form dipaginasi 35 item per halaman untuk mengurangi beban browser; unggahan diambil read-only dari Evidence Struktur & Proses per OPD/tahun. Ekspor memakai template XLSX asli dan mengubah hanya sel input agar rumus serta format tetap terjaga.

Kolom `File Evidence (Tarikan Evidence Struktur & Proses)` di QA bersifat baca-saja. File diambil dari tabel `opd_workbook_evidence_items` yang juga dipakai kolom `Evidence Struktur dan Proses`, dengan pencocokan kode subunsur + parameter + Grade dan label target `T1=KK3.1`, `T2=KK3.2`, `T3=KK3.3`, `T4=KK3.4`. Tidak ada upload/tabs evidence baru pada QA.

Penilaian memakai kolom Ketersediaan, Identitas Dokumen, Keabsahan, Periode Sesuai, Substansi, dan Catatan. Nilai dan kesimpulan item mengikuti formula template. Export memakai workbook template empat sheet, mengisi tarikan file pada kolom K dan input L:Q serta mempertahankan rumus Nilai/Kesimpulan/Rekap.

Penyimpanan tetap menggunakan tabel sparse `opd_qa_apip_items` dengan kunci tahun + OPD + subunsur + parameter + grade + nomor item. Tabel checklist 10 butir lama tetap ada hanya untuk kompatibilitas dan tidak digunakan oleh tampilan QA baru.

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


## Integrasi Sasaran RPJMD Kabupaten Mahakam Ulu 2025–2029

Acuan yang diberikan pengguna: Peraturan Daerah Kabupaten Mahakam Ulu Nomor 1 Tahun 2026 tentang RPJMD Tahun 2025–2029 (ditetapkan 20 April 2026). Perda Pasal 2 menyatakan RPJMD memuat tujuan, sasaran, strategi, arah kebijakan, program Perangkat Daerah dan kerangka pendanaan indikatif; menjadi pedoman Renstra PD, RKPD, serta pengendalian/evaluasi RPJMD. Pasal 4 mengharuskan pelaksanaan program RPJMD dijabarkan dalam Renstra PD dan penyusunan Renstra berkoordinasi dengan perangkat daerah bidang perencanaan. Pasal 5 menugaskan kepala perangkat daerah bidang perencanaan melakukan pengendalian/evaluasi pelaksanaan RPJMD. Lampiran Bab I bagian 1.3.2 juga menjelaskan penyelarasan tujuan, sasaran, strategi, arah kebijakan, program, dan indikator kinerja RPJMD dengan Renstra PD; Bab V bagian 5.2–5.3 memuat kaidah pelaksanaan serta pengendalian/evaluasi.

### Aturan integrasi yang harus dijaga pada aplikasi
- **KK 1.1–2.3:** tab Pemetaan Sasaran RPJMD kini menyediakan master terstruktur dari Tabel 3.6 (4 tujuan, 21 sasaran strategis, indikator tujuan/sasaran dan target tahunan yang ditranskripsi) untuk mengaitkan sasaran pemerintah daerah, Renstra/Renja OPD, program, kegiatan, dan subkegiatan. Perluasan indikator/penanggung jawab dari tabel lain Bab IV tetap harus diverifikasi terhadap dokumen resmi sebelum dijadikan referensi input wajib.
- **KK 3.1–3.4:** tetap menjadi empat target PM Struktur & Proses T1–T4, dengan evidence tunggal dari modul Evidence Struktur & Proses dan data terisolasi menurut tahun + OPD + target + subunsur + parameter. Bappelitbangda/BP4D berperan sebagai pengampu perencanaan dan pengendalian/evaluasi RPJMD; BPKAD untuk keterkaitan keuangan/penganggaran; Inspektorat untuk pengawasan/penjaminan dan verifikasi sesuai kewenangan akun.
- **KK 5.1:** tab pemetaan mendukung KK 5.1 A/B/C dengan referensi sasaran RPJMD dan status verifikasi. Pemetaan ini konteks hubungan perencanaan, bukan pengganti indikator hasil dan parameter/formula resmi workbook.
- **Alur akun:** Admin Pemda mengelola master OPD, tahun, dan penugasan; OPD mengisi ruang lingkup OPD sendiri; verifikator lintas-OPD memeriksa sesuai role dan merekam status/jejak audit. Jangan membuka data OPD lain hanya karena tautan RPJMD sama.
- **Reset data:** reset berarti mengalihkan tampilan ke master kertas kerja baru yang tervalidasi, bukan menghapus data operasional lama. Data legacy harus tetap dapat dipulihkan/diarsipkan sampai migrasi dan rekonsiliasi disetujui.

### Catatan batasan data
Master sasaran/indikator pada aplikasi merujuk Tabel 3.6, halaman tercetak 195–198, dengan nilai target dipertahankan sebagai teks untuk menjaga `NA`, rentang, predikat, dan level. Kesesuaian pemetaan setiap OPD tetap harus didukung Renstra/Renja, dokumen program/kegiatan, indikator, risiko, dan bukti yang relevan. Pemetaan tidak secara otomatis menentukan grade, skor maturitas, MRI, IEPK, atau nilai resmi BPKP. Uji nyata pada Cloudflare D1, akun produksi, dan Google Sheets/Drive tetap wajib sebelum operasional.
