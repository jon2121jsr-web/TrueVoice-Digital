export const EXPLORE_CATEGORIES = ["All", "Music", "Videos", "Creators", "Podcasts", "Channels"];
export function exploreVideos(items, category) {
  const videos = items.filter(item => item.id && item.youtube_id && (item.item_type === "reel" || item.item_type === "snip"));
  // Existing ingestion labels curated music artist videos as snip.
  return category === "Music" ? videos.filter(item => item.item_type === "snip" || item.category?.toLowerCase() === "music") : videos;
}
export function exploreSections(category) {
  return Object.fromEntries(EXPLORE_CATEGORIES.slice(1).map(value => [value.toLowerCase(), category === "All" || category === value]));
}
export function scrollDiscoveryLink(id) { return `/scroll/${encodeURIComponent(id)}`; }

// Normalize Supabase's snake_case fields to the existing modal video contract.
export function exploreModalVideo(item) {
  const youtubeId = item.youtube_id;
  const params = new URLSearchParams({ v: youtubeId, autoplay: "1", mute: "0" });
  if (item.clip_start_seconds) params.set("start", String(item.clip_start_seconds));
  if (item.clip_end_seconds) params.set("end", String(item.clip_end_seconds));
  return { youtubeId, title: item.title, description: item.description, thumbnailUrl: item.thumbnail_url || item.image_url,
    embedUrl: `https://truevoice.digital/yt-embed.html?${params}` };
}
