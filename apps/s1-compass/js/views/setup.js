import { html, tf, icon, arrow } from '../ui.js';
import { INTERESTS, PG_INFO, totalAL, HCL_PRIORITY_MAX_AL } from '../logic.js';
import { plotSvg } from '../plot.js';
import * as maps from '../maps.js';
import { openMap } from '../mapview.js';

const STEPS = ['Your score', 'About you', 'Posting group', 'Your home', 'What you enjoy'];
const SUBJECTS = [['el', 'English'], ['math', 'Mathematics'], ['sci', 'Science'], ['mt', 'Mother Tongue']];
const LIMITS = [30, 45, 60, 75, 0];
const HCL = [['D', 'Distinction'], ['M', 'Merit'], ['P', 'Pass'], ['none', 'Did not take it or did not pass'], ['unknown', 'Not sure']];

export function mount(el, ctx, [n]) {
  const step = Math.min(Math.max(Number(n) || 1, 1), 5);
  let map = null;
  let searchTimer = null;
  let results = [];
  let active = -1;

  function render() {
    const p = ctx.state.profile;
    const st = ctx.student();
    el.innerHTML = String(html`
    <div class="page page--setup">
      <div class="wrap setup">
        <div class="setup__progress">
          <p class="t-label muted">Step ${step} of ${STEPS.length} · ${STEPS[step - 1]}</p>
          <ol class="progress" aria-hidden="true">${STEPS.map((_, i) => html`<li class="${i < step ? 'is-done' : ''}"></li>`)}</ol>
        </div>
        <form class="setup__form" novalidate>
          ${[stepScore, stepAbout, stepGroup, stepHome, stepInterests][step - 1](p, st, ctx)}
          <div class="setup__actions">
            <a class="btn btn--secondary" href="${step === 1 ? '#/' : `#/setup/${step - 1}`}">Back</a>
            ${step === 4 && !p.home ? html`<a class="btn btn--secondary" href="#/setup/5">Skip for now</a>` : ''}
            <button class="btn btn--primary" type="submit">${step === 5 ? 'See my schools' : 'Continue'}${arrow}</button>
          </div>
        </form>
      </div>
    </div>`);
    if (step === 4) mountHomeMap(p.home);
  }

  async function mountHomeMap(home) {
    const box = el.querySelector('[data-home-map]');
    if (!box || !home) return;
    map?.destroy?.();
    map = await openMap(box, { interactive: false });
    if (!box.isConnected) return;
    if (map.kind === 'plot') {
      map = null;
      box.innerHTML = plotSvg([], home, `Your home, ${home.label}, on a map of Singapore`);
      return;
    }
    map.setHome(home);
    map.fit([home]);
  }

  // ---------------------------------------------------------------- events

  el.addEventListener('change', e => {
    const t = e.target;
    const p = ctx.state.profile;
    ctx.update(s => {
      const q = s.profile;
      if (t.name === 'mode') q.mode = t.value;
      else if (t.name.startsWith('sub-')) q.subjects[t.name.slice(4)] = Number(t.value);
      else if (t.name === 'total') q.total = t.value === '' ? null : Number(t.value);
      else if (t.name === 'pg') q.pg = Number(t.value);
      else if (t.name === 'gender') q.gender = t.value || null;
      else if (t.name === 'primary') q.primaryId = t.value || null;
      else if (t.name === 'chinese') q.chinese = t.value;
      else if (t.name === 'hcl') q.hcl = t.value;
      else if (t.name === 'limit') q.maxMinutes = Number(t.value);
      else if (t.name === 'travelmode') q.mode_travel = t.value;
      else if (t.name === 'interest') q.interests = [...el.querySelectorAll('input[name="interest"]:checked')].map(i => i.value);
    }, { silent: true });
    if (['mode', 'chinese', 'total'].includes(t.name) || t.name.startsWith('sub-')) {
      const focusName = t.name, focusValue = t.value;
      render();
      el.querySelector(`[name="${focusName}"][value="${CSS.escape(focusValue)}"], [name="${focusName}"]:not([type="radio"])`)?.focus({ preventScroll: true });
      if (t.name.startsWith('sub-') && ctx.student().al) el.querySelector('.score-card')?.scrollIntoView({ block: 'nearest' });
    }
    if (t.name === 'travelmode' && p.home) ctx.refreshTravel();
  });

  el.addEventListener('input', e => {
    if (e.target.name !== 'home-q') return;
    clearTimeout(searchTimer);
    const q = e.target.value;
    searchTimer = setTimeout(() => search(q), 250);
  });

  el.addEventListener('keydown', e => {
    if (e.target.name !== 'home-q') return;
    const list = el.querySelector('#home-results');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      paintResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length) choose(results[Math.max(active, 0)]);
    } else if (e.key === 'Escape' && list) {
      results = [];
      paintResults();
    }
  });

  el.addEventListener('click', async e => {
    const opt = e.target.closest('[data-result]');
    if (opt) { choose(results[Number(opt.dataset.result)]); return; }
    if (e.target.closest('[data-locate]')) {
      const status = el.querySelector('[data-home-status]');
      status.textContent = 'Finding where you are…';
      try {
        setHome(await maps.currentPosition());
      } catch {
        status.textContent = 'Your location is not available. Search for your address instead.';
      }
    }
    if (e.target.closest('[data-clear-home]')) setHome(null);
  });

  el.addEventListener('submit', e => {
    e.preventDefault();
    const err = validate();
    if (err) {
      const box = el.querySelector('[data-step-error]');
      box.textContent = err;
      box.hidden = false;
      box.focus();
      return;
    }
    if (step === 5) {
      ctx.update(s => { s.profile.done = true; });
      location.hash = '#/explore';
    } else {
      ctx.update(() => {});
      location.hash = `#/setup/${step + 1}`;
    }
  });

  function validate() {
    const st = ctx.student();
    const p = ctx.state.profile;
    if (step === 1) {
      if (p.mode === 'subjects' && totalAL(p.subjects) == null) {
        const missing = SUBJECTS.filter(([k]) => !p.subjects[k]);
        for (const [k] of missing) {
          const row = el.querySelector(`input[name="sub-${k}"]`)?.closest('.al-row');
          row?.classList.add('is-missing');
          row?.setAttribute('aria-invalid', 'true');
        }
        const names = missing.map(([, l]) => l);
        return `Pick a result for ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]}.`;
      }
      if (p.mode === 'total' && !st.groups.valid) return 'Write a total between 4 and 30.';
    }
    if (step === 3 && st.groups.choose && !st.pg) return 'Choose one posting group for all your choices.';
    if (step === 2 && p.chinese == null) return 'Say whether you took Chinese at PSLE. SAP schools need it.';
    return null;
  }

  async function search(q) {
    const status = el.querySelector('[data-home-status]');
    if (q.trim().length < 2) { results = []; paintResults(); return; }
    status.textContent = 'Searching…';
    try {
      results = await maps.searchPlaces(q);
      status.textContent = results.length ? `${results.length} places found` : 'No place found. Try your postal code.';
    } catch (e) {
      console.warn(e);
      results = [];
      status.textContent = 'Search is not available right now. Try again, or use your current location.';
    }
    active = -1;
    paintResults();
  }

  function paintResults() {
    const list = el.querySelector('#home-results');
    const input = el.querySelector('[name="home-q"]');
    if (!list) return;
    list.innerHTML = String(html`${results.map((r, i) => html`
      <li id="home-opt-${i}" role="option" class="combo__opt ${i === active ? 'is-active' : ''}" aria-selected="${tf(i === active)}" data-result="${i}">
        ${icon('pin')}<span><strong>${r.main}</strong><span class="t-small muted">${r.secondary}</span></span>
      </li>`)}`);
    list.hidden = !results.length;
    input.setAttribute('aria-expanded', String(results.length > 0));
    if (active >= 0) input.setAttribute('aria-activedescendant', `home-opt-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }

  async function choose(r) {
    if (!r) return;
    const status = el.querySelector('[data-home-status]');
    status.textContent = 'Getting the location…';
    try {
      setHome(await r.resolve());
    } catch (e) {
      console.warn(e);
      status.textContent = 'That place could not be found on the map. Pick another.';
    }
  }

  function setHome(home) {
    results = [];
    ctx.update(s => { s.profile.home = home; }, { silent: true });
    ctx.refreshTravel();
    render();
    el.querySelector(home ? '[data-home-card]' : '[name="home-q"]')?.focus();
  }

  render();
  return { destroy() { map?.destroy(); clearTimeout(searchTimer); } };
}

// ------------------------------------------------------------------ the steps

const stepError = html`<p class="form-error" data-step-error role="alert" tabindex="-1" hidden></p>`;

function stepScore(p, st) {
  const groups = st.groups;
  return html`
    <h1>What did you get for PSLE?</h1>
    <p class="t-lead measure">Use the Achievement Level (AL) for each subject on your result slip. AL 1 is the best, AL 8 the lowest.</p>
    <fieldset class="seg" role="radiogroup">
      <legend class="sr-only">How to enter your score</legend>
      <label><input type="radio" name="mode" value="subjects" ${p.mode === 'subjects' ? 'checked' : ''}><span>Each subject</span></label>
      <label><input type="radio" name="mode" value="total" ${p.mode === 'total' ? 'checked' : ''}><span>Just my total</span></label>
    </fieldset>
    ${p.mode === 'subjects'
      ? html`<div class="subjects">${SUBJECTS.map(([k, label]) => html`
        <fieldset class="al-row">
          <legend>${label}</legend>
          <div class="al-row__opts">${[1, 2, 3, 4, 5, 6, 7, 8].map(v => html`
            <label class="al-opt"><input type="radio" name="sub-${k}" value="${v}" ${p.subjects[k] === v ? 'checked' : ''}><span class="mono">${v}</span><span class="sr-only"> for ${label}</span></label>`)}
          </div>
        </fieldset>`)}
        <p class="t-small muted">Took a subject at Foundation level? Grade A counts as AL 6, B as AL 7 and C as AL 8.</p>
        </div>`
      : html`<div class="field field--narrow">
          <label for="total">Your PSLE score (4 to 30)</label>
          <input id="total" name="total" type="number" inputmode="numeric" min="4" max="30" value="${p.total ?? ''}">
        </div>`}
    <div class="score-card" aria-live="polite">
      <span class="t-label muted">Your PSLE score</span>
      <span class="score-card__n mono">${st.al ?? '–'}</span>
      <span class="score-card__g">${groups.valid
        ? groups.groups.length ? `Posting Group ${groups.groups.join(' or ')}` : 'See the next step'
        : 'Pick all four subjects'}</span>
    </div>
    ${stepError}`;
}

/** What a group leads to, in words a 12-year-old can weigh. */
function groupFacts(n, st, pv) {
  const c = pv[n];
  if (!c) return '';
  return html`<span class="group-facts">
    <span class="group-facts__big"><strong class="mono">${c.ahead}</strong> ${c.ahead === 1 ? 'school' : 'schools'} had cut-offs less stringent than AL ${st.al} in both 2024 and 2025</span>
    <span class="t-small muted">${c.mixed} close, ${c.behind} stricter${c.none ? `, ${c.none} with no cut-off to compare` : ''}</span>
  </span>`;
}

const ipLine = (n, pv) => (n === 3 && pv[3]?.ipReachable ? html`<span>You can also choose the Integrated Programme (IP), six years to the A-Level or IB.</span>` : '');

function stepGroup(p, st, ctx) {
  const g = st.groups;
  const pv = g.valid && g.groups.length ? ctx.preview() : {};
  const header = html`<h1>Your posting group</h1>
    <p class="t-lead measure">Your score sets the group you are posted in. The group decides the level you start most subjects at, and which past cut-offs you are compared with.</p>`;
  if (!g.valid) return html`${header}<div class="note note--warn">${icon('warn')}<p>Go back and enter your score first.</p></div>${stepError}`;
  if (!g.groups.length) {
    return html`${header}
      <div class="note note--warn">${icon('warn')}<div><p><strong>With AL ${st.al}, Posting Group 1 needs AL 7 or better in both English and Mathematics.</strong></p>
      <p>Your primary school will talk you through the options, which can include NorthLight School, Assumption Pathway School or repeating Primary 6. You can still browse every school.</p></div></div>${stepError}`;
  }
  if (g.choose) {
    return html`${header}
      <p class="measure">With AL ${st.al} you can choose. <strong>One group applies to all six choices.</strong></p>
      <fieldset class="choice-cards">
        <legend class="sr-only">Choose your posting group</legend>
        ${g.groups.map(n => html`<label class="choice-card">
          <input type="radio" name="pg" value="${n}" ${st.pg === n ? 'checked' : ''}>
          <span class="choice-card__title">${PG_INFO[n].name}</span>
          <span>${PG_INFO[n].text}</span>
          ${ipLine(n, pv)}
          ${groupFacts(n, st, pv)}
        </label>`)}
      </fieldset>
      <p class="t-small muted measure">MOE suggests listing two or three schools whose past cut-offs were less stringent than your score, so a group with more of them gives you safer choices. Talk it over with a parent or your teacher.</p>
      ${stepError}`;
  }
  const n = g.groups[0];
  return html`${header}
    <div class="choice-card is-static"><span class="choice-card__title">${PG_INFO[n].name}</span><span>${PG_INFO[n].text}</span>${ipLine(n, pv)}${groupFacts(n, st, pv)}</div>
    ${g.condition === 'unknown' ? html`<div class="note">${icon('info')}<p>Posting Group 1 at AL 26 to 30 needs AL 7 or better in both English and Mathematics. Enter each subject in step 1 to check.</p></div>` : ''}
    ${stepError}`;
}

function stepAbout(p, st, ctx) {
  return html`
    <h1>A little about you</h1>
    <p class="t-lead measure">These change which schools you can choose and which cut-off applies to you.</p>
    <fieldset class="field-group">
      <legend>Are you a boy or a girl?</legend>
      <p class="t-small muted">Some schools take only boys or only girls.</p>
      <div class="chips">
        ${[['boy', 'Boy'], ['girl', 'Girl'], ['', 'Show me all schools']].map(([v, l]) => html`
          <label class="chip"><input type="radio" name="gender" value="${v}" ${(p.gender || '') === v ? 'checked' : ''}><span>${l}</span></label>`)}
      </div>
    </fieldset>
    <div class="field">
      <label for="primary">Your primary school</label>
      <select id="primary" name="primary">
        <option value="">My school is not listed here</option>
        ${ctx.data.primarySchools.map(s => html`<option value="${s.id}" ${p.primaryId === s.id ? 'selected' : ''}>${s.name}</option>`)}
      </select>
      <span class="t-small muted">Only primary schools with an affiliated secondary school are listed. Affiliation gives priority when that school is your first choice.</span>
    </div>
    <fieldset class="field-group">
      <legend>Did you take Chinese at PSLE?</legend>
      <p class="t-small muted">SAP schools, which teach Chinese at a high level, need it.</p>
      <div class="chips">
        ${[['yes', 'Yes'], ['no', 'No']].map(([v, l]) => html`
          <label class="chip"><input type="radio" name="chinese" value="${v}" ${p.chinese === v ? 'checked' : ''}><span>${l}</span></label>`)}
      </div>
    </fieldset>
    ${p.chinese === 'yes' && (st.al == null || st.al <= HCL_PRIORITY_MAX_AL) ? html`
    <fieldset class="field-group">
      <legend>Your Higher Chinese result</legend>
      <p class="t-small muted">At SAP schools, a Higher Chinese grade can decide between students with the same score of 14 or better.</p>
      <div class="chips">
        ${HCL.map(([v, l]) => html`<label class="chip"><input type="radio" name="hcl" value="${v}" ${p.hcl === v ? 'checked' : ''}><span>${l}</span></label>`)}
      </div>
    </fieldset>` : ''}
    ${stepError}`;
}

function stepHome(p, st, ctx) {
  const status = maps.mapsStatus();
  const routes = ctx.canRoute();
  return html`
    <h1>Where do you live?</h1>
    <p class="t-lead measure">You will make this trip every school day. ${routes
      ? 'We use it to work out travel times and to plan the route.'
      : 'We use it to show how far each school is, and to open the route in Google Maps.'}</p>
    ${p.home
      ? html`<div class="home-card" data-home-card tabindex="-1">
          <div class="home-card__map" data-home-map></div>
          <div class="home-card__text">
            <span class="t-label muted">Home</span>
            <strong>${p.home.label}</strong>
            ${p.home.address && p.home.address !== p.home.label ? html`<span class="t-small muted">${p.home.address}</span>` : ''}
            <button class="btn btn--secondary btn--sm" type="button" data-clear-home>Change home</button>
          </div>
        </div>`
      : html`<div class="field combo">
          <label for="home-q">Address, building or postal code</label>
          <div class="combo__box">
            ${icon('search')}
            <input id="home-q" name="home-q" type="text" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="home-results" aria-describedby="home-status">
            <ul id="home-results" class="combo__list" role="listbox" aria-label="Places" hidden></ul>
          </div>
          <p id="home-status" class="t-small muted" data-home-status role="status">${status === 'none' ? 'Searching with OneMap, Singapore’s public map.' : ''}</p>
          <button class="btn btn--secondary btn--sm locate" type="button" data-locate>${icon('locate')}Use my current location</button>
        </div>`}
    ${routes ? html`    <fieldset class="field-group">
      <legend>How do you usually travel?</legend>
      <div class="chips">
        ${[['TRANSIT', 'Bus and train'], ['DRIVING', 'Car']].map(([v, l]) => html`
          <label class="chip"><input type="radio" name="travelmode" value="${v}" ${p.mode_travel === v ? 'checked' : ''}><span>${l}</span></label>`)}
      </div>
    </fieldset>
    <fieldset class="field-group">
      <legend>The longest trip you would make each way</legend>
      <div class="chips">
        ${LIMITS.map(v => html`<label class="chip"><input type="radio" name="limit" value="${v}" ${p.maxMinutes === v ? 'checked' : ''}><span>${v ? `${v} min` : 'No limit'}</span></label>`)}
      </div>
    </fieldset>
` : ''}
    <p class="t-small muted measure">Your home stays in this browser. ${routes ? `It is sent to ${status === 'none' ? 'OneMap' : 'Google Maps'} only to work out routes.` : ''}</p>
    ${stepError}`;
}

function stepInterests(p) {
  return html`
    <h1>What do you enjoy?</h1>
    <p class="t-lead measure">Pick as many as you like. We show the programmes and CCAs at each school that match. Nothing here limits which schools you see.</p>
    <fieldset class="interests">
      <legend class="sr-only">Things you enjoy</legend>
      ${INTERESTS.map(i => html`<label class="chip chip--lg"><input type="checkbox" name="interest" value="${i.id}" ${p.interests.includes(i.id) ? 'checked' : ''}><span>${i.label}</span></label>`)}
    </fieldset>
    ${stepError}`;
}

