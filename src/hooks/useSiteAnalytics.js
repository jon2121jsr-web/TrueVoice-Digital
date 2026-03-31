/**
 * useSiteAnalytics — TrueVoice site visitor data
 *
 * Reads from the `analytics_events` Supabase table populated by
 * /src/lib/analytics.js (your custom tracker) + /api/analytics.js (the endpoint).
 *
 * Usage:
 *   const { summary, topPages, recentEvents, loading } = useSiteAnalytics({ days: 7 })
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useSiteAnalytics({ days = 7 } = {}) {
  const [summary,      setSummary]      = useState(null);
  const [topPages,     setTopPages]     = useState([]);
  const [sources,      setSources]      = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [activeNow,    setActiveNow]    = useState(0);
  const [dailyChart,   setDailyChart]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  const fetch = useCallback(async () => {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();

    const [eventsRes, activeRes] = await Promise.all([
      supabase
        .from('analytics_events')
        .select('*')
        .gte('ts', since)
        .order('ts', { ascending: false }),
      supabase
        .from('analytics_events')
        .select('session', { count: 'exact', head: false })
        .eq('event', 'pageview')
        .gte('ts', fiveMinAgo),
    ]);

    if (eventsRes.error) { setError(eventsRes.error.message); setLoading(false); return; }

    const events   = eventsRes.data ?? [];
    const pageviews = events.filter(e => e.event === 'pageview');
    const sessions  = new Set(events.map(e => e.session));

    // Top pages
    const pageCounts = {};
    const pageTimes  = {};
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

    setSummary({
      pageviews:    pageviews.length,
      uniqueVisitors: sessions.size,
      streamPlays:  events.filter(e => e.event === 'stream_play').length,
      videoPlays:   events.filter(e => e.event === 'video_play').length,
      donationClicks: events.filter(e => e.event === 'donation_click').length,
    });
    setTopPages(pages);
    setSources([
      { label: 'Direct', value: srcCounts.direct,  pct: pct(srcCounts.direct, pageviews.length) },
      { label: 'Social', value: srcCounts.social,   pct: pct(srcCounts.social, pageviews.length) },
      { label: 'Search', value: srcCounts.search,   pct: pct(srcCounts.search, pageviews.length) },
      { label: 'Other',  value: srcCounts.other,    pct: pct(srcCounts.other, pageviews.length) },
    ]);
    setRecentEvents(events.slice(0, 50));
    setActiveNow(activeRes.data ? new Set(activeRes.data.map(r => r.session)).size : 0);
    setDailyChart(daily);
    setError(null);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    fetch();
    const iv = setInterval(fetch, 60_000); // refresh every minute
    return () => clearInterval(iv);
  }, [fetch]);

  return { summary, topPages, sources, recentEvents, activeNow, dailyChart, loading, error, refetch: fetch };
}

const pct = (n, total) => total ? Math.round((n / total) * 100) : 0;
