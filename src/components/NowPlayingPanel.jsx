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

// Tiny silent WAV (very short). Used only to “unlock” iOS audio on first gesture.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function NowPlayingPanel({ streamUrl, audioRef, showHistory = false, onStatusChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [playState, setPlayState] = useState("idle"); // idle | starting | playing | stopping
  const isIOSRef = useRef(false);
  const primedRef = useRef(false);

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
      now_playing: {
        song: { title, artist, album, art, raw: song || null },
      },
      listeners: listeners ?? null,
    });
  }, [isPlaying, error, loading, onStatusChange, title, artist, album, art, listeners, song]);

  // Wire audio element events + iOS flags
  useEffect(() => {
    const el = audioRef?.current;
    if (!el) return;

    isIOSRef.current = detectIOS();

    try {
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.playsInline = true;
    } catch {
      // ignore
    }

    el.preload = "none";

    // Keep src set
    if (streamUrl && (!el.src || el.src !== streamUrl)) {
      el.src = streamUrl;
    }

    const onPlaying = () => setPlayState("playing");
    const onPlay = () => setPlayState("playing");
    const onPause = () => setPlayState("idle");
    const onEnded = () => setPlayState("idle");
    const onErr = () => setPlayState("idle");

    el.addEventListener("playing", onPlaying);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onErr);

    return () => {
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onErr);
    };
  }, [audioRef, streamUrl]);

  // ✅ iOS priming: unlock audio on first user gesture
  const primeIOSAudioOnce = async () => {
    if (!isIOSRef.current) return;
    if (primedRef.current) return;

    try {
      // Use a separate tiny silent audio element just to unlock the gesture pipeline
      const a = new Audio(SILENT_WAV);
      a.volume = 0;
      a.muted = true;
      a.playsInline = true;

      await a.play();
      a.pause();
      primedRef.current = true;
    } catch (e) {
      // Even if this fails, we still try to play the stream.
      console.warn("iOS audio prime failed (will still attempt stream play):", e);
    }
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
    if (playState === "starting" || playState === "stopping") return;

    setError(null);
    setPlayState("starting");

    try {
      // ✅ Prime first so the same tap counts on iPhone
      await primeIOSAudioOnce();

      if (!el.src || el.src !== streamUrl) el.src = streamUrl;

      try {
        el.muted = false;
        el.volume = 1;
      } catch {
        // ignore
      }

      // Avoid load() right before play on iOS
      if (!isIOSRef.current) {
        try {
          el.load();
        } catch {
          // ignore
        }
      }

      await el.play();
      // events flip playState -> playing
    } catch (e) {
      console.error("play() failed:", e);
      setPlayState("idle");
      setError("Playback was blocked. Tap Listen Live again.");
    }
  };

  const stopPlayback = async () => {
    const el = audioRef?.current;
    if (!el) return;
    if (playState === "starting" || playState === "stopping") return;

    setError(null);
    setPlayState("stopping");

    try {
      el.pause();
    } catch (e) {
      console.error("pause() failed:", e);
    } finally {
      setPlayState("idle");
    }
  };

  const handleToggle = async () => {
    if (playState === "playing") {
      await stopPlayback();
    } else {
      await startPlayback();
    }
  };

  const buttonDisabled = playState === "starting" || playState === "stopping";

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
              <span className="tv-player-subtitle">{buttonDisabled ? "WORKING…" : liveLabel}</span>

              {listeners != null && !Number.isNaN(listeners) && (
                <span className="tv-listeners">{listeners} listening</span>
              )}
            </div>

            <div className="tv-player-controls">
              <button
                type="button"
                className="tv-btn tv-btn-primary"
                onClick={handleToggle}
                disabled={buttonDisabled}
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
