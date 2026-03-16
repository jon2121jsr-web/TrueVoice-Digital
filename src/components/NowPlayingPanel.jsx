// src/components/NowPlayingPanel.jsx
// ✅ Three states: radio | live placeholder | YouTube Live
// ✅ Live panel fills full card width (no padding bleed)
// ✅ Floating player always shows compact radio mode regardless of live state
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchNowPlaying } from "../services/api";
import { LIVE_CONFIG } from "../data/liveConfig";
import "./NowPlayingPanel.css";

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function useIsOwner() {
  return useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("owner") === "true";
    } catch { return false; }
  }, []);
}

export function NowPlayingPanel({
  streamUrl,
  audioRef,
  showHistory = false,
  onStatusChange,
  isFloating = false,   // passed from App.jsx so we can collapse to radio when floating
}) {
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [listeners, setListeners] = useState(null);
  const [isMuted,   setIsMuted]   = useState(false);

  const isOwner = useIsOwner();

  const isLive        = !!LIVE_CONFIG.isLive;
  const videoId       = (LIVE_CONFIG.videoId || "").trim();
  const showLivePanel = isLive && !isFloating; // collapse to radio when floating
  const showVideo     = showLivePanel && videoId.length > 0;
  const showPlaceholder = showLivePanel && !showVideo;

  const STREAM_DELAY_SEC    = toNum(import.meta.env.VITE_STREAM_DELAY_SEC, 65);
  const AZURACAST_FALLBACK  = "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

  const [displaySong,  setDisplaySong]  = useState(null);
  const [pendingSong,  setPendingSong]  = useState(null);
  const pendingFlipRef  = useRef(null);
  const displaySongRef  = useRef(null);

  /* ── Poll AzuraCast ────────────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const result = await fetchNowPlaying();
        if (!alive) return;

        const song = result?.now_playing?.song || null;

        const rawL = result?.listeners;
        if (rawL != null) {
          const c = typeof rawL === "object"
            ? (rawL.current ?? rawL.total ?? 0)
            : Number(rawL);
          setListeners(Number.isFinite(c) ? c : null);
        }

        if (!song?.title) { if (alive) setLoading(false); return; }

        const incomingId = song.id || song.title;
        const currentId  = displaySongRef.current?.id || displaySongRef.current?.title;
        const pendingId  = pendingSong?.song?.id       || pendingSong?.song?.title;

        if (!displaySongRef.current) {
          displaySongRef.current = song;
          setDisplaySong(song);
        } else if (incomingId !== currentId && incomingId !== pendingId) {
          setPendingSong({ song });
          pendingFlipRef.current = Date.now() + (STREAM_DELAY_SEC * 1000);
        }

        setError(null);
        setLoading(false);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Failed to load now playing.");
        setLoading(false);
      }
    }

    load();
    const id = window.setInterval(load, 15_000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  /* ── 1-second tick — flip pending song ────────────────────────────────── */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pendingSong || !pendingFlipRef.current) return;
      if (Date.now() >= pendingFlipRef.current) {
        displaySongRef.current = pendingSong.song;
        setDisplaySong(pendingSong.song);
        setPendingSong(null);
        pendingFlipRef.current = null;
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, [pendingSong]);

  /* ── Derived display values ────────────────────────────────────────────── */
  const title  = displaySong?.title  || (loading ? "Loading…" : "Live Stream");
  const artist = displaySong?.artist || "TrueVoice Digital";
  const album  = displaySong?.album  || "TrueVoice Digital";
  const art    = displaySong?.art    || null;

  const liveLabel = useMemo(() => {
    if (error) return "OFF AIR";
    return isPlaying ? "NOW STREAMING" : "READY";
  }, [error, isPlaying]);

  /* ── Notify app (MediaSession) ─────────────────────────────────────────── */
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; });

  useEffect(() => {
    if (typeof onStatusChangeRef.current !== "function") return;
    onStatusChangeRef.current({
      isLive:    !!isPlaying && !error,
      hasError:  !!error,
      isLoading: !!loading,
      station:   "TrueVoice Radio",
      now_playing: { song: { title, artist, album, art } },
      listeners: listeners ?? undefined,
    });
  }, [isPlaying, error, loading, title, artist, album, art, listeners]);

  /* ── Audio element events ──────────────────────────────────────────────── */
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

  /* ── Mute toggle ───────────────────────────────────────────────────────── */
  const handleMuteToggle = () => {
    const el = audioRef?.current;
    if (!el) return;
    el.muted = !el.muted;
    setIsMuted(el.muted);
  };

  /* ── Stream control ────────────────────────────────────────────────────── */
  const startStream = (el, url) => {
    el.src = url;
    el.load();
    const p = el.play();
    if (p?.catch) p.catch(() => {
      setError("Tap again to start audio.");
      setIsPlaying(false);
    });
  };

  const handleTogglePlay = () => {
    const el = audioRef?.current;
    if (!el) return;
    try {
      if (!isPlaying) {
        setError(null);
        startStream(el, streamUrl);
        window.setTimeout(() => {
          try { if (el.paused) startStream(el, AZURACAST_FALLBACK); }
          catch { /* ignore */ }
        }, 600);
        setIsPlaying(true);
      } else {
        el.pause();
        el.removeAttribute("src");
        el.load();
        setIsPlaying(false);
      }
    } catch {
      setError("Tap again to start audio.");
      setIsPlaying(false);
    }
  };

  /* ── RENDER: Radio mode (default + floating) ───────────────────────────── */
  if (!showLivePanel) {
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
                  className={isPlaying && !error ? "tv-live-dot" : "tv-live-dot tv-live-dot-idle"}
                  aria-hidden="true"
                />
                <span className="tv-player-title">TRUEVOICE RADIO</span>
                <span className="tv-player-subtitle">{liveLabel}</span>
                {isOwner && listeners != null && !Number.isNaN(listeners) && (
                  <span className="tv-listeners" title="Live listeners (owner view)">
                    {listeners} listening
                  </span>
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
          </div>
        </div>
      </div>
    );
  }

  /* ── RENDER: Live panel (placeholder or active video) ──────────────────── */
  // .tv-now-playing--live removes padding so the dark video block
  // fills edge-to-edge inside the card.
  return (
    <div className="tv-now-playing tv-now-playing--live">
      <div className="tv-live-panel">

        {/* Video / placeholder block */}
        <div className="tv-live-video-block">
          {showPlaceholder ? (
            <div className="tv-live-placeholder">
              <h2 className="tv-live-placeholder-title">
                TrueVoice <span>LIVE</span>
              </h2>
              <p className="tv-live-placeholder-sub">
                Where Truth and Faith Come Together
              </p>
              <div className="tv-live-placeholder-pill">
                Live programming coming soon
              </div>
              <p className="tv-live-placeholder-music">♪ Music streaming now</p>
            </div>
          ) : (
            <>
              <iframe
                className="tv-live-iframe"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1`}
                title="TrueVoice Live"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <div className="tv-live-badge">
                <span className="tv-live-badge-dot" />
                LIVE NOW
              </div>
            </>
          )}
        </div>

        {/* Radio strip — always visible below video/placeholder */}
        <div className="tv-live-radio-strip">
          <div className="tv-live-radio-info">
            <span className="tv-live-radio-label">
              {isPlaying ? "Now playing on radio" : "TrueVoice Radio"}
            </span>
            <span className="tv-live-radio-song">{title}</span>
            <span className="tv-live-radio-artist">{artist}</span>
          </div>

          <div className="tv-live-radio-controls">
            {!showPlaceholder && (
              <button
                type="button"
                className={`tv-live-mute-btn${isMuted ? " is-muted" : ""}`}
                onClick={handleMuteToggle}
              >
                {isMuted ? "Unmute radio" : "Mute radio"}
              </button>
            )}
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

      </div>
    </div>
  );
}