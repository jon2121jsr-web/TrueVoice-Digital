import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { matchRoutes, MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import { EXPLORE_CATEGORIES, exploreSections, exploreVideos, scrollDiscoveryLink, exploreModalVideo } from "../src/features/pulse/exploreContent.js";
import { createMediaCoordinator } from "../src/features/pulse/mediaCoordinator.js";
import { createVideoQueue, queueDestination, createEndedGuard } from "../src/features/pulse/videoQueue.js";
import { exploreShareUrl, exploreVideoLocation, resolveExploreLink, isLocallyLiked, setLocalLike } from "../src/features/pulse/videoEngagement.js";
import { playbackProgress, createPositionObserver } from "../src/features/pulse/videoProgress.js";
import { selectScrollItems } from "../src/lib/scrollItems.js";
import { withVideoControls, selectVideoBridge } from "../src/lib/videoEmbed.js";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const appSource = fs.readFileSync("src/App.jsx", "utf8");
const ast = parse(appSource, { sourceType: "module", plugins: ["jsx"] });
function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, visit)); return; }
  visit(node);
  Object.values(node).forEach((value) => { if (value && typeof value === "object") walk(value, visit); });
}
function name(node) { return node?.openingElement?.name?.name; }
let routesNode;
walk(ast, (node) => { if (name(node) === "Routes") routesNode = node; });
function route(node) {
  const attrs = node.openingElement.attributes;
  return {
    id: `route-${node.start}`,
    path: attrs.find((attr) => attr.name?.name === "path")?.value?.value,
    index: attrs.some((attr) => attr.name?.name === "index"),
    children: node.children.filter((child) => name(child) === "Route").map(route),
  };
}
const routes = routesNode.children.filter((node) => name(node) === "Route").map(route);

test("actual route declarations share the radio parent and preserve isolated routes", () => {
  const home = matchRoutes(routes, "/");
  const explore = matchRoutes(routes, "/explore");
  assert.equal(home[0].route.id, explore[0].route.id);
  for (const path of ["/admin", "/privacy", "/scroll", "/scroll/item-id"]) {
    assert.notEqual(matchRoutes(routes, path)[0].route.id, home[0].route.id);
  }
  // Production has no dedicated Drop Portal route; unknown paths keep its Home fallback.
  assert.equal(matchRoutes(routes, "/drop")[0].route.id, home[0].route.id);
  assert.ok(!appSource.includes('DropPortal'));
  const parent = routesNode.children.find((node) => name(node) === "Route" && node.start === Number(home[0].route.id.slice(6)));
  const counts = { audio: 0, NowPlayingPanel: 0 };
  walk(parent.openingElement, (node) => { if (Object.hasOwn(counts, name(node))) counts[name(node)]++; });
  assert.deepEqual(counts, { audio: 1, NowPlayingPanel: 1 });
  assert.ok(appSource.includes('media.playRadio({ reconnect: true })'));
});

test("media coordination stops competing video, never resumes on close, and releases owners", () => {
  const media = createMediaCoordinator();
  let plays = 0, pauses = 0, stops = 0;
  const detach = media.attachRadio({ play: () => plays++, pause: () => pauses++ });
  const first = () => stops++;
  const second = () => stops++;
  media.startVideo(first);
  assert.equal(pauses, 1);
  media.startVideo(second);
  assert.equal(stops, 1);
  media.endVideo(first);
  assert.equal(media.isVideoActive(), true);
  media.endVideo(second);
  assert.equal(media.isVideoActive(), false);
  assert.equal(plays, 0);
  media.playRadio();
  assert.equal(plays, 1);
  detach();
  media.playRadio();
  assert.equal(plays, 1);
});

test("actual Media Session handlers use coordinated commands and clean up on layout exit", () => {
  let declaration;
  walk(ast, (node) => { if (node.type === "FunctionDeclaration" && node.id?.name === "wireMediaSessionControls") declaration = node; });
  const wire = new Function(`return (${appSource.slice(declaration.start, declaration.end)});`)();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const actions = new Map(), listeners = new Map(), calls = [];
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    mediaSession: { setActionHandler: (action, handler) => actions.set(action, handler) },
  } });
  try {
    const cleanup = wire({ paused: true, addEventListener: (event, fn) => listeners.set(event, fn), removeEventListener: (event) => listeners.delete(event) }, {
      playRadio: (options) => calls.push(["play", options]), pauseAll: () => calls.push(["pause"]),
    });
    actions.get("play")();
    actions.get("pause")();
    assert.deepEqual(calls, [["play", undefined], ["pause"]]);
    cleanup();
    assert.equal(actions.get("play"), null);
    assert.equal(actions.get("pause"), null);
    assert.equal(listeners.size, 0);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else delete globalThis.navigator;
  }
});

async function compiled(file, plugins = [], env = {}) {
  const result = await build({
    entryPoints: [file], bundle: true, write: false, outdir: "unused",
    platform: "node", format: "cjs", jsx: "automatic",
    external: ["react", "react/jsx-runtime", "react-router-dom"],
    define: { "import.meta.env": JSON.stringify(env) },
    loader: { ".css": "empty" }, plugins,
  });
  const mod = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(require, mod, mod.exports);
  return mod.exports;
}

// Execute the existing controller with deterministic hook slots, audio, and timers.
// These are command/lifetime tests, not browser autoplay or audible-playback tests.
async function compileController(env = {}) {
  return (await compiled("./src/components/NowPlayingPanel.jsx", [{
  name: "controller-fixtures",
  setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: "hooks", namespace: "fixture" }));
    build.onResolve({ filter: /services\/api$/ }, () => ({ path: "api", namespace: "fixture" }));
    build.onResolve({ filter: /lib\/analytics\.js$/ }, () => ({ path: "analytics", namespace: "fixture" }));
    build.onResolve({ filter: /features\/pulse\/PulseLive\.jsx$/ }, () => ({ path: "view", namespace: "fixture" }));
    build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: {
      hooks: `const h = () => globalThis.__pulseHarness;
        export const useRef = v => h().ref(v);
        export const useState = v => h().state(v);
        export const useMemo = (fn,d) => h().memo(fn,d);
        export const useCallback = (fn,d) => h().memo(() => fn,d);
        export const useEffect = (fn,d) => h().effect(fn,d);
        export const useLayoutEffect = (fn,d) => h().effect(fn,d);`,
      api: `export async function fetchNowPlaying(){ const h=globalThis.__pulseHarness; h.fetches++; return h.response ?? {now_playing:{song:{id:'fixture',title:'Test track',artist:'Test artist'}}}; }`,
      analytics: "export function trackStreamPlay() {}",
      view: "export default function PulseLive() { return null; }",
    }[path] }));
  },
}], { VITE_STREAM_DELAY_SEC: '15', ...env })).NowPlayingPanel;
}
const controller = await compileController();

class Harness {
  slots = []; pending = []; cursor = 0; fetches = 0;
  context = null;
  constructor(component = controller) { this.component = component; }
  ref(value) { const i = this.cursor++; return this.slots[i] ??= { current: value }; }
  state(value) {
    const i = this.cursor++;
    this.slots[i] ??= { value: typeof value === "function" ? value() : value };
    return [this.slots[i].value, (next) => { this.slots[i].value = typeof next === "function" ? next(this.slots[i].value) : next; }];
  }
  changed(i, deps) { return !this.slots[i] || !deps || deps.some((d, n) => d !== this.slots[i].deps[n]); }
  memo(fn, deps) { const i = this.cursor++; if (this.changed(i, deps)) this.slots[i] = { deps, value: fn() }; return this.slots[i].value; }
  effect(fn, deps) { const i = this.cursor++; if (this.changed(i, deps)) this.pending.push(() => { this.slots[i]?.cleanup?.(); this.slots[i] = { deps, cleanup: fn() }; }); }
  render(props) { this.cursor = 0; globalThis.__pulseHarness = this; const view = this.component(props); this.pending.splice(0).forEach((fn) => fn()); return view; }
  unmount() { this.slots.forEach((slot) => slot?.cleanup?.()); }
}

// A clock and media element with independent play promises, native events and
// playback position. No real network, browser audio, or wall-clock sleeps.
async function recoveryFixture(run) {
  const saved = { window: globalThis.window, document: globalThis.document,
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    performance: globalThis.performance };
  let now = 0, id = 0, loads = 0, plays = 0, writes = 0, source = '';
  const tasks = new Map(), events = new Map(), windowEvents = new Map(), documentEvents = new Map();
  const listen = map => ({
    addEventListener(k, fn) { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(fn); },
    removeEventListener(k, fn) { map.get(k)?.delete(fn); },
  });
  const emit = (map, k) => [...(map.get(k) || [])].forEach(fn => fn());
  const schedule = (fn, ms, repeat = false) => { tasks.set(++id, { fn, at: now + ms, ms, repeat }); return id; };
  globalThis.performance = { now: () => now };
  globalThis.setTimeout = (fn, ms) => schedule(fn, ms);
  globalThis.clearTimeout = i => tasks.delete(i);
  globalThis.window = { location: { search: '' }, ...listen(windowEvents),
    setInterval: (fn, ms) => schedule(fn, ms, true), clearInterval: i => tasks.delete(i),
    clearTimeout: globalThis.clearTimeout };
  globalThis.document = { hidden: false, visibilityState: 'visible', ...listen(documentEvents) };
  const audio = {
    get src() { return source; }, set src(v) { writes++; source = v; },
    get currentSrc() { return source; }, paused: true, currentTime: 0, readyState: 4, networkState: 2,
    buffered: { length: 1, start: () => 0, end: () => audio.currentTime + 10 },
    ...listen(events), playResult: () => Promise.resolve(),
    load() { loads++; this.currentTime = 0; this.paused = true; },
    play() { plays++; this.paused = false; emit(events, 'play'); return this.playResult(); },
    pause() { this.paused = true; emit(events, 'pause'); },
  };
  const h = new Harness(), media = createMediaCoordinator();
  const props = { audioRef: { current: audio }, streamUrl: 'https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3', media };
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  const f = { audio, media, events, tasks, props,
    liveWindow(lag = 10) {
      audio.duration = Infinity;
      audio.seekable = { length: 1, start: () => 0, end: () => now / 1000 + lag };
    },
    emit: k => emit(events, k), online: () => emit(windowEvents, 'online'),
    view: () => h.render(props), counts: () => ({ loads, plays, writes }),
    unmount: () => h.unmount(),
    async advance(ms, progress = false) {
      const end = now + ms;
      while (true) {
        const next = [...tasks].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [key, task] = next;
        if (progress && !audio.paused) audio.currentTime += (task.at - now) / 1000;
        now = task.at;
        if (task.repeat) task.at += task.ms; else tasks.delete(key);
        task.fn(); await flush();
      }
      if (progress && !audio.paused) audio.currentTime += (end - now) / 1000;
      now = end; await flush();
    },
    async start() { media.playRadio(); await flush(); await this.advance(1000, true); },
  };
  try { h.render(props); await flush(); await run(f); }
  finally { h.unmount(); Object.assign(globalThis, saved); delete globalThis.__pulseHarness; }
}

test('recovery: persistent unpaused no-progress recovers even without native stall events', () => recoveryFixture(async f => {
  await f.start(); const before = f.counts().loads;
  await f.advance(13000);
  assert.equal(f.audio.paused, false);
  assert.equal(f.counts().loads, before + 1);
}));

