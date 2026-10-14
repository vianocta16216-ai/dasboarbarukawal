/**
 * Cloudflare Pages Function: /realtime
 * Authenticated, scope-filtered WebSocket proxy to the realtime Durable Object.
 * Only event metadata is broadcast; every scoped client receives events for the
 * OPD IDs it is authorized to access, never the whole year's activity feed.
 */
const SESSION_COOKIE_NAME = 'kawal_spip_session';
function cookieValue(request,name){for(const part of String(request.headers.get('Cookie')||'').split(';')){const idx=part.indexOf('=');if(idx>=0&&part.slice(0,idx).trim()===name){try{return decodeURIComponent(part.slice(idx+1).trim())}catch{return ''}}}return '';}
async function sha256Hex(value){const bytes=new TextEncoder().encode(String(value));const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function safeYear(value){const year=String(value||'').trim();return /^[0-9]{4}$/.test(year)?year:String(new Date().getUTCFullYear());}
function safeJsonArray(value){try{const x=JSON.parse(value||'[]');return Array.isArray(x)?x.map(v=>String(v||'').trim()).filter(Boolean):[]}catch{return []}}
function normalizeOrg(value){return String(value?.opd||value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();}

export async function onRequest({request,env}){
  if(!env?.REALTIME)return new Response('Realtime binding REALTIME belum dikonfigurasi di Cloudflare Pages.',{status:503});
  if((request.headers.get('Upgrade')||'').toLowerCase()!=='websocket')return new Response(JSON.stringify({status:'ok',message:'Realtime endpoint aktif. Gunakan WebSocket.'}),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  const url=new URL(request.url),year=safeYear(url.searchParams.get('year'));
  const token=cookieValue(request,SESSION_COOKIE_NAME);
  if(!token||token.length<32||!env?.DB)return new Response('Sesi login wajib tersedia untuk realtime.',{status:401});
  const tokenHash=await sha256Hex(token);
  // Read live role/scope from auth_users; a session row alone may be stale after an admin changes an account.
  const session=await env.DB.prepare(`SELECT s.username,s.expires_at,u.role,u.opd_ids_json,u.opd_names_json,u.enabled
    FROM auth_sessions s JOIN auth_users u ON u.username_key=lower(s.username)
    WHERE s.token_hash=? AND s.expires_at>? AND COALESCE(u.enabled,0)=1 LIMIT 1`).bind(tokenHash,Date.now()).first().catch(()=>null);
  if(!session)return new Response('Sesi realtime tidak valid atau sudah berakhir.',{status:401});
  const role=String(session.role||'').toLowerCase();
  const ids=safeJsonArray(session.opd_ids_json),names=safeJsonArray(session.opd_names_json);
  const wildcard=ids.includes('*')||names.includes('*');
  const allAccess=role==='admin'||wildcard||(!ids.length&&!names.length&&role!=='opd');
  let allowedIds=[];
  if(!allAccess){
    if(role==='opd'&&!ids.length&&!names.length)return new Response('Akun OPD belum memiliki cakupan OPD yang sah.',{status:403});
    const result=await env.DB.prepare('SELECT id,opd FROM opd_data WHERE year=?').bind(year).all().catch(()=>({results:[]}));
    const nameSet=new Set(names.map(normalizeOrg));
    const idSet=new Set(ids);
    allowedIds=(result.results||[]).filter(row=>idSet.has(String(row.id))||nameSet.has(normalizeOrg(row.opd))).map(row=>String(row.id)).filter(Boolean);
    if(!allowedIds.length)return new Response('Cakupan akun tidak cocok dengan OPD pada Tahun Anggaran ini; realtime ditolak agar data tidak bocor.',{status:403});
  }
  const room=`year:${year}`;
  const id=env.REALTIME.idFromName(room),stub=env.REALTIME.get(id);
  const target=new URL('https://kawal-spip-realtime.internal/websocket');target.searchParams.set('year',year);target.searchParams.set('room',room);
  const forwardHeaders=new Headers(request.headers);
  forwardHeaders.delete('host');forwardHeaders.delete('cookie');forwardHeaders.delete('authorization');
  forwardHeaders.set('X-Kawal-Realtime-Access',allAccess?'all':'scoped');
  forwardHeaders.set('X-Kawal-Realtime-Role',role);
  forwardHeaders.set('X-Kawal-Realtime-Opd-Ids',JSON.stringify(allowedIds));
  return stub.fetch(new Request(target.toString(),{method:'GET',headers:forwardHeaders}));
}
