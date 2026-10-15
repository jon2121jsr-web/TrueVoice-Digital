// src/hooks/useYouTubeFeed.js
// Fetches an array of videos from a YouTube channel or playlist.
// filterFn receives the video title string — define at module level (not inline
// in a component) so its reference stays stable across renders.
// Returns { videos: Array<{id, youtubeId, title, thumbnailUrl, embedUrl, videoUrl}>, loading, error }
// Raw API results are cached for 5 minutes per channel/playlist+maxResults pair.

import { useEffect, useState } from "react";
import { fetchYouTubeCatalog } from "../lib/youtubeCatalog";

const CACHE_TTL_MS = 5 * 60 * 1000;

const CACHE_VERSION = 'v1';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCached(channelId) {
  try {
    const key = `yt_feed_${CACHE_VERSION}_${channelId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch { return null; }
}

function setCache(channelId, data) {
  try {
    const key = `yt_feed_${CACHE_VERSION}_${channelId}`;
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch { /* storage unavailable */ }
}

const UPLOADS_CACHE_KEY = 'yt_uploads_cache_v1';

function loadUploadsCache() {
  try {
    const raw = localStorage.getItem(UPLOADS_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

function saveUploadsCache(cache) {
  try {
    localStorage.setItem(UPLOADS_CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage unavailable */ }
}

const uploadsCache = loadUploadsCache();  // channelId  → uploadsPlaylistId
const rawCache     = {};  // cacheKey   → { videos, at }

async function resolveUploadsPlaylistId(channelId) {
  if (uploadsCache[channelId]) return uploadsCache[channelId];
  const data = await fetchYouTubeCatalog("channels", { part: "contentDetails", id: channelId });
  const id   = data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!id) throw new Error(`No uploads playlist for ${channelId}`);
  uploadsCache[channelId] = id;
  saveUploadsCache(uploadsCache);
  return id;
}

async function fetchRawVideos(playlistId, maxResults) {
  const data = await fetchYouTubeCatalog("playlistItems", { part: "snippet", playlistId, maxResults });
  return (data?.items || []).map((item) => {
    const s         = item.snippet;
    const youtubeId = s?.resourceId?.videoId;
    if (!youtubeId) return null;
    // maxresdefault.jpg is a guess, not a guarantee -- YouTube only
    // generates that size for videos with a true HD/landscape source
    // asset, and often hasn't finished generating it yet for a video
    // that just published. Guessing the URL directly (the old code
    // here) silently served a tiny gray placeholder for any video
    // without one -- which is exactly what showed up as blank/gray
    // cards for the newest uploads. playlistItems' own `thumbnails`
    // object only ever lists sizes that actually exist, so prefer
    // that, and only fall back to a guessed URL (hqdefault -- present
    // for essentially every video, unlike maxresdefault) if it's empty.
    const thumbs = s.thumbnails || {};
    const thumbnailUrl =
      thumbs.maxres?.url  ||
      thumbs.high?.url    ||
      thumbs.medium?.url  ||
      thumbs.default?.url ||
      `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    return {
      id:           youtubeId,
      youtubeId,
      title:        s.title || "",
      thumbnailUrl,
      // Real-origin proxy fix (see public/yt-embed.html): iOS can't make
      // the app's own address a genuine https:// origin, so a direct
      // YouTube embed always failed here regardless of any origin
      // parameter. This feeds the show-episode modal (VideoModal) and
      // ReelsGrid via the raw iframe path -- both are user-tap-to-open,
      // so mute=0.
      embedUrl:     `https://truevoice.digital/yt-embed.html?v=${youtubeId}&autoplay=1&mute=0`,
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

    const cached = rawCache[cacheKey];
    if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
      const videos = filterFn ? cached.videos.filter(v => filterFn(v.title)) : cached.videos;
      setState({ videos, loading: false, error: null });
      return;
    }

    const persisted = getCached(cacheKey);
    if (persisted) {
      rawCache[cacheKey] = { videos: persisted, at: Date.now() };
      const videos = filterFn ? persisted.filter(v => filterFn(v.title)) : persisted;
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
        setCache(cacheKey, raw);
        const videos = filterFn ? raw.filter(v => filterFn(v.title)) : raw;
        if (alive) setState({ videos, loading: false, error: null });
      } catch (err) {
        const stale = getCached(cacheKey);
        if (stale) {
          const videos = filterFn ? stale.filter(v => filterFn(v.title)) : stale;
          if (alive) setState({ videos, loading: false, error: null });
          return;
        }
        if (alive) setState(s => ({ ...s, loading: false, error: err.message }));
      }
    }

    run();
    return () => { alive = false; };
  }, [cacheKey, channelId, playlistId, maxResults, filterFn]); // filterFn intentionally omitted — must be a module-level constant

  return state;
}
