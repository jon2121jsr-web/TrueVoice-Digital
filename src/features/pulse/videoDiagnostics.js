// Temporary diagnostics: development builds only, opt-in, public video data only.
export function videoDiagnostic(event, details = {}) {
  if (!import.meta.env.DEV) return;
  if (event === 'bridge-event' && details.type === 'progress') return;
  try {
    if (sessionStorage.getItem('pulse-video-debug') !== '1' && new URLSearchParams(window.location.search).get('pulseVideoDebug') !== '1') return;
    console.info('[PULSE video]', event, {
      ...details, time: Math.round(performance.now()),
      activation: navigator.userActivation?.isActive ?? null,
    });
  } catch { /* diagnostics must never affect playback */ }
}

export function diagnosticEmbed(url) {
  try {
    const parsed = new URL(url);
    const params = Object.fromEntries(['v','autoplay','mute','controls','loop','playlist','start','end','enablejsapi'].map(key => [key, parsed.searchParams.get(key)]));
    return { origin: parsed.origin, path: parsed.pathname, params };
  } catch { return { invalidUrl: true }; }
}
