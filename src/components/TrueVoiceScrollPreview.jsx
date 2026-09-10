// src/components/TrueVoiceScrollPreview.jsx
// Homepage teaser rail for TrueVoice Scroll (formerly "Spiritual Scrolling").
// Replaces the old "This week on TrueVoice" programming-schedule section --
// same slot on the page, same horizontal-scroller shell as ReelsGrid, but a
// deliberately different card language (tall 9:16 posters, dark scrim, gold
// TrueVoice accent) so it reads as its own distinct "Reels tray," not just
// another Channels row.
//
// Cards are real feed_items -- same table, same status filter ScrollFeed
// itself reads -- so this rail is never out of sync with what's actually
// live in Scroll. Tapping a card deep-links straight into /scroll/:id,
// landing on that exact card inside the full vertical feed; ScrollFeed's
// own auto-advance (FeedCard's onEnded) takes it from there.
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useFeedItems } from "../hooks/useFeedItems";
import { trackEvent } from "../lib/analytics";
import "./TrueVoiceScrollPreview.css";

const TYPE_LABELS = { reel: "Reel", snip: "Snip", verse: "Verse", meme: "Meme" };

function posterFor(item) {
  if (item.item_type === "meme" && item.image_url) return item.image_url;
  if ((item.item_type === "reel" || item.item_type === "snip") && item.youtube_id) {
    return `https://img.youtube.com/vi/${item.youtube_id}/hqdefault.jpg`;
  }
  return null;
}

function PreviewCard({ item, position }) {
  const poster = posterFor(item);
  const isVerse = item.item_type === "verse";
  const meta = [item.speaker, item.source_show].filter(Boolean).join(" · ");

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
    >
      {poster && (
        <img className="tvs-card-poster" src={poster} alt="" loading="lazy" />
      )}
      {!isVerse && <div className="tvs-card-scrim" />}

      <span className="tvs-card-tag">{TYPE_LABELS[item.item_type] || "Scroll"}</span>
      <span className="tvs-card-play" aria-hidden="true">&#9654;</span>

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

  useEffect(() => {
    if (loading || error || items.length === 0) return;
    trackEvent("home_scroll_preview_impression", {
      site: "home",
      count: items.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, items.length]);

  // Nothing live yet -- rather than show an empty rail under a heading,
  // just skip the section entirely (same call ScrollFeed itself makes).
  if (!loading && (error || items.length === 0)) return null;

  return (
    <section className="tv-section tv-section--stacked tvs-section">
      <h2 className="tv-section-title">TrueVoice Scroll</h2>
      <p className="tvs-intro">Tap in — it leads right into the next one.</p>

      <div className="tvs-scroller-wrap">
        <div className="tvs-scroller">
          {loading
            ? [0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
            : (
              <>
                {items.map((item, idx) => (
                  <PreviewCard key={item.id} item={item} position={idx} />
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
