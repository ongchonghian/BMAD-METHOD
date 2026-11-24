// A small proxy for OneMap, so visitors never need a OneMap token and the login stays on the server.
// It forwards only routing and address search, adds the token, renews it before it expires, and answers CORS.
//
//   ONEMAP_EMAIL=you@example.com ONEMAP_PASSWORD=... ALLOW_ORIGIN=https://your.site node scripts/onemap-proxy.mjs
//
// Then set oneMapBase in config.js to the proxy's address (for example https://maps-proxy.your.site).
// Environment: ONEMAP_EMAIL, ONEMAP_PASSWORD (required), ALLOW_ORIGIN (default *), PORT (default 8787),
// ONEMAP_UPSTREAM (default https://www.onemap.gov.sg), RATE_PER_MINUTE per visitor address (default 120).
// Needs Node 18 or later; no packages.

import { createServer } from 'node:http';

const UPSTREAM = (process.env.ONEMAP_UPSTREAM || 'https://www.onemap.gov.sg').replace(/\/$/, '');
const ORIGIN = process.env.ALLOW_ORIGIN || '*';
const PORT = Number(process.env.PORT || 8787);
const RATE = Number(process.env.RATE_PER_MINUTE || 120);
const PATHS = new Set(['/api/public/routingsvc/route', '/api/common/elastic/search']);
const NEEDS_TOKEN = new Set(['/api/public/routingsvc/route']);

if (!process.env.ONEMAP_EMAIL || !process.env.ONEMAP_PASSWORD) {
  console.error('Set ONEMAP_EMAIL and ONEMAP_PASSWORD (your OneMap account).');
  process.exit(1);
}

let cached = null; // { token, until }
async function token(force = false) {
  if (!force && cached && cached.until > Date.now()) return cached.token;
  const res = await fetch(`${UPSTREAM}/api/auth/post/getToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ONEMAP_EMAIL, password: process.env.ONEMAP_PASSWORD }),
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
  return list.length <= RATE;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

async function forward(path, search, attempt = 0) {
  const headers = {};
  if (NEEDS_TOKEN.has(path)) headers.Authorization = await token(attempt > 0);
  const res = await fetch(`${UPSTREAM}${path}${search}`, { headers });
  if (res.status === 401 && NEEDS_TOKEN.has(path) && attempt === 0) return forward(path, search, 1);
  return res;
}

export const server = createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const url = new URL(req.url, 'http://proxy');
  if (req.method !== 'GET' || !PATHS.has(url.pathname)) { res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"not found"}'); return; }
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '';
  if (!allowed(ip)) { res.writeHead(429, { 'Content-Type': 'application/json' }).end('{"error":"too many requests"}'); return; }
  try {
    const up = await forward(url.pathname, url.search);
    res.writeHead(up.status, { 'Content-Type': up.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
    res.end(Buffer.from(await up.arrayBuffer()));
  } catch (e) {
    console.error(e.message);
    res.writeHead(502, { 'Content-Type': 'application/json' }).end('{"error":"upstream unavailable"}');
  }
});

server.listen(PORT, () => console.log(`OneMap proxy on http://localhost:${PORT} -> ${UPSTREAM}`));
