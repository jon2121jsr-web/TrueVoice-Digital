// src/components/NowPlayingPanel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchNowPlaying } from "../services/api";

function safeText(v) {
  return (v ?? "").toString().trim();
}

function detectIOS() {
  const ua = navigator.userAgent || "";
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function isStandalonePWA() {
  // iOS Safari exposes navigator.standalone; other browsers may use display-mode
  const nav = window.navigator;
  const iOSStandalone = typeof nav.standalone === "boolean" && nav.standalone;
  const displayModeStandalone =
    window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  return iOSStandalone || displayModeStandalone;
}

export function NowPlayingPanel({ streamUrl, audioRef, showHistory = false, onStatusChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // idle | starting | playing
  const [playState, setPlayState] = useState("idle");

  const iosRef = useRef(false);
  const pwaRef = useRef(false);

  // Track the current start attempt so we can cancel/reset cleanly
  const startTokenRef = useRef(0);

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
  const title = safeText(song?.title) || (loading ? "Loading current track…" : "Live Stream");
  const artist = safeText(song?.artist) || "TrueVoice Digital";
  const album = safeText(song?.album) || "";
  const art = safeText(song?.art) || null;
  const listeners = data?.listeners ?? null;

  const isPlaying = playState === "playing";

  const liveLabel = useMemo(() => {
    if (error) return "OFF AIR";
    return isPlaying ? "NOW STREAMING" : "READY";
  }, [error, isPlaying]);

  // Keep App informed (LIVE dot / status + NOW PLAYING metadata)
  useEffect(() => {
    if (typeof onStatusChange !== "function") return;

    onStatusChange({
      isLive: isPlaying && !error,
      hasError: !!error,
      isLoading: !!loading,
      station: "TrueVoice Digital",
      now_playing: { song: { title, artist, album, art, raw: song || null } },
      listeners: listeners ?? null,
    });
  }, [isPlaying, error, loading, onStatusChange, title, artist, album, art, listeners, song]);

  // Wire audio element
  useEffect(() => {
    const el = audioRef?.current;
    if (!el) return;

    iosRef.current = detectIOS();
    pwaRef.current = isStandalonePWA();

    // iOS inline playback flags
    try {
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.playsInline = true;
    } catch {
      // ignore
    }

    el.preload = "none";

    // Keep state synced to real events
    const onPlaying = () => setPlayState("playing");
    const onPause = () => setPlayState("idle");
    const onEnded = () => setPlayState("idle");

    el.addEventListener("playing", onPlaying);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [audioRef]);

  const hardReset = () => {
    const el = audioRef?.current;
    if (!el) return;
    try {
      el.pause();
    } catch {
      // ignore
    }
    // In PWA/iOS we do NOT clear src permanently, but we do reset playback state
    setPlayState("idle");
  };

  const makeFreshStreamUrl = () => {
    if (!streamUrl) return "";
    const sep = streamUrl.includes("?") ? "&" : "?";
    return `${streamUrl}${sep}v=${Date.now()}`;
  };

  const startPlayback = async () => {
    const el = audioRef?.current;
    if (!el) {
      setError("Audio player not ready. Refresh and try again.");
      return;
    }
    if (!streamUrl) {
      setError("Stream URL not configured.");
      return;
    }

    // If we’re already starting and you tap again, treat it as reset (prevents “stuck on WORKING”)
    if (playState === "starting") {
      startTokenRef.current += 1; // invalidate current attempt
      hardReset();
      return;
    }

    setError(null);
    setPlayState("starting");

    const myToken = ++startTokenRef.current;

    try {
      // ✅ iPhone PWA reliability: always use a fresh URL to avoid “dead connection”
      const urlToPlay = iosRef.current && pwaRef.current ? makeFreshStreamUrl() : streamUrl;

      // Ensure src
      if (!el.src || el.src !== urlToPlay) el.src = urlToPlay;

      // Ensure audible
      try {
        el.muted = false;
        el.volume = 1;
      } catch {
        // ignore
      }

      // For live streams, load() can help outside iOS PWA
      if (!(iosRef.current && pwaRef.current)) {
        try {
          el.load();
        } catch {
          // ignore
        }
      }

      // Start playing
      const playPromise = el.play();

      // Timeout if iOS never transitions to "playing" (common in PWA when blocked)
      const timeoutMs = 2500;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("PLAY_TIMEOUT")), timeoutMs)
      );

      await Promise.race([playPromise, timeoutPromise]);

      // If another attempt started, stop this one
      if (startTokenRef.current !== myToken) {
        try {
          el.pause();
        } catch {
          // ignore
        }
        setPlayState("idle");
        return;
      }

      // If it actually plays, "playing" event will flip state to playing.
      // If it doesn’t, we’ll still guard after a short delay:
      setTimeout(() => {
        if (startTokenRef.current !== myToken) return;
        if (audioRef?.current?.paused) {
          setPlayState("idle");
          setError("Tap Listen Live once more to enable audio in iPhone Home Screen mode.");
        }
      }, 300);
    } catch (e) {
      console.error("play() failed:", e);
      setPlayState("idle");

      // Don’t show scary red text for a normal iPhone PWA restriction — be explicit.
      if (String(e?.message || "").includes("PLAY_TIMEOUT")) {
        setError("iPhone blocked audio start. Tap Listen Live once more.");
      } else {
        setError("Playback was blocked. Tap Listen Live again.");
      }
    }
  };

  const stopPlayback = () => {
    const el = audioRef?.current;
    if (!el) return;

    setError(null);
    startTokenRef.current += 1; // cancel any pending start attempt

    try {
      el.pause();
    } catch (e) {
      console.error("pause() failed:", e);
    } finally {
      setPlayState("idle");
    }
  };

  const handleToggle = async () => {
    if (isPlaying) stopPlayback();
    else await startPlayback();
  };

  const buttonLabel = isPlaying ? "Pause" : "Listen Live";
  const subtitle = playState === "starting" ? "WORKING…" : liveLabel;

  return (
    <div className="tv-now-playing">
      <div className="tv-now-inner">
        <div className="tv-artwork-placeholder">
          {art && (
            <img src={art} alt={`${title} cover art`} className="tv-artwork-img" loading="lazy" />
          )}
        </div>

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
                className={isPlaying && !error ? "tv-live-dot" : "tv-live-dot tv-live-dot-idle"}
                aria-hidden="true"
              />
              <span className="tv-player-title">TRUEVOICE DIGITAL</span>
              <span className="tv-player-subtitle">{subtitle}</span>

              {listeners != null && !Number.isNaN(listeners) && (
                <span className="tv-listeners">{listeners} listening</span>
              )}
            </div>

            <div className="tv-player-controls">
              <button type="button" className="tv-btn tv-btn-primary" onClick={handleToggle}>
                {buttonLabel}
              </button>
            </div>
          </div>

          {showHistory && null}
        </div>
      </div>
    </div>
  );
}
