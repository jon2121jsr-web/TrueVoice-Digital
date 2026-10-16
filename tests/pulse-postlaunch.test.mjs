import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';
import { createMetadataTimeline, metadataDelaySeconds, METADATA_POLL_MS } from '../src/lib/metadataTimeline.js';
import { live365MetadataDelaySeconds, streamMetadataTiming } from '../src/lib/streamMetadataTiming.js';

const track = (id, start, art = `${id}.jpg`) => ({ played_at: start, song: { id, title: id, artist: 'Artist', art } });

test('source timing uses exact LIVE365 station/CDN identity and preserves legacy offsets elsewhere', () => {
  for (const url of ['https://streaming.live365.com/a61535?cache=1', 'https://das-edge93-live365-dal05.cdnstream.com/a61535']) {
    assert.deepEqual(streamMetadataTiming(url, 15), { source: 'live365', seconds: 55 });
    assert.equal(streamMetadataTiming(url, 15, 0).seconds, 0);
  }
  assert.deepEqual(streamMetadataTiming('https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3', 15), { source: 'azuracast', seconds: 15 });
  assert.equal(streamMetadataTiming('https://stream.truevoice.digital/hls/truevoice_digital/live.m3u8', 15).seconds, 15);
  for (const url of ['', 'invalid', 'https://streaming.live365.com.evil.invalid/a61535', 'https://streaming.live365.com/a615350', 'https://evil.invalid/live365', 'http://streaming.live365.com/a61535']) {
    assert.deepEqual(streamMetadataTiming(url, 15), { source: 'other', seconds: 15 });
  }
  for (const value of [undefined, '', 'invalid', -1]) assert.equal(live365MetadataDelaySeconds(value), 55);
  assert.equal(live365MetadataDelaySeconds('55'), 55);
  assert.equal(live365MetadataDelaySeconds('0'), 0);
});

test('fallback retimes a pending LIVE365 song to AzuraCast once without stale rollback', () => {
  const timeline = createMetadataTimeline(55);
  timeline.observe(track('A', 100), 180_000);
  timeline.observe(track('B', 200), 220_000);
  assert.equal(timeline.tick(240_000), null);
  assert.deepEqual(timeline.setDelay(15, 240_000), track('B', 200).song);
  assert.equal(timeline.setDelay(15, 241_000), null);
  assert.equal(timeline.observe(track('A', 100), 242_000), null);
  assert.equal(timeline.tick(255_000), null);
});

test('returning to LIVE365 extends only the pending deadline, preserving the current display', () => {
  const timeline = createMetadataTimeline(15);
  timeline.observe(track('A', 100), 180_000);
  timeline.observe(track('B', 200), 202_000);
  assert.equal(timeline.setDelay(55, 210_000), null);
  assert.equal(timeline.tick(215_000), null);
  assert.equal(timeline.setDelay(55, 230_000), null);
  assert.deepEqual(timeline.tick(255_000), track('B', 200).song);
  assert.equal(timeline.setDelay(15, 260_000), null);
  assert.equal(timeline.setDelay(55, 261_000), null);
  assert.equal(timeline.observe(track('A', 100), 262_000), null);
});

test('zero offset removes the measured configured hold without forecasting the next song', () => {
  const delayed = createMetadataTimeline(15), immediate = createMetadataTimeline(0);
  for (const timeline of [delayed, immediate]) timeline.observe(track('A', 100), 120_000);
  const response = track('B', 200);
  assert.equal(delayed.observe(response, 202_000), null);
  assert.deepEqual(immediate.observe(response, 202_000), response.song);
  assert.equal(delayed.tick(214_000), null);
  assert.deepEqual(delayed.tick(215_000), response.song);
  assert.equal(immediate.tick(215_000), null);
});

test('radio diagnostics are absent in production and passive, opt-in and cleaned up in development', async () => {
  async function diagnostics(dev) {
    const output = await build({ entryPoints: ['src/features/pulse/radioDiagnostics.js'], bundle: true, write: false, format: 'esm', define: { 'import.meta.env.DEV': JSON.stringify(dev) } });
    return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
  }
  const prod = await diagnostics(false), dev = await diagnostics(true);
  const oldWindow = globalThis.window, oldStorage = globalThis.sessionStorage, oldInfo = console.info;
  const listeners = new Map(), logs = [];
  const audio = { src: 'https://streaming.live365.com/a61535?token=private', paused: false, currentTime: 4,
    readyState: 4, networkState: 2, buffered: { length: 1, start: () => 0, end: () => 7 },
    addEventListener: (event, listener) => listeners.set(event, listener),
    removeEventListener: event => listeners.delete(event),
    load() { assert.fail('Diagnostics must not reload audio'); }, play() { assert.fail('Diagnostics must not play audio'); }, pause() { assert.fail('Diagnostics must not pause audio'); },
  };
  try {
    globalThis.window = { location: { search: '?pulseRadioDebug=1', href: 'http://localhost:5173/' } };
    globalThis.sessionStorage = { getItem: () => null };
    console.info = (...args) => logs.push(args);
    prod.observeRadioDiagnostics(audio)(); prod.radioDiagnostic('test', audio);
    assert.equal(logs.length, 0); assert.equal(listeners.size, 0);
    const cleanup = dev.observeRadioDiagnostics(audio, () => ({ wantsPlayback: true }));
    listeners.get('waiting')();
    assert.equal(logs.at(-1)[2].bufferedAhead, 3);
    assert.equal(logs.at(-1)[2].source, 'https://streaming.live365.com/a61535');
    assert.equal(JSON.stringify(logs).includes('private'), false);
    cleanup(); assert.equal(listeners.size, 0);
    window.location.search = ''; logs.length = 0;
    dev.observeRadioDiagnostics(audio)();
    assert.equal(logs.length, 0); assert.equal(listeners.size, 0);
  } finally { globalThis.window = oldWindow; globalThis.sessionStorage = oldStorage; console.info = oldInfo; }
});

