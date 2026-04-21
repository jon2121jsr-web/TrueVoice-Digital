/**
 * useAzuraCast — TrueVoice live stream data via Live365 proxy
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const LIVE365_PROXY_URL = '/api/nowplaying';
const POLL_MS           = 30_000;
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
    try {
      const res = await fetch(LIVE365_PROXY_URL, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Live365 proxy ${res.status}`);
      const data = await res.json();

      const snapshot = {
        ts:        Date.now(),
        listeners: data.listeners_count ?? 0,
        show:      data.current_track?.title ?? null,
        artist:    data.current_track?.artist ?? null,
        peak:      data.listeners_count ?? 0,
      };

      setNowPlaying(snapshot);
      setError(null);
      setHistory(prev => {
        const next = [...prev, snapshot];
        saveHistory(next);
        return next.slice(-MAX_HISTORY);
      });
    } catch (err) {
      console.warn('[useLive365] fetch failed:', err.message);
      setNowPlaying(prev => prev ?? { ts: Date.now(), listeners: 0, show: null, artist: null, peak: 0 });
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
