// src/services/azuracast.js

const BASE_URL = import.meta.env.VITE_AZURACAST_BASE_URL;
const STATION_SLUG = import.meta.env.VITE_AZURACAST_STATION_SLUG;

if (!BASE_URL || !STATION_SLUG) {
  console.warn(
    "[AzuraCast] VITE_AZURACAST_BASE_URL or VITE_AZURACAST_STATION_SLUG is not set. " +
      "fetchRawNowPlaying / fetchNowPlaying will throw until these are configured."
  );
}

/**
 * Internal helper: fetch the raw AzuraCast now-playing payload
 * for the configured station.
 */
async function fetchAzuraRawNowPlaying() {
  if (!BASE_URL || !STATION_SLUG) {
    throw new Error(
      "AzuraCast env vars are missing (BASE_URL or STATION_SLUG)."
    );
  }

  const url = `${BASE_URL}/api/nowplaying/${STATION_SLUG}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`AzuraCast API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Expose the raw AzuraCast payload (for debugging / tooling).
 */
export async function fetchRawNowPlaying() {
  return fetchAzuraRawNowPlaying();
}

/**
 * Normalize a raw AzuraCast payload into the shape
 * our UI expects.
 */
function normalizeNowPlaying(raw) {
  // /api/nowplaying/{station} usually returns a single object with:
  // { now_playing, live, listeners, playing_next, song_history, ... }
  const nowPlaying = raw.now_playing || raw;

  const song = nowPlaying.song || {};

  // Normalize history
  const historyRaw = Array.isArray(raw.song_history)
    ? raw.song_history
    : Array.isArray(raw.recent_tracks)
    ? raw.recent_tracks
    : [];

  const history = historyRaw.map((item) => {
    const s = item.song || item;
    return {
      id: item.id || item.song_id || undefined,
      title: s.title || item.title || "Unknown title",
      artist: s.artist || item.artist || "",
      art: s.art || item.art || null,
      played_at: item.played_at || item.timestamp || null,
    };
  });

  return {
    // What NowPlayingPanel expects:
    song: {
      title: song.title || "Unknown Title",
      artist: song.artist || "Unknown Artist",
      art: song.art || null,
    },
    listeners:
      raw.listeners?.total ??
      raw.listeners?.current ??
      raw.listeners ??
      null,
    isLive: !!(raw.live && raw.live.is_live),
    liveStreamer: raw.live?.streamer_name || null,
    history,
    recent_tracks: history,
  };
}

/**
 * BACK-COMPAT:
 * Fetch now-playing data from AzuraCast and normalize
 * into the shape NowPlayingPanel expects.
 *
 * This keeps the same behavior you had before.
 */
export async function fetchNowPlaying() {
  const raw = await fetchAzuraRawNowPlaying();
  return normalizeNowPlaying(raw);
}

/**
 * Alias for clarity in new code – same as fetchNowPlaying(),
 * but named to emphasize that the data is normalized.
 */
export async function fetchNormalizedNowPlaying() {
  return fetchNowPlaying();
}
