// The web server for hosting (Railway or any Node host): serves the app's files and, when a OneMap account is set,
// proxies OneMap under /onemap so visitors get bus and train times on the open map without a token.
//
//   node server.mjs        (Node 20 or later; no packages)
//
// Environment, all optional:
//   PORT                    port to listen on (Railway sets it; default 8080)
//   GOOGLE_MAPS_API_KEY     Google Maps key for every visitor (restrict it to your domain in Google Cloud)
//   GOOGLE_MAP_ID           your Map ID from Google Cloud (default DEMO_MAP_ID, for testing only)
//   MAP_PROVIDER            auto, google or maplibre (default auto)
//   ONEMAP_EMAIL, ONEMAP_PASSWORD   your OneMap account; turns on the proxy at /onemap
//   RATE_PER_MINUTE         OneMap requests a minute per visitor (default 120)
//   ONEMAP_UPSTREAM         default https://www.onemap.gov.sg
// The values are written into config.js as it is served, after the file's own settings.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { createOneMapHandler } from './scripts/onemap-proxy.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// Only what the app needs is served: not the tests, the scripts, the design notes or the raw source data.
const FILES = new Set(['/index.html', '/favicon.svg', '/data/schools.json']);
const DIRS = ['/css/', '/js/', '/assets/'];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.map': 'application/json', '.md': 'text/plain; charset=utf-8',
};
const COMPRESS = /^(text\/|application\/json|image\/svg)/;

/** The settings written after config.js, from the environment. */
export function configOverrides(env) {
  const o = {};
  if (env.GOOGLE_MAPS_API_KEY) o.googleMapsApiKey = env.GOOGLE_MAPS_API_KEY;
  if (env.GOOGLE_MAP_ID) o.googleMapId = env.GOOGLE_MAP_ID;
  if (['auto', 'google', 'maplibre'].includes(env.MAP_PROVIDER)) o.mapProvider = env.MAP_PROVIDER;
  if (env.ONEMAP_EMAIL && env.ONEMAP_PASSWORD) o.oneMapBase = '/onemap';
  return o;
}

/** The served path for a request path, or null when it is not one of the app's files. */
export function servedPath(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return null; }
  if (p === '/' || p === '') return '/index.html';
  if (p.includes('\0') || p.split('/').some(s => s === '..' || s.startsWith('.'))) return null;
  p = path.posix.normalize(p);
  return FILES.has(p) || DIRS.some(d => p.startsWith(d)) ? p : null;
}

export function createApp(env = process.env) {
  const onemap = env.ONEMAP_EMAIL && env.ONEMAP_PASSWORD
    ? createOneMapHandler({ email: env.ONEMAP_EMAIL, password: env.ONEMAP_PASSWORD, upstream: env.ONEMAP_UPSTREAM || undefined,
      origin: '', rate: Number(env.RATE_PER_MINUTE || 120), prefix: '/onemap' })
    : null;
  const overrides = configOverrides(env);
  const gz = new Map(); // path -> { mtime, body }

  return async function handle(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const url = new URL(req.url, 'http://app');
    if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok'); return; }
    if (url.pathname === '/onemap' || url.pathname.startsWith('/onemap/')) {
      if (onemap) return onemap(req, res);
      res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"OneMap proxy is not set up"}');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }

    if (url.pathname === '/config.js') {
      const base = await readFile(path.join(ROOT, 'config.js'), 'utf8');
      const body = `${base}\n// Set on the server\nObject.assign(window.S1_CONFIG, ${JSON.stringify(overrides)});\n`;
      res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }

    const rel = servedPath(url.pathname);
    let info;
    try { info = rel && await stat(path.join(ROOT, rel)); } catch { info = null; }
    if (!info?.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found'); return; }

    const file = path.join(ROOT, rel);
    const type = TYPES[path.extname(rel)] || 'application/octet-stream';
    const etag = `W/"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
    // Code changes reach visitors at once; the data, music and libraries are kept for a day.
    res.setHeader('Cache-Control', rel.startsWith('/assets/') || rel.startsWith('/data/') ? 'public, max-age=86400' : 'no-cache');
    res.setHeader('ETag', etag);
    res.setHeader('Content-Type', type);
    res.setHeader('Vary', 'Accept-Encoding');
    if (req.headers['if-none-match'] === etag) { res.writeHead(304).end(); return; }

    if (COMPRESS.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      let c = gz.get(rel);
      if (!c || c.mtime !== info.mtimeMs) { c = { mtime: info.mtimeMs, body: gzipSync(await readFile(file)) }; gz.set(rel, c); }
      res.writeHead(200, { 'Content-Encoding': 'gzip', 'Content-Length': c.body.length });
      res.end(req.method === 'HEAD' ? undefined : c.body);
      return;
    }

    // Byte ranges: Safari will not play audio without them
    res.setHeader('Accept-Ranges', 'bytes');
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      const start = m[1] ? Number(m[1]) : Math.max(0, info.size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
      const data = await readFile(file);
      res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1 });
      res.end(req.method === 'HEAD' ? undefined : data.subarray(start, end + 1));
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8080);
  const server = createServer(createApp());
  server.listen(port, () => console.log(`S1 Compass on port ${port}${process.env.ONEMAP_EMAIL ? ', OneMap proxy at /onemap' : ''}`));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}
