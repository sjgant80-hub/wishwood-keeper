// sync-worker.js — the tiny Cloudflare Worker that lets the phones share one board. It is a DUMB store: it holds
// the latest board blob per site code and hands it back. ALL the clever merging happens in the app (keeper.mjs),
// so there is only one gated merge and this stays trivial + trustworthy. Sovereign: it runs on YOUR Cloudflare,
// your KV, free tier, MIT — no SaaS. (Wishwood already runs a worker; you can fold these two routes into it.)
//
// DEPLOY (once):
//   npx wrangler kv namespace create KEEPER      # copy the id it prints into wrangler.toml
//   npx wrangler deploy                          # prints your worker URL, e.g. https://wishwood-keeper-sync.<you>.workers.dev
// Then in the app → Sync → paste that URL, pick a board code, and send staff the invite link.
//
// SECURITY (honest): the board CODE is the key — anyone who has the code/link can read and edit the board. That's
// right for a small trusted team. Use a long code (the app generates one). Don't post the link publicly.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/b\/([A-Za-z0-9_-]{6,80})$/);   // /b/<board-code>
    if (!m) return json({ service: 'wishwood-keeper-sync', ok: true });
    const key = 'board:' + m[1];
    if (req.method === 'GET') { const v = await env.KEEPER.get(key); return json(v ? JSON.parse(v) : { empty: true }); }
    if (req.method === 'PUT') {
      const body = await req.text();
      if (body.length > 2_000_000) return json({ error: 'too big' }, 413);
      try { JSON.parse(body); } catch { return json({ error: 'bad json' }, 400); }
      await env.KEEPER.put(key, body);
      return json({ ok: true });
    }
    return json({ error: 'method not allowed' }, 405);
  },
};
