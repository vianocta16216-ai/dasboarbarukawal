# Pembaruan Kawal SPIP — Pemisahan T1–T4 dan Integrasi Master KK-PM/KK-PK

## Inti perubahan

- **KK-PM terbaru:** sumber master memakai `KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313.xlsx` (26 sheet). Master JSON PM, manifest 26-sheet, dan fallback aplikasi disesuaikan ke workbook ini.
- **KK-PK terbaru:** sumber evidence/rekomendasi memakai `KK_PK_Evaluasi_SPIP_Pemda_RPJMD_2026_REVISI_SASARAN.xlsx` (28 sheet). Evidence Struktur dan Proses/QA APIP memuat target sesuai sheet KK-PK terbaru.
- **Cakupan input:** OPD umum = T1; BPKAD = T1/T2/T3; Inspektorat = T1/T4; BP4D/Bappelitbangda = T1 serta KKE 1.1 Sastra Pemda.
- **Workbook terpisah:** record/formulir dan tautan workbook setiap OPD tetap tersimpan per OPD/tahun. Endpoint penyimpanan PM/evidence memvalidasi target di server, bukan hanya menyembunyikan tab di UI.
- **Sinkronisasi master:** bila master Google Sheets dikonfigurasi, halaman aplikasi membaca data A:L dari master saat memuat data dan master PM mempropagasikan perubahan kolom A:L ke sheet KK3.1–KK3.4 pada workbook OPD yang telah ditautkan. Kolom M dan seterusnya tidak disentuh. Sinkronisasi berjalan di background dan dibatasi agar permintaan bersamaan tidak memicu penulisan ganda.
- **OPD awal Mahakam Ulu:** daftar pada screenshot dipasang sebagai seed awal untuk tahun tersebut, termasuk BPKAD dan BP4D. Nama yang sudah ada tidak digandakan. Setelah seed awal, OPD masih dapat ditambahkan, diubah, dan dihapus secara manual; penghapusan manual tidak otomatis dibatalkan oleh seed ulang.
- **Nilai Pemda vs OPD:** kolom Kapabilitas APIP tetap khusus Inspektorat/tingkat Pemda. Nilai mandiri per OPD tidak otomatis dianggap sebagai nilai final Pemda/BPKP.

## File aplikasi utama yang berubah

1. `functions/myCloudinaryHandler.js`
   - pemetaan profil OPD serta target yang boleh diisi;
   - validasi target PM/evidence di backend;
   - seed nama OPD Mahakam Ulu;
   - membaca master spreadsheet dan cache 60 detik;
   - ringkasan kemajuan KK-PM menghitung hanya target yang berlaku untuk OPD;
   - sinkronisasi asinkron dan pembaruan kolom A:L ke workbook PM OPD;
   - endpoint webhook `syncKkPmMasterNow` yang hanya menerima secret server minimal 32 karakter.
2. `public/script.js`
   - memuat master KK-PK/KK-PM baru;
   - memprioritaskan rekomendasi evidence per target yang sesuai scope OPD;
   - memisahkan tampilan T1–T4 berdasarkan jenis OPD;
   - QA APIP menampilkan rekomendasi dan file dari target yang sesuai;
   - memakai manifest PM 26-sheet jika cocok dengan workbook, tetapi tetap mengenali workbook lama 28-sheet.
3. `public/index.html`
   - label tombol target dibuat jelas: T1 semua OPD; T2 BPKAD akun; T3 BPKAD aset; T4 Inspektorat.
4. `public/workbook-structure-process-master.json`
   - snapshot KK-PK dari workbook revisi terbaru.
5. `public/kk-pm-exact-workbook-master.json`
   - snapshot KK-PM dari workbook audit evidence terbaru.
6. `public/kk-pm-full-workbook-manifest.json`
   - manifest PM terbaru 26-sheet; manifest lama tetap disimpan untuk kompatibilitas.
7. `public/qa-apip-workbook-master.json`
   - versi master QA dikaitkan ke snapshot rekomendasi KK-PK terbaru.
8. `tools/google-apps-script/KawalSPIP_MasterSync.gs`
   - trigger opsional agar perubahan manual pada tab master KK3.1–KK3.4 memanggil sinkronisasi saat itu juga.

