/**
 * Admin Invite — /api/admin-invite.js
 *
 * POST { email } with an Authorization: Bearer <supabase access token>
 * header from an already-signed-in admin. Verifies the caller is an
 * existing admin_users row, sends a Supabase Auth invite email, then
 * adds the invited email to admin_users.
 *
 * Needs SUPABASE_URL / SUPABASE_SERVICE_KEY (server-side, service role
 * key — required for auth.admin.inviteUserByEmail).
 */

import { verifyAdmin } from './_lib/adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const verified = await verifyAdmin(req);
  if (verified.error) return res.status(verified.status).json({ error: verified.error });

  const { email } = req.body ?? {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email is required' });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const { supabaseAdmin, admin } = verified;

  const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail);
  if (inviteErr) return res.status(500).json({ error: inviteErr.message });

  const { error: insertErr } = await supabaseAdmin.from('admin_users').insert({
    email:      normalizedEmail,
    invited_by: admin.email,
  });
  if (insertErr) return res.status(500).json({ error: insertErr.message });

  res.status(200).json({ ok: true });
}
