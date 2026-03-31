/**
 * Analytics Event Collector — /api/analytics.js
 *
 * Receives events from /src/lib/analytics.js (the client tracker).
 * Writes to a Supabase `analytics_events` table.
 *
 * SQL to run in Supabase (once):
 * ─────────────────────────────────────────────────────────────────
 *   create table if not exists analytics_events (
 *     id      bigserial primary key,
 *     site    text,
 *     event   text not null,
 *     url     text,
 *     path    text,
 *     referrer text,
 *     session text,
 *     show    text,
 *     video_id text,
 *     amount  numeric,
 *     props   jsonb,
 *     ip      text,
 *     ua      text,
 *     ts      timestamptz default now()
 *   );
 *   create index on analytics_events (ts desc);
 *   create index on analytics_events (event, ts desc);
 *   create index on analytics_events (session);
 *   alter table analytics_events enable row level security;
 *   -- Allow service role full access; deny anon reads (privacy)
 *   create policy "Service role only" on analytics_events
 *     using (auth.role() = 'service_role')
 *     with check (auth.role() = 'service_role');
 * ─────────────────────────────────────────────────────────────────
 *
 * Env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // Accept both POST (fetch) and OPTIONS (CORS preflight)
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).end();

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { site, event, url, path, referrer, session, ts, show, video_id, amount, ...rest } = body ?? {};

  if (!event || !session) return res.status(400).json({ error: 'Missing event or session' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
          ?? req.socket?.remoteAddress
          ?? null;
  const ua = req.headers['user-agent'] ?? null;

  const { error: sbErr } = await supabase.from('analytics_events').insert({
    site:     site ?? 'truevoice',
    event,
    url:      url ?? null,
    path:     path ?? null,
    referrer: referrer ?? null,
    session,
    show:     show ?? null,
    video_id: video_id ?? null,
    amount:   amount ?? null,
    props:    Object.keys(rest).length ? rest : null,
    ip,
    ua,
    ts:       ts ? new Date(ts).toISOString() : new Date().toISOString(),
  });

  if (sbErr) {
    console.error('Analytics insert error:', sbErr.message);
    return res.status(500).json({ error: sbErr.message });
  }

  // Return 204 — no content — fast response, client doesn't need the body
  res.status(204).end();
}
