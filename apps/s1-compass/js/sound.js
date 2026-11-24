// Background music: "Watch Me Glow", looping. Browsers allow sound only after the visitor touches the page, so it
// starts on the first tap, click or key press anywhere, unless muted. The mute choice is kept in this browser.
import { html, icon } from './ui.js';

const KEY = 's1compass.muted';
const VOLUME = 0.35;
let audio = null;
let muted = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();
let started = false;

function play() {
  if (muted || !audio) return;
  audio.volume = 0;
  audio.play().then(() => {
    started = true;
    const t0 = performance.now();
    const fade = now => { audio.volume = Math.min(VOLUME, VOLUME * (now - t0) / 1200); if (audio.volume < VOLUME && !audio.paused) requestAnimationFrame(fade); };
    requestAnimationFrame(fade);
  }).catch(() => { /* still blocked: the next tap tries again */ });
}

function sync() {
  for (const b of document.querySelectorAll('[data-sound]')) {
    b.setAttribute('aria-pressed', String(muted));
    b.setAttribute('aria-label', muted ? 'Play the music' : 'Mute the music');
    b.title = muted ? 'Play the music' : 'Mute the music';
    b.innerHTML = String(icon(muted ? 'soundOff' : 'sound'));
  }
}

/** The nav button; render it anywhere, sync() keeps every copy right. */
export function button() {
  return html`<button class="icon-btn sound-btn" type="button" data-sound aria-pressed="${String(muted)}" aria-label="${muted ? 'Play the music' : 'Mute the music'}" title="${muted ? 'Play the music' : 'Mute the music'}">${icon(muted ? 'soundOff' : 'sound')}</button>`;
}

export function init() {
  audio = new Audio('assets/audio/watch-me-glow.mp3');
  audio.loop = true;
  audio.preload = 'none';
  const first = e => {
    if (e.target.closest?.('[data-sound]')) return; // the button decides for itself
    if (!started) play();
  };
  document.addEventListener('click', first, true);
  document.addEventListener('keydown', first, true);
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-sound]')) return;
    muted = !muted;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* kept for this visit only */ }
    if (muted) audio.pause(); else play();
    sync();
  });
  // quiet while the tab is in the background
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause(); else if (started && !muted) play();
  });
}
