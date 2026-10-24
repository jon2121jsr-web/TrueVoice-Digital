// Local diagnosis only: no network, storage writes, timers, or production logs.
// Hard cap per page/module lifetime, including command and recovery diagnostics.
let remainingLogs = 200;

export function radioBufferState(audio) {
  let bufferedAhead = 0;
  const bufferedRanges = [];
  try {
    for (let i = 0; i < Math.min(audio.buffered.length, 8); i++) {
      const start = audio.buffered.start(i), end = audio.buffered.end(i);
      bufferedRanges.push([start, end]);
      if (start <= audio.currentTime && end >= audio.currentTime) bufferedAhead = end - audio.currentTime;
    }
  } catch { /* Ranges may change while the resource is replaced. */ }
  return { bufferedAhead, bufferedRanges };
}

function enabled() {
  if (!import.meta.env.DEV) return false;
  try {
    return sessionStorage.getItem('pulse-radio-debug') === '1' ||
      new URLSearchParams(window.location.search).get('pulseRadioDebug') === '1';
  } catch { return false; }
}

export function radioDiagnostic(event, audio, details = {}) {
  if (!enabled() || remainingLogs <= 0) return;
  try {
    const { bufferedAhead, bufferedRanges } = radioBufferState(audio);
    const source = new URL(audio.currentSrc || audio.src, window.location.href);
    remainingLogs -= 1;
    console.info('[PULSE radio]', event, {
      time: Math.round(performance.now()),
      source: source.origin + source.pathname, // Never log query strings/tokens.
      paused: audio.paused, readyState: audio.readyState, networkState: audio.networkState,
      currentTime: audio.currentTime, bufferedAhead: Math.round(bufferedAhead * 100) / 100,
      bufferedRanges,
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
