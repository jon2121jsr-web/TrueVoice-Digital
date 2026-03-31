/**
 * TrueVoice Analytics Tracker
 * Lightweight custom event tracker — no third-party dependencies.
 * Drop into main.jsx: import './lib/analytics.js'
 *
 * Sends events to your own /api/analytics endpoint (see api/analytics.js).
 * Captures: page views, stream plays, video plays, donation clicks.
 */

const ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT || '/api/analytics';
const SITE_ID  = import.meta.env.VITE_ANALYTICS_SITE_ID  || 'truevoice';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSessionId() {
  let sid = sessionStorage.getItem('tv_sid');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('tv_sid', sid);
  }
  return sid;
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

  // Use sendBeacon so events fire even on page unload
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, blob);
  } else {
    fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(payload), keepalive: true })
      .catch(() => {}); // silent fail — analytics should never break the app
  }
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

patchHistory();
trackPageView(); // fire once on load
