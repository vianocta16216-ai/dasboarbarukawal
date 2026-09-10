# Realtime synchronization

This file is documentation only.

The actual realtime implementation is:

- `functions/realtime.js` — Cloudflare Pages WebSocket endpoint.
- `realtime-worker/realtime.js` — Durable Object `RealtimeHub`.
- `realtime-worker/wrangler.toml` — configuration for the realtime Worker.
- `public/script.js` — browser WebSocket client and reconnect/refresh logic.

Realtime is additive: it does not replace D1, R2, Google Drive, autosave, IndexedDB, or upload retry.
