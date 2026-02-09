// src/components/NowPlayingPanel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchNowPlaying } from "../services/api"; // keep your current source

function safeText(v) {
  return (v ?? "").toString().trim();
}

function isIOS() {
  // Covers iPhone/iPad + iPadOS “MacIntel” touch
  const ua = navigator.userAgent || "";
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

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

  // Prevent race conditions / queued play promises
  const actionIdRef = useRef(0);
  const busyRef = useRef(false);
  const iOSRef = useRef(false);

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
  }, [
    isPlaying,
    error,
    loading,
    onStatusChange,
    title,
    artist,
    album,
    art,
    listeners,
    song,
  ]);

  // Wire audio element: playsinline + events
  useEffect(() => {
    const el = audioRef?.current;
    if (!el) return;

    iOSRef.current = isIOS();

    // iOS needs inline flags or it acts weird
    try {
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      // property is also helpful
      el.playsInline = true;
    } catch {
      // ignore
    }

    el.preload = "none";

    // Important: set src ONCE early (prevents iOS “first tap blocked” patterns)
    if (streamUrl && !el.src) {
      el.src = streamUrl;
    } else if (streamUrl && el.src !== streamUrl) {
      el.src = streamUrl;
    }

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
  }, [audioRef, streamUrl]);

  // Desktop/Android hard stop helper
  const hardStopNonIOS = (el) => {
    try {
      el.pause();
    } catch {
      // ignore
    }
    // Clearing src kills the network stream. Great for desktop, but can cause iOS “blocked” next play.
    try {
      el.removeAttribute("src");
      el.load();
    } catch {
      // ignore
    }
    // restore src so next play is a normal resume path (still user initiated)
    try {
      if (streamUrl) el.src = streamUrl;
    } catch {
      // ignore
    }
  };

  const handleTogglePlay = async () => {
    const el = audioRef?.current;
    if (!el) {
      setError("Audio player not ready. Refresh and try again.");
      return;
    }

    // Block spamming taps (this is a huge part of your issue)
    if (busyRef.current) return;

    busyRef.current = true;
    const myActionId = ++actionIdRef.current;

    try {
      setError(null);

      const wantPlay = el.paused;

      if (!wantPlay) {
        // PAUSE / STOP
        if (iOSRef.current) {
          // ✅ iOS: SOFT STOP ONLY (avoids “Playback was blocked” on next play)
          try {
            el.pause();
          } catch {
            // ignore
          }
        } else {
          // ✅ Non-iOS: HARD STOP to prevent ghost-resume
          hardStopNonIOS(el);
        }
        return;
      }

      // PLAY
      if (!streamUrl) {
        setError("Stream URL not configured.");
        return;
      }

      // Ensure src is correct (don’t churn it every time)
      if (!el.src || el.src !== streamUrl) {
        el.src = streamUrl;
      }

      // Don’t call load() on iOS right before play (often increases NotAllowed errors)
      if (!iOSRef.current) {
        try {
          el.load();
        } catch {
          // ignore
        }
      }

      // Must be user initiated — this click is
      await el.play();

      // If another click happened while play() awaited, stop immediately
      if (actionIdRef.current !== myActionId) {
        try {
          el.pause();
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error("Audio play/pause failed:", e);

      // On iOS, the most common failure is NotAllowedError on the first attempt.
      // The key is: don’t clear src and don’t churn load(). We already fixed that.
      setError(
        "Playback was blocked. If you're in Low Power Mode or Silent Mode, try turning it off and tap Listen Live again."
      );
    } finally {
      // Small delay prevents double-tap from queuing a second play immediately
      window.setTimeout(() => {
        busyRef.current = false;
      }, 250);
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
            <p style={{ marginTop: 8, color: "#b91c1c", fontWeight: 700 }}>
              {error}
            </p>
          )}

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
