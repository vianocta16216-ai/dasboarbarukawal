# Perbaikan Validasi Master PM SPIP yang Fleksibel — 27 Oktober 2026

## Masalah yang diperbaiki

Dashboard menolak master yang ditunjuk oleh ID `1hLqUceQprwRxh1q5y0ZmW6PdI2-28H9mkYdA227vg1s` karena tab fisik berjumlah 28, bukan tepat 26. Empat tab inti hadir dengan nama berbeda dari manifest:

| Nama pada master saat ini | Tab inti yang dikenali aplikasi |
|---|---|
| `KKE 2.3 SASSUBKES` | `KKE 2.3 SASSUBKEG` |
| `KK 5.1 A RPJMD (BP4D)` | `KK 5.1 A` |
| `KK 6 INSPEKTORAT` | `KK 6` |
| `KK 7 INSPEKTORAT` | `KK 7` |
| `KK 8 INSPEKTORAT` | `KK 8` |

Tab `CHECKLIST PK` dan `KK 4 INSPEKTORAT` dianggap sebagai tab ekstra. Keberadaan tab ekstra tidak lagi menggagalkan pembaruan.

## Aturan validasi baru

1. Semua 26 tab inti PM harus ada tepat satu kali setelah normalisasi nama/alias.
2. Urutan tab bebas; jumlah fisik tab boleh lebih dari 26.
3. Tab ekstra (termasuk tab admin/legacy) dicatat sebagai informasi dan diizinkan selama tidak menggantikan atau menggandakan tab inti.
4. Empat formula inti pada `KKLEAD_SPIP!I11`, `I68`, `I85`, dan `I106` tetap harus valid.
5. Workbook lama tetap dipertahankan jika validasi gagal. Pembaruan massal tetap hanya dapat dijalankan oleh akun Pemda/Super Admin (`admin`) dan Irban.
6. Alias juga digunakan oleh antarmuka saat mencocokkan tab manifest terhadap `sheetId`/`gid` aktual, supaya tombol “Buka Sheet Ini” tidak gagal hanya karena label tab diberi tambahan `BP4D` atau `INSPEKTORAT`.

## Pasang dan jalankan

1. Backup repository GitHub yang saat ini digunakan Cloudflare Pages.
2. Ekstrak ZIP source terbaru dan ganti source aplikasi dengan isi ZIP tersebut.
3. Commit/push dan deploy ulang ke Cloudflare Pages.
4. Login ke aplikasi menggunakan akun Pemda (`admin`) atau Irban.
5. Pada dashboard KK PM SPIP Pemda, pertahankan/masukkan ID master di atas lalu klik **Validasi ID & Perbarui Semua Workbook**.
6. Tunggu ringkasan selesai. Periksa jumlah workbook Pemda dan OPD yang berhasil/gagal, status mirror R2, serta status arsip Google Drive. Jika formula inti tidak cocok atau tab inti benar-benar hilang/duplikat, aplikasi akan menolak dengan diagnosis yang lebih spesifik.

## Batasan verifikasi

Validasi source dan regresi dilaksanakan lokal. Saya tidak memiliki sesi OAuth produksi di percakapan ini, sehingga tidak bisa menjalankan penulisan langsung ke Google Drive, D1 produksi, atau bucket R2 produksi. Penggantian workbook aktif dilakukan oleh source ini setelah dideploy dan aksi massal dijalankan di dashboard.
