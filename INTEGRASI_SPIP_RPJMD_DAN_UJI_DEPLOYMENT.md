# Integrasi PM SPIP Terintegrasi dengan RPJMD Mahakam Ulu 2025–2029

## Implementasi pada source

1. `public/rpjmd-mahakam-ulu-2025-2029-master.json` memuat visi, empat tujuan, 21 sasaran strategis, indikator tujuan/sasaran dan target tahunan yang ditranskripsi dari Perda Kabupaten Mahakam Ulu Nomor 1 Tahun 2026, Bab III §3.1.2, Tabel 3.6, halaman tercetak 195–198.
2. Modal Kertas Kerja PM SPIP memiliki tab **Pemetaan Sasaran RPJMD** untuk KKE 1.1, KKE 1.2, KKE 2.1, KKE 2.2, KKE 2.3, dan KK 5.1 A/B/C.
3. Pemetaan dapat memilih lebih dari satu sasaran, wajib menyertakan uraian hubungan, dan memiliki alur `Menunggu Verifikasi` → `Terverifikasi` atau `Perlu Perbaikan`.
4. Data tersimpan per tahun, OPD, dan kode kertas kerja pada D1. Keputusan dan pengajuan dicatat pada `opd_kk_rpjmd_mapping_audit`. Perubahan tidak menghapus tabel/data SPIP lama.
5. Admin memiliki akses lintas OPD. Akun OPD tetap dibatasi pada cakupan OPD dari sesi server. Verifikasi dibatasi pada Admin/Irban. Pengisian KKE 1.1 dan KK 5.1 A tingkat Pemda dibatasi ke Admin atau akun BP4D/Bappelitbangda.
6. Export rekap PM menambahkan sheet `Pemetaan RPJMD`.
7. Pemetaan sasaran tidak mengganti parameter/grade/formula resmi dalam workbook PM SPIP, tidak menghitung skor maturitas hanya dari nama sasaran, dan tidak mengubah nilai resmi BPKP.

## Pemetaan peran operasional yang disarankan

- **Admin Pemda:** mengelola akun/OPD/tahun, melihat semua pemetaan, memastikan penugasan dan memeriksa kelengkapan.
- **BP4D/Bappelitbangda:** koordinator konsistensi sasaran strategis daerah, Renstra/Renja OPD, program, kegiatan, subkegiatan, indikator dan target RPJMD.
- **OPD:** menyusun keterkaitan yang relevan bagi sasaran/program/kegiatan/subkegiatan OPD dan menyiapkan dokumen/bukti.
- **BPKAD:** memberi data/validasi yang menjadi kewenangannya pada ranah keuangan dan aset; akses KK3.2/KK3.3 tetap mengikuti pembatasan target yang telah ada.
- **Inspektorat/APIP:** menelaah bukti, memeriksa kualitas pengisian dan melakukan penjaminan kualitas sesuai pedoman; aplikasi membatasi keputusan verifikasi pemetaan pada Admin/Irban.

## Catatan sumber dan akurasi

Master diambil dari tabel 3.6 Perda yang dilampirkan. Nilai indikator pada tabel ditampilkan sebagai teks agar format seperti `NA`, rentang nilai, predikat, dan level tidak salah dikonversi menjadi angka. Jika indikator/tahun tidak tercantum pada master, operator harus merujuk tabel resmi dan tidak menganggapnya bernilai nol. Tabel ini bukan pengganti master workbook resmi yang dipakai BPKP.

## Checklist uji sebelum dipakai produksi

- [ ] Deploy Worker/Pages Functions dan pastikan `public/rpjmd-mahakam-ulu-2025-2029-master.json` ikut terbit.
- [ ] Login sebagai Admin, buka satu OPD, buka Kertas Kerja PM SPIP → Pemetaan Sasaran RPJMD; pastikan 4 tujuan dan 21 sasaran muncul.
- [ ] Login akun OPD; pastikan tidak bisa membaca/mengubah OPD lain dengan mengganti `opdId` pada request.
- [ ] Simpan pemetaan dengan beberapa sasaran dan uraian; muat ulang halaman dan pastikan data tetap ada.
- [ ] Login sebagai OPD; pastikan aksi verifikasi menghasilkan 403.
- [ ] Login sebagai Irban/Admin; verifikasi satu pemetaan, lalu kembalikan satu pemetaan dengan catatan; pastikan status, nama pemeriksa, catatan, dan audit tersimpan.
- [ ] Pastikan perubahan sesudah status `Proses Review`/`Selesai Verifikasi` ditolak oleh backend.
- [ ] Uji KKE 1.1/KK 5.1 A dengan akun selain BP4D; pastikan ditolak. Uji dengan akun BP4D dan Admin.
- [ ] Export rekap PM; pastikan sheet `Pemetaan RPJMD` berisi sasaran, uraian, status dan catatan verifikasi.
- [ ] Uji Kertas Kerja PM, Evidence Struktur & Proses, QA APIP, Google Sheets, Google Drive/R2 dan realtime secara terpisah setelah deploy; jangan menganggap sukses dari pemeriksaan statis saja.

## Batas pengujian

Pemeriksaan yang dapat dilakukan pada paket lokal meliputi sintaks JavaScript dan validitas JSON. Koneksi nyata ke Cloudflare D1, Secrets, Google Sheets/Drive, hak akses akun produksi, dan uji bersamaan belum dapat dibuktikan dari paket lokal; checklist di atas harus dijalankan di lingkungan deploy.

## Kerangka regulasi yang menjadi acuan desain

- **PP Nomor 60 Tahun 2008 tentang SPIP**: kerangka penyelenggaraan pengendalian intern pemerintah.
- **Peraturan BPKP Nomor 5 Tahun 2021**: acuan penilaian maturitas SPIP Terintegrasi. Struktur penilaian terdiri dari Penetapan Tujuan (40%), Struktur dan Proses (30%), serta Pencapaian Tujuan (30%); parameter, teknik pengujian, grade, dan formula harus tetap mengikuti workbook/pedoman penilaian resmi, bukan diturunkan dari pemetaan RPJMD saja. Tautan dokumen pada JDIH BPKP: https://jdih.bpkp.go.id/pencarian/MzI3/U2FsaW5hbiBQZXJiYW4gQlBLUCBObyA1IFRhaHVuIDIwMjEucGRm/131/download
- **Peraturan BPKP Nomor 8 Tahun 2021**: rujukan terpisah terkait penilaian kapabilitas APIP; jangan disamakan dengan nilai maturitas SPIP.
- **Perda Kabupaten Mahakam Ulu Nomor 1 Tahun 2026**: sumber visi, tujuan, sasaran, indikator, dan target RPJMD 2025–2029 yang ditampilkan oleh master aplikasi.

Rujukan JDIH BPKP menampilkan Peraturan BPKP Nomor 5 Tahun 2021 sebagai peraturan mengenai penilaian maturitas SPIP Terintegrasi. Status keberlakuan/ketentuan teknis terbaru tetap perlu dikonfirmasi pada JDIH resmi saat proses penetapan aplikasi di lingkungan Pemda.
