-- Dedicated Google Sheets workbook link for Pemda-level KK PM SPIP.
-- Independent from opd_data. Safe to re-run; existing OPD rows and formulas are untouched.
CREATE TABLE IF NOT EXISTS pemda_kk_pm_workbooks (
  year TEXT PRIMARY KEY,
  workbook_json TEXT NOT NULL DEFAULT '{}',
  history_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL DEFAULT '',
  lease_until INTEGER NOT NULL DEFAULT 0,
  owner_token TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pemda_kk_pm_workbooks_updated
  ON pemda_kk_pm_workbooks(updated_at);
