-- Shared global pacing for Google Sheets read requests (OAuth user/project quota).
-- The application creates this table idempotently from ensureOpdSchema as well.
CREATE TABLE IF NOT EXISTS google_sheets_read_pacer (
  pacer_key TEXT PRIMARY KEY,
  next_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
