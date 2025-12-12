// src/components/NowPlayingPanel.jsx
import { useEffect, useMemo, useState } from "react";
import { fetchNowPlaying } from "../services/api"; // keep your current source

export function NowPlayingPanel({
  streamUrl,
  audioRef,
  showHistory = false, // we’re not using “Track History” button anymore
  onStatusChange,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);

  // Poll now-playing endpoint
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

  // ---- derive display values ----
  const song = data?.song;
  const title =
    song?.title || (loading ? "Loading current track…" : "Live Stream");
  const artist = song?.artist || "TrueVoice Digital";
  const art = song?.art || null;
  const listeners = data?.listeners ?? null;

  // “isLive” can be flaky depending on source; we’ll show streaming UI based on play state
  const liveLabel = useMemo(() => {
    if (error) return "OFF AIR";
    return isPlaying ? "NOW STREAMING" : "READY";
  }, [error, isPlaying]);

  // Keep App informed (LIVE dot / status)
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

  // Make sure the audio element exists and is wired
  useEffect(() => {
    if (!audioRef?.current) return;
    if (streamUrl && audioRef.current.src !== streamUrl) {
      audioRef.current.src = streamUrl;
    }
    audioRef.current.preload = "none";

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audioRef.current.addEventListener("play", onPlay);
    audioRef.current.addEventListener("pause", onPause);
    audioRef.current.addEventListener("ended", onEnded);

    return () => {
      if (!audioRef?.current) return;
      audioRef.current.removeEventListener("play", onPlay);
      audioRef.current.removeEventListener("pause", onPause);
      audioRef.current.removeEventListener("ended", onEnded);
    };
  }, [audioRef, streamUrl]);

  const handleTogglePlay = async () => {
    try {
      const el = audioRef?.current;
      if (!el) {
        console.warn("audioRef not attached. Add <audio ref={playerRef} /> in App.jsx");
        return;
      }

      if (el.paused) {
        // iOS/Chrome mobile requires this to be user-initiated (this click is good)
        await el.play();
      } else {
        el.pause();
      }
    } catch (e) {
      console.error("Audio play/pause failed:", e);
      setError("Tap again to start audio (browser blocked autoplay).");
    }
  };

  return (
    // ✅ THIS restores the “white card” background you’re missing locally
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
          <span className="tv-eyebrow">{error ? "STREAM STATUS" : "NOW PLAYING"}</span>

          <h1 className="tv-song-title">{title}</h1>
          <p className="tv-artist-name">{artist}</p>

          {/* LIVE row */}
          <div className="tv-player-bar">
            <div className="tv-player-label">
              <span
                className={
                  isPlaying && !error ? "tv-live-dot" : "tv-live-dot tv-live-dot-idle"
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
                className={`tv-btn ${isPlaying ? "tv-btn-primary" : "tv-btn-primary"}`}
                onClick={handleTogglePlay}
              >
                {isPlaying ? "Pause" : "Listen Live"}
              </button>

              {/* ❌ Track History button removed on purpose */}
            </div>
          </div>

          {/* Optional legacy block — not used now */}
          {showHistory && null}
        </div>
      </div>
    </div>
  );
}
