// Local diagnosis only: no network, storage writes, timers, or production logs.
function enabled() {
  if (!import.meta.env.DEV) return false;
  try {
    return sessionStorage.getItem('pulse-radio-debug') === '1' ||
      new URLSearchParams(window.location.search).get('pulseRadioDebug') === '1';
  } catch { return false; }
}

export function radioDiagnostic(event, audio, details = {}) {
  if (!enabled()) return;
  try {
    let bufferedAhead = 0;
    for (let i = 0; i < audio.buffered.length; i++) {
      if (audio.buffered.start(i) <= audio.currentTime && audio.buffered.end(i) >= audio.currentTime) {
        bufferedAhead = audio.buffered.end(i) - audio.currentTime;
        break;
      }
    }
    const source = new URL(audio.currentSrc || audio.src, window.location.href);
    console.info('[PULSE radio]', event, {
      time: Math.round(performance.now()),
      source: source.origin + source.pathname, // Never log query strings/tokens.
      paused: audio.paused, readyState: audio.readyState, networkState: audio.networkState,
      currentTime: audio.currentTime, bufferedAhead: Math.round(bufferedAhead * 100) / 100,
      errorCode: audio.error?.code ?? null, ...details,
    });
  } catch { /* A diagnostic must never interrupt audio. */ }
}

export function observeRadioDiagnostics(audio, context = () => ({})) {
  if (!enabled() || !audio) return () => {};
  const events = ['loadstart', 'emptied', 'abort', 'play', 'playing', 'pause', 'waiting', 'stalled', 'suspend', 'error', 'ended'];
  const listeners = events.map(event => {
    const listener = () => radioDiagnostic(event, audio, context());
    audio.addEventListener(event, listener);
    return [event, listener];
  });
  radioDiagnostic('attach', audio, context());
  return () => {
    radioDiagnostic('detach', audio, context());
    listeners.forEach(([event, listener]) => audio.removeEventListener(event, listener));
  };
}
