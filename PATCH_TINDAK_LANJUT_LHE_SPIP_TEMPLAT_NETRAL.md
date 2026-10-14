# Patch: Templat Netral Tindak Lanjut LHE SPIP

## Perubahan
- Dropdown `Templat rekomendasi` tidak lagi menampilkan label `Sumber asli 2025` / `Sumber asli 2024` atau daftar tahun sumber.
- Seluruh 40 butir referensi dari contoh Excel dipertahankan, diberi kategori tematik dan ID netral agar nomor rekomendasi yang berulang mudah dibedakan.
- Templat tidak menyimpan `sourceYear` dan tidak membawa status/realisasi/evidence lama ke form sebagai kondisi terkini.
- Saat templat dipilih, `Tahun LHE` awalnya mengikuti Tahun Anggaran aktif. Pengguna tetap dapat memilih tahun LHE dokumen yang sesungguhnya.
- Tenggat memakai frase `tahun berjalan` / `tahun berikutnya`, lalu diproyeksikan dinamis sesuai Tahun Anggaran aktif.
- Instruksi di modal diperjelas: realisasi, status dan bukti aktual harus ditinjau serta diverifikasi terpisah.
- Data tindak lanjut yang sudah tersimpan tetap dapat dibaca/diedit dengan tahun LHE historisnya.

## File yang berubah
- `public/lhe-followup-templates.json`
- `public/script.js`
- `public/index.html`
- `tools/validate-workbook-rollover-lhe-years.mjs`
- `tools/validate-lhe-neutral-templates.mjs` (validasi regresi baru)

## Validasi
Jalankan `node tools/validate-lhe-neutral-templates.mjs`, `node tools/validate-workbook-rollover-lhe-years.mjs`, dan validator lain di folder `tools/`.
