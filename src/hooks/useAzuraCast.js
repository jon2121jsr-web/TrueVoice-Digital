/**
 * useAzuraCast — TrueVoice live stream data via the AzuraCast proxy
 */

import { resolveApiUrl } from '../lib/apiBase';
import { listenerSnapshot } from '../lib/adminData';
import { useState, useEffect, useRef, useCallback } from 'react';

const AZURACAST_PROXY_URL = resolveApiUrl('/api/nowplaying');
const POLL_MS           = 30_000;
const HISTORY_KEY = 'tv_listener_history';
const MAX_HISTORY = 60;

function loadHistory() {
  try {
    const rows = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(rows) ? rows.filter(r => Number.isFinite(r?.listeners) && Number.isFinite(r?.ts)).slice(-MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory(arr) {
  try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(-MAX_HISTORY))); } catch { /* Storage is optional. */ }
}

export function useAzuraCast() {
  const [nowPlaying, setNowPlaying] = useState(null);
  const [history, setHistory]       = useState(loadHistory);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const timerRef                    = useRef(null);

  const fetchNow = useCallback(async () => {
    try {
      const res = await fetch(AZURACAST_PROXY_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
      if (!res.ok) throw new Error(`AzuraCast proxy ${res.status}`);
      const data = await res.json();

      const snapshot = listenerSnapshot(data);

      setNowPlaying(snapshot);
      setError(null);
      setHistory(prev => {
        const next = [...prev, snapshot];
        saveHistory(next);
        return next.slice(-MAX_HISTORY);
      });
    } catch (err) {
      setNowPlaying(null);
      setError(err?.message?.startsWith('AzuraCast') ? err.message : 'AzuraCast connection unavailable. Check connectivity; the next refresh will retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNow();
    timerRef.current = setInterval(fetchNow, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchNow]);

  const peakToday = history.length ? history.reduce((max, s) => Math.max(max, s.listeners), 0) : null;

  const chartData = history.slice(-20).map(s => ({
    label: new Date(s.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    value: s.listeners,
  }));

  return { nowPlaying, history, chartData, peakToday, loading, error, refetch: fetchNow };
}
