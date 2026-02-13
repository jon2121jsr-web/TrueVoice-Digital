// src/components/NowPlayingPanel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchNowPlaying } from "../services/api";

function toInt(v, fallback) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function NowPlayingPanel({
  streamUrl,
  audioRef,
  showHistory = false,
  onStatusChange,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // ✅ This is now a true "delay by N seconds" using a local buffer.
  // Start with what you're observing: ~35–45 seconds.
  const METADATA_DELAY_SEC = toInt(
    import.meta.env.VITE_STREAM_METADATA_DELAY_SEC,
    40
  );

  // Buffer of snapshots: [{ tsMs, payload }]
  const samplesRef = useRef([]);
  const [samplesVersion, setSamplesVersion] = useState(0);

  // Safety fallback if Live365 fails temporarily
  const AZURACAST_FALLBACK_URL =
    "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

  /* ----------------------------------------
     Poll AzuraCast Now Playing (source of truth)
  ---------------------------------------- */
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const result = await fetchNowPlaying();
        if (!alive) return;

        const tsMs = Date.now();

        // push snapshot to buffer
        samplesRef.current.push({ tsMs, payload: result || null });

        // keep buffer bounded (e.g., last 10 minutes @ 15s polling ~ 40 samples)
        const MAX_SAMPLES = 80;
        if (samplesRef.current.length > MAX_SAMPLES) {
          samplesRef.current.splice(0, samplesRef.current.length - MAX_SAMPLES);
        }

        setError(null);
        setSamplesVersion((v) => v + 1);
      } catch (err) {
        if (!alive) return;
        console.error("NowPlaying error:", err);
        setError(err?.message || "Failed to load now playing.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    const id = window.setInterval(load, 15_000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  /* ----------------------------------------
     Tick: re-evaluate which buffered snapshot to show
     (so the delay "slides" smoothly between polls)
  ---------------------------------------- */
  useEffect(() => {
    const id = window.setInterval(() => {
      // only tick when we actually have data; cheap
      if (samplesRef.current.length) {
        setSamplesVersion((v) => v + 1);
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  /* ----------------------------------------
     Choose the snapshot from N seconds ago
  ---------------------------------------- */
  const display = useMemo(() => {
    const samples = samplesRef.current;
    if (!samples || samples.length === 0) {
      return {
        song: null,
        listeners: null,
      };
    }

    // Target time = now - delay
    const targetMs = Date.now() - METADATA_DELAY_SEC * 1000;

    // Find the latest sample whose tsMs <= targetMs
    // If none (delay larger than buffer), fall back to oldest
    let chosen = samples[0];
    for (let i = 0; i < samples.length; i++) {
      if (samples[i].tsMs <= targetMs) chosen = samples[i];
      else break;
    }

    const payload = chosen?.payload || null;

    return {
      song: payload?.song || null,
      listeners: payload?.listeners ?? null,
    };
  }, [samplesVersion, METADATA_DELAY_SEC]);

  /* ----------------------------------------
     Derived display values
  ---------------------------------------- */
  const title =
    display.song?.title || (loading ? "Loading current track…" : "Live Stream");
  const artist = display.song?.artist || "TrueVoice Digital";
  const album = display.song?.album || "TrueVoice Digital";
  const art = display.song?.art || null;
  const listeners = display.listeners;

  const liveLabel = useMemo(() => {
    if (error) return "OFF AIR";
    return isPlaying ? "NOW STREAMING" : "READY";
  }, [error, isPlaying]);

  /* ----------------------------------------
     Inform App (lock screen / MediaSession) using the DELAYED song
  ---------------------------------------- */
  useEffect(() => {
    if (typeof onStatusChange === "function") {
      onStatusChange({
        isLive: !!isPlaying && !error,
        hasError: !!error,
        isLoading: !!loading,
        station: "TrueVoice Radio",
        now_playing: {
          song: { title, artist, album, art },
        },
        listeners: listeners ?? undefined,
      });
    }
  }, [isPlaying, error, loading, onStatusChange, title, artist, album, art, listeners]);

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
     iPhone "double tap" fix:
     - Call play() synchronously (no await)
     - Use onPointerUp so iOS treats it as a direct gesture
  ---------------------------------------- */
  const startStream = (el, url) => {
    el.src = url;
    el.load();
    const p = el.play(); // don't await
    if (p && typeof p.catch === "function") {
      p.catch((e) => {
        console.error("play() failed:", e);
        setError("Tap again to start audio.");
        setIsPlaying(false);
      });
    }
  };

  const handleTogglePlay = () => {
    const el = audioRef?.current;
    if (!el) return;

    try {
      if (!isPlaying) {
        setError(null);

        // Primary
        startStream(el, streamUrl);

        // quick fallback if primary doesn't start
        window.setTimeout(() => {
          try {
            if (el.paused) startStream(el, AZURACAST_FALLBACK_URL);
          } catch {
            // ignore
          }
        }, 600);

        setIsPlaying(true);
      } else {
        el.pause();
        el.removeAttribute("src");
        el.load();
        setIsPlaying(false);
      }
    } catch (err) {
      console.error("Live stream toggle failed:", err);
      setError("Tap again to start audio.");
      setIsPlaying(false);
    }
  };

  return (
    <div className="tv-now-playing">
      <div className="tv-now-inner">
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
                onPointerUp={handleTogglePlay}
                onClick={(e) => e.preventDefault()}
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
