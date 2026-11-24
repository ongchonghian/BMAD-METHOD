// Templating with escaping, icons and the small shared pieces every view uses.

import { BAND, copText, formatMinutes, INTEREST_LABEL } from './logic.js';

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = s => new Raw(s);

/** A boolean as an attribute value ("true"/"false"); a bare false would render as an empty string. */
export const tf = v => (v ? 'true' : 'false');

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

// One drawn icon per interest, on the same 20px grid and stroke as the interface icons.
const INTEREST_P = {
  robotics_and_making: 'M6 7.5h8a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 14V9A1.5 1.5 0 0 1 6 7.5zM10 7.5V4.5M8 11h.01M12 11h.01M8 13.5h4',
  coding_and_computing: 'M7 6l-4 4 4 4M13 6l4 4-4 4M11 4.5l-2 11',
  research_and_inquiry: 'M8 3.5h4M9 3.5V8l-4 7a1 1 0 0 0 .9 1.5h8.2a1 1 0 0 0 .9-1.5l-4-7V3.5M6.5 12.5h7',
  environment_and_sustainability: 'M4.5 15.5c0-6 4-10.5 11-11 0 7-4.5 11-11 11zM4.5 15.5l6-6',
  sports: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM5 5c3 2 3 8 0 10M15 5c-3 2-3 8 0 10',
  outdoor_activities: 'M2.5 16l5-8 3 4.5 2-3 5 6.5zM13 5.5h.01',
  music: 'M8 15V5l8-1.5V13M8 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM16 13a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  drama_dance_and_performance: 'M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z',
  arts_and_design: 'M13.5 3.5l3 3-7 7-3-3zM6.5 10.5c-2 0-3 1.5-3 3.5 0 1-.5 2-1 2.5 2.5.5 6-.5 6-3.5',
  communication_and_media: 'M10 3a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0v-4A2.5 2.5 0 0 0 10 3zM5.5 9.5a4.5 4.5 0 0 0 9 0M10 14v3',
  language_and_culture: 'M4 5h12v8H9l-3.5 3v-3H4zM7.5 8h5M7.5 10.5h3',
  leadership: 'M5 17V3.5M5 4h9l-2 3 2 3H5',
  community_service: 'M10 16s-6-3.6-6-8a3.2 3.2 0 0 1 6-1.6A3.2 3.2 0 0 1 16 8c0 4.4-6 8-6 8zM10 7.5v4M8 9.5h4',
  global_exposure: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM3 10h14M10 3c2 2 3 4.5 3 7s-1 5-3 7c-2-2-3-4.5-3-7s1-5 3-7z',
  enterprise: 'M7.5 13.5a5 5 0 1 1 5 0V15h-5zM8 17h4',
  vocational_and_work_experience: 'M12.5 3.5a3.5 3.5 0 0 0-3.3 4.6L4 13.3 6.7 16l5.2-5.2a3.5 3.5 0 0 0 4.6-3.3l-2 2-2.3-.5-.5-2.3z',
  boarding: 'M3 15V6M3 11h14v4M17 11V9.5A2 2 0 0 0 15 7.5H9v3.5M6 9.5h.01',
};

export function interestIcon(id) {
  return raw(`<svg class="i i--interest" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="${INTEREST_P[id] || P.heart}"/></svg>`);
}

/** The one best thing to do next, as a card: a title, a reason and one action. */
export function nextCard(step, { compact = false } = {}) {
  if (!step) return '';
  return html`<aside class="next-card ${compact ? 'next-card--compact' : ''}" aria-label="Next step">
    <span class="next-card__stop" aria-hidden="true"><i></i></span>
    <div class="next-card__text">
      <span class="t-label next-card__label">Next stop</span>
      <strong class="next-card__title">${step.title}</strong>
      ${step.text ? html`<span class="next-card__why">${step.text}</span>` : ''}
    </div>
    ${step.action
      ? html`<button class="btn btn--primary btn--sm" type="button" data-next-action="${step.action}">${step.label}${arrow}</button>`
      : step.href ? html`<a class="btn btn--primary btn--sm" href="${step.href}">${step.label}${arrow}</a>` : ''}
  </aside>`;
}

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

/** A short message at the foot of the screen; with an action (Undo) it stays longer and holds a button. */
export function toast(text, action = null) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = '';
  const span = document.createElement('span');
  span.textContent = text;
  el.append(span);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast__action';
    b.textContent = action.label;
    b.addEventListener('click', () => { el.hidden = true; action.run(); }, { once: true });
    el.append(b);
  }
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { if (!el.contains(document.activeElement)) el.hidden = true; }, action ? 7000 : 2600);
  announce(action ? `${text}. ${action.label} is available.` : text);
}
