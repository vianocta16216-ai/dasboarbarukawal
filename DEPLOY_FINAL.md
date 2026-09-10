# Deployment FINAL – Dual Storage + Concurrency Safety

- Evidence files are permanently retained in Cloudflare R2.
- The same evidence is required to reach Google Drive before the UI reports `done`.
- R2 object names include `uploadId`, preventing same-name uploads from overwriting each other.
- Evidence metadata is appended to the specific JSON array with an atomic D1 UPDATE instead of stale whole-JSON read/replace.
- File status updates target the specific array element, so different operators updating different files do not overwrite unrelated evidence metadata.
- Browser data autosave remains in localStorage; pending upload files are additionally persisted in IndexedDB so a refresh/close/reopen can resume them.
- Google Drive uploads use retry/backoff and idempotency via `uploadId`.

Recommended Cloudflare production setup: keep the D1 and R2 bindings and all existing Google Drive secrets exactly as configured. This ZIP does not delete or replace R2 objects after a successful Google Drive upload.
