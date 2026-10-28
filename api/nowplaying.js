export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(
      'https://stream.truevoice.digital/api/nowplaying/truevoice_digital',
      { signal: controller.signal }
    );
    if (!r.ok) return res.status(r.status).json({ error: 'AzuraCast error' });
    const data = await r.json();
    res.status(200).json(data);
  } catch {
    res.status(503).json({ error: 'AzuraCast metadata unavailable. Retry shortly.' });
  } finally { clearTimeout(timeout); }
}
