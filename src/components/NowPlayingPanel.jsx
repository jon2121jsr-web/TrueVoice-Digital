// src/components/NowPlayingPanel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
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

  // Prevent play/pause race conditions (multiple rapid taps)
  const actionIdRef = useRef(0);

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

  // Wire audio element events
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

  // Hard-stop helper (kills the stream so it can’t “ghost resume”)
  const hardStop = (el) => {
    try {
      el.pause();
    } catch {
      // ignore
    }

    // ✅ Clearing src + load() forces the stream connection to close
    try {
      el.removeAttribute("src");
      el.load();
    } catch {
      // ignore
    }
  };

  const handleTogglePlay = async () => {
    const el = audioRef?.current;
    if (!el) {
      console.warn(
        "audioRef not attached. Add <audio ref={playerRef} /> in App.jsx"
      );
      setError("Audio player not ready. Refresh and try again.");
      return;
    }

    // Every click invalidates prior async play() calls
    const myActionId = ++actionIdRef.current;

    try {
      setError(null);

      // Determine “intend to play” based on actual paused state
      const wantPlay = el.paused;

      if (!wantPlay) {
        // ✅ HARD STOP (prevents queued play() promises from bringing audio back)
        hardStop(el);
        return;
      }

      // PLAY path (re-attach src each time, because pause clears it)
      if (!streamUrl) {
        setError("Stream URL not configured.");
        return;
      }

      // Always set src fresh for reliability
      if (el.src !== streamUrl) {
        el.src = streamUrl;
      }

      // Helps Safari/iOS in some cases
      try {
        el.load();
      } catch {
        // ignore
      }

      // Attempt play (user-initiated)
      await el.play();

      // If another click happened while play() was awaiting, stop immediately
      if (actionIdRef.current !== myActionId) {
        hardStop(el);
      }
    } catch (e) {
      console.error("Audio play/pause failed:", e);
      setError(
        "Playback was blocked. Tap again. If it persists, open in Safari/Chrome and allow audio."
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
