/**
 * Admin Team List — /api/admin-team.js
 *
 * GET with an Authorization: Bearer <supabase access token> header from
 * an already-signed-in admin. Verifies the caller is an existing
 * admin_users row, then returns the full admin_users list — a plain
 * client-side select can't do this since RLS only allows reading your
 * own row.
 */

import { verifyAdmin } from './_lib/adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const verified = await verifyAdmin(req);
  if (verified.error) return res.status(verified.status).json({ error: verified.error });

  const { data, error } = await verified.supabaseAdmin
    .from('admin_users')
    .select('email, role, invited_by, created_at')
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ admins: data });
}
