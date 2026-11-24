import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { decodePolyline, sgDateTime, parsePt, parseRoad, rankForArrival, toMs, lineColour } from '../js/onemap.js';

// An OpenTripPlanner-shaped answer, as OneMap returns for routeType=pt.
const T0 = Date.parse('2026-11-25T06:20:00+08:00');
const PT = {
  plan: {
    itineraries: [
      {
        duration: 1980, startTime: T0, endTime: T0 + 1980e3, walkTime: 480, transitTime: 1500,
        legs: [
          { mode: 'WALK', duration: 300, distance: 400, startTime: T0, endTime: T0 + 300e3, from: { name: 'Origin' }, to: { name: 'Tampines Stn' }, legGeometry: { points: '_p~iF~ps|U_ulLnnqC' } },
          { mode: 'SUBWAY', route: 'EW', routeLongName: 'East West Line', duration: 1200, distance: 9000, from: { name: 'Tampines Stn', stopCode: 'EW2' }, to: { name: 'Simei Stn' }, intermediateStops: [{ name: 'x' }], headsign: 'Pasir Ris', legGeometry: { points: '_ulLnnqC_mqNvxq`@' } },
          { mode: 'BUS', routeShortName: '23', duration: 300, distance: 1500, from: { name: 'Blk 1' }, to: { name: 'School gate' }, numIntermediateStops: 3, legGeometry: { points: '' } },
          { mode: 'WALK', duration: 180, distance: 200, from: { name: 'School gate' }, to: { name: 'Destination' }, legGeometry: { points: '' } },
        ],
      },
    ],
  },
};

test('decodes an encoded polyline to [lng, lat] pairs', () => {
  const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.deepEqual(pts, [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
  assert.deepEqual(decodePolyline(''), []);
});

test('OneMap date and time are in Singapore time', () => {
  assert.deepEqual(sgDateTime(new Date('2026-11-24T23:15:00Z')), { date: '11-25-2026', time: '07:15:00' });
});

test('time fields in milliseconds, seconds or text all become milliseconds', () => {
  assert.equal(toMs(T0), T0);
  assert.equal(toMs(T0 / 1000), T0);
  assert.equal(toMs('2026-11-25T06:20:00+08:00'), T0);
  assert.equal(toMs(null), null);
});

test('a public transport answer becomes steps with lines, stops and colours', () => {
  const [it] = parsePt(PT);
  assert.equal(it.minutes, 33);
  assert.equal(it.summary, 'EW › 23');
  assert.deepEqual(it.steps.map(s => s.kind), ['walk', 'train', 'bus', 'walk']);
  const train = it.steps[1];
  assert.equal(train.colour, '#009645');
  assert.equal(train.stops, 2);
  assert.equal(train.headsign, 'Pasir Ris');
  assert.equal(it.steps[2].stops, 4);
  assert.equal(it.steps[3].text, 'Walk to the school');
  assert.equal(it.paths.length, 2);
  assert.equal(it.distanceKm, 11.1);
});

test('route colour comes from the answer when given, else from the MRT line', () => {
  assert.equal(lineColour({ routeColor: 'ff0000' }, 'X'), '#ff0000');
  assert.equal(lineColour({}, 'DT'), '#005ec4');
  assert.equal(lineColour({}, '23'), null);
});

test('trips that arrive on time come first, the latest to leave first', () => {
  const target = T0 + 3600e3;
  const its = [
    { startMs: T0, endMs: T0 + 1800e3 },
    { startMs: T0 + 1200e3, endMs: T0 + 3000e3 },
    { startMs: T0 + 2400e3, endMs: target + 600e3 },
  ];
  assert.deepEqual(rankForArrival(its, target).map(i => i.startMs), [T0 + 1200e3, T0, T0 + 2400e3]);
});

test('car and walking answers give minutes, distance and a path', () => {
  const r = parseRoad({ route_summary: { total_time: 900, total_distance: 7400 }, route_geometry: '_p~iF~ps|U_ulLnnqC' }, 'drive');
  assert.equal(r.minutes, 15);
  assert.equal(r.distanceKm, 7.4);
  assert.equal(r.paths[0].coords.length, 2);
  assert.equal(parseRoad({}, 'walk'), null);
});

// ------------------------------------------------------------------ the proxy, against a stand-in OneMap

function listen(server) {
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server.address().port)));
}

test('the proxy adds the token, renews it when refused, answers CORS and forwards nothing else', async t => {
  let tokens = 0;
  const seen = [];
  const upstream = createServer((req, res) => {
    if (req.url === '/api/auth/post/getToken') {
      tokens += 1;
      res.end(JSON.stringify({ access_token: `tok${tokens}`, expiry_timestamp: Math.floor(Date.now() / 1000) + 3 * 86400 }));
      return;
    }
    seen.push([req.url, req.headers.authorization]);
    if (req.headers.authorization === 'tok1') { res.writeHead(401).end('{}'); return; }
    res.end(JSON.stringify({ ok: true, auth: req.headers.authorization }));
  });
  const upPort = await listen(upstream);
  const port = 20000 + Math.floor(Math.random() * 20000);
  const proxy = spawn(process.execPath, [new URL('../scripts/onemap-proxy.mjs', import.meta.url).pathname], {
    env: { ...process.env, ONEMAP_EMAIL: 'a@b.example', ONEMAP_PASSWORD: 'x', ONEMAP_UPSTREAM: `http://127.0.0.1:${upPort}`, PORT: String(port), ALLOW_ORIGIN: 'https://site.example' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  t.after(() => { proxy.kill(); upstream.close(); });
  await new Promise(r => proxy.stdout.once('data', r));

  const res = await fetch(`http://127.0.0.1:${port}/api/public/routingsvc/route?start=1,2&end=3,4&routeType=pt`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).auth, 'tok2');
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://site.example');
  assert.equal(tokens, 2);
  assert.deepEqual(seen.map(s => s[1]), ['tok1', 'tok2']);

  const search = await fetch(`http://127.0.0.1:${port}/api/common/elastic/search?searchVal=x`);
  assert.equal((await search.json()).auth, undefined);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/auth/post/getToken`)).status, 404);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/public/routingsvc/route`, { method: 'OPTIONS' })).status, 204);
});
