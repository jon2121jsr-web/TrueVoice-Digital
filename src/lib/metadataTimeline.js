// This is the total AzuraCast-to-audio offset, not a new hold after each poll.
// VITE_STREAM_METADATA_DELAY_SEC was never used by the LIVE controller; do not
// accidentally add it to the existing stream offset.
export function metadataDelaySeconds(value) {
  if (value == null || String(value).trim() === '') return 0;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

export const METADATA_POLL_MS = 5_000;

const songKey = song => song.id || `${song.artist || ''}\n${song.title}`;
const sameSong = (a, b) => a && b && ['id', 'title', 'artist', 'album', 'art'].every(key => a[key] === b[key]);

export function createMetadataTimeline(delaySec = 0) {
  let offsetMs = metadataDelaySeconds(delaySec) * 1000;
  let current = null;
  let pending = null;
  let latestStart = 0;
  let latestKey = null;

  function publish(song) {
    pending = null;
    const changed = !sameSong(current, song);
    current = song;
    return changed ? song : null;
  }

  return {
    setDelay(seconds, now = Date.now()) {
      const nextOffset = metadataDelaySeconds(seconds) * 1000;
      if (nextOffset === offsetMs) return null;
      offsetMs = nextOffset;
      // Keep the visible song and stale-snapshot guard. Only retime the pending
      // occurrence; never replay history or blank the UI during a source change.
      if (!pending) return null;
      pending.due = Math.min(pending.start * 1000 + offsetMs, now + offsetMs);
      return now >= pending.due ? publish(pending.song) : null;
    },
    observe(np, now = Date.now()) {
      const song = np?.song;
      if (!song?.title) return null;
      const rawStart = Number(np.played_at);
      const start = Number.isFinite(rawStart) ? Math.max(0, rawStart) : 0;
      const key = songKey(song);
      // Ignore older snapshots, including late cached responses after a flip.
      if (start && (start < latestStart || (start === latestStart && latestKey && key !== latestKey))) return null;
      if (start) { latestStart = start; latestKey = key; }
      if (!current) return publish(song); // Never show a blank player on join.
      if (sameSong(current, song)) return null;
      if (pending && pending.start === start && songKey(pending.song) === key) {
        pending.song = song; // Refined artwork must not restart the deadline.
        return now >= pending.due ? publish(song) : null;
      }
      // Without a source timestamp there is no reliable offset to apply.
      // Do not substitute poll-arrival time and recreate the original lag.
      const due = start ? Math.min(start * 1000 + offsetMs, now + offsetMs) : now;
      if (due <= now || songKey(current) === key) return publish(song);
      pending = { song, start, due };
      return null;
    },
    tick(now = Date.now()) {
      return pending && now >= pending.due ? publish(pending.song) : null;
    },
  };
}
