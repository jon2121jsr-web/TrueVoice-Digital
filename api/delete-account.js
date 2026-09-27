/**
 * Self-service account deletion — /api/delete-account.js
 *
 * POST with an Authorization: Bearer <supabase access token> header from
 * an already-signed-in Chime In user. Required by Apple Guideline 5.1.1(v):
 * an app that lets people create an account (Chime In's magic-link sign-in
 * does) must offer a way to delete that account from inside the app, not
 * just "email us." This is that path.
 *
 * Verifies the token, then deletes the auth user outright. chime_messages,
 * chime_message_reports, and feed_reactions all reference auth.users(id)
 * with "on delete cascade", so deleting the auth user cleans up everything
 * they posted/reported/reacted to in one step -- no manual row deletion
 * needed here.
 *
 * Needs SUPABASE_URL / SUPABASE_SERVICE_KEY (server-side, service role
 * key -- already set for the other api/*.js functions).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
  if (deleteErr) return res.status(500).json({ error: deleteErr.message });

  res.status(200).json({ ok: true });
}
