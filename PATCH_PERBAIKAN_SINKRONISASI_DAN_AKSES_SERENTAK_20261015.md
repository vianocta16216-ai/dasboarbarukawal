# Patch sinkronisasi workbook PM dan akses serentak

Tanggal: 15 Oktober 2026

## Temuan pada ZIP yang diperiksa

1. Rekaman layar menunjukkan backend menolak template Google Sheets yang bukan profil PM terbaru 26 sheet. Kode lama masih dapat memakai `GOOGLE_SHEETS_TEMPLATE_ID` atau ID default lama sebagai fallback. Pesan UI menyebut `KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313.xlsx` sebagai sumber impor yang diperlukan.
2. Daftar izin untuk akun terbatas belum memuat beberapa aksi yang benar-benar dipanggil UI, termasuk `getQaApipData`, `getKkRpjmdMappings`, `getBpkpOfficialScore`, dan `syncKkComputedValues`. Akibatnya akun dengan scope OPD dapat menerima HTTP 403 meskipun UI memanggil aksi itu untuk OPD yang ditugaskan.
3. Pembuatan/sinkronisasi workbook tidak memiliki lease lintas Cloudflare isolate untuk satu pasangan OPD/tahun. Klik ganda atau dua akun pada OPD sama dapat membuat salinan Google Sheets ganda dan salah satunya menjadi yatim.
4. Penyimpanan sparse `kk_pm_data.cells` mengganti seluruh JSON blob dan dapat menghapus metadata link workbook atau menimpa perubahan cell dari tab/sesi lain.
5. Cache master yang masih dalam permintaan (in-flight) dapat dikembalikan saat pemuatan paksa dan respons lama bisa menulis cache sesudah permintaan baru.
6. Webhook Apps Script (`syncKkPmMasterNow`) dikirim tanpa cookie browser, tetapi jalur autentikasi umum memeriksa sesi sebelum mencapai validasi secret. Webhook yang sah berpotensi ditolak oleh penjaga sesi.
7. UI menyimpan objek `kkPmMaster` di memori dan langsung mengembalikannya setelah pertama kali dimuat, sehingga pembukaan modal PM berikutnya tidak meminta data master live terbaru meskipun backend sudah punya mekanisme refresh.

## Perubahan kode

- Daftar izin scoped account dilengkapi untuk pembacaan/sinkronisasi yang digunakan UI. Secara khusus role Inspektorat/Irban diizinkan menjalankan `createKkPmSheets` dan `syncKkComputedValues`, namun hanya pada OPD yang berada dalam cakupan sesi. Guard `assertSessionCanAccessOpd` tetap aktif; aksi administrasi akun dan finalisasi nilai resmi BPKP tidak dibuka.
- Template PM baru sekarang hanya memakai `GOOGLE_SHEETS_PM_TEMPLATE_ID`. Tidak ada fallback diam-diam ke template PK/legacy. Workbook tertaut yang sudah valid tetap bisa dipakai walau konfigurasi template baru perlu diperbaiki.
- Sebelum membuat salinan baru, master diverifikasi: profil 26 sheet, urutan nama sheet, dan formula inti. Pesan error menampilkan jumlah/tab aktual dan perbedaan pertama untuk diagnosis. Salinan baru tidak ditautkan ke D1 sebelum lolos verifikasi.
- `kk_pm_workbook_sync_locks` memakai lease dan token pemilik di D1 untuk menserialisasi proses buat/sinkronkan pada OPD/tahun yang sama. Permintaan kedua mendapat HTTP 409 yang dapat ditindaklanjuti; lock hanya dilepas oleh pemiliknya.
- Penyimpanan `kk_pm_data` menggunakan `json_patch` di D1 untuk menggabungkan cell sparse secara atomik, mempertahankan metadata workbook serta key cell lain yang disimpan bersamaan.
- Pembacaan master menggunakan generasi cache; pemuatan paksa membatalkan cache dan respons lama tidak dapat meng-overwrite cache hasil refresh terbaru. UI PM sekarang juga meminta refresh live setiap kali modal dibuka (dengan satu permintaan bersama untuk panggilan yang berimpit), snapshot statis tidak ditahan oleh cache browser, dan status UI secara terang membedakan master live dari snapshot fallback agar kegagalan refresh tidak dilaporkan sebagai sukses.
- Webhook Apps Script bisa berjalan tanpa cookie hanya bila request POST membawa secret yang cocok dengan `KK_MASTER_SYNC_SECRET` (minimal 32 karakter). Request tanpa secret tetap ditolak.
- Sinkronisasi nilai formula menulis hasil hanya apabila ID workbook sumber masih merupakan workbook yang tertaut ke OPD/tahun tersebut; respons lama tidak boleh meng-update skor setelah link berubah.
- Transisi verifikasi bertingkat Auditor → Irban → BPKP memeriksa status tahapan sebelumnya di pernyataan D1 yang sama dengan penyimpanan. Permintaan verifikasi yang memakai status lama mendapat HTTP 409 dan tidak menyimpan keputusan tahap yang sudah tidak memenuhi prasyarat.

