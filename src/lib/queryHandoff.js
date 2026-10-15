export function resolveShowHandoff(show, autoplay, section, feed) {
  if (!show) return { action: "none" };
  if (!section) return { action: "unavailable", message: "This show is unavailable. Browse EXPLORE for more videos." };
  if (!autoplay) return { action: "browse" };
  if (feed?.loading) return { action: "wait" };
  if (feed?.error) return { action: "unavailable", message: "This show's videos could not load. Please try again later." };
  const video = feed?.videos?.[0];
  return video ? { action: "open", video } : { action: "unavailable", message: "No video is available for this show right now." };
}

export function consumeHandoffQuery(location, keys) {
  const params = new URLSearchParams(location.search);
  keys.forEach(key => params.delete(key));
  const query = params.toString();
  return { pathname: location.pathname, search: query ? `?${query}` : "", hash: location.hash };
}
