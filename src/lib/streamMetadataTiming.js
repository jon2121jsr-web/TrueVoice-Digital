import { metadataDelaySeconds } from './metadataTimeline.js';

// Optional public build setting. Preserve an explicit zero for controlled tests.
export function live365MetadataDelaySeconds(value) {
  const number = Number(value);
  return value == null || String(value).trim() === '' || !Number.isFinite(number) || number < 0
    ? 55 : number;
}

export function azuracastMetadataDelaySeconds(value, legacyDelay = 0) {
  const number = Number(value);
  return value == null || String(value).trim() === '' || !Number.isFinite(number) || number < 0
    ? metadataDelaySeconds(legacyDelay) : number;
}

// Classify the resource selected by HTMLMediaElement.currentSrc, never the
// configured/assigned primary URL. This chooses timing only, not audio routing.
export function streamMetadataTiming(currentSrc, legacyDelay = 0, live365Delay = 55, azuracastDelay) {
  let source = 'other';
  try {
    const url = new URL(currentSrc);
    if (url.protocol === 'https:') {
      const station = /^\/a61535\/?$/.test(url.pathname);
      if (station && (url.hostname === 'streaming.live365.com' || url.hostname.endsWith('.cdnstream.com'))) {
        source = 'live365';
      } else if (url.hostname === 'stream.truevoice.digital') {
        source = 'azuracast';
      }
    }
  } catch { /* Unknown sources retain the existing build offset. */ }
  return {
    source,
    seconds: source === 'live365' ? live365MetadataDelaySeconds(live365Delay)
      : source === 'azuracast' ? azuracastMetadataDelaySeconds(azuracastDelay, legacyDelay)
      : metadataDelaySeconds(legacyDelay),
  };
}
