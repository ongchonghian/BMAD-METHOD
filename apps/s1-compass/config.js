// Site settings. A Google Maps key set here is used by every visitor; a visitor can also add their own in
// the app's map settings (kept in their browser). Restrict the key to your site's address in Google Cloud.
window.S1_CONFIG = {
  googleMapsApiKey: '',
  // 'auto' (Google Maps when a key is set, else the open map), 'google' or 'maplibre'. Visitors can change it.
  mapProvider: 'auto',
  // The open map's style (MapLibre GL JS). OpenFreeMap needs no key; any MapLibre style URL works.
  maplibreStyle: 'https://tiles.openfreemap.org/styles/positron',
  // OneMap routing for bus and train trips on the open map. Use ONE of:
  //   oneMapBase: the address of your own proxy (scripts/onemap-proxy.mjs), which keeps the login on the server;
  //   oneMapTokenUrl: an address of yours that returns { access_token, expiry_timestamp };
  //   oneMapToken: a token pasted here (it expires after three days).
  // Visitors can also paste their own token in the app's map settings.
  oneMapBase: '',
  oneMapTokenUrl: '',
  oneMapToken: '',
  // OneMap trip times are fetched for this many nearest schools (plus the shortlist).
  oneMapTravelSchools: 20,
  // A Map ID from Google Cloud (Map Management) styles the map; DEMO_MAP_ID works for testing.
  googleMapId: 'DEMO_MAP_ID',
  // Travel times come from Google for this many nearest schools (plus your shortlist); the rest show distance.
  travelTimeSchools: 60,
};
