-- KAWAL SPIP: workflow Kertas Kerja Pemerintah Kabupaten Mahakam Ulu.
-- Idempotent migration; the Worker also creates these tables at bootstrap.
CREATE TABLE IF NOT EXISTS pemda_sampling_workflow (
  year TEXT NOT NULL,
  opd_id TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0,
  sample_reason TEXT NOT NULL DEFAULT '',
  pm_status TEXT NOT NULL DEFAULT 'belum',
  pm_examiner TEXT NOT NULL DEFAULT '',
  pm_note TEXT NOT NULL DEFAULT '',
  pm_updated_by TEXT NOT NULL DEFAULT '',
  pm_updated_at INTEGER NOT NULL DEFAULT 0,
  qa_status TEXT NOT NULL DEFAULT 'belum',
  qa_examiner TEXT NOT NULL DEFAULT '',
  qa_note TEXT NOT NULL DEFAULT '',
  qa_updated_by TEXT NOT NULL DEFAULT '',
  qa_updated_at INTEGER NOT NULL DEFAULT 0,
  bpkp_status TEXT NOT NULL DEFAULT 'belum',
  bpkp_examiner TEXT NOT NULL DEFAULT '',
  bpkp_note TEXT NOT NULL DEFAULT '',
  bpkp_updated_by TEXT NOT NULL DEFAULT '',
  bpkp_updated_at INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (year, opd_id)
);
CREATE INDEX IF NOT EXISTS idx_pemda_sampling_year_sample
  ON pemda_sampling_workflow(year, is_sample, opd_id);

CREATE TABLE IF NOT EXISTS pemda_sampling_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year TEXT NOT NULL,
  opd_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_value TEXT NOT NULL DEFAULT '',
  new_value TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pemda_sampling_audit_lookup
  ON pemda_sampling_audit(year, opd_id, created_at);