test('recovery: waiting alone eventually recovers, but never immediately', () => recoveryFixture(async f => {
  await f.start(); const before = f.counts().loads;
  f.emit('waiting'); await f.advance(3000); assert.equal(f.counts().loads, before);
  await f.advance(10000); assert.equal(f.counts().loads, before + 1);
}));

test('recovery: brief waiting/stalled followed by progress never reloads', () => recoveryFixture(async f => {
  await f.start(); const before = f.counts();
  f.emit('waiting'); f.emit('stalled'); await f.advance(3000);
  f.emit('playing'); await f.advance(30000, true);
  assert.deepEqual(f.counts(), before); assert.equal(f.view().props.isReconnecting, false);
}));

test('continuity: healthy moving live window preserves ordinary provider latency and idempotent Play', () => recoveryFixture(async f => {
  f.liveWindow(55); await f.start(); const before = f.counts();
  await f.advance(60000, true); f.media.playRadio();
  assert.deepEqual(f.counts(), before);
}));

test('continuity: short buffered resume with confirmed persistent added live lag reloads once and recovers', () => recoveryFixture(async f => {
  f.liveWindow(); await f.start(); await f.advance(5000, true);
  const before = f.counts();
  f.emit('waiting'); await f.advance(4000);
  assert.equal(f.counts().loads, before.loads);
  await f.advance(4000, true);
  assert.equal(f.counts().loads, before.loads + 1);
  assert.equal(f.counts().writes, before.writes, 'same source only');
  await f.advance(2000, true);
  assert.equal(f.view().props.isReconnecting, false);
  await f.advance(5000, true); f.emit('waiting'); await f.advance(4000);
  await f.advance(60000, true);
  assert.equal(f.counts().loads, before.loads + 1, 'no stale-rejoin loop even if lag remains');
}));

test('continuity: sub-threshold short stall with live window does not interrupt resumed audio', () => recoveryFixture(async f => {
  f.liveWindow(); await f.start(); await f.advance(5000, true); const before = f.counts();
  f.emit('stalled'); await f.advance(2000); await f.advance(20000, true);
  assert.deepEqual(f.counts(), before);
}));

for (const cancel of ['Pause', 'video']) {
  test(`continuity: ${cancel} during stale confirmation prevents live rejoin`, () => recoveryFixture(async f => {
    f.liveWindow(); await f.start(); await f.advance(5000, true);
    f.emit('waiting'); await f.advance(4000); await f.advance(1000, true);
    if (cancel === 'Pause') f.media.pauseRadio(); else f.media.startVideo(() => {});
    const before = f.counts(); await f.advance(60000, true);
    assert.deepEqual(f.counts(), before); assert.equal(f.audio.paused, true);
  }));
}

test('continuity: finite media and absent seekable data never invent a live position', () => recoveryFixture(async f => {
  f.liveWindow(); f.audio.duration = 300;
  await f.start(); await f.advance(5000, true); const before = f.counts();
  f.emit('waiting'); await f.advance(4000); await f.advance(20000, true);
  assert.deepEqual(f.counts(), before);
  f.audio.duration = Infinity; f.audio.seekable = { length: 0 };
  f.emit('waiting'); await f.advance(4000); await f.advance(20000, true);
  assert.deepEqual(f.counts(), before);
}));

test('continuity: stale rejoin respects autoplay denial and cannot retry automatically', () => recoveryFixture(async f => {
  f.liveWindow(); await f.start(); await f.advance(5000, true);
  f.audio.playResult = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
  f.emit('waiting'); await f.advance(4000); await f.advance(4000, true);
  const before = f.counts(); await f.advance(60000);
  assert.deepEqual(f.counts(), before); assert.match(f.view().props.error, /allow audio/);
}));

test('recovery: online is not playback proof and cannot bypass stalled recovery', () => recoveryFixture(async f => {
  await f.start(); const before = f.counts().loads;
  f.emit('waiting'); await f.advance(4000); f.online();
  assert.equal(f.view().props.isReconnecting, true);
  assert.equal(f.counts().loads, before);
  await f.advance(9000); assert.equal(f.counts().loads, before + 1);
}));

test('recovery: duplicate normal Play preserves healthy and pending playback', () => recoveryFixture(async f => {
  await f.start(); const before = f.counts();
  f.media.playRadio(); f.media.playRadio(); assert.deepEqual(f.counts(), before);
  f.media.pauseRadio(); let resolve;
  f.audio.playResult = () => new Promise(r => { resolve = r; });
  f.media.playRadio(); const starting = f.counts();
  f.media.playRadio(); assert.deepEqual(f.counts(), starting); resolve();
}));

for (const cancellation of ['Pause', 'video', 'unmount']) {
  test(`recovery: ${cancellation} cancels pending and late recovery`, () => recoveryFixture(async f => {
    await f.start(); let reject;
    f.audio.playResult = () => new Promise((_, r) => { reject = r; });
    f.emit('waiting'); await f.advance(13000);
    assert.equal(typeof reject, 'function', 'a recovery play must be pending');
    if (cancellation === 'Pause') f.media.pauseRadio();
    if (cancellation === 'video') f.media.startVideo(() => {});
    if (cancellation === 'unmount') { f.props.audioRef.current = null; f.unmount(); }
    const before = f.counts(); reject(new Error('late transport failure'));
    f.online(); await f.advance(120000);
    assert.deepEqual(f.counts(), before); assert.equal(f.audio.paused, true);
  }));
}

test('recovery: failures use backoff, a finite budget and no identical fallback switch', () => recoveryFixture(async f => {
  await f.start(); const before = f.counts();
  f.audio.playResult = () => Promise.reject(new DOMException('transport', 'NetworkError'));
  f.emit('waiting'); await f.advance(13000);
  assert.equal(f.counts().loads, before.loads + 1);
  await f.advance(2000); assert.equal(f.counts().loads, before.loads + 1);
  await f.advance(120000);
  assert.equal(f.counts().loads, before.loads + 3);
  assert.equal(f.counts().writes, before.writes);
  assert.match(f.view().props.error, /retry/i);
  assert.equal(f.view().props.isReconnecting, false);
}));

test('recovery: real progress resets the retry budget and buffering state', () => recoveryFixture(async f => {
  await f.start(); const before = f.counts().loads;
  f.emit('waiting'); await f.advance(13000);
  assert.equal(f.counts().loads, before + 1);
  f.emit('playing'); assert.equal(f.view().props.isReconnecting, true, 'playing alone cannot prove time advanced');
  await f.advance(2000, true); assert.equal(f.view().props.isReconnecting, false);
  f.audio.playResult = () => Promise.reject(new DOMException('transport', 'NetworkError'));
  f.emit('waiting'); await f.advance(120000);
  assert.equal(f.counts().loads, before + 4);
}));

for (const name of ['NotAllowedError', 'AbortError']) {
  test(`recovery: ${name} stops automatic retries until a fresh Play`, () => recoveryFixture(async f => {
    f.audio.playResult = () => Promise.reject(new DOMException('private failure text', name));
    f.media.playRadio({ reconnect: true }); await f.advance(120000);
    assert.equal(f.counts().plays, 1); assert.equal(f.view().props.isReconnecting, false);
    assert.match(f.view().props.error, name === 'NotAllowedError' ? /tap.*play/i : /interrupted/i);
    f.audio.playResult = () => Promise.resolve(); await f.start();
    assert.equal(f.view().props.error, null);
  }));
}

test('recovery: unresolved play promises are bounded, not overlapping attempts', () => recoveryFixture(async f => {
  await f.start(); const before = f.counts().loads;
  const reject = []; f.audio.playResult = () => new Promise((_, r) => reject.push(r));
  await f.advance(120000); assert.equal(f.counts().loads, before + 3);
  const stopped = f.counts(); reject.forEach(r => r(new Error('late')));
  await f.advance(120000); assert.deepEqual(f.counts(), stopped);
}));

for (const cancellation of ['Pause', 'video', 'unmount']) {
  test(`recovery: ${cancellation} during grace prevents the first recovery`, () => recoveryFixture(async f => {
    await f.start(); f.emit('waiting'); await f.advance(4000);
    if (cancellation === 'Pause') f.media.pauseRadio();
    if (cancellation === 'video') f.media.startVideo(() => {});
    if (cancellation === 'unmount') f.unmount();
    const before = f.counts(); f.online(); await f.advance(120000);
    assert.deepEqual(f.counts(), before); assert.equal(f.audio.paused, true);
  }));
}

test('recovery: initial Play uses prewarm; explicit reconnect retains buffering until progress', () => recoveryFixture(async f => {
  f.media.playRadio(); assert.equal(f.counts().loads, 0);
  assert.equal(f.view().props.isReconnecting, true);
  await f.advance(1000, true); assert.equal(f.view().props.isReconnecting, false);
  const before = f.counts().loads;
  f.emit('waiting'); f.media.playRadio({ reconnect: true });
  assert.equal(f.counts().loads, before + 1);
  f.emit('playing'); assert.equal(f.view().props.isReconnecting, true);
  await f.advance(1000, true); assert.equal(f.view().props.isReconnecting, false);
}));

test('recovery: fresh user Play resumes a native pause despite retained intent', () => recoveryFixture(async f => {
  await f.start(); f.audio.pause(); const before = f.counts();
  f.media.playRadio();
  assert.equal(f.counts().plays, before.plays + 1);
  assert.equal(f.counts().loads, before.loads + 1);
  await f.advance(1000, true); assert.equal(f.view().props.isReconnecting, false);
}));

test('LIVE controller polls single-flight and publishes title/art together without restarting audio', async () => {
  const oldWindow = globalThis.window, oldNow = Date.now;
  const intervals = new Map();
  globalThis.window = { location: { search: '' }, clearTimeout() {}, setInterval(fn, ms) { intervals.set(ms, fn); return ms; }, clearInterval(ms) { intervals.delete(ms); } };
  Date.now = () => 250_000;
  const h = new Harness();
  const props = { audioRef: { current: null } };
  try {
    h.render(props);
    intervals.get(5000)(); // Initial fetch has not settled yet.
    assert.equal(h.fetches, 1);
    await Promise.resolve();
    await Promise.resolve();
    let view = h.render(props);
    assert.equal(view.props.title, 'Test track');
    h.response = { now_playing: { played_at: 200, song: { id: 'new', title: 'New track', art: 'new.jpg' } } };
    intervals.get(5000)();
    await Promise.resolve();
    await Promise.resolve();
    view = h.render(props);
    assert.equal(view.props.title, 'New track');
    assert.equal(view.props.art, 'new.jpg');
    assert.equal(view.props.isPlaying, false);
    intervals.get(1000)();
    assert.equal(h.render(props).props.title, 'New track');
  } finally {
    h.unmount();
    assert.equal(intervals.size, 0);
    globalThis.window = oldWindow;
    Date.now = oldNow;
    delete globalThis.__pulseHarness;
  }
});

