# S1 Compass

A web app that helps a Primary 6 student and their family plan six Secondary 1 school choices from a PSLE
score. It compares the score with each school's 2024 and 2025 cut-offs, plans the trip from home with Google
Maps, matches programmes and CCAs to what the student enjoys, and checks the final list against the posting
rules.

The flow, UX and UI decisions are in [PLAN.md](PLAN.md).

## Run it

It is a static site with no build step. Serve the folder with any web server:

```bash
cd apps/s1-compass
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` from the file system does not work, because the app fetches `data/schools.json`.

## Google Maps

Without a key the app still works: OneMap (Singapore's public map service) finds the home address, distances
are straight-line, the map is a drawn plot of the island, and every route opens in Google Maps.

With a key it adds travel times by public transport or car (arriving by 7:15 on the next school day), the
route with each bus and train, and a street map.

1. In Google Cloud, turn on **Maps JavaScript API**, **Places API (New)**, **Directions API** and
   **Distance Matrix API**.
2. Create an API key and restrict it to your site's address (HTTP referrers) and to those four APIs.
3. Put it in `config.js` (`googleMapsApiKey`) for every visitor, or paste it in the app's map settings
   (kept in that browser only).
4. Optional: create a Map ID in Map Management and set `googleMapId`. `DEMO_MAP_ID` works for testing.

To keep costs down, travel times are fetched for the 60 nearest schools plus the shortlist
(`travelTimeSchools` in `config.js`) and are kept in memory only.

## Data

`data/schools.json` is built from the database in `data/source/`:

```bash
python3 scripts/build_data.py
```

The script reads the canonical JSON embedded in the Markdown (schema 1.1.0) and keeps what the app shows.
A missing value stays missing; it is never turned into zero.

## Tests

```bash
node --test tests/*.test.mjs
```

The tests cover the posting-group bands, the cut-off comparison (ties, Higher Chinese, vacancies, missing
years), affiliation, IP and SEC options, the plan checks and the school-morning time.

## Files

| Path | What it holds |
|---|---|
| `index.html` | The shell: nav, settings dialog, the kit's stylesheets and the dealt palette |
| `js/logic.js` | Every admission and comparison rule, as pure functions |
| `js/maps.js` | Google Maps (places, travel times, routes, the map) and its fallbacks |
| `js/plot.js` | The keyless map: schools drawn on an outline of the island |
| `js/app.js` | Data loading, shared state, router, nav and settings |
| `js/views/` | Start, setup (five steps), schools, school, my six, guide |
| `css/app.css` | App styles on top of the kit's tokens |
| `assets/` | taste-skill's `system.css` and motion layer, unchanged (MIT) |

## Limits

- Past cut-offs are not admission chances, and the app never shows one.
- Programme and CCA listings are a snapshot from MOE SchoolFinder (24 November 2026), not guaranteed places.
- Check every school and programme code on MOE SchoolFinder before submitting choices.
