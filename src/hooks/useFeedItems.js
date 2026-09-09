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
      const { data, error } = await supabase
        .from("feed_items")
        .select("*")
        .in("status", ["auto_active", "active"])
        .order("published_at", { ascending: false })
        .limit(limit);

      if (!alive) return;
      if (error) {
        setState({ items: [], loading: false, error: error.message });
        return;
      }
      setState({ items: data ?? [], loading: false, error: null });
    }

    load();
    return () => { alive = false; };
  }, [limit]);

  return state;
}
