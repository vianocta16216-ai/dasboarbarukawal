# Cloudflare Pages bindings for KAWAL SPIP

The repository intentionally does **not** include a root `wrangler.toml` with placeholder D1/R2 values. This prevents a GitHub -> Cloudflare Pages build from failing because of placeholder configuration.

Keep the existing Pages dashboard bindings exactly as they are:

| Type | Binding name | Resource |
|---|---|---|
| D1 | `DB` | `kawal-spip-db` |
| R2 | `EVIDENCE_BUCKET` | `kawal-spip-files` |

Keep all existing Google Drive environment variables/secrets.

Add one more binding to the Pages project:

| Type | Binding name | Target |
|---|---|---|
| Durable Object | `REALTIME` | Class `RealtimeHub` from Worker `kawal-spip-realtime` |

Cloudflare Pages requires an existing Durable Object Worker for this binding.

## Realtime Worker deployment

Deploy the directory `realtime-worker/` as a separate Worker named:

`kawal-spip-realtime`

Its Durable Object class is:

`RealtimeHub`

The Worker configuration uses SQLite-backed Durable Object storage.

After the Worker exists, add the Pages Durable Object binding above. The Pages Function `functions/realtime.js` will then expose:

`/realtime?year=2026`

The browser connects to that endpoint automatically.
