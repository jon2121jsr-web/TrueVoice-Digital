import { Capacitor, registerPlugin } from '@capacitor/core';

export const IS_NATIVE_RADIO = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

// A transport adapter, not a second playback state machine. Native snapshots
// are authoritative; revision numbers reject late command/read responses.
export function createNativeRadio(plugin, { canPlay = () => true } = {}) {
  let snapshot = { revision: -1, playing: false, buffering: false, wantsPlayback: false, owner: 'radio', metadata: {} };
  let connection;
  let queue = Promise.resolve();
  const listeners = new Set();
  const accept = next => {
    if (!Number.isSafeInteger(next?.revision) || next.revision < snapshot.revision) return;
    snapshot = next;
    listeners.forEach(fn => fn(snapshot));
  };
  const fail = () => {
    snapshot = { ...snapshot, error: 'Native radio unavailable. Tap Play to retry.' };
    listeners.forEach(fn => fn(snapshot));
  };
  const connect = () => {
    if (!connection) connection = (async () => {
      const handle = await plugin.addListener('stateChanged', accept);
      try { accept(await plugin.getState()); }
      catch (error) { await handle.remove(); throw error; }
    })().catch(error => { connection = null; fail(); throw error; });
    return connection;
  };
  const command = (method, options) => {
    const job = queue.catch(() => {}).then(async () => {
      await connect();
      const state = await plugin[method](options);
      accept(state);
      return state;
    });
    queue = job;
    // Callers may use this as a video-start barrier; errors must fail closed.
    job.catch(fail);
    return job;
  };
  return {
    subscribe(fn) {
      listeners.add(fn);
      fn(snapshot);
      connect().catch(() => {});
      return () => listeners.delete(fn);
    },
    play: (owner = 'radio', reconnect = false) => canPlay()
      ? command('play', { owner, reconnect, intentVersion: snapshot.intentVersion ?? 0 })
      : Promise.reject(new Error('Tap Play to start native radio.')),
    pause: (owner = 'radio') => command('pause', { owner }),
    setVideoActive: active => command('setVideoActive', { active }),
    refresh: () => command('getState'),
    getSnapshot: () => snapshot,
  };
}

// A query/deep-link effect must not bypass browser autoplay protection merely
// because AVPlayer is available. Native remote commands are handled in Swift,
// and are disabled there until an initial explicit Play has occurred.
let gestureAt = 0;
if (IS_NATIVE_RADIO && typeof document !== 'undefined') {
  const rememberGesture = event => { if (event.isTrusted) gestureAt = Date.now(); };
  ['pointerup', 'click', 'keydown'].forEach(type => document.addEventListener(type, rememberGesture, true));
}
// There is deliberately no web implementation or HTML-audio fallback on iOS.
export const nativeRadio = IS_NATIVE_RADIO ? createNativeRadio(registerPlugin('TrueVoiceRadio'), {
  canPlay: () => gestureAt > 0 && Date.now() - gestureAt < 1500,
}) : null;
