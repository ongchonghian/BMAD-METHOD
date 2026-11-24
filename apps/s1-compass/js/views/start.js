import { html, raw, icon, arrow, bandBadge, schoolTags } from '../ui.js';
import { plotSvg } from '../plot.js';
import { compareOption, schoolOptions, distanceKm } from '../logic.js';

// An example student for the preview window: real schools and real past cut-offs, straight-line distances.
const EXAMPLE = { al: 14, pg: 3, hcl: 'none', home: { lat: 1.3532, lng: 103.9452, label: 'Tampines' } };

export function mount(el, ctx) {
  const d = ctx.data;
  const st = ctx.student();
  const started = Boolean(st.al);
  const cutoffCount = d.schools.reduce((n, s) => n + s.cutoffs.length, 0);

  const sample = d.schools
    .flatMap(s => schoolOptions(s, 3).filter(o => o.prog === 'SEC').map(o => ({ s, cmp: compareOption(s, o, EXAMPLE), km: distanceKm(EXAMPLE.home, s) })))
    .sort((a, b) => a.km - b.km);
  const rows = ['ahead', 'mixed', 'behind'].map(b => sample.find(x => x.cmp.band === b)).filter(Boolean);
  const points = d.schools.map(s => ({ lat: s.lat, lng: s.lng, band: sample.find(x => x.s === s)?.cmp.band || 'none' }));

  el.innerHTML = String(html`
  <section class="hero hero--split" data-enter aria-labelledby="hero-h">
    <div class="wrap">
      <div class="hero-text grid hero-split">
        <div class="hero-copy span-6">
          <p class="hero-notice">For Primary 6 students choosing schools for <strong>${d.planningIntakeYear}</strong></p>
          <h1 id="hero-h">Plan your six secondary school choices</h1>
          <p class="t-lead">Start from your PSLE score. See how it compares with each school’s 2024 and 2025 cut-offs, how long the trip from home takes, and what you could do there. Then put your six in an order you can explain.</p>
          <div class="btn-row">
            ${started
              ? html`<a class="btn btn--primary" href="#/explore">See my schools${arrow}</a><a class="btn btn--secondary" href="#/setup/1">Change my details</a>`
              : html`<a class="btn btn--primary" href="#/setup/1">Start with my score${arrow}</a><a class="btn btn--secondary" href="#/explore">Browse all schools</a>`}
          </div>
          <dl class="hero-facts">
            <div><dt>Schools</dt><dd>${d.schools.length}</dd></div>
            <div><dt>Past cut-offs</dt><dd>${cutoffCount}</dd></div>
            <div><dt>Choices you can list</dt><dd>Up to 6</dd></div>
          </dl>
        </div>
        <div class="hero-visual span-6 start-7">
          <div class="app-window" role="img" aria-label="Example: a student with AL 14 who lives in Tampines sees nearby schools marked by how their score compares with past cut-offs">
            <div class="app-window__bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="t-label">Example · AL 14 · Posting Group 3 · home in Tampines</span></div>
            <div class="app-window__body">
              <div class="app-window__map">${raw(plotSvg(points, EXAMPLE.home, ''))}</div>
              <ul class="app-window__list">
                ${rows.map(r => html`<li>
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
      <h2 id="how-h">Four steps from your result slip to your list. <span class="muted">About fifteen minutes with a parent.</span></h2>
      <ol class="grid steps">
        ${[
          ['1', 'Your score', 'Enter your subject results. The app works out your total and your posting group, and asks you to choose when your score allows two.'],
          ['2', 'Your home', 'Search your address or postal code. Travel times are for a school morning, arriving by 7:15, by bus and train.'],
          ['3', 'What you enjoy', 'Pick the things you like doing. Schools show the programmes and CCAs that match them.'],
          ['4', 'Your six', 'Order up to six choices by where you most want to go. The app checks the posting rules and the balance of your list.'],
        ].map(([n, t, p]) => html`<li class="card step span-3 m-nolift"><span class="step__n mono">${n}</span><h3>${t}</h3><p>${p}</p></li>`)}
      </ol>
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
  return {};
}

export function footer(d) {
  return html`<footer class="site-foot">
    <div class="wrap site-foot__row">
      <p class="t-small">Data as of ${new Date(d.asOf).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}: MOE SchoolFinder 2024 and 2025 posting cut-offs, school programme listings and published O-Level information. Check every choice on <a class="inline-link" href="https://www.moe.gov.sg/schoolfinder" target="_blank" rel="noopener">MOE SchoolFinder</a> before you submit.</p>
      <p class="t-small muted">S1 Compass is not an MOE service. Your details stay in this browser.</p>
    </div>
  </footer>`;
}
