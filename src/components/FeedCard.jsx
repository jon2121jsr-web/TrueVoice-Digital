// src/components/FeedCard.jsx
// Renders one Spiritual Scrolling card. Video types (reel/snip) use the
// YouTube IFrame Player API -- mute/pause/play are real API calls, not
// src swaps, so position is preserved across scroll and mute toggles.
// Player instances are only created for the active card and its immediate
// neighbor (isNear); everything else stays a cheap poster image. onEnded
// fires when a clip finishes, driving auto-advance to the next card.
// Every card type gets a ReactionRail (heart + share) -- session/reaction
// state is fetched once for the whole feed in ScrollFeed and passed down.
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { useVerseRadioAudio } from "../hooks/useVerseRadioAudio";
import ReactionRail from "./ReactionRail";
import { trackEvent } from "../lib/analytics";
import "./FeedCard.css";

// Shows TrueVoice actually produces -- these are the only ones a
// follow_show CTA can point at (jumps straight into the latest episode).
// Labels double as the "Watch <label>" / "More from <label>" CTA copy.
// Keep this in sync with SHOW_SLUG_TO_SECTION in App.jsx.
const ORIGINAL_SHOW_LABELS = {
  pigskin:    "Pigskin Frenzy",
  denisha:    "Denisha's Show",
  tvd_shorts: "Ryan Kliesch",
};

// Licensed / third-party shows -- visit_site only, never autoplay (see the
// funnel audit follow-up: TrueVoice doesn't own an "episode" to send
// someone to for these, just a channel to go browse).
const LICENSED_SHOW_LABELS = {
  capturing_christianity: "Capturing Christianity",
  beat_allen_parr:        "The Beat by Allen Parr",
  cold_case_christianity: "Cold Case Christianity",
};

function resolveCta(item) {
  if (item.cta_type === "listen_live") {
    return { to: "/?listen=1", label: "Listen Live" };
  }
  if (item.cta_type === "follow_show" && ORIGINAL_SHOW_LABELS[item.cta_target]) {
    return {
      to: `/?show=${item.cta_target}&autoplay=1`,
      label: `Watch ${ORIGINAL_SHOW_LABELS[item.cta_target]}`,
    };
  }
  if (item.cta_type === "visit_site" && LICENSED_SHOW_LABELS[item.cta_target]) {
    return {
      to: `/?show=${item.cta_target}`,
      label: `More from ${LICENSED_SHOW_LABELS[item.cta_target]}`,
    };
  }
  return null;
}

function CTAStrip({ item }) {
  const cta = resolveCta(item);
  if (!cta) return null;

  function handleClick() {
    trackEvent("scroll_cta_click", {
      site: "scroll",
      item_id: item.id,
      cta_type: item.cta_type,
      cta_target: item.cta_target || null,
    });
    if (item.cta_type === "listen_live") {
      trackEvent("scroll_to_listen_live", { site: "scroll", item_id: item.id, source: "scroll" });
    }
  }

  return (
    <Link to={cta.to} className="feed-cta-strip" onClick={handleClick}>
      <span className="feed-cta-icon" aria-hidden="true">&#9654;</span>
      <span>{cta.label}</span>
    </Link>
  );
}

function VideoCard({ item, isActive, isNear, onEnded }) {
  const containerRef = useRef(null);
  const { ready, muted, toggleMute, stuck, resume } = useYouTubePlayer({
    containerRef,
    videoId: isNear ? item.youtube_id : null,
    clipStart: item.clip_start_seconds,
    clipEnd: item.clip_end_seconds,
    isActive,
    onEnded,
  });

  return (
    <>
      <div className="feed-card-media">
        {isNear && <div ref={containerRef} className="feed-card-player" />}
        {(!isNear || !ready) && (
          <img
            className="feed-card-poster"
            src={`https://img.youtube.com/vi/${item.youtube_id}/hqdefault.jpg`}
            alt={item.title || ""}
            loading="lazy"
          />
        )}
      </div>
      <div className="feed-card-scrim" />
      <div className="feed-card-top">
        <span className="feed-tag">{item.item_type === "reel" ? "Reel" : "Snip"}</span>
      </div>
      {isNear && (
        <button
          type="button"
          className="feed-mute-btn"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? "\u{1F507}" : "\u{1F50A}"}
        </button>
      )}
      {isActive && stuck && (
        <button
          type="button"
          className="feed-resume-btn"
          onClick={resume}
          aria-label="Play"
        >
          &#9654;
        </button>
      )}
      <div className="feed-card-bottom">
        <p className="feed-card-title">{item.title}</p>
        <p className="feed-card-meta">
          {[item.speaker, item.source_show].filter(Boolean).join(" · ")}
        </p>
      </div>
    </>
  );
}

function VerseCard({ item, isActive }) {
  // TrueVoice's live radio stream, playing while this card is on screen --
  // same feed-wide mute preference as the video cards, not reset per card.
  const { muted, toggleMute } = useVerseRadioAudio(isActive);

  return (
    <>
      <div className="feed-card-verse-body">
        <p className="feed-verse-text">&ldquo;{item.verse_text}&rdquo;</p>
        <p className="feed-verse-ref">{item.verse_ref}</p>
      </div>
      <button
        type="button"
        className="feed-mute-btn feed-mute-btn--verse"
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? "\u{1F507}" : "\u{1F50A}"}
      </button>
      <div className="feed-verse-mark">truevoice.digital</div>
    </>
  );
}

function MemeCard({ item }) {
  return (
    <>
      <img className="feed-card-poster" src={item.image_url} alt={item.caption || ""} />
      {item.caption && <p className="feed-meme-caption">{item.caption}</p>}
    </>
  );
}

export default function FeedCard({
  item,
  isActive,
  isNear = true,
  onEnded,
  session,
  reaction,
  onToggleReaction,
}) {
  // Impression = this card actually became the active one, not just that
  // it mounted nearby for pre-buffering (isNear casts a wider net than
  // "seen" on purpose -- see the funnel audit, §01).
  useEffect(() => {
    if (!isActive) return;
    trackEvent("scroll_card_impression", {
      site: "scroll",
      item_id: item.id,
      item_type: item.item_type,
      category: item.category || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, item.id]);

  let inner = null;
  if (item.item_type === "reel" || item.item_type === "snip") {
    inner = <VideoCard item={item} isActive={isActive} isNear={isNear} onEnded={onEnded} />;
  } else if (item.item_type === "verse") {
    inner = <VerseCard item={item} isActive={isActive} />;
  } else if (item.item_type === "meme" && item.image_url) {
    inner = <MemeCard item={item} />;
  }

  if (!inner) return null;

  return (
    <div className="feed-card" data-type={item.item_type}>
      {inner}
      <CTAStrip item={item} />
      <ReactionRail
        item={item}
        session={session}
        reaction={reaction}
        onToggleReaction={onToggleReaction}
      />
    </div>
  );
}