## Pengujian lokal

Jalankan dari root repository:

```bash
node --check functions/myCloudinaryHandler.js
node --check public/script.js
node tools/validate-spip-integration.mjs
node tools/validate-workbook-concurrency.mjs
```

Pengujian ini memeriksa sintaks, master RPJMD, dan invariant utama patch secara statis. Simulasi SQLite lokal juga memeriksa merge JSON, lock lintas pemanggilan, dan prasyarat verifikasi bertingkat. Validator lama `tools/validate-inspektorat-20261014.mjs` pada ZIP awal masih berhenti pada assertion migrasi LHE `template_source_year` yang tidak ada pada kode yang disertakan; itu isu validator/migrasi LHE yang terpisah dan tidak saya ubah agar ruang perubahan tetap fokus. Pengujian lokal tidak dapat menguji OAuth, Google Drive/Sheets, D1 produksi, R2, Cloudflare Pages, atau perilaku browser sesungguhnya karena kredensial dan layanan produksi tidak tersedia pada paket lokal.

## Langkah wajib di Cloudflare sebelum sinkronisasi berhasil

1. Di Google Drive, impor `KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313.xlsx` sebagai **Google Sheets**, bukan sekadar menyimpan XLSX di Drive. Pastikan master hasil impor mempunyai 26 tab dengan nama dan urutan profil PM terbaru serta formula inti yang benar.
2. Beri akun Google dari `GOOGLE_DRIVE_REFRESH_TOKEN` akses ke master hasil impor dan folder output.
3. Di Cloudflare Pages > Settings > Variables and Secrets, atur `GOOGLE_SHEETS_PM_TEMPLATE_ID` ke **ID Google Sheets master yang baru**. Jangan mengarahkannya ke template PK/legacy. Pastikan `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, dan `GOOGLE_DRIVE_FOLDER_ID` benar.
4. Untuk trigger Apps Script, samakan `KAWAL_SPIP_SYNC_SECRET` pada Script Properties dengan secret `KK_MASTER_SYNC_SECRET` di Cloudflare (minimal 32 karakter), lalu deploy proyek Pages terbaru.
5. Uji pada tahun/OPD percobaan: sinkronkan workbook, pastikan 26 tab tervalidasi, buka dua sesi pada OPD yang sama dan tekan sinkronkan hampir bersamaan (permintaan kedua harus mendapat informasi proses sedang berjalan, bukan membuat salinan duplikat), lalu uji dua akun berbeda menyimpan item/evidence dan verifikasi.
6. Setelah deploy, periksa DevTools Network. Permintaan dengan akses sah tidak boleh lagi mendapat `403 Role akun tidak memiliki izin`; jika master template salah, error harus menyebut tab/urutan yang tidak cocok. Jangan hapus workbook lama secara manual sebelum workbook baru diverifikasi.

## Batasan penting

Kode lokal tidak dapat mengetahui ID Google Sheets master baru yang ada di akun Google/Cloudflare Anda, dan paket ZIP ini tidak memuat file XLSX sumber `KK_PM_SPIP_Pemda_27042026_AUDIT_EVIDENCE_LENGKAP2313.xlsx`. Karena itu, kode mencegah penggunaan template lama secara diam-diam dan memberi diagnostik, tetapi **ID `GOOGLE_SHEETS_PM_TEMPLATE_ID` yang benar tetap wajib disetel pada environment Cloudflare** sebelum pembuatan workbook baru dapat berhasil. Tidak ada workbook/record produksi yang dihapus oleh patch ini.
