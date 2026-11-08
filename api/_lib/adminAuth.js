import { isRestrictedPreview } from './previewGuard.js';
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
import process from 'node:process';

export async function verifyAdmin(req) {
  if (isRestrictedPreview()) return { error: 'Operation unavailable in Preview', status: 403 };
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { error: 'Missing bearer token', status: 401 };
  }

  try {
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (url, options) => fetch(url, { ...options, signal: options?.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) }) },
    });
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr && ![400, 401, 403].includes(userErr.status)) {
      return { error: 'Authentication service unavailable. Retry shortly.', status: 503 };
    }
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
      return { error: 'Admin membership service unavailable. Retry shortly.', status: 503 };
    }
    if (!adminRow) {
      return { error: 'Not an admin', status: 403 };
    }

    return { user: userData.user, admin: adminRow, supabaseAdmin };
  } catch {
    return { error: 'Admin verification unavailable. Check backend connectivity and configuration.', status: 503 };
  }
}
