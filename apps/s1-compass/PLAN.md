# S1 Compass: plan

A web app that helps a Primary 6 student and their family turn a PSLE score into six Secondary 1 choices
they understand and can defend. It reads the expanded 2024–2025 school-choice database (147 schools, 899
historical cut-off records, a fit profile for every school) and uses Google Maps to plan the daily journey.

The plan runs in the order asked for: flow first, then UX, then UI.

## 1. Flow

### Who and when

- **The student** (12) makes the choices with a parent. Results come out in late November; the choice
  window is about a week. Most of the work happens on a phone, the final list is often settled on a laptop.
- **The parent** checks the travel, the rules and the order.

### The four questions the app keeps apart

The database insists on these, and the flow follows them:

1. **Can I apply through this route?** Posting group, programme (SEC or IP), affiliation, special admission.
2. **Would daily life suit me?** Interests, CCAs, support, constraints, travel.
3. **How does my score compare with past postings?** Historical cut-offs only. Never a probability.
4. **What has the school published?** O-Level evidence with its exact definition, or an explicit gap.

### Journey

```
Start ─▶ 1 Score ─▶ 2 About you ─▶ 3 Posting group ─▶ 4 Home ─▶ 5 Interests ─▶ Explore
                                     (a choice when the  (skippable)              │
                                      score allows two)                           ▼
                                                                  School ◀──▶ Shortlist ─▶ My six ─▶ Print / share
```

| Step | What the student does | What the app works out |
|---|---|---|
| 1 Score | Enters the four subject ALs (or just the total) | Total AL; whether the PG1 condition (AL 7 or better in English and Maths) is met |
| 2 About you | Boy or girl, primary school, Chinese (and Higher Chinese at AL 14 or better) | Single-sex and SAP eligibility, affiliation, HCL tie-break context |
| 3 Posting group | Picks PG2/PG3 at AL 21–22, PG1/PG2 at AL 25, seeing how many schools each leads to | One posting group for the whole list (official rule) |
| 4 Home | Searches an address or postal code, or uses their location; picks a travel limit | Origin for routes and travel times |
| 5 Interests | Taps the things they enjoy | Interest matches on every school |
| Explore | Filters, sorts, sees the list and the map | Cut-off comparison, travel time, interest matches |
| School | Reads one school, plans the route, adds it | Route with steps, arrive-by time, questions to ask |
| My six | Orders up to six, adds notes | Checks the rules and the balance of the list |

Every step can be revisited from the profile summary. Nothing is lost on refresh (local storage only; no
account, nothing leaves the device apart from map requests).

### Rules the app enforces or explains

- About you comes before the posting group, so each group's preview counts only schools the student can apply to.
- A choice of group shows, for each group, how many schools had cut-offs less stringent than the score in both
  years. If the chosen group has none and the other has some, the school list and My six offer to switch.
- SAP schools need Chinese at PSLE; the Higher Chinese question appears only at AL 14 or better, where it can matter.

- Posting group bands: 4–20 PG3; 21–22 PG3 or PG2; 23–24 PG2; 25 PG2 or PG1; 26–30 PG1 with AL 7 or better
  in English and Maths. A student outside the bands is pointed to their primary school and the
  specialised schools.
- One posting group for all six choices.
- Up to six choices; at a dual-track school IP and SEC are separate choices with separate codes; duplicates
  are judged by posting group plus programme code.
- An affiliated school counts as affiliated only when it is the first choice (an IP choice first and the SEC
  choice of the same school second keeps it).
- MOE's advice: two or three choices whose past cut-offs were less stringent than the score.
- Schools with their own admission (SOTA, Sports School, NUS High, SST, NorthLight, Assumption Pathway, Crest,
  Spectra) are shown with how to apply, not with a comparison.

### Comparison bands (the only "verdict" the app gives)

Two-year buffer = min(COP 2024, COP 2025) − student AL, as the database defines it.

| Band | When | Words shown |
|---|---|---|
| Ahead | better than both years | "Your score was better than both past cut-offs" |
| Mixed | better than or equal to one year | "Between the last two cut-offs" |
| Behind | worse than both years | "Past cut-offs were stricter than your score" |
| Open | a year had vacancies left (30*) | "Places were left over in a past year" |
| No comparison | a year is missing, or own admission | "No comparable cut-off" |

Ties at a cut-off with a Higher Chinese qualifier use the student's HCL grade (D, M, P, none) only at AL 14 or
better. None of this is a chance of getting in, and the app says so where the band is shown.

## 2. UX

**Principles**

- **Talk to the student.** Short sentences, second person, no jargon without a one-line explanation
  ("Posting group: the group your score puts you in. It sets which courses you start in").
- **Honest by default.** No "safe", "reach" or percentages. Missing data is a labelled gap, never a zero or a
  bad mark. Interpretations ("you might enjoy this if…") are kept apart from facts and from the family's own
  notes.
