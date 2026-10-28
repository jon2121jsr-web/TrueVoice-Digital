import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { build } from 'esbuild';
import { createMediaCoordinator } from '../src/features/pulse/mediaCoordinator.js';

async function load(entry = 'src/lib/nativeRadio.js', platform = 'ios', plugin = {}) {
  const context = {
    module: { exports: {} }, console, plugin, effects: [], registrations: [], audioCreated: 0, gestures: {},
    Audio: function () { context.audioCreated++; throw Error('Unexpected HTML audio'); },
    media: { stopVideo() {} },
  };
  context.document = { addEventListener: (type, fn) => { context.gestures[type] = fn; } };
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{ name: 'native-audio-fixture', setup(b) {
      b.onResolve({ filter: /^(@capacitor\/core|react)$/ }, a => ({ path: a.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path === 'react'
        ? 'export const createContext=()=>({});export const useContext=()=>globalThis.media;export const useState=v=>[v,()=>{}];export const useEffect=f=>globalThis.effects.push(f);'
        : `export const Capacitor={isNativePlatform:()=>${platform !== 'web'},getPlatform:()=>${JSON.stringify(platform)}};export const registerPlugin=n=>{globalThis.registrations.push(n);return globalThis.plugin;};` }));
    } }],
  });
  vm.runInNewContext(result.outputFiles[0].text, context);
  return { api: context.module.exports, context };
}
const state = (revision, overrides = {}) => ({ revision, owner: 'radio', playing: false, buffering: false, wantsPlayback: false, metadata: {}, ...overrides });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setImmediate(resolve));

test('only native iOS registers AVPlayer bridge; Android/browser have no native radio', async () => {
  for (const platform of ['web', 'android', 'ios']) {
    const { api, context } = await load(undefined, platform);
    assert.equal(api.IS_NATIVE_RADIO, platform === 'ios');
    assert.equal(context.registrations.join(','), platform === 'ios' ? 'TrueVoiceRadio' : '');
    assert.equal(context.audioCreated, 0);
  }
});

test('subscriptions share one connection, do not autoplay, and reject stale native snapshots', async () => {
  const { api } = await load();
  const initial = deferred(); let events, connections = 0;
  const radio = api.createNativeRadio({ addListener: async (_, fn) => { events = fn; connections++; return { remove() {} }; }, getState: () => initial.promise });
  const seen = [];
  const stop = radio.subscribe(s => seen.push(s));
  const stop2 = radio.subscribe(() => {});
  await settle();
  events(state(5, { playing: true, wantsPlayback: true }));
  initial.resolve(state(1)); await settle();
  assert.equal(connections, 1);
  assert.equal(radio.getSnapshot().revision, 5);
  assert.equal(seen.at(-1).playing, true);
  events({ revision: 'malformed' });
  assert.equal(radio.getSnapshot().revision, 5);
  stop(); stop2();
});

test('Play/Pause are serialized; UI never optimistically claims native pause or reconnect success', async () => {
  const { api } = await load(); const pending = deferred(), calls = [];
  const radio = api.createNativeRadio({
    addListener: async () => ({ remove() {} }), getState: async () => state(0),
    play: async args => { calls.push(['play', args]); return pending.promise; },
    pause: async args => { calls.push(['pause', args]); return state(2); },
  });
  const playing = radio.play('radio', true), paused = radio.pause('radio');
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(radio.getSnapshot().playing, false);
  pending.resolve(state(1, { wantsPlayback: true, buffering: true }));
  await playing; await paused;
  assert.equal(calls[0][1].reconnect, true);
  assert.equal(calls[1][0], 'pause');
  assert.equal(radio.getSnapshot().wantsPlayback, false);
});

test('remote/interruption events update subscribers without JavaScript reissuing Play', async () => {
  const { api } = await load(); let events, playCalls = 0;
  const radio = api.createNativeRadio({ addListener: async (_, fn) => { events = fn; return { remove() {} }; }, getState: async () => state(0), play: () => { playCalls++; } });
  const observed = []; radio.subscribe(s => observed.push(s)); await settle();
  events(state(1, { playing: true, wantsPlayback: true }));
  events(state(2, { interrupted: true, wantsPlayback: true }));
  events(state(3)); // User paused during interruption; ended event remains paused.
  events(state(4));
  assert.equal(observed.at(-1).wantsPlayback, false);
  assert.equal(playCalls, 0);
});