test('source timestamp consumes elapsed delay instead of adding a fresh hold', () => {
  const timeline = createMetadataTimeline(15);
  assert.equal(timeline.observe(track('A', 100), 110_000).title, 'A');
  assert.equal(timeline.observe(track('B', 200), 212_000), null);
  assert.equal(timeline.tick(214_999), null);
  assert.equal(timeline.tick(215_000).title, 'B');
  assert.equal(timeline.tick(216_000), null);
  assert.equal(timeline.observe(track('C', 300), 325_000).title, 'C');
});

test('duplicates and artwork refinements do not move the pending deadline', () => {
  const timeline = createMetadataTimeline(15);
  timeline.observe(track('A', 100), 120_000);
  timeline.observe(track('B', 200), 202_000);
  timeline.observe(track('B', 200, 'final-art.jpg'), 212_000);
  const song = timeline.tick(215_000);
  assert.deepEqual(song, track('B', 200, 'final-art.jpg').song);
  assert.equal(timeline.observe(track('B', 200, 'final-art.jpg'), 220_000), null);
});

test('stale snapshots cannot roll back metadata before or after a pending flip', () => {
  const timeline = createMetadataTimeline(15);
  timeline.observe(track('A', 100), 120_000);
  timeline.observe(track('B', 200), 202_000);
  assert.equal(timeline.observe(track('A', 100), 210_000), null);
  assert.equal(timeline.tick(215_000).title, 'B');
  assert.equal(timeline.observe(track('A', 100), 220_000), null);
  assert.equal(timeline.observe(track('wrong', 200), 221_000), null);
  assert.equal(timeline.tick(240_000), null);
});

test('missing timestamps do not invent a delay and repeated song IDs can recur', () => {
  const timeline = createMetadataTimeline(15);
  timeline.observe(track('A', 100), 120_000);
  assert.equal(timeline.observe(track('B', 0), 200_000).title, 'B');
  assert.equal(timeline.observe(track('A', 300), 320_000).title, 'A');
  assert.equal(timeline.observe({ song: {} }, 330_000), null);
  assert.equal(metadataDelaySeconds(undefined), 0);
  assert.equal(metadataDelaySeconds(''), 0);
  assert.equal(metadataDelaySeconds('invalid'), 0);
  assert.equal(metadataDelaySeconds('-15'), 0);
  assert.equal(metadataDelaySeconds('15'), 15);
  assert.equal(METADATA_POLL_MS, 5000);
});

test('metadata fetch bypasses HTTP cache and preserves source timing/next-song fields', async () => {
  const output = await build({ entryPoints: ['src/services/api.js'], bundle: true, write: false, format: 'esm', define: { 'import.meta.env': '{}' } });
  const api = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ now_playing: track('B', 200), playing_next: track('C', 300) }) };
  };
  try {
    const result = await api.fetchNowPlaying();
    assert.equal(requests[0].options.cache, 'no-store');
    assert.equal(result.now_playing.played_at, 200);
    assert.equal(result.playing_next.played_at, 300);
    assert.equal(result.playing_next.song.title, 'C');
  } finally { globalThis.fetch = originalFetch; }
});

test('web icons match the approved header geometry and built references resolve', () => {
  const source = fs.readFileSync('src/App.jsx', 'utf8');
  const header = source.match(/<svg className="tv-brand-wave"[\s\S]*?<\/svg>/)[0];
  const favicon = fs.readFileSync('public/truevoice-waveform-v1.svg', 'utf8');
  assert.deepEqual(favicon.match(/<rect[^>]+>/g), header.match(/<rect[^>]+>/g));
  for (const color of ['#00d9eb', '#0086ff']) assert.ok(favicon.includes(color));
  const manifest = JSON.parse(fs.readFileSync('dist/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    assert.ok(icon.src.includes('waveform-v1'));
    const bytes = fs.readFileSync(`dist${icon.src}`);
    assert.deepEqual(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
    assert.ok(fs.readFileSync('dist/sw.js', 'utf8').includes(icon.src.slice(1)));
  }
  const html = fs.readFileSync('dist/index.html', 'utf8');
  for (const href of [...html.matchAll(/<link\s[^>]*rel="(?:icon|apple-touch-icon|apple-touch-startup-image)"[^>]*href="([^"]+)"/g)].map(match => match[1])) {
    assert.ok(fs.existsSync(`dist${href}`), href);
    assert.ok(href.includes('waveform-v1'), href);
  }
  assert.ok(html.includes('/truevoice-waveform-v1.svg'));
});