- **One decision a screen in setup,** with a visible way back and a skip where the step is optional.
- **Summary first, detail on demand.** The list row answers: can I, how far, what's there for me. The school page
  holds the rest.
- **Travel is real.** Times are public transport on a school morning, arriving by 7:15, from Google Maps.
  Without a Maps key the app uses the open MapLibre map, with bus and train routes and trip times from OneMap
  when OneMap routing is set up, and straight-line distance when it is not. Every route also opens in Google Maps.
- **Strategy, not sorting.** The six are ordered by preference. The app checks the balance and the rules and
  explains them; it never re-sorts the list by cut-off.
- **Reachable for everyone.** Works by keyboard and screen reader; 44px targets; reduced motion respected;
  works at 320px.

**Key screens**

1. **Start.** What the app does in one line, the facts it is built on (147 schools, 2024 and 2025 cut-offs),
   one button: Start with my score.
2. **Setup.** A five-step form with a step counter, Back and Continue in the same place every time.
3. **Explore.** Profile strip (AL, PG, home, interests, edit). Filters as chips: Comparison band, Travel
   limit, Interests, More (gender, school type, SAP, IP, area, own admission). Sort: Best match, Shortest
   travel, Largest buffer, Name. Split list and map on a wide screen; List / Map switch on a phone.
4. **School.** Header with badges and actions. Then: Your score and past cut-offs (a scale from AL 4 to 30
   with both years' ranges and your marker), Getting there (map, mode, arrive-by, steps, open in Google
   Maps), What you could do here (programmes with "you might enjoy this if"), CCAs (your interests first),
   Check before choosing (documented constraints and questions to ask), Support, Published O-Level
   information (status per year, exact metrics, caveats), Sources.
5. **My six.** Ordered list with move up, move down and remove; per-choice comparison, travel and a note.
   Checks: count, one posting group, balance, affiliation position, duplicates. Shortlisted schools below,
   ready to add. Compare up to three side by side. Print or copy the list.

**Travel**: trip times, the travel-mode switch, the longest-trip setting and its filter appear only when a
route service is set up (Google Maps or OneMap). Otherwise the app says "distance from home" and offers the way
there in Google Maps, and never asks a student for a key or token.

**States**: first visit (no profile → start), no matches (clear filters), map loading, map key missing
(fallback note with how to add a key), route not found (open in Google Maps), offline data load error.

## 3. UI

Built with the [taste-skill](https://github.com/ongchonghian/taste-skill) system: its `system.css` tokens,
buttons, fields, cards, nav, its motion layer (`motion.css`, `motion.js`), and its dealt look.

- **Kind:** software (a web app for families). Dealt with `start.mjs deal --page software --trade saas`.
- **Palette:** `cool-white-slate` (Frost and slate): off-white ground #f7f9fa, slate ink #1f3038, one teal
  accent #0d7480 for the primary action, focus and state. It reads calm and official without copying any
  ministry brand; the interface stays 90–95% neutral and colour carries meaning only (comparison bands).
- **Type:** `mona`: Mona Sans for display and text, Geist Mono for scores and codes. Sentence case, 16px
  minimum for reading text, labels 13px at 500.
- **Radius:** `soft` (8/12/20). One button pair (primary filled, secondary outline), one card style, one link
  look, one chip style.
- **Band colours:** ahead teal, mixed amber, behind slate-rose, open blue, none grey; always with a word and
  an icon shape, never colour alone.
- **Motion:** the start screen's hero enters once; buttons step and press; linked cards lift 2px; nothing
  moves on scroll; everything rests under reduced motion.
- **Layout:** the kit's `.wrap` (1280, 80px gutters, 24 on a phone) and 12-column grid. Explore is a 5/7
  split (list/map) from 1024px; the school page is an 8/4 split with a sticky action card from 1024px.
- **Map:** Google Maps when a key is set, otherwise MapLibre GL JS on OpenFreeMap's light Positron style, with
  the same markers on both: coloured by band, home in ink, the route (Google) or a dashed straight line
  (MapLibre) in the accent. If neither can load, a drawn plot of the island keeps the same marker language.

## 4. Build

- Static app, no build step: `index.html`, ES modules in `js/`, styles in `css/`, the kit in `assets/`.
- `scripts/build_data.py` turns the database Markdown into `data/schools.json` (compact, one file).
- `js/logic.js` holds every rule above as pure functions, tested with `node --test`.
- `js/maps.js` wraps Google Maps (Places autocomplete, Distance Matrix, Directions) with fallbacks to OneMap
  search, straight-line distance and Google Maps links. `js/maplibre.js` is the open map (MapLibre GL JS,
  vendored); `js/mapview.js` picks between Google, MapLibre and the drawn plot.
- The Maps key goes in `config.js` or in the app's settings (kept in the browser only). Enable Maps
  JavaScript API, Places API (New), Directions API and Distance Matrix API, restricted to your domain.
