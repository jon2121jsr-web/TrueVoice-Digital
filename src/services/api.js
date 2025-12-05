// src/services/api.js

// ------- AZURACAST NOW-PLAYING -------

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
  // others wrap it under `now_playing`. Normalize it.
  const root = payload && payload.now_playing ? payload : { now_playing: payload };

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

// ------- VERSE OF THE DAY -------

/**
 * Fetch a verse of the day.
 * If the external API fails for any reason, we fall back to a static verse.
 *
 * Shape expected by VerseOfTheDay.jsx (based on our earlier wiring):
 * {
 *   reference: "Psalm 27:13 (NIV)",
 *   text: "I remain confident of this: ...",
 *   translation: "NIV"
 * }
 */
export async function fetchVerseOfTheDay() {
  try {
    // Example free verse-of-the-day API.
    // If this ever fails (CORS / network), we catch and return a static verse.
    const res = await fetch("https://beta.ourmanna.com/api/v1/get/?format=json");
    if (!res.ok) {
      throw new Error(`Verse API HTTP ${res.status}`);
    }

    const json = await res.json();
    const item = json?.verse?.details || json?.verse?.details || json?.verse || {};

    const text =
      item.text ||
      "I remain confident of this: I will see the goodness of the Lord in the land of the living.";
    const reference = item.reference || "Psalm 27:13 (NIV)";
    const translation = item.translation || "NIV";

    return { text, reference, translation };
  } catch (err) {
    console.error("fetchVerseOfTheDay failed, using fallback:", err);
    // Fallback static verse so the UI always has something meaningful
    return {
      text:
        "I remain confident of this: I will see the goodness of the Lord in the land of the living.",
      reference: "Psalm 27:13 (NIV)",
      translation: "NIV",
    };
  }
}
