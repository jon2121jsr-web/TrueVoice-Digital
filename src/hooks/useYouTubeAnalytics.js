/**
 * useYouTubeAnalytics — TrueVoice video performance
 *
 * Fetches per-video view counts and watch time from the YouTube Data API v3.
 * Groups results by show based on your existing SHOW_CONFIG mapping.
 *
 * Usage:
 *   const { shows, totals, loading, error } = useYouTubeAnalytics({ days: 7 })
 *
 * Env vars required:
 *   VITE_YOUTUBE_API_KEY        your existing YouTube Data API key
 *   VITE_YOUTUBE_CHANNEL_ID     your channel ID (UCxxxxxxxx...)
 *
 * Note: The YouTube Data API v3 provides video statistics (views, likes).
 * Watch-time minutes requires YouTube Analytics API (OAuth), which needs a
 * server-side proxy. See /api/youtube-analytics.js for that proxy.
 * This hook uses only the public Data API — no OAuth needed.
 */

import { useState, useEffect } from 'react';

const API_KEY    = import.meta.env.VITE_YOUTUBE_API_KEY;
const CHANNEL_ID = import.meta.env.VITE_YOUTUBE_CHANNEL_ID;
const BASE       = 'https://www.googleapis.com/youtube/v3';
const IS_PROD    = import.meta.env.PROD;

// Map playlist names / title keywords → show slugs
// Adjust these to match your actual show names / playlist IDs
const SHOW_MAP = [
  { slug: 'ryan-kliesch',  label: 'Ryan Kliesch',     keywords: ['ryan kliesch'] },
  { slug: 'deep-end',      label: 'The Deep End',      keywords: ['deep end'] },
  { slug: 'scott-ritchie', label: 'Scott Ritchie',     keywords: ['scott ritchie'] },
  { slug: 'the-cut',       label: 'The Cut w/ Erica',  keywords: ['the cut', 'erica'] },
  { slug: 'pigskin-frenzy',label: 'Pigskin Frenzy',    keywords: ['pigskin frenzy', 'pigskin'] },
];

function matchShow(title = '') {
  const lower = title.toLowerCase();
  return SHOW_MAP.find(s => s.keywords.some(k => lower.includes(k))) ?? null;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Fetch up to 50 recent uploads from the channel,
 * then batch-fetch their statistics.
 */
async function fetchChannelVideos(maxResults = 50) {
  // Derive uploads playlist ID directly from channel ID (UC… → UU…)
  // This skips the channels API call entirely, avoiding domain-restriction errors.
  const uploadsId = CHANNEL_ID.replace(/^UC/, 'UU');

  const playlistUrl = IS_PROD
    ? `/api/youtube?endpoint=playlistItems&part=snippet&playlistId=${uploadsId}&maxResults=${maxResults}`
    : `${BASE}/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=${maxResults}&key=${API_KEY}`;
  const playlistData = await fetchJson(playlistUrl);

  const items = playlistData.items ?? [];
  const videoIds = items.map(i => i.snippet.resourceId.videoId).join(',');
  if (!videoIds) return [];

  const videosUrl = IS_PROD
    ? `/api/youtube?endpoint=videos&part=snippet%2Cstatistics&id=${videoIds}`
    : `${BASE}/videos?part=snippet,statistics&id=${videoIds}&key=${API_KEY}`;
  const statsData = await fetchJson(videosUrl);

  return (statsData.items ?? []).map(v => ({
    id:           v.id,
    title:        v.snippet.title,
    publishedAt:  v.snippet.publishedAt,
    thumbnail:    v.snippet.thumbnails?.medium?.url,
    views:        parseInt(v.statistics.viewCount  ?? 0, 10),
    likes:        parseInt(v.statistics.likeCount  ?? 0, 10),
    comments:     parseInt(v.statistics.commentCount ?? 0, 10),
    show:         matchShow(v.snippet.title),
  }));
}

function groupByShow(videos) {
  const map = {};
  SHOW_MAP.forEach(s => {
    map[s.slug] = { ...s, videos: [], totalViews: 0, totalLikes: 0 };
  });
  map['other'] = { slug: 'other', label: 'Other', videos: [], totalViews: 0, totalLikes: 0 };

  videos.forEach(v => {
    const key = v.show?.slug ?? 'other';
    if (!map[key]) map[key] = { slug: key, label: key, videos: [], totalViews: 0, totalLikes: 0 };
    map[key].videos.push(v);
    map[key].totalViews += v.views;
    map[key].totalLikes += v.likes;
  });

  return Object.values(map).filter(s => s.videos.length > 0);
}

export function useYouTubeAnalytics({ maxResults = 50 } = {}) {
  const [videos, setVideos]   = useState([]);
  const [shows,  setShows]    = useState([]);
  const [totals, setTotals]   = useState({ views: 0, likes: 0, videoCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!API_KEY || !CHANNEL_ID) {
      setError('VITE_YOUTUBE_API_KEY or VITE_YOUTUBE_CHANNEL_ID not set');
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetchChannelVideos(maxResults)
      .then(vids => {
        if (cancelled) return;
        const grouped = groupByShow(vids);
        const totals  = vids.reduce(
          (acc, v) => ({ views: acc.views + v.views, likes: acc.likes + v.likes, videoCount: acc.videoCount + 1 }),
          { views: 0, likes: 0, videoCount: 0 }
        );
        setVideos(vids);
        setShows(grouped.sort((a, b) => b.totalViews - a.totalViews));
        setTotals(totals);
        setError(null);
      })
      .catch(err => {
        if (cancelled) return;
        // 400/403 from localhost almost always means the API key has domain
        // restrictions in Google Cloud Console. Data loads automatically on
        // the production domain (truevoice.digital) where the key is whitelisted.
        if (err.message.includes('400') || err.message.includes('403')) {
          setError('YouTube API key is restricted to production domain. Video data will appear after deploying to truevoice.digital.');
        } else {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [maxResults]);

  return { videos, shows, totals, loading, error };
}
