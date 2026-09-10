export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  url.pathname = '/pm_workbook.js';
  const assetResponse = await env.ASSETS.fetch(new Request(url.toString(), request));
  if (!assetResponse.ok) return assetResponse;
  const headers = new Headers(assetResponse.headers);
  headers.set('Content-Type', 'application/javascript; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=300');
  return new Response(assetResponse.body, { status: assetResponse.status, headers });
};
