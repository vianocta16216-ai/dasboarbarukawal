# Patch v4 — Source Binding Master KK PM SPIP, 28 Sheet dan Sinkronisasi Terjaga

## Berkas inti

- `functions/myCloudinaryHandler.js`
- `public/script.js`
- `public/index.html`
- `public/kk-full-workbook-manifest.json`
- `public/kk-pm-full-workbook-manifest.json`
- `tools/validate-pm-master-source-binding-v4.mjs`
- `tools/validate-dynamic-master-sheet-inventory.mjs`
- `tools/validate-all-accounts-pm-workbook-update.mjs`

## Perubahan utama v4

1. ID Cloudflare environment tetap menjadi sumber master utama; D1 tidak dapat menimpa ID ini.
2. Endpoint konfigurasi membaca langsung metadata Google Sheets untuk ID efektif dan mengirim nama/count sheet plus versi backend.
3. Validasi menerima inventory 28 sheet yang diberikan pengguna, alias tab inti, dan tab tambahan masa depan; jumlah fisik tidak dipatok 26.
4. Tombol **Muat Ulang** me-refresh inventory master sekaligus status workbook yang tertaut.
5. **Sinkronkan Master** memuat konfigurasi langsung terlebih dahulu, lalu hanya bekerja saat backend v4 aktif, sumber berasal dari Cloudflare environment, dan validasi tab/formula berhasil.
6. `expectedTemplateSpreadsheetId` diteruskan ke copy workbook. Backend menolak penyalinan jika ID yang diminta UI tidak cocok dengan master efektifnya.
7. Pembaruan massal menargetkan Pemda dan semua OPD dengan ID master yang sama dan mengembalikan ID sumber serta versi backend untuk diagnosis.
8. Frontend asset cache-buster diperbarui ke `20261027-pm-master-source-guard-v4`.

## Identitas versi untuk memverifikasi deployment

`KAWAL_PM_MASTER_BUILD_VERSION = 20261027-pm-master-source-guard-v4`

Setelah deploy, panel konfigurasi master wajib menampilkan versi ini. Jika tidak ada, deployment yang melayani `/myCloudinaryHandler` belum memuat source terbaru atau project/branch Pages yang diperbarui bukan yang dipakai website live.

## Catatan keselamatan data

Sinkronisasi membuat salinan workbook baru hanya setelah master valid dan lock D1 diperoleh. Pointer baru disimpan sesudah file salinan tervalidasi. Workbook lama dicatat sebagai riwayat pemulihan dan tidak dihapus permanen. Jangan jalankan pembaruan massal seluruh OPD sampai satu workbook Pemda berhasil diverifikasi.
