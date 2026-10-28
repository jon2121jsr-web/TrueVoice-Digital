import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';
import { preferredStreamUrl, LIVE365_STREAM_URL } from '../src/lib/streamUrl.js';

test('all platforms and legacy overrides resolve only to approved Live365', () => {
  for (const platform of ['desktop', 'Safari', 'PWA', 'ios']) {
    for (const override of [undefined, '', 'https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3',
      'https://stream.truevoice.digital/hls/truevoice_digital/live.m3u8', 'https://unapproved.invalid/']) {
      assert.equal(preferredStreamUrl(override, platform), LIVE365_STREAM_URL);
    }
  }
});

test('listener entry points do not consume legacy routing overrides or origin URLs', () => {
  for (const file of ['src/App.jsx', 'src/hooks/useVerseRadioAudio.js', 'src/components/NowPlayingPanel.jsx']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /VITE_TRUEVOICE_STREAM_URL|radio\.mp3|live\.m3u8|AZURACAST_FALLBACK/);
  }
});

test('actual verse helper retains Live365 after rejection and retries only on user action', async () => {
  const effects = [], cleanups = [], previousAudio = globalThis.Audio;
  let audio, plays = 0;
  globalThis.Audio = class {
    constructor() { audio = this; this.src = ''; }
    play() { plays++; return Promise.reject(new Error('transport unavailable')); }
    pause() {}
  };
  globalThis.__verseEffects = effects;
  try {
    const result = await build({ entryPoints: ['src/hooks/useVerseRadioAudio.js'], bundle: true,
      write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'offline-react', setup(b) {
        b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents:
          'export const createContext=()=>({}); export const useContext=()=>null; export const useState=v=>[v,()=>{}]; export const useEffect=f=>globalThis.__verseEffects.push(f);' }));
      } }] });
    const mod = { exports: {} };
    new Function('module', 'exports', result.outputFiles[0].text)(mod, mod.exports);
    const state = mod.exports.useVerseRadioAudio(true);
    for (const effect of effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
    await Promise.resolve(); await Promise.resolve();
    assert.equal(audio.src, LIVE365_STREAM_URL);
    assert.equal(plays, 1);
    state.toggleMute();
    await Promise.resolve(); await Promise.resolve();
    assert.equal(audio.src, LIVE365_STREAM_URL);
    assert.equal(plays, 2);
  } finally {
    cleanups.forEach(f => f()); globalThis.Audio = previousAudio; delete globalThis.__verseEffects;
  }
});
