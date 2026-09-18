/**
 * Push Notification Send — /api/push/send.js
 *
 * Admin-only. Broadcasts one notification to every registered device (or
 * just one platform) via Firebase Cloud Messaging. This is the endpoint
 * an admin dashboard button ("notify listeners") would call — it is NOT
 * meant to be reachable by the app itself, so it reuses the same
 * Supabase-session admin check as api/admin-team.js rather than the
 * public CORS-open pattern in api/analytics.js / api/push/register.js.
 *
 * POST (Authorization: Bearer <supabase access token> from a signed-in
 * admin_users row)
 *   {
 *     title: string,
 *     body: string,
 *     url?: string,       // deep link opened on tap, e.g. "/scroll/abc123"
 *     platform?: 'ios' | 'android'   // omit to send to both
 *   }
 *
 * Cleans up dead tokens FCM reports as unregistered/invalid so
 * push_subscriptions doesn't accumulate stale rows from uninstalled apps.
 *
 * Env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — the full service-account key JSON
 *     downloaded from Firebase Console > Project Settings > Service
 *     Accounts > Generate new private key, pasted as a single-line
 *     string into the Vercel env var (see NATIVE_APP_SETUP.md).
 */

import admin from 'firebase-admin';
import { verifyAdmin } from '../_lib/adminAuth.js';

// Serverless functions can be reused across invocations on the same
// warm instance — guard against re-initializing the Firebase app, which
// throws if called twice.
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const FCM_BATCH_SIZE = 500; // sendEachForMulticast's hard limit

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const verified = await verifyAdmin(req);
  if (verified.error) return res.status(verified.status).json({ error: verified.error });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { title, body: messageBody, url, platform } = body ?? {};
  if (!title || !messageBody) {
    return res.status(400).json({ error: 'Missing title or body' });
  }
  if (platform && !['ios', 'android'].includes(platform)) {
    return res.status(400).json({ error: "platform must be 'ios' or 'android'" });
  }

  let query = verified.supabaseAdmin.from('push_subscriptions').select('device_token');
  if (platform) query = query.eq('platform', platform);
  const { data: rows, error: fetchErr } = await query;

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  const tokens = (rows ?? []).map((r) => r.device_token);

  if (tokens.length === 0) {
    return res.status(200).json({ sent: 0, failed: 0, removed: 0 });
  }

  let sent = 0;
  let failed = 0;
  const deadTokens = [];

  for (const batch of chunk(tokens, FCM_BATCH_SIZE)) {
    const message = {
      tokens: batch,
      notification: { title, body: messageBody },
      data: url ? { url } : undefined,
      apns: { payload: { aps: { sound: 'default' } } },
      android: { priority: 'high' },
    };

    const result = await admin.messaging().sendEachForMulticast(message);
    sent += result.successCount;
    failed += result.failureCount;

    result.responses.forEach((resp, i) => {
      const code = resp.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        deadTokens.push(batch[i]);
      }
    });
  }

  if (deadTokens.length > 0) {
    await verified.supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .in('device_token', deadTokens);
  }

  res.status(200).json({ sent, failed, removed: deadTokens.length });
}
