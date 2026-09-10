# KAWAL SPIP — Final architecture

This repository is designed for the existing Cloudflare Pages project `kawal-spip`.

## 1. GitHub structure

```text
dasboardbarukawal/
├── functions/
│   ├── myCloudinaryHandler.js
│   ├── realtime.js
│   └── subunsur.js
├── public/
│   ├── favicon.png
│   ├── index.html
│   ├── logo.png
│   ├── script.js
│   └── style.css
├── realtime-worker/
│   ├── README.md
│   ├── realtime.js
│   └── wrangler.toml
├── .gitignore
├── package.json
├── DEPLOY_FINAL.md
├── GOOGLE_DRIVE_WAJIB.md
├── PAGES_BINDING_CONFIG.md
├── REALTIME_SYNC.md
└── README_DEPLOY.md
```

`realtime-worker/` is a separate Cloudflare Worker project stored in the same GitHub repository. It is NOT a second website.

## 2. Existing Pages bindings — keep them

The current Cloudflare Pages project already has:

- D1 binding `DB` -> `kawal-spip-db`
- R2 binding `EVIDENCE_BUCKET` -> `kawal-spip-files`
- Existing Google Drive secrets/variables

Do not delete or recreate these resources.

This package deliberately does NOT include a root `wrangler.toml` with placeholder D1/R2 IDs. The previous placeholder configuration can break a GitHub -> Pages build. Use the Cloudflare dashboard bindings that are already working.

## 3. Deploy the realtime Worker

Create/deploy a separate Worker named:

`kawal-spip-realtime`

The Worker root directory is `realtime-worker/`. Its `wrangler.toml` defines `RealtimeHub` as a SQLite-backed Durable Object.

## 4. Bind the Durable Object to Pages

In the existing Pages project, add a Durable Object binding:

- Binding name: `REALTIME`
- Durable Object class: `RealtimeHub`
- Script/Worker: `kawal-spip-realtime`

Cloudflare Pages requires the Durable Object to live in an already-deployed Worker.

## 5. What the Pages Function does

`functions/realtime.js` exposes:

`/realtime?year=2026`

It forwards the WebSocket to the external `RealtimeHub` Durable Object.

`public/script.js` connects automatically, reconnects after disconnection, and refreshes the selected year's data after a remote mutation. If the user is typing in an input/textarea/select, the remote refresh is delayed until the field is no longer focused to avoid wiping local typing.

## 6. Storage guarantee

Evidence remains in Cloudflare R2 after Google Drive succeeds. Google Drive remains mandatory before an evidence item is marked `done`.

Realtime does not replace:

- D1
- R2
- Google Drive
- offline autosave
- IndexedDB pending-file storage
- retry/idempotency logic

## 7. Recommended deployment order

1. Keep the existing Pages D1/R2/Google Drive configuration unchanged.
2. Deploy the `realtime-worker/` Worker as `kawal-spip-realtime`.
3. Add the Pages binding `REALTIME` -> `RealtimeHub@kawal-spip-realtime`.
4. Push the repository to GitHub so Cloudflare Pages deploys the updated `functions/` and `public/` files.
5. Open the same year in two browsers/operators and test one field change and one evidence upload.
