import { API_BASE, IS_NATIVE_APP, LIVE_SITE_ORIGIN } from "./apiBase";

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const GOOGLE_BASE = "https://www.googleapis.com/youtube/v3";

function localWeb() {
  return !IS_NATIVE_APP && typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
}

// Reuse the existing production endpoint when a loopback origin is not
// permitted by the browser key. No key/configuration or backend changes.
async function fetchCatalog(endpoint, params) {
  const query = new URLSearchParams(params);
  const proxyBase = localWeb() ? LIVE_SITE_ORIGIN : API_BASE;
  const proxyUrl = `${proxyBase}/api/youtube?endpoint=${endpoint}&${query}`;
  async function read(url) {
    const response = await fetch(url);
    if (!response.ok) {
      const error = new Error(`YouTube ${endpoint} failed (HTTP ${response.status})`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }
  if (import.meta.env.PROD || IS_NATIVE_APP || !API_KEY) return read(proxyUrl);
  query.set("key", API_KEY);
  try {
    return await read(`${GOOGLE_BASE}/${endpoint}?${query}`);
  } catch (error) {
    if (localWeb() && (!error.status || [401, 403].includes(error.status))) return read(proxyUrl);
    throw error;
  }
}

// Share overlapping Connect/Channels requests, including Strict Mode mounts.
// Retain only active requests: durable freshness belongs to the server cache.
const pending = new Map();
export function fetchYouTubeCatalog(endpoint, params) {
  const key = `${endpoint}:${new URLSearchParams(Object.entries(params).sort())}`;
  if (pending.has(key)) return pending.get(key);
  if (pending.size >= 64) return Promise.reject(new Error('Catalog busy; please try again later'));
  const job = fetchCatalog(endpoint, params).finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}
