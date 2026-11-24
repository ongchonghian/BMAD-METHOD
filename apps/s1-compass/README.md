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

To run it the way it runs when hosted, use the Node server (Node 20+, no packages): `npm start`, then open
http://localhost:8080. It serves only the app's files, compresses and caches them, and reads its settings from the
environment (below).

## Deploy on Railway

The app runs as one Railway service from this repository. `server.mjs` serves the site, and when a OneMap account
is set it also proxies OneMap at `/onemap` on the same address, so visitors get bus and train times without a
token.

1. In Railway, create a project, choose **Deploy from GitHub repo** and pick this repository.
2. In the service's **Settings**:
   - **Source:** set the branch to deploy, and set **Root Directory** to `/apps/s1-compass`.
   - **Config-as-code:** set **Railway Config File** to `/apps/s1-compass/railway.json`. The config file does not
     follow the root directory, so the full path is needed. It sets the start command, the `/healthz` health check,
     and watch paths so changes elsewhere in the repository do not redeploy the app.
3. In **Variables**, add any of these (all optional):

   | Variable | What it does |
   |---|---|
   | `ONEMAP_EMAIL`, `ONEMAP_PASSWORD` | Your free OneMap account. Turns on the proxy and bus and train times on the open map |
   | `GOOGLE_MAPS_API_KEY` | Google Maps for every visitor. Restrict the key to your domain in Google Cloud |
   | `GOOGLE_MAP_ID` | Your Map ID from Google Cloud (the default `DEMO_MAP_ID` is for testing only) |
   | `MAP_PROVIDER` | `auto` (default), `google` or `maplibre` |
   | `RATE_PER_MINUTE` | OneMap requests a minute per visitor (default 120) |

   They are written into `config.js` as it is served, so nothing secret goes into the repository. The OneMap
   password stays on the server.
4. In **Settings → Networking**, click **Generate Domain** for a `*.up.railway.app` address, or add your own
   domain. Railway provides HTTPS, which the location button and Copy the list need.
5. Each push to the chosen branch redeploys. Open `/healthz` to check the service is up.

With the Railway CLI instead: from `apps/s1-compass`, run `railway up` and set the variables with
`railway variable set KEY=value`.

## Maps

The app has two map providers, chosen in `config.js` (`mapProvider`) or by each visitor in the app's map
settings:

- **Open map (MapLibre).** [MapLibre GL JS](https://maplibre.org/projects/gl-js/) 6.17.0, vendored in
  `assets/vendor/maplibre-gl/`, draws OpenStreetMap data from [OpenFreeMap](https://openfreemap.org) with no key.
  OneMap (Singapore's public map service) finds the home address and, with OneMap routing set up (below), plans
  bus and train, car and walking routes: each leg is drawn in its line colour, the steps are listed, and the
  nearest schools get bus-and-train trip times. Without OneMap routing, distances are straight-line (the school
  page draws a dashed line). Every route also opens in Google Maps. Any MapLibre style URL can replace the
  default in `maplibreStyle`.
- **Google Maps.** Needs a key; see below.

`auto` (the default) uses Google Maps when a key is saved and the open map otherwise. Google's results (routes,
travel times, place search) are only ever shown with a Google map, as its terms require, so the open map never
mixes them in. If the open map's style cannot load (offline, blocked), the app draws a schematic plot of the
island instead.

## OneMap routing (open map)

OneMap's routing service needs a token, which lasts three days. Pick one way:

1. **Proxy (recommended for a public site).** On Railway or with `npm start`, set `ONEMAP_EMAIL` and
   `ONEMAP_PASSWORD` and the server proxies OneMap itself (see above). On a static host, run `scripts/onemap-proxy.mjs` (Node 18+, no packages) with your
   OneMap account in `ONEMAP_EMAIL` and `ONEMAP_PASSWORD` and your site in `ALLOW_ORIGIN`, then set `oneMapBase`
   in `config.js` to the proxy's address. The login stays on the server, the token renews itself, and the proxy
   answers the browser's CORS checks. It forwards only routing and address search.
2. **Token URL.** Set `oneMapTokenUrl` to an address of yours that returns `{ access_token, expiry_timestamp }`.
3. **A token per visitor.** Each visitor pastes a token in the app's map settings (kept in their browser), or a
   site owner pastes one in `oneMapToken`. Either expires after three days.

Requests follow OneMap's documented parameters (`routeType=pt`, `date` as MM-DD-YYYY, `time` as HH:MM:SS,
`mode=TRANSIT`); the answer is read as OpenTripPlanner itineraries. To arrive by the chosen time, the app asks
for trips leaving an hour earlier and asks again nearer the time if the best trip would arrive far too early.
Trip times are fetched for the 20 nearest schools plus the shortlist (`oneMapTravelSchools`).

## Google Maps

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

The tests cover OneMap answers and the proxy, the posting-group bands, the cut-off comparison (ties, Higher Chinese, vacancies, missing
years), affiliation, IP and SEC options, the plan checks and the school-morning time.

## Files

| Path | What it holds |
|---|---|
| `index.html` | The shell: nav, settings dialog, the kit's stylesheets and the palette |
| `js/logic.js` | Every admission and comparison rule, as pure functions |
| `js/maps.js` | Google Maps (places, travel times, routes, the map) and its fallbacks |
| `js/maplibre.js` | The open map: MapLibre GL JS with OpenFreeMap tiles |
| `js/onemap.js` | OneMap routing for the open map: requests, token, and parsing of the answer |
| `server.mjs` | The hosting server: the app's files, compression and caching, settings from the environment, the OneMap proxy at `/onemap` |
| `railway.json` | Railway build and deploy settings |
| `scripts/onemap-proxy.mjs` | A small proxy that keeps the OneMap login on the server |
| `js/plot.js` | The last-resort map: schools drawn on an outline of the island |
| `js/mapview.js` | Picks Google, the open map or the plot, all with one controller shape |
| `js/app.js` | Data loading, shared state, router, nav and settings |
| `js/sound.js` | The background music: starts on the first tap or key press, mute button in the nav, remembered in this browser |
| `js/views/` | Start, setup (five steps), schools, school, my six, guide |
| `css/app.css` | App styles on top of the kit's tokens |
| `assets/audio/` | "Watch Me Glow", the background music (MP3, 3 min 30 s, loops) |
| `assets/` | taste-skill's `system.css`, motion layer and the `liquid-type` and `marquee-row` moments (MIT); MapLibre GL JS in `vendor/` (BSD-3-Clause); all unchanged |
| `design/` | The brainstorming session behind the look: its memlog and HTML keepsake |

## Limits

- Past cut-offs are not admission chances, and the app never shows one.
- Programme and CCA listings are a snapshot from MOE SchoolFinder (24 November 2026), not guaranteed places.
- Check every school and programme code on MOE SchoolFinder before submitting choices.
