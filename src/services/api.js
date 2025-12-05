// src/services/api.js

// Base AzuraCast URL and station slug.
// These can be configured in Vercel / .env.* files.
// Fallbacks are your known good values.
const BASE_URL =
  import.meta.env.VITE_AZURACAST_BASE_URL ||
  "https://stream.truevoice.digital";

const STATION_SLUG =
  import.meta.env.VITE_AZURACAST_STATION_SLUG ||
  "truevoice_digital";

/**
 * Fetch now-playing data directly from AzuraCast and normalize it
 * into the shape NowPlayingPanel expects:
 *
 * {
 *   song: { title, artist, art },
 *   listeners,
 *   isLive,
 *   liveStreamer,
 *   history: [ { title, artist, art, played_at }, ... ],
 *   recent_tracks: same as history
 * }
 */
export async function fetchNowPlaying() {
  const url = `${BASE_URL}/api/nowplaying/${STATION_SLUG}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NowPlaying HTTP ${res.status} ${res.statusText}`);
  }

  const payload = await res.json();

  // Some AzuraCast installs return a single station object here,
  // others wrap it under `now_playing`. We normalize that.
  const hasNowPlayingObject = payload && payload.now_playing;
  const root = hasNowPlayingObject ? payload : { now_playing: payload };

  const np = root.now_playing || {};
  const song = np.song || {};

  // Normalize history array
  const historySource = Array.isArray(root.song_history)
    ? root.song_history
    : Array.isArray(root.recent_tracks)
    ? root.recent_tracks
    : [];

  const history = historySource.map((item) => {
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
    song: {
      title: song.title || "Unknown Title",
      artist: song.artist || "Unknown Artist",
      art: song.art || null,
    },
    listeners:
      root.listeners?.total ??
      root.listeners?.current ??
      root.listeners ??
      null,
    isLive: !!(root.live && root.live.is_live),
    liveStreamer: root.live?.streamer_name || null,
    history,
    recent_tracks: history,
  };
}
