/**
 * Push Device Registration — /api/push/register.js
 *
 * Called once per app launch (or whenever the native token changes) by
 * src/lib/pushNotifications.js on iOS/Android builds only — it's a no-op
 * on the web build, so this endpoint only ever hears from real installs.
 *
 * POST { device_token: string, platform: 'ios' | 'android' }
 *
 * Upserts on device_token: a fresh install with a reissued token just
 * refreshes last_seen_at rather than piling up duplicate rows. No auth
 * required — the device token itself is the identifier, and this table
 * is service-role-only for reads (see the push_subscriptions migration),
 * so registering one is low-risk the same way an analytics ping is.
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

const VALID_PLATFORMS = new Set(['ios', 'android']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { device_token, platform } = body ?? {};

  if (!device_token || typeof device_token !== 'string') {
    return res.status(400).json({ error: 'Missing device_token' });
  }
  if (!VALID_PLATFORMS.has(platform)) {
    return res.status(400).json({ error: "platform must be 'ios' or 'android'" });
  }

  const { error: sbErr } = await supabase
    .from('push_subscriptions')
    .upsert(
      { device_token, platform, last_seen_at: new Date().toISOString() },
      { onConflict: 'device_token' }
    );

  if (sbErr) {
    console.error('Push registration error:', sbErr.message);
    return res.status(500).json({ error: sbErr.message });
  }

  res.status(204).end();
}
