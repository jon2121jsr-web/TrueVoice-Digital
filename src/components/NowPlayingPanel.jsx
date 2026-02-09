// src/components/NowPlayingPanel.jsx
import { useEffect, useMemo, useState } from "react";
import { fetchNowPlaying } from "../services/api";

export function NowPlayingPanel({
  streamUrl,
  audioRef,
  showHistory = false,
  onStatusChange,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  /* ----------------------------------------
     Poll AzuraCast Now Playing
  ---------------------------------------- */
  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const result = await fetchNowPlaying();
        if (isMounted) {
          setData(result || null);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("NowPlaying error:", err);
          setError(err?.message || "Failed to load now playing.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    const id = window.setInterval(load, 15_000);

    return () => {
      isMounted = false;
      window.clearInterval(id);
    };
  }, []);

  /* ----------------------------------------
     Derived display values
  ---------------------------------------- */
  const song = data?.song;
  const title =
    song?.title || (loading ? "Loading current track…" : "Live Stream");
  const artist = song?.artist || "TrueVoice Digital";
  const art = song?.art || null;
  const listeners = data?.listeners ?? null;

  const liveLabel = useMemo(() => {
    if (error) return "OFF AIR";
    return isPlaying ? "NOW STREAMING" : "READY";
  }, [error, isPlaying]);

  /* ----------------------------------------
     Inform App of status (LIVE dot, etc.)
  ---------------------------------------- */
  useEffect(() => {
    if (typeof onStatusChange === "function") {
      onStatusChange({
        isLive: !!isPlaying && !error,
        hasError: !!error,
        isLoading: !!loading,
        station: "TrueVoice Radio",
      });
    }
  }, [isPlaying, error, loading, onStatusChange]);

  /* ----------------------------------------
     Wire audio element (events only)
  ---------------------------------------- */
  useEffect(() => {
    const el = audioRef?.current;
    if (!el) return;

    el.preload = "none";

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [audioRef]);

  /* ----------------------------------------
     LIVE RADIO TOGGLE (STOP / START)
     - Pause = STOP (kill stream)
     - Play = START fresh (new connection)
  ---------------------------------------- */
  const handleTogglePlay = async () => {
    const el = audioRef?.current;
    if (!el) return;

    try {
      if (!isPlaying) {
        // START: fresh live connection
        setError(null);
        el.src = streamUrl;
        el.load(); // flush old buffers
        await el.play();
        setIsPlaying(true);
      } else {
        // STOP: kill stream completely
        el.pause();
        el.removeAttribute("src");
        el.load(); // fully reset decoder
        setIsPlaying(false);
      }
    } catch (err) {
      console.error("Live stream toggle failed:", err);
      setError("Tap again to start audio.");
    }
  };

  return (
    <div className="tv-now-playing">
      <div className="tv-now-inner">
        {/* LEFT: artwork */}
        <div className="tv-artwork-placeholder">
          {art && (
            <img
              src={art}
              alt={`${title} cover art`}
              className="tv-artwork-img"
              loading="lazy"
            />
          )}
        </div>

        {/* RIGHT: text/meta + controls */}
        <div className="tv-now-content">
          <span className="tv-eyebrow">
            {error ? "STREAM STATUS" : "NOW PLAYING"}
          </span>

          <h1 className="tv-song-title">{title}</h1>
          <p className="tv-artist-name">{artist}</p>

          <div className="tv-player-bar">
            <div className="tv-player-label">
              <span
                className={
                  isPlaying && !error
                    ? "tv-live-dot"
                    : "tv-live-dot tv-live-dot-idle"
                }
                aria-hidden="true"
              />
              <span className="tv-player-title">TRUEVOICE RADIO</span>
              <span className="tv-player-subtitle">{liveLabel}</span>

              {listeners != null && !Number.isNaN(listeners) && (
                <span className="tv-listeners">{listeners} listening</span>
              )}
            </div>

            <div className="tv-player-controls">
              <button
                type="button"
                className="tv-btn tv-btn-primary"
                onClick={handleTogglePlay}
              >
                {isPlaying ? "Stop" : "Listen Live"}
              </button>
            </div>
          </div>

          {showHistory && null}
        </div>
      </div>
    </div>
  );
}
