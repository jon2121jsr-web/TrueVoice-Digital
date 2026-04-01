// src/hooks/useYouTubeFeed.js
// Fetches an array of videos from a YouTube channel or playlist.
// filterFn receives the video title string — define at module level (not inline
// in a component) so its reference stays stable across renders.
// Returns { videos: Array<{id, youtubeId, title, thumbnailUrl, embedUrl, videoUrl}>, loading, error }
// Raw API results are cached for 5 minutes per channel/playlist+maxResults pair.

import { useEffect, useState } from "react";

const API_KEY      = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE_URL     = "https://www.googleapis.com/youtube/v3";
const CACHE_TTL_MS = 5 * 60 * 1000;

const uploadsCache = {};  // channelId  → uploadsPlaylistId
const rawCache     = {};  // cacheKey   → { videos, at }

async function resolveUploadsPlaylistId(channelId) {
  if (uploadsCache[channelId]) return uploadsCache[channelId];
  const res  = await fetch(`${BASE_URL}/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`);
  if (!res.ok) throw new Error(`channels API ${res.status}`);
  const data = await res.json();
  const id   = data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!id) throw new Error(`No uploads playlist for ${channelId}`);
  uploadsCache[channelId] = id;
  return id;
}

async function fetchRawVideos(playlistId, maxResults) {
  const url = `${BASE_URL}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}&key=${API_KEY}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`playlistItems API ${res.status}`);
  const data = await res.json();
  return (data?.items || []).map((item) => {
    const s         = item.snippet;
    const youtubeId = s?.resourceId?.videoId;
    if (!youtubeId) return null;
    return {
      id:           youtubeId,
      youtubeId,
      title:        s.title || "",
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
      embedUrl:     `https://www.youtube.com/embed/${youtubeId}?autoplay=1`,
      videoUrl:     `https://www.youtube.com/watch?v=${youtubeId}`,
      speaker:      null,
      source:       null,
    };
  }).filter(Boolean);
}

export function useYouTubeFeed({ channelId, playlistId, maxResults = 10, filterFn } = {}) {
  const cacheKey = (channelId || playlistId || "") + "_" + maxResults;
  const [state, setState] = useState({ videos: [], loading: true, error: null });

  useEffect(() => {
    const sourceId = channelId || playlistId;
    if (!sourceId) { setState(s => ({ ...s, loading: false })); return; }
    if (!API_KEY)  { setState(s => ({ ...s, loading: false, error: "VITE_YOUTUBE_API_KEY not set" })); return; }

    const cached = rawCache[cacheKey];
    if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
      const videos = filterFn ? cached.videos.filter(v => filterFn(v.title)) : cached.videos;
      setState({ videos, loading: false, error: null });
      return;
    }

    let alive = true;

    async function run() {
      try {
        let pid = playlistId;
        if (channelId) pid = await resolveUploadsPlaylistId(channelId);
        const raw    = await fetchRawVideos(pid, maxResults);
        rawCache[cacheKey] = { videos: raw, at: Date.now() };
        const videos = filterFn ? raw.filter(v => filterFn(v.title)) : raw;
        if (alive) setState({ videos, loading: false, error: null });
      } catch (err) {
        if (alive) setState(s => ({ ...s, loading: false, error: err.message }));
      }
    }

    run();
    return () => { alive = false; };
  }, [cacheKey]); // filterFn intentionally omitted — must be a module-level constant

  return state;
}
