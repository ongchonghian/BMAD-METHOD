// OneMap (Singapore Land Authority) routing for the open map: public transport, car and walking routes.
// API: GET {base}/api/public/routingsvc/route?start=lat,lng&end=lat,lng&routeType=pt|drive|walk
//   pt also takes date=MM-DD-YYYY, time=HH:MM:SS, mode=TRANSIT, maxWalkDistance, numItineraries (1-3).
//   The token goes in the Authorization header as is. Tokens come from POST /api/auth/post/getToken
//   (email, password) and last 3 days, so a site should use a token URL or the proxy in scripts/onemap-proxy.mjs.
// The pt answer follows OpenTripPlanner: plan.itineraries[].legs[] with mode, legGeometry.points, distance.
// The parsing below accepts the usual field variants, since not every field name is documented.

const TOKEN_STORE = 's1compass.oneMapToken';
const DEFAULT_BASE = 'https://www.onemap.gov.sg';
let fetched = null; // { token, until } from a token URL

const cfg = () => (typeof window !== 'undefined' && window.S1_CONFIG) || {};
export const base = () => (cfg().oneMapBase || DEFAULT_BASE).replace(/\/$/, '');

export function getOwnToken() {
  try { return localStorage.getItem(TOKEN_STORE) || ''; } catch { return ''; }
}
export function setOwnToken(t) {
  try { t ? localStorage.setItem(TOKEN_STORE, t.trim()) : localStorage.removeItem(TOKEN_STORE); } catch { /* nothing to keep */ }
}

/** Routing works with a token (own, site, or from the site's token URL) or through the site's proxy. */
export function routingAvailable() {
  return Boolean(getOwnToken() || cfg().oneMapToken || cfg().oneMapTokenUrl || base() !== DEFAULT_BASE);
}

async function token() {
  const own = getOwnToken() || cfg().oneMapToken;
  if (own) return own;
  if (cfg().oneMapTokenUrl) {
    if (fetched && fetched.until > Date.now()) return fetched.token;
    const res = await fetch(cfg().oneMapTokenUrl);
    if (!res.ok) throw new Error(`token ${res.status}`);
    const j = await res.json();
    const until = j.expiry_timestamp ? Number(j.expiry_timestamp) * 1000 - 5 * 60e3 : Date.now() + 60 * 60e3;
    fetched = { token: j.access_token, until };
    return fetched.token;
  }
  return ''; // a proxy adds it
}