test('a queued Play keeps its original intent version so native can reject it after remote Pause', async () => {
  const { api } = await load(); const read = deferred(); let emit, received;
  const radio = api.createNativeRadio({
    addListener: async (_, fn) => { emit = fn; return { remove() {} }; }, getState: () => read.promise,
    play: async args => { received = args; throw Error('stale intent'); },
  });
  const play = radio.play(); await settle();
  emit(state(2, { intentVersion: 1 })); // Native remote Pause supersedes pending JS Play.
  read.resolve(state(2, { intentVersion: 1 }));
  await assert.rejects(play, /stale intent/);
  assert.equal(received.intentVersion, 0);
  assert.equal(radio.getSnapshot().wantsPlayback, false);
});

test('missing bridge fails closed without an HTML-audio fallback or fabricated playback state', async () => {
  const { api, context } = await load();
  const radio = api.createNativeRadio({ addListener: async () => { throw Error('not implemented'); } });
  await assert.rejects(radio.play('radio'));
  assert.match(radio.getSnapshot().error, /Native radio unavailable/);
  assert.equal(context.audioCreated, 0);
});

test('native verse mount/visibility never autoplay; an explicit tap uses the shared bridge', async () => {
  let events; const calls = [];
  const plugin = {
    addListener: async (_, fn) => { events = fn; return { remove() {} }; }, getState: async () => state(0),
    play: async args => { calls.push(args); return state(1, { owner: args.owner, wantsPlayback: true, playing: true }); },
    pause: async () => state(2),
  };
  const { api, context } = await load('src/hooks/useVerseRadioAudio.js', 'ios', plugin);
  const controls = api.useVerseRadioAudio(true);
  context.effects.forEach(fn => fn()); await settle();
  assert.equal(calls.length, 0);
  context.gestures.click({ isTrusted: true });
  controls.toggleMute(); await settle();
  assert.equal(calls.length, 1); assert.equal(calls[0].owner, 'verse');
  events(state(3));
  assert.equal(context.audioCreated, 0);
});

test('native deep-link/programmatic Play requires a trusted user gesture', async () => {
  let played = 0;
  const plugin = {
    addListener: async () => ({ remove() {} }), getState: async () => state(0),
    play: async () => { played++; return state(1, { playing: true, wantsPlayback: true }); },
  };
  const { api, context } = await load(undefined, 'ios', plugin);
  await assert.rejects(api.nativeRadio.play(), /Tap Play/);
  context.gestures.click({ isTrusted: false });
  await assert.rejects(api.nativeRadio.play(), /Tap Play/);
  assert.equal(played, 0);
  context.gestures.click({ isTrusted: true });
  await api.nativeRadio.play();
  assert.equal(played, 1);
});

test('native video waits for pause acknowledgement and invalidates stale handoffs', async () => {
  const pause = deferred(), calls = [];
  const media = createMediaCoordinator({ setVideoActive: active => { calls.push(active); return active ? pause.promise : Promise.resolve(); } });
  const stop = () => {};
  const ready = media.startVideo(stop);
  let allowed = false; ready.then(current => { allowed = current; });
  await settle(); assert.equal(allowed, false);
  media.endVideo(stop);
  pause.resolve(); await ready;
  assert.equal(allowed, false);
  assert.equal(calls.join(','), 'false,true,false');
});

test('failed native handoff never admits video, and closing video never issues radio Play', async () => {
  let played = 0;
  const media = createMediaCoordinator({ setVideoActive: active => active ? Promise.reject(Error('bridge failed')) : Promise.resolve() });
  media.attachRadio({ play: () => { played++; }, pause() {} });
  const stop = () => {};
  await assert.rejects(media.startVideo(stop));
  media.endVideo(stop);
  assert.equal(played, 0);
});

