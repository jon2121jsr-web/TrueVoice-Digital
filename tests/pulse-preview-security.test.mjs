import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { build } from 'esbuild';
import { classifyDeployment, restrictedDeployment, assertPreviewConfiguration } from '../lib/previewPolicy.mjs';
import youtube from '../api/youtube.js';

const ref = 'a'.repeat(20);
const config = {
  VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', TRUEVOICE_PREVIEW_SUPABASE_REF: ref,
  TRUEVOICE_PRODUCTION_SUPABASE_REF: 'b'.repeat(20), VITE_SUPABASE_URL: `https://${ref}.supabase.co`,
  VITE_SUPABASE_ANON_KEY: `fixture.${Buffer.from(JSON.stringify({ role: 'anon', ref })).toString('base64url')}.signature`,
  YOUTUBE_API_KEY: `AIza${'x'.repeat(35)}`,
};

test('authoritative classification matrix denies conflicts, missing and unknown metadata', () => {
  for (const [env, expected] of [
    [{ VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production' }, 'production'],
    [{ VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', NODE_ENV: 'production' }, 'preview'],
    [{ VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'preview' }, 'unsafe'],
    [{ VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'production' }, 'unsafe'],
    [{}, 'unsafe'], [{ NODE_ENV: 'production' }, 'unsafe'],
    [{ VERCEL_ENV: 'production' }, 'unsafe'], [{ VERCEL_TARGET_ENV: 'preview' }, 'unsafe'],
    [{ VERCEL_ENV: 'unknown', VERCEL_TARGET_ENV: 'unknown' }, 'unsafe'],
    [{ VERCEL: 'unknown', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production' }, 'unsafe'],
    [{ VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'staging' }, 'unsafe'],
    [{ NODE_ENV: 'development' }, 'development'],
    [{ VERCEL_ENV: 'development', VERCEL_TARGET_ENV: 'development' }, 'development'],
    [{ VERCEL: '1', NODE_ENV: 'development' }, 'unsafe'],
  ]) {
    assert.equal(classifyDeployment(env), expected);
    assert.equal(restrictedDeployment(env), !['production', 'development'].includes(expected));
    if (expected === 'unsafe') assert.throws(() => assertPreviewConfiguration(env), /incomplete/);
  }
});

let bundleId = 0;
async function bundle(file, preview, server = false) {
  const result = await build({ entryPoints: [file], bundle: true, write: false, format: 'esm', platform: 'node',
    define: { 'import.meta.env.TRUEVOICE_RESTRICTED_PREVIEW': String(preview), 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(config.VITE_SUPABASE_URL), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(config.VITE_SUPABASE_ANON_KEY) },
    plugins: server ? [{ name: 'deny-services', setup(b) {
      b.onResolve({ filter: /^(@supabase\/supabase-js|stripe|firebase-admin)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
        export function createClient(){ throw new Error('Privileged client initialized'); }
        export default class Service { static apps=[]; static initializeApp(){throw new Error('Service initialized');} }
      `, loader: 'js' }));
    }}] : [] });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#fixture-${++bundleId}`);
}

test('Preview build configuration fails closed without changing local/production policy', () => {
  assert.doesNotThrow(() => assertPreviewConfiguration(config));
  for (const patch of [
    { TRUEVOICE_PREVIEW_SUPABASE_REF: '' }, { TRUEVOICE_PRODUCTION_SUPABASE_REF: ref },
    { VITE_SUPABASE_URL: 'https://production.example' }, { VITE_SUPABASE_ANON_KEY: 'malformed' },
    { YOUTUBE_API_KEY: '' }, { VITE_YOUTUBE_API_KEY: 'inherited' }, { SUPABASE_SERVICE_KEY: 'inherited' },
    { STRIPE_SECRET_KEY: 'inherited' },
    { VITE_SUPABASE_ANON_KEY: `fixture.${Buffer.from(JSON.stringify({ role: 'service_role', ref })).toString('base64url')}.signature` },
  ]) assert.throws(() => assertPreviewConfiguration({ ...config, ...patch }), /incomplete/);
  assert.equal(restrictedDeployment({ VERCEL: '1' }), true);
  assert.equal(restrictedDeployment({ VERCEL: '1', VERCEL_ENV: 'invalid' }), true);
  for (const env of [{ NODE_ENV: 'development' }, { VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production', SUPABASE_SERVICE_KEY: 'existing' }]) {
    assert.equal(restrictedDeployment(env), false);
    assert.doesNotThrow(() => assertPreviewConfiguration(env));
  }
});

test('production admin authorization and client payment eligibility remain intact', async () => {
  const previous = process.env.VERCEL_ENV;
  const previousTarget = process.env.VERCEL_TARGET_ENV;
  process.env.VERCEL_ENV = 'production';
  process.env.VERCEL_TARGET_ENV = 'production';
  try {
    const result = await build({ entryPoints: ['api/_lib/adminAuth.js'], bundle: true, write: false, format: 'esm', platform: 'node',
      plugins: [{ name: 'admin-fixture', setup(b) {
        b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'supabase', namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export function createClient(){return {
          auth:{getUser:async()=>({data:{user:{email:'fixture@example.invalid'}}})},
          from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})})
        };}`, loader: 'js' }));
      }}] });
    const { verifyAdmin } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
    assert.equal((await verifyAdmin({ headers: {} })).status, 401);
    assert.equal((await verifyAdmin({ headers: { authorization: 'Bearer fixture' } })).status, 403);
    assert.equal((await bundle('src/lib/previewSafety.js', false)).IS_PREVIEW, false);
  } finally { if (previous === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous; if (previousTarget === undefined) delete process.env.VERCEL_TARGET_ENV; else process.env.VERCEL_TARGET_ENV = previousTarget; }
});

test('conflicting Preview target rejects direct analytics calls before privileged client initialization', async () => {
  const names = ['VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'preview' });
  try {
    // The service stub throws if the route creates a client rather than denying.
    const { default: handler } = await bundle('api/analytics.js', true, true);
    const res = { status(code) { this.code = code; return this; }, json() { return this; } };
    await handler({ method: 'POST', headers: {}, body: { event: 'pageview', session: 'fixture' } }, res);
    assert.equal(res.code, 403);
  } finally {
    for (const name of names) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
  }
});

test('Preview proxy rejects missing/malformed or client-exposed keys without upstream work', async () => {
  const names = ['VERCEL_ENV', 'YOUTUBE_API_KEY', 'VITE_YOUTUBE_API_KEY'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail('No upstream request permitted');
  process.env.VERCEL_ENV = 'preview';
  delete process.env.VITE_YOUTUBE_API_KEY;
  try {
    for (const key of ['', 'malformed']) {
      process.env.YOUTUBE_API_KEY = key;
      const res = { setHeader() {}, status(code) { this.code = code; return this; }, json() { return this; } };
      await youtube({ method: 'GET', query: { endpoint: 'channels', part: 'contentDetails', id: `UC${'x'.repeat(22)}` } }, res);
      assert.equal(res.code, 503);
    }
    process.env.VITE_YOUTUBE_API_KEY = 'inherited-client-key';
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json() { return this; } };
    await youtube({ method: 'GET', query: { endpoint: 'channels', part: 'contentDetails', id: `UC${'x'.repeat(22)}` } }, res);
    assert.equal(res.code, 503);
  } finally {
    globalThis.fetch = oldFetch;
    for (const name of names) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
  }
});

test('all privileged routes deny Preview and unsafe metadata before service creation', async () => {
  const names = ['VERCEL_ENV', 'VERCEL_TARGET_ENV', 'VERCEL', 'NODE_ENV'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const metadata of [{ VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview' }, { VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'preview' }, { VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'production' }, {}, { VERCEL_ENV: 'unknown', VERCEL_TARGET_ENV: 'unknown' }]) {
      for (const name of names) delete process.env[name];
      Object.assign(process.env, metadata);
      for (const name of ['analytics', 'delete-account', 'ingest-feed', 'stripe-webhook',
        'admin-team', 'admin-invite', 'push/register', 'push/send', 'og/[id]']) {
        const { default: handler } = await bundle(`api/${name}.js`, true, true);
        for (const method of ['GET', 'POST', 'OPTIONS']) {
          const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
          await handler({ method, headers: { 'x-preview': 'false' } }, res);
          assert.equal(res.code, 403, name);
          assert.deepEqual(res.body, { error: 'Operation unavailable in Preview' });
        }
      }
    }
  } finally {
    for (const name of names) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
  }
});

test('Preview Supabase transport permits reads only at the configured backend, rejects auth/storage/writes', async () => {
  const { previewReadOnlyFetch } = await bundle('src/lib/previewSafety.js', true);
  let requests = 0;
  const fetcher = previewReadOnlyFetch(config.VITE_SUPABASE_URL, async () => { requests++; return 'read'; });
  assert.equal(await fetcher(`${config.VITE_SUPABASE_URL}/rest/v1/feed_items`), 'read');
  for (const [url, method] of [
    [`${config.VITE_SUPABASE_URL}/rest/v1/page_visits`, 'POST'],
    [`${config.VITE_SUPABASE_URL}/rest/v1/feed_items`, 'PATCH'],
    [`${config.VITE_SUPABASE_URL}/storage/v1/object/private-fixture/file`, 'POST'],
    [`${config.VITE_SUPABASE_URL}/auth/v1/otp`, 'POST'],
    ['https://production.example/rest/v1/feed_items', 'GET'],
  ]) await assert.rejects(fetcher(url, { method }), /unavailable/);
  assert.equal(requests, 1);
});

test('client telemetry is disabled in Preview; production visitor behavior is retained', async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return {}; };
  try {
    // The explicit Preview return precedes missing env/config and any request.
    const preview = await bundle('src/lib/visitorStore.js', true);
    await preview.recordVisit('/', '', 'fixture');
    assert.equal(calls, 0);
    const production = await bundle('src/lib/visitorStore.js', false);
    await production.recordVisit('/', '', 'fixture');
    assert.equal(calls, 1);
    assert.ok(fs.readFileSync('src/lib/analytics.js', 'utf8').includes('if (IS_PREVIEW) return;'));
    assert.ok(fs.readFileSync('src/App.jsx', 'utf8').includes('href={IS_PREVIEW ? undefined : href}'));
    assert.ok(fs.readFileSync('src/components/MerchSection.jsx', 'utf8').includes('disabled={IS_PREVIEW}'));
  } finally { globalThis.fetch = oldFetch; }
});
