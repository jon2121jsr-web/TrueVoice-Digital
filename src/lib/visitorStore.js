import { readAdminData } from './adminData';
import { IS_PREVIEW } from './previewSafety';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function recordVisit(path, referrer, userAgent) {
  if (IS_PREVIEW) return;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/page_visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        path,
        referrer: referrer || null,
        user_agent: userAgent
      })
    });
  } catch { /* Best-effort visit logging. */ }
}

export async function readAllVisits(days = 7, token) {
  return readAdminData('visits', days, token);
}
