// The open street map: MapLibre GL JS (vendored in assets/vendor) over OpenFreeMap tiles, no key needed.
// Same controller shape as maps.createMap and plot.createPlot, so views use any of the three.

const LIB = new URL('../assets/vendor/maplibre-gl/maplibre-gl.mjs', import.meta.url).href;
const CSS = new URL('../assets/vendor/maplibre-gl/maplibre-gl.css', import.meta.url).href;
const SG = { center: [103.8198, 1.3521], bounds: [[103.55, 1.15], [104.15, 1.52]] };
let lib = null;

export function styleUrl() {
  return window.S1_CONFIG?.maplibreStyle || 'https://tiles.openfreemap.org/styles/positron';
}

function load() {
  if (!lib) {
    if (!document.querySelector(`link[href="${CSS}"]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = CSS;
      document.head.append(l);
    }
    lib = import(LIB).catch(e => { lib = null; throw e; });
  }
  return lib;
}

/** Resolves once the style has loaded; rejects if it fails first or takes longer than ms. */
function ready(map, ms = 10000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('map style timed out')), ms);
    map.once('load', () => { clearTimeout(t); resolve(); });
    map.once('error', e => { if (!map.loaded()) { clearTimeout(t); reject(e.error || new Error('map style failed')); } });
  });
}

export async function createMapLibre(el, { onSelect = () => {}, interactive = true } = {}) {
  const ml = await load();
  el.innerHTML = '';
  const map = new ml.Map({
    container: el,
    style: styleUrl(),
    center: SG.center,
    zoom: 10.2,
    maxBounds: SG.bounds,
    interactive,
    cooperativeGestures: interactive,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
  });
  if (interactive) map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
  try {
    await ready(map);
  } catch (e) {
    map.remove();
    throw e;
  }
  map.touchZoomRotate?.disableRotation?.();

  const markers = new Map();
  let home = null;
  let selected = null;

  // A marker is a button (focusable, named) holding the pin, so the pin can scale without
  // fighting the transform MapLibre uses to place the marker.
  const pinEl = (cls, label, clickable) => {
    const b = document.createElement(clickable ? 'button' : 'div');
    b.className = 'mlpin';
    if (clickable) { b.type = 'button'; b.setAttribute('aria-label', label); } else b.setAttribute('aria-hidden', 'true');
    b.title = label;
    const i = document.createElement('span');
    i.className = `gpin ${cls}`;
    b.append(i);
    return b;
  };

  const LINE = 'home-to-school';
  const ROUTE = 'planned-route';
  const api = {
    kind: 'maplibre',
    map,
    setHome(h) {
      home?.remove();
      home = h ? new ml.Marker({ element: pinEl('gpin--home', 'Home', false) }).setLngLat([h.lng, h.lat]).addTo(map) : null;
    },
    setSchools(list) {
      const keep = new Set(list.map(s => s.id));
      for (const [id, m] of markers) if (!keep.has(id)) { m.remove(); markers.delete(id); }
      for (const s of list) {
        let m = markers.get(s.id);
        const cls = `gpin--${s.band}${s.id === selected ? ' is-selected' : ''}`;
        if (!m) {
          const elm = pinEl(cls, s.name, true);
          elm.addEventListener('click', e => { e.stopPropagation(); onSelect(s.id); });
          m = new ml.Marker({ element: elm }).setLngLat([s.lng, s.lat]).addTo(map);
          markers.set(s.id, m);
        } else {
          m.getElement().firstChild.className = `gpin ${cls}`;
        }
      }
    },
    select(id) {
      selected = id;
      for (const [mid, m] of markers) {
        m.getElement().firstChild.classList.toggle('is-selected', mid === id);
        m.getElement().style.zIndex = mid === id ? '2' : '';
      }
      const m = markers.get(id);
      if (m && interactive) map.easeTo({ center: m.getLngLat(), duration: 400 });
    },
    fit(points) {
      if (!points.length) return;
      if (points.length === 1) { map.jumpTo({ center: [points[0].lng, points[0].lat], zoom: 14.5 }); return; }
      const b = new ml.LngLatBounds();
      points.forEach(p => b.extend([p.lng, p.lat]));
      map.fitBounds(b, { padding: 56, maxZoom: 15, duration: 0 });
    },
    /** A dashed straight line from home to a school: distance only, not a route. */
    showLine(a, b) {
      const data = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] } };
      if (map.getSource(LINE)) { map.getSource(LINE).setData(data); return; }
      map.addSource(LINE, { type: 'geojson', data });
      map.addLayer({
        id: LINE, type: 'line', source: LINE,
        paint: { 'line-color': getComputedStyle(document.documentElement).getPropertyValue('--p-accent').trim() || '#0d7480', 'line-width': 2.5, 'line-dasharray': [2, 2] },
      });
    },
    /** A planned route, one line per leg: walks dashed grey, buses and trains solid in their line colour. */
    showPaths(paths, extra = []) {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--p-accent').trim() || '#0d7480';
      const features = paths.map(p => ({
        type: 'Feature',
        properties: { walk: p.kind === 'walk', colour: p.kind === 'walk' ? '#6b7a80' : p.colour || accent },
        geometry: { type: 'LineString', coordinates: p.coords },
      }));
      const data = { type: 'FeatureCollection', features };
      if (map.getSource(ROUTE)) map.getSource(ROUTE).setData(data);
      else {
        map.addSource(ROUTE, { type: 'geojson', data });
        map.addLayer({ id: `${ROUTE}-casing`, type: 'line', source: ROUTE, filter: ['!', ['get', 'walk']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 8 } });
        map.addLayer({ id: `${ROUTE}-ride`, type: 'line', source: ROUTE, filter: ['!', ['get', 'walk']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'colour'], 'line-width': 5 } });
        map.addLayer({ id: `${ROUTE}-walk`, type: 'line', source: ROUTE, filter: ['get', 'walk'], layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'colour'], 'line-width': 3, 'line-dasharray': [0.5, 2] } });
      }
      const pts = [...paths.flatMap(p => p.coords.map(([lng, lat]) => ({ lng, lat }))), ...extra.filter(Boolean)];
      api.fit(pts);
    },
    showRoute() {},
    clearRoute() {
      if (map.getLayer(LINE)) { map.removeLayer(LINE); map.removeSource(LINE); }
      for (const id of [`${ROUTE}-walk`, `${ROUTE}-ride`, `${ROUTE}-casing`]) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(ROUTE)) map.removeSource(ROUTE);
    },
    resize() { map.resize(); },
    destroy() { map.remove(); },
  };
  return api;
}
