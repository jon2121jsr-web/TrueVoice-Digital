// src/components/NowPlayingPanel.jsx
import { useEffect, useMemo, useState } from "react";
import { fetchNowPlaying } from "../services/api"; // keep your current source

function safeText(v) {
  return (v ?? "").toString().trim();
}

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
    safeText(song?.title) || (loading ? "Loading current track…" : "Live Stream");
  const artist = safeText(song?.artist) || "TrueVoice Digital";
  const album = safeText(song?.album) || "";
  const art = safeText(song?.art) || null;
  const listeners = data?.listeners ?? null;

  // “isLive” can be flaky depending on source; we’ll show streaming UI based on play state
  const liveLabel = useMemo(() => {
    if (error) return "OFF AIR";
    return isPlaying ? "NOW STREAMING" : "READY";
  }, [error, isPlaying]);

  // Keep App informed (LIVE dot / status + NOW PLAYING metadata)
  useEffect(() => {
    if (typeof onStatusChange !== "function") return;

    onStatusChange({
      isLive: !!isPlaying && !error,
      hasError: !!error,
      isLoading: !!loading,
      station: "TrueVoice Digital",
      now_playing: {
        song: {
          title,
          artist,
          album,
          art,
          raw: song || null,
        },
      },
      listeners: listeners ?? null,
    });
  }, [isPlaying, error, loading, onStatusChange, title, artist, album, art, listeners, song]);

  // Make sure the audio element exists and is wired
  useEffect(() => {
    const el = audioRef?.current;
    if (!el) return;

    // Keep preload minimal (mobile-friendly)
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

  const handleTogglePlay = async () => {
    const el = audioRef?.current;
    if (!el) {
      console.warn("audioRef not attached. Add <audio ref={playerRef} /> in App.jsx");
      setError("Audio player not ready. Refresh and try again.");
      return;
    }

    try {
      setError(null);

      // ✅ Always ensure the stream URL is set at click time (most reliable on iOS)
      if (streamUrl && el.src !== streamUrl) {
        el.src = streamUrl;
      }

      // ✅ Force load before play (helps Safari/iOS)
      try {
        el.load();
      } catch {
        // ignore
      }

      if (el.paused) {
        await el.play(); // must be user-initiated (this click is)
      } else {
        el.pause();
      }
    } catch (e) {
      console.error("Audio play/pause failed:", e);
      // Surface a real message to the user
      setError(
        "Playback was blocked. Tap again. If still blocked, open in Safari/Chrome and ensure sound is allowed."
      );
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
          <span className="tv-eyebrow">{error ? "STREAM STATUS" : "NOW PLAYING"}</span>

          <h1 className="tv-song-title">{title}</h1>
          <p className="tv-artist-name">{artist}</p>

          {/* ✅ Make failures visible so it never looks like "nothing happens" */}
          {error && (
            <p style={{ marginTop: 8, color: "#b91c1c", fontWeight: 600 }}>
              {error}
            </p>
          )}

          {/* LIVE row */}
          <div className="tv-player-bar">
            <div className="tv-player-label">
              <span
                className={
                  isPlaying && !error ? "tv-live-dot" : "tv-live-dot tv-live-dot-idle"
                }
                aria-hidden="true"
              />
              <span className="tv-player-title">TRUEVOICE DIGITAL</span>

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
                {isPlaying ? "Pause" : "Listen Live"}
              </button>
            </div>
          </div>

          {showHistory && null}
        </div>
      </div>
    </div>
  );
}
