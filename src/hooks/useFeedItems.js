// src/hooks/useFeedItems.js
// Fetches the live Spiritual Scrolling feed from feed_items.
// Public read -- no auth required. Only feed_reactions requires sign-in.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useFeedItems({ limit = 30 } = {}) {
  const [state, setState] = useState({ items: [], loading: true, error: null });

  useEffect(() => {
    let alive = true;

    async function load() {
      // Pull a wider pool than we actually show. Sorted by pure recency,
      // a single prolific source (e.g. a channel that posted several
      // shorts back to back) fills consecutive slots -- the extra
      // headroom here means there's enough variety left to spread out
      // even after interleaving and slicing down to `limit`.
      const poolSize = Math.max(limit * 3, 60);
      const { data, error } = await supabase
        .from("feed_items")
        .select("*")
        .in("status", ["auto_active", "active"])
        .order("published_at", { ascending: false })
        .limit(poolSize);

      if (!alive) return;
      if (error) {
        setState({ items: [], loading: false, error: error.message });
        return;
      }
      setState({
        items: interleaveBySource(data ?? []).slice(0, limit),
        loading: false,
        error: null,
      });
    }

    load();
    return () => { alive = false; };
  }, [limit]);

  return state;
}

// Round-robins items across their `source` (channel/show) so a single
// prolific source's back-to-back uploads don't cluster into consecutive
// cards. Each source's own items keep their original (recency) order --
// they're just spread out across the feed instead of bunched together.
function interleaveBySource(items) {
  const buckets = new Map();
  const order = [];
  for (const item of items) {
    const key = item.source || item.item_type || "misc";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key).push(item);
  }

  const result = [];
  let remaining = items.length;
  while (remaining > 0) {
    for (const key of order) {
      const bucket = buckets.get(key);
      if (bucket.length) {
        result.push(bucket.shift());
        remaining -= 1;
      }
    }
  }
  return result;
}
