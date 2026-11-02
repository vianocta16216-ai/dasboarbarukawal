-- Follow-up migration after 20261102 durable outbox (including earlier package versions).
ALTER TABLE drive_backup_jobs ADD COLUMN r2_ready INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_drive_backup_jobs_dispatch
  ON drive_backup_jobs(status,next_attempt_at,lease_until,dispatch_until,r2_ready,created_at);
