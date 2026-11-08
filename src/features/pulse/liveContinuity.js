// A moving seekable window is evidence; buffered.end is not a live edge.
// Learn this connection's ordinary latency before an interruption. Never seek.
export function createLiveContinuityMonitor() {
  let previous = null, baseline = null, healthySamples = 0;
  let interrupted = false, staleSince = null;
  const reset = () => {
    previous = null; baseline = null; healthySamples = 0;
    interrupted = false; staleSince = null;
  };
  return {
    reset,
    sample(audio, now, progressed) {
      let start, end;
      try {
        if (audio.duration !== Infinity || audio.seekable?.length !== 1 ||
            audio.paused || audio.seeking) { reset(); return false; }
        start = audio.seekable.start(0); end = audio.seekable.end(0);
      } catch { reset(); return false; }
      const time = audio.currentTime;
      if (![start, end, time, now].every(Number.isFinite) || start < 0 ||
          end <= start || time < start || time > end) { reset(); return false; }
      const lag = end - time;
      const last = previous;
      previous = { end, time, now };
      // Ignore discontinuities and timer suspension, including background gaps.
      if (!last || now <= last.now || now - last.now > 2500 ||
          end < last.end || time < last.time ||
          end - last.end > Math.max(12, (now - last.now) / 1000 + 2)) {
        baseline = null; healthySamples = 0; interrupted = false; staleSince = null;
        return false;
      }
      if (!progressed && baseline !== null) interrupted = true;
      if (!interrupted) {
        if (progressed) {
          baseline = baseline === null ? lag : Math.max(baseline, lag);
          if (end > last.end) healthySamples++;
        }
        return false;
      }
      // Require a learned baseline, resumed playback, and persistent extra lag.
      // Fixed provider latency alone never triggers a reload.
      if (healthySamples < 3 || lag < baseline + 3) { staleSince = null; return false; }
      staleSince ??= { now, end };
      return progressed && now - staleSince.now >= 3000 && end - staleSince.end >= 2;
    },
  };
}
