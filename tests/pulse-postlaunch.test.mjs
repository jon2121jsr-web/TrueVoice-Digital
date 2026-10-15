import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';
import { createMetadataTimeline, metadataDelaySeconds, METADATA_POLL_MS } from '../src/lib/metadataTimeline.js';

const track = (id, start, art = `${id}.jpg`) => ({ played_at: start, song: { id, title: id, artist: 'Artist', art } });

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
