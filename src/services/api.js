// src/services/api.js

// ------- AZURACAST NOW-PLAYING -------

const BASE_URL =
  import.meta.env.VITE_AZURACAST_BASE_URL || "https://stream.truevoice.digital";

const STATION_SLUG =
  import.meta.env.VITE_AZURACAST_STATION_SLUG || "truevoice_digital";

// ------- LIVE365 LISTENER COUNT -------
// Live365 station CALLSIGN — visible in the dashboard sidebar as "a61535"
// (NOT the numeric ID 37793 — that returns 404)
const LIVE365_CALLSIGN =
  import.meta.env.VITE_LIVE365_CALLSIGN || "a61535";

async function fetchLive365Listeners() {
  try {
    const url = `https://api.live365.com/station/${LIVE365_CALLSIGN}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;

    const data = await res.json();

    const count =
      data?.listeners_count          ??
      data?.data?.listeners_count    ??
      data?.station?.listeners_count ??
      data?.current_listeners        ??
      data?.data?.current_listeners  ??
      null;

    return count != null ? Number(count) : null;
  } catch {
    return null;
  }
}

export async function fetchNowPlaying() {
  const url = `${BASE_URL}/api/nowplaying/${STATION_SLUG}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NowPlaying HTTP ${res.status} ${res.statusText}`);
  }

  const payload = await res.json();

  const root = Array.isArray(payload)
    ? payload[0]
    : payload?.now_playing
    ? payload
    : { now_playing: payload };

  const np   = root.now_playing || {};
  const song = np.song          || {};

  const played_at = Number(np.played_at ?? 0) || 0;
  const duration  = Number(np.duration  ?? 0) || 0;
  const elapsed   = Number(np.elapsed   ?? 0) || 0;
  const remaining = Number(np.remaining ?? 0) || 0;

  const rawNext = root.playing_next || null;

  const [live365Count, rawAzuraListeners] = await Promise.all([
    fetchLive365Listeners(),
    Promise.resolve(root.listeners ?? null),
  ]);

  let mountTotal = 0;
  for (const m of (root.station?.mounts ?? [])) {
    mountTotal += Number(m.listeners?.current ?? 0);
  }

  const bestCount =
    live365Count ??
    (mountTotal > 0 ? mountTotal : null) ??
    (typeof rawAzuraListeners === "object"
      ? (rawAzuraListeners?.current ?? rawAzuraListeners?.total ?? 0)
      : Number(rawAzuraListeners ?? 0));

  const listenersObj = {
    current:     Number.isFinite(bestCount) ? bestCount : 0,
    total:       Number(rawAzuraListeners?.total  ?? bestCount ?? 0),
    unique:      Number(rawAzuraListeners?.unique ?? 0),
    _live365:    live365Count,
    _mountTotal: mountTotal,
  };

  const historySource = Array.isArray(root.song_history)
    ? root.song_history
    : Array.isArray(root.recent_tracks)
    ? root.recent_tracks
    : [];

  const song_history = historySource.map((item) => {
    const s = item.song || item;
    return {
      sh_id:     item.sh_id     || item.id   || undefined,
      played_at: item.played_at || item.timestamp || 0,
      duration:  Number(item.duration ?? 0)  || 0,
      playlist:  item.playlist  || "",
      song: {
        id:     s.id     || null,
        title:  s.title  || item.title  || "Unknown title",
        artist: s.artist || item.artist || "",
        album:  s.album  || item.album  || "",
        art:    s.art    || item.art    || null,
      },
    };
  });

  return {
    now_playing: {
      sh_id:    np.sh_id   || null,
      song: {
        id:     song.id     || null,
        title:  song.title  || "Unknown Title",
        artist: song.artist || "Unknown Artist",
        album:  song.album  || "TrueVoice Digital",
        art:    song.art    || null,
      },
      played_at,
      duration,
      elapsed,
      remaining,
      playlist:  np.playlist || null,
      streamer:  np.streamer || "",
    },
    playing_next: rawNext
      ? {
          cued_at:   Number(rawNext.cued_at   ?? 0) || 0,
          played_at: Number(rawNext.played_at ?? 0) || 0,
          duration:  Number(rawNext.duration  ?? 0) || 0,
          playlist:  rawNext.playlist || null,
          song: rawNext.song
            ? {
                id:     rawNext.song.id     || null,
                title:  rawNext.song.title  || "Unknown Title",
                artist: rawNext.song.artist || "",
                album:  rawNext.song.album  || "",
                art:    rawNext.song.art    || null,
              }
            : null,
        }
      : null,
    listeners:  listenersObj,
    live:       root.live    || { is_live: false, streamer_name: "" },
    song_history,
    is_online:  root.is_online ?? true,
  };
}

// ------- VERSE OF THE DAY -------

export async function fetchVerseOfTheDay() {
  try {
    const res = await fetch("https://beta.ourmanna.com/api/v1/get/?format=json");
    if (!res.ok) throw new Error(`Verse API HTTP ${res.status}`);

    const json = await res.json();
    const item = json?.verse?.details || json?.verse || {};

    return {
      text:        item.text        || "I remain confident of this: I will see the goodness of the Lord in the land of the living.",
      reference:   item.reference   || "Psalm 27:13 (NIV)",
      translation: item.translation || "NIV",
    };
  } catch (err) {
    console.error("fetchVerseOfTheDay failed:", err);
    return {
      text:        "I remain confident of this: I will see the goodness of the Lord in the land of the living.",
      reference:   "Psalm 27:13 (NIV)",
      translation: "NIV",
    };
  }
}