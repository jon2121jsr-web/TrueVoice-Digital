// src/hooks/useYouTubeLatest.js
// Fetches the latest video from a YouTube channel OR playlist via YouTube Data API v3.
// Quota-efficient strategy:
//   - Channel lookup:  channels endpoint (1 unit) → resolves uploads playlist ID,
//                      then playlistItems endpoint (1 unit) → ~2 units total
//   - Playlist lookup: playlistItems endpoint (1 unit) directly
// Returns { videoId, title, thumbnail, loading, error }

import { useEffect, useState } from "react";

const API_KEY      = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE_URL     = "https://www.googleapis.com/youtube/v3";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// uploadsCache — channelId → uploadsPlaylistId
// Permanent: upload playlist IDs are stable and never change.
const uploadsCache = {};

// resultCache — channelId|playlistId → { data: { videoId, title, thumbnail }, cachedAt }
// TTL-based: expires after CACHE_TTL_MS so fresh uploads are picked up.
const resultCache = {};

async function resolveUploadsPlaylistId(channelId) {
  if (uploadsCache[channelId]) {
    return uploadsCache[channelId];
  }

  const url = `${BASE_URL}/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`channels API failed: ${res.status}`);

  const data      = await res.json();
  const uploadsId = data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error(`No uploads playlist found for channel: ${channelId}`);

  uploadsCache[channelId] = uploadsId;
  return uploadsId;
}

async function fetchLatestFromPlaylist(playlistId) {
  const url = `${BASE_URL}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=1&key=${API_KEY}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`playlistItems API failed: ${res.status}`);

  const data    = await res.json();
  const snippet = data?.items?.[0]?.snippet;
  if (!snippet) throw new Error(`No items in playlist: ${playlistId}`);

  const videoId   = snippet.resourceId?.videoId || null;
  const title     = snippet.title || null;
  const thumbnail =
    (videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null) ||
    snippet.thumbnails?.maxres?.url  ||
    snippet.thumbnails?.high?.url    ||
    snippet.thumbnails?.medium?.url  ||
    null;

  return { videoId, title, thumbnail };
}

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
          const uploadsPlaylistId = await resolveUploadsPlaylistId(channelId);
          result = await fetchLatestFromPlaylist(uploadsPlaylistId);
        } else {
          result = await fetchLatestFromPlaylist(playlistId);
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
