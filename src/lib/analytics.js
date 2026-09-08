/**
 * TrueVoice Analytics Tracker
 * Lightweight custom event tracker — no third-party dependencies.
 * Drop into main.jsx: import './lib/analytics.js'
 *
 * Sends events to your own /api/analytics endpoint (see api/analytics.js).
 * Captures: page views, stream plays, video plays, donation clicks.
 */

const ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT || '/api/analytics';
const SITE_ID  = (import.meta.env.VITE_ANALYTICS_SITE_ID || 'truevoice').trim();

// ─── Helpers ────────────────────────────────────────────────────────────────

// crypto.randomUUID() only exists in a "secure context" (HTTPS, or
// localhost) -- it's undefined on a plain-HTTP LAN address, which is
// exactly how phone testing reaches the dev server. Fall back to a
// simple random id there instead of throwing, and never let a storage
// or crypto failure here take down the rest of the app.
function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

function getSessionId() {
  try {
    let sid = sessionStorage.getItem('tv_sid');
    if (!sid) {
      sid = makeId();
      sessionStorage.setItem('tv_sid', sid);
    }
    return sid;
  } catch {
    return makeId();
  }
}

function send(eventName, props = {}) {
  const payload = {
    site:      SITE_ID,
    event:     eventName,
    url:       location.href,
    path:      location.pathname,
    referrer:  document.referrer || null,
    session:   getSessionId(),
    ts:        Date.now(),
    ...props,
  };

  fetch(ENDPOINT, {
    method:    'POST',
    headers:   { 'Content-Type': 'application/json' },
    body:      JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

// ─── Page view tracking ──────────────────────────────────────────────────────

let _lastPath = null;

function trackPageView() {
  const path = location.pathname;
  if (path === _lastPath) return;
  _lastPath = path;
  send('pageview', { title: document.title });
}

// Hook into React Router navigation via History API patching
function patchHistory() {
  const wrap = (fn) => function (...args) {
    const result = fn.apply(this, args);
    trackPageView();
    return result;
  };
  history.pushState    = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
  window.addEventListener('popstate', trackPageView);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Track a stream listen start.
 * Call this from your useStream hook or NowPlaying component.
 * @param {string} showName - e.g. "The Deep End"
 */
export function trackStreamPlay(showName) {
  send('stream_play', { show: showName });
}

/**
 * Track a video play.
 * Call this from your YouTube/video components.
 * @param {string} videoId  - YouTube video ID
 * @param {string} showName - e.g. "Ryan Kliesch"
 */
export function trackVideoPlay(videoId, showName) {
  send('video_play', { video_id: videoId, show: showName });
}

/**
 * Track a donation button click (pre-Stripe redirect).
 * @param {number} amount  - suggested amount, or 0 if custom
 */
export function trackDonationClick(amount = 0) {
  send('donation_click', { amount });
}

/**
 * Track any custom event.
 * @param {string} name  - event name, snake_case
 * @param {object} props - arbitrary key/value pairs
 */
export function trackEvent(name, props = {}) {
  send(name, props);
}

// ─── Auto-init ───────────────────────────────────────────────────────────────
// Wrapped defensively: this file is imported for side effects at module
// load time, before React ever mounts. Any uncaught error here (as
// getSessionId's old crypto.randomUUID call was) kills the whole module
// graph and renders nothing -- analytics should never be able to do that.

try {
  patchHistory();
  trackPageView(); // fire once on load
} catch (err) {
  console.warn('[analytics] init failed, continuing without it', err);
}
