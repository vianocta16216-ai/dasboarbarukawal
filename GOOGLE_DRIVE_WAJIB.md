# Evidence WAJIB Tersimpan di R2 + Google Drive

Versi ini menerapkan **dual storage** untuk evidence: setiap file yang berhasil diunggah akan dipertahankan di **Cloudflare R2 DAN Google Drive**.

## Aturan utama

1. Browser mengirim file ke Cloudflare.
2. Backend menyimpan file ke **R2** terlebih dahulu.
3. Metadata evidence dicatat di D1 dengan `syncStatus: pending`.
4. Backend mengunggah file yang sama ke **Google Drive**.
5. Backend baru memberi status **`done`** setelah Google Drive mengembalikan `gdriveId` nyata.
6. Setelah Google Drive berhasil, **salinan R2 TIDAK DIHAPUS**. Kedua salinan tetap disimpan.
7. Jika Google Drive gagal, file tetap aman di R2 dan status menjadi `retrying`; sistem menyediakan retry otomatis/manual.
8. Retry menggunakan `uploadId` + `appProperties.kawalUploadId` untuk mencegah duplikasi file di Google Drive.
9. Upload Google Drive menggunakan resumable upload + retry/backoff untuk menghadapi timeout, 429, dan error 5xx.
10. Saat pengguna sengaja menghapus evidence, sistem mencoba menghapus Google Drive terlebih dahulu. Jika penghapusan Drive gagal, **R2 tidak ikut dihapus**, sehingga backup tidak hilang karena kegagalan satu layanan.

## Status yang digunakan

- `pending` — file sudah masuk R2, sedang menunggu sinkronisasi Drive.
- `retrying` — file tetap aman di R2 tetapi Drive belum berhasil; retry dapat dilakukan.
- `done` — **R2 + Google Drive** sudah tersimpan dan `gdriveId` tersedia.

## Environment Variables wajib

- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_FOLDER_ID`

Jika salah satu belum tersedia, endpoint upload evidence akan menolak proses sebelum dianggap berhasil.

## Catatan untuk 50–100+ user

Backend sudah memakai pembatas concurrency Google Drive per instance, token/folder caching, idempotency berdasarkan `uploadId`, resumable upload, dan retry/backoff. Browser juga mencoba kembali evidence yang masih `retrying`.

Untuk ketahanan maksimal ketika semua browser pengguna offline/tertutup, lapisan **Cloudflare Queue + consumer** tetap dapat ditambahkan sebagai mekanisme retry server-side yang benar-benar durable. Versi ini sengaja mempertahankan aturan paling aman: **tidak pernah menyatakan evidence sukses sebelum Google Drive benar-benar mengonfirmasi file**.
