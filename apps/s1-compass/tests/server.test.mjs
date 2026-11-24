import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { createApp, servedPath, configOverrides } from '../server.mjs';

function listen(server) {
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server.address().port)));
}

test('only the app files are served, never tests, scripts, notes or raw data', () => {
  assert.equal(servedPath('/'), '/index.html');
  assert.equal(servedPath('/js/app.js'), '/js/app.js');
  assert.equal(servedPath('/data/schools.json'), '/data/schools.json');
  assert.equal(servedPath('/assets/audio/watch-me-glow.mp3'), '/assets/audio/watch-me-glow.mp3');
  for (const p of ['/tests/logic.test.mjs', '/scripts/onemap-proxy.mjs', '/server.mjs', '/design/x', '/data/source/x.md',
    '/package.json', '/js/../server.mjs', '/js/%2e%2e/server.mjs', '/.git/config', '/assets/.hidden', '/%E0%A4%A']) {
    assert.equal(servedPath(p), null, p);
  }
});

test('settings from the environment are written after config.js', async t => {
  assert.deepEqual(configOverrides({}), {});
  assert.deepEqual(configOverrides({ GOOGLE_MAPS_API_KEY: 'k', GOOGLE_MAP_ID: 'm', MAP_PROVIDER: 'maplibre', ONEMAP_EMAIL: 'a', ONEMAP_PASSWORD: 'b' }),
    { googleMapsApiKey: 'k', googleMapId: 'm', mapProvider: 'maplibre', oneMapBase: '/onemap' });
  assert.deepEqual(configOverrides({ MAP_PROVIDER: 'other', ONEMAP_EMAIL: 'a' }), {});

  const server = createServer(createApp({ GOOGLE_MAPS_API_KEY: 'key"1' }));
  const port = await listen(server);
  t.after(() => server.close());
  const res = await fetch(`http://127.0.0.1:${port}/config.js`);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.text();
  assert.match(body, /window\.S1_CONFIG = \{/);
  assert.ok(body.trimEnd().endsWith('Object.assign(window.S1_CONFIG, {"googleMapsApiKey":"key\\"1"});'));
});

test('files are compressed, cached, and served in byte ranges', async t => {
  const server = createServer(createApp({}));
  const port = await listen(server);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${port}`;

  const page = await fetch(`${base}/`, { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.equal(page.headers.get('cache-control'), 'no-cache');
  assert.match(await page.text(), /<title>/);

  const raw = await new Promise((resolve, reject) => {
    import('node:http').then(({ get }) => get(`${base}/data/schools.json`, { headers: { 'Accept-Encoding': 'gzip' } }, r => {
      const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => resolve({ r, body: Buffer.concat(chunks) }));
    }).on('error', reject));
  });
  assert.equal(raw.r.headers['content-encoding'], 'gzip');
  assert.equal(raw.r.headers['cache-control'], 'public, max-age=86400');
  assert.ok(JSON.parse(gunzipSync(raw.body)).schools.length > 100);

  const again = await fetch(`${base}/js/app.js`, { headers: { 'If-None-Match': (await fetch(`${base}/js/app.js`)).headers.get('etag') } });
  assert.equal(again.status, 304);

  const song = `${base}/assets/audio/watch-me-glow.mp3`;
  const part = await fetch(song, { headers: { Range: 'bytes=0-99' } });
  assert.equal(part.status, 206);
  assert.equal((await part.arrayBuffer()).byteLength, 100);
  assert.match(part.headers.get('content-range'), /^bytes 0-99\/\d+$/);
  assert.equal((await fetch(song, { headers: { Range: 'bytes=999999999-' } })).status, 416);

  assert.equal((await fetch(`${base}/tests/logic.test.mjs`)).status, 404);
  assert.equal((await fetch(`${base}/onemap/api/public/routingsvc/route`)).status, 404);
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
  assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
});

test('the OneMap proxy runs under /onemap on the same address, with no CORS for other sites', async t => {
  const seen = [];
  const upstream = createServer((req, res) => {
    if (req.url === '/api/auth/post/getToken') { res.end(JSON.stringify({ access_token: 'tok', expiry_timestamp: Math.floor(Date.now() / 1000) + 86400 })); return; }
    seen.push([req.url, req.headers.authorization]);
    res.end('{"ok":true}');
  });
  const upPort = await listen(upstream);
  const server = createServer(createApp({ ONEMAP_EMAIL: 'a@b.example', ONEMAP_PASSWORD: 'x', ONEMAP_UPSTREAM: `http://127.0.0.1:${upPort}` }));
  const port = await listen(server);
  t.after(() => { server.close(); upstream.close(); });

  const res = await fetch(`http://127.0.0.1:${port}/onemap/api/public/routingsvc/route?start=1,2&end=3,4`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(seen, [['/api/public/routingsvc/route?start=1,2&end=3,4', 'tok']]);
  assert.equal((await fetch(`http://127.0.0.1:${port}/onemap/api/auth/post/getToken`)).status, 404);
  assert.match(await (await fetch(`http://127.0.0.1:${port}/config.js`)).text(), /"oneMapBase":"\/onemap"/);
});
