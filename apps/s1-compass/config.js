// Site settings. A Google Maps key set here is used by every visitor; a visitor can also add their own in
// the app's map settings (kept in their browser). Restrict the key to your site's address in Google Cloud.
window.S1_CONFIG = {
  googleMapsApiKey: '',
  // 'auto' (Google Maps when a key is set, else the open map), 'google' or 'maplibre'. Visitors can change it.
  mapProvider: 'auto',
  // The open map's style (MapLibre GL JS). OpenFreeMap needs no key; any MapLibre style URL works.
  maplibreStyle: 'https://tiles.openfreemap.org/styles/positron',
  // A Map ID from Google Cloud (Map Management) styles the map; DEMO_MAP_ID works for testing.
  googleMapId: 'DEMO_MAP_ID',
  // Travel times come from Google for this many nearest schools (plus your shortlist); the rest show distance.
  travelTimeSchools: 60,
};
