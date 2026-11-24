import { html, tf, icon, bandBadge, travelChip, schoolTags, GENDER_LABEL } from '../ui.js';
import { BAND, INTEREST_LABEL, PG_INFO, copText, interestMatches, ccaMatchesInterest, googleMapsDirUrl, formatMinutes, distanceKm, isGenderOk, isSapOk, nextSchoolMorning } from '../logic.js';
import * as maps from '../maps.js';
import * as onemap from '../onemap.js';
import { openMap, matches } from '../mapview.js';
import { footer } from './start.js';

const ARRIVE = [[7, 0], [7, 15], [7, 30], [7, 45]];
const MODE_URL = { TRANSIT: 'transit', DRIVING: 'driving', WALKING: 'walking' };
const STATUS_LABEL = {
  verified_metrics: 'Published figures',
  qualitative_only: 'Described, no figures',
  release_notice_only: 'Collection notice only',
  not_found_in_checked_official_sources: 'Not located',
  inaccessible_source: 'Source could not be read',
  not_applicable_full_cohort: 'Not a standard O-Level cohort',
};

export function mount(el, ctx, [id]) {
  const s = ctx.byId.get(id);
  if (!s) {
    el.innerHTML = String(html`<div class="page"><div class="wrap empty"><h1>School not found</h1><p><a class="link" href="#/explore">Back to all schools</a></p></div></div>`);
    return {};
  }
  const routeState = { mode: ctx.state.profile.mode_travel === 'DRIVING' ? 'DRIVING' : 'TRANSIT', arrive: 1, result: null, idx: 0, error: null, loading: false };
  let map = null;
  let creating = null;

  function render() {
    const st = ctx.student();
    const p = ctx.state.profile;
    const opts = ctx.options(s);
    const matches = interestMatches(s, st.interests);
    const saved = ctx.state.plan.shortlist.includes(s.id);
    const choices = ctx.state.plan.choices;
    const t = ctx.travelFor(s.id);
    const genderOk = isGenderOk(s, st.gender);
    const sapOk = isSapOk(s, st.chinese);

    el.innerHTML = String(html`
    <div class="page page--school">
      <div class="wrap">
        <a class="back" href="#/explore">${icon('back')}All schools</a>
        <header class="school-head">
          <div class="school-head__text">
            <p class="t-label muted">${schoolTags(s)}</p>
            <h1>${s.name}</h1>
            ${s.street ? html`<p class="school-head__addr">${icon('pin')}${s.street}, ${s.area}</p>` : ''}
            ${s.campusNotes.map(n => html`<p class="note note--inline">${icon('info')}<span>${n}</span></p>`)}
          </div>
          <div class="school-head__actions">
            ${!genderOk ? html`<p class="note note--warn">${icon('warn')}<span>This is a ${GENDER_LABEL[s.gender].toLowerCase()}’ school.</span></p>` : ''}
            ${!sapOk ? html`<p class="note note--warn">${icon('warn')}<span>This is a SAP school. It needs Chinese at PSLE, and you said you did not take it.</span></p>` : ''}
            ${s.ordinary && opts.length && genderOk && sapOk ? html`<div class="btn-row">${opts.map(o => choices.includes(o.option.key)
              ? html`<p class="in-six">${icon('check')}<span>Choice #${choices.indexOf(o.option.key) + 1} in your six${opts.length > 1 ? ` (${o.option.prog})` : ''}</span></p>
                 <button class="btn btn--secondary" type="button" data-remove="${o.option.key}">Remove${opts.length > 1 ? ` ${o.option.prog}` : ''} from my six</button>`
              : html`<button class="btn btn--primary" type="button" data-add="${o.option.key}">${icon('plus')}Add ${opts.length > 1 ? o.option.prog : 'to my six'}</button>`)}</div>` : ''}
            <div class="btn-row">
              <button class="btn btn--secondary" type="button" data-save aria-pressed="${tf(saved)}">${icon('star')}${saved ? 'Saved to shortlist' : 'Save to shortlist'}</button>
            </div>
          </div>
        </header>

        ${youAnd(s, st, opts, matches, t, choices, genderOk && sapOk)}
        <div class="school-grid">
          <div class="school-main">
            <section class="block" id="score" aria-labelledby="score-h">
              <h2 id="score-h">Your score and past cut-offs</h2>
              ${scoreBlock(s, opts, st)}
            </section>

            <section class="block" id="travel" aria-labelledby="travel-h">
              <h2 id="travel-h">Getting there</h2>
              ${travelBlock(s, p)}
            </section>

            <section class="block" id="do" aria-labelledby="do-h">
              <h2 id="do-h">What you could do here</h2>
              ${doBlock(s, st)}
            </section>

            <section class="block" id="ccas" aria-labelledby="ccas-h">
              <h2 id="ccas-h">CCAs <span class="muted">${s.ccas.length} listed</span></h2>
              ${ccaBlock(s, st)}
            </section>

            <section class="block" id="check" aria-labelledby="check-h">
              <h2 id="check-h">Check before choosing</h2>
              ${checkBlock(s, ctx)}
            </section>

            ${s.support.length ? html`<section class="block" id="support" aria-labelledby="support-h">
              <h2 id="support-h">Support</h2>
              <ul class="plain-list">${s.support.map(x => html`<li>${x}</li>`)}</ul>
              <p class="t-small muted measure">If you need support, ask about your own needs, the daily arrangements and who will help you. A listed resource does not tell you how many staff there are.</p>
            </section>` : ''}

            <section class="block" id="results" aria-labelledby="results-h">
              <h2 id="results-h">Published O-Level information</h2>
              ${resultsBlock(s, ctx)}
            </section>

            <section class="block block--sources" aria-labelledby="src-h">
              <h2 id="src-h" class="t-h3">Sources</h2>
              <ul class="plain-list">
                <li><a class="inline-link" href="${s.moeUrl}" target="_blank" rel="noopener">MOE SchoolFinder profile${icon('out')}</a></li>
                ${s.web ? html`<li><a class="inline-link" href="${s.web}" target="_blank" rel="noopener">School website${icon('out')}</a></li>` : ''}
              </ul>
              ${s.conflicts.map(c => html`<p class="t-small muted measure">${c.topic}: ${c.resolution}</p>`)}
            </section>
          </div>

          <aside class="school-aside">
            <div class="card summary m-nolift">
              <span class="t-label muted">At a glance</span>
              ${opts.map(o => html`<div class="summary__row">${opts.length > 1 ? html`<span class="opt__prog">${o.option.prog}</span>` : ''}${bandBadge(o.cmp)}</div>`)}
              ${!s.ordinary ? bandBadge({ band: 'special' }) : ''}
              ${t ? html`<div class="summary__row">${travelChip(t, p.mode_travel)}</div>` : ''}
              ${matches.length ? html`<div class="summary__row"><span class="meta-chip meta-chip--interest">${icon('heart')}${matches.length} of your interests</span></div>` : ''}
              <nav class="toc" aria-label="On this page">
                ${[['score', 'Score and cut-offs'], ['travel', 'Getting there'], ['do', 'What you could do'], ['ccas', 'CCAs'], ['check', 'Check before choosing'], ['results', 'O-Level information']].map(([a, l]) => html`<a href="#/school/${s.id}" data-jump="${a}">${l}</a>`)}
              </nav>
            </div>
          </aside>
        </div>
      </div>
      ${footer(ctx.data)}
    </div>`);
  }

  // ---------------------------------------------------------------- you and this school

  /** The student and this school in three stops, and what adding it would do to their six. */
  function youAnd(s, st, opts, matches, t, choices, eligible) {
    if (!st.al || !s.ordinary || !opts.length || !eligible) return '';
    const o = opts.find(x => x.option.prog === 'SEC') || opts[0];
    const band = o.cmp.band;
    const scoreLine = {
      ahead: `Your AL ${st.al} was better than both past cut-offs`,
      mixed: `Your AL ${st.al} was close to its past cut-offs`,
      behind: `Its past cut-offs were stricter than your AL ${st.al}`,
      none: 'No past cut-off to compare with your score',
    }[band];
    const trip = t ? (t.min != null ? `${formatMinutes(t.min)} from home` : `${t.km} km from home`) : 'Add your home to see the trip';
    const likes = matches.length ? `${matches.length} of your interests` : 'None of your interests listed';
    const inSix = choices.indexOf(o.option.key);
    const current = ctx.planChoices();
    let impact;
    if (inSix >= 0) impact = `It is choice #${inSix + 1} in your six.`;
    else if (current.length >= 6) impact = 'Your six is full. Remove one to add this school.';
    else {
      const ahead = current.filter(c => c.cmp.band === 'ahead').length;
      const dist = x => ctx.travelFor(x.school.id);
      const here = t?.min ?? t?.km;
      const nearest = here != null && current.length && current.every(c => (dist(c)?.min ?? dist(c)?.km ?? Infinity) > here);
      if (band === 'ahead' && ahead < 2) impact = `Adding it gives you ${ahead ? 'a second' : 'a first'} choice with a less stringent past cut-off.`;
      else if (nearest) impact = 'It would be the nearest school in your six.';
      else if (band === 'behind' && current.length && current.every(c => c.cmp.band === 'behind')) impact = 'Every school in your six would then be a stretch. Add a safer one too.';
      else impact = `It would be choice #${current.length + 1} in your six. You can reorder them any time.`;
    }
    return html`<section class="you-and" data-band="${band}" aria-label="You and ${s.name}">
      <ol class="you-and__stops">
        <li><span class="you-and__stn" aria-hidden="true"></span><span class="t-label">Your score</span><strong>${scoreLine}</strong></li>
        <li><span class="you-and__stn" aria-hidden="true"></span><span class="t-label">The trip</span><strong>${trip}</strong></li>
        <li><span class="you-and__stn" aria-hidden="true"></span><span class="t-label">What you enjoy</span><strong>${likes}</strong></li>
      </ol>
      <p class="you-and__impact">${icon('info')}<span>${impact}</span></p>
    </section>`;
  }

  // ---------------------------------------------------------------- score

  function scoreBlock(s, opts, st) {
    if (!s.ordinary) {
      return html`<div class="note">${icon('info')}<div><p><strong>${BAND.special.label}.</strong> ${s.admissionNote}</p>
        <p>Check the school’s website for how and when to apply. It does not count as one of your six posting choices.</p></div></div>`;
    }
    if (!st.al) return html`<p>Add your score to compare it with this school’s past cut-offs.</p><a class="btn btn--primary" href="#/setup/1">Start with my score</a>`;
    if (!opts.length) return html`<p>This school had no ${st.pg ? PG_INFO[st.pg].name : ''} intake in 2024 or 2025 through ordinary posting.</p>${allCutoffs(s)}`;
    return html`${opts.map(o => scale(o, st))}
      <p class="t-small muted measure">A cut-off is the score of the last student posted in that year. Cut-offs move every year with who applies. They are not a chance of getting in.</p>
      ${allCutoffs(s)}`;
  }

  function scale(o, st) {
    const pos = al => `${((al - 4) / 26) * 100}%`;
    const years = [2024, 2025];
    return html`<div class="scale-block">
      <div class="scale-block__head">
        <h3 class="t-card">${o.option.prog === 'IP' ? 'Integrated Programme (IP)' : `${PG_INFO[st.pg].name} (${PG_INFO[st.pg].level})`}</h3>
        ${bandBadge(o.cmp)}
      </div>
      <div class="scale" role="img" aria-label="${scaleLabel(o, st)}">
        <div class="scale__axis"><span>AL 4 · better</span><span>AL 30</span></div>
        ${years.map(y => {
          const r = o.cmp.years[y].rec;
          if (!r) return html`<div class="scale__row"><span class="scale__y mono">${y}</span><div class="scale__track"><span class="scale__none t-small muted">No cut-off</span></div></div>`;
          const ok = r && Number.isInteger(r.cop);
          const from = ok && Number.isInteger(r.first) ? r.first : ok ? r.cop : null;
          return html`<div class="scale__row">
            <span class="scale__y mono">${y}</span>
            <div class="scale__track">
              ${ok ? html`<span class="scale__bar ${r.status === 'vacancy_convention' ? 'is-open' : ''}" style="left:${pos(from)};width:calc(${pos(r.cop)} - ${pos(from)} + 10px)"></span>
                <span class="scale__cop mono" style="left:${pos(r.cop)}">${copText(r)}</span>` : html`<span class="scale__none t-small muted">No cut-off</span>`}
            </div>
          </div>`;
        })}
        <div class="scale__you" style="--x:${(Math.min(Math.max(st.al, 4), 30) - 4) / 26}"><span class="mono">You ${st.al}</span></div>
      </div>
      <ul class="year-notes">${years.map(y => html`<li><strong class="mono">${y}</strong> ${yearText(o.cmp.years[y], st, y === years.find(z => o.cmp.years[z].result === 'tie'))}</li>`)}</ul>
      ${o.cmp.buffer != null ? html`<p class="t-small">${marginText(o.cmp.buffer)}</p>` : ''}
      ${o.cmp.affiliated ? html`<p class="note note--inline">${icon('info')}<span>You are compared with the cut-off for affiliated students. It applies only if this school is your first choice.</span></p>` : ''}
    </div>`;
  }

  function marginText(b) {
    if (b > 0) return `Your score was ${b} better than the stricter of the two cut-offs.`;
    if (b === 0) return 'Your score was the same as the stricter of the two cut-offs.';
    return `The stricter cut-off was ${-b} better than your score.`;
  }

  function scaleLabel(o, st) {
    const parts = [2024, 2025].map(y => `${y} cut-off ${copText(o.cmp.years[y].rec)}`);
    return `Your score AL ${st.al}. ${parts.join('. ')}. ${BAND[o.cmp.band].label}.`;
  }

  function yearText(y, st, explainTie = true) {
    const r = y.rec;
    switch (y.result) {
      case 'better': return y.hclDecided ? `Your score equals the cut-off (${copText(r)}), and your Higher Chinese grade comes first.` : `Cut-off ${copText(r)}. Your ${st.al} was ${r.cop - st.al} better.`;
      case 'tie': return `Cut-off ${copText(r)}, the same as your score.${explainTie ? ` In a tie, Singapore citizens come first, then students who put this school higher in their list, then a computer ballot. So where you put it in your six matters.${y.hclUnknown ? ' Your Higher Chinese grade could decide it: add it in your details.' : ''}` : ''}`;
      case 'worse': return y.hclDecided ? `Your score equals the cut-off (${copText(r)}), but students with a better Higher Chinese grade came first.` : `Cut-off ${copText(r)}, ${st.al - r.cop} stricter than your score.`;
      case 'open': return `Places were left after posting (${copText(r)}), so students who chose it in this group were posted.`;
      case 'none_posted': return 'No students were posted in this group that year.';
      default: return 'No cut-off was published for this route that year.';
    }
  }

  function allCutoffs(s) {
    if (!s.cutoffs.length) return '';
    const rows = [...s.cutoffs].sort((a, b) => a.route.localeCompare(b.route) || a.y - b.y || Number(a.aff) - Number(b.aff));
    return html`<details class="disclosure">
      <summary>Every published cut-off for this school</summary>
      <div class="table-wrap"><table class="table">
        <thead><tr><th scope="col">Year</th><th scope="col">Route</th><th scope="col">Students</th><th scope="col">Range</th><th scope="col">Cut-off</th></tr></thead>
        <tbody>${rows.map(r => html`<tr><td class="mono">${r.y}</td><td>${r.route}</td><td>${r.aff ? 'Affiliated' : 'Everyone'}</td><td class="mono">${r.raw || '—'}</td><td class="mono">${copText(r)}</td></tr>`)}</tbody>
      </table></div>
      <p class="t-small muted">* Places were left after posting. (D), (M) and (P) are Higher Chinese grades used at SAP schools for ties at AL 14 or better.</p>
    </details>`;
  }

  // ---------------------------------------------------------------- travel

  /** Who plans the route: Google with a Google map, OneMap with the open map, or nobody (straight line). */
  function router() {
    const g = maps.mapsStatus();
    if (g !== 'none' && g !== 'failed') return 'google';
    return onemap.routingAvailable() ? 'onemap' : null;
  }

  function travelBlock(s, p) {
    const moves = s.constraints.filter(c => /campus|move/.test(c.kind));
    const mapsOn = Boolean(router());
    const url = googleMapsDirUrl(p.home, s, MODE_URL[routeState.mode]);
    const head = html`${moves.map(c => html`<p class="note note--warn">${icon('warn')}<span><strong>Campus change.</strong> ${c.fact} ${c.means}</span></p>`)}`;
    if (!p.home) {
      return html`${head}<div class="route">
        <div class="route__map" data-route-map></div>
        <div class="route__panel"><p>Add your home to see how long the trip takes and which buses and trains to take.</p>
        <div class="btn-row"><a class="btn btn--primary" href="#/setup/4">Add my home</a><a class="btn btn--secondary" href="${url}" target="_blank" rel="noopener">Open in Google Maps${icon('out')}</a></div></div>
      </div>`;
    }
    const km = distanceKm(p.home, s).toFixed(1);
    const r = routeState.result?.routes?.[routeState.idx];
    return html`${head}<div class="route">
      <div class="route__map" data-route-map></div>
      <div class="route__panel">
        ${mapsOn ? html`<div class="route__controls">
          <fieldset class="seg seg--sm">
            <legend class="sr-only">Travel by</legend>
            ${Object.entries(maps.MODES).map(([k, m]) => html`<label><input type="radio" name="rmode" value="${k}" ${routeState.mode === k ? 'checked' : ''}><span>${icon(k === 'TRANSIT' ? 'bus' : k === 'DRIVING' ? 'car' : 'walk')}${m.label}</span></label>`)}
          </fieldset>
          <div class="field field--inline"><label for="arrive">Arrive by</label>
            <select id="arrive" name="arrive">${ARRIVE.map(([h, m], i) => html`<option value="${i}" ${routeState.arrive === i ? 'selected' : ''}>${h}:${String(m).padStart(2, '0')} am</option>`)}</select></div>
        </div>` : ''}
        ${!mapsOn
          ? html`<p class="route__big"><span class="mono">${km} km</span> <span class="muted">in a straight line from ${p.home.label}</span></p>
                 <p class="t-small muted measure">The dashed line shows how far it is in a straight line. Google Maps shows which buses and trains to take, and how long the trip is.</p>`
          : routeState.loading ? html`<p class="t-small muted" role="status">Planning the route…</p>`
          : routeState.error ? html`<p class="note note--warn">${icon('warn')}<span>${routeState.error}</span></p>`
          : r ? routeView(r) : ''}
        ${router() === 'onemap' && r ? html`<p class="t-small muted">Route from <a class="inline-link" href="https://www.onemap.gov.sg" target="_blank" rel="noopener">OneMap</a>, Singapore Land Authority.</p>` : ''}
        <a class="btn ${mapsOn ? 'btn--secondary' : 'btn--primary'}" href="${url}" target="_blank" rel="noopener">${mapsOn ? 'Open in Google Maps' : 'See the way there in Google Maps'}${icon('out')}</a>
      </div>
    </div>`;
  }

  function routeView(r) {
    const all = routeState.result.routes;
    return html`
      ${all.length > 1 ? html`<div class="route__alts" role="group" aria-label="Other routes">${all.map((x, i) => html`<button type="button" class="alt ${i === routeState.idx ? 'is-on' : ''}" aria-pressed="${tf(i === routeState.idx)}" data-alt="${i}"><span class="mono">${formatMinutes(x.minutes)}</span><span class="t-small muted">${x.steps.filter(st => st.kind === 'bus' || st.kind === 'train').map(st => st.line).join(' › ') || x.summary || 'Route'}</span></button>`)}</div>` : ''}
      <p class="route__big"><span class="mono">${formatMinutes(r.minutes)}</span>${r.depart ? html` <span class="muted">leave ${r.depart}, arrive ${r.arrive}</span>` : html` <span class="muted">${r.distanceKm} km</span>`}</p>
      <ol class="steps-list">${r.steps.map(st => html`<li class="leg leg--${st.kind}">
        ${st.kind === 'bus' || st.kind === 'train'
          ? html`<span class="leg__icon">${icon(st.kind)}</span><span class="leg__body"><span><span class="line-pill" style="${st.colour ? `background:${st.colour};color:${st.textColour || '#fff'}` : ''}">${st.line}</span> <strong>${st.from}</strong> to <strong>${st.to}</strong></span><span class="t-small muted">${st.stops != null ? `${st.stops} stop${st.stops === 1 ? '' : 's'} · ` : ''}${formatMinutes(st.minutes)}${st.headsign ? ` · towards ${st.headsign}` : ''}</span></span>`
          : html`<span class="leg__icon">${icon(st.kind === 'walk' ? 'walk' : 'car')}</span><span class="leg__body">${st.text}<span class="t-small muted">${formatMinutes(st.minutes)} · ${st.km} km</span></span>`}
      </li>`)}</ol>
      <p class="t-small muted">Times are for the next school day. Check again closer to the first day of school.</p>`;
  }

  async function planRoute() {
    const p = ctx.state.profile;
    const by = router();
    if (!p.home || !by) { paintRouteMap(); return; }
    routeState.loading = true;
    routeState.error = null;
    repaintTravel();
    try {
      const [hh, mm] = ARRIVE[routeState.arrive];
      routeState.result = by === 'google'
        ? await maps.route(p.home, s, routeState.mode, { hh, mm })
        : await onemap.route(p.home, s, routeState.mode, nextSchoolMorning(new Date(), hh, mm));
      routeState.idx = 0;
      if (!routeState.result.routes.length) routeState.error = `${by === 'google' ? 'Google Maps' : 'OneMap'} found no route. Open it in Google Maps to try other options.`;
    } catch (e) {
      console.warn(e);
      routeState.result = null;
      routeState.error = e.message === 'onemap-auth'
        ? 'OneMap refused the token. Add a new one in map settings, or open the route in Google Maps.'
        : 'The route could not be planned here. Open it in Google Maps instead.';
    }
    routeState.loading = false;
    repaintTravel();
  }

  function repaintTravel() {
    const block = el.querySelector('#travel');
    if (!block) return;
    const box = block.querySelector('[data-route-map]');
    const panel = document.createElement('div');
    panel.innerHTML = String(html`<h2 id="travel-h">Getting there</h2>${travelBlock(s, ctx.state.profile)}`);
    if (box && map) panel.querySelector('[data-route-map]').replaceWith(box);
    block.replaceChildren(...panel.childNodes);
    paintRouteMap();
  }

  async function paintRouteMap() {
    const box = el.querySelector('[data-route-map]');
    if (!box) return;
    const home = ctx.state.profile.home;
    if (creating) { await creating; return paintRouteMap(); }
    if (!matches(map) || !box.childElementCount) {
      map?.destroy?.();
      map = null;
      creating = openMap(box, {}).then(m => { map = m; }).finally(() => { creating = null; });
      await creating;
    }
    if (!map || !box.isConnected) return;
    map.setHome(home);
    map.setSchools([{ id: s.id, name: s.name, lat: s.lat, lng: s.lng, band: 'school' }]);
    map.select(s.id);
    const r = routeState.result;
    const chosen = r?.routes?.[routeState.idx];
    if (map.kind === 'google' && r?.raw) map.showRoute(r.raw, routeState.idx);
    else if (map.kind === 'maplibre' && chosen?.paths?.length) {
      map.clearRoute();
      map.showPaths(chosen.paths, [home, { lat: s.lat, lng: s.lng }]);
    } else {
      map.clearRoute();
      if (home) map.showLine(home, s);
      map.fit(home ? [home, { lat: s.lat, lng: s.lng }] : [{ lat: s.lat, lng: s.lng }]);
    }
  }

  // ---------------------------------------------------------------- opportunities

  function doBlock(s, st) {
    const matches = interestMatches(s, st.interests);
    return html`
      ${matches.length ? html`<p class="match-line">${icon('heart')}Matches what you enjoy: ${matches.map(m => INTEREST_LABEL[m]).join(', ')}</p>` : ''}
      ${s.strengths.length ? html`<div class="opp-grid">${s.strengths.map(x => html`<article class="card opp m-nolift">
        <span class="t-label muted">${oppLabel(x.fact)}</span>
        <h3>${x.name}</h3>
        <p>${x.value}</p>
      </article>`)}</div>` : html`<p class="muted">No programme is listed for this school.</p>`}
      ${s.extraProgrammes.length ? html`<h3 class="t-card sub">Also on the school’s pages</h3><ul class="plain-list">${s.extraProgrammes.map(x => html`<li><strong>${x.name}.</strong> ${x.value || ''}</li>`)}</ul>` : ''}
      ${s.electives.length ? html`<h3 class="t-card sub">Specialist electives</h3><ul class="plain-list">${s.electives.map(x => html`<li>${x}</li>`)}</ul><p class="t-small muted">Entry conditions apply.</p>` : ''}
      ${s.dsa.length ? html`<h3 class="t-card sub">Talent areas for Direct School Admission</h3><div class="tag-row">${s.dsa.map(x => html`<span class="tag">${x.n}</span>`)}</div><p class="t-small muted measure">These are what the school recruits for through DSA, which closed earlier in the year. They show what the school puts effort into, not a place for you.</p>` : ''}
      <p class="t-small muted measure">“You might enjoy this if…” lines explain a listed programme in plain words. They are not a promise of a place or of what lessons are like.</p>`;
  }

  function ccaBlock(s, st) {
    if (!s.ccas.length) return html`<p class="muted">No CCA list was published for this school.</p>`;
    const groups = {};
    for (const c of s.ccas) (groups[c.c] ||= []).push(c);
    const g = c => (c.g === 'boys' ? ' (boys)' : c.g === 'girls' ? ' (girls)' : '');
    return html`<div class="cca-groups">${Object.entries(groups).map(([cat, list]) => {
      const sorted = [...list].sort((a, b) => Number(ccaMatchesInterest(b, st.interests)) - Number(ccaMatchesInterest(a, st.interests)));
      return html`<div class="cca-group"><h3 class="t-label muted">${cat}</h3><div class="tag-row">${sorted.map(c => {
        const hit = ccaMatchesInterest(c, st.interests);
        return html`<span class="tag ${hit ? 'tag--hit' : ''}">${hit ? icon('heart') : ''}${c.n}${g(c)}</span>`;
      })}</div></div>`;
    })}</div>
    <p class="t-small muted measure">From MOE’s directory. Ask about trials, places and training days before you count on one.</p>`;
  }

  function checkBlock(s, ctx) {
    const checked = ctx.state.plan.checked[s.id] || [];
    const note = ctx.state.plan.notes[s.id] || '';
    return html`
      ${s.constraints.length ? html`<ul class="facts">${s.constraints.map(c => html`<li>
        <span class="tag tag--doc">Documented</span>
        <p><strong>${c.fact}</strong> ${c.means} <a class="inline-link" href="${c.url}" target="_blank" rel="noopener">Source${icon('out')}</a></p>
      </li>`)}</ul>` : ''}
      <h3 class="t-card sub">Questions to ask at the open house</h3>
      <ul class="ask">${s.questions.map((q, i) => html`<li><label class="check"><input type="checkbox" data-ask="${i}" ${checked.includes(i) ? 'checked' : ''}><span>${q.text}</span></label></li>`)}</ul>
      <div class="field">
        <label for="note">Your notes about this school</label>
        <textarea id="note" data-note rows="4" placeholder="What you liked, answers you got, how the trip felt">${note}</textarea>
        <span class="t-small muted">Saved in this browser as you type.</span>
      </div>`;
  }

  function resultsBlock(s, ctx) {
    const defs = ctx.data.olevelStatusDefinitions;
    return html`
      <p class="measure">These are what the school or SEAB published about past O-Level cohorts. From 2027 the SEC replaces the O-Level, so these describe older students, not your future results.</p>
      <div class="years">${s.olevel.map(y => html`<div class="year">
        <div class="year__head"><strong class="mono">${y.year} exam</strong><span class="tag tag--status-${y.status}">${STATUS_LABEL[y.status] || y.status}</span></div>
        <p class="t-small">${defs[y.status] || ''}</p>
        ${y.metrics.length ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">Published measure</th><th scope="col">Cohort</th><th scope="col">Value</th></tr></thead>
          <tbody>${y.metrics.map(m => html`<tr><td>${m.label} <a class="inline-link" href="${m.url}" target="_blank" rel="noopener" aria-label="Source for ${m.label}">${icon('out')}</a></td><td>${m.cohort}</td><td class="mono">${opText(m.op)}${m.value}${m.unit === 'percent' ? '%' : ''}</td></tr>`)}</tbody>
        </table></div>` : ''}
      </div>`)}</div>
      ${s.olevelNote ? html`<p class="t-small muted measure">${s.olevelNote}</p>` : ''}
      <p class="t-small muted measure">Each figure keeps its own cohort and definition: do not compare schools by them. A gap is not a poor result, and a high figure does not show what the school adds.</p>`;
  }

  function oppLabel(fact) {
    const m = fact.match(/^MOE lists this (ALP|LLP) in (.+?)\.?$/);
    if (!m) return 'From the school’s SchoolFinder page';
    return `${m[1] === 'ALP' ? 'Applied Learning Programme' : 'Learning for Life Programme'} · ${m[2]}`;
  }

  const opText = op => (op === '>' ? 'more than ' : op === '>=' ? 'at least ' : op === 'approximately' ? 'about ' : '');

  // ---------------------------------------------------------------- events

  el.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) { ctx.addChoice(add.dataset.add); return; }
    const rem = e.target.closest('[data-remove]');
    if (rem) { ctx.removeChoice(rem.dataset.remove); return; }
    if (e.target.closest('[data-save]')) { ctx.toggleShortlist(s.id); return; }
    const alt = e.target.closest('[data-alt]');
    if (alt) { routeState.idx = Number(alt.dataset.alt); repaintTravel(); return; }
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      e.preventDefault();
      const target = el.querySelector(`#${jump.dataset.jump}`);
      target?.scrollIntoView({ block: 'start' });
      target?.querySelector('h2')?.setAttribute('tabindex', '-1');
      target?.querySelector('h2')?.focus({ preventScroll: true });
    }
  });

  el.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'rmode') { routeState.mode = t.value; planRoute(); }
    if (t.name === 'arrive') { routeState.arrive = Number(t.value); planRoute(); }
    if (t.dataset.ask != null) {
      const i = Number(t.dataset.ask);
      ctx.update(st => {
        const list = new Set(st.plan.checked[s.id] || []);
        t.checked ? list.add(i) : list.delete(i);
        st.plan.checked[s.id] = [...list];
      }, { silent: true });
    }
  });

  let noteTimer;
  el.addEventListener('input', e => {
    if (!e.target.matches('[data-note]')) return;
    clearTimeout(noteTimer);
    const v = e.target.value;
    noteTimer = setTimeout(() => ctx.update(st => { st.plan.notes[s.id] = v; }, { silent: true }), 300);
  });

  function full() {
    const box = el.querySelector('[data-route-map]');
    const y = window.scrollY;
    const fk = document.activeElement?.dataset;
    render();
    if (box && map) el.querySelector('[data-route-map]').replaceWith(box);
    window.scrollTo(0, y);
    if (fk?.add || fk?.remove) el.querySelector('[data-add], [data-remove]')?.focus({ preventScroll: true });
    else if (fk && 'save' in fk) el.querySelector('[data-save]')?.focus({ preventScroll: true });
    paintRouteMap();
  }

  const sig = () => JSON.stringify([ctx.state.plan.choices, ctx.state.plan.shortlist, ctx.travelFor(s.id), ctx.state.profile.home, ctx.student().pg]);
  let last = sig();
  render();
  paintRouteMap();
  planRoute();
  return {
    update() { const now = sig(); if (now !== last) { last = now; full(); } },
    destroy() { map?.destroy?.(); clearTimeout(noteTimer); },
  };
}
