import * as L from './logic.js';
import { state, update, subscribe, reset, homeKey } from './store.js';
import * as maps from './maps.js';
import * as onemap from './onemap.js';
import { html, icon, toast } from './ui.js';
import * as motion from '../assets/motion/motion.js';
import * as sound from './sound.js';
import * as startView from './views/start.js';
import * as setupView from './views/setup.js';
import * as exploreView from './views/explore.js';
import * as schoolView from './views/school.js';
import * as planView from './views/plan.js';
import * as guideView from './views/guide.js';

const TRAVEL_GOOGLE_LIMIT = window.S1_CONFIG?.travelTimeSchools ?? 60;
const TRAVEL_ONEMAP_LIMIT = window.S1_CONFIG?.oneMapTravelSchools ?? 20;

// ------------------------------------------------------------------ the shared context every view reads

export const ctx = {
  data: null,
  byId: new Map(),
  weights: {},
  state,
  update,
  travel: { key: '', data: {}, status: 'idle', google: false, source: 'straight' },

  student() {
    const p = state.profile;
    const al = p.mode === 'subjects' ? L.totalAL(p.subjects) : p.total;
    const groups = L.postingGroups(al, p.mode === 'subjects' ? p.subjects.el : null, p.mode === 'subjects' ? p.subjects.math : null);
    const pg = groups.groups.includes(p.pg) ? p.pg : groups.groups.length === 1 ? groups.groups[0] : null;
    return { al, pg, groups, chinese: p.chinese, hcl: p.chinese === 'yes' ? p.hcl : 'none', gender: p.gender, primaryId: p.primaryId, home: p.home, interests: p.interests };
  },

  /** [{ school, option, cmp }] for one school, for the current student. */
  options(school) {
    const st = ctx.student();
    if (!st.pg || !st.al) return [];
    return L.schoolOptions(school, st.pg).map(option => ({ school, option, cmp: L.compareOption(school, option, st, ctx.data.affiliations) }));
  },

  choiceByKey(key) {
    const [id, prog] = key.split('|');
    const school = ctx.byId.get(id);
    if (!school) return null;
    return ctx.options(school).find(c => c.option.prog === prog) || null;
  },

  planChoices() {
    return state.plan.choices.map(k => ctx.choiceByKey(k)).filter(Boolean);
  },

  addChoice(key) {
    if (state.plan.choices.includes(key)) return;
    if (state.plan.choices.length >= L.MAX_CHOICES) { toast('You already have six choices. Remove one first.'); return; }
    update(s => {
      s.plan.choices.push(key);
      const id = key.split('|')[0];
      if (!s.plan.shortlist.includes(id)) s.plan.shortlist.push(id);
    });
    toast(`Added to your six (${state.plan.choices.length} of 6)`);
  },
  removeChoice(key) {
    const at = state.plan.choices.indexOf(key);
    if (at < 0) return;
    update(s => { s.plan.choices = s.plan.choices.filter(k => k !== key); });
    toast('Removed from your six', {
      label: 'Undo',
      run: () => update(s => { if (!s.plan.choices.includes(key)) s.plan.choices.splice(Math.min(at, s.plan.choices.length), 0, key); }),
    });
  },

  /** True when trips can be planned here (Google Maps in use, or OneMap routing set up); else only distances. */
  canRoute() {
    const g = maps.mapsStatus();
    return (g !== 'none' && g !== 'failed') || onemap.routingAvailable();
  },

  /** What each posting group the score allows would lead to (cached per profile). */
  preview() {
    const st = ctx.student();
    const key = JSON.stringify([st.al, st.groups.groups, st.gender, st.chinese, st.hcl, st.primaryId]);
    if (ctx._preview?.key !== key) ctx._preview = { key, value: L.groupPreview(ctx.data.schools, st, ctx.data.affiliations) };
    return ctx._preview.value;
  },

  /** The other posting group, when the score allows a choice and it has choices less stringent than the score. */
  betterGroup() {
    const st = ctx.student();
    if (!st.groups.choose || !st.pg) return null;
    const pv = ctx.preview();
    const other = st.groups.groups.find(g => g !== st.pg);
    return pv[st.pg].ahead === 0 && pv[other]?.ahead > 0 ? { pg: other, ahead: pv[other].ahead } : null;
  },

  /**
   * The one best next step for this student, so the app is always a step ahead:
   * score, about you, group, home, save schools, a safer choice, fill the six, fix a rule, then done.
   */
  nextStep() {
    const st = ctx.student();
    const p = state.profile;
    if (!st.al) return { id: 'score', title: 'Start with your PSLE score', text: 'Four taps, and you see how it compares with every school.', href: '#/setup/1', label: 'Enter my score' };
    if (p.chinese == null) return { id: 'about', title: 'Tell us a little about you', text: 'It decides which schools you can choose.', href: '#/setup/2', label: 'Carry on' };
    if (st.groups.choose && !st.pg) return { id: 'group', title: 'Choose your posting group', text: `With AL ${st.al} you can pick one of two.`, href: '#/setup/3', label: 'Choose my group' };
    if (!p.home) return { id: 'home', title: 'Add your home', text: 'See how far each school is from you.', href: '#/setup/4', label: 'Add my home' };
    const choices = ctx.planChoices();
    const n = choices.length;
    const ahead = choices.filter(c => c.cmp.band === 'ahead').length;
    const open = ctx.preview()[st.pg]?.ahead ?? 0;
    if (!state.plan.shortlist.length && !n) return { id: 'save', title: 'Save the schools you like', text: 'Tap the star on any school. Saved schools wait for you in My six.', href: '#/explore', label: 'Browse schools' };
    if (ahead < 2 && open > ahead) return { id: 'safer', title: ahead ? 'Add one more safer choice' : 'Add two safer choices', text: `${open} schools had cut-offs less stringent than AL ${st.al}. MOE suggests two or three in your six.`, action: 'safer', label: 'Show safer schools' };
    if (n < L.MAX_CHOICES) return { id: 'more', title: `Add ${L.MAX_CHOICES - n} more to your six`, text: n ? 'Using all six helps, as long as you would be happy at each school.' : 'Add schools from the list or from a school page.', href: '#/explore', label: 'Find schools' };
    const errors = L.checkPlan(choices, st, ctx.data.affiliations).some(i => i.level === 'error');
    if (errors) return { id: 'fix', title: 'Fix one thing in your six', text: 'One of your choices breaks a posting rule.', href: '#/plan', label: 'See the checks' };
    return { id: 'done', title: 'Your six is ready', text: 'Put them in the order you want them, then print the list to talk it over.', href: '#/plan', label: 'Open my six' };
  },

  switchGroup(pg) {
    update(s => { s.profile.pg = pg; s.ui.filters.band = 'all'; });
    toast(`Switched to Posting Group ${pg}`);
  },
  moveChoice(key, delta) {
    update(s => {
      const i = s.plan.choices.indexOf(key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= s.plan.choices.length) return;
      [s.plan.choices[i], s.plan.choices[j]] = [s.plan.choices[j], s.plan.choices[i]];
    });
  },
  toggleShortlist(id) {
    const on = state.plan.shortlist.includes(id);
    update(s => {
      s.plan.shortlist = on ? s.plan.shortlist.filter(x => x !== id) : [...s.plan.shortlist, id];
      if (on) s.plan.choices = s.plan.choices.filter(k => !k.startsWith(`${id}|`));
    });
    toast(on ? 'Removed from your shortlist' : 'Saved to your shortlist');
  },

  travelFor(id) { return ctx.travel.data[id] || null; },

  /** Work out travel times from home: Google for the nearest schools, straight-line for the rest. */
  async refreshTravel(force = false) {
    const home = state.profile.home;
    const mode = state.profile.mode_travel;
    // Google when it is in use; else OneMap for bus and train trips when it can route; else straight lines.
    const source = maps.mapsStatus() !== 'none' ? 'google' : mode === 'TRANSIT' && onemap.routingAvailable() ? 'onemap' : 'straight';
    const key = `${homeKey(home, mode)}|${source}`;
    if (!home) { ctx.travel = { key: '', data: {}, status: 'idle', google: false, source: 'straight' }; return; }
    if (!force && ctx.travel.key === key && ctx.travel.status !== 'error') return;
    ctx.travel = { key, data: {}, status: 'working', google: false, source };
    const all = ctx.data.schools;
    const straight = await maps.travelTimes(home, all, mode, () => {}, { google: false });
    ctx.travel.data = { ...straight };
    notify();
    if (source === 'straight') { ctx.travel.status = 'done'; notify(); return; }
    const keep = new Set([...state.plan.shortlist, ...state.plan.choices.map(k => k.split('|')[0])]);
    const limit = source === 'google' ? TRAVEL_GOOGLE_LIMIT : TRAVEL_ONEMAP_LIMIT;
    const near = [...all].sort((a, b) => straight[a.id].km - straight[b.id].km).filter((s, i) => i < limit || keep.has(s.id));
    if (source === 'onemap') {
      try {
        await onemap.travelTimes(home, near, L.nextSchoolMorning(), partial => {
          if (ctx.travel.key !== key) return;
          for (const [id, t] of Object.entries(partial)) ctx.travel.data[id] = { ...ctx.travel.data[id], ...t, km: ctx.travel.data[id]?.km ?? null };
          notify();
        });
        if (ctx.travel.key === key) ctx.travel.status = 'done';
      } catch (e) {
        console.warn('OneMap travel times failed; showing distances', e);
        if (ctx.travel.key === key) ctx.travel.status = e.message === 'onemap-auth' ? 'auth' : 'error';
      }
      notify();
      return;
    }
    await maps.travelTimes(home, near, mode, partial => {
      if (ctx.travel.key !== key) return;
      Object.assign(ctx.travel.data, partial);
      ctx.travel.google = Object.values(partial).some(t => t.src === 'google');
      notify();
    });
    if (ctx.travel.key === key) { ctx.travel.status = 'done'; notify(); }
  },
};

