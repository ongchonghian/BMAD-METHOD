// Templating with escaping, icons and the small shared pieces every view uses.

import { BAND, copText, formatMinutes, INTEREST_LABEL } from './logic.js';

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = s => new Raw(s);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);

function fmt(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(fmt).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
}

/** Tagged template: interpolations are escaped unless wrapped in raw() or produced by html``. */
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += fmt(vals[i]); });
  return new Raw(out);
}

// ------------------------------------------------------------------ icons (20px grid, 1.6 stroke)

const P = {
  home: 'M3.5 9.5 10 4l6.5 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-4V17H4.5a1 1 0 0 1-1-1z',
  bus: 'M5 4.5h10a1.5 1.5 0 0 1 1.5 1.5v8.5H3.5V6A1.5 1.5 0 0 1 5 4.5zM3.5 10h13M6 17v-2.5M14 17v-2.5M6.5 12.5h.01M13.5 12.5h.01',
  train: 'M6 3.5h8a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2zM4 9.5h12M7 18l1.5-3M13 18l-1.5-3M7.5 12.5h.01M12.5 12.5h.01',
  walk: 'M11 4.5a1.25 1.25 0 1 0 0-.01M9.5 17l1.5-4.5 2 2V17M8 10l2-2.5 2.5 1 1.5 2M11 8l-1 4.5',
  car: 'M4 13.5V11l1.6-4a1.5 1.5 0 0 1 1.4-1h6a1.5 1.5 0 0 1 1.4 1l1.6 4v2.5M4 13.5h12v2H4zM6.5 13.5V16M13.5 13.5V16M4 11h12',
  star: 'M10 3.5l1.9 4 4.4.5-3.3 3 .9 4.3L10 13.1l-3.9 2.2.9-4.3-3.3-3 4.4-.5z',
  plus: 'M10 4.5v11M4.5 10h11',
  check: 'M4.5 10.5l3.5 3.5 7.5-8',
  warn: 'M10 3.5l7 12.5H3zM10 8.5v3.5M10 14.25h.01',
  error: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM7.5 7.5l5 5M12.5 7.5l-5 5',
  info: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM10 9v4.5M10 6.5h.01',
  up: 'M10 15.5v-11M5.5 9 10 4.5 14.5 9',
  down: 'M10 4.5v11M5.5 11l4.5 4.5 4.5-4.5',
  x: 'M5.5 5.5l9 9M14.5 5.5l-9 9',
  out: 'M8.5 5H5.5A1.5 1.5 0 0 0 4 6.5v8A1.5 1.5 0 0 0 5.5 16h8a1.5 1.5 0 0 0 1.5-1.5v-3M11.5 4H16v4.5M16 4l-7 7',
  map: 'M3.5 5.5l4-1.5 5 1.5 4-1.5v10.5l-4 1.5-5-1.5-4 1.5zM7.5 4v10.5M12.5 5.5V16',
  list: 'M7 5.5h9.5M7 10h9.5M7 14.5h9.5M3.5 5.5h.01M3.5 10h.01M3.5 14.5h.01',
  search: 'M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM13 13l3.5 3.5',
  sliders: 'M4 6h7M14 6h2M4 14h2M9 14h7M12.5 4.5v3M7.5 12.5v3',
  pin: 'M10 17s5.5-4.8 5.5-9a5.5 5.5 0 1 0-11 0c0 4.2 5.5 9 5.5 9zM10 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  clock: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM10 6.5V10l2.5 1.5',
  heart: 'M10 16s-6-3.6-6-8a3.2 3.2 0 0 1 6-1.6A3.2 3.2 0 0 1 16 8c0 4.4-6 8-6 8z',
  back: 'M12.5 4.5 7 10l5.5 5.5',
  edit: 'M4 16h3l8.5-8.5-3-3L4 13zM11 6l3 3',
  print: 'M6 7.5V3.5h8v4M6 13.5H4.5A1.5 1.5 0 0 1 3 12V9a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 17 9v3a1.5 1.5 0 0 1-1.5 1.5H14M6 11h8v5.5H6z',
  copy: 'M7.5 7.5h8v9h-8zM4.5 12.5v-9h8',
  gear: 'M3.5 5.5l4-1.5 5 1.5 4-1.5v10.5l-4 1.5-5-1.5-4 1.5zM7.5 4v10.5M12.5 5.5V16',
  locate: 'M10 3v2.5M10 14.5V17M3 10h2.5M14.5 10H17M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  compare: 'M7 3.5v13M13 3.5v13M3.5 7h3.5M13 13h3.5',
  book: 'M4 4.5h4.5A1.5 1.5 0 0 1 10 6v10a1.5 1.5 0 0 0-1.5-1.5H4zM16 4.5h-4.5A1.5 1.5 0 0 0 10 6v10a1.5 1.5 0 0 1 1.5-1.5H16z',
  user: 'M10 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.5 16.5a5.5 5.5 0 0 1 11 0',
  approx: 'M4.5 8.5c1.8-1.6 3.7-1.6 5.5 0s3.7 1.6 5.5 0M4.5 12.5c1.8-1.6 3.7-1.6 5.5 0s3.7 1.6 5.5 0',
  dash: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM6.5 10h7',
};

export function icon(name, cls = '') {
  return raw(`<svg class="i ${cls}" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="${P[name]}"/></svg>`);
}

export const arrow = raw('<svg class="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path class="m-arrow__stem" d="M1 6h8"/><path class="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5"/></svg>');

// ------------------------------------------------------------------ shared pieces

const BAND_ICON = { ahead: 'check', mixed: 'approx', behind: 'dash', none: 'info', special: 'info' };

export function bandBadge(cmp, { short = false } = {}) {
  const b = cmp.band;
  const label = short ? BAND[b].short : BAND[b].label;
  const extra = cmp.partial ? ' (one year only)' : '';
  return html`<span class="band band--${b}">${icon(BAND_ICON[b])}<span>${label}${extra}</span></span>`;
}

export function copPair(cmp) {
  return html`<span class="cops mono">${[2024, 2025].map(y => html`<span><span class="cops__y">${y}</span> ${copText(cmp.years[y].rec)}</span>`)}</span>`;
}

export function travelChip(t, mode = 'TRANSIT') {
  if (!t) return '';
  if (t.min != null) {
    const ic = mode === 'DRIVING' ? 'car' : mode === 'WALKING' ? 'walk' : 'bus';
    return html`<span class="meta-chip">${icon(ic)}${formatMinutes(t.min)}</span>`;
  }
  return html`<span class="meta-chip" title="Straight-line distance">${icon('pin')}${t.km} km away</span>`;
}

export function interestChips(matches, max = 3) {
  if (!matches.length) return '';
  const shown = matches.slice(0, max).map(m => INTEREST_LABEL[m]);
  const more = matches.length > max ? ` +${matches.length - max}` : '';
  return html`<span class="meta-chip meta-chip--interest">${icon('heart')}${shown.join(', ')}${more}</span>`;
}

export const GENDER_LABEL = { coed: 'Co-ed', boys: 'Boys', girls: 'Girls' };

export function schoolTags(s) {
  const tags = [s.area, GENDER_LABEL[s.gender]];
  if (s.sap) tags.push('SAP');
  if (s.ip) tags.push('IP');
  if (s.type !== 'Government School') tags.push(s.type.replace(' School', ''));
  return tags.join(' · ');
}

/** A small live region for announcements (copy done, list updated). */
export function announce(text) {
  const el = document.getElementById('announcer');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 30);
}

export function toast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 2600);
  announce(text);
}
