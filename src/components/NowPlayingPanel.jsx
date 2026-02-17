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
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const METADATA_DELAY_SEC = toInt(
    import.meta.env.VITE_STREAM_METADATA_DELAY_SEC,
    40
  );

  // Buffer of snapshots: [{ tsMs, payload }]
  const samplesRef = useRef([]);
  const [samplesVersion, setSamplesVersion] = useState(0);

  const AZURACAST_FALLBACK_URL =
    "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

  /* ─── Poll AzuraCast Now Playing ──────────────────────────────────────── */
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const result = await fetchNowPlaying();
        if (!alive) return;

        const tsMs = Date.now();
        samplesRef.current.push({ tsMs, payload: result || null });

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
  }, []); // no deps — intentionally runs once on mount

  /* ─── 1-second tick to slide the delay window smoothly ───────────────── */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (samplesRef.current.length) {
        setSamplesVersion((v) => v + 1);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []); // no deps — intentionally runs once on mount

  /* ─── Choose the snapshot from N seconds ago ──────────────────────────── */
  const display = useMemo(() => {
    const samples = samplesRef.current;
    if (!samples || samples.length === 0) {
      return { song: null, listeners: null };
    }

    const targetMs = Date.now() - METADATA_DELAY_SEC * 1000;

    let chosen = samples[0];
    for (let i = 0; i < samples.length; i++) {
      if (samples[i].tsMs <= targetMs) chosen = samples[i];
      else break;
    }

    const payload = chosen?.payload || null;
    return {
      song:      payload?.song      || null,
      listeners: payload?.listeners ?? null,
    };
  }, [samplesVersion, METADATA_DELAY_SEC]);

  /* ─── Derived display values ──────────────────────────────────────────── */
  const title     = display.song?.title  || (loading ? "Loading current track…" : "Live Stream");
  const artist    = display.song?.artist || "TrueVoice Digital";
  const album     = display.song?.album  || "TrueVoice Digital";
  const art       = display.song?.art    || null;
  const listeners = display.listeners;

  const liveLabel = useMemo(() => {
    if (error) return "OFF AIR";
    return isPlaying ? "NOW STREAMING" : "READY";
  }, [error, isPlaying]);

  /* ─── Notify App of status changes ───────────────────────────────────────
     FIX: onStatusChange is no longer in the dependency array.
     
     Root cause of the infinite loop:
       1. App rendered and passed a new inline arrow to onStatusChange.
       2. This effect fired because onStatusChange was a dep and changed.
       3. The effect called onStatusChange → setNowPlaying in App.
       4. App re-rendered → new arrow → new reference → effect fired again.
       5. Repeat forever (55+ times per second per the console).
     
     The two-part fix:
       • App.jsx wraps handleStatusChange in useCallback([]) so it has a
         permanently stable reference across renders.
       • Here we remove onStatusChange from the dep array and read it via
         a ref instead (onStatusChangeRef). This means the effect only
         re-fires when the actual data changes (title, artist, etc.),
         not when the parent re-renders and coincidentally passes the
         "same" function with a new reference.
  ──────────────────────────────────────────────────────────────────────── */
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  });

  useEffect(() => {
    if (typeof onStatusChangeRef.current !== "function") return;
    onStatusChangeRef.current({
      isLive:    !!isPlaying && !error,
      hasError:  !!error,
      isLoading: !!loading,
      station:   "TrueVoice Radio",
      now_playing: {
        song: { title, artist, album, art },
      },
      listeners: listeners ?? undefined,
    });
  }, [isPlaying, error, loading, title, artist, album, art, listeners]);
  // onStatusChange intentionally omitted — accessed via ref above

  /* ─── Wire audio element events ───────────────────────────────────────── */
  useEffect(() => {
    const el = audioRef?.current;
    if (!el) return;

    el.preload = "none";

    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    el.addEventListener("play",  onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("play",  onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [audioRef]);

  /* ─── Stream control ──────────────────────────────────────────────────── */
  const startStream = (el, url) => {
    el.src = url;
    el.load();
    const p = el.play();
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
        startStream(el, streamUrl);

        window.setTimeout(() => {
          try {
            if (el.paused) startStream(el, AZURACAST_FALLBACK_URL);
          } catch { /* ignore */ }
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

  /* ─── Render ──────────────────────────────────────────────────────────── */
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