/**
 * Cloudflare Pages Function: /realtime
 * Proxies a browser WebSocket connection to the external Durable Object Worker.
 * The Durable Object itself lives in the separate `realtime-worker/` project.
 */

function safeYear(value) {
  const year = String(value || '').trim();
  return /^[0-9]{4}$/.test(year) ? year : String(new Date().getUTCFullYear());
}

export async function onRequest({ request, env }) {
  if (!env?.REALTIME) {
    return new Response('Realtime binding REALTIME belum dikonfigurasi di Cloudflare Pages.', { status: 503 });
  }

  if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
    return new Response(JSON.stringify({ status: 'ok', message: 'Realtime endpoint aktif. Gunakan WebSocket.' }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  const url = new URL(request.url);
  const year = safeYear(url.searchParams.get('year'));
  const room = `year:${year}`;
  const id = env.REALTIME.idFromName(room);
  const stub = env.REALTIME.get(id);

  const target = new URL('https://kawal-spip-realtime.internal/websocket');
  target.searchParams.set('year', year);
  target.searchParams.set('room', room);

  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete('host');

  return stub.fetch(new Request(target.toString(), {
    method: 'GET',
    headers: forwardHeaders
  }));
}
