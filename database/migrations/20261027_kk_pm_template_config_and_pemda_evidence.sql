-- Validated canonical master pointer and independent Pemda evidence registry.
CREATE TABLE IF NOT EXISTS kk_pm_template_config (
  config_key TEXT PRIMARY KEY,
  spreadsheet_id TEXT NOT NULL DEFAULT '',
  spreadsheet_name TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL DEFAULT '',
  validation_profile TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO kk_pm_template_config(config_key,spreadsheet_id,spreadsheet_name,updated_at,updated_by,validation_profile)
VALUES('active','1hLqUceQprwRxh1q5y0ZmW6PdI2-28H9mkYdA227vg1s','',0,'bootstrap','pending_validation');
CREATE TABLE IF NOT EXISTS pemda_workbook_evidence_items (
  upload_id TEXT PRIMARY KEY, year TEXT NOT NULL, evidence_key TEXT NOT NULL, target_code TEXT NOT NULL,
  subunsur TEXT NOT NULL, param_id TEXT NOT NULL, grade TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 0,
  file_name TEXT NOT NULL DEFAULT '', file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  r2_key TEXT, gdrive_id TEXT, sync_status TEXT NOT NULL DEFAULT 'pending', sync_error TEXT,
  verification_status TEXT NOT NULL DEFAULT '', verification_examiner TEXT NOT NULL DEFAULT '',
  verification_note TEXT NOT NULL DEFAULT '', verification_at INTEGER, created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pemda_wbe_target ON pemda_workbook_evidence_items(year,target_code,subunsur,param_id,grade);
CREATE INDEX IF NOT EXISTS idx_pemda_wbe_updated ON pemda_workbook_evidence_items(year,updated_at);
