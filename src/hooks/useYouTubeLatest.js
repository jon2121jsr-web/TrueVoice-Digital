// src/hooks/useYouTubeLatest.js
// Fetches the latest video from a YouTube channel OR playlist via YouTube Data API v3.
// Supports optional filterFn to skip unwanted videos (e.g. Shorts).
// Returns { videoId, title, thumbnail, loading, error }

import { useEffect, useState } from "react";

const API_KEY      = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE_URL     = "https://www.googleapis.com/youtube/v3";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const uploadsCache = {};
const resultCache  = {};

async function resolveUploadsPlaylistId(channelId) {
  if (uploadsCache[channelId]) return uploadsCache[channelId];
  const url  = `${BASE_URL}/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`channels API failed: ${res.status}`);
  const data = await res.json();
  const id   = data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!id) throw new Error(`No uploads playlist for channel: ${channelId}`);
  uploadsCache[channelId] = id;
  return id;
}

// Fetch up to maxResults items from a playlist, apply optional filterFn,
// return the first match.
async function fetchLatestFromPlaylist(playlistId, filterFn, maxResults = 10) {
  const url = `${BASE_URL}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}&key=${API_KEY}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`playlistItems API failed: ${res.status}`);
  const data  = await res.json();
  const items = data?.items || [];
  if (!items.length) throw new Error(`No items in playlist: ${playlistId}`);

  const match = filterFn
    ? items.find((item) => filterFn(item?.snippet))
    : items[0];

  const snippet = match?.snippet || items[0]?.snippet;
  if (!snippet) throw new Error(`No matching item in playlist: ${playlistId}`);

  const videoId   = snippet.resourceId?.videoId || null;
  const title     = snippet.title || null;
  const thumbnail =
    (videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null) ||
    snippet.thumbnails?.maxres?.url ||
    snippet.thumbnails?.high?.url   ||
    snippet.thumbnails?.medium?.url ||
    null;

  return { videoId, title, thumbnail };
}

export function useYouTubeLatest({ channelId, playlistId, filterFn } = {}) {
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

    const cached = resultCache[key];
    if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
      setState({ ...cached.data, loading: false, error: null });
      return;
    }

    if (!API_KEY) {
      setState(s => ({ ...s, loading: false, error: "VITE_YOUTUBE_API_KEY is not set" }));
      return;
    }

    let alive = true;

    async function fetch_() {
      try {
        let result;
        if (channelId) {
          const uploadsId = await resolveUploadsPlaylistId(channelId);
          result = await fetchLatestFromPlaylist(uploadsId, filterFn, 10);
        } else {
          result = await fetchLatestFromPlaylist(playlistId, filterFn, 10);
        }
        resultCache[key] = { data: result, cachedAt: Date.now() };
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
