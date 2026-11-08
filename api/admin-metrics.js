import { verifyAdmin } from './_lib/adminAuth.js';
import { rejectPreview } from './_lib/previewGuard.js';

const SOURCES = {
  events: { table: 'analytics_events', columns: 'id,event,path,referrer,session,ts', time: 'ts' },
  donations: { table: 'donations', columns: 'id,amount_cents,currency,type,status,created_at,donor_name', time: 'created_at' },
  visits: { table: 'page_visits', columns: 'id,path,visited_at', time: 'visited_at' },
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (rejectPreview(res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const verified = await verifyAdmin(req);
    if (verified.error) return res.status(verified.status).json({ error: verified.error });
    const source = Object.hasOwn(SOURCES, req.query?.kind) ? SOURCES[req.query.kind] : null;
    const days = Number(req.query?.days);
    if (!source || ![7, 30, 90].includes(days)) return res.status(400).json({ error: 'Invalid metric or date range' });
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const until = new Date().toISOString();
    const rows = [];
    const signal = AbortSignal.timeout(10000);
    // Small pages work even when PostgREST's row cap is below its usual 1000.
    // Exact count prevents truncation from masquerading as a complete result.
    for (let offset = 0; offset <= 10000; offset += 250) {
      let query = verified.supabaseAdmin.from(source.table)
        .select(source.columns, { count: 'exact' }).gte(source.time, since).lte(source.time, until)
        .order(source.time, { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + 249).abortSignal(signal);
      if (source.table === 'donations') query = query.eq('status', 'succeeded');
      const { data, error, count } = await query;
      if (error || !Array.isArray(data) || !Number.isInteger(count)) throw new Error('Metric read failed');
      if (count > 10000) return res.status(503).json({ error: 'Metric range is too large. Select a shorter range.' });
      rows.push(...data);
      if (rows.length === count) return res.status(200).json({ rows });
      if (data.length !== 250 || rows.length > count) throw new Error('Incomplete metric response');
    }
    throw new Error('Incomplete metric response');
  } catch {
    return res.status(503).json({ error: 'Admin metrics unavailable. Retry; if this persists, check backend connectivity and access.' });
  }
}
