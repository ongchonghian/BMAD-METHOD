import { html, raw, icon, arrow, bandBadge, schoolTags } from '../ui.js';
import { plotSvg } from '../plot.js';
import { compareOption, schoolOptions, distanceKm } from '../logic.js';

// An example student for the preview window: real schools and real past cut-offs, straight-line distances.
const EXAMPLE = { al: 14, pg: 3, hcl: 'none', home: { lat: 1.3532, lng: 103.9452, label: 'Tampines' } };

// The kit's moments are mounted per view, never on page load.
window.__momentsManual = true;

export function mount(el, ctx) {
  const d = ctx.data;
  const st = ctx.student();
  const started = Boolean(st.al);
  const next = ctx.nextStep();
  const chosen = ctx.state.plan.choices.length;

  const sample = d.schools
    .flatMap(s => schoolOptions(s, 3).filter(o => o.prog === 'SEC').map(o => ({ s, cmp: compareOption(s, o, EXAMPLE), km: distanceKm(EXAMPLE.home, s) })))
    .sort((a, b) => a.km - b.km);
  const rows = ['ahead', 'mixed', 'behind'].map(b => sample.find(x => x.cmp.band === b)).filter(Boolean);
  const points = d.schools.map(s => ({ lat: s.lat, lng: s.lng, band: sample.find(x => x.s === s)?.cmp.band || 'none' }));

  // The towns with the most schools, for the moving row
  const byTown = {};
  for (const s of d.schools) byTown[s.area] = (byTown[s.area] || 0) + 1;
  const towns = Object.entries(byTown).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14).map(([t]) => t);
  const townCount = Object.keys(byTown).length;

  const primary = next.action
    ? html`<button class="btn btn--primary" type="button" data-next-action="${next.action}">${next.label}${arrow}</button>`
    : html`<a class="btn btn--primary" href="${started ? next.href : '#/setup/1'}">${started ? next.label : 'Start with my score'}${arrow}</a>`;

  el.innerHTML = String(html`
  <section class="hero hero--split" data-enter aria-labelledby="hero-h">
    <div class="wrap">
      <div class="hero-text grid hero-split">
        <div class="hero-copy span-6">
          ${started
            ? html`<p class="hero-notice">Welcome back · <strong>AL ${st.al}</strong>${st.pg ? ` · Posting Group ${st.pg}` : ''} · ${chosen} of 6 chosen</p>`
            : html`<p class="hero-notice">For Primary 6 students choosing schools for <strong>${d.planningIntakeYear}</strong></p>`}
          <h1 id="hero-h">Plan your six secondary school choices</h1>
          <p class="t-lead">${started
            ? `Next stop: ${next.title.toLowerCase()}. ${next.text}`
            : 'Start from your PSLE score. See how it compares with each school’s 2024 and 2025 cut-offs, how far each school is from home, and what you could do there. Then line up your six.'}</p>
          <div class="btn-row">
            ${primary}
            ${started ? html`<a class="btn btn--secondary" href="#/plan">My six</a>` : html`<a class="btn btn--secondary" href="#/explore">Browse all schools</a>`}
          </div>
          <dl class="hero-facts">
            <div><dt>Schools</dt><dd data-m-count>${d.schools.length}</dd></div>
            <div><dt>Towns</dt><dd>${townCount}</dd></div>
            <div><dt>Choices you can list</dt><dd>Up to 6</dd></div>
          </dl>
        </div>
        <div class="hero-visual hero-stage span-6 start-7">
          <div class="hero-stage__fx" data-fx="grain-gradient" data-fx-seed="2027" data-fx-params='{"speed":0.35,"calm":0.35,"calmX":0.5,"calmY":0.55,"tint":0.65}' aria-hidden="true"></div>
          <div class="app-window" role="img" aria-label="Example: a student with AL 14 who lives in Tampines sees nearby schools marked by how their score compares with past cut-offs">
            <div class="app-window__bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="t-label">Example · AL 14 · Posting Group 3 · home in Tampines</span></div>
            <div class="app-window__body">
              <div class="app-window__map">${raw(plotSvg(points, EXAMPLE.home, ''))}</div>
              <ul class="app-window__list">
                ${rows.map(r => html`<li data-band="${r.cmp.band}">
                  <span class="aw-name">${r.s.name}</span>
                  <span class="aw-meta">${schoolTags(r.s)}</span>
                  <span class="aw-row">${bandBadge(r.cmp, { short: true })}<span class="meta-chip">${icon('pin')}${r.km.toFixed(1)} km</span></span>
                </li>`)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section start-how" aria-labelledby="how-h">
    <div class="wrap">
      <h2 id="how-h">Four stops from your result slip to your list. <span class="muted">About fifteen minutes with a parent.</span></h2>
      <ol class="line-steps">
        ${[
          ['Your score', 'Tap your four subject results. You see your total and your posting group at once.'],
          ['Your home', ctx.canRoute()
            ? 'Search your address or postal code. Trips are timed for a school morning, arriving by 7:15.'
            : 'Search your address or postal code. See how far each school is, and the way there in Google Maps.'],
          ['What you enjoy', 'Pick the things you like doing. Every school shows the programmes and CCAs that match.'],
          ['Your six', 'Line up six schools in the order you want them. The app checks the rules and the balance for you.'],
        ].map(([t, p], i) => html`<li class="line-steps__stop">
          <span class="line-steps__stn mono" aria-hidden="true">${i + 1}</span>
          <h3>${t}</h3>
          <p>${p}</p>
        </li>`)}
      </ol>
    </div>
  </section>

  <section class="section start-statement ground-inverse" aria-labelledby="statement-h">
    <div class="wrap">
      <div data-moment="liquid-type" class="statement">
        <h2 id="statement-h" class="mo-lt__type">Six choices. One plan.</h2>
        <p class="t-lead measure">Know which schools your score reached in the last two years, how far each one is from home, and what you would do there. Then put them in an order you can explain.</p>
        <div class="btn-row">${primary}</div>
      </div>
    </div>
  </section>

  <section class="section start-towns" aria-labelledby="towns-h">
    <div class="wrap">
      <h2 id="towns-h">${d.schools.length} schools across ${townCount} towns. <span class="muted">Every one has its 2024 and 2025 cut-offs, its programmes and its CCAs.</span></h2>
      <div data-moment="marquee-row" data-moment-opts='{"speed": 30}' class="towns">
        <ul class="mo-mq__track">${towns.map(t => html`<li>${t}</li>`)}</ul>
      </div>
      <div class="honest">
        <h3 class="t-card">What the numbers mean</h3>
        <ul class="checks">
          <li>A cut-off is the score of the last student posted to a school in that year. It changes every year.</li>
          <li>The app compares your score with the last two years. It never gives a chance of getting in.</li>
          <li>Schools with no published result are shown as a gap, never as a poor result.</li>
        </ul>
      </div>
    </div>
  </section>

  ${footer(d)}`);

  // The dealt effect (the hero frame's ground) and the two dealt moments, mounted for this view only
  let fx = null, moments = null;
  import('../../assets/effects/fx.js').then(m => { if (!el.isConnected) return; fx = m.default; fx.mountAll(el); }).catch(e => console.warn('fx', e));
  import('../../assets/moments/moments.js').then(m => { if (!el.isConnected) return; moments = m; m.mountAll(el); }).catch(e => console.warn('moments', e));
  return {
    destroy() {
      try { fx?.unmountAll(el); } catch { /* gone */ }
      try { moments?.unmountAll(el); } catch { /* gone */ }
    },
  };
}

export function footer(d) {
  return html`<footer class="site-foot">
    <div class="wrap site-foot__row">
      <p class="t-small">Data as of ${new Date(d.asOf).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}: MOE SchoolFinder 2024 and 2025 posting cut-offs, school programme listings and published O-Level information. Check every choice on <a class="inline-link" href="https://www.moe.gov.sg/schoolfinder" target="_blank" rel="noopener">MOE SchoolFinder</a> before you submit.</p>
      <p class="t-small muted">S1 Compass is not an MOE service. Your details stay in this browser.</p>
    </div>
  </footer>`;
}
