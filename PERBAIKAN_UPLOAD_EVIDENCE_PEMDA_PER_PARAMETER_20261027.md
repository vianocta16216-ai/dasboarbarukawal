# Perbaikan Riwayat Upload Evidence Pemda per Parameter

## Cakupan
Perubahan ini hanya menyentuh antarmuka dan logika filter pada panel **Upload Evidence Struktur dan Proses — KK PM SPIP** di akun Pemda. Alur upload, penyimpanan R2, sinkronisasi Google Drive, verifikasi, penghapusan, serta retry sinkronisasi tetap dipertahankan.

## Perubahan UI
1. Tab target tetap tersedia: T2 / KK3.2, T3 / KK3.3, dan T4 / KK3.4.
2. Ditambahkan pilihan **Parameter riwayat** yang berisi parameter dari master untuk target aktif. Setiap opsi menampilkan jumlah file untuk parameter tersebut.
3. Daftar riwayat difilter dengan kombinasi `targetCode + subunsur/subCode + paramId`. Jadi pemilihan T2 dan Parameter 1.1.1 hanya menampilkan evidence yang diunggah untuk T2 / subunsur 1.1 / parameter 1.1.1, bukan evidence parameter T2 lainnya.
4. Bagian riwayat menampilkan satu parameter saja pada satu waktu; parameter lain tidak dirender dalam daftar yang sama.
5. Setelah upload, aplikasi mengarahkan riwayat ke target dan parameter tempat upload dilakukan.
6. Jika parameter belum mempunyai file, pesan kosong menyebut parameter terpilih. Jumlah total evidence/verifikasi tetap menghitung semua target.

## Perlindungan fitur
- Tidak ada perubahan pada endpoint upload/verifikasi/delete/retry atau skema database.
- Aksi verifikasi, catatan pemeriksa, status diterima/dengan catatan/dikembalikan, dan penghapusan tetap menargetkan `uploadId` yang sama.
- Pemisahan target dan parameter hanya pada tampilan; record asli tidak dihapus atau dipindahkan.
- CSS tetap responsif untuk layar kecil.

## Pemasangan
Ekstrak ZIP, ganti source di repository GitHub yang tersambung ke Cloudflare Pages, lalu deploy ulang. Setelah deploy, hard refresh browser dan buka dashboard KK PM SPIP Pemda. Pilih target, kemudian pilih parameter pada bagian Riwayat Evidence per Parameter.

## Validasi lokal
- `node --check public/script.js`: lulus.
- `node tools/validate-pemda-evidence-history-tabs.mjs`: 13/13 lulus.
- Seluruh 15 skrip `tools/validate-*.mjs`: lulus.

Tes lokal tidak membuktikan perubahan sudah terpasang di situs produksi sebelum ZIP baru dideploy.
