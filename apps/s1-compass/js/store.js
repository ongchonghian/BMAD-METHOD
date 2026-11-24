// The student's profile, list and travel times, kept in this browser only.

const KEY = 's1compass.v1';

const blank = () => ({
  profile: {
    mode: 'subjects', // or 'total'
    subjects: { el: null, math: null, sci: null, mt: null },
    total: null,
    pg: null,
    gender: null, // 'boy' | 'girl' | null
    primaryId: null,
    chinese: null, // 'yes' | 'no'
    hcl: 'unknown', // 'D' | 'M' | 'P' | 'none' | 'unknown'
    home: null, // { lat, lng, label, address }
    maxMinutes: 60,
    mode_travel: 'TRANSIT',
    interests: [],
    done: false,
  },
  plan: { choices: [], shortlist: [], notes: {}, checked: {} },
  ui: { view: 'list', sort: 'travel', filters: { band: 'all', withinLimit: false, interestsOnly: false, type: 'all', gender: 'all', sap: false, ip: false, area: 'all', special: false, q: '' } },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const saved = JSON.parse(raw);
    const b = blank();
    return {
      profile: { ...b.profile, ...saved.profile, subjects: { ...b.profile.subjects, ...saved.profile?.subjects } },
      plan: { ...b.plan, ...saved.plan },
      ui: { ...b.ui, ...saved.ui, filters: { ...b.ui.filters, ...saved.ui?.filters } },
    };
  } catch {
    return blank();
  }
}

export const state = load();
const subs = new Set();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep in memory */ }
}

export function update(fn, { silent = false } = {}) {
  fn(state);
  save();
  if (!silent) subs.forEach(s => s(state));
}

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function reset() {
  const b = blank();
  Object.assign(state, b);
  save();
  subs.forEach(s => s(state));
}

export function homeKey(home, mode) {
  return home ? `${home.lat.toFixed(5)},${home.lng.toFixed(5)}|${mode}` : '';
}
