// Google Maps for the app: place search, travel times to many schools, one route with its steps, and the map.
// Every call has a fallback, so the app works without a key: OneMap search (Singapore's public map service),
// straight-line distance, and a Google Maps link for the route.

import { nextSchoolMorning, distanceKm } from './logic.js';

const KEY_STORE = 's1compass.mapsKey';
let loading = null;
let authFailed = false;
const listeners = new Set();

export function getKey() {
  try {
    const own = localStorage.getItem(KEY_STORE);
    if (own) return own;
  } catch { /* storage blocked: fall through to the site's key */ }
  return window.S1_CONFIG?.googleMapsApiKey || '';
}

export function setKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORE, key.trim());
    else localStorage.removeItem(KEY_STORE);
  } catch { /* nothing to keep */ }
}

export function mapId() {
  return window.S1_CONFIG?.googleMapId || 'DEMO_MAP_ID';
}

/** 'ready' | 'none' (no key) | 'failed' (bad key or blocked) | 'loading' */
export function mapsStatus() {
  if (!getKey()) return 'none';
  if (authFailed) return 'failed';
  if (window.google?.maps?.importLibrary && loading) return 'ready';
  return loading ? 'loading' : 'idle';
}

export function onMapsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach(fn => fn(mapsStatus()));

export function loadGoogle() {
  const key = getKey();
  if (!key) return Promise.reject(new Error('no-key'));
  if (authFailed) return Promise.reject(new Error('auth-failed'));
  if (loading) return loading;
  window.gm_authFailure = () => { authFailed = true; emit(); };
  loading = new Promise((resolve, reject) => {
    window.__s1MapsReady = () => { resolve(window.google.maps); emit(); };
    const s = document.createElement('script');
    const p = new URLSearchParams({ key, v: 'weekly', loading: 'async', region: 'SG', language: 'en-GB', callback: '__s1MapsReady' });
    s.src = `https://maps.googleapis.com/maps/api/js?${p}`;
    s.async = true;
    s.onerror = () => { authFailed = true; loading = null; reject(new Error('load-failed')); emit(); };
    document.head.append(s);
  });
  emit();
  return loading;
}

/** Forget a failed load, after the key changes. */
export function resetGoogle() {
  authFailed = false;
  if (!window.google?.maps) loading = null;
  emit();
}

// ------------------------------------------------------------------ place search

let session = null;

/** Suggestions for a typed address or postal code: [{ id, main, secondary, resolve() }]. */
export async function searchPlaces(input) {
  const q = input.trim();
  if (q.length < 2) return [];
  if (getKey() && !authFailed) {
    try {
      await loadGoogle();
      const { AutocompleteSessionToken, AutocompleteSuggestion } = await google.maps.importLibrary('places');
      session ??= new AutocompleteSessionToken();
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q, sessionToken: session, includedRegionCodes: ['sg'], language: 'en-GB',
      });
      return suggestions.filter(s => s.placePrediction).slice(0, 6).map((s, i) => {
        const p = s.placePrediction;
        return {
          id: `g${i}`,
          main: p.mainText?.toString() || p.text.toString(),
          secondary: p.secondaryText?.toString() || '',
          resolve: async () => {
            const place = p.toPlace();
            await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] });
            session = null;
            return { lat: place.location.lat(), lng: place.location.lng(), label: place.displayName || place.formattedAddress, address: place.formattedAddress };
          },
        };
      });
    } catch (e) {
      console.warn('Places search failed, using OneMap', e);
    }
  }
  return oneMapSearch(q);
}

