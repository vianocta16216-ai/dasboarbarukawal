# Catatan Teknis Patch — Gagal Update Workbook KK PM SPIP — 27 Oktober 2026

## Perubahan backend
- `canonicalPmSheetKey()` mengenali alias tab terverifikasi termasuk `KKE 2.3 SASSUBKES`, `KK 5.1 A RPJMD (BP4D)`, dan `KK 6/7/8 INSPEKTORAT`.
- `pmSheetStructureDiagnostics()` menerima urutan apa pun dan jumlah tab fisik lebih dari 26; yang wajib adalah 26 tab inti masing-masing hadir tepat sekali. Tab tambahan dilaporkan tapi tidak memblokir. Tab inti yang hilang/duplikat tetap ditolak.
- `validateKkPmSpreadsheet()` mengembalikan daftar tab inti hilang, tambahan, duplikat, dan formula yang tidak cocok; endpoint master hanya menolak kekurangan/duplikasi tab inti, profil legacy PK, atau formula yang salah.
- `ensureKkPmSpreadsheet()` mendukung `forceRefresh`/`massRefresh` sehingga aksi global membuat salinan terbaru walau ID dan revision tidak berubah.
- Pembaruan hanya global untuk role `admin` dan `irban`; aksi daftar target OPD dan endpoint mutation memiliki pemeriksaan role server-side.
- Workbook baru di-link lebih dahulu ke D1. Mirror `current.xlsx`/`current.json` R2 diperbarui sesudahnya. Kegagalan R2 tidak mengembalikan pointer Google Drive lama.
- Setelah link baru tersimpan, helper `tryArchiveKkPmDriveWorkbook()` mencoba memberi awalan `ARSIP <timestamp> -` pada file Drive lama tanpa menghapusnya, dengan pengecualian untuk ID master aktif dan master sumber yang tercatat. Status arsip dan error dipisahkan dari status mirror.
- Frontend menggunakan alias nama untuk mencocokkan nama sheet manifest dengan `sheetId` aktual dan memilih manifest PM untuk rilis 28-tab yang memakai alias BP4D/Inspektorat. Status memperinci workbook fail, R2 fail dan Drive archive fail per entitas.

## File utama
- `functions/myCloudinaryHandler.js`
- `public/script.js`
- `tools/validate-all-accounts-pm-workbook-update.mjs`
- `tools/validate-pm-template-profile-refresh.mjs`

## Risiko dan batas
- Perubahan live hanya terjadi setelah deploy dan pemanggilan aksi di aplikasi.
- Pengarsipan Drive memerlukan hak rename dari token OAuth; bila tidak tersedia, workbook baru tetap tertaut dan peringatan ditampilkan, sementara file lama tetap ada.
- R2 mirror memerlukan binding `EVIDENCE_BUCKET` dan izin tulis; bila tidak tersedia, workbook Google Sheets tetap aktif dan error R2 akan dilaporkan terpisah.