## Konfigurasi Cloudflare yang diperlukan

Simpan sebagai **Secrets/Environment Variables di environment deployment** (jangan menulis credential di file JavaScript):

- `GOOGLE_SHEETS_PM_TEMPLATE_ID`: ID Google Sheets dari workbook PM terbaru yang sudah diubah/dikonversi ke Google Sheets.
- `GOOGLE_SHEETS_PK_MASTER_ID`: ID Google Sheets master KK-PK revisi sasaran.
- `KK_MASTER_SYNC_SECRET`: rahasia acak minimal 32 karakter untuk melindungi pemanggilan sinkronisasi instan.
- `GOOGLE_SHEETS_PM_AUTO_PROPAGATE`: boleh dihilangkan (default aktif); atur `false` untuk mematikan propagasi otomatis.
- Pertahankan secrets Google Drive yang sudah bekerja: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, dan `GOOGLE_DRIVE_FOLDER_ID` sesuai setup sebelumnya.

Pastikan Google Sheets API diaktifkan dan OAuth refresh token Google yang digunakan oleh aplikasi memiliki izin spreadsheet yang diperlukan untuk membaca serta memperbarui Google Sheets (`https://www.googleapis.com/auth/spreadsheets`) selain akses Drive yang sudah dipakai. Jika token hanya memiliki scope baca/Drive yang lebih sempit, pembacaan master atau pembaruan workbook bisa ditolak Google; aplikasi tetap menggunakan snapshot/data tersimpan dan kegagalan propagasi dicatat di log worker.

### Cara memasang sinkronisasi yang dipicu saat master diedit

1. Konversi kedua file XLSX terbaru menjadi Google Sheets (jangan mengganti/menghapus workbook produksi lama). Set ID master PM dan PK pada Cloudflare sesuai di atas.
2. Deploy kode ini ke Cloudflare Pages/Workers seperti repository yang sekarang digunakan.
3. Buka Google Sheets **master PM terbaru**, pilih **Extensions → Apps Script**.
4. Salin isi `tools/google-apps-script/KawalSPIP_MasterSync.gs` ke proyek Apps Script yang terikat pada master itu.
5. Di Apps Script, buka **Project Settings → Script Properties** dan isi:
   - `KAWAL_SPIP_WEBHOOK_URL` = URL deployment + `/myCloudinaryHandler` (misalnya `https://domain-deployment-anda.pages.dev/myCloudinaryHandler`);
   - `KAWAL_SPIP_SYNC_SECRET` = nilai yang sama dengan secret `KK_MASTER_SYNC_SECRET` Cloudflare;
   - `KAWAL_SPIP_MASTER_SPREADSHEET_ID` = ID Google Sheets master PM;
   - `KAWAL_SPIP_YEAR` = tahun kerja, misalnya `2026`.
6. Pilih fungsi `setupKawalSpipMasterSyncTrigger` lalu klik **Run** dan setujui izin yang diminta Google.
7. Uji dengan mengedit satu sel deskripsi/rekomendasi di A:L tab `KK3.1` master PM; tunggu log eksekusi Apps Script, lalu periksa workbook OPD yang sudah memiliki tautan. Hanya kolom A:L pada target yang relevan yang diperbarui; kolom isian M dan seterusnya dipertahankan.

Sinkronisasi juga dijadwalkan di background ketika halaman aplikasi membaca master PM. Trigger Apps Script diperlukan jika perubahan master ingin segera mendorong sinkronisasi tanpa menunggu pengguna membuka/menyegarkan aplikasi.

## Mode monitoring, verifikasi, dan nilai resmi Pemda

