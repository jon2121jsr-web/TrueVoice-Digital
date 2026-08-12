/**
 * Shared server-side admin verification for api/admin-*.js.
 *
 * Extracts the caller's Supabase access token from the Authorization
 * header, resolves the user via the service role client, then confirms
 * their email exists in admin_users before granting access to anything
 * admin-only. This is the real enforcement point — the admin_users RLS
 * policy only lets a user read their own row, so listing/inviting other
 * admins has to happen here, server-side, with the service key.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function verifyAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { error: 'Missing bearer token', status: 401 };
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user?.email) {
    return { error: 'Invalid or expired session', status: 401 };
  }

  const email = userData.user.email;
  const { data: adminRow, error: adminErr } = await supabaseAdmin
    .from('admin_users')
    .select('email, role')
    .eq('email', email)
    .maybeSingle();

  if (adminErr) {
    return { error: adminErr.message, status: 500 };
  }
  if (!adminRow) {
    return { error: 'Not an admin', status: 403 };
  }

  return { user: userData.user, admin: adminRow, supabaseAdmin };
}
