import process from 'node:process';
import { restrictedDeployment, excludedPreviewCredentials } from '../lib/previewPolicy.mjs';

const MAX_RESPONSE_BYTES = 1024 * 1024;
const TIMEOUT_MS = 8000;
const OPERATIONS = {
  channels: { part: 'contentDetails', keys: ['endpoint', 'part', 'id'] },
  playlistItems: { part: 'snippet', keys: ['endpoint', 'part', 'playlistId', 'maxResults'] },
  videos: { part: 'snippet,statistics', keys: ['endpoint', 'part', 'id'] },
};

export function validateCatalogQuery(query) {
  if (!query || Object.values(query).some(value => typeof value !== 'string')) return null;
  if (new URLSearchParams(query).toString().length > 2048) return null;
  const operation = Object.hasOwn(OPERATIONS, query.endpoint) ? OPERATIONS[query.endpoint] : null;
  if (!operation || query.part !== operation.part || Object.keys(query).some(key => !operation.keys.includes(key))) return null;
  if (query.endpoint === 'channels' && !/^UC[A-Za-z0-9_-]{22}$/.test(query.id || '')) return null;
  if (query.endpoint === 'videos') {
    const ids = (query.id || '').split(',');
    if (ids.length > 50 || ids.some(id => !/^[A-Za-z0-9_-]{11}$/.test(id))) return null;
  }
  if (query.endpoint === 'playlistItems') {
    if (!/^[A-Za-z0-9_-]{3,128}$/.test(query.playlistId || '')) return null;
    if (!/^(?:[1-9]|[1-4][0-9]|50)$/.test(query.maxResults || '')) return null;
  }
  return { ...query };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const query = validateCatalogQuery(req.query);
  if (!query) return res.status(400).json({ error: 'Unsupported catalog request' });
  const preview = restrictedDeployment(process.env);
  if (preview && excludedPreviewCredentials.some(name => process.env[name])) {
    return res.status(503).json({ error: 'Preview isolation configuration is incomplete' });
  }
  const apiKey = preview ? process.env.YOUTUBE_API_KEY : process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
  if (!apiKey || (preview && !/^AIza[0-9A-Za-z_-]{35}$/.test(apiKey))) return res.status(503).json({ error: 'Catalog unavailable' });
  const { endpoint, ...params } = query;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let reader;
  try {
    const upstream = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${new URLSearchParams({ ...params, key: apiKey })}`, {
      headers: { Referer: 'https://www.truevoice.digital/' }, signal: controller.signal, redirect: 'error',
    });
    if (!upstream.ok) {
      controller.abort();
      return res.status(upstream.status).json({ error: 'YouTube catalog request failed' });
    }
    if (Number(upstream.headers.get('content-length')) > MAX_RESPONSE_BYTES) throw new Error('Response limit');
    reader = upstream.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw new Error('Response limit');
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return res.status(200).json(data);
  } catch {
    const timedOut = controller.signal.aborted;
    controller.abort();
    return res.status(timedOut ? 504 : 502).json({ error: timedOut ? 'Catalog request timed out' : 'Catalog unavailable' });
  } finally {
    clearTimeout(timer);
    reader?.releaseLock();
  }
}
