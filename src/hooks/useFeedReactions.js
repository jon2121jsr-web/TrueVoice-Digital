// src/hooks/useFeedReactions.js
// Reaction (heart) counts + the current user's own reaction, batched for
// the whole bounded feed in one query rather than one per card. Signed-out
// users never issue this query at all -- the feed_reactions SELECT policy
// requires auth.uid() is not null, so an anonymous read would just come
// back empty and risk being shown as a misleading "0".
import { useCallback, useEffect, useState } from "react";
import { supabaseRealtime } from "../lib/supabaseRealtime";

export function useFeedReactions(itemIds, session) {
  const [byItem, setByItem] = useState({});
  const idsKey = itemIds.join(",");

  useEffect(() => {
    if (!session || itemIds.length === 0) {
      setByItem({});
      return undefined;
    }
    let alive = true;

    async function load() {
      const { data, error } = await supabaseRealtime
        .from("feed_reactions")
        .select("feed_item_id, user_id")
        .in("feed_item_id", itemIds);
      if (!alive || error) return;

      const next = {};
      itemIds.forEach((id) => { next[id] = { count: 0, reacted: false }; });
      (data ?? []).forEach((row) => {
        const entry = next[row.feed_item_id] ?? (next[row.feed_item_id] = { count: 0, reacted: false });
        entry.count += 1;
        if (row.user_id === session.user.id) entry.reacted = true;
      });
      setByItem(next);
    }
    load();

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, idsKey]);

  const toggle = useCallback(async (itemId) => {
    if (!session) return;
    const current = byItem[itemId] ?? { count: 0, reacted: false };

    // Optimistic update -- reverted below if the write fails.
    setByItem((prev) => ({
      ...prev,
      [itemId]: { count: current.count + (current.reacted ? -1 : 1), reacted: !current.reacted },
    }));

    const query = current.reacted
      ? supabaseRealtime.from("feed_reactions").delete()
          .eq("feed_item_id", itemId).eq("user_id", session.user.id)
      : supabaseRealtime.from("feed_reactions").insert({
          feed_item_id: itemId,
          user_id: session.user.id,
        });

    const { error } = await query;
    if (error) {
      setByItem((prev) => ({ ...prev, [itemId]: current }));
    }
  }, [session, byItem]);

  return { byItem, toggle };
}
