import { useEffect, useRef, useState } from "react";
import "./PulseLive.css";

function Artwork({ art, title }) {
  const [failedArt, setFailedArt] = useState(null);
  const hasArt = art && failedArt !== art;
  return (
    <div className="pulse-live__art">
      <img
        src={hasArt ? art : "/truevoice-favicon.png"}
        alt={hasArt ? `${title} cover art` : "TrueVoice Digital"}
        className={hasArt ? "" : "pulse-live__fallback"}
        onError={hasArt ? () => setFailedArt(art) : undefined}
      />
    </div>
  );
}

// Presentation only: the existing NowPlayingPanel supplies all audio state/actions.
function PlayerView({
  title, artist, art, isPlaying, isReconnecting, loading, error,
  onTogglePlay, compact, inactive, listeners, viewRef, strip = false,
}) {
  const status = isReconnecting ? "Reconnecting…" : isPlaying ? "Playing live" : "Ready when you are";
  return (
    <section
      ref={viewRef}
      className={`tv-now-playing pulse-live${compact ? strip ? " pulse-live--strip" : " pulse-live--floating" : ""}${inactive ? " pulse-live--inactive" : ""}`}
      aria-label={strip ? "PULSE LIVE radio strip" : compact ? "PULSE LIVE floating player" : "PULSE LIVE player"}
      aria-hidden={inactive}
      inert={inactive}
    >
      <header className="pulse-live__header">
        <span className="pulse-live__brand">TRUEVOICE <strong>PULSE</strong></span>
        <span className="pulse-live__badge"><i aria-hidden="true" /> LIVE</span>
      </header>
      <div className="pulse-live__body">
        <Artwork art={art} title={title} />
        <div className="pulse-live__track">
          <p className="pulse-live__eyebrow">THE SOUNDTRACK TO YOUR DAY</p>
          <h2>{title}</h2>
          <p className="pulse-live__artist">{artist}</p>
          <p className="pulse-live__status" role="status">{loading ? "Finding the current track…" : status}</p>
          {error && <p className="pulse-live__error" role="status">{error}</p>}
        </div>
        <button
          type="button"
          className="pulse-live__play"
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause PULSE LIVE" : "Play PULSE LIVE"}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            {isPlaying ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="M7 3v18l15-9z" />}
          </svg>
          <span>{isPlaying ? "Pause" : "Listen live"}</span>
        </button>
      </div>
      {!compact && (
        <footer className="pulse-live__footer">
          <span>Music is the heartbeat.</span>
          {listeners != null && <span>{listeners} listening</span>}
          <a href="#tv-connect-section">Discover Channels <span aria-hidden="true">↗</span></a>
        </footer>
      )}
    </section>
  );
}

export default function PulseLive({ isFloating, compact = false, ...props }) {
  const fullRef = useRef(null);
  const dockRef = useRef(null);

  useEffect(() => {
    const inactive = isFloating ? fullRef.current : dockRef.current;
    const active = isFloating ? dockRef.current : fullRef.current;
    if (inactive?.contains(document.activeElement)) {
      active?.querySelector("button")?.focus({ preventScroll: true });
    }
  }, [isFloating]);

  if (compact) return <PlayerView {...props} compact strip inactive={false} viewRef={fullRef} />;

  return (
    <>
      <PlayerView {...props} compact={false} inactive={isFloating} viewRef={fullRef} />
      <PlayerView {...props} compact inactive={!isFloating} viewRef={dockRef} />
    </>
  );
}
