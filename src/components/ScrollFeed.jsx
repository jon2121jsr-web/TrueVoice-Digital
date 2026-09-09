// src/components/ScrollFeed.jsx
// The Spiritual Scrolling feed -- vertical snap-scroll, bounded by a fixed
// set rather than infinite. Route: /scroll
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFeedItems } from "../hooks/useFeedItems";
import { useAuthSession } from "../hooks/useAuthSession";
import { useFeedReactions } from "../hooks/useFeedReactions";
import { trackEvent } from "../lib/analytics";
import FeedCard from "./FeedCard";
import "./ScrollFeed.css";

export default function ScrollFeed() {
  const { id: deepLinkId } = useParams();
  const { items, loading, error } = useFeedItems({ limit: 30 });
  const { session } = useAuthSession();
  const itemIds = items.map((item) => item.id);
  const { byItem: reactions, toggle: toggleReaction } = useFeedReactions(itemIds, session);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const maxSeenRef = useRef(0);
  const containerRef = useRef(null);
  const cardRefs = useRef([]);
  const didJumpRef = useRef(false);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    if (activeIndex > maxSeenRef.current) maxSeenRef.current = activeIndex;
  }, [activeIndex]);

  // Session start + depth-reached-on-exit. One row each per visit; depth
  // is "how far did a stranger actually get" -- the funnel audit's
  // north-star signal, independent of any single card's own engagement.
  useEffect(() => {
    const startedAt = Date.now();
    trackEvent("scroll_session_start", { site: "scroll" });
    return () => {
      trackEvent("scroll_session_depth", {
        site: "scroll",
        cards_seen: maxSeenRef.current + 1,
        duration_ms: Date.now() - startedAt,
      });
    };
  }, []);

  // /scroll/:id deep link (from a shared card) -- jump straight to that
  // card once the feed has loaded, instead of always starting at the top.
  // Runs once; a visitor scrolling around afterward isn't fighting a
  // re-jump on every render.
  useEffect(() => {
    if (didJumpRef.current || !deepLinkId || items.length === 0) return;
    const idx = items.findIndex((item) => item.id === deepLinkId);
    if (idx === -1) return;
    didJumpRef.current = true;
    setActiveIndex(idx);
    cardRefs.current[idx]?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [deepLinkId, items]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number(entry.target.dataset.index);
            setActiveIndex(idx);
          }
        });
      },
      { root: container, threshold: [0.6] }
    );

    cardRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  // A clip finishing advances to the next card -- but only if the user
  // hasn't already scrolled away from it in the meantime (stale onEnded
  // from a card that's no longer active is a no-op, not a yank-back).
  const handleEnded = (fromIdx) => {
    if (activeIndexRef.current !== fromIdx) return;
    const finished = items[fromIdx];
    if (finished) {
      trackEvent("scroll_card_watch_complete", { site: "scroll", item_id: finished.id, item_type: finished.item_type });
    }
    const next = cardRefs.current[fromIdx + 1];
    next?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return <div className="scroll-feed-status">Loading today's set…</div>;
  }

  if (error) {
    return <div className="scroll-feed-status">Couldn't load the feed right now.</div>;
  }

  if (items.length === 0) {
    return <div className="scroll-feed-status">Nothing in the feed yet.</div>;
  }

  return (
    <div className="scroll-feed" ref={containerRef}>
      <Link to="/" className="scroll-feed-home">← TrueVoice.Digital</Link>

      {items.map((item, idx) => (
        <div
          key={item.id}
          className="scroll-feed-slide"
          data-index={idx}
          ref={(el) => { cardRefs.current[idx] = el; }}
        >
          <div className="scroll-feed-progress">{idx + 1} / {items.length}</div>
          <FeedCard
            item={item}
            isActive={idx === activeIndex}
            // Each video card creates a brand-new YouTube iframe player,
            // and that iframe's own network bootstrap (its heaviest cost)
            // takes real time -- a ±1 window only gives the very next
            // card a head start, so scrolling past a video before it
            // finishes doesn't leave the following one enough lead time
            // to be ready by the time it becomes active. ±2 buys two
            // cards' worth of scrolling time to initialize instead of
            // one, at the cost of up to 5 concurrent players instead of
            // 3 (each starts muted/paused, so it's a memory/CPU trade,
            // not an autoplay-noise one).
            isNear={Math.abs(idx - activeIndex) <= 2}
            onEnded={() => handleEnded(idx)}
            session={session}
            reaction={reactions[item.id]}
            onToggleReaction={toggleReaction}
          />
        </div>
      ))}

      <div
        className="scroll-feed-slide"
        data-index={items.length}
        ref={(el) => { cardRefs.current[items.length] = el; }}
      >
        <div className="feed-card feed-card-end">
          <div className="feed-end-seal">✓</div>
          <p className="feed-end-title">Today's set — complete</p>
          <p className="feed-end-sub">{items.length} of {items.length}. That's the walk for today.</p>
        </div>
      </div>
    </div>
  );
}
