// src/components/FeedCard.jsx
// Renders one Spiritual Scrolling card. Video types (reel/snip) use the
// YouTube IFrame Player API -- mute/pause/play are real API calls, not
// src swaps, so position is preserved across scroll and mute toggles.
// Player instances are only created for the active card and its immediate
// neighbor (isNear); everything else stays a cheap poster image. onEnded
// fires when a clip finishes, driving auto-advance to the next card.
// Every card type gets a ReactionRail (heart + share) -- session/reaction
// state is fetched once for the whole feed in ScrollFeed and passed down.
import { useRef } from "react";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import ReactionRail from "./ReactionRail";
import "./FeedCard.css";

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

function VerseCard({ item }) {
  return (
    <>
      <div className="feed-card-verse-body">
        <p className="feed-verse-text">&ldquo;{item.verse_text}&rdquo;</p>
        <p className="feed-verse-ref">{item.verse_ref}</p>
      </div>
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
  let inner = null;
  if (item.item_type === "reel" || item.item_type === "snip") {
    inner = <VideoCard item={item} isActive={isActive} isNear={isNear} onEnded={onEnded} />;
  } else if (item.item_type === "verse") {
    inner = <VerseCard item={item} />;
  } else if (item.item_type === "meme" && item.image_url) {
    inner = <MemeCard item={item} />;
  }

  if (!inner) return null;

  return (
    <div className="feed-card" data-type={item.item_type}>
      {inner}
      <ReactionRail
        item={item}
        session={session}
        reaction={reaction}
        onToggleReaction={onToggleReaction}
      />
    </div>
  );
}
