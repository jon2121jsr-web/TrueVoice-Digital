// src/hooks/useYouTubeLatest.js
// Fetches the latest video from a YouTube channel OR playlist RSS feed.
// No API key required.
// Returns { videoId, title, thumbnail, loading, error }

import { useEffect, useState } from "react";

const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";

function channelRssUrl(channelId) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

function playlistRssUrl(playlistId) {
  return `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
}

function extractVideoId(link) {
  try {
    const url = new URL(link);
    return url.searchParams.get("v") || null;
  } catch {
    return null;
  }
}

const cache = {};

export function useYouTubeLatest({ channelId, playlistId } = {}) {
  const key = channelId || playlistId;

  const [state, setState] = useState({
    videoId:   null,
    title:     null,
    thumbnail: null,
    loading:   true,
    error:     null,
  });

  useEffect(() => {
    if (!key) {
      setState(s => ({ ...s, loading: false }));
      return;
    }

    if (cache[key]) {
      setState({ ...cache[key], loading: false, error: null });
      return;
    }

    let alive = true;

    async function fetch_() {
      try {
        const rssUrl = playlistId
          ? playlistRssUrl(playlistId)
          : channelRssUrl(channelId);

        const apiUrl = `${RSS2JSON}${encodeURIComponent(rssUrl)}&count=1`;
        const res    = await fetch(apiUrl);
        if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);

        const data = await res.json();
        const item = data?.items?.[0];
        if (!item) throw new Error("No items in RSS feed");

        const videoId   = extractVideoId(item.link)
          || item.guid?.split("video:")[1]
          || null;
        const title     = item.title || null;
        const thumbnail = item.thumbnail
          || item.enclosure?.link
          || (videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null);

        const result = { videoId, title, thumbnail };
        cache[key] = result;

        if (alive) setState({ ...result, loading: false, error: null });
      } catch (err) {
        if (alive) setState(s => ({ ...s, loading: false, error: err.message }));
      }
    }

    fetch_();
    return () => { alive = false; };
  }, [key]);

  return state;
}