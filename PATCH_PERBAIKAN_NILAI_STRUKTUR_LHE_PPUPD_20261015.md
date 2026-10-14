# Patch Kawal SPIP — Reset Nilai Struktur/Proses, Hapus Butir LHE, Alur Auditor/PPUPD

Tanggal: 15 Oktober 2026

## Perubahan

### Nilai Struktur dan Proses

- Sumber nilai berjalan adalah evidence aktif pada tabel `opd_workbook_evidence_items`; nilai yang sebelumnya tersimpan pada kolom skor tidak dipakai sebagai sumber saat `getData` dibentuk.
- Evidence berstatus `diterima` atau `diterima_catatan` yang masih aktif dapat menyumbang nilai. `menunggu`, `dikembalikan`, status kosong, tombstone, file tanpa kunci storage, dan baris tanpa nama file tidak dihitung.
- Satu parameter menggunakan level tertinggi dari evidence aktif yang diterima.
- Salinan status legacy hanya dipakai jika `uploadId`, parameter, dan level-nya cocok dengan evidence yang masih aktif. File legacy saja, file yang sudah tidak ada pada tabel aktif, dan lampiran tanpa ID tidak dapat menghidupkan skor lama kembali.
- Penghapusan evidence mempertahankan metadata tombstone agar file yang dihapus ke depan tidak menghidupkan kembali nilai lama. Kalkulasi ulang memperbarui `sa`, `nilai_struktur_proses`, dan status `Belum/Proses/Selesai`.

### Hapus butir Tindak Lanjut LHE

- Kartu butir tersimpan menyediakan tombol **Hapus Butir** untuk akun admin, auditor, PPUPD, Irban, dan OPD sesuai cakupan akun.
- Sebelum dihapus, UI meminta konfirmasi dan menyebutkan bahwa lampiran terkait juga ikut dihapus.
- Endpoint server memeriksa cakupan OPD/tahun, menghapus butir dan mencoba membersihkan file di Google Drive/R2, registri upload, metadata upload, serta status workflow aktif.
- Riwayat audit verifikasi tetap dipertahankan. Jika file di Google Drive/R2 gagal dibersihkan, endpoint mengembalikan peringatan agar tidak dianggap berhasil dibersihkan seluruhnya.
- Tombol hapus diberi tampilan merah yang berbeda dari tombol edit. Akun hanya-baca melihat aksi **Lihat**, bukan label **Buka/Edit**.

### Alur Verifikasi Evidence

- Label tahap awal diperjelas menjadi **Auditor / PPUPD (input/pengiriman)**.
- Label alur resmi konsisten: **Auditor / PPUPD mengirim → Irban memverifikasi → BPKP sebagai verifikator akhir**.
- Akun PPUPD memetakan ke tahap Auditor pada workflow namun tetap merupakan role login tersendiri; pemeriksaan scope OPD tetap dilakukan server. Perubahan ini tidak memberi PPUPD akses finalisasi nilai resmi BPKP atau pengelolaan akun.

## Validasi lokal

Semua file JavaScript utama lulus `node --check`. Seluruh validator proyek yang tersedia lulus, termasuk validasi skor evidence, hak PPUPD, penghapusan LHE, keamanan cakupan realtime, workbook, dan template. Uji kalkulasi mencakup: keputusan terbaru untuk upload yang sama, level tertinggi yang diterima, tombstone setelah hapus, file legacy tanpa item aktif, dan file lama dengan ID berbeda.

## Batasan

Patch ini mengubah **kode pada paket ZIP** saja. Website Cloudflare Pages/Worker dan database produksi belum diubah dari lingkungan ini. Agar terlihat di website, unggah/deploy paket ini pada branch Pages yang benar, deploy Worker realtime bila bundel deployment mengharuskannya, lalu uji dengan akun OPD dan PPUPD pada tahun/OPD yang sama. Tidak ada data produksi yang dihapus dalam proses pembuatan patch ini.
