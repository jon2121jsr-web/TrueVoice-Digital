import { API_BASE } from './apiBase';

export async function withAdminDeadline(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Admin connection timed out.')), 15000);
    })]);
  } finally { clearTimeout(timer); }
}

export async function readAdminData(kind, days, token, signal) {
  if (!token) throw new Error('Sign in again to load admin metrics.');
  const res = await fetch(`${API_BASE}/api/admin-metrics?kind=${kind}&days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: signal ?? AbortSignal.timeout(15000), cache: 'no-store',
  });
  if (res.status === 401) throw new Error('Session expired. Sign out and sign in again.');
  if (res.status === 403) throw new Error('Admin access denied. Check your admin membership.');
  if (!res.ok) throw new Error(`Admin metrics unavailable (HTTP ${res.status}). Retry or select a shorter range.`);
  const body = await res.json();
  if (!Array.isArray(body.rows)) throw new Error('Invalid admin metrics response. Retry.');
  return body.rows;
}

export function listenerSnapshot(data, now = Date.now()) {
  const count = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  const listeners = count(data?.listeners?.current ?? data?.listeners?.total);
  if (listeners === null) throw new Error('AzuraCast listener count unavailable. Retry after the next refresh.');
  return { ts: now, listeners, listenersTotal: count(data.listeners.total),
    listenersUnique: count(data.listeners.unique), peak: listeners,
    show: data.now_playing?.song?.title ?? null, artist: data.now_playing?.song?.artist ?? null };
}
