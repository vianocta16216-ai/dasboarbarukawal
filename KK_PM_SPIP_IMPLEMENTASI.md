# KK PM SPIP — Workbook Aligned (KK3.1–KK3.4)

## Sumber struktur
Modul KK PM SPIP mengikuti struktur terlihat pada workbook `KK_PK_dan_Evaluasi_SPIP_Pemda_05052026_FORMULA_TEMPLATE`: sheet `KK3.1`, `KK3.2`, `KK3.3`, dan `KK3.4`. Modul tidak menyalin bentuk checklist QA APIP; yang dipakai dari QA hanya pola UX seperti accordion, pencarian, autosave, dan keterhubungan evidence.

## Struktur target
- **T1 / KK3.1** — Efektivitas dan Efisiensi Pencapaian Tujuan Organisasi: 43 parameter block.
- **T2 / KK3.2** — Keandalan Pelaporan Keuangan: 42 parameter block.
- **T3 / KK3.3** — Pengamanan Aset Negara/Daerah: 43 parameter block.
- **T4 / KK3.4** — Ketaatan pada Peraturan Perundang-undangan: 55 parameter block.
- Total: **183 parameter block**.
- Setiap parameter block memiliki **5 tahapan Grade A–E**, mengikuti urutan workbook.

## Kolom kerja
Setiap parameter menampilkan:
`Kode | Uraian Subunsur | No | Uraian Parameter | Kode Parameter | MRI | IEPK | Grade | Kriteria | Penjelasan | Cara Pengujian | Hasil Pengujian | Grade Hasil | Kluster AoI | Uraian AoI | Kluster Penyebab | Uraian Penyebab | Kesimpulan Akhir`

Field `Kriteria`, `Penjelasan`, dan `Cara Pengujian` merupakan master workbook/read-only. Operator mengisi Hasil Pengujian, Grade Hasil, AoI, Penyebab, dan catatan.

## Tahapan grade dan perhitungan
- A = Level 5 — Perbaikan Berkelanjutan
- B = Level 4 — Evaluasi & Tindak Lanjut
- C = Level 3 — Implementasi
- D = Level 2 — Komunikasi & Pemahaman
- E = Level 1 — Kebijakan/Formalitas

Nilai parameter mengikuti Grade Hasil yang dipilih. Rata-rata target adalah rata-rata level parameter yang telah dinilai. Progres adalah jumlah parameter block yang memiliki Grade Hasil valid dibagi 183.

## Evidence Structure & Proses
Evidence **tidak di-upload ulang** di KK PM. Modul membaca evidence yang sudah tersimpan pada Struktur & Proses berdasarkan `subunsur + parameter + level/grade`, lalu menampilkan file sebagai evidence terhubung/read-only. Satu file tetap satu sumber; tidak dibuat salinan metadata di KK PM.

Parameter tambahan yang hanya ada pada T2/T4 tidak dipaksa mengambil evidence dari parameter Struktur & Proses yang tidak identik. Hasilnya ditampilkan kosong sampai operator menilai parameter tersebut secara manual.

## Multi-operator
Data KK PM disimpan sparse per:
`tahun + opd_id + target + subunsur + param_id`.
Dengan demikian satu operator hanya memperbarui parameter yang sedang dikerjakan dan tidak menimpa seluruh workpaper operator lain. Realtime yang sudah ada tetap memperbarui ringkasan OPD.

## Existing KPIs
KK PM hanya membaca dan menampilkan sebagai referensi:
- Nilai Struktur & Proses
- Nilai Maturitas SPIP
- MRI
- IEPK
- Nilai Kapabilitas APIP

Modul KK PM **tidak menimpa** nilai-nilai tersebut.

## QA APIP dan Struktur & Proses
QA APIP sekarang mengikuti sheet workbook **CHECKLIST PK** dengan 10 butir: Tahap Persiapan (3), Tahap Pelaksanaan (4), dan Tahap Pelaporan (3). Setiap butir memiliki `Pernyataan`, pilihan `√ / X`, `Keterangan Workbook`, `Catatan APIP`, dan `Pemeriksa`. Storage QA baru dibuat sparse dan terpisah; tabel QA lama 671 item tetap dipertahankan agar data historis tidak terhapus.

Struktur & Proses disinkronkan secara non-destruktif pada parameter inti yang mempunyai padanan langsung dengan workbook KK3.1, memperbarui uraian/kriteria/penjelasan/cara pengujian sambil mempertahankan ID dan storage evidence lama.

## Backup
Backup baru menggunakan envelope versi 3 yang tetap dapat membaca backup lama berbentuk array. Selain `opd_data`, backup baru menyertakan tabel sparse `opd_kk_pm_workpaper_items`, `opd_kk_pm_meta`, dan `opd_qa_apip_checklist_items` sehingga data KK PM dan QA workbook tidak hilang saat restore.

## Export
Tombol **Export Excel** menghasilkan satu workbook:
- `Rekap PM`
- `KK3.1 T1`
- `KK3.2 T2`
- `KK3.3 T3`
- `KK3.4 T4`

Sheet target mempertahankan urutan kolom utama workbook dan menambahkan `Evidence Disarankan` serta `Evidence Struktur & Proses` sebagai kolom kerja aplikasi.
