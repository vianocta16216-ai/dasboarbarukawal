/**
 * Durable Object WebSocket hub for multi-user realtime synchronization.
 * One Durable Object instance is used per year, keeping traffic for a year
 * isolated while allowing many OPDs/operators to share the same channel.
 */
export class RealtimeHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/broadcast') {
      let payload = null;
      try { payload = await request.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
      const message = JSON.stringify({ type: 'realtime', payload, at: new Date().toISOString() });
      for (const ws of [...this.sockets]) {
        try { ws.send(message); } catch { try { ws.close(); } catch {} this.sockets.delete(ws); }
      }
      return new Response(JSON.stringify({ status: 'ok', clients: this.sockets.size }), { headers: { 'content-type': 'application/json' } });
    }

    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') return new Response('Realtime endpoint OK', { status: 200 });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.sockets.add(server);
    server.addEventListener('close', () => this.sockets.delete(server));
    server.addEventListener('error', () => this.sockets.delete(server));
    server.send(JSON.stringify({ type: 'connected', at: new Date().toISOString() }));
    return new Response(null, { status: 101, webSocket: client });
  }
}

export function onRequestGet({ request, env }) {
  return handleRealtime(request, env);
}

export function onRequestPost({ request, env }) {
  return handleRealtime(request, env);
}

async function handleRealtime(request, env) {
  if (!env.REALTIME) return new Response('Realtime binding belum dikonfigurasi', { status: 503 });
  const url = new URL(request.url);
  const year = String(url.searchParams.get('year') || '').trim();
  if (!year) return new Response('Parameter year wajib diisi', { status: 400 });
  const id = env.REALTIME.idFromName(`year:${year}`);
  const stub = env.REALTIME.get(id);
  const target = new URL('https://realtime/ws');
  target.searchParams.set('year', year);
  const forwarded = new Request(target.toString(), request);
  return stub.fetch(forwarded);
}
