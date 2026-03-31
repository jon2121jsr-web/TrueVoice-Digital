/**
 * useAzuraCast — TrueVoice live stream data
 *
 * TrueVoice streams via Live365 (not self-hosted AzuraCast), so direct
 * listener-count APIs are blocked by CORS from the browser. Until a
 * server-side proxy is added at /api/nowplaying, this hook:
 *   - Shows "Stream active" with 0 listeners (clean UI, no error)
 *   - Still polls so the chart accumulates data once a proxy is wired up
 *
 * To enable real listener counts later, create /api/nowplaying.js that
 * server-side fetches https://stream.truevoice.digital/api/nowplaying/1
 * and set VITE_AZURACAST_PROXY_URL=/api/nowplaying in .env.local.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Optional proxy URL — leave unset until /api/nowplaying.js is deployed
const PROXY_URL   = import.meta.env.VITE_AZURACAST_PROXY_URL || null;
const POLL_MS     = 30_000;
const HISTORY_KEY = 'tv_listener_history';
const MAX_HISTORY = 60;

function loadHistory() {
  try {
    return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(arr) {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(-MAX_HISTORY)));
}

export function useAzuraCast() {
  const [nowPlaying, setNowPlaying] = useState(null);
  const [history, setHistory]       = useState(loadHistory);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const timerRef                    = useRef(null);

  const fetchNow = useCallback(async () => {
    // No proxy configured — show stream as active with placeholder data
    if (!PROXY_URL) {
      const snapshot = {
        ts:        Date.now(),
        listeners: 0,
        show:      'Stream active',
        artist:    null,
        peak:      0,
      };
      setNowPlaying(snapshot);
      setHistory(prev => {
        const next = [...prev, snapshot];
        saveHistory(next);
        return next.slice(-MAX_HISTORY);
      });
      setError(null);
      setLoading(false);
      return;
    }

    // Proxy is configured — fetch real listener data
    try {
      const res = await fetch(PROXY_URL, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`nowplaying proxy ${res.status}`);
      const data = await res.json();

      const snapshot = {
        ts:        Date.now(),
        listeners: data.listeners?.current ?? 0,
        show:      data.now_playing?.song?.title ?? 'Stream active',
        artist:    data.now_playing?.song?.artist ?? null,
        peak:      data.listeners?.unique ?? 0,
      };

      setNowPlaying(snapshot);
      setError(null);
      setHistory(prev => {
        const next = [...prev, snapshot];
        saveHistory(next);
        return next.slice(-MAX_HISTORY);
      });
    } catch (err) {
      // CORS or network error — degrade gracefully, don't surface to UI
      console.warn('[useAzuraCast] fetch failed (CORS/network):', err.message);
      setNowPlaying(prev => prev ?? { ts: Date.now(), listeners: 0, show: 'Stream active', artist: null, peak: 0 });
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNow();
    timerRef.current = setInterval(fetchNow, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchNow]);

  const peakToday = history.reduce((max, s) => Math.max(max, s.listeners), 0);

  const chartData = history.slice(-20).map(s => ({
    label: new Date(s.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    value: s.listeners,
  }));

  return { nowPlaying, history, chartData, peakToday, loading, error, refetch: fetchNow };
}