test('song polling, listener changes and buffering events never reset a playing audio element', async () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  const oldTimeout = globalThis.setTimeout, oldClear = globalThis.clearTimeout;
  const intervals = new Map(), timers = new Map(), events = new Map();
  let source = '', sourceWrites = 0, loads = 0, plays = 0, pauses = 0, timerId = 0;
  const audio = {
    get src() { return source; }, set src(value) { sourceWrites++; source = value; }, paused: true,
    load() { loads++; },
    play() { plays++; this.paused = false; events.get('play')?.(); return Promise.resolve(); },
    pause() { pauses++; this.paused = true; events.get('pause')?.(); },
    addEventListener: (event, listener) => events.set(event, listener), removeEventListener: event => events.delete(event),
  };
  globalThis.window = { location: { search: '' }, setInterval(fn, ms) { intervals.set(ms, fn); return ms; },
    clearInterval: ms => intervals.delete(ms), clearTimeout: id => timers.delete(id), addEventListener() {}, removeEventListener() {} };
  globalThis.document = { hidden: false, visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  globalThis.setTimeout = fn => { const id = ++timerId; timers.set(id, fn); return id; };
  globalThis.clearTimeout = window.clearTimeout;
  const h = new Harness(), media = createMediaCoordinator();
  const props = { audioRef: { current: audio }, streamUrl: 'https://streaming.live365.com/a61535', media };
  try {
    h.render(props); await Promise.resolve();
    media.playRadio(); h.render(props);
    const initial = { sourceWrites, loads, plays, pauses };
    for (let n = 1; n <= 6; n++) {
      h.response = { listeners: { current: n }, now_playing: { played_at: n, song: { id: `song-${n}`, title: `Song ${n}`, art: `art-${n}.jpg` } } };
      intervals.get(5000)(); await Promise.resolve(); await Promise.resolve();
      const view = h.render({ ...props, compact: n % 2 === 0, isFloating: n % 2 === 1 });
      assert.equal(view.props.title, `Song ${n}`);
      events.get('waiting')(); events.get('stalled')();
      for (const [id, callback] of timers) { timers.delete(id); callback(); }
      events.get('playing')(); h.render(props);
    }
    assert.deepEqual({ sourceWrites, loads, plays, pauses }, initial);
    assert.equal(h.fetches, 7);
    media.pauseRadio(); media.playRadio();
    assert.equal(loads, initial.loads + 1); // A deliberate resume still snaps to live.
  } finally {
    h.unmount(); globalThis.window = oldWindow; globalThis.document = oldDocument;
    globalThis.setTimeout = oldTimeout; globalThis.clearTimeout = oldClear;
    delete globalThis.__pulseHarness;
  }
});

test('explicit reconnect rejection retains Live365 and its pending metadata timing', async () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document, oldNow = Date.now;
  const intervals = new Map(), listeners = new Map();
  const primary = 'https://streaming.live365.com/a61535';
  let assigned = primary, selected = primary, now = 180_000, rejectPrimary = false;
  let loads = 0, plays = 0, writes = 0;
  const emit = event => [...(listeners.get(event) || [])].forEach(fn => fn());
  const audio = {
    get src() { return assigned; }, set src(value) { writes++; assigned = value; },
    get currentSrc() { return selected; }, paused: true,
    load() { loads++; selected = assigned; emit('loadedmetadata'); },
    play() {
      plays++; this.paused = false; emit('play');
      if (rejectPrimary && assigned === primary) { rejectPrimary = false; return Promise.reject(new Error('Primary failed')); }
      emit('playing'); return Promise.resolve();
    },
    pause() { this.paused = true; emit('pause'); },
    addEventListener(event, fn) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn); },
    removeEventListener(event, fn) { listeners.get(event)?.delete(fn); },
  };
  globalThis.window = { location: { search: '' }, setInterval(fn, ms) { intervals.set(ms, fn); return ms; },
    clearInterval: ms => intervals.delete(ms), clearTimeout() {}, addEventListener() {}, removeEventListener() {} };
  globalThis.document = { hidden: false, visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  Date.now = () => now;
  const h = new Harness(), media = createMediaCoordinator();
  const props = { audioRef: { current: audio }, streamUrl: primary, media };
  const response = (id, start) => ({ now_playing: { played_at: start, song: { id, title: id, art: `${id}.jpg` } } });
  h.response = response('A', 100);
  try {
    h.render(props); await Promise.resolve(); await Promise.resolve();
    media.playRadio(); h.render(props);
    now = 202_000; h.response = response('B', 200);
    intervals.get(5000)(); await Promise.resolve(); await Promise.resolve();
    assert.equal(h.render(props).props.title, 'A');
    // A rejected reconnect must retain the Live365 metadata delay.
    now = 220_000; intervals.get(1000)();
    assert.equal(h.render(props).props.title, 'A');
    rejectPrimary = true; media.playRadio({ reconnect: true });
    await Promise.resolve(); await Promise.resolve();
    assert.equal(audio.currentSrc, primary);
    assert.equal(h.render(props).props.title, 'A');
    now = 255_000; intervals.get(1000)();
    assert.equal(h.render(props).props.title, 'B');
    assert.equal(h.render(props).props.art, 'B.jpg');
    assert.equal(h.fetches, 2); // No poll restart or extra source-change request.
    const transport = { loads, plays, writes };
    now = 255_000; intervals.get(1000)(); h.render(props);
    assert.deepEqual({ loads, plays, writes }, transport);
    now = 302_000; h.response = response('C', 300);
    intervals.get(5000)(); await Promise.resolve(); await Promise.resolve();
    media.playRadio({ reconnect: true }); // Existing explicit primary retry.
    assert.equal(audio.currentSrc, primary);
    selected = ''; now = 315_000; intervals.get(1000)();
    assert.equal(h.render(props).props.title, 'B'); // Empty resource does not reset to 15.
    selected = primary; now = 355_000; intervals.get(1000)();
    assert.equal(h.render(props).props.title, 'C');
    assert.equal(h.fetches, 3);
  } finally {
    h.unmount();
    assert.equal([...listeners.values()].reduce((count, set) => count + set.size, 0), 0);
    assert.equal(intervals.size, 0);
    globalThis.window = oldWindow; globalThis.document = oldDocument; Date.now = oldNow;
    delete globalThis.__pulseHarness;
  }
});

