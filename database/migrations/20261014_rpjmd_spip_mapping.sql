-- Non-destructive D1 migration for RPJMD linkage in PM SPIP workpapers.
-- The application also creates these tables idempotently in ensureOpdSchema().
CREATE TABLE IF NOT EXISTS opd_kk_rpjmd_mapping (
  year TEXT NOT NULL,
  opd_id TEXT NOT NULL,
  workpaper_code TEXT NOT NULL,
  goal_codes_json TEXT NOT NULL DEFAULT '[]',
  rationale TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Belum Diajukan',
  submitted_by TEXT NOT NULL DEFAULT '',
  verifier_name TEXT NOT NULL DEFAULT '',
  verifier_note TEXT NOT NULL DEFAULT '',
  verified_at INTEGER,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(year, opd_id, workpaper_code)
);
CREATE INDEX IF NOT EXISTS idx_opd_kk_rpjmd_mapping_lookup
  ON opd_kk_rpjmd_mapping(year, opd_id);
CREATE TABLE IF NOT EXISTS opd_kk_rpjmd_mapping_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year TEXT NOT NULL,
  opd_id TEXT NOT NULL,
  workpaper_code TEXT NOT NULL,
  status TEXT NOT NULL,
  verifier_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
