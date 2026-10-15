export function selectScrollItems(items, limit) {
  const visible = items.filter((item) =>
    ((item.item_type === "reel" || item.item_type === "snip") && item.youtube_id) ||
    (item.item_type === "meme" && item.image_url));
  const buckets = new Map();
  for (const item of visible) {
    const source = item.source_show || item.source_channel_id || item.source || item.item_type;
    if (!buckets.has(source)) buckets.set(source, []);
    buckets.get(source).push(item);
  }
  const result = [];
  while (result.length < Math.min(limit, visible.length)) {
    for (const bucket of buckets.values()) {
      if (bucket.length) result.push(bucket.shift());
      if (result.length === limit) break;
    }
  }
  return result;
}