test('Xcode sources, storyboard registration and audio background mode are wired without seeking', () => {
  const project = fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');
  for (const name of ['TrueVoiceRadioPlugin.swift', 'RadioBridgeViewController.swift', 'RadioPlaybackPolicy.swift']) {
    assert.ok(project.includes(name + ' in Sources'));
  }
  assert.ok(fs.readFileSync('ios/App/App/Base.lproj/Main.storyboard', 'utf8').includes('customClass="RadioBridgeViewController"'));
  assert.match(fs.readFileSync('ios/App/App/Info.plist', 'utf8'), /UIBackgroundModes[\s\S]*?<string>audio<\/string>/);
  const swift = fs.readFileSync('ios/App/App/TrueVoiceRadioPlugin.swift', 'utf8');
  assert.ok(swift.includes('https://streaming.live365.com/a61535'));
  assert.doesNotMatch(swift, /stream\.truevoice\.digital\/(?:listen|hls)|seek\(to:/);
  assert.ok(fs.readFileSync('src/App.jsx', 'utf8').includes('!IS_NATIVE_RADIO && <audio'));
});

test('real native PULSE controller renders native events and remote Pause without WebView polling', async () => {
  let emit;
  const slots = []; let index = 0;
  const calls = [];
  const context = {
    module: { exports: {} }, console, URLSearchParams, effects: [], metadataCalls: 0,
    jsx: (component, props) => ({ component, props }),
    hooks: {
      state(initial) {
        const slot = index++;
        if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
        return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }];
      },
      ref(initial) {
        const slot = index++;
        if (!(slot in slots)) slots[slot] = { current: initial };
        return slots[slot];
      },
    },
    window: { location: { search: '' }, setInterval() { throw Error('Unexpected WebView radio timer'); } },
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    plugin: {
      addListener: async (_, fn) => { emit = fn; return { remove() {} }; }, getState: async () => state(0),
      pause: async args => { calls.push(args); return state(3); },
    },
  };
  const result = await build({ entryPoints: ['src/components/NowPlayingPanel.jsx'], bundle: true, write: false, platform: 'node', format: 'cjs',
    jsxFactory: 'globalThis.jsx', define: { 'import.meta.env': '{}' }, loader: { '.css': 'empty' },
    plugins: [{ name: 'native-panel-fixture', setup(b) {
      b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'fixture' }));
      b.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: 'capacitor', namespace: 'fixture' }));
      b.onResolve({ filter: /services\/api$/ }, () => ({ path: 'metadata', namespace: 'fixture' }));
      b.onResolve({ filter: /lib\/analytics\.js$/ }, () => ({ path: 'analytics', namespace: 'fixture' }));
      b.onResolve({ filter: /PulseLive\.jsx$/ }, () => ({ path: 'presentation', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: {
        react: 'export const useState=v=>globalThis.hooks.state(v);export const useRef=v=>globalThis.hooks.ref(v);export const useMemo=f=>f();export const useCallback=f=>f;export const useEffect=f=>globalThis.effects.push(f);export const useLayoutEffect=useEffect;',
        capacitor: 'export const Capacitor={isNativePlatform:()=>true,getPlatform:()=>"ios"};export const registerPlugin=()=>globalThis.plugin;',
        metadata: 'export const fetchNowPlaying=()=>{globalThis.metadataCalls++;throw Error("Unexpected WebView metadata polling");};',
        analytics: 'export const trackStreamPlay=()=>{};',
        presentation: 'export default function PulseLive(){}',
      }[a.path] }));
    } }],
  });
  vm.runInNewContext(result.outputFiles[0].text, context);
  const media = { attachRadio: () => () => {}, stopVideo() {}, isVideoActive: () => false };
  const render = () => { index = 0; return context.module.exports.NowPlayingPanel({ audioRef: { current: null }, media }); };
  render(); const cleanups = context.effects.map(f => f()); await settle();
  emit(state(1, { playing: true, wantsPlayback: true, metadata: { title: 'Native Track', artist: 'Fixture' } }));
  assert.equal(render().props.title, 'Native Track');
  assert.equal(render().props.isPlaying, true);
  emit(state(2)); // Remote Pause arrives from native; never echoed as a JS Play.
  assert.equal(render().props.isPlaying, false);
  assert.equal(context.metadataCalls, 0);
  cleanups.forEach(fn => { if (typeof fn === 'function') fn(); });
  await settle();
  assert.ok(calls.every(args => args.owner === 'radio'));
});
