export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { endpoint, ...params } = req.query;
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

  const API_KEY = process.env.VITE_YOUTUBE_API_KEY;
  const qs = new URLSearchParams({ ...params, key: API_KEY }).toString();
  const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${qs}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
