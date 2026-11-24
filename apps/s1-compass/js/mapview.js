// Opens the best map available: Google Maps when it is in use, else the open MapLibre map, else the drawn plot.
// Every controller has the same shape (setHome, setSchools, select, fit, showLine, showRoute, clearRoute, destroy).

import * as maps from './maps.js';
import { createMapLibre } from './maplibre.js';
import { createPlot } from './plot.js';

/** 'google' or 'open': which kind of map the current settings ask for. */
export function wantedKind() {
  const s = maps.mapsStatus();
  return s === 'none' || s === 'failed' ? 'open' : 'google';
}

export async function openMap(el, opts = {}) {
  if (wantedKind() === 'google') {
    try { return await maps.createMap(el, opts); } catch (e) { console.warn('Google map failed; trying the open map', e); }
  }
  try {
    return await createMapLibre(el, opts);
  } catch (e) {
    console.warn('Open map unavailable; drawing the schematic map', e);
  }
  return createPlot(el, opts);
}

/** Whether a controller matches what the settings now ask for (the plot counts as the open map). */
export function matches(ctrl) {
  if (!ctrl) return false;
  return wantedKind() === 'google' ? ctrl.kind === 'google' : ctrl.kind !== 'google';
}
