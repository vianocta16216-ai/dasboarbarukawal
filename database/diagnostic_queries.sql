-- Jalankan tiap SELECT di Cloudflare D1 Console setelah paket terbaru ter-deploy.
-- Tidak ada query di file ini yang mengubah atau menghapus data.

-- 1) Akun terkelola menurut role dan status.
SELECT role, COUNT(*) AS total_akun,
       SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS aktif,
       SUM(CASE WHEN enabled=0 THEN 1 ELSE 0 END) AS nonaktif
FROM auth_users
GROUP BY role ORDER BY role;

-- 2) Jumlah OPD unik per tahun. Master target pada tahun yang sudah direkonsiliasi: 28.
SELECT year,
       COUNT(*) AS jumlah_baris,
       COUNT(DISTINCT UPPER(TRIM(opd))) AS jumlah_opd_unik
FROM opd_data
GROUP BY year ORDER BY year;

-- 3) Daftar tenant untuk satu tahun tertentu (ganti 2026 dengan tahun aktif).
SELECT year, id AS opd_id, opd
FROM opd_data
WHERE year='2026'
ORDER BY opd;

-- 4) Spreadsheet ID yang tertaut ke KK PM, PK, dan RTP (nama kolom JSON tergantung format legacy).
-- Jika semua nilai NULL/kosong, tautan workbook belum disimpan atau format legacy perlu diperiksa.
SELECT year, id AS opd_id, opd,
       json_extract(kk_pm_data, '$.workbook.workbookSpreadsheetId') AS kk_pm_spreadsheet_id,
       COALESCE(json_extract(kk_data, '$.workbook.workbookSpreadsheetId'),
                json_extract(kk_data, '$.spreadsheetId')) AS pk_spreadsheet_id,
       COALESCE(json_extract(kk_rtp_data, '$.workbook.workbookSpreadsheetId'),
                json_extract(kk_rtp_data, '$.spreadsheetId')) AS rtp_spreadsheet_id
FROM opd_data ORDER BY year, opd;

-- 5) Ketersediaan dan sinkronisasi berkas bukti per OPD.
SELECT year, opd_id, COUNT(*) AS jumlah_file,
       SUM(CASE WHEN TRIM(COALESCE(r2_key,''))<>'' THEN 1 ELSE 0 END) AS ada_di_r2,
       SUM(CASE WHEN sync_status='done' THEN 1 ELSE 0 END) AS sinkron_drive,
       SUM(CASE WHEN sync_status IN ('retrying','pending') THEN 1 ELSE 0 END) AS perlu_diperiksa
FROM evidence_upload_registry
GROUP BY year, opd_id ORDER BY year, opd_id;

-- 6) Status verifikasi bukti KK workbook.
SELECT year, opd_id, verification_status, sync_status, COUNT(*) AS jumlah
FROM opd_workbook_evidence_items
GROUP BY year, opd_id, verification_status, sync_status
ORDER BY year, opd_id;

-- 7) Keterisian kertas kerja KK PM per OPD dan target.
SELECT year, opd_id, target, COUNT(*) AS total_parameter,
       SUM(CASE WHEN grade_result IN ('A','B','C','D','E') THEN 1 ELSE 0 END) AS terisi
FROM opd_kk_pm_workpaper_items
GROUP BY year, opd_id, target ORDER BY year, opd_id, target;

-- 8) Tindak lanjut LHE per sumber tahun/status pelaksanaan/status verifikasi.
SELECT year, opd_id, source_year, status, verification_status, COUNT(*) AS jumlah_item
FROM lhe_followup_items
GROUP BY year, opd_id, source_year, status, verification_status
ORDER BY year, opd_id, source_year, status;

-- 9) Audit verifikasi bukti per tahap.
SELECT year, stage, status, COUNT(*) AS jumlah
FROM evidence_verification_audit
GROUP BY year, stage, status ORDER BY year, stage, status;

-- 10) Status kompatibilitas hash password untuk diagnosis login. READ ONLY.
-- Hash lama >100000 perlu dimigrasikan sebelum akun itu dapat memverifikasi password di Workers.
SELECT role,
       COUNT(*) AS total_akun,
       SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS aktif,
       SUM(CASE WHEN enabled=0 THEN 1 ELSE 0 END) AS nonaktif,
       SUM(CASE WHEN password_iterations > 100000 THEN 1 ELSE 0 END) AS hash_lama_perlu_diperiksa,
       SUM(CASE WHEN password_iterations <= 100000 THEN 1 ELSE 0 END) AS hash_kompatibel
FROM auth_users
GROUP BY role ORDER BY role;

-- 11) Username/status hash untuk menemukan akun yang belum kompatibel.
-- Tidak menampilkan password, salt, ataupun password_hash.
SELECT username, role, enabled, password_iterations,
       CASE WHEN password_changed_at = created_at THEN 'bootstrap/default'
            ELSE 'pernah diubah/reset' END AS status_password
FROM auth_users
ORDER BY role, username;