async function oneMapSearch(q) {
  const p = new URLSearchParams({ searchVal: q, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: '1' });
  const res = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?${p}`);
  if (!res.ok) throw new Error(`OneMap ${res.status}`);
  const json = await res.json();
  return (json.results || []).slice(0, 6).map((r, i) => {
    const label = r.BUILDING && r.BUILDING !== 'NIL' ? titleCase(r.BUILDING) : titleCase(r.ROAD_NAME || r.SEARCHVAL);
    const place = { lat: Number(r.LATITUDE), lng: Number(r.LONGITUDE), label, address: titleCase(r.ADDRESS) };
    return { id: `o${i}`, main: label, secondary: titleCase(r.ADDRESS), resolve: async () => place };
  });
}

const titleCase = s => (s || '').toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\bSingapore (\d{6})$/i, 'Singapore $1');

export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'My current location', address: '' }),
      reject,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

// ------------------------------------------------------------------ travel times

export const MODES = {
  TRANSIT: { label: 'Public transport', url: 'transit' },
  DRIVING: { label: 'Car', url: 'driving' },
  WALKING: { label: 'Walk', url: 'walking' },
};

/**
 * Travel times from home to many schools on a school morning.
 * onProgress(results) is called after each batch with { [schoolId]: { min, km, src } }.
 * Without Google, every school gets a straight-line distance and no time.
 */
export async function travelTimes(home, schools, mode = 'TRANSIT', onProgress = () => {}, { google: useGoogle = true } = {}) {
  const out = {};
  const straight = () => {
    for (const s of schools) out[s.id] ??= { min: null, km: round1(distanceKm(home, s)), src: 'straight' };
    onProgress(out);
    return out;
  };
  if (!useGoogle || !getKey() || authFailed) return straight();
  try {
    await loadGoogle();
    const { DistanceMatrixService } = await google.maps.importLibrary('routes');
    const svc = new DistanceMatrixService();
    const arrival = nextSchoolMorning();
    for (let i = 0; i < schools.length; i += 25) {
      const batch = schools.slice(i, i + 25);
      const req = {
        origins: [{ lat: home.lat, lng: home.lng }],
        destinations: batch.map(s => ({ lat: s.lat, lng: s.lng })),
        travelMode: mode,
        unitSystem: google.maps.UnitSystem.METRIC,
        region: 'sg',
      };
      if (mode === 'TRANSIT') req.transitOptions = { arrivalTime: arrival };
      if (mode === 'DRIVING') req.drivingOptions = { departureTime: new Date(arrival.getTime() - 45 * 60e3) };
      const res = await svc.getDistanceMatrix(req);
      res.rows[0].elements.forEach((el, j) => {
        const s = batch[j];
        out[s.id] = el.status === 'OK'
          ? { min: Math.round(el.duration.value / 60), km: round1(el.distance.value / 1000), src: 'google' }
          : { min: null, km: round1(distanceKm(home, s)), src: 'straight' };
      });
      onProgress(out);
      if (i + 25 < schools.length) await new Promise(r => setTimeout(r, 250));
    }
    return out;
  } catch (e) {
    console.warn('Travel times failed, using straight-line distance', e);
    return straight();
  }
}

const round1 = n => Math.round(n * 10) / 10;

// ------------------------------------------------------------------ one route

/**
 * The route from home to a school, arriving by a time on the next school morning.
 * Returns { routes: [{ summary, minutes, depart, arrive, distanceKm, steps: [...] }], raw } or throws.
 */
export async function route(home, school, mode = 'TRANSIT', arriveBy = { hh: 7, mm: 15 }) {
  await loadGoogle();
  const { DirectionsService } = await google.maps.importLibrary('routes');
  const svc = new DirectionsService();
  const arrival = nextSchoolMorning(new Date(), arriveBy.hh, arriveBy.mm);
  const req = {
    origin: { lat: home.lat, lng: home.lng },
    destination: { lat: school.lat, lng: school.lng },
    travelMode: mode,
    provideRouteAlternatives: mode === 'TRANSIT',
    region: 'sg',
    unitSystem: google.maps.UnitSystem.METRIC,
  };
  if (mode === 'TRANSIT') req.transitOptions = { arrivalTime: arrival };
  if (mode === 'DRIVING') req.drivingOptions = { departureTime: new Date(arrival.getTime() - 45 * 60e3) };
  const raw = await svc.route(req);
  const routes = raw.routes.slice(0, 3).map(r => {
    const leg = r.legs[0];
    return {
      summary: r.summary,
      minutes: Math.round(leg.duration.value / 60),
      depart: leg.departure_time?.text || null,
      arrive: leg.arrival_time?.text || null,
      distanceKm: round1(leg.distance.value / 1000),
      steps: leg.steps.map(stepOf),
    };
  });
  return { routes, raw };
}

function stepOf(st) {
  const minutes = Math.max(1, Math.round(st.duration.value / 60));
  if (st.travel_mode === 'TRANSIT' && st.transit) {
    const t = st.transit;
    const vehicle = t.line?.vehicle?.type || 'BUS';
    return {
      kind: vehicle === 'BUS' ? 'bus' : 'train',
      line: t.line?.short_name || t.line?.name || '',
      lineName: t.line?.name || '',
      colour: t.line?.color || null,
      textColour: t.line?.text_color || null,
      from: t.departure_stop?.name || '',
      to: t.arrival_stop?.name || '',
      stops: t.num_stops ?? null,
      headsign: t.headsign || '',
      minutes,
    };
  }
  return { kind: st.travel_mode === 'WALKING' ? 'walk' : 'drive', text: plain(st.instructions), minutes, km: round1(st.distance.value / 1000) };
}

const plain = s => {
  const d = document.createElement('div');
  d.innerHTML = s || '';
  return d.textContent.trim();
};

// ------------------------------------------------------------------ the map

/**
 * A Google map in el. Returns a controller: { setHome, setSchools, select, showRoute, clearRoute, fit, destroy }.
 * schools: [{ id, name, lat, lng, band }]; onSelect(id) runs when a marker is clicked.
 */
export async function createMap(el, { onSelect = () => {}, interactive = true } = {}) {
  await loadGoogle();
  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  const map = new Map(el, {
    center: { lat: 1.3521, lng: 103.8198 }, zoom: 11, mapId: mapId(),
    disableDefaultUI: true, zoomControl: true, fullscreenControl: interactive, clickableIcons: false,
    gestureHandling: interactive ? 'cooperative' : 'none', keyboardShortcuts: interactive,
  });
  const markers = new globalThis.Map();
  let home = null;
  let renderer = null;
  let selected = null;

  const pin = (cls, label) => {
    const d = document.createElement('div');
    d.className = `gpin ${cls}`;
    d.setAttribute('aria-label', label);
    return d;
  };

  const api = {
    map,
    setHome(h) {
      if (home) home.map = null;
      home = h ? new AdvancedMarkerElement({ map, position: h, content: pin('gpin--home', 'Home'), title: 'Home', zIndex: 1000 }) : null;
    },
    setSchools(list) {
      const keep = new Set(list.map(s => s.id));
      for (const [id, m] of markers) if (!keep.has(id)) { m.map = null; markers.delete(id); }
      for (const s of list) {
        let m = markers.get(s.id);
        const cls = `gpin--${s.band}${s.id === selected ? ' is-selected' : ''}`;
        if (!m) {
          m = new AdvancedMarkerElement({ map, position: { lat: s.lat, lng: s.lng }, content: pin(cls, s.name), title: s.name, gmpClickable: true });
          m.addListener('gmp-click', () => onSelect(s.id));
          m.addListener('click', () => onSelect(s.id));
          markers.set(s.id, m);
        } else {
          m.content.className = `gpin ${cls}`;
        }
      }
    },
    select(id) {
      selected = id;
      for (const [mid, m] of markers) {
        m.content.classList.toggle('is-selected', mid === id);
        m.zIndex = mid === id ? 999 : null;
      }
      const m = markers.get(id);
      if (m) map.panTo(m.position);
    },
    fit(points) {
      if (!points.length) return;
      const b = new google.maps.LatLngBounds();
      points.forEach(p => b.extend(p));
      if (points.length === 1) { map.setCenter(points[0]); map.setZoom(14); } else map.fitBounds(b, 48);
    },
    showRoute(raw, index = 0) {
      if (!renderer) {
        renderer = new google.maps.DirectionsRenderer({
          map, suppressMarkers: true, preserveViewport: false,
          polylineOptions: { strokeColor: getComputedStyle(document.documentElement).getPropertyValue('--p-accent').trim() || '#0d7480', strokeWeight: 5, strokeOpacity: 0.9 },
        });
      }
      renderer.setDirections(raw);
      renderer.setRouteIndex(index);
    },
    clearRoute() { if (renderer) { renderer.setMap(null); renderer = null; } },
    destroy() {
      for (const m of markers.values()) m.map = null;
      markers.clear();
      if (home) home.map = null;
      api.clearRoute();
    },
  };
  return api;
}
