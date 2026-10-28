/**
 * useSiteAnalytics — TrueVoice site visitor data
 *
 * Reads from the `analytics_events` Supabase table populated by
 * /src/lib/analytics.js (your custom tracker) + /api/analytics.js (the endpoint).
 *
 * Usage:
 *   const { summary, topPages, recentEvents, loading } = useSiteAnalytics({ days: 7 })
 */

import { useAdminRows } from './useAdminRows';

export function useSiteAnalytics({ days = 7, token } = {}) {
  const state = useAdminRows('events', days, token, 60000);
  if (!state.rows) return { summary: null, topPages: [], sources: [], recentEvents: [],
    activeNow: null, dailyChart: [], loading: state.loading, error: state.error };
  const events = state.rows;
  const fiveMinAgo = Date.now() - 5 * 60_000;
  const pageviews = events.filter(e => e.event === 'pageview');
  const sessions  = new Set(events.map(e => e.session));

  // Top pages
  const pageCounts = {};
  pageviews.forEach(e => {
    pageCounts[e.path] = (pageCounts[e.path] ?? 0) + 1;
  });
  const pages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // Traffic sources
  const srcCounts = { direct: 0, social: 0, search: 0, other: 0 };
  pageviews.forEach(e => {
    const ref = e.referrer ?? '';
    if (!ref) srcCounts.direct++;
    else if (/facebook|instagram|twitter|x\.com|tiktok|youtube/i.test(ref)) srcCounts.social++;
    else if (/google|bing|duckduckgo|yahoo/i.test(ref)) srcCounts.search++;
    else srcCounts.other++;
  });

  // Daily chart
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    buckets[d] = { pageviews: 0, sessions: new Set() };
  }
  pageviews.forEach(e => {
    const key = (e.ts ?? '').slice(0, 10);
    if (key in buckets) {
      buckets[key].pageviews++;
      buckets[key].sessions.add(e.session);
    }
  });
  const daily = Object.entries(buckets).map(([date, d]) => ({
    label:     new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
    pageviews: d.pageviews,
    visitors:  d.sessions.size,
  }));

  const summary = {
    pageviews:    pageviews.length,
    uniqueVisitors: sessions.size,
    streamPlays:  events.filter(e => e.event === 'stream_play').length,
    videoPlays:   events.filter(e => e.event === 'video_play').length,
    donationClicks: events.filter(e => e.event === 'donation_click').length,
  };
  const sources = [
    { label: 'Direct', value: srcCounts.direct,  pct: pct(srcCounts.direct, pageviews.length) },
    { label: 'Social', value: srcCounts.social,   pct: pct(srcCounts.social, pageviews.length) },
    { label: 'Search', value: srcCounts.search,   pct: pct(srcCounts.search, pageviews.length) },
    { label: 'Other',  value: srcCounts.other,    pct: pct(srcCounts.other, pageviews.length) },
  ];
  const activeNow = new Set(pageviews.filter(r => Date.parse(r.ts) >= fiveMinAgo).map(r => r.session)).size;

  return { summary, topPages: pages, sources, recentEvents: events.slice(0, 50), activeNow,
    dailyChart: daily, loading: false, error: null };
}

const pct = (n, total) => total ? Math.round((n / total) * 100) : 0;
