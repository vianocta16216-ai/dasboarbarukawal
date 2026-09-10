import { DurableObject } from 'cloudflare:workers';

const MAX_MESSAGE_BYTES = 16 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function safeText(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

export class RealtimeHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'POST' && path === '/broadcast') {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ status: 'error', message: 'Payload realtime tidak valid.' }, 400);
      }

      const data = JSON.stringify({
        type: 'data-changed',
        year: safeText(payload?.year, 4),
        action: safeText(payload?.action, 60),
        opdId: payload?.opdId ? safeText(payload.opdId, 120) : null,
        uploadId: payload?.uploadId ? safeText(payload.uploadId, 120) : null,
        storage: payload?.storage ? safeText(payload.storage, 80) : null,
        syncStatus: payload?.syncStatus ? safeText(payload.syncStatus, 40) : null,
        at: payload?.at || new Date().toISOString()
      });

      let sent = 0;
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(data);
          sent++;
        } catch {
          try { ws.close(1011, 'Realtime connection error'); } catch {}
        }
      }
      return json({ status: 'ok', sent });
    }

    if (path !== '/websocket') {
      return json({ status: 'ok', connections: this.ctx.getWebSockets().length });
    }

    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const year = safeText(url.searchParams.get('year'), 4);

    this.ctx.acceptWebSocket(server, ['kawal-spip']);
    server.serializeAttachment({ year, connectedAt: Date.now() });

    try {
      server.send(JSON.stringify({
        type: 'connected',
        year,
        at: new Date().toISOString()
      }));
    } catch {}

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    let text = '';
    try {
      text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    } catch {
      return;
    }
    if (text.length > MAX_MESSAGE_BYTES) return;

    // Client heartbeats are handled here without broadcasting arbitrary client data.
    try {
      const parsed = JSON.parse(text);
      if (parsed?.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', at: new Date().toISOString() }));
      }
    } catch {
      // Ignore non-JSON client messages.
    }
  }

  webSocketClose(ws) {
    try { ws.close(); } catch {}
  }

  webSocketError(ws) {
    try { ws.close(1011, 'Realtime error'); } catch {}
  }
}

export default {
  async fetch() {
    return new Response('kawal-spip realtime worker', { status: 200 });
  }
};
