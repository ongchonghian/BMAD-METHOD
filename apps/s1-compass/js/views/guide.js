import { html, icon, bandBadge } from '../ui.js';
import { PG_INFO } from '../logic.js';
import { footer } from './start.js';

export function mount(el, ctx) {
  const d = ctx.data;
  const nat = d.nationalContext;
  el.innerHTML = String(html`
  <div class="page page--guide">
    <div class="wrap guide">
      <header>
        <h1>How Secondary 1 posting works</h1>
        <p class="t-lead measure">The short version: you list up to six schools in the order you want them. Students are placed by score, then by the order of their choices. If none of your six has a place, you are posted to a school near home with places left.</p>
      </header>

      <section class="block" aria-labelledby="g1">
        <h2 id="g1">Your posting group</h2>
        <p class="measure">Your PSLE score (AL 4 to 30, lower is better) puts you in a posting group. The group sets the subject level you start at and which cut-offs apply to you.</p>
        <div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">PSLE score</th><th scope="col">Posting group</th></tr></thead>
          <tbody>
            <tr><td class="mono">4 to 20</td><td>Posting Group 3</td></tr>
            <tr><td class="mono">21 to 22</td><td>Posting Group 3 or 2: you choose one for all your choices</td></tr>
            <tr><td class="mono">23 to 24</td><td>Posting Group 2</td></tr>
            <tr><td class="mono">25</td><td>Posting Group 2 or 1: you choose one for all your choices</td></tr>
            <tr><td class="mono">26 to 30</td><td>Posting Group 1, with AL 7 or better in English and Mathematics</td></tr>
          </tbody>
        </table></div>
        <ul class="pg-cards">${[3, 2, 1].map(n => html`<li class="card m-nolift"><h3>${PG_INFO[n].name}</h3><p>${PG_INFO[n].text}</p></li>`)}</ul>
        <p class="t-small muted measure">From 2027 every student works towards the Singapore–Cambridge Secondary Education Certificate (SEC), with subjects at G1, G2 or G3. The Integrated Programme skips the O-Level and leads to the A-Level or IB.</p>
      </section>

      <section class="block" aria-labelledby="g2">
        <h2 id="g2">What a cut-off is, and what it is not</h2>
        <p class="measure">A cut-off is the score of the last student posted to a school in one year. It depends on who applied that year, so it moves. The app shows 2024 and 2025 side by side and says how your score compares:</p>
        <ul class="band-list">
          ${['ahead', 'mixed', 'behind', 'none'].map(b => html`<li>${bandBadge({ band: b })}<span>${{
            ahead: 'Your score was better than the cut-off in both years.',
            mixed: 'Your score was better in one year and not the other, or equal to a cut-off.',
            behind: 'Both cut-offs were stricter than your score. You can still list the school.',
            none: 'No cut-off to compare: the school has its own admission, or a year is missing.',
          }[b]}</span></li>`)}
        </ul>
        <p class="measure">These are not chances. Nobody can tell you the 2026 cut-offs before posting. A score equal to the cut-off is settled by citizenship, then by the order of your choices, then by a computer ballot.</p>
      </section>

      <section class="block" aria-labelledby="g3">
        <h2 id="g3">Rules for your six</h2>
        <ul class="checks measure">
          <li>You can list up to six. Using all six helps, as long as you would be happy at each one.</li>
          <li>MOE suggests including two or three schools whose past cut-offs were less stringent than your score.</li>
          <li>One posting group applies to every choice.</li>
          <li>At a school with both IP and the SEC course, the two are separate choices with separate codes.</li>
          <li>Affiliation gives priority only when the affiliated school is your first choice. Listing its IP first and its SEC course second keeps it.</li>
          <li>At SAP schools, a Higher Chinese grade can decide between students with the same score of 14 or better. You need to have taken Chinese.</li>
          <li>Schools such as the School of the Arts, the Sports School, NUS High and SST admit through their own process, not through these six choices.</li>
          <li>If you got a place through Direct School Admission, you do not list choices.</li>
        </ul>
      </section>

      <section class="block" aria-labelledby="g4">
        <h2 id="g4">About the school information</h2>
        <ul class="checks measure">
          <li>Programmes and CCAs come from MOE SchoolFinder as of ${d.asOf}. A listing is not a guaranteed place: ask at the open house.</li>
          <li>“You might enjoy this if…” lines explain a programme in plain words. They are interpretations, not measured results.</li>
          <li>O-Level information shows exactly what each school published for the 2024 and 2025 exams. Most schools publish no figures, and a gap is not a poor result.</li>
        </ul>
        ${nat?.length ? html`<p class="t-small muted measure">For context, across Singapore ${nat.map(n => `${n.at_least_five_C6_percent}% of ${n.exam_year} O-Level candidates passed five or more subjects`).join(', and ')} (SEAB).</p>` : ''}
        <p class="t-small muted measure">Always confirm codes, cut-offs and admission rules on <a class="inline-link" href="https://www.moe.gov.sg/schoolfinder" target="_blank" rel="noopener">MOE SchoolFinder${icon('out')}</a> and <a class="inline-link" href="https://www.moe.gov.sg/secondary/s1-posting" target="_blank" rel="noopener">MOE’s S1 posting page${icon('out')}</a>.</p>
      </section>
    </div>
    ${footer(d)}
  </div>`);
  return {};
}

