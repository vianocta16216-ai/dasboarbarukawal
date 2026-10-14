# Patch lanjutan sinkronisasi workbook PM dan akses serentak

Tanggal: 15 Oktober 2026 — revisi berdasarkan rekaman error terbaru

## Akar masalah yang terlihat pada rekaman terbaru

1. Pembacaan master menampilkan Google Sheets `Unable to parse range` ketika membangun range untuk target T1–T4 dari nama tab tetap (`KK3.1`, `KK3.2`, `KK3.3`, `KK3.4`). Nama tab aktual pada workbook yang sedang dirujuk dapat memakai variasi seperti `KK3.1 (OPD)`, `KK3.2 BPKAD Akun`, atau `KK3.4 (INSPEKTORAT)`. Range dibangun tanpa mencocokkan metadata tab terlebih dahulu.
2. Saat tombol Sinkronkan Workbook diklik, backend menemukan master yang dikonfigurasi memiliki **28 tab**, sedangkan workbook PM terbaru harus memiliki **26 tab** dan formula kunci yang tervalidasi. Artinya ID yang aktif mengarah ke workbook lama/legacy, bukan sumber PM_2026 yang benar. Kode tidak boleh mengubah workbook 28 tab itu menjadi PM hanya dengan mengganti nama atau menghapus tab karena isi, format, maupun formula yang berbeda dapat merusak data.
3. Pengecekan `needsSync` sebelumnya menganggap profil `LEGACY_PK_28` sebagai profil yang dikenali sehingga workbook 28 tab tidak selalu ditandai perlu sinkronisasi ke profil PM_2026.
4. Metadata sheet yang tersimpan bisa berupa objek (`{title, sheetId, ...}`) atau string. Propagasi yang membandingkan objek langsung dengan nama tab bisa gagal mengenali sheet tujuan yang sebenarnya.

## Perubahan kode dalam revisi ini

- **Resolver master PM otomatis dan aman.** Backend memeriksa `GOOGLE_SHEETS_PM_TEMPLATE_ID` terlebih dahulu. Jika ID itu salah/legacy, backend mencari Google Sheets dengan nama dasar sumber `KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313`, termasuk file di shared drive. Kandidat hanya dipakai jika lolos validasi profil PM_2026: tepat 26 tab, urutan nama sesuai, dan formula inti `KKLEAD_SPIP!I11`, `I68`, `I85`, `I106` sesuai. Tidak ada fallback diam-diam ke template PK, dan template 28 tab tidak diubah otomatis.
- **Penyelesaian nama tab dari metadata Google Sheets.** Pembaca master memeriksa metadata tab sebelum mengirim `values:batchGet`; alias nama T1–T4 didukung, sehingga nama tab aktual dipakai untuk membuat range A1. Jika tab memang tidak ada, pesan error menunjukkan target dan daftar tab yang tersedia—bukan sekadar error parser range Google.
- **Profil sinkronisasi diketatkan.** Workbook dianggap perlu disinkronkan jika profilnya bukan `PM_2026`, termasuk workbook legacy 28 tab. Jadi profil yang hanya “dikenali” tidak lagi dianggap sudah benar.
- **Propagasi master dibatasi ke workbook tujuan PM_2026.** Backend hanya menulis kolom master ke tujuan yang mempunyai metadata tab tercatat dan tervalidasi. Workbook legacy atau workbook dengan metadata tidak lengkap dilewati agar tidak menerima data PM pada struktur yang salah.
- **Tautan lama dipertahankan untuk pemulihan.** Jika workbook aktif lama harus diganti setelah sumber PM yang valid ditemukan, file Google Sheets lama tidak dihapus. Metadata tautan lama diarsipkan pada `kk_pm_data.workbookHistory` di D1 dan cell sparse tetap dipertahankan saat referensi workbook aktif diperbarui.
- Patch sebelumnya tetap dipertahankan: izin aksi yang diperlukan bagi akun OPD/Inspektorat dengan pembatasan cakupan, lease sinkronisasi per OPD/tahun, merge cell D1 atomik, perlindungan cache in-flight, pemeriksaan status verifikasi bertingkat, serta validasi agar nilai formula tidak ditulis jika ID workbook sudah berubah.

