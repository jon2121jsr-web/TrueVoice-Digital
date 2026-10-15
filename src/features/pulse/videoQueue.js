export function videoId(video) { return video?.youtubeId || video?.videoId; }

export function createVideoQueue(collection, selected) {
  const seen = new Set();
  const videos = collection.filter(video => {
    const id = videoId(video);
    if (video?.item_type && !["reel", "snip"].includes(video.item_type)) return false;
    if (!/^[\w-]{11}$/.test(id || "") || video.unavailable || video.error || /^\[?(?:private|deleted) video\]?$/i.test(video.title || "") || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map(video => ({ ...video }));
  const index = videos.findIndex(video => videoId(video) === videoId(selected));
  if (index !== -1) videos[index] = { ...selected };
  return index === -1 ? null : { videos, index };
}

export function queueDestination(queue, step, expectedId) {
  if (!queue || videoId(queue.videos[queue.index]) !== expectedId) return null;
  const index = queue.index + step;
  return index >= 0 && index < queue.videos.length ? { ...queue, index } : null;
}

// Require actual playback before accepting ENDED, and never accept a paused source.
export function createEndedGuard() {
  let playing = false, paused = false, ended = false;
  return state => {
    if (state === 1) { playing = true; paused = false; }
    if (state === 2) paused = true;
    if (state !== 0 || !playing || paused || ended) return false;
    ended = true;
    return true;
  };
}
