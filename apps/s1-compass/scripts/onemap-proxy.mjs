// A small proxy for OneMap, so visitors never need a OneMap token and the login stays on the server.
// It forwards only routing and address search, adds the token, renews it before it expires, and answers CORS.
//
//   ONEMAP_EMAIL=you@example.com ONEMAP_PASSWORD=... ALLOW_ORIGIN=https://your.site node scripts/onemap-proxy.mjs
//
// Then set oneMapBase in config.js to the proxy's address (for example https://maps-proxy.your.site).
// Environment: ONEMAP_EMAIL, ONEMAP_PASSWORD (required), ALLOW_ORIGIN (default *), PORT (default 8787),
// ONEMAP_UPSTREAM (default https://www.onemap.gov.sg), RATE_PER_MINUTE per visitor address (default 120).
// Needs Node 18 or later; no packages. server.mjs mounts the same handler under /onemap.

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const PATHS = new Set(['/api/public/routingsvc/route', '/api/common/elastic/search']);
const NEEDS_TOKEN = new Set(['/api/public/routingsvc/route']);

/**
 * A request handler for the two OneMap paths. `prefix` is stripped from the path first (for example '/onemap').
 * Options: email, password (required), upstream, origin (CORS; empty for same-origin only), rate (requests a minute
 * per visitor), prefix.
 */
export function createOneMapHandler({ email, password, upstream = 'https://www.onemap.gov.sg', origin = '*', rate = 120, prefix = '' }) {
  upstream = upstream.replace(/\/$/, '');
  let cached = null; // { token, until }
  async function token(force = false) {
    if (!force && cached && cached.until > Date.now()) return cached.token;
    const res = await fetch(`${upstream}/api/auth/post/getToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`OneMap token request failed: ${res.status}`);
    const j = await res.json();
    if (!j.access_token) throw new Error('OneMap token response had no access_token');
    const until = j.expiry_timestamp ? Number(j.expiry_timestamp) * 1000 - 10 * 60e3 : Date.now() + 12 * 3600e3;
    cached = { token: j.access_token, until };
    return cached.token;
  }

  const hits = new Map();
  function allowed(ip) {
    const now = Date.now();
    const list = (hits.get(ip) || []).filter(t => now - t < 60e3);
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < 60e3)) hits.delete(k);
    return list.length <= rate;
  }

  async function forward(path, search, attempt = 0) {
    const headers = {};
    if (NEEDS_TOKEN.has(path)) headers.Authorization = await token(attempt > 0);
    const res = await fetch(`${upstream}${path}${search}`, { headers });
    if (res.status === 401 && NEEDS_TOKEN.has(path) && attempt === 0) return forward(path, search, 1);
    return res;
  }

  return async function handle(req, res) {
    if (origin) { // empty: same-origin only (server.mjs), so no other site can spend your OneMap quota
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    const url = new URL(req.url, 'http://proxy');
    const path = prefix && url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname;
    if (req.method !== 'GET' || !PATHS.has(path)) { res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"not found"}'); return; }
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '';
    if (!allowed(ip)) { res.writeHead(429, { 'Content-Type': 'application/json' }).end('{"error":"too many requests"}'); return; }
    try {
      const up = await forward(path, url.search);
      res.writeHead(up.status, { 'Content-Type': up.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
      res.end(Buffer.from(await up.arrayBuffer()));
    } catch (e) {
      console.error(e.message);
      res.writeHead(502, { 'Content-Type': 'application/json' }).end('{"error":"upstream unavailable"}');
    }
  };
}

// Run on its own: node scripts/onemap-proxy.mjs
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.ONEMAP_EMAIL || !process.env.ONEMAP_PASSWORD) {
    console.error('Set ONEMAP_EMAIL and ONEMAP_PASSWORD (your OneMap account).');
    process.exit(1);
  }
  const upstream = process.env.ONEMAP_UPSTREAM || 'https://www.onemap.gov.sg';
  const port = Number(process.env.PORT || 8787);
  const handle = createOneMapHandler({
    email: process.env.ONEMAP_EMAIL, password: process.env.ONEMAP_PASSWORD, upstream,
    origin: process.env.ALLOW_ORIGIN || '*', rate: Number(process.env.RATE_PER_MINUTE || 120),
  });
  createServer(handle).listen(port, () => console.log(`OneMap proxy on http://localhost:${port} -> ${upstream}`));
}
