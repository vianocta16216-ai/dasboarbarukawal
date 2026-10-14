# Perbaikan Inspektorat dan Tindak Lanjut LHE SPIP

## Nilai Struktur dan Proses
- Skor tetap dihitung dari bukti yang berstatus Diterima atau Diterima dengan Catatan.
- Ketika tabel evidence workbook yang dinormalisasi memiliki record aktif untuk suatu parameter, record JSON lama tanpa upload ID tidak lagi dapat mempertahankan nilai lama pada parameter tersebut.
- Perhitungan nilai di server tetap memakai sumber evidence terverifikasi, bukan level yang dipilih sendiri.

## Tindak Lanjut LHE SPIP
- Menambahkan tombol Ekspor Excel / Spreadsheet di daftar butir tersimpan.
- Ekspor menghasilkan workbook `.xlsx` dengan kolom mengikuti format rencana aksi contoh: referensi, PIC, rekomendasi, rencana aksi, indikator, bukti diperlukan, tenggat, realisasi, status, tautan bukti, catatan verifikasi, dan tahun LHE.
- File ekspor hanya memakai tautan bukti yang memang tersedia sebagai URL berbagi; URL API privat tidak diekspor sebagai tautan seolah-olah publik.
- Menampilkan aksi Hapus Butir untuk Admin, Irban, dan Auditor. Endpoint server tetap membatasi OPD biasa dari penghapusan; cakupan OPD/sesi tetap diperiksa oleh alur otorisasi yang ada.
- Penghapusan butir menghapus butir terkait beserta file bukti terlampir sesuai perilaku server yang sudah ada.

## Validasi
- `node --check public/script.js` lulus.
- `node --check functions/myCloudinaryHandler.js` lulus.
- `tools/validate-lhe-followup-export-score-refresh.mjs` lulus.
- Validator templat LHE, Inspektorat, evidence score, dan realtime scope lulus.