// ------------------------------------------------------------------ router

const ROUTES = [
  { re: /^$/, view: startView, nav: '' },
  { re: /^setup(?:\/(\d))?$/, view: setupView, nav: 'setup' },
  { re: /^explore$/, view: exploreView, nav: 'explore' },
  { re: /^school\/([\w-]+)$/, view: schoolView, nav: 'explore' },
  { re: /^plan$/, view: planView, nav: 'plan' },
  { re: /^guide$/, view: guideView, nav: 'guide' },
];

let current = null;
const main = () => document.getElementById('top');

function route() {
  const path = location.hash.replace(/^#\/?/, '');
  const match = ROUTES.map(r => ({ r, m: path.match(r.re) })).find(x => x.m) || { r: ROUTES[0], m: [] };
  current?.instance?.destroy?.();
  // A fresh <main> for every view, so no view's listeners outlive it.
  const old = main();
  const el = old.cloneNode(false);
  old.replaceWith(el);
  el.className = `view view--${match.r.nav || 'start'} view-in`;
  const instance = match.r.view.mount(el, ctx, match.m.slice(1));
  current = { r: match.r, instance };
  renderNav(match.r.nav);
  window.scrollTo(0, 0);
  // the motion layer runs once per page: give it each new view (the hero entrance, a count, tab indicators)
  try { motion.refresh(); } catch (e) { console.warn('motion', e); }
  const h1 = el.querySelector('h1');
  if (h1 && document.body.dataset.booted) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  document.body.dataset.booted = '1';
  document.title = `${h1 ? h1.textContent.trim() + ' · ' : ''}S1 Compass`;
}

function notify() {
  current?.instance?.update?.();
  renderNav(current?.r.nav);
}

// ------------------------------------------------------------------ nav

function renderNav(active) {
  const st = ctx.student();
  const n = state.plan.choices.length;
  const cur = k => (k === active ? 'page' : null);
  const links = [
    ['explore', '#/explore', 'Schools'],
    ['plan', '#/plan', 'My six'],
    ['guide', '#/guide', 'How posting works'],
  ];
  document.getElementById('nav-links').innerHTML = String(html`${links.map(([k, href, label]) => html`
    <li class="nav__item"><a class="nav__link" href="${href}" aria-current="${cur(k)}">${label}${k === 'plan' && n ? html` <span class="count">${n}</span>` : ''}</a></li>`)}`);
  const profile = st.al
    ? html`<a class="nav__link nav__profile" href="#/setup/1" aria-label="Edit my details: AL ${st.al}${st.pg ? `, posting group ${st.pg}` : ''}">${icon('user')}<span class="mono">AL ${st.al}${st.pg ? ` · PG${st.pg}` : ''}</span></a>`
    : '';
  const main = st.al
    ? html`<a class="btn btn--primary" href="#/plan">${n ? html`<span class="nav-long">My six · ${n}</span><span class="nav-short" aria-hidden="true">My six</span>` : 'My six'}</a>`
    : html`<a class="btn btn--primary" href="#/setup/1"><span class="nav-long">Start with my score</span><span class="nav-short" aria-hidden="true">Start</span></a>`;
  document.getElementById('nav-actions').innerHTML = String(html`${profile}
    ${sound.button()}<button class="icon-btn" type="button" data-open-settings aria-label="Map settings">${icon('gear')}</button>${main}`);
  const tabs = [
    ['explore', '#/explore', 'Schools', 'search'],
    ['plan', '#/plan', n ? `My six · ${n}` : 'My six', 'list'],
    ['guide', '#/guide', 'Guide', 'book'],
    ['setup', '#/setup/1', st.al ? `AL ${st.al}` : 'Me', 'user'],
  ];
  document.getElementById('tabbar').innerHTML = String(html`${tabs.map(([k, href, label, ic]) => html`
    <a class="tabbar__item" href="${href}" aria-current="${cur(k)}">${icon(ic)}<span>${label}</span></a>`)}`);
  document.body.classList.toggle('has-tabbar', active !== '' && active !== 'setup');
}

// ------------------------------------------------------------------ settings

function settings() {
  const dlg = document.getElementById('settings');
  const input = dlg.querySelector('#maps-key');
  const status = dlg.querySelector('[data-key-status]');
  const oneMapInput = dlg.querySelector('#onemap-token');
  const oneMapStatus = dlg.querySelector('[data-onemap-status]');
  const showStatus = () => {
    const s = maps.mapsStatus();
    if (maps.getProvider() === 'maplibre') { status.textContent = 'The open map is on. A saved key is kept but not used.'; return; }
    status.textContent = {
      none: 'No key yet. The app uses the open map and straight-line distances, and opens routes in Google Maps.',
      failed: 'Google Maps refused this key. Check that the APIs below are on and that this site is allowed.',
      ready: 'Google Maps is on: travel times, routes and the street map.',
      loading: 'Checking the key…',
      idle: 'Key saved. It is checked when a map opens.',
    }[s];
  };
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-settings]')) {
      input.value = maps.getKey();
      oneMapInput.value = onemap.getOwnToken();
      oneMapStatus.textContent = onemap.getOwnToken()
        ? 'Saved in this browser. OneMap tokens last three days.'
        : onemap.routingAvailable() ? 'This site already provides OneMap routes. You do not need a token.' : 'No token yet: the open map shows straight-line distances.';
      const p = dlg.querySelector(`input[name="provider"][value="${maps.getProvider()}"]`);
      if (p) p.checked = true;
      showStatus();
      dlg.showModal();
    }
  });
  dlg.querySelector('[data-save-key]').addEventListener('click', e => {
    e.preventDefault();
    maps.setKey(input.value);
    onemap.setOwnToken(oneMapInput.value);
    maps.setProvider(dlg.querySelector('input[name="provider"]:checked')?.value || 'auto');
    location.reload();
  });
  dlg.querySelector('[data-clear-key]').addEventListener('click', e => {
    e.preventDefault();
    maps.setKey('');
    location.reload();
  });
  dlg.querySelector('[data-reset]').addEventListener('click', e => {
    e.preventDefault();
    if (confirm('Clear your score, home, interests and list from this browser?')) {
      reset();
      dlg.close();
      location.hash = '#/';
    }
  });
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  maps.onMapsChange(() => { if (dlg.open) showStatus(); });
}

// ------------------------------------------------------------------ boot

async function boot() {
  const el = main();
  try {
    const res = await fetch('data/schools.json');
    if (!res.ok) throw new Error(res.status);
    ctx.data = await res.json();
  } catch (e) {
    el.innerHTML = String(html`<div class="wrap empty"><h1>The school list did not load</h1><p>Check your connection and reload the page.</p></div>`);
    return;
  }
  for (const s of ctx.data.schools) ctx.byId.set(s.id, s);
  ctx.weights = L.tagWeights(ctx.data.schools);
  settings();
  sound.init();
  // "Show safer schools": the list, filtered to schools whose past cut-offs were less stringent than the score
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-next-action="safer"]');
    if (!b) return;
    update(s => { s.ui.filters = { ...s.ui.filters, band: 'ahead', q: '', withinLimit: false, interestsOnly: false }; s.ui.sort = 'travel'; }, { silent: true });
    if (location.hash === '#/explore') route(); else location.hash = '#/explore';
  });
  maps.onMapsChange(s => { if (s === 'failed') { ctx.travel.key = ''; ctx.refreshTravel(); } notify(); });
  subscribe(() => notify());
  window.addEventListener('hashchange', route);
  route();
  ctx.refreshTravel();
}

boot();
