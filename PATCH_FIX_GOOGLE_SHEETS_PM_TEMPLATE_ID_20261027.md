# Perbaikan sumber ID master KK PM SPIP — 27 Oktober 2026

## Akar masalah

`kk_pm_template_config` dibuat dengan baris awal yang berisi ID bawaan lama. Sebelumnya `getConfiguredKkPmTemplateId()` membaca D1 lebih dahulu, sehingga nilai lama dalam D1 dapat menimpa nilai terbaru pada `GOOGLE_SHEETS_PM_TEMPLATE_ID`. Dashboard lalu tetap menampilkan/memakai ID lama meskipun variabel Cloudflare sudah diperbarui.

## Perubahan

- `GOOGLE_SHEETS_PM_TEMPLATE_ID` kini menjadi sumber utama jika terisi.
- D1 `kk_pm_template_config` menjadi sumber fallback ketika variabel lingkungan tidak diisi; nilai bawaan hanya digunakan jika keduanya tidak tersedia.
- Endpoint konfigurasi master menampilkan ID efektif dan asal sumbernya. Label UI menjelaskan jika ID berasal dari Cloudflare atau D1.
- Jika variabel Cloudflare sudah terisi, input ID di UI yang berbeda ditolak dengan pesan spesifik `ENV_TEMPLATE_ID_AUTHORITATIVE` agar tidak memberikan kesan bahwa nilai D1 dapat menimpa secret.
- Jika ID Cloudflare yang ditetapkan tidak dapat diakses atau gagal validasi PM_2026, resolver berhenti dan menampilkan diagnosis; sistem tidak diam-diam memilih spreadsheet lain dari hasil pencarian Drive.
- Workbook Pemda lama yang sudah tidak dapat dibaca tetap ditandai perlu sinkronisasi. Aksi sinkronisasi membuat salinan baru dari master yang tervalidasi; pointer lama baru diganti setelah salinan baru valid dan lock/versi D1 lolos. File Drive lama tidak dihapus permanen dan riwayatnya tetap disimpan.
- Link ID bawaan lama di HTML dihilangkan agar tidak sempat ditampilkan sebagai master aktif sebelum konfigurasi dari backend dimuat.

## Langkah deploy

1. Pada **Cloudflare Dashboard → Workers & Pages → pilih project Pages `dashboardkawalspipmaulu` (nama project sesuai akun) → Settings → Variables and Secrets → Production**, isi `GOOGLE_SHEETS_PM_TEMPLATE_ID` dengan ID atau URL master Google Sheets terbaru. Jika nilai variabel diubah, simpan perubahan dan redeploy project.
2. Pastikan master tersebut merupakan file **Google Sheets asli**, memiliki 26 tab PM_2026 yang sesuai dan formula inti yang dipakai aplikasi, serta akun yang diwakili `GOOGLE_DRIVE_REFRESH_TOKEN` memiliki izin baca dan menyalin file.
3. Commit/deploy file hasil patch ini melalui GitHub/Cloudflare Pages.
4. Login sebagai akun Pemda/Super Admin atau Irban, buka KK PM SPIP Pemda, tekan **Muat Ulang**, dan cek bahwa “Sumber aktif” menyatakan `GOOGLE_SHEETS_PM_TEMPLATE_ID dari Cloudflare` serta tautannya menunjukkan ID baru.
5. Tekan **Sinkronkan Master** untuk memperbarui workbook Pemda. Setelah itu, gunakan **Perbarui Workbook Pemda + Semua OPD** bila memang ingin seluruh workbook OPD tahun aktif dibuat ulang dari master terbaru.
6. Pastikan hasilnya menampilkan workbook tervalidasi 26 sheet, bukan pesan 404. Jika masih gagal, pesan akan menunjuk ke ID aktif/validasi/izin OAuth alih-alih memakai ID D1 lama secara diam-diam.

## Catatan penting

Patch ini tidak dapat mengganti nilai secret langsung di Cloudflare dari dalam repositori. ID master baru tidak disebutkan dalam permintaan teks, jadi tidak ada ID baru yang ditebak atau ditanam ke source code; runtime membaca nilai persis dari `GOOGLE_SHEETS_PM_TEMPLATE_ID`.
