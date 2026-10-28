import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { build } from 'esbuild';

// Execute the real consumer modules with offline platform/transport adapters.
async function load(entry, native, env = {}) {
  const calls = [], effects = [], push = {};
  const context = {
    module: { exports: {} }, console, URL, URLSearchParams, AbortSignal,
    setTimeout, clearTimeout, setInterval: () => 1, clearInterval: () => {},
    effects, push,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ items: [], rows: [], listeners: { current: 1 } }) };
    },
    location: { href: 'capacitor://localhost/', pathname: '/', search: '' },
    document: { title: 'Fixture', referrer: '' },
    history: { pushState() {}, replaceState() {} },
    window: { addEventListener() {} },
  };
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
    define: { 'import.meta.env': JSON.stringify({ PROD: true, ...env }) },
    plugins: [{ name: 'offline-native', setup(b) {
      b.onResolve({ filter: /^(@capacitor\/core|@capacitor\/push-notifications|react)$/ }, a => ({ path: a.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents:
        a.path === 'react' ? `export const useState=v=>[typeof v==='function'?v():v,()=>{}]; export const useRef=v=>({current:v}); export const useCallback=f=>f; export const useEffect=f=>globalThis.effects.push(f);` :
        a.path === '@capacitor/core' ? `export const Capacitor={isNativePlatform:()=>${native},getPlatform:()=>${JSON.stringify(native ? 'ios' : 'web')}};` :
        `export const PushNotifications={checkPermissions:async()=>({receive:'granted'}),register:async()=>{},addListener:(n,f)=>{globalThis.push[n]=f}};`
      }));
    } }],
  });
  vm.runInNewContext(result.outputFiles[0].text, context);
  return { api: context.module.exports, calls, effects, push };
}

test('native rebases local API paths; web and explicit endpoint overrides retain their targets', async () => {
  for (const native of [false, true]) {
    const { api } = await load('src/lib/apiBase.js', native);
    for (const path of ['/api/nowplaying', '/api/push/register', '/api/analytics?site=fixture', 'api/youtube?endpoint=channels']) {
      assert.equal(api.resolveApiUrl(path), native ? 'https://www.truevoice.digital/' + path.replace(/^\//, '') : path);
    }
    for (const target of ['https://configured.example/api/analytics', '//configured.example/api/analytics', '/other']) {
      assert.equal(api.resolveApiUrl(target), target);
    }
  }
});

test('native Now Playing uses the hosted proxy; website retains its existing origin metadata API', async () => {
  for (const native of [false, true]) {
    const { api, calls } = await load('src/services/api.js', native);
    await api.fetchNowPlaying();
    assert.equal(calls[0].url, native ? 'https://www.truevoice.digital/api/nowplaying' : 'https://stream.truevoice.digital/api/nowplaying/truevoice_digital');
    assert.equal(calls[0].options.cache, 'no-store');
  }
});

test('native listener-stat polling uses the hosted proxy without altering headers or deadline', async () => {
  const { api, calls, effects } = await load('src/hooks/useAzuraCast.js', true);
  api.useAzuraCast();
  effects.forEach(f => f());
  assert.equal(calls[0].url, 'https://www.truevoice.digital/api/nowplaying');
  assert.equal(calls[0].options.headers.Accept, 'application/json');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('native push registration keeps method and device-token payload on the hosted API', async () => {
  const { api, calls, push } = await load('src/lib/pushNotifications.js', true);
  await api.initPushNotifications();
  await push.registration({ value: 'offline-device-fixture' });
  assert.equal(calls[0].url, 'https://www.truevoice.digital/api/push/register');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { device_token: 'offline-device-fixture', platform: 'ios' });
});

test('native analytics rebases relative overrides and still suppresses all preview transport', async () => {
  for (const preview of [false, true]) {
    const { api, calls } = await load('src/lib/analytics.js', true, { TRUEVOICE_RESTRICTED_PREVIEW: preview, VITE_ANALYTICS_ENDPOINT: '/api/analytics?site=fixture' });
    api.trackStreamPlay('Fixture');
    assert.equal(calls.length, preview ? 0 : 2);
    if (!preview) {
      assert.equal(calls[1].url, 'https://www.truevoice.digital/api/analytics?site=fixture');
      assert.equal(calls[1].options.method, 'POST');
      assert.equal(JSON.parse(calls[1].options.body).event, 'stream_play');
    }
  }
});

test('native catalog always uses the hosted proxy, even when a public Google key is configured', async () => {
  const { api, calls } = await load('src/lib/youtubeCatalog.js', true, { VITE_YOUTUBE_API_KEY: 'offline-public-fixture' });
  await api.fetchYouTubeCatalog('channels', { part: 'contentDetails', id: 'fixture' });
  assert.equal(new URL(calls[0].url).origin, 'https://www.truevoice.digital');
  assert.equal(new URL(calls[0].url).pathname, '/api/youtube');
  assert.ok(!calls[0].url.includes('offline-public-fixture'));
});

test('native admin requests still require a session and preserve its authorization header', async () => {
  const { api, calls } = await load('src/lib/adminData.js', true);
  await assert.rejects(api.readAdminData('visits', 7, null), /Sign in/);
  assert.equal(calls.length, 0);
  await api.readAdminData('visits', 7, 'offline-session-fixture');
  assert.equal(calls[0].url, 'https://www.truevoice.digital/api/admin-metrics?kind=visits&days=7');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer offline-session-fixture');
});

test('Capacitor config uses the supported bundled local iOS origin, with no remote server override', async () => {
  const { api } = await load('capacitor.config.ts', true);
  assert.equal(api.default.appId, 'digital.truevoice.app');
  assert.equal(api.default.server.hostname, 'localhost');
  assert.equal(api.default.server.iosScheme, 'capacitor');
  assert.equal(api.default.server.url, undefined);
  assert.equal(api.default.webDir, 'dist');
  assert.ok(fs.readFileSync('public/yt-embed.html', 'utf8').includes('https://truevoice.digital/yt-embed.html'));
});
