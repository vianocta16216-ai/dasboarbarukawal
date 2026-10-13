/**
 * Cloudflare Pages Function: /realtime
 * Proxies a browser WebSocket connection to the external Durable Object Worker.
 * The Durable Object itself lives in the separate `realtime-worker/` project.
 */

const SESSION_COOKIE_NAME = 'kawal_spip_session';
function cookieValue(request,name){for(const part of String(request.headers.get('Cookie')||'').split(';')){const idx=part.indexOf('=');if(idx>=0&&part.slice(0,idx).trim()===name){try{return decodeURIComponent(part.slice(idx+1).trim())}catch{return ''}}}return '';}
async function sha256Hex(value){const bytes=new TextEncoder().encode(String(value));const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
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
  // WebSocket rooms broadcast metadata for a whole year. Require the same server-side
  // session as the API and refuse scoped OPD users so another OPD's activity is not leaked.
  const token=cookieValue(request,SESSION_COOKIE_NAME);
  if(!token||token.length<32||!env?.DB) return new Response('Sesi login wajib tersedia untuk realtime.',{status:401});
  const tokenHash=await sha256Hex(token);
  const session=await env.DB.prepare('SELECT role,opd_ids_json,opd_names_json,expires_at FROM auth_sessions WHERE token_hash=? AND expires_at>? LIMIT 1').bind(tokenHash,Date.now()).first().catch(()=>null);
  if(!session) return new Response('Sesi realtime tidak valid atau sudah berakhir.',{status:401});
  let ids=[],names=[];try{ids=JSON.parse(session.opd_ids_json||'[]')}catch{}try{names=JSON.parse(session.opd_names_json||'[]')}catch{}
  const scoped=(Array.isArray(ids)&&ids.length>0)||(Array.isArray(names)&&names.length>0);
  if(session.role==='opd'||scoped) return new Response('Akun dengan cakupan OPD tidak menggunakan kanal realtime lintas OPD.',{status:403});
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
