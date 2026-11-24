import { html, icon, bandBadge, copPair, travelChip, interestChips, schoolTags, toast, announce, nextCard } from '../ui.js';
import { checkPlan, MAX_CHOICES, PG_INFO, BAND, copText, interestMatches, formatMinutes, INTEREST_LABEL } from '../logic.js';
import { footer } from './start.js';

const STATUS_SHORT = {
  verified_metrics: 'Figures published', qualitative_only: 'Described only', release_notice_only: 'Notice only',
  not_found_in_checked_official_sources: 'Not located', inaccessible_source: 'Not readable', not_applicable_full_cohort: 'Not standard',
};

/** Copy text: the clipboard API where allowed (https), else the older selection copy. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.append(t);
    t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
    return ok;
  }
}

const DRAWN = 's1compass.lineDrawn';
const drawn = () => { try { return sessionStorage.getItem(DRAWN) === '1'; } catch { return true; } };
const markDrawn = () => { try { sessionStorage.setItem(DRAWN, '1'); } catch { /* nothing to keep */ } };
const clearDrawn = () => { try { sessionStorage.removeItem(DRAWN); } catch { /* nothing to keep */ } };

export function mount(el, ctx) {
  const compare = new Set();

  function render() {
    const st = ctx.student();
    const choices = ctx.planChoices();
    const keys = ctx.state.plan.choices;
    const available = st.al && st.pg ? ctx.preview()[st.pg]?.ahead ?? null : null;
    const checks = checkPlan(choices, st, ctx.data.affiliations, { available });
    const better = ctx.betterGroup();
    const shortlist = ctx.state.plan.shortlist.map(id => ctx.byId.get(id)).filter(Boolean);
    const mode = ctx.state.profile.mode_travel;
    for (const id of [...compare]) if (!shortlist.some(s => s.id === id)) compare.delete(id);
    const complete = choices.length === MAX_CHOICES && !checks.some(c => c.level === 'error');
    // The line draws itself once, the first time it is complete in this visit
    let draw = false;
    if (complete && !drawn()) { draw = true; markDrawn(); }
    if (!complete) clearDrawn();
    let nx = st.al ? ctx.nextStep() : null;
    // When the line is complete the poster says so; the next card only points somewhere else
    if (nx?.href === '#/plan') nx = nx.id === 'done' ? null : { ...nx, href: null };

    el.innerHTML = String(html`
    <div class="page page--plan">
      <div class="wrap">
        <header class="plan-head">
          <div>
            <p class="t-label plan-head__kicker">The last stop</p>
            <h1>My six choices</h1>
            <p class="t-lead measure">Put first the school you want most. Posting reads your six in this order, so order them by wish, not by cut-off.</p>
          </div>
          ${choices.length ? html`<div class="btn-row plan-head__actions">
            <button class="btn btn--secondary" type="button" data-copy>${icon('copy')}Copy the list</button>
            <button class="btn btn--secondary" type="button" data-print>${icon('print')}Print</button>
          </div>` : ''}
        </header>
        ${!st.al ? html`<div class="note">${icon('info')}<p>Add your score first, so each choice can be compared with past cut-offs. <a class="inline-link" href="#/setup/1">Start with my score</a></p></div>` : ''}
        ${nx ? nextCard(nx, { compact: true }) : ''}
        <p class="print-only">${st.al ? `AL ${st.al} · ${st.pg ? PG_INFO[st.pg].name : ''}` : ''}${ctx.state.profile.home ? ` · Home: ${ctx.state.profile.home.label}` : ''}</p>

        <div class="plan-grid">
          <div class="plan-main">
            <section class="line-poster ground-inverse ${complete ? 'is-complete' : ''}" aria-labelledby="poster-h">
              <header class="line-poster__head">
                <p class="sign"><span class="code">S1</span><span class="kicker">${st.al ? `AL ${st.al}${st.pg ? ` · Posting Group ${st.pg}` : ''}` : 'Your line'}</span></p>
                <h2 id="poster-h" class="line-poster__title">${complete ? 'Your line is complete' : `Your line · ${choices.length} of ${MAX_CHOICES} stops`}</h2>
                ${complete ? html`<p class="line-poster__sub">Six stops, in your order. Print it or copy it to talk it over at home.</p>` : ''}
                <ul class="line-poster__key">${['ahead', 'mixed', 'behind'].map(b => html`<li data-band="${b}"><i></i>${BAND[b].short}</li>`)}</ul>
              </header>
            <ol class="choices ${complete ? 'is-complete' : ''} ${draw ? 'is-drawing' : ''}" aria-label="Your choices in order">
              ${choices.map((c, i) => {
                const t = ctx.travelFor(c.school.id);
                const note = ctx.state.plan.notes[c.school.id];
                return html`<li class="choice card m-nolift" data-key="${c.option.key}" data-band="${c.cmp.band}" style="--k:${i}">
                  <span class="choice__n mono" aria-hidden="true">${i + 1}</span>
                  <div class="choice__body">
                    <h2 class="choice__name"><a href="#/school/${c.school.id}">${c.school.name}</a>${c.option.prog === 'IP' ? html` <span class="opt__prog">IP</span>` : ''}</h2>
                    <p class="result__meta">${schoolTags(c.school)} · <span class="mono">Code ${c.option.code}</span></p>
                    <div class="opt">${bandBadge(c.cmp, { short: true })}${copPair(c.cmp)}${c.cmp.affiliated ? html`<span class="tag">Affiliated</span>` : ''}</div>
                    <div class="result__chips">${travelChip(t, mode)}${interestChips(interestMatches(c.school, st.interests))}</div>
                    ${note ? html`<p class="choice__note">${icon('edit')}<span>${note}</span></p>` : ''}
                  </div>
                  <div class="choice__tools">
                    <button class="icon-btn" type="button" data-move="-1" data-fk="up-${c.option.key}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${c.school.name} up to choice ${i}">${icon('up')}</button>
                    <button class="icon-btn" type="button" data-move="1" data-fk="down-${c.option.key}" ${i === choices.length - 1 ? 'disabled' : ''} aria-label="Move ${c.school.name} down to choice ${i + 2}">${icon('down')}</button>
                    <button class="icon-btn" type="button" data-remove data-fk="rm-${c.option.key}" aria-label="Remove ${c.school.name} from my six">${icon('x')}</button>
                  </div>
                </li>`;
              })}
              ${Array.from({ length: Math.max(0, MAX_CHOICES - choices.length) }, (_, i) => html`<li class="choice choice--empty" style="--k:${choices.length + i}"><span class="choice__n mono" aria-hidden="true">${choices.length + i + 1}</span><span class="muted">Empty. ${i === 0 ? html`<a class="inline-link" href="#/explore">Find a school</a>` : ''}</span></li>`)}
            </ol>
            </section>
            ${keys.length > choices.length ? html`<p class="note note--warn">${icon('warn')}<span>Some choices no longer fit your posting group and are hidden. <button class="inline-link" type="button" data-prune>Remove them</button></span></p>` : ''}

            <section class="block" aria-labelledby="short-h">
              <div class="block__head"><h2 id="short-h">Shortlist <span class="muted">${shortlist.length}</span></h2>
                ${shortlist.length > 1 ? html`<p class="t-small muted">Tick up to three to compare them side by side.</p>` : ''}</div>
              ${shortlist.length ? html`<ul class="short-grid">${shortlist.map(s => {
                const opts = ctx.options(s);
                return html`<li class="card short m-nolift">
                  <div class="result__head">
                    <h3 class="result__name"><a href="#/school/${s.id}">${s.name}</a></h3>
                    <button class="star" type="button" aria-pressed="true" data-unsave="${s.id}" data-fk="unsave-${s.id}" aria-label="Remove ${s.name} from shortlist">${icon('star')}</button>
                  </div>
                  <p class="result__meta">${schoolTags(s)}</p>
                  ${opts.map(o => html`<div class="opt">${opts.length > 1 ? html`<span class="opt__prog">${o.option.prog}</span>` : ''}${bandBadge(o.cmp, { short: true })}
                    ${keys.includes(o.option.key)
                      ? html`<span class="tag">#${keys.indexOf(o.option.key) + 1} in my six</span>`
                      : html`<button class="add" type="button" data-add="${o.option.key}" data-fk="add-${o.option.key}">${icon('plus')}<span>Add${opts.length > 1 ? ` ${o.option.prog}` : ''}</span></button>`}</div>`)}
                  ${!s.ordinary ? html`<div class="opt">${bandBadge({ band: 'special' })}</div>` : ''}
                  <label class="check check--sm"><input type="checkbox" data-compare="${s.id}" data-fk="cmp-${s.id}" ${compare.has(s.id) ? 'checked' : ''} ${!compare.has(s.id) && compare.size >= 3 ? 'disabled' : ''}><span>Compare</span></label>
                </li>`;
              })}</ul>` : html`<p class="muted">Save schools with the star to keep them here while you decide.</p>`}
            </section>

            ${compare.size >= 2 ? compareTable([...compare].map(id => ctx.byId.get(id)), ctx, st) : ''}
          </div>

          <aside class="plan-aside">
            ${choices.length ? glance(choices, st) : ''}
            <div class="card checks-card m-nolift" aria-labelledby="checks-h">
              <h2 id="checks-h" class="t-card">Checks</h2>
              <div class="meter" role="img" aria-label="${choices.length} of 6 choices: ${['ahead', 'mixed', 'behind', 'none'].map(b => `${choices.filter(c => c.cmp.band === b).length} ${BAND[b].short.toLowerCase()}`).join(', ')}">
                ${Array.from({ length: MAX_CHOICES }, (_, i) => html`<span class="meter__cell ${choices[i] ? `meter__cell--${choices[i].cmp.band}` : ''}"></span>`)}
              </div>
              <div class="meter__legend t-small">${['ahead', 'mixed', 'behind'].map(b => html`<span><i class="dot dot--${b}"></i>${BAND[b].short}</span>`)}</div>
              <ul class="issues">${checks.map(c => html`<li class="issue issue--${c.level}">${icon(c.level === 'ok' ? 'check' : c.level === 'error' ? 'error' : c.level === 'warn' ? 'warn' : 'info')}<span>${c.text}</span></li>`)}</ul>
              ${better ? html`<div class="switch-box">
                <p>With AL ${st.al} you can also choose ${PG_INFO[better.pg].name}, where ${better.ahead} schools had cut-offs less stringent than your score. One group applies to all six, so talk it over with a parent first.</p>
                <button class="btn btn--primary btn--sm" type="button" data-switch-group="${better.pg}">Switch to ${PG_INFO[better.pg].name}</button>
              </div>` : ''}
            </div>
            <div class="card tips m-nolift">
              <h2 class="t-card">Before you submit</h2>
              <ul class="checks">
                <li>Submit with a parent on MOE’s S1 Internet System, or on the form from your primary school.</li>
                <li>Use the school and programme codes shown here, and check them against SchoolFinder.</li>
                <li>Visit or watch the open house of your top choices, and try the trip once.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
      ${footer(ctx.data)}
    </div>`);
  }

  /** Your six at a glance: three numbers a parent asks first. */
  function glance(choices, st) {
    const safer = choices.filter(c => c.cmp.band === 'ahead').length;
    const trips = choices.map(c => ctx.travelFor(c.school.id)).filter(Boolean);
    const timed = trips.filter(t => t.min != null);
    const near = timed.length ? Math.min(...timed.map(t => t.min)) : trips.length ? Math.min(...trips.map(t => t.km)) : null;
    const liked = new Set(choices.flatMap(c => interestMatches(c.school, st.interests))).size;
    return html`<div class="card glance m-nolift">
      <h2 class="t-card">Your six at a glance</h2>
      <dl class="glance__row">
        <div><dt>Safer choices</dt><dd><span class="glance__n">${safer}</span><span class="muted"> of ${choices.length}</span></dd></div>
        <div><dt>${timed.length ? 'Shortest trip' : 'Nearest'}</dt><dd><span class="glance__n">${near == null ? '–' : timed.length ? near : near.toFixed(1)}</span><span class="muted"> ${near == null ? '' : timed.length ? 'min' : 'km'}</span></dd></div>
        <div><dt>Interests covered</dt><dd><span class="glance__n">${liked}</span><span class="muted"> of ${st.interests.length}</span></dd></div>
      </dl>
    </div>`;
  }

  function compareTable(list, ctx, st) {
    const rows = [
      ['Past cut-offs', s => ctx.options(s).map(o => html`<div>${ctx.options(s).length > 1 ? `${o.option.prog}: ` : ''}${bandBadge(o.cmp, { short: true })}<div class="mono t-small">${[2024, 2025].map(y => `${y}: ${copText(o.cmp.years[y].rec)}`).join(' · ')}</div></div>`)],
      ['Trip', s => { const t = ctx.travelFor(s.id); return t ? (t.min != null ? formatMinutes(t.min) : `${t.km} km away`) : '—'; }],
      ['Your interests', s => interestMatches(s, st.interests).map(m => INTEREST_LABEL[m]).join(', ') || '—'],
      ['Programmes', s => s.strengths.map(x => x.name).join('; ') || '—'],
      ['CCAs listed', s => String(s.ccas.length)],
      ['Things to check', s => s.constraints.map(c => c.fact).join(' ') || 'None documented'],
      ['O-Level information', s => s.olevel.map(y => `${y.year}: ${STATUS_SHORT[y.status]}`).join(' · ')],
    ];
    return html`<section class="block" aria-labelledby="cmp-h">
      <h2 id="cmp-h">Side by side</h2>
      <div class="table-wrap"><table class="table table--compare">
        <thead><tr><th scope="col"><span class="sr-only">Measure</span></th>${list.map(s => html`<th scope="col">${s.name}</th>`)}</tr></thead>
        <tbody>${rows.map(([label, fn]) => html`<tr><th scope="row">${label}</th>${list.map(s => html`<td>${fn(s)}</td>`)}</tr>`)}</tbody>
      </table></div>
    </section>`;
  }

  function asText() {
    const st = ctx.student();
    const lines = [`My Secondary 1 choices${st.al ? ` (AL ${st.al}, ${PG_INFO[st.pg]?.name ?? ''})` : ''}`, ''];
    ctx.planChoices().forEach((c, i) => {
      const t = ctx.travelFor(c.school.id);
      const trip = t ? (t.min != null ? `, about ${formatMinutes(t.min)}` : `, ${t.km} km away`) : '';
      lines.push(`${i + 1}. ${c.school.name}${c.option.prog === 'IP' ? ' (IP)' : ''}, code ${c.option.code}: cut-offs 2024 ${copText(c.cmp.years[2024].rec)}, 2025 ${copText(c.cmp.years[2025].rec)}${trip}`);
    });
    lines.push('', 'Past cut-offs are not a chance of admission. Check every code on MOE SchoolFinder.');
    return lines.join('\n');
  }

  el.addEventListener('click', async e => {
    const li = e.target.closest('[data-key]');
    const move = e.target.closest('[data-move]');
    if (move && li) { ctx.moveChoice(li.dataset.key, Number(move.dataset.move)); announce('Moved'); return; }
    if (e.target.closest('[data-remove]') && li) { ctx.removeChoice(li.dataset.key); return; }
    const add = e.target.closest('[data-add]');
    if (add) { ctx.addChoice(add.dataset.add); return; }
    const un = e.target.closest('[data-unsave]');
    if (un) { ctx.toggleShortlist(un.dataset.unsave); return; }
    if (e.target.closest('[data-prune]')) {
      const valid = new Set(ctx.planChoices().map(c => c.option.key));
      ctx.update(s => { s.plan.choices = s.plan.choices.filter(k => valid.has(k)); });
      return;
    }
    if (e.target.closest('[data-print]')) { window.print(); return; }
    const sw = e.target.closest('[data-switch-group]');
    if (sw) { ctx.switchGroup(Number(sw.dataset.switchGroup)); return; }
    if (e.target.closest('[data-copy]')) {
      if (await copyText(asText())) toast('Your list is copied. Paste it into a message or a note.');
      else toast('Copying is blocked here. Use Print instead.');
    }
  });

  el.addEventListener('change', e => {
    const id = e.target.dataset.compare;
    if (!id) return;
    e.target.checked ? compare.add(id) : compare.delete(id);
    update();
  });

  function update() {
    const fk = document.activeElement?.dataset?.fk;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    if (fk) {
      const n = el.querySelector(`[data-fk="${CSS.escape(fk)}"]`);
      if (n && !n.disabled) n.focus({ preventScroll: true });
      else el.querySelector('.choices')?.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    }
  }

  render();
  return { update };
}
