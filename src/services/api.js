// src/services/api.js

const AZURACAST_BASE = import.meta.env.VITE_AZURACAST_BASE_URL;
const AZURACAST_STATION = import.meta.env.VITE_AZURACAST_STATION_SLUG;

// Simple RSS → JSON gateway (public; okay for now, you can swap later)
const RSS_TO_JSON = "https://api.rss2json.com/v1/api.json";

const PODCAST_FEEDS = [
  import.meta.env.VITE_PODCAST_FEED_MAIN,
  import.meta.env.VITE_PODCAST_FEED_ALT,
].filter(Boolean);

// ---- AzuraCast: Now Playing + history ----
export async function fetchNowPlaying() {
  if (!AZURACAST_BASE || !AZURACAST_STATION) {
    throw new Error("AzuraCast env vars are not set.");
  }

  const url = `${AZURACAST_BASE}/api/nowplaying/${AZURACAST_STATION}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`AzuraCast API error: ${res.status}`);
  }

  const json = await res.json();

  const song = json.now_playing?.song ?? json.now_playing ?? json.playing_next?.song;

  const historyRaw = json.song_history ?? [];
  const history = historyRaw.map((entry) => {
    const s = entry.song || {};
    return {
      id: entry.sh_id ?? entry.id ?? `${entry.played_at}`,
      title: s.title ?? "Unknown Title",
      artist: s.artist ?? "Unknown Artist",
      art: s.art ?? null,
      playedAt: entry.played_at ? new Date(entry.played_at * 1000) : null,
    };
  });

  return {
    stationName: json.station?.name ?? "TrueVoice Digital",
    listeners: json.listeners?.total ?? null,
    isLive: Boolean(json.live?.is_live),
    liveStreamer: json.live?.streamer_name ?? null,
    song: song
      ? {
          title: song.title ?? "Unknown Title",
          artist: song.artist ?? "Unknown Artist",
          album: song.album ?? undefined,
          art: song.art ?? json.station?.favicon ?? undefined,
        }
      : null,
    history,
    lastUpdated: new Date(),
  };
}

// ---- Verse of the Day ----
export async function fetchVerseOfTheDay() {
  const url = "https://beta.ourmanna.com/api/v1/get/?format=json&order=daily";
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Verse API error: ${res.status}`);
  }

  const json = await res.json();
  const item = json?.verse?.details;

  return {
    reference: item?.reference ?? "John 3:16",
    text: item?.text ?? "For God so loved the world...",
    version: item?.version ?? "NIV",
  };
}

// ---- Podcast Episodes via RSS ----
export async function fetchPodcastEpisodes(limitPerFeed = 5) {
  if (!PODCAST_FEEDS.length) {
    // No feeds configured yet
    return [];
  }

  const allEpisodes = [];

  for (const feed of PODCAST_FEEDS) {
    const url = `${RSS_TO_JSON}?rss_url=${encodeURIComponent(feed)}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn("RSS fetch failed:", feed, res.status);
      continue;
    }

    const json = await res.json();
    const items = (json.items ?? []).slice(0, limitPerFeed);

    for (const item of items) {
      allEpisodes.push({
        id: item.guid ?? item.link ?? `${feed}-${item.pubDate}`,
        title: item.title,
        link: item.link,
        publishedAt: item.pubDate,
        description: item.description ?? "",
        image: item.enclosure?.link ?? json.feed?.image,
      });
    }
  }

  allEpisodes.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return allEpisodes;
}