- Dashboard mempunyai dua mode yang berbeda: **Monitoring Internal / Self-Assessment** dan **Hasil Resmi BPKP**. Nilai SPIP, MRI, IEPK, serta Kapabilitas APIP pada mode resmi dibaca dari tabel resmi khusus per tahun; mode resmi tidak mengambil rata-rata nilai mandiri OPD sebagai pengganti hasil BPKP. Nilai resmi baru ditampilkan bila admin memfinalisasi data tersebut.
- Input nilai resmi menggunakan secret Cloudflare `BPKP_ADMIN_PASSWORD` (minimal 12 karakter). Nilai dapat disimpan sebagai draft, difinalisasi, lalu dibuka kembali melalui tindakan unlock yang tercatat di audit log. Jangan menanamkan secret ke source code atau membagikannya kepada akun OPD.
- Perubahan status OPD menggunakan password pengelola `ACCESS_PASSWORD`. Status `Proses Review` dan `Selesai Verifikasi` mengunci endpoint penulisan mandiri. Buka kembali ke `Proses Pengisian` jika data perlu diperbaiki.
- Progress verifikasi hanya menghitung OPD yang berstatus `Selesai Verifikasi`; kolom Kapabilitas APIP ditampilkan khusus Inspektorat karena nilai tersebut merupakan level Pemda.

## Catatan keselamatan data dan batasan

- Tidak ada proses yang menghapus/menimpa semua workbook OPD. Sinkronisasi hanya memperbarui rentang A:L pada tab KK3.1–KK3.4 yang memang dimiliki oleh profil OPD; kolom M+ tidak ditulis.
- Sinkronisasi workbook adalah proses best-effort. Aplikasi tidak menjadikan hasil push yang gagal sebagai alasan untuk menghapus input lama. Periksa log Cloudflare dan Apps Script jika ada file yang belum tersinkron.
- Sinkronisasi instan yang ditambahkan adalah **push satu arah untuk struktur/template master A:L** dari spreadsheet master PM ke sheet target yang sesuai pada workbook OPD yang sudah tertaut. Ia tidak membuat workbook baru otomatis saat OPD ditambahkan, tidak mengubah URL/ID workbook yang telah ada, serta tidak menulis ulang kolom isian M+ saat template berubah.
- Pengisian formulir KK-PM melalui aplikasi disimpan di database aplikasi; pembaruan A:L master tidak sama dengan sinkronisasi dua arah untuk setiap nilai jawaban formulir. Setelah perubahan master, jawaban aplikasi yang sudah tersimpan tetap aman, tetapi jangan menganggap nilai formulir otomatis dituliskan ke sel workbook eksternal kecuali alur ekspor/sinkronisasi yang memang ada di deployment Anda telah mengujinya.
- Trigger Apps Script memerlukan akses edit yang sah ke master dan workbook tujuan, izin Google Sheets API, serta refresh token ber-scope spreadsheet. Tes terlebih dahulu pada satu OPD dan satu target, lalu cek kolom A:L dan pastikan kolom M+ tetap utuh.
- Data KKE 1.1 adalah penilaian sasaran strategis **Pemda** dan layar PM diarahkan ke BP4D/Bappelitbangda. Isi KKE 1.1 tidak disalin massal ke workbook OPD lain.
- Isi nama OPD dari screenshot dipakai sebagai daftar awal. OPD dapat ditambah/ubah/hapus lewat fitur yang ada. Jika deployment tahun berjalan telah mempunyai daftar OPD, seed hanya menambahkan nama yang belum ditemukan ketika seed awal berjalan.
- Nilai resmi BPKP harus tetap dimasukkan sebagai data final terpisah; skor mandiri per OPD bukan otomatis dianggap angka final Pemda.

## Pengujian sebelum dipakai bersama

- Buka OPD umum: hanya T1 muncul dan endpoint menolak simpan T2/T3/T4.
- Buka BPKAD: T1/T2/T3 muncul, T4 ditolak server.
- Buka Inspektorat: T1/T4 muncul, T2/T3 ditolak server.
- Buka BP4D/Bappelitbangda: KKE 1.1 terlihat sebagai pekerjaan Pemda; T2/T3/T4 tidak tersedia.
- Ubah rekomendasi/struktur A:L di master PM dan verifikasi update di aplikasi serta workbook salinan setelah sinkronisasi. Verifikasi terpisah bahwa jawaban yang diisi lewat aplikasi tetap tersimpan di database; ini tidak menguji penulisan dua arah ke sel workbook.
- Pastikan sel uji di kolom M+ pada workbook OPD tidak berubah.
- Uji menambah, mengubah, dan menghapus satu OPD contoh; muat ulang dan pastikan penghapusan manual tidak muncul kembali.
- Uji satu upload evidence, verifikasi QA APIP, serta status file dikembalikan sebelum rilis ke seluruh OPD.