async function call(params) {
  const t = await token();
  const res = await fetch(`${base()}/api/public/routingsvc/route?${new URLSearchParams(params)}`, { headers: t ? { Authorization: t } : {} });
  if (res.status === 401 || res.status === 403) throw new Error('onemap-auth');
  if (res.status === 429) throw new Error('onemap-busy');
  if (!res.ok) throw new Error(`onemap ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`onemap: ${json.error}`);
  return json;
}

// ------------------------------------------------------------------ pure helpers (tested)

/** Decode an encoded polyline (precision 5) into [[lng, lat], ...] for MapLibre. */
export function decodePolyline(str) {
  const out = [];
  let i = 0, lat = 0, lng = 0;
  while (str && i < str.length) {
    for (const axis of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i <= str.length);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += d; else lng += d;
    }
    out.push([lng / 1e5, lat / 1e5]);
  }
  return out;
}

/** Date and time strings OneMap wants, in Singapore time, for a Date. */
export function sgDateTime(d) {
  const sg = new Date(d.getTime() + 8 * 3600e3);
  const p = n => String(n).padStart(2, '0');
  return {
    date: `${p(sg.getUTCMonth() + 1)}-${p(sg.getUTCDate())}-${sg.getUTCFullYear()}`,
    time: `${p(sg.getUTCHours())}:${p(sg.getUTCMinutes())}:00`,
  };
}

/** A time field as epoch milliseconds: OTP sends milliseconds; accept seconds and date strings too. */
export function toMs(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n)) return n > 1e12 ? n : n * 1000;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

export function clock(ms) {
  if (ms == null) return null;
  return new Date(ms).toLocaleTimeString('en-SG', { timeZone: 'Asia/Singapore', hour: 'numeric', minute: '2-digit' });
}

const MRT = [
  [/^(EW|CG)|east.?west/i, '#009645'], [/^NS|north.?south/i, '#d42e12'], [/^NE|north.?east/i, '#9900aa'],
  [/^(CC|CE)|circle/i, '#fa9e0d'], [/^DT|downtown/i, '#005ec4'], [/^TE|thomson/i, '#9d5b25'],
  [/^(BP|SK|SE|SW|PG|PE|PW)|lrt/i, '#748477'],
];

export function lineColour(leg, name) {
  const c = leg.routeColor || leg.route_color;
  if (c) return c.startsWith('#') ? c : `#${c}`;
  const hit = MRT.find(([re]) => re.test(name || '') || re.test(leg.routeLongName || '') || re.test(leg.routeId || ''));
  return hit ? hit[1] : null;
}

const TRAIN = new Set(['SUBWAY', 'RAIL', 'TRAM', 'MONORAIL', 'METRO']);

export function legOf(leg) {
  const mode = String(leg.mode || '').toUpperCase();
  const minutes = Math.max(1, Math.round(Number(leg.duration || 0) / 60) || Math.round(((toMs(leg.endTime) ?? 0) - (toMs(leg.startTime) ?? 0)) / 60e3) || 1);
  const km = Math.round((Number(leg.distance) || 0) / 100) / 10;
  const coords = decodePolyline(leg.legGeometry?.points || '');
  const to = leg.to?.name && !/^destination$/i.test(leg.to.name) ? leg.to.name : 'the school';
  if (mode === 'WALK' || mode === 'BICYCLE' || !mode) {
    return { kind: 'walk', text: `Walk to ${to}`, minutes, km, coords };
  }
  const line = String(leg.routeShortName || leg.route || leg.routeId || leg.routeLongName || '').trim();
  const between = Array.isArray(leg.intermediateStops) ? leg.intermediateStops.length + 1 : null;
  return {
    kind: TRAIN.has(mode) ? 'train' : 'bus',
    line: line || (TRAIN.has(mode) ? 'Train' : 'Bus'),
    colour: lineColour(leg, line),
    textColour: leg.routeTextColor ? `#${String(leg.routeTextColor).replace('#', '')}` : null,
    from: leg.from?.name || '',
    to: leg.to?.name || '',
    stops: leg.numIntermediateStops != null ? Number(leg.numIntermediateStops) + 1 : between,
    headsign: leg.headsign || leg.tripHeadsign || '',
    minutes,
    km,
    coords,
  };
}

export function itineraryOf(it) {
  const steps = (it.legs || []).map(legOf);
  const start = toMs(it.startTime), end = toMs(it.endTime);
  const seconds = Number(it.duration);
  const minutes = Math.round(seconds > 20000 ? seconds / 60000 : seconds / 60) || (start && end ? Math.round((end - start) / 60e3) : null);
  return {
    summary: steps.filter(s => s.kind !== 'walk').map(s => s.line).join(' › '),
    minutes,
    depart: clock(start),
    arrive: clock(end),
    startMs: start,
    endMs: end,
    distanceKm: Math.round(steps.reduce((a, s) => a + s.km, 0) * 10) / 10,
    steps,
    paths: steps.filter(s => s.coords.length > 1).map(s => ({ kind: s.kind, colour: s.colour, coords: s.coords })),
  };
}

/** Itineraries that reach school by the target time first, the latest-leaving first; then the rest by arrival. */
export function rankForArrival(its, targetMs) {
  const onTime = its.filter(i => i.endMs != null && i.endMs <= targetMs).sort((a, b) => b.startMs - a.startMs);
  const late = its.filter(i => !onTime.includes(i)).sort((a, b) => (a.endMs ?? 0) - (b.endMs ?? 0));
  return [...onTime, ...late];
}

export function parsePt(json) {
  const its = json?.plan?.itineraries || json?.itineraries || [];
  return its.map(itineraryOf).filter(i => i.minutes);
}

export function parseRoad(json, kind) {
  const s = json?.route_summary || json?.routeSummary || {};
  const sec = Number(s.total_time ?? s.totalTime ?? s.time);
  const m = Number(s.total_distance ?? s.totalDistance ?? s.distance);
  if (!Number.isFinite(sec)) return null;
  const coords = decodePolyline(json.route_geometry || json.routeGeometry || '');
  return {
    summary: kind === 'drive' ? 'By car' : 'On foot',
    minutes: Math.max(1, Math.round(sec / 60)),
    depart: null,
    arrive: null,
    distanceKm: Number.isFinite(m) ? Math.round(m / 100) / 10 : null,
    steps: [],
    paths: coords.length > 1 ? [{ kind: kind === 'drive' ? 'drive' : 'walk', colour: null, coords }] : [],
  };
}

// ------------------------------------------------------------------ calls

const ROAD = { DRIVING: 'drive', WALKING: 'walk' };

/**
 * Routes from home to a school. Public transport aims to arrive by `arrival` (a Date): it asks for trips
 * leaving an hour before, then asks again closer to the time if the best trip would arrive far too early.
 * Returns { routes, raw: null, source: 'onemap' }.
 */
export async function route(home, school, mode, arrival) {
  const start = `${home.lat},${home.lng}`, end = `${school.lat},${school.lng}`;
  if (ROAD[mode]) {
    const r = parseRoad(await call({ start, end, routeType: ROAD[mode] }), ROAD[mode]);
    return { routes: r ? [r] : [], raw: null, source: 'onemap' };
  }
  const ask = async leave => parsePt(await call({ start, end, routeType: 'pt', mode: 'TRANSIT', maxWalkDistance: 1000, numItineraries: 3, ...sgDateTime(leave) }));
  const target = arrival.getTime();
  let its = rankForArrival(await ask(new Date(target - 60 * 60e3)), target);
  const best = its[0];
  if (best?.endMs && best.minutes && target - best.endMs > 15 * 60e3) {
    const again = rankForArrival(await ask(new Date(target - (best.minutes + 10) * 60e3)), target);
    if (again.length) its = again;
  }
  return { routes: its.slice(0, 3), raw: null, source: 'onemap' };
}

/** Bus-and-train minutes to many schools, a few requests at a time. onProgress gets { [id]: { min, km, src } }. */
export async function travelTimes(home, schools, arrival, onProgress = () => {}) {
  const out = {};
  const leave = new Date(arrival.getTime() - 60 * 60e3);
  const queue = [...schools];
  const worker = async () => {
    while (queue.length) {
      const s = queue.shift();
      try {
        const its = parsePt(await call({ start: `${home.lat},${home.lng}`, end: `${s.lat},${s.lng}`, routeType: 'pt', mode: 'TRANSIT', maxWalkDistance: 1000, numItineraries: 1, ...sgDateTime(leave) }));
        if (its.length) {
          const best = its.reduce((a, b) => (b.minutes < a.minutes ? b : a));
          out[s.id] = { min: best.minutes, km: null, src: 'onemap' };
          onProgress({ [s.id]: out[s.id] });
        }
      } catch (e) {
        if (/auth|busy/.test(e.message)) { queue.length = 0; throw e; }
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (schools.length && !Object.keys(out).length) throw new Error('onemap-none');
  return out;
}