## Pengujian lokal

Perintah berikut lulus dalam paket ini:

```bash
node --check functions/myCloudinaryHandler.js
node --check public/script.js
node tools/validate-workbook-concurrency.mjs
node tools/validate-pm-template-resolution.mjs
node tools/validate-spip-integration.mjs
```

`tools/validate-pm-template-resolution.mjs` menguji alias T1–T4, variasi nama file impor, penolakan ID legacy 28 tab, penemuan master PM yang valid melalui mock Google Drive/Sheets, dan perilaku gagal yang eksplisit ketika kandidat yang benar tidak tersedia.

Validator lama `tools/validate-inspektorat-20261014.mjs` masih berhenti pada assertion `template_source_year`. Assertion tersebut juga tidak ditemukan pada ZIP asli yang diberikan dan berkaitan dengan migrasi LHE yang tidak diubah pada patch ini; saya tidak mengubah jalur LHE di luar permintaan agar perubahan tetap terlokalisasi.

**Batas pengujian:** kredensial Google OAuth dan layanan Cloudflare produksi tidak tersedia di paket lokal. Karena itu, penemuan file sesungguhnya di Google Drive, hak akses akun produksi, dan pembuatan workbook langsung di lingkungan aktif tetap perlu dikonfirmasi setelah deployment.

## Cara deployment dan pengecekan

1. Deploy seluruh ZIP hasil revisi ke proyek Cloudflare Pages (jangan menyalin hanya satu potongan fungsi). Pastikan deployment selesai dan URL produksi memakai deployment terbaru.
2. Pastikan `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, dan `GOOGLE_DRIVE_FOLDER_ID` tersedia serta akun OAuth dapat membaca master dan membuat salinan pada folder tujuan.
3. Cara paling pasti tetap mengatur `GOOGLE_SHEETS_PM_TEMPLATE_ID` ke ID **Google Sheets hasil impor** dari `KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313.xlsx`. Revisi ini juga mencoba menemukan otomatis file valid dengan nama dasar tersebut bila ID konfigurasi ternyata mengarah ke workbook legacy. Jika nama file hasil impor berbeda sehingga tidak ditemukan, ganti ID environment ke spreadsheet PM yang benar.
4. Setelah deployment, masuk ke akun Inspektorat dan satu akun OPD percobaan, pilih tahun yang sama, buka Kertas Kerja PM, lalu klik Sinkronkan Workbook satu kali. Sukses hanya jika workbook baru memiliki profil 26 tab PM_2026. Jika tidak ditemukan sumber master valid, pesan sekarang menjelaskan konfigurasi yang perlu diperbaiki; jangan memaksa memakai template 28 tab.
5. Periksa bahwa tautan workbook lama tetap dapat dibuka dari Google Drive sebelum mengarsipkan atau menghapus apa pun. Riwayat tautannya disimpan di D1 pada `kk_pm_data.workbookHistory`; file Google Drive lama tidak dihapus oleh patch.
6. Uji dua sesi secara bersamaan: dua klik sinkronisasi pada OPD/tahun sama seharusnya diserialisasi oleh lease D1; unggahan, penyimpanan cell, dan verifikasi juga perlu diuji pada satu OPD berbeda untuk memastikan scope aksesnya benar.

## Batasan dan jaminan perubahan

Patch tidak menghapus file Google Drive, tidak menghapus cell PM, dan tidak mengubah UI/fungsi yang tidak berkaitan. Pembuatan workbook baru tetap ditolak jika tidak ada master PM_2026 yang tervalidasi—ini disengaja demi mencegah template lama disalin sebagai PM terbaru. Bila Google Drive tidak memiliki master PM 26 tab yang valid dengan nama dasar sumber yang dicari, ID master yang benar masih harus dimasukkan ke environment Cloudflare. Saya tidak mengklaim sudah melakukan tes live dengan banyak akun produksi; yang lulus adalah validasi statis dan simulasi lokal.
