import process from 'node:process';
import { restrictedDeployment, excludedPreviewCredentials } from '../lib/previewPolicy.mjs';
import { createCatalogStore, createCatalogService, knownChannels } from './_lib/youtubeCatalogCache.js';

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

// Dependencies are injectable for offline tests; default construction is lazy and guarded.
export function createYouTubeHandler({ storeFactory = createCatalogStore, fetcher, env = process.env, monotonicNow = () => performance.now() } = {}) {
  let store, service;
  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'X-Catalog-Cache, Retry-After');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const query = validateCatalogQuery(req.query);
    if (!query) return res.status(400).json({ error: 'Unsupported catalog request' });
    const preview = restrictedDeployment(env);
    if (preview) {
      const error = excludedPreviewCredentials.some(name => env[name])
        ? 'Preview isolation configuration is incomplete' : 'Catalog cache unavailable in Preview';
      // No production database client, reads, writes or Google work in restricted deployments.
      return res.status(503).json({ error });
    }
    const apiKey = env.VITE_YOUTUBE_API_KEY || env.YOUTUBE_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Catalog unavailable' });
    try {
      store ||= storeFactory(env);
      service ||= createCatalogService({ store, fetcher, env, monotonicNow });
      if (!await store.authorized(query, knownChannels(env))) return res.status(403).json({ error: 'Unsupported catalog resource' });
      const result = await service.load(query, apiKey);
      // Recheck after service cleanup/other microtasks, immediately before send.
      if (result.validUntil !== undefined && monotonicNow() >= result.validUntil) {
        res.setHeader('Retry-After', '5');
        return res.status(503).json({ error: 'Catalog temporarily unavailable' });
      }
      if (result.retry) res.setHeader('Retry-After', String(result.retry));
      if (result.data) {
        res.setHeader('X-Catalog-Cache', result.state);
        // CDN is a front cache only; database remains authoritative across instances/deploys.
        if (result.state !== 'stale') res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=60');
      }
      return res.status(result.status).json(result.data || { error: result.error });
    } catch {
      // Never fall back to per-visitor Google calls when the migration/store is unavailable.
      res.setHeader('Retry-After', '60');
      return res.status(503).json({ error: 'Catalog cache unavailable' });
    }
  };
}
export default createYouTubeHandler();