test('build-time AzuraCast override reaches the controller without changing audio transport', async () => {
  const overrideController = await compileController({ VITE_AZURACAST_METADATA_DELAY_SEC: '2' });
  const oldWindow = globalThis.window, oldDocument = globalThis.document, oldNow = Date.now;
  let now = 180_000, loads = 0, plays = 0, pauses = 0;
  const intervals = new Map();
  globalThis.window = { location: { search: '' }, setInterval(fn, ms) { intervals.set(ms, fn); return ms; },
    clearInterval: ms => intervals.delete(ms), clearTimeout() {}, addEventListener() {}, removeEventListener() {} };
  globalThis.document = { hidden: false, visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  Date.now = () => now;
  const response = (id, start) => ({ now_playing: { played_at: start, song: { id, title: id, art: `${id}.jpg` } } });
  try {
    for (const [component, expectedAtTwoSeconds] of [[controller, 'A'], [overrideController, 'B']]) {
      now = 180_000;
      const audio = { src: 'https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3',
        currentSrc: 'https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3', paused: false,
        addEventListener() {}, removeEventListener() {}, load() { loads++; }, play() { plays++; return Promise.resolve(); }, pause() { pauses++; } };
      const h = new Harness(component), props = { audioRef: { current: audio }, streamUrl: 'https://streaming.live365.com/a61535' };
      const pausesBefore = pauses;
      h.response = response('A', 100);
      try {
        h.render(props); await Promise.resolve(); await Promise.resolve();
        now = 201_000; h.response = response('B', 200);
        intervals.get(5000)(); await Promise.resolve(); await Promise.resolve();
        assert.equal(h.render(props).props.title, 'A');
        now = 202_000; intervals.get(1000)();
        assert.equal(h.render(props).props.title, expectedAtTwoSeconds);
        now = 215_000; intervals.get(1000)();
        assert.equal(h.render(props).props.title, 'B');
        assert.equal(h.fetches, 2);
        assert.equal(loads, 0); assert.equal(plays, 0);
        assert.equal(pauses, pausesBefore);
      } finally { h.unmount(); }
    }
    assert.equal(intervals.size, 0);
  } finally {
    globalThis.window = oldWindow; globalThis.document = oldDocument; Date.now = oldNow;
    delete globalThis.__pulseHarness;
  }
});

test("same controller retains state through compact/full changes and cancels video recovery races", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const events = new Map(), audioEvents = new Map(), timers = new Map();
  let timerId = 0, plays = 0, lateReject;
  const audio = {
    src: "", paused: true, load() {},
    addEventListener: (type, fn) => audioEvents.set(type, fn),
    removeEventListener: (type) => audioEvents.delete(type),
    play() { plays++; this.paused = false; audioEvents.get("play")?.(); return new Promise((resolve, reject) => { lateReject = reject; }); },
    pause() { this.paused = true; audioEvents.get("pause")?.(); },
  };
  const fakeWindow = {
    location: { search: "" },
    setInterval: () => ++timerId, clearInterval() {},
    clearTimeout: (id) => timers.delete(id),
    addEventListener: (type, fn) => events.set(type, fn),
    removeEventListener: (type) => events.delete(type),
  };
  const oldTimeout = globalThis.setTimeout, oldClearTimeout = globalThis.clearTimeout;
  globalThis.window = fakeWindow;
  globalThis.document = { hidden: false, visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  globalThis.setTimeout = (fn) => { const id = ++timerId; timers.set(id, fn); return id; };
  globalThis.clearTimeout = fakeWindow.clearTimeout;
  const h = new Harness();
  const media = createMediaCoordinator();
  const props = { audioRef: { current: audio }, streamUrl: "https://streaming.live365.com/a61535", media };
  try {
    h.render(props);
    await Promise.resolve();
    media.playRadio({ reconnect: true });
    h.render({ ...props, compact: true });
    const home = h.render({ ...props, compact: false });
    assert.equal(h.fetches, 1);
    assert.equal(plays, 1);
    assert.equal(home.props.title, "Test track");
    assert.equal(home.props.isPlaying, true);
    audio.paused = true;
    audioEvents.get("stalled")();
    assert.equal(timers.size, 0); // The progress watchdog owns recovery; events add no timers.
    let stops = 0;
    const stop = () => stops++;
    media.startVideo(stop);
    assert.equal(audio.paused, true);
    assert.equal(timers.size, 0);
    lateReject(new Error("delayed play rejection"));
    await Promise.resolve();
    events.get("online")();
    assert.equal(plays, 1);
    assert.equal(audio.src, props.streamUrl);
    // A late native play event is also rejected once video owns audible media.
    audio.paused = false;
    audioEvents.get("play")();
    assert.equal(audio.paused, true);
    media.endVideo(stop);
    assert.equal(plays, 1);
    media.startVideo(stop);
    media.playRadio();
    assert.equal(stops, 1);
    assert.equal(plays, 2);
    media.playRadio({ reconnect: true });
    lateReject(new Error("primary unavailable"));
    await Promise.resolve();
    assert.equal(plays, 3);
    assert.equal(audio.src, props.streamUrl);
    props.audioRef.current = null; // React detaches the ref before route cleanup.
    h.unmount();
    lateReject(new Error("rejected after route exit"));
    await Promise.resolve();
    assert.equal(plays, 3);
    assert.equal(audio.paused, true);
    assert.equal(audioEvents.size, 0);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.setTimeout = oldTimeout;
    globalThis.clearTimeout = oldClearTimeout;
    delete globalThis.__pulseHarness;
  }
});

test("full, floating, and Explore strip expose one active playback control", async () => {
  const Live = (await compiled("./src/features/pulse/PulseLive.jsx")).default;
  for (const props of [{ isFloating: false }, { isFloating: true }, { compact: true }]) {
    const html = renderToStaticMarkup(createElement(Live, { title: "Track", artist: "Artist", ...props }));
    const active = [...html.matchAll(/<section\b[\s\S]*?<\/section>/g)].filter(([section]) => section.slice(0, section.indexOf(">")).includes('aria-hidden="false"'));
    assert.equal(active.length, 1);
    assert.equal((active[0][0].match(/<button/g) || []).length, 1);
    assert.equal((html.match(/<audio/g) || []).length, 0);
  }
  const fixture = { name: 'explore-feed', setup(build) {
    build.onResolve({ filter: /hooks\/useFeedItems$/ }, () => ({ path: 'feed', namespace: 'explore-fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'explore-fixture' }, () => ({ contents: 'export const useFeedItems = () => ({items: [{id:"music-id", youtube_id:"fixture", item_type:"snip", title:"Music fixture"}], loading:false, error:null});' }));
  } };
  const Explore = (await compiled("./src/pages/PulseExplore.jsx", [fixture])).default;
  const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/explore"] },
    createElement(Routes, null, createElement(Route, { element: createElement(Outlet, { context: { discoveryChannels: [], openChannel: () => {} } }) },
      createElement(Route, { path: '/explore', element: createElement(Explore) })))));
  assert.ok(html.includes("Find your next connection."));
  assert.ok(html.includes('href="/scroll/music-id"'));
  assert.equal((html.match(/aria-pressed=/g) || []).length, 6);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.ok(!/<audio|<iframe/.test(html));
});

test("live presentation reflects supplied playback states without adding an engine or progress", async () => {
  const Live = (await compiled("./src/features/pulse/PulseLive.jsx")).default;
  for (const [state, props, message] of [
    ["loading", { loading: true }, "Finding the current track"],
    ["buffering", { isReconnecting: true }, "Buffering live radio"],
    ["playing", { isPlaying: true }, "Playing live"],
    ["paused", {}, "Paused · ready to listen"],
  ]) {
    const html = renderToStaticMarkup(createElement(Live, { title: "Live track", artist: "Artist", isFloating: false, ...props }));
    assert.ok(html.includes(`data-playback-state="${state}"`));
    assert.ok(html.includes(message));
    assert.ok(html.includes(`aria-label="${props.isPlaying ? "Pause" : "Play"} PULSE LIVE"`));
    assert.ok(!/<audio|<progress|role="progressbar"|type="range"/.test(html));
  }
});

test("Scroll excludes verses and invalid cards before limiting, with stable source diversity", () => {
  const items = [
    { id: 'verse', item_type: 'verse', source_show: 'Verse' },
    { id: 'a1', item_type: 'reel', youtube_id: '1', source_show: 'A' },
    { id: 'a2', item_type: 'reel', youtube_id: '2', source_show: 'A' },
    { id: 'missing', item_type: 'reel', source_show: 'A' },
    { id: 'b1', item_type: 'snip', youtube_id: '3', source_show: 'B' },
    { id: 'a3', item_type: 'snip', youtube_id: '4', source_show: 'A' },
  ];
  assert.deepEqual(selectScrollItems(items, 3).map(item => item.id), ['a1', 'b1', 'a2']);
  assert.deepEqual(selectScrollItems(items, 3), selectScrollItems(items, 3));
  assert.deepEqual(selectScrollItems(items.slice(0, 1), 30), []);
  const feed = fs.readFileSync('src/hooks/useFeedItems.js', 'utf8');
  assert.ok(feed.indexOf('.neq("item_type", "verse")') < feed.indexOf('.limit(poolSize)'));
  assert.ok(!fs.readFileSync('src/components/FeedCard.jsx', 'utf8').includes('useVerseRadioAudio'));
  assert.ok(!selectScrollItems(items, 30).some(item => item.id === 'verse'));
});

test("loopback forbidden catalog requests use the unchanged proxy; invalid queries do not retry", async () => {
  const Catalog = (await compiled('./src/lib/youtubeCatalog.js', [], { PROD: false, VITE_YOUTUBE_API_KEY: 'fixture' })).fetchYouTubeCatalog;
  const oldWindow = globalThis.window, oldFetch = globalThis.fetch;
  const requests = [];
  globalThis.window = { location: { hostname: '127.0.0.1' } };
  try {
    globalThis.fetch = async url => {
      requests.push(url);
      return { ok: requests.length > 1, status: requests.length > 1 ? 200 : 403, json: async () => ({ items: ['fixture'] }) };
    };
    assert.deepEqual(await Catalog('channels', { id: 'fixture' }), { items: ['fixture'] });
    assert.ok(requests[0].startsWith('https://www.googleapis.com/youtube/v3/channels?'));
    assert.ok(requests[1].startsWith('https://www.truevoice.digital/api/youtube?'));
    requests.length = 0;
    globalThis.fetch = async url => { requests.push(url); return { ok: false, status: 400 }; };
    await assert.rejects(Catalog('channels', { id: 'invalid' }), /HTTP 400/);
    assert.equal(requests.length, 1);
    requests.length = 0;
    globalThis.fetch = async url => { requests.push(url); return { ok: false, status: 403 }; };
    await assert.rejects(Catalog('playlistItems', { playlistId: 'fixture' }), /HTTP 403/);
    assert.equal(requests.length, 2, 'a failed proxy must not retry');
    for (const status of [404, 429, 500]) {
      requests.length = 0;
      globalThis.fetch = async url => { requests.push(url); return { ok: false, status }; };
      await assert.rejects(Catalog('channels', { id: 'fixture' }), new RegExp(`HTTP ${status}`));
      assert.equal(requests.length, 1);
    }
    const ProxyOnly = (await compiled('./src/lib/youtubeCatalog.js', [], { PROD: true })).fetchYouTubeCatalog;
    requests.length = 0;
    globalThis.fetch = async url => { requests.push(url); return { ok: true, json: async () => ({ items: [] }) }; };
    await ProxyOnly('channels', { id: 'fixture' });
    assert.equal(requests.length, 1);
    assert.ok(requests[0].startsWith('https://www.truevoice.digital/api/youtube?'));
  } finally { globalThis.window = oldWindow; globalThis.fetch = oldFetch; }
});

function hookFixtures() {
  return { name: 'scroll-hook-fixture', setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: 'hooks', namespace: 'scroll-fixture' }));
    build.onResolve({ filter: /MediaCoordinationContext$/ }, () => ({ path: 'context', namespace: 'scroll-fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'scroll-fixture' }, ({path}) => ({ contents: path === 'context' ? 'export const MediaCoordinationContext = {};' : `
      export default {};
      const h = () => globalThis.__pulseHarness;
      export const useRef = v => h().ref(v);
      export const useState = v => h().state(v);
      export const useContext = () => h().context;
      export const useCallback = (fn,d) => h().memo(() => fn,d);
      export const useEffect = (fn,d) => h().effect(fn,d);
      export const useLayoutEffect = (fn,d) => h().effect(fn,d);` }));
  } };
}

test("thumbnails recover without replacing catalog or embed URLs", async () => {
  const Thumbnail = (await compiled('./src/components/VideoThumbnail.jsx', [hookFixtures()])).default;
  const h = new Harness(Thumbnail);
  const props = {src:'https://images.invalid/failure.jpg', videoId:'fixture'};
  let view = h.render(props);
  view.props.onError();
  view = h.render(props);
  assert.equal(view.props.src, 'https://img.youtube.com/vi/fixture/hqdefault.jpg');
  view.props.onError();
  view = h.render(props);
  assert.equal(view.props.src, '/truevoice-favicon.png');
  assert.equal(view.props.onError, undefined);
  assert.equal(new URL(withVideoControls('https://truevoice.digital/yt-embed.html?v=fixture&mute=0')).searchParams.get('controls'), '1');
  assert.equal(withVideoControls('https://www.youtube.com/embed/fixture'), 'https://www.youtube.com/embed/fixture');
  delete globalThis.__pulseHarness;
});

test("only active Scroll video unmutes; switching, late messages, timers and unmount stay silent", async () => {
  const usePlayer = (await compiled('./src/hooks/useYouTubePlayer.js', [hookFixtures()])).useYouTubePlayer;
  const oldWindow=globalThis.window, oldDocument=globalThis.document, oldTimeout=globalThis.setTimeout, oldClear=globalThis.clearTimeout;
  const listeners = new Set(), timers = new Map();
  let timer=0, pauses=0;
  const frames=[];
  globalThis.window = { addEventListener: (_type,fn)=>listeners.add(fn), removeEventListener: (_type,fn)=>listeners.delete(fn) };
  globalThis.document = { createElement() {
    const frame={style:{},commands:[],setAttribute(){}};
    frame.contentWindow={postMessage: msg=>frame.commands.push(msg.type)};
    frames.push(frame);return frame;
  } };
  globalThis.setTimeout = fn=>{const id=++timer;timers.set(id,fn);return id;};
  globalThis.clearTimeout = id=>timers.delete(id);
  const container = () => ({ current:{appendChild(frame){frame.parentNode=this;},removeChild(frame){frame.parentNode=null;}} });
  const media=createMediaCoordinator();
  media.attachRadio({ pause:()=>pauses++, play:()=>assert.fail('Scroll must not start radio') });
  const a=new Harness(usePlayer), b=new Harness(usePlayer);
  a.context=media;b.context=media;
  const propsA={containerRef:container(),videoId:'a',isActive:true};
  const propsB={containerRef:container(),videoId:'b',isActive:false};
  const emit=(frame,type,state)=>listeners.forEach(fn=>fn({source:frame.contentWindow,data:{source:'tvd-yt-embed',type,state}}));
  try {
    a.render(propsA);b.render(propsB);
    emit(frames[0],'ready');emit(frames[1],'ready');
    const controlsA=a.render(propsA);
    controlsA.toggleMute();
    assert.ok(frames[0].commands.includes('unmute'));
    assert.ok(!frames[1].commands.includes('unmute'));
    assert.ok(new URL(frames[1].src).searchParams.get('autoplay')==='0');
    const staleTimers=[...timers.values()];
    a.render({...propsA,isActive:false});b.render({...propsB,isActive:true});
    const priorPlays=frames[0].commands.filter(cmd=>cmd==='play').length;
    emit(frames[0],'stateChange',1);
    staleTimers.forEach(fn=>fn());
    assert.equal(frames[0].commands.filter(cmd=>cmd==='play').length,priorPlays);
    assert.equal(frames[0].commands.at(-1),'stop');
    assert.ok(frames[1].commands.includes('unmute'));
    media.pauseVideo();
    const pausedPlays=frames[1].commands.filter(cmd=>cmd==='play').length;
    emit(frames[1],'ready');
    assert.equal(frames[1].commands.filter(cmd=>cmd==='play').length,pausedPlays);
    media.playVideo();
    assert.ok(frames[1].commands.filter(cmd=>cmd==='play').length>pausedPlays);
    b.unmount();a.unmount();
    const finalCommands=frames[1].commands.length;
    emit(frames[1],'stateChange',1);
    assert.equal(frames[1].commands.length,finalCommands);
    assert.equal(listeners.size,0);
    assert.equal(timers.size,0);
    assert.ok(pauses>0);
  } finally {
    globalThis.window=oldWindow;globalThis.document=oldDocument;globalThis.setTimeout=oldTimeout;globalThis.clearTimeout=oldClear;
    delete globalThis.__pulseHarness;
  }
});

test("Explore categories select actual content and preserve encoded Scroll deep links", () => {
  const items = [{id:"a", item_type:"snip", youtube_id:"a"}, {id:"b", item_type:"reel", youtube_id:"b"},
    {id:"c", item_type:"reel", category:"Music", youtube_id:"c"}, {id:"verse", item_type:"verse"}, {id:"bad", item_type:"snip"}];
  assert.deepEqual(exploreVideos(items, "Music").map(item => item.id), ["a", "c"]);
  assert.deepEqual(exploreVideos(items, "Videos").map(item => item.id), ["a", "b", "c"]);
  assert.deepEqual(exploreVideos([], "Music"), []);
  for (const category of EXPLORE_CATEGORIES) {
    const visible = Object.entries(exploreSections(category)).filter(([,shown]) => shown).map(([name]) => name);
    assert.deepEqual(visible, category === "All" ? ["music","videos","creators","podcasts","channels"] : [category.toLowerCase()]);
  }
  assert.equal(scrollDiscoveryLink("id /?"), "/scroll/id%20%2F%3F");
});

test("Explore rails distinguish loading, empty, failed and partial catalog states", async () => {
  const Rail = (await compiled("./src/features/pulse/DiscoveryRail.jsx")).default;
  const render = props => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Rail, {title:"Videos", cards:[], empty:"Nothing available", ...props})));
  assert.ok(render({loading:true}).includes("Loading videos"));
  assert.ok(render({loading:false}).includes("Nothing available"));
  const failed = render({error:true});
  assert.ok(failed.includes("feed is unavailable"));
  assert.ok(!failed.includes("Nothing available"));
  const partial = render({error:true, cards:[{id:"one", title:"Watch", to:"/scroll/one"}]});
  assert.ok(partial.includes('href="/scroll/one"'));
  assert.ok(partial.includes("feed is unavailable"));
});

test("Explore filter buttons update rendered sections and retain mounted podcast feeds", async () => {
  const sources = { name: 'explore-interaction', setup(build) {
    build.onResolve({filter:/hooks\/useFeedItems$/}, () => ({path:'feed',namespace:'explore-interaction'}));
    build.onResolve({filter:/^react-router-dom$/}, () => ({path:'router',namespace:'explore-interaction'}));
    build.onLoad({filter:/.*/,namespace:'explore-interaction'}, ({path}) => ({contents:path === 'feed'
      ? 'export const useFeedItems = () => ({items:Array.from({length:15}, (_,i) => ({id:String(i),youtube_id:String(i),item_type:"snip"})),loading:false,error:null});'
      : 'export const useLocation=()=>({search:"",hash:""}); export const useNavigate=()=>()=>{}; export const useOutletContext = () => ({discoveryChannels:[],openChannel:()=>{}}); export const Link = () => null;'}));
  }};
  const Page = (await compiled("./src/pages/PulseExplore.jsx", [sources, hookFixtures()])).default;
  const h = new Harness(Page);
  try {
    let music = h.render({}).props.children[2].props.children[0];
    const initialIds = music.props.cards.map(card => card.id);
    assert.equal(initialIds.length, 12);
    assert.equal(music.props.footer.props['aria-expanded'], false);
    assert.equal(music.props.footer.props['aria-controls'], 'pulse-explore-music-cards');
    music.props.footer.props.onClick();
    music = h.render({}).props.children[2].props.children[0];
    assert.equal(music.props.cards.length, 15);
    assert.deepEqual(music.props.cards.slice(0,12).map(card => card.id), initialIds);
    assert.equal(music.props.footer.props.children, 'Show Less');
    music.props.footer.props.onClick();
    assert.deepEqual(h.render({}).props.children[2].props.children[0].props.cards.map(card => card.id), initialIds);
    for (const category of EXPLORE_CATEGORIES) {
      let tree = h.render({});
      const filters = tree.props.children[1].props.children;
      filters.find(button => button.props.children === category).props.onClick();
      tree = h.render({});
      assert.equal(tree.props.children[1].props.children.filter(button => button.props['aria-pressed']).length, 1);
      const results = tree.props.children[2].props.children;
      assert.equal(results.slice(0,4).filter(Boolean).length, category === 'All' ? 4 : category === 'Podcasts' ? 0 : 1);
      assert.equal(results[4].props.hidden, category !== 'All' && category !== 'Podcasts');
      assert.ok(results[4].props.children, 'podcast component remains mounted');
    }
  } finally { delete globalThis.__pulseHarness; }
});

test("mobile chat tracks visible dock height, route changes and observer cleanup", () => {
  const source = fs.readFileSync("src/components/ChimeIn.jsx", "utf8");
  const chatAst = parse(source, {sourceType:"module", plugins:["jsx"]});
  let effect;
  walk(chatAst, node => {
    if (node.type === "CallExpression" && node.callee.name === "useEffect" &&
      source.slice(node.start,node.end).includes("--chime-dock-height")) effect = node.arguments[0];
  });
  assert.ok(effect);
  const values = new Map(), clearance = new Map();
  let dock = {visible:true, height:110, getAttribute:() => dock.visible ? "false" : "true", getBoundingClientRect:() => ({height:dock.height})};
  let current = dock;
  const main = {style:{setProperty:(key,value) => clearance.set(key,value), removeProperty:key => clearance.delete(key)}};
  const app = {querySelector:selector => selector === "main.tv-main--pulse" ? main : current};
  const tab = {closest:() => app, style:{setProperty:(key,value) => values.set(key,value), removeProperty:key => values.delete(key)}};
  const observers = [];
  class Observer {
    constructor(callback) { this.callback=callback; observers.push(this); }
    observe() { this.connected=true; }
    disconnect() { this.connected=false; }
  }
  let resizeHandler;
  const win = {addEventListener:(_,fn) => {resizeHandler=fn;}, removeEventListener:(_,fn) => {assert.equal(fn,resizeHandler); resizeHandler=null;}};
  const cleanup = Function("tabRef","ResizeObserver","MutationObserver","window", `return (${source.slice(effect.start,effect.end)})();`)({current:tab},Observer,Observer,win);
  assert.equal(values.get("--chime-dock-height"),"110px");
  assert.equal(clearance.get("--pulse-dock-height"),"110px");
  for (const width of [375,390,430]) {
    for (const safeBottom of [0,34]) {
      for (const visible of [true,false]) {
        dock.visible=visible; observers[1].callback();
        const height = Number.parseFloat(values.get("--chime-dock-height"));
        assert.equal(Number.parseFloat(clearance.get("--pulse-dock-height")), height);
        const bottom = Math.max(12+safeBottom,12+height);
        assert.ok(bottom >= (visible ? dock.height : safeBottom)+12);
        assert.ok(width-12-120 >= 0, "compact pill fits within viewport");
      }
    }
  }
  dock.visible=true; dock.height=145; observers[0].callback();
  assert.equal(values.get("--chime-dock-height"),"145px");
  assert.equal(clearance.get("--pulse-dock-height"),"145px");
  current=null; observers[2].callback();
  assert.equal(values.get("--chime-dock-height"),"0px");
  assert.equal(clearance.get("--pulse-dock-height"),"0px");
  cleanup();
  assert.ok(observers.every(observer => !observer.connected));
  assert.equal(resizeHandler,null);
  assert.equal(values.size,0);
  assert.equal(clearance.size,0);
});

test("actual EXPLORE card Play handlers open the exact curated and channel videos", async () => {
  const picked = [];
  globalThis.__exploreOpen = video => picked.push(video);
  const sources = {name:'explore-video-click',setup(build) {
    build.onResolve({filter:/hooks\/useFeedItems$/},()=>({path:'feed',namespace:'explore-video-click'}));
    build.onResolve({filter:/^react-router-dom$/},()=>({path:'router',namespace:'explore-video-click'}));
    build.onLoad({filter:/.*/,namespace:'explore-video-click'},({path})=>({contents:path==='feed'
      ? 'export const useFeedItems=()=>({items:[{id:"feed-one",youtube_id:"abcdefghijk",item_type:"snip",title:"First",clip_start_seconds:10,clip_end_seconds:20},{id:"feed-two",youtube_id:"12345678901",item_type:"reel",title:"Second"}],loading:false,error:null});'
      : 'export const useLocation=()=>({search:"",hash:""}); export const useNavigate=()=>()=>{}; export const Link = () => null; export const useOutletContext=()=>({openVideo:globalThis.__exploreOpen,discoveryChannels:[{id:"CHANNEL",title:"Show",creator:"Creator",feed:{videos:[{youtubeId:"channel0001",title:"Latest",embedUrl:"https://truevoice.digital/yt-embed.html?v=channel0001&autoplay=1&mute=0"}],loading:false,error:null}}]});'}));
  }};
  const Page=(await compiled('./src/pages/PulseExplore.jsx',[sources,hookFixtures()])).default;
  const Rail=(await compiled('./src/features/pulse/DiscoveryRail.jsx')).default;
  const h=new Harness(Page);
  try {
    const sections=h.render({}).props.children[2].props.children;
    const first=sections[0].props.cards[0];
    const rail=Rail({...sections[0].props});
    rail.props.children[4].props.children[0].props.children[0].props.onClick();
    assert.equal(picked[0].youtubeId,'abcdefghijk');
    const url=new URL(picked[0].embedUrl);
    assert.equal(url.pathname,'/yt-embed.html');
    assert.equal(url.searchParams.get('v'),'abcdefghijk');
    assert.equal(url.searchParams.get('start'),'10');
    assert.equal(url.searchParams.get('end'),'20');
    assert.equal(url.searchParams.get('autoplay'),'1');
    assert.equal(url.searchParams.get('mute'),'0');
    assert.equal(first.to,'/scroll/feed-one');
    sections[1].props.cards[1].onOpen();
    assert.equal(picked[1].youtubeId,'12345678901');
    sections[2].props.cards[0].onOpen();
    sections[3].props.cards[0].onOpen();
    assert.equal(picked[2].youtubeId,'channel0001');
    assert.equal(picked[3].youtubeId,'channel0001');
  } finally {delete globalThis.__exploreOpen;delete globalThis.__pulseHarness;}
});

test("actual App modal commands retain selected video, switch and close without resuming LIVE", () => {
  const declarations={};
  walk(ast,node=>{if(node.type==='VariableDeclarator'&&['closeVideo','openVideo','openVideoForSection','advanceVideo'].includes(node.id.name)) declarations[node.id.name]=node.init;});
  const arrow = n => declarations[n].type==='CallExpression' ? declarations[n].arguments[0] : declarations[n];
  const media=createMediaCoordinator(), messages=[];
  const videoQueueRef={current:null}, videoSessionRef={current:0};
  let opened=false, selected=null, pauses=0, plays=0;
  const frame={contentWindow:{postMessage:message=>messages.push(message)}};
  const stopEmbeddedVideo=iframe=>iframe?.contentWindow?.postMessage({source:'tvd-yt-embed-cmd',type:'stop'});
  const closeNode=arrow('closeVideo'),openNode=arrow('openVideo');
  const closeVideo=Function('stopEmbeddedVideo','videoIframeRef','setVideoOpen','setActiveVideo','media','videoQueueRef','setVideoQueue',
    `const closeVideo = (${appSource.slice(closeNode.start,closeNode.end)}); return closeVideo;`)(stopEmbeddedVideo,{current:frame},v=>opened=v,v=>selected=v,media,videoQueueRef,()=>{});
  const openVideo=Function('stopEmbeddedVideo','videoIframeRef','media','closeVideo','setActiveVideo','setVideoOpen','createVideoQueue','videoQueueRef','videoSessionRef','setVideoQueue',
    `return (${appSource.slice(openNode.start,openNode.end)});`)(stopEmbeddedVideo,{current:frame},media,closeVideo,v=>selected=v,v=>opened=v,createVideoQueue,videoQueueRef,videoSessionRef,()=>{});
  media.attachRadio({pause:()=>pauses++,play:()=>{media.stopVideo();plays++;}});
  const one=exploreModalVideo({youtube_id:'abcdefghijk',title:'Selected'});
  openVideo(one);
  assert.equal(opened,true);assert.equal(selected.youtubeId,'abcdefghijk');assert.equal(pauses,1);
  assert.equal(media.isVideoActive(),true);assert.equal(plays,0);
  const sectionNode=arrow('openVideoForSection');
  const openSection=Function('openVideo','feedBySection',`return (${appSource.slice(sectionNode.start,sectionNode.end)});`)(openVideo,{CHANNEL:[{youtubeId:'channel0001'}]});
  openSection('CHANNEL');
  assert.equal(opened,true);assert.equal(selected.youtubeId,'channel0001');
  closeVideo();
  assert.equal(opened,false);assert.equal(selected,null);assert.equal(plays,0);
  openVideo(one);media.playRadio();
  assert.equal(opened,false);assert.equal(media.isVideoActive(),false);assert.equal(plays,1);
  const advanceNode=arrow('advanceVideo');
  const advance=Function('queueDestination','videoQueueRef','stopEmbeddedVideo','videoIframeRef','media','closeVideo','setVideoQueue','setActiveVideo','isExplore','videoDiagnostic',
    `return (${appSource.slice(advanceNode.start,advanceNode.end)});`)(queueDestination,videoQueueRef,stopEmbeddedVideo,{current:frame},media,closeVideo,()=>{},v=>selected=v,false,()=>{});
  const two={youtubeId:'12345678901',title:'Next'};
  openVideo(one,[one,two]);
  assert.equal(videoQueueRef.current.index,0);
  advance(1,'abcdefghijk');
  assert.equal(selected.youtubeId,'12345678901');assert.equal(opened,true);
  advance(1,'abcdefghijk');assert.equal(videoQueueRef.current.index,1);
  advance(1,'12345678901');assert.equal(videoQueueRef.current.index,1);
  assert.equal(plays,1);
  closeVideo();advance(-1,'12345678901');
  assert.equal(videoQueueRef.current,null);assert.equal(selected,null);
  assert.ok(messages.every(message=>message.type==='stop'));
});

test("modal Play uses existing bridge, queues before ready and cleans up on close", async () => {
  const Modal=(await compiled('./src/components/VideoModal.jsx',[hookFixtures()])).default;
  const oldWindow=globalThis.window,listeners=new Map(),commands=[];
  globalThis.window={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  const frame={contentWindow:{postMessage:message=>commands.push(message)}}, iframeRef={current:frame};
  const h=new Harness(Modal);
  const video=exploreModalVideo({youtube_id:'abcdefghijk',title:'Selected'});
  let closes=0;
  const props={open:true,video,iframeRef,onClose:()=>closes++};
  try {
    let tree=h.render(props);
    let body=tree.props.children.props.children[1];
    assert.equal(new URL(body.props.children[1].props.children.props.src).searchParams.get('v'),'abcdefghijk');
    assert.equal(new URL(body.props.children[1].props.children.props.src).searchParams.get('controls'),'1');
    body.props.children[0].props.children[0].props.onClick();
    assert.deepEqual(commands.map(message=>message.type),['unmute','play']);
    listeners.get('message')({source:frame.contentWindow,data:{source:'tvd-yt-embed',type:'ready'}});
    assert.deepEqual(commands.map(message=>message.type),['unmute','play','unmute','play']);
    tree=h.render(props);
    assert.ok(tree);assert.equal(closes,0);
    listeners.get('message')({source:frame.contentWindow,data:{source:'tvd-yt-embed',type:'error',code:153}});
    tree=h.render(props);
    assert.ok(tree.props.children.props.children[1].props.children[0].props.children[1].props.children.includes('153'));
    tree.props.children.props.children[0].props.children[1].props.onClick();
    assert.equal(closes,1);
    assert.equal(h.render({...props,open:false}),null);
    assert.equal(listeners.size,0);
  } finally {h.unmount();globalThis.window=oldWindow;delete globalThis.__pulseHarness;}
});

test("existing Channels ReelsGrid handler retains coordination and selected video", () => {
  const source=fs.readFileSync('src/components/ReelsGrid.jsx','utf8');
  const tree=parse(source,{sourceType:'module',plugins:['jsx']});
  let declaration;
  walk(tree,node=>{if(node.type==='VariableDeclarator'&&node.id.name==='handleOpen')declaration=node.init;});
  assert.ok(declaration);
  const media=createMediaCoordinator();
  let pauses=0,stops=0,selected=null;
  const tracked=[];
  media.attachRadio({pause:()=>pauses++});
  const handleClose=()=>{stops++;media.endVideo(handleClose);};
  const open=Function('media','handleClose','stopCurrentVideo','setActiveVideo','trackVideoPlay',
    `return (${source.slice(declaration.start,declaration.end)});`)(media,handleClose,()=>stops++,value=>selected=value,(...args)=>tracked.push(args));
  open({youtubeId:'abcdefghijk',title:'Channel video'});
  assert.equal(selected.youtubeId,'abcdefghijk');
  assert.equal(pauses,1);
  assert.deepEqual(tracked,[['abcdefghijk','Channel video']]);
  assert.equal(media.isVideoActive(),true);
  media.stopVideo();assert.equal(media.isVideoActive(),false);
  assert.equal(stops,2);
});

test("EXPLORE queue snapshots selection, deduplicates and rejects invalid/unavailable items", () => {
  const one={youtubeId:'abcdefghijk',title:'One'}, two={youtubeId:'12345678901',title:'Two'};
  const collection=[one,{...one,title:'Duplicate'}, {youtubeId:'bad'}, {youtubeId:'unavail0001',unavailable:true},
    {youtubeId:'private0001',title:'Private video'}, {youtubeId:'versevideo1',item_type:'verse'},two];
  const queue=createVideoQueue(collection,two);
  assert.deepEqual(queue.videos.map(v=>v.youtubeId),['abcdefghijk','12345678901']);
  assert.equal(queue.index,1);
  collection.reverse();two.title='Changed';
  assert.equal(queue.videos[1].title,'Two');
  assert.equal(queueDestination(queue,1,'12345678901'),null);
  const previous=queueDestination(queue,-1,'12345678901');
  assert.equal(previous.index,0);
  assert.equal(queueDestination(previous,-1,'abcdefghijk'),null);
  assert.equal(queueDestination(queue,1,'oldvideo001'),null);
  assert.equal(queueDestination(null,1,'abcdefghijk'),null);
  assert.equal(createVideoQueue(collection,{youtubeId:'missing0001'}),null);
  const ended=createEndedGuard();
  assert.equal(ended(0),false);
  ended(1);ended(2);assert.equal(ended(0),false);
  ended(1);assert.equal(ended(0),true);assert.equal(ended(0),false);
});

test("EXPLORE modal navigation, autoplay toggle, genuine ended and stale events", async () => {
  const Modal=(await compiled('./src/components/VideoModal.jsx',[hookFixtures()])).default;
  const oldWindow=globalThis.window,listeners=new Map(),moves=[],requests=[];
  globalThis.window={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  const videos=[{youtubeId:'abcdefghijk',title:'One'},{youtubeId:'12345678901',title:'Two'},{youtubeId:'thirdvideo1',title:'Three'}];
  const iframeRef={current:{contentWindow:{postMessage:message=>requests.push(message)}}};
  const onAdvance=(...args)=>moves.push(args);
  const h=new Harness(Modal);
  let props={open:true,video:videos[0],iframeRef,queue:{videos,index:0,sessionId:1},onAdvance,onClose:()=>{}};
  const emit=state=>listeners.get('message')({source:iframeRef.current.contentWindow,data:{source:'tvd-yt-embed',type:'stateChange',state}});
  const controls=tree=>tree.props.children.props.children[1].props.children[2].props.children[0].props.children;
  try {
    let tree=h.render(props);
    listeners.get('message')({source:iframeRef.current.contentWindow,data:{source:'tvd-yt-embed',type:'ready'}});
    assert.deepEqual(requests.map(message=>message.type),['unmute','play'], 'initial ready must request playback without another click');
    assert.equal(controls(tree)[0].props.disabled,true);
    assert.equal(controls(tree)[2].props.disabled,false);
    assert.equal(controls(tree)[3].props.children[0].props.checked,true);
    emit(0);assert.equal(moves.length,0);
    emit(1);emit(2);emit(0);assert.equal(moves.length,0);
    emit(1);emit(0);emit(0);assert.deepEqual(moves,[[1,'abcdefghijk']]);
    const stale=listeners.get('message'), oldSource=iframeRef.current.contentWindow;
    iframeRef.current={contentWindow:{postMessage:message=>requests.push(message)}};
    props={...props,video:videos[1],queue:{...props.queue,index:1}};
    tree=h.render(props);
    listeners.get('message')({source:iframeRef.current.contentWindow,data:{source:'tvd-yt-embed',type:'ready'}});
    assert.equal(requests.filter(message=>message.type==='play').length,2,'switched player requests playback on ready');
    stale({source:oldSource,data:{source:'tvd-yt-embed',type:'stateChange',state:0}});
    assert.equal(moves.length,1);
    controls(tree)[3].props.children[0].props.onChange({target:{checked:false}});
    tree=h.render(props);
    assert.equal(controls(tree)[3].props.children[0].props.checked,false);
    emit(1);emit(0);assert.equal(moves.length,1);
    controls(tree)[2].props.onClick();
    assert.deepEqual(moves.at(-1),[1,'12345678901']);
    iframeRef.current={contentWindow:{postMessage:()=>{}}};
    props={...props,video:videos[2],queue:{...props.queue,index:2}};
    tree=h.render(props);
    assert.equal(controls(tree)[2].props.disabled,true);
    emit(-1);
    tree=h.render(props);
    assert.ok(tree.props.children.props.children[1].props.children[0].props.children[1].props.children.includes('autoplay is blocked'));
    controls(tree)[3].props.children[0].props.onChange({target:{checked:true}});
    emit(1);emit(0);assert.equal(moves.length,2);
    const afterClose=listeners.get('message'),source=iframeRef.current.contentWindow;
    h.render({...props,open:false});
    afterClose({source,data:{source:'tvd-yt-embed',type:'stateChange',state:0}});
    assert.equal(moves.length,2);assert.equal(listeners.size,0);
  } finally {h.unmount();globalThis.window=oldWindow;delete globalThis.__pulseHarness;}
});

test("TrueVoice share links and local Likes preserve identity without YouTube engagement", () => {
  const url=new URL(exploreShareUrl('abcdefghijk'));
  assert.equal(url.origin,'https://www.truevoice.digital');
  assert.equal(url.pathname,'/explore');
  assert.equal(url.searchParams.get('video'),'abcdefghijk');
  const location=exploreVideoLocation({search:'?owner=true&utm_source=fixture',hash:'#keep'},'abcdefghijk');
  assert.equal(location.hash,'#keep');
  assert.equal(new URLSearchParams(location.search).get('owner'),'true');
  assert.equal(new URLSearchParams(location.search).get('video'),'abcdefghijk');
  const store=new Map(), storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
  assert.equal(isLocallyLiked('abcdefghijk',storage),false);
  setLocalLike('abcdefghijk',true,storage);setLocalLike('abcdefghijk',true,storage);
  assert.equal(isLocallyLiked('abcdefghijk',storage),true);
  assert.equal(JSON.parse(store.get('truevoice-video-likes')).length,1);
  setLocalLike('abcdefghijk',false,storage);assert.equal(isLocallyLiked('abcdefghijk',storage),false);
  assert.equal(isLocallyLiked('abcdefghijk',{getItem:()=>{throw new Error('blocked');}}),false);
});

test("actual EXPLORE deep-link effect waits for catalog and opens once on cold load/refresh", () => {
  const source=fs.readFileSync('src/pages/PulseExplore.jsx','utf8');
  const tree=parse(source,{sourceType:'module',plugins:['jsx']});let effect;
  walk(tree,node=>{if(node.type==='CallExpression'&&node.callee.name==='useEffect'&&source.slice(node.start,node.end).includes('resolveExploreLink'))effect=node.arguments[0];});
  const ref={current:null},opened=[],messages=[];
  const run=(feed,activeVideoId=null)=>Function('linkId','openedLinkRef','activeVideoId','setLinkStatus','feed','discoveryChannels','exploreVideos','exploreModalVideo','resolveExploreLink','openVideo',
    `return (${source.slice(effect.start,effect.end)})();`)('abcdefghijk',ref,activeVideoId,v=>messages.push(v),feed,[],exploreVideos,exploreModalVideo,resolveExploreLink,(...args)=>opened.push(args));
  run({items:[],loading:true});assert.equal(opened.length,0);assert.equal(ref.current,null);
  const feed={items:[{id:'one',youtube_id:'abcdefghijk',item_type:'snip'}],loading:false};
  run(feed);run(feed);assert.equal(opened.length,1);assert.equal(opened[0][0].youtubeId,'abcdefghijk');
  ref.current=null;run(feed);assert.equal(opened.length,2,'refresh may restore selection');
  ref.current=null;run(feed,'abcdefghijk');assert.equal(opened.length,2,'queue URL update must not restart active session');
  ref.current=null;run({items:[],loading:false});assert.ok(messages.at(-1).includes('unavailable'));
});

test("modal listener survives callback/queue wrapper changes and reports official autoplay blocking", async () => {
  const Modal=(await compiled('./src/components/VideoModal.jsx',[hookFixtures()])).default;
  const oldWindow=globalThis.window, listeners=new Map(), commands=[];
  let attached=0, detached=0;
  globalThis.window={addEventListener:(type,fn)=>{if(type==='message')attached++;listeners.set(type,fn);},
    removeEventListener:type=>{if(type==='message')detached++;listeners.delete(type);}};
  const frame={contentWindow:{postMessage:message=>commands.push(message)}};
  const video={youtubeId:'abcdefghijk',title:'Current'}, queue={videos:[video,{youtubeId:'12345678901'}],index:0,sessionId:1};
  const iframeRef={current:frame},h=new Harness(Modal);
  const firstMoves=[],latestMoves=[];
  const props={open:true,video,queue,iframeRef,onClose:()=>{},onAdvance:(...args)=>firstMoves.push(args)};
  const emit=data=>listeners.get('message')({source:frame.contentWindow,data:{source:'tvd-yt-embed',...data}});
  try {
    h.render(props);
    const listener=listeners.get('message');
    emit({type:'ready'});emit({type:'stateChange',state:1});
    h.render({...props,queue:{...queue},onAdvance:(...args)=>latestMoves.push(args)});
    assert.equal(listeners.get('message'),listener);
    assert.equal(attached,1);assert.equal(detached,0);
    assert.deepEqual(commands.map(c=>c.type),['unmute','play']);
    emit({type:'stateChange',state:0});
    assert.equal(firstMoves.length,0);assert.deepEqual(latestMoves,[[1,'abcdefghijk']]);
    emit({type:'autoplayBlocked'});
    const tree=h.render({...props,queue:{...queue},onAdvance:(...args)=>latestMoves.push(args)});
    assert.ok(tree.props.children.props.children[1].props.children[0].props.children[1].props.children.includes('browser blocked autoplay'));
    h.render({...props,open:false});assert.equal(detached,1);
  } finally {h.unmount();globalThis.window=oldWindow;delete globalThis.__pulseHarness;}
});

test("local bridge is explicitly opt-in and cannot affect production/native/nonloopback", () => {
  const hosted='https://truevoice.digital/yt-embed.html?v=abcdefghijk&autoplay=1&mute=0&controls=1&start=10&end=20';
  const location=new URL('http://localhost:5173/explore?pulseLocalBridge=1&pulseVideoDebug=1');
  const config={development:true,native:false,location};
  const local=new URL(selectVideoBridge(hosted,config));
  assert.equal(local.origin,'http://localhost:5173');assert.equal(local.pathname,'/yt-embed.html');
  assert.equal(local.search,new URL(hosted).search);
  assert.equal(selectVideoBridge(hosted,{...config,development:false}),hosted);
  assert.equal(selectVideoBridge(hosted,{...config,native:true}),hosted);
  assert.equal(selectVideoBridge(hosted,{...config,location:new URL('http://localhost:5173/explore')}),hosted);
  assert.equal(selectVideoBridge(hosted,{...config,location:new URL('https://www.truevoice.digital/explore?pulseLocalBridge=1')}),hosted);
  assert.equal(selectVideoBridge('https://www.youtube.com/embed/abcdefghijk',config),'https://www.youtube.com/embed/abcdefghijk');
  const httpsConfig={...config,location:new URL('https://localhost:5173/explore?pulseLocalBridge=1')};
  assert.equal(new URL(selectVideoBridge(hosted,httpsConfig)).protocol,'https:');
});

test("real progress handles duration, clip boundaries, pause values and seeks", () => {
  assert.equal(playbackProgress({currentTime:50,duration:100}),.5);
  assert.equal(playbackProgress({currentTime:50,duration:0}),null);
  assert.equal(playbackProgress({currentTime:NaN,duration:100}),null);
  assert.equal(playbackProgress({currentTime:15,duration:100,start:10,end:20}),.5);
  assert.equal(playbackProgress({currentTime:200,duration:100}),1);
  assert.equal(playbackProgress({currentTime:2,duration:100,start:10}),0);
  assert.equal(playbackProgress({currentTime:20,duration:100}),.2);
  assert.equal(playbackProgress({currentTime:70,duration:100}),.7);
});

test("Next underline uses real progress but cannot advance; stale frames and switches reset it", async () => {
  const Modal=(await compiled('./src/components/VideoModal.jsx',[hookFixtures()])).default;
  const oldWindow=globalThis.window,listeners=new Map(),moves=[];
  globalThis.window={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  const videos=[{youtubeId:'abcdefghijk'},{youtubeId:'12345678901'}],iframeRef={current:{contentWindow:{postMessage:()=>{}}}};
  const h=new Harness(Modal);
  let props={open:true,video:videos[0],queue:{videos,index:0,sessionId:1},iframeRef,onClose:()=>{},onAdvance:(...args)=>moves.push(args)};
  const next=tree=>tree.props.children.props.children[1].props.children[2].props.children[0].props.children[2];
  const emit=(time,duration,id='abcdefghijk',source=iframeRef.current.contentWindow)=>listeners.get('message')({source,data:{source:'tvd-yt-embed',type:'progress',videoId:id,currentTime:time,duration}});
  try {
    h.render(props);emit(50,100);
    let tree=h.render(props);
    assert.equal(next(tree).props.children[1].props.style.width,'50%');
    emit(50,100);assert.equal(next(h.render(props)).props.children[1].props.style.width,'50%');
    emit(80,100);assert.equal(next(h.render(props)).props.children[1].props.style.width,'80%');
    emit(100,100);assert.equal(moves.length,0,'100% cannot trigger Next');
    next(h.render(props)).props.onClick();assert.deepEqual(moves,[[1,'abcdefghijk']]);
    const oldSource=iframeRef.current.contentWindow,oldListener=listeners.get('message');
    iframeRef.current={contentWindow:{postMessage:()=>{}}};
    props={...props,video:videos[1],queue:{...props.queue,index:1}};
    h.render(props);tree=h.render(props);
    assert.equal(next(tree).props.children[1],false);
    oldListener({source:oldSource,data:{source:'tvd-yt-embed',type:'progress',videoId:'abcdefghijk',currentTime:99,duration:100}});
    emit(99,100,'abcdefghijk');
    assert.equal(next(h.render(props)).props.children[1],false);
    emit(10,0,'12345678901');
    assert.equal(next(h.render(props)).props.children[1],false);
    assert.equal(next(h.render(props)).props.disabled,true);
    h.render({...props,open:false});assert.equal(listeners.size,0);
  } finally {h.unmount();globalThis.window=oldWindow;delete globalThis.__pulseHarness;}
});

test("duplicate ready after genuine end cannot replay old video; navigation remains route-active", async () => {
  const Modal=(await compiled('./src/components/VideoModal.jsx',[hookFixtures()])).default;
  const oldWindow=globalThis.window,listeners=new Map(),commands=[],moves=[];
  globalThis.window={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  const videos=[{youtubeId:'abcdefghijk'},{youtubeId:'12345678901'}],iframeRef={current:{contentWindow:{postMessage:m=>commands.push(m)}}};
  const h=new Harness(Modal);
  const props={open:true,video:videos[0],queue:{videos,index:0,sessionId:1},iframeRef,onClose:()=>{},onAdvance:(...args)=>moves.push(args)};
  const emit=data=>listeners.get('message')({source:iframeRef.current.contentWindow,data:{source:'tvd-yt-embed',...data}});
  try {
    h.render(props);
    emit({type:'ready'});emit({type:'ready'});
    assert.equal(commands.filter(m=>m.type==='play').length,1);
    emit({type:'stateChange',state:1});emit({type:'stateChange',state:0});
    assert.deepEqual(moves,[[1,'abcdefghijk']]);
    emit({type:'ready'});emit({type:'stateChange',state:0});
    assert.equal(commands.filter(m=>m.type==='play').length,1);
    assert.equal(moves.length,1);
    const frame=iframeRef.current={contentWindow:{postMessage:m=>commands.push(m)}};
    const nextProps={...props,video:videos[1],queue:{...props.queue,index:1}};
    const tree=h.render(nextProps);
    const iframe=tree.props.children.props.children[1].props.children[1].props.children;
    assert.equal(iframe.key,'12345678901');
    assert.equal(new URL(iframe.props.src).searchParams.get('v'),'12345678901');
    emit({type:'ready'});emit({type:'stateChange',state:1});emit({type:'stateChange',state:0});emit({type:'ready'});
    assert.equal(moves.length,1,'final item never advances or replays');
    assert.equal(commands.filter(m=>m.type==='play').length,2);
    assert.ok(frame);
  } finally {h.unmount();globalThis.window=oldWindow;delete globalThis.__pulseHarness;}
  const Intro=(await compiled('./src/features/pulse/PulseIntro.jsx')).default;
  for(const [route,active] of [['/','PULSE LIVE'],['/explore?video=abcdefghijk&pulseLocalBridge=1','PULSE EXPLORE']]) {
    const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:[route]},createElement(Intro)));
    const current=html.match(/<a[^>]*aria-current="page"[^>]*>([\s\S]*?)<\/a>/);
    assert.ok(current[1].includes(active));
    assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
    assert.ok(html.includes('Coming soon'));
  }
  const url=new URL(withVideoControls('https://truevoice.digital/yt-embed.html?v=abcdefghijk&loop=1&playlist=abcdefghijk',{progress:true}));
  assert.equal(url.searchParams.get('loop'),'0');
  assert.equal(url.searchParams.has('playlist'),false);
});

test("missing ENDED and position wraps cannot safely distinguish looping from a seek", async () => {
  const automatic=createPositionObserver(), seeking=createPositionObserver();
  const sequence=[{currentTime:0,duration:60,state:1},{currentTime:20,duration:60,state:1},
    {currentTime:59.5,duration:60,state:1},{currentTime:.2,duration:60,state:1}];
  const loops=sequence.map(automatic),seeks=sequence.map(seeking);
  assert.deepEqual(loops,seeks,'identical supported observations cannot establish user intent');
  assert.equal(loops.at(-1).nearEnd,true);
  assert.ok(loops.at(-1).cause.includes('undetermined'));
  const Modal=(await compiled('./src/components/VideoModal.jsx',[hookFixtures()])).default;
  const oldWindow=globalThis.window,listeners=new Map(),moves=[];
  globalThis.window={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  const videos=[{youtubeId:'abcdefghijk'},{youtubeId:'12345678901'}],iframeRef={current:{contentWindow:{postMessage:()=>{}}}},h=new Harness(Modal);
  const props={open:true,video:videos[0],queue:{videos,index:0,sessionId:1},iframeRef,onClose:()=>{},onAdvance:(...args)=>moves.push(args)};
  const emit=data=>listeners.get('message')({source:iframeRef.current.contentWindow,data:{source:'tvd-yt-embed',...data}});
  try {
    h.render(props);emit({type:'stateChange',state:1});
    for(let repeat=0;repeat<2;repeat++) for(const position of sequence) emit({type:'progress',videoId:'abcdefghijk',...position});
    emit({type:'stateChange',state:3});emit({type:'stateChange',state:1});
    assert.equal(moves.length,0,'neither wrapping nor buffering is ENDED');
    emit({type:'stateChange',state:0});emit({type:'stateChange',state:0});
    assert.deepEqual(moves,[[1,'abcdefghijk']]);
  } finally {h.unmount();globalThis.window=oldWindow;delete globalThis.__pulseHarness;}
});

test("confirmed Short repeat, seek, replay and reordered progress never request automatic Next", async () => {
  const Modal = (await compiled('./src/components/VideoModal.jsx', [hookFixtures()])).default;
  const oldWindow = globalThis.window, listeners = new Map(), moves = [];
  globalThis.window = { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
  const videos = [{ youtubeId: 'uUWdS1feO3c' }, { youtubeId: '12345678901' }];
  const iframeRef = { current: { contentWindow: { postMessage() {} } } }, h = new Harness(Modal);
  const props = { open: true, video: videos[0], queue: { videos, index: 0, sessionId: 1 }, iframeRef, onClose() {}, onAdvance: (...args) => moves.push(args) };
  const emit = data => listeners.get('message')({ source: iframeRef.current.contentWindow, data: { source: 'tvd-yt-embed', ...data } });
  const state = value => emit({ type: 'stateChange', state: value });
  const progress = (time, value = 1) => emit({ type: 'progress', videoId: videos[0].youtubeId, currentTime: time, duration: 30.461, state: value });
  try {
    h.render(props);
    state(1);
    // Confirmed runtime trace: natural progression, wrap, buffering, PLAYING; no ENDED.
    for (const time of [0, 5, 10, 15, 20, 25, 30.01]) progress(time);
    progress(0); state(3); progress(0, 3); state(1); progress(.5);
    assert.equal(moves.length, 0, 'confirmed repeat is evidence, not a completion signal');
    // Native controls expose no cause: a backward seek/replay can look identical.
    progress(30.01); progress(0); state(3); state(1);
    emit({ type: 'commandReceived', command: 'seekAndPlay', executed: true });
    progress(30.01); progress(0);
    state(2); progress(28, 2); progress(0, 2); state(1);
    // Delayed, duplicate and out-of-order samples, including 100%, remain visual only.
    for (const time of [30.461, 30.461, 0, 0, 29.9, 1, 30.01, .5]) progress(time);
    assert.equal(moves.length, 0);
    state(0); state(0); state(1); state(0);
    assert.deepEqual(moves, [[1, 'uUWdS1feO3c']], 'genuine ENDED advances at most once per player lifecycle');
  } finally { h.unmount(); globalThis.window = oldWindow; delete globalThis.__pulseHarness; }
});

test("rapid Next/Previous rejects retired generations even when returning to the same video", async () => {
  const Modal = (await compiled('./src/components/VideoModal.jsx', [hookFixtures()])).default;
  const oldWindow = globalThis.window, listeners = new Map(), moves = [], retired = [];
  globalThis.window = { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
  const videos = [{ youtubeId: 'uUWdS1feO3c' }, { youtubeId: '12345678901' }];
  const iframeRef = { current: null }, h = new Harness(Modal);
  try {
    for (const index of [0, 1, 0, 1, 0]) {
      iframeRef.current = { contentWindow: { postMessage() {} } };
      h.render({ open: true, video: videos[index], queue: { videos, index, sessionId: 1 }, iframeRef, onClose() {}, onAdvance: (...args) => moves.push(args) });
      const listener = listeners.get('message'), source = iframeRef.current.contentWindow;
      listener({ source, data: { source: 'tvd-yt-embed', type: 'stateChange', state: 1 } });
      for (const previous of retired) {
        for (const target of [previous.listener, listener]) {
          target({ source: previous.source, data: { source: 'tvd-yt-embed', type: 'stateChange', state: 0 } });
          target({ source: previous.source, data: { source: 'tvd-yt-embed', type: 'progress', videoId: previous.id, currentTime: 0, duration: 30.461 } });
        }
      }
      assert.equal(moves.length, 0);
      retired.push({ listener, source, id: videos[index].youtubeId });
    }
    listeners.get('message')({ source: iframeRef.current.contentWindow, data: { source: 'tvd-yt-embed', type: 'stateChange', state: 0 } });
    assert.deepEqual(moves, [[1, 'uUWdS1feO3c']]);
  } finally { h.unmount(); globalThis.window = oldWindow; delete globalThis.__pulseHarness; }
});

test("repeat guidance is conditional, accessible without live announcements, and cleared on switch/close", async () => {
  const Modal = (await compiled('./src/components/VideoModal.jsx', [hookFixtures()])).default;
  const oldWindow = globalThis.window, listeners = new Map(), moves = [];
  globalThis.window = { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
  const videos = [{ youtubeId: 'uUWdS1feO3c' }, { youtubeId: '12345678901' }];
  const iframeRef = { current: { contentWindow: { postMessage() {} } } }, h = new Harness(Modal);
  let props = { open: true, video: videos[0], queue: { videos, index: 0, sessionId: 1 }, iframeRef, onClose() {}, onAdvance: (...args) => moves.push(args) };
  const emit = data => listeners.get('message')({ source: iframeRef.current.contentWindow, data: { source: 'tvd-yt-embed', ...data } });
  const progress = (time, state = 1, id = props.video.youtubeId) => emit({ type: 'progress', videoId: id, currentTime: time, duration: 30.461, state });
  const queueView = () => h.render(props).props.children.props.children[1].props.children[2];
  const hint = () => queueView().props.children.find(child => child?.props?.id === 'pulse-repeat-guidance');
  try {
    h.render(props);
    assert.equal(hint(), undefined);
    progress(30.01); progress(0);
    assert.equal(hint(), undefined, 'unconfirmed playback cannot show guidance');
    emit({ type: 'stateChange', state: 1 });
    for (const time of [0, 5, 10, 15, 20]) progress(time);
    assert.equal(hint(), undefined, 'ordinary playback has no message');
    progress(5); progress(30.01); progress(10);
    assert.equal(hint(), undefined, 'ordinary backward seek is not near-end to start');
    progress(30.01); progress(0, 2);
    assert.equal(hint(), undefined, 'paused seeks do not show guidance');
    progress(30.01); progress(0, 1, 'wrongvideo1');
    assert.equal(hint(), undefined, 'wrong-video progress is ignored');
    progress(0, 3);
    const message = hint();
    assert.equal(message.props.children, 'If this video repeats, tap Next to keep watching.');
    assert.equal(message.props.role, undefined);
    assert.equal(message.props['aria-live'], undefined, 'static guidance does not repeatedly announce');
    const next = queueView().props.children[0].props.children[2];
    assert.equal(next.props['aria-describedby'], message.props.id);
    for (const time of [0, 0, 30.01, 0, 30.01, 0]) progress(time);
    assert.equal(queueView().props.children.filter(child => child?.props?.id === message.props.id).length, 1);
    assert.equal(moves.length, 0, 'guidance never advances playback');
    const retired = listeners.get('message'), oldSource = iframeRef.current.contentWindow;
    iframeRef.current = { contentWindow: { postMessage() {} } };
    props = { ...props, video: videos[1], queue: { ...props.queue, index: 1 } };
    h.render(props);
    assert.equal(hint(), undefined, 'video change clears guidance');
    retired({ source: oldSource, data: { source: 'tvd-yt-embed', type: 'progress', videoId: videos[0].youtubeId, currentTime: 0, duration: 30.461, state: 1 } });
    emit({ type: 'stateChange', state: 1 }); progress(30.01); progress(0);
    assert.equal(hint(), undefined, 'final boundary has no Next guidance');
    iframeRef.current = { contentWindow: { postMessage() {} } };
    props = { ...props, video: videos[0], queue: { ...props.queue, index: 0 } };
    h.render(props); emit({ type: 'stateChange', state: 1 }); progress(30.01); progress(0);
    assert.ok(hint());
    assert.equal(h.render({ ...props, open: false }), null);
    assert.equal(listeners.size, 0);
    h.render(props);
    assert.equal(hint(), undefined, 'reopening the same video starts without guidance');
  } finally { h.unmount(); globalThis.window = oldWindow; delete globalThis.__pulseHarness; }
});

test("production diagnostics remain disabled even when query and storage opt in", async () => {
  const { videoDiagnostic } = await compiled('./src/features/pulse/videoDiagnostics.js', [], { DEV: false, PROD: true });
  const oldWindow = globalThis.window, oldStorage = globalThis.sessionStorage, oldInfo = console.info;
  let calls = 0;
  globalThis.window = { location: { search: '?pulseVideoDebug=1' } };
  globalThis.sessionStorage = { getItem: () => '1' };
  console.info = () => calls++;
  try {
    for (const event of ['bridge-event', 'position-reset', 'automatic-next-request', 'transition-summary']) videoDiagnostic(event, { state: 1 });
    assert.equal(calls, 0);
  } finally { console.info = oldInfo; globalThis.window = oldWindow; globalThis.sessionStorage = oldStorage; }
});

test("development diagnostics suppress routine progress but retain state and transition evidence", async () => {
  const {videoDiagnostic}=await compiled('./src/features/pulse/videoDiagnostics.js',[],{DEV:true});
  const oldWindow=globalThis.window,oldStorage=globalThis.sessionStorage,oldInfo=console.info,logs=[];
  globalThis.window={location:{search:'?pulseVideoDebug=1'}};
  globalThis.sessionStorage={getItem:()=>null};
  console.info=(...args)=>logs.push(args);
  try {
    videoDiagnostic('bridge-event',{type:'progress'});
    videoDiagnostic('bridge-event',{type:'stateChange',state:0});
    videoDiagnostic('position-reset',{from:59,to:0,cause:'undetermined'});
    videoDiagnostic('automatic-next-request',{id:'abcdefghijk'});
    assert.equal(logs.length,3);
    assert.equal(logs[0][2].state,0);
  } finally {console.info=oldInfo;globalThis.window=oldWindow;globalThis.sessionStorage=oldStorage;}
});
