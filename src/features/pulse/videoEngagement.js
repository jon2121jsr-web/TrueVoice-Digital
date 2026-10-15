export function exploreShareUrl(id) {
  const url = new URL('/explore', 'https://www.truevoice.digital');
  url.searchParams.set('video', id);
  return url.toString();
}
export function isLocallyLiked(id, storage) {
  try { return JSON.parse((storage || globalThis.localStorage).getItem('truevoice-video-likes') || '[]').includes(id); } catch { return false; }
}
export function setLocalLike(id, liked, storage = globalThis.localStorage) {
  const ids = new Set(JSON.parse(storage.getItem('truevoice-video-likes') || '[]'));
  if (liked) ids.add(id); else ids.delete(id);
  storage.setItem('truevoice-video-likes', JSON.stringify([...ids]));
}
export function resolveExploreLink(id, collection, loading) {
  if (!/^[\w-]{11}$/.test(id || '')) return { error: 'This video link is invalid.' };
  const video = collection.find(item => (item.youtubeId || item.videoId) === id);
  if (video) return { video };
  return loading ? { waiting: true } : { error: 'This video is unavailable in the current discovery collection.' };
}
export function exploreVideoLocation(location, id) {
  const params = new URLSearchParams(location.search);
  params.set('video', id);
  return { pathname: '/explore', search: `?${params}`, hash: location.hash };
}
