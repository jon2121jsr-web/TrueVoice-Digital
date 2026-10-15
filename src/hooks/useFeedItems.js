// src/hooks/useFeedItems.js
// Fetches the live TrueVoice Scroll feed from feed_items.
// Public read -- no auth required. Only feed_reactions requires sign-in.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { selectScrollItems } from "../lib/scrollItems";

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
        .neq("item_type", "verse")
        .order("published_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(poolSize);

      if (!alive) return;
      if (error) {
        setState({ items: [], loading: false, error: error.message });
        return;
      }
      setState({
        items: selectScrollItems(data ?? [], limit),
        loading: false,
        error: null,
      });
    }

    load();
    return () => { alive = false; };
  }, [limit]);

  return state;
}
