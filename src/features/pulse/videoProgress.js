export function playbackProgress({ currentTime, duration, start = 0, end }) {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) return null;
  const from = Math.max(0, Number(start) || 0);
  const to = Math.min(duration, Number(end) > from ? Number(end) : duration);
  if (to <= from) return null;
  return Math.max(0, Math.min(1, (currentTime - from) / (to - from)));
}

// Evidence only: a backward jump can be looping, seeking or explicit replay.
// Never use this observation to advance a queue.
export function createPositionObserver() {
  let previous = null;
  return sample => {
    if (!Number.isFinite(sample.currentTime) || sample.currentTime < 0) return null;
    const boundary = Math.min(sample.duration, Number(sample.end) > 0 ? Number(sample.end) : sample.duration);
    const reset = previous !== null && sample.currentTime < previous - .75
      ? { from: previous, to: sample.currentTime, duration: sample.duration,
        state: sample.state, nearEnd: Number.isFinite(boundary) && boundary > 0 && previous >= boundary - 1,
        cause: 'undetermined: seek, replay or loop' } : null;
    previous = sample.currentTime;
    return reset;
  };
}
