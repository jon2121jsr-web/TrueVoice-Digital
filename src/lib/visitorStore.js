const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function recordVisit(path, referrer, userAgent) {
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
  } catch {}
}

export async function readAllVisits(days = 7) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  const since = new Date();
  since.setDate(since.getDate() - days);
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/page_visits?visited_at=gte.${since.toISOString()}&order=visited_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    return await res.json();
  } catch { return []; }
}
