import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';

export const MAX_BYTES = 1024 * 1024;
export const CATALOG_CHANNELS = [
  'UC_khbgasHiiwUxPHOMfbR0A', 'UCd1zk8GJorg7Yl9yaqsEhGA', 'UCWpVof-rd5hs1xpchwj1MAQ',
  'UCux-_Fze30tFuI_5CArwSmg', 'UCm_RMW_fQk-ELpPYUzor8lw', 'UCVFe7xhG6rl0ruoMQCJDtnw',
  'UCVfwlh9XpX2Y_tQfjeln9QA', 'UCKr-liguaGWMf3f94eQXsug',
];
export const freshSeconds = endpoint => endpoint === 'channels' ? 86400 : 1800;
export function canonicalKey(query) {
  const copy = { ...query };
  // Statistics responses retain requested ordering; do not sort/deduplicate IDs.
  return `yt:v1:${createHash('sha256').update(new URLSearchParams(Object.entries(copy).sort()).toString()).digest('hex')}`;
}
export function knownChannels(env) {
  const adminChannel = env.VITE_YOUTUBE_CHANNEL_ID?.trim();
  return [...new Set([...CATALOG_CHANNELS, ...[/^UC[\w-]{22}$/.test(adminChannel || '') ? adminChannel : null].filter(Boolean)])];
}
// Finite inventory: App's eight feeds, seven Channels feeds, and Connect's
// overlapping latest requests. Preserve exact Google response variants.
export function coreCacheQueries(env = {}) {
  const queries = CATALOG_CHANNELS.flatMap((id, index) => [
    { endpoint: 'channels', part: 'contentDetails', id },
    { endpoint: 'playlistItems', part: 'snippet', playlistId: `UU${id.slice(2)}`, maxResults: index === 0 ? '10' : '1' },
    ...(index === 2 ? [] : [{ endpoint: 'playlistItems', part: 'snippet', playlistId: `UU${id.slice(2)}`, maxResults: index === 0 ? '50' : '10' }]),
  ]);
  const admin = env.VITE_YOUTUBE_CHANNEL_ID?.trim();
  if (/^UC[\w-]{22}$/.test(admin || '')) queries.push(
    { endpoint: 'channels', part: 'contentDetails', id: admin },
    { endpoint: 'playlistItems', part: 'snippet', playlistId: `UU${admin.slice(2)}`, maxResults: '50' },
  );
  return [...new Map(queries.map(query => [canonicalKey(query), query])).values()];
}
export function validPayload(query, data) {
  if (!data || data.error || !Array.isArray(data.items) || data.items.length > 50 || Buffer.byteLength(JSON.stringify(data)) > MAX_BYTES) return false;
  if (query.endpoint === 'channels') return data.items.every(i => i.id === query.id && /^[\w-]{3,128}$/.test(i.contentDetails?.relatedPlaylists?.uploads || ''));
  if (query.endpoint === 'playlistItems') return data.items.length <= Number(query.maxResults) && data.items.every(i =>
    typeof i.snippet?.title === 'string' && /^[\w-]{11}$/.test(i.snippet?.resourceId?.videoId || '') &&
    (i.snippet.playlistId === undefined || i.snippet.playlistId === query.playlistId));
  return data.items.every(i => query.id.split(',').includes(i.id) && typeof i.snippet?.title === 'string' && i.statistics && typeof i.statistics === 'object');
}

// Google resets at midnight America/Los_Angeles, including DST changes.
export function nextQuotaReset(now = Date.now()) {
  const parts = date => Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(date)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  const p = parts(now), midnight = Date.UTC(p.year, p.month - 1, p.day + 1);
  let result = midnight + 8 * 3600000;
  for (let i = 0; i < 3; i++) {
    const q = parts(result);
    const offset = Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute, q.second) - result;
    result = midnight - offset;
  }
  return result;
}

