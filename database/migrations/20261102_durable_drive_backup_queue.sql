-- Durable, idempotent Google Drive backup outbox for evidence already stored in R2.
CREATE TABLE IF NOT EXISTS drive_backup_jobs (
  upload_id TEXT PRIMARY KEY,
  job_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','retrying','done')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  dispatch_until INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_drive_backup_jobs_due
  ON drive_backup_jobs(status,next_attempt_at,lease_until,dispatch_until,created_at);
CREATE TABLE IF NOT EXISTS google_drive_upload_pacer (
  pacer_key TEXT PRIMARY KEY,
  next_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
