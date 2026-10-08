# KK PM SPIP — Implementasi Terintegrasi

Perubahan ini menambahkan modul **Kertas Kerja PM SPIP** tanpa mengubah sumber data existing untuk Nilai Maturitas, MRI, IEPK, Kapabilitas APIP, dan Nilai Struktur & Proses.

## Relasi utama

`Evidence Struktur & Proses` → file ditarik read-only → `KK PM SPIP` → penilaian item → rekap parameter → rekap unsur → hasil PM SPIP.

File evidence **tidak diunggah ulang** pada KK PM; satu file dapat dipakai sebagai evidence yang sama pada lokasi parameter/level yang sesuai.

## Master

Master menggunakan **5 unsur, 43 parameter, 671 item, Grade E–A / Level 1–5**. `kk-pm-master.json` mempertahankan seluruh struktur QA APIP existing dan membawa referensi kriteria/penjelasan/cara pengujian dari workbook yang tersedia bila pasangan parameter dapat dipetakan.

## Penyimpanan multi-operator

Data PM disimpan pada tabel D1 sparse:

`opd_kk_pm_items(year, opd_id, subunsur, param_id, grade, item_no, availability, identity_doc, validity, period_ok, substance, note, score, conclusion, examiner_name, updated_at)`

Kunci utama adalah kombinasi tahun + OPD + subunsur + parameter + grade + nomor item. Penyimpanan per-item menghindari risiko satu browser menimpa keseluruhan data PM dari operator lain.

## Rumus nilai item

- 1,0 = Ada + Keabsahan Ya + Periode Ya + Substansi Sesuai
- 0,5 = Ada tetapi belum memenuhi seluruh syarat
- 0,0 = Tidak Ada atau Substansi Tidak Sesuai
- N/A = tidak masuk penyebut

Persentase PM = `Σ nilai / (jumlah item - N/A) × 100`.

Grade/Level parameter naik E → D → C → B → A hanya ketika seluruh item yang berlaku pada grade tersebut telah dinilai dan memenuhi ambang 100%.

## Ketahanan fitur existing

- Nilai Struktur & Proses tetap dihitung dari 43 level parameter existing.
- Nilai Maturitas SPIP, MRI, IEPK, dan Kapabilitas APIP tetap field existing dan tidak ditimpa oleh PM.
- QA APIP tetap berada pada tabel sendiri dan hanya diselaraskan pada master/kriteria yang sama.
- `kk_pm_data` legacy tetap dipertahankan untuk kompatibilitas.
- Realtime menyiarkan perubahan item PM agar ringkasan OPD operator lain ikut terbarui.

## Export

Tombol **Export Excel** membuat workbook per OPD/tahun berisi `Rekap PM` dan `KK PM SPIP`, termasuk master item, kriteria, penjelasan, cara pengujian, evidence yang disarankan, file evidence yang ditarik, hasil penilaian, nilai, kesimpulan, catatan, dan pemeriksa.
