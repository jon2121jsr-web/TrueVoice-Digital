// src/components/TrueVoiceScrollPreview.jsx
// Homepage teaser rail for TrueVoice Scroll (formerly "Spiritual Scrolling").
// Replaces the old "This week on TrueVoice" programming-schedule section --
// same slot on the page, same horizontal-scroller shell as ReelsGrid, but a
// deliberately different card language (tall 9:16 posters, dark scrim, gold
// TrueVoice accent) so it reads as its own distinct "Reels tray," not just
// another Channels row.
//
// Whichever video card is centered in the strip gets a live, silent,
// looping ~2s preview in place of its static thumbnail -- a "live photo"
// nudge that signals "this moves, tap it" before anyone taps anything.
// It's a plain <iframe> (YouTube embed URL params only, no JS Player API
// instance) rather than the full useYouTubePlayer machinery ScrollFeed
// uses -- this is a decorative teaser with no controls, mute toggle, or
// reactions to wire up, so the lighter embed is the right tool.
//
// Cards are real feed_items -- same table, same status filter ScrollFeed
// itself reads -- so this rail is never out of sync with what's actually
// live in Scroll. Tapping a card deep-links straight into /scroll/:id,
// landing on that exact card inside the full vertical feed; ScrollFeed's
// own auto-advance (FeedCard's onEnded) takes it from there.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useFeedItems } from "../hooks/useFeedItems";
import { trackEvent } from "../lib/analytics";
import "./TrueVoiceScrollPreview.css";

const TYPE_LABELS = { reel: "Reel", snip: "Snip", verse: "Verse", meme: "Meme" };

// How much of the clip the centered-card live preview loops -- short on
// purpose, this is a moving-thumbnail nudge, not a watch.
const PREVIEW_LOOP_SECONDS = 2;

function posterFor(item) {
  if (item.item_type === "meme" && item.image_url) return item.image_url;
  if ((item.item_type === "reel" || item.item_type === "snip") && item.youtube_id) {
    return `https://img.youtube.com/vi/${item.youtube_id}/hqdefault.jpg`;
  }
  return null;
}

function loopEmbedSrc(item) {
  const start = item.clip_start_seconds || 0;
  const end = start + PREVIEW_LOOP_SECONDS;
  // loop=1 only actually loops a single video when playlist is set to that
  // same video id -- a documented quirk of the YouTube embed player, not
  // an oversight.
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    loop: "1",
    playlist: item.youtube_id,
    start: String(start),
    end: String(end),
    playsinline: "1",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    disablekb: "1",
  });
  return `https://www.youtube.com/embed/${item.youtube_id}?${params.toString()}`;
}

function PreviewCard({ item, position, isCentered, cardRef }) {
  const poster = posterFor(item);
  const isVerse = item.item_type === "verse";
  const isVideo = item.item_type === "reel" || item.item_type === "snip";
  const meta = [item.speaker, item.source_show].filter(Boolean).join(" · ");
  const showLoop = isCentered && isVideo && item.youtube_id;

  function handleClick() {
    trackEvent("home_scroll_preview_click", {
      site: "home",
      item_id: item.id,
      item_type: item.item_type,
      position,
    });
  }

  return (
    <Link
      to={`/scroll/${item.id}`}
      className={`tvs-card${isVerse ? " tvs-card--verse" : ""}`}
      onClick={handleClick}
      ref={cardRef}
      data-item-id={item.id}
    >
      {showLoop ? (
        <iframe
          className="tvs-card-poster tvs-card-loop"
          src={loopEmbedSrc(item)}
          title=""
          allow="autoplay; encrypted-media"
          tabIndex={-1}
          aria-hidden="true"
        />
      ) : (
        poster && <img className="tvs-card-poster" src={poster} alt="" loading="lazy" />
      )}
      {!isVerse && <div className="tvs-card-scrim" />}

      <span className="tvs-card-tag">{TYPE_LABELS[item.item_type] || "Scroll"}</span>
      {!showLoop && <span className="tvs-card-play" aria-hidden="true">&#9654;</span>}

      {isVerse ? (
        <div className="tvs-card-verse-body">
          <p className="tvs-card-verse-text">&ldquo;{item.verse_text}&rdquo;</p>
          <p className="tvs-card-verse-ref">{item.verse_ref}</p>
        </div>
      ) : (
        <div className="tvs-card-bottom">
          {item.title && <p className="tvs-card-title">{item.title}</p>}
          {meta && <p className="tvs-card-meta">{meta}</p>}
          {item.caption && !item.title && <p className="tvs-card-title">{item.caption}</p>}
        </div>
      )}
    </Link>
  );
}

function SkeletonCard() {
  return <div className="tvs-card tvs-card--skeleton" aria-hidden="true" />;
}

export default function TrueVoiceScrollPreview() {
  const { items, loading, error } = useFeedItems({ limit: 12 });
  const scrollerRef = useRef(null);
  const cardRefs = useRef([]);
  const [centeredId, setCenteredId] = useState(null);

  useEffect(() => {
    if (loading || error || items.length === 0) return;
    trackEvent("home_scroll_preview_impression", {
      site: "home",
      count: items.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, items.length]);

  // Track whichever card is centered in the strip -- same IntersectionObserver
  // pattern ScrollFeed uses for its own active-card tracking, just against a
  // horizontally-scrolling root instead of a vertical one.
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container || items.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.65) {
            setCenteredId(entry.target.dataset.itemId);
          }
        });
      },
      { root: container, threshold: [0.65] }
    );

    cardRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  // Nothing live yet -- rather than show an empty rail under a heading,
  // just skip the section entirely (same call ScrollFeed itself makes).
  if (!loading && (error || items.length === 0)) return null;

  return (
    <section className="tv-section tv-section--stacked tvs-section">
      <h2 className="tv-section-title">TrueVoice Scroll</h2>
      <p className="tvs-intro">Tap in — it leads right into the next one.</p>

      <div className="tvs-scroller-wrap">
        <div className="tvs-scroller" ref={scrollerRef}>
          {loading
            ? [0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
            : (
              <>
                {items.map((item, idx) => (
                  <PreviewCard
                    key={item.id}
                    item={item}
                    position={idx}
                    isCentered={centeredId === item.id}
                    cardRef={(el) => { cardRefs.current[idx] = el; }}
                  />
                ))}
                <Link
                  to="/scroll"
                  className="tvs-card tvs-card--more"
                  onClick={() => trackEvent("home_scroll_preview_click", { site: "home", item_id: null, item_type: "see_all", position: items.length })}
                >
                  <span className="tvs-more-arrow" aria-hidden="true">&rarr;</span>
                  <span className="tvs-more-label">See all</span>
                </Link>
              </>
            )}
        </div>
      </div>
    </section>
  );
}
