// The map without a Google key: every school drawn at its real position on a schematic outline of the island,
// with home. Same controller shape as maps.createMap, so views use either.

const OUTLINE = [
  [103.607, 1.316], [103.618, 1.283], [103.64, 1.265], [103.68, 1.292], [103.7, 1.3], [103.73, 1.29],
  [103.76, 1.275], [103.8, 1.265], [103.83, 1.262], [103.85, 1.272], [103.862, 1.28], [103.878, 1.292],
  [103.9, 1.298], [103.93, 1.302], [103.96, 1.312], [103.985, 1.32], [104.01, 1.33], [104.03, 1.345],
  [104.025, 1.37], [103.99, 1.392], [103.96, 1.385], [103.93, 1.395], [103.91, 1.418], [103.88, 1.418],
  [103.86, 1.425], [103.835, 1.455], [103.812, 1.47], [103.79, 1.457], [103.765, 1.452], [103.74, 1.446],
  [103.715, 1.443], [103.69, 1.428], [103.67, 1.41], [103.65, 1.38], [103.63, 1.35],
];
const BOX = { w: 1000, h: 560, lng0: 103.59, lng1: 104.05, lat0: 1.235, lat1: 1.485 };
const x = lng => ((lng - BOX.lng0) / (BOX.lng1 - BOX.lng0)) * BOX.w;
const y = lat => ((BOX.lat1 - lat) / (BOX.lat1 - BOX.lat0)) * BOX.h;
const NS = 'http://www.w3.org/2000/svg';

export function outlinePath() {
  return `M${OUTLINE.map(([lng, lat]) => `${x(lng).toFixed(1)} ${y(lat).toFixed(1)}`).join('L')}Z`;
}

/** A static SVG string (for the start page): schools as dots, optional home. */
export function plotSvg(points, home, label) {
  const dots = points.map(p => `<circle class="plot__dot plot__dot--${p.band || 'plain'}" cx="${x(p.lng).toFixed(1)}" cy="${y(p.lat).toFixed(1)}" r="5"/>`).join('');
  const h = home ? `<g class="plot__home" transform="translate(${x(home.lng).toFixed(1)} ${y(home.lat).toFixed(1)})"><circle r="11"/><path d="M-5 1 0-4 5 1V5H-5Z"/></g>` : '';
  return `<svg class="plot" viewBox="0 0 ${BOX.w} ${BOX.h}" role="img" aria-label="${label}"><path class="plot__land" d="${outlinePath()}"/>${dots}${h}</svg>`;
}

/** An interactive plot in el. */
export function createPlot(el, { onSelect = () => {} } = {}) {
  el.innerHTML = '';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${BOX.w} ${BOX.h}`);
  svg.setAttribute('class', 'plot plot--live');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Schematic map of Singapore with the schools in this list');
  const land = document.createElementNS(NS, 'path');
  land.setAttribute('class', 'plot__land');
  land.setAttribute('d', outlinePath());
  const dots = document.createElementNS(NS, 'g');
  const top = document.createElementNS(NS, 'g');
  svg.append(land, dots, top);
  el.append(svg);
  const nodes = new Map();
  let home = null;
  let selected = null;

  return {
    kind: 'plot',
    setHome(h) {
      home?.remove();
      home = null;
      if (!h) return;
      home = document.createElementNS(NS, 'g');
      home.setAttribute('class', 'plot__home');
      home.setAttribute('transform', `translate(${x(h.lng)} ${y(h.lat)})`);
      home.innerHTML = '<title>Home</title><circle r="12"/><path d="M-5.5 1 0-4.5 5.5 1V6H-5.5Z"/>';
      top.append(home);
    },
    setSchools(list) {
      const keep = new Set(list.map(s => s.id));
      for (const [id, n] of nodes) if (!keep.has(id)) { n.remove(); nodes.delete(id); }
      for (const s of list) {
        let n = nodes.get(s.id);
        if (!n) {
          n = document.createElementNS(NS, 'circle');
          n.setAttribute('cx', x(s.lng));
          n.setAttribute('cy', y(s.lat));
          n.setAttribute('r', 6);
          n.setAttribute('tabindex', '0');
          n.setAttribute('role', 'button');
          n.innerHTML = `<title>${s.name.replace(/</g, '&lt;')}</title>`;
          n.setAttribute('aria-label', s.name);
          n.addEventListener('click', () => onSelect(s.id));
          n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); } });
          nodes.set(s.id, n);
          dots.append(n);
        }
        n.setAttribute('class', `plot__dot plot__dot--${s.band}${s.id === selected ? ' is-selected' : ''}`);
      }
    },
    select(id) {
      selected = id;
      for (const [nid, n] of nodes) {
        n.classList.toggle('is-selected', nid === id);
        if (nid === id) dots.append(n);
      }
    },
    fit() {},
    showRoute() {},
    showLine() {},
    clearRoute() {},
    destroy() { el.innerHTML = ''; },
  };
}
