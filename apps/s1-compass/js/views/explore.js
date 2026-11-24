import { html, icon, bandBadge, copPair, travelChip, interestChips, schoolTags } from '../ui.js';
import { BAND, interestMatches, interestScore, isGenderOk, PG_INFO } from '../logic.js';
import * as maps from '../maps.js';
import { openMap, matches } from '../mapview.js';
import { footer } from './start.js';

const SORTS = [['match', 'Your interests first'], ['travel', 'Shortest trip'], ['margin', 'Largest score margin'], ['name', 'A to Z']];
const TYPES = [['all', 'All types'], ['Government School', 'Government'], ['Government-Aided School', 'Government-aided'], ['Independent School', 'Independent'], ['Specialised Independent School', 'Specialised independent']];

export function mount(el, ctx) {
  let map = null;
  let selected = null;
  let creating = null;

  const ui = () => ctx.state.ui;
  const f = () => ctx.state.ui.filters;

  function items() {
    const st = ctx.student();
    const shortlist = new Set(ctx.state.plan.shortlist);
    return ctx.data.schools.map(s => {
      const opts = ctx.options(s);
      const kind = !s.ordinary ? 'special' : opts.length ? 'option' : st.pg ? 'unavailable' : 'noscore';
      const bands = kind === 'special' ? ['special'] : opts.map(o => o.cmp.band);
      const best = opts.reduce((m, o) => (o.cmp.buffer != null && (m == null || o.cmp.buffer > m) ? o.cmp.buffer : m), null);
      const rank = ['ahead', 'mixed', 'behind', 'none', 'special'];
      const band = bands.sort((a, b) => rank.indexOf(a) - rank.indexOf(b))[0] || 'none';
      return {
        s, opts, kind, band, best,
        t: ctx.travelFor(s.id),
        matches: interestMatches(s, st.interests),
        score: interestScore(s, st.interests, ctx.weights),
        saved: shortlist.has(s.id),
      };
    });
  }

  function filtered(all) {
    const st = ctx.student();
    const F = f();
    const q = F.q.trim().toLowerCase();
    const max = ctx.state.profile.maxMinutes;
    return all.filter(it => {
      if (it.kind === 'unavailable') return false;
      if (it.kind === 'special' && !F.special) return false;
      if (!isGenderOk(it.s, st.gender)) return false;
      if (q && !`${it.s.name} ${it.s.area}`.toLowerCase().includes(q)) return false;
      if (F.band !== 'all' && !it.opts.some(o => o.cmp.band === F.band)) return false;
      if (F.withinLimit && max && it.t?.min != null && it.t.min > max) return false;
      if (F.interestsOnly && !it.matches.length) return false;
      if (F.type !== 'all' && it.s.type !== F.type) return false;
      if (F.gender !== 'all' && it.s.gender !== F.gender) return false;
      if (F.sap && !it.s.sap) return false;
      if (F.ip && !it.opts.some(o => o.option.prog === 'IP')) return false;
      if (F.area !== 'all' && it.s.area !== F.area) return false;
      return true;
    }).sort(sorter(ui().sort));
  }

  function sorter(by) {
    const trip = it => it.t?.min ?? (it.t?.km != null ? 1000 + it.t.km : 1e6);
    const name = (a, b) => a.s.name.localeCompare(b.s.name);
    if (by === 'travel') return (a, b) => trip(a) - trip(b) || name(a, b);
    if (by === 'margin') return (a, b) => (b.best ?? -99) - (a.best ?? -99) || trip(a) - trip(b);
    if (by === 'match') return (a, b) => b.score - a.score || trip(a) - trip(b) || name(a, b);
    return name;
  }

  // ---------------------------------------------------------------- render

  function render() {
    const st = ctx.student();
    const p = ctx.state.profile;
    const all = items();
    const list = filtered(all);
    const F = f();
    const counts = Object.fromEntries(['ahead', 'mixed', 'behind'].map(b => [b, all.filter(it => it.kind === 'option' && isGenderOk(it.s, st.gender) && it.opts.some(o => o.cmp.band === b)).length]));
    const specials = all.filter(it => it.kind === 'special').length;
    const areas = [...new Set(ctx.data.schools.map(s => s.area))].sort();
    const travel = ctx.travel;
    const moreOn = ['type', 'gender', 'area'].filter(k => F[k] !== 'all').length + ['sap', 'ip', 'special'].filter(k => F[k]).length;

    el.innerHTML = String(html`
    <div class="page page--explore" data-view="${ui().view}">
      <div class="wrap explore-head">
        <div class="profile-strip">
          ${st.al
            ? html`<span class="ps-item mono"><strong>AL ${st.al}</strong></span>
                   <span class="ps-item">${st.pg ? PG_INFO[st.pg].name : 'Posting group not chosen'}</span>
                   <span class="ps-item">${icon('home')}${p.home ? p.home.label : html`<a class="inline-link" href="#/setup/4">Add your home</a>`}</span>
                   <span class="ps-item">${icon('heart')}${st.interests.length ? `${st.interests.length} interests` : html`<a class="inline-link" href="#/setup/5">Add interests</a>`}</span>
                   <a class="ps-edit" href="#/setup/1">${icon('edit')}Edit</a>`
            : html`<span class="ps-item">Add your score to compare it with past cut-offs.</span><a class="btn btn--primary btn--sm" href="#/setup/1">Start with my score</a>`}
        </div>
        <h1 class="explore-title">${st.al ? 'Schools you can choose' : 'All secondary schools'} <span class="muted">${list.length} shown</span></h1>
        <div class="toolbar">
          <div class="search">
            ${icon('search')}
            <label class="sr-only" for="q">Search schools by name or area</label>
            <input id="q" name="q" type="search" placeholder="Search by name or area" value="${F.q}" data-fk="q">
          </div>
          ${st.al ? html`
          <fieldset class="seg seg--bands">
            <legend class="sr-only">Compare with past cut-offs</legend>
            ${[['all', 'All'], ['ahead', BAND.ahead.short], ['mixed', BAND.mixed.short], ['behind', BAND.behind.short]].map(([v, l]) => html`
              <label><input type="radio" name="band" value="${v}" ${F.band === v ? 'checked' : ''} data-fk="band-${v}"><span>${v !== 'all' ? html`<i class="dot dot--${v}" aria-hidden="true"></i>` : ''}${l}${v !== 'all' ? html` <span class="muted mono">${counts[v]}</span>` : ''}</span></label>`)}
          </fieldset>` : ''}
          <div class="chips chips--tool">
            ${p.home && p.maxMinutes ? html`<label class="chip"><input type="checkbox" name="withinLimit" ${F.withinLimit ? 'checked' : ''} data-fk="withinLimit"><span>${icon('clock')}Within ${p.maxMinutes} min</span></label>` : ''}
            ${st.interests.length ? html`<label class="chip"><input type="checkbox" name="interestsOnly" ${F.interestsOnly ? 'checked' : ''} data-fk="interestsOnly"><span>${icon('heart')}Matches my interests</span></label>` : ''}
            <details class="more" ${moreOn ? 'open' : ''}>
              <summary class="chip-like">${icon('sliders')}More filters${moreOn ? html` <span class="count">${moreOn}</span>` : ''}</summary>
              <div class="more__panel">
                <div class="field"><label for="f-type">School type</label><select id="f-type" name="type">${TYPES.map(([v, l]) => html`<option value="${v}" ${F.type === v ? 'selected' : ''}>${l}</option>`)}</select></div>
                <div class="field"><label for="f-gender">Boys, girls or co-ed</label><select id="f-gender" name="gender">${[['all', 'Any'], ['coed', 'Co-ed'], ['boys', 'Boys’ schools'], ['girls', 'Girls’ schools']].map(([v, l]) => html`<option value="${v}" ${F.gender === v ? 'selected' : ''}>${l}</option>`)}</select></div>
                <div class="field"><label for="f-area">Area</label><select id="f-area" name="area"><option value="all">Anywhere</option>${areas.map(a => html`<option ${F.area === a ? 'selected' : ''}>${a}</option>`)}</select></div>
                <div class="checks-col">
                  <label class="check"><input type="checkbox" name="sap" ${F.sap ? 'checked' : ''}><span>SAP schools only</span></label>
                  ${st.pg === 3 ? html`<label class="check"><input type="checkbox" name="ip" ${F.ip ? 'checked' : ''}><span>Integrated Programme (IP)</span></label>` : ''}
                  <label class="check"><input type="checkbox" name="special" ${F.special ? 'checked' : ''}><span>Schools with their own admission (${specials})</span></label>
                </div>
                <button class="btn btn--secondary btn--sm" type="button" data-clear-filters>Clear filters</button>
              </div>
            </details>
          </div>
          <div class="field field--inline sort">
            <label for="sort">Sort</label>
            <select id="sort" name="sort" data-fk="sort">${SORTS.map(([v, l]) => html`<option value="${v}" ${ui().sort === v ? 'selected' : ''}>${l}</option>`)}</select>
          </div>
        </div>
        <fieldset class="seg seg--view">
          <legend class="sr-only">Show</legend>
          <label><input type="radio" name="view" value="list" ${ui().view === 'list' ? 'checked' : ''}><span>${icon('list')}List</span></label>
          <label><input type="radio" name="view" value="map" ${ui().view === 'map' ? 'checked' : ''}><span>${icon('map')}Map</span></label>
        </fieldset>
      </div>
      <div class="wrap explore-body">
        <div class="explore-list">
          ${travelNote(ctx, p, travel)}
          ${st.al && st.pg ? html`<p class="t-small muted explainer">${icon('info')}<span>Comparisons use the ${PG_INFO[st.pg].name} cut-offs from the 2024 and 2025 postings. They describe past years, not your chances.</span></p>` : ''}
          ${list.length
            ? html`<ul class="results">${list.map(it => row(it, ctx))}</ul>`
            : html`<div class="empty"><h2 class="t-h3">No school matches all of these filters</h2><p>Try fewer filters, or a longer trip.</p><button class="btn btn--secondary" type="button" data-clear-filters>Clear filters</button></div>`}
        </div>
        <div class="explore-map">
          <div class="map-shell">
            <div class="map-canvas" data-map></div>
            <div class="map-legend" aria-hidden="true">
              ${st.al ? ['ahead', 'mixed', 'behind'].map(b => html`<span><i class="dot dot--${b}"></i>${BAND[b].short}</span>`) : ''}
              ${p.home ? html`<span><i class="dot dot--home"></i>Home</span>` : ''}
            </div>
            <div class="map-card" data-map-card hidden></div>
            <p class="map-note t-small" data-map-note hidden>Schematic map: the street map could not load. <button class="inline-link" type="button" data-open-settings>Map settings</button></p>
          </div>
        </div>
      </div>
      ${footer(ctx.data)}
    </div>`);
    return list;
  }

  function travelNote(ctx, p, travel) {
    if (!p.home) return '';
    if (travel.status === 'working') return html`<p class="t-small muted explainer" role="status">${icon('clock')}<span>Working out travel times from ${p.home.label}…</span></p>`;
    if (travel.google) return html`<p class="t-small muted explainer">${icon('clock')}<span>Trips by ${p.mode_travel === 'DRIVING' ? 'car' : 'bus and train'} on a school morning, arriving by 7:15, for the nearest schools. Further schools show distance.</span></p>`;
    if (travel.source === 'onemap' && travel.status === 'done') return html`<p class="t-small muted explainer">${icon('clock')}<span>Trips by bus and train from OneMap on a school morning, for the nearest schools and your shortlist. Further schools show distance.</span></p>`;
    if (travel.source === 'onemap' && travel.status === 'error') return html`<p class="t-small muted explainer">${icon('pin')}<span>OneMap could not plan trips just now, so distances are in a straight line from ${p.home.label}.</span></p>`;
    if (travel.source === 'onemap' && travel.status === 'auth') return html`<p class="t-small muted explainer">${icon('warn')}<span>OneMap refused the token, so distances are in a straight line. <button class="inline-link" type="button" data-open-settings>Update the OneMap token</button></span></p>`;
    return html`<p class="t-small muted explainer">${icon('pin')}<span>Distances are in a straight line from ${p.home.label}. ${maps.mapsStatus() === 'none' ? html`<button class="inline-link" type="button" data-open-settings>${maps.getKey() ? 'Switch to Google Maps' : 'Add a Google Maps key'}</button> for travel times.` : ''}</span></p>`;
  }

  function row(it, ctx) {
    const s = it.s;
    const choices = new Set(ctx.state.plan.choices);
    const mode = ctx.state.profile.mode_travel;
    return html`<li class="result card ${s.id === selected ? 'is-selected' : ''}" data-id="${s.id}">
      <div class="result__head">
        <h2 class="result__name"><a href="#/school/${s.id}" data-fk="open-${s.id}">${s.name}</a></h2>
        <button class="star" type="button" aria-pressed="${it.saved}" data-save="${s.id}" data-fk="save-${s.id}" aria-label="${it.saved ? 'Remove' : 'Save'} ${s.name} ${it.saved ? 'from' : 'to'} shortlist">${icon('star')}</button>
      </div>
      <p class="result__meta">${schoolTags(s)}</p>
      ${it.kind === 'special'
        ? html`<div class="opt">${bandBadge({ band: 'special' })}<span class="t-small">${s.admissionNote}</span></div>`
        : it.kind === 'noscore' ? ''
        : html`<div class="result__opts">${it.opts.map(o => html`<div class="opt">
            ${it.opts.length > 1 || o.option.prog === 'IP' ? html`<span class="opt__prog">${o.option.prog}</span>` : ''}
            ${bandBadge(o.cmp, { short: true })}
            ${copPair(o.cmp)}
            ${o.cmp.affiliated ? html`<span class="tag">Affiliated</span>` : ''}
            <button class="add ${choices.has(o.option.key) ? 'is-in' : ''}" type="button" data-add="${o.option.key}" data-fk="add-${o.option.key}" aria-pressed="${choices.has(o.option.key)}"
              aria-label="${choices.has(o.option.key) ? 'Remove' : 'Add'} ${s.name}${o.option.prog === 'IP' ? ' IP' : ''} ${choices.has(o.option.key) ? 'from' : 'to'} my six">${icon(choices.has(o.option.key) ? 'check' : 'plus')}<span>${choices.has(o.option.key) ? 'In my six' : 'Add'}</span></button>
          </div>`)}</div>`}
      <div class="result__chips">${travelChip(it.t, mode)}${interestChips(it.matches)}</div>
    </li>`;
  }

  // ---------------------------------------------------------------- map

  async function ensureMap() {
    if (creating) return creating;
    const box = el.querySelector('[data-map]');
    if (!box) return;
    if (matches(map) && box.isConnected && box.childElementCount) return;
    map?.destroy?.();
    map = null;
    creating = openMap(box, { onSelect: select }).then(m => { map = m; }).finally(() => { creating = null; });
    await creating;
    if (!box.isConnected) { map?.destroy?.(); map = null; return ensureMap(); }
    const note = el.querySelector('[data-map-note]');
    if (note) note.hidden = map?.kind !== 'plot';
  }

  let lastList = [];
  async function paintMap(list, fit) {
    await ensureMap();
    if (!map) return;
    const home = ctx.state.profile.home;
    map.setHome(home);
    map.setSchools(list.map(it => ({ id: it.s.id, name: it.s.name, lat: it.s.lat, lng: it.s.lng, band: it.kind === 'special' ? 'special' : it.kind === 'noscore' ? 'plain' : it.band })));
    if (selected) map.select(selected);
    if (fit && map.kind !== 'plot') {
      const near = home ? list.filter(it => it.t?.min != null || it.t?.km < 8).slice(0, 25) : list;
      map.fit([...(home ? [home] : []), ...(near.length ? near : list).map(it => ({ lat: it.s.lat, lng: it.s.lng }))]);
    }
  }

  function select(id) {
    selected = id;
    el.querySelectorAll('.result.is-selected').forEach(r => r.classList.remove('is-selected'));
    const r = el.querySelector(`.result[data-id="${id}"]`);
    r?.classList.add('is-selected');
    if (r && ui().view !== 'map' && window.matchMedia('(min-width: 1024px)').matches) r.scrollIntoView({ block: 'nearest' });
    map?.select(id);
    const it = lastList.find(x => x.s.id === id);
    const card = el.querySelector('[data-map-card]');
    if (!it || !card) return;
    card.innerHTML = String(html`
      <button class="icon-btn map-card__close" type="button" data-close-card aria-label="Close">${icon('x')}</button>
      <strong class="map-card__name">${it.s.name}</strong>
      <span class="t-small muted">${schoolTags(it.s)}</span>
      <span class="map-card__row">${it.kind === 'option' ? bandBadge(it.opts[0].cmp, { short: true }) : ''}${travelChip(it.t, ctx.state.profile.mode_travel)}</span>
      <a class="btn btn--primary btn--sm" href="#/school/${it.s.id}">View the school</a>`);
    card.hidden = false;
  }

  // ---------------------------------------------------------------- events

  function setFilter(fn, { list = true } = {}) {
    ctx.update(s => fn(s.ui), { silent: true });
    if (list) refresh(true);
  }

  el.addEventListener('input', e => {
    if (e.target.name === 'q') setFilter(u => { u.filters.q = e.target.value; });
  });

  el.addEventListener('change', e => {
    const t = e.target;
    const n = t.name;
    if (n === 'q') return;
    if (n === 'view') { setFilter(u => { u.view = t.value; }, { list: false }); el.querySelector('.page--explore').dataset.view = t.value; paintMap(lastList, true); return; }
    if (n === 'sort') return setFilter(u => { u.sort = t.value; });
    if (['band', 'type', 'gender', 'area'].includes(n)) return setFilter(u => { u.filters[n] = t.value; });
    if (['withinLimit', 'interestsOnly', 'sap', 'ip', 'special'].includes(n)) return setFilter(u => { u.filters[n] = t.checked; });
  });

  el.addEventListener('click', e => {
    const save = e.target.closest('[data-save]');
    if (save) { ctx.toggleShortlist(save.dataset.save); return; }
    const add = e.target.closest('[data-add]');
    if (add) {
      const key = add.dataset.add;
      if (ctx.state.plan.choices.includes(key)) ctx.removeChoice(key); else ctx.addChoice(key);
      return;
    }
    if (e.target.closest('[data-clear-filters]')) {
      setFilter(u => { u.filters = { ...u.filters, band: 'all', withinLimit: false, interestsOnly: false, type: 'all', gender: 'all', sap: false, ip: false, area: 'all', special: false, q: '' }; });
      return;
    }
    if (e.target.closest('[data-close-card]')) { el.querySelector('[data-map-card]').hidden = true; selected = null; map?.select(null); return; }
    const r = e.target.closest('.result');
    if (r && !e.target.closest('a, button, input, label')) select(r.dataset.id);
  });

  // Re-render the list, keeping focus and scroll where they were.
  function refresh(fit = false) {
    const fk = document.activeElement?.dataset?.fk;
    const caret = document.activeElement?.selectionStart;
    const detailsOpen = el.querySelector('details.more')?.open;
    const mapBox = el.querySelector('[data-map]');
    const keepMap = mapBox && (map || creating) ? mapBox : null;
    const y = window.scrollY;
    lastList = render();
    if (keepMap) el.querySelector('[data-map]').replaceWith(keepMap);
    if (detailsOpen) el.querySelector('details.more')?.setAttribute('open', '');
    if (fk) {
      const n = el.querySelector(`[data-fk="${CSS.escape(fk)}"]`);
      n?.focus({ preventScroll: true });
      if (n && caret != null && n.setSelectionRange) try { n.setSelectionRange(caret, caret); } catch { /* not a text field */ }
    }
    window.scrollTo(0, y);
    paintMap(lastList, fit);
    if (selected && !lastList.some(it => it.s.id === selected)) selected = null;
  }

  lastList = render();
  paintMap(lastList, true);
  return {
    update: () => refresh(false),
    destroy() { map?.destroy?.(); },
  };
}