export function createCatalogStore(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) throw new Error('Cache unavailable');
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(4000) }) },
  });
  async function rpc(action, args = {}) {
    const { data, error } = await db.rpc('youtube_catalog_cache_v1', { p_action: action, ...args });
    if (error) throw new Error('Cache unavailable');
    return data;
  }
  const coreKeys = new Set(coreCacheQueries(env).map(canonicalKey));
  return {
    claim: (key, query, owner) => rpc('claim', { p_key: key, p_query: query, p_owner: owner, p_core: coreKeys.has(key) }),
    finish: (key, owner, payload, ttl) => rpc('finish', { p_key: key, p_owner: owner, p_payload: payload, p_ttl: ttl }),
    fail: (key, owner, until, quota) => rpc('fail', { p_key: key, p_owner: owner, p_until: new Date(until).toISOString(), p_quota: quota }),
    async authorized(query, channels) {
      if (query.endpoint === 'channels') return channels.includes(query.id);
      if (query.endpoint === 'playlistItems' && channels.some(c => query.playlistId === `UU${c.slice(2)}`)) return true;
      // Also permit actual uploads mappings returned by Google, and statistics
      // only for video IDs already present in a known channel's cached playlist.
      return rpc('authorize', { p_query: query, p_channels: channels });
    },
  };
}

export function createCatalogService({ store, fetcher = (...args) => fetch(...args), now = Date.now, monotonicNow = () => performance.now(), env = {} }) {
  const coreKeys = new Set(coreCacheQueries(env).map(canonicalKey));
  const corePending = new Map(), optionalPending = new Map();
  async function load(query, apiKey) {
    const key = canonicalKey(query);
    const core = coreKeys.has(key), inFlight = core ? corePending : optionalPending;
    if (inFlight.has(key)) return inFlight.get(key);
    // Limit retained promises as well as database rows.
    if (inFlight.size >= (core ? 26 : 6)) return { status: 503, error: 'Catalog busy', retry: 5 };
    const job = refresh(key, query, apiKey);
    inFlight.set(key, job);
    try { return await job; } finally { inFlight.delete(key); }
  }
  async function refresh(key, query, apiKey) {
    const owner = randomUUID();
    const claimStarted = monotonicNow();
    const entry = await store.claim(key, query, owner);
    const saved = entry.payload && validPayload(query, entry.payload) ? entry.payload : null;
    // Subtract the full claim round-trip conservatively; client wall-clock skew
    // and clock adjustments must never extend the DB-authorized stale lifetime.
    const lifetime = Number(entry.stale_remaining_ms);
    const staleDeadline = Number.isFinite(lifetime) && lifetime > 0 ? claimStarted + lifetime : -Infinity;
    const unavailable = { status: 503, error: 'Catalog temporarily unavailable', retry: entry.retry || 5 };
    const cached = (state, fallback = unavailable) => saved && monotonicNow() < staleDeadline
      ? { status: 200, data: saved, state, validUntil: staleDeadline } : fallback;
    if (entry.fresh && saved) return cached('fresh');
    if (!entry.acquired) return cached('stale');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let reader;
    try {
      const { endpoint, ...params } = query;
      const response = await fetcher(`https://www.googleapis.com/youtube/v3/${endpoint}?${new URLSearchParams({ ...params, key: apiKey })}`, {
        headers: { Referer: 'https://www.truevoice.digital/' }, signal: controller.signal, redirect: 'error',
      });
      if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Response limit');
      reader = response.body.getReader();
      const chunks = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) throw new Error('Response limit');
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const text = new TextDecoder().decode(bytes);
      if (!response.ok) {
        let quota = false;
        try { quota = response.status === 403 && JSON.parse(text).error?.errors?.some(e => ['quotaExceeded', 'dailyLimitExceeded'].includes(e.reason)); } catch { /* No raw upstream error disclosure. */ }
        const until = quota ? nextQuotaReset(now()) : now() + 60000;
        await store.fail(key, owner, until, Boolean(quota));
        return cached('stale', { status: response.status, error: 'YouTube catalog request failed', retry: Math.max(1, Math.ceil((until - now()) / 1000)) });
      }
      const data = JSON.parse(text);
      if (!validPayload(query, data)) throw new Error('Invalid catalog');
      const committed = await store.finish(key, owner, data, freshSeconds(query.endpoint));
      // A late lease holder must not publish or overwrite newer cache state.
      if (!committed) return cached('stale', { status: 503, error: 'Catalog refresh superseded', retry: 5 });
      return { status: 200, data, state: 'refreshed' };
    } catch {
      const timedOut = controller.signal.aborted;
      await store.fail(key, owner, now() + 60000, false);
      return cached('stale', { status: timedOut ? 504 : 502, error: timedOut ? 'Catalog request timed out' : 'Catalog unavailable', retry: 60 });
    } finally {
      clearTimeout(timer); controller.abort();
      try { await reader?.cancel(); } catch { /* Release the bounded reader. */ }
      reader?.releaseLock();
    }
  }
  return { load };
}
