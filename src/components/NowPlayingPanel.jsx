// src/components/NowPlayingPanel.jsx
// ✅ Three states: radio | live placeholder | YouTube Live
// ✅ Song metadata updates correctly without page refresh
// ✅ All pending song tracking via refs — no stale closure bug
// ✅ Floating player always shows compact radio mode
// ✅ Audio glitch fix: fallback via error event, not setTimeout; no redundant el.load()
// ✅ Lock screen Play fix: pause keeps src intact so MediaSession can resume
// ✅ Fast start: src pre-warmed on mount so buffer is ready when user hits play
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
  isFloating = false,
}) {
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [listeners,    setListeners]    = useState(null);
  const [isMuted,      setIsMuted]      = useState(false);
  const [displaySong,  setDisplaySong]  = useState(null);

  const isOwner = useIsOwner();

  const isLive          = !!LIVE_CONFIG.isLive;
  const videoId         = (LIVE_CONFIG.videoId || "").trim();
  const showLivePanel   = isLive && !isFloating;
  const showVideo       = showLivePanel && videoId.length > 0;
  const showPlaceholder = showLivePanel && !showVideo;

  const STREAM_DELAY_SEC   = toNum(import.meta.env.VITE_STREAM_DELAY_SEC, 65);
  const AZURACAST_FALLBACK = "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

  // ── All mutable tracking in refs so polling closure never goes stale ──────
  const displaySongRef  = useRef(null);
  const pendingSongRef  = useRef(null);
  const pendingFlipRef  = useRef(null);
  const isPlayingRef    = useRef(false);
  const streamUrlRef    = useRef(streamUrl);
  useEffect(() => { streamUrlRef.current = streamUrl; }, [streamUrl]);

  /* ── Pre-warm stream connection on mount ───────────────────────────────── */
  // Sets src early so the browser opens the connection and begins buffering
  // before the user hits play — dramatically reduces cold-start delay.
  // preload="metadata" fetches just enough to establish the connection
  // without downloading significant audio data.
  useEffect(() => {
    const el = audioRef?.current;
    if (!el || el.src) return;
    el.preload = "metadata";
    el.src = streamUrl;
    // Do NOT call el.load() or el.play() here — just set src
  }, [audioRef, streamUrl]);

  /* ── Poll AzuraCast every 15 seconds ──────────────────────────────────── */
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

        const incomingId = song.id    || song.title;
        const currentId  = displaySongRef.current?.id    || displaySongRef.current?.title;
        const pendingId  = pendingSongRef.current?.song?.id || pendingSongRef.current?.song?.title;

        if (!displaySongRef.current) {
          displaySongRef.current = song;
          setDisplaySong(song);
        } else if (incomingId !== currentId && incomingId !== pendingId) {
          pendingSongRef.current  = { song };
          pendingFlipRef.current  = Date.now() + (STREAM_DELAY_SEC * 1000);
        } else if (incomingId === currentId) {
          if (pendingId && pendingId !== incomingId) {
            // keep — different song is legitimately queued
          }
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

  /* ── 1-second tick — flip pending song when delay expires ─────────────── */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pendingSongRef.current || !pendingFlipRef.current) return;
      if (Date.now() >= pendingFlipRef.current) {
        const next = pendingSongRef.current.song;
        displaySongRef.current = next;
        pendingSongRef.current = null;
        pendingFlipRef.current = null;
        setDisplaySong(next);
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, []);

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

    const onPlay  = () => { setIsPlaying(true);  isPlayingRef.current = true; };
    const onPause = () => { setIsPlaying(false); isPlayingRef.current = false; };
    const onEnded = () => { setIsPlaying(false); isPlayingRef.current = false; };

    const onError = () => {
      if (!isPlayingRef.current) return;
      const fallback = AZURACAST_FALLBACK;
      if (el.src.includes(fallback)) {
        setError("Stream unavailable. Tap to retry.");
        setIsPlaying(false);
        isPlayingRef.current = false;
        return;
      }
      el.src = fallback;
      el.load();
      el.play().catch(() => {
        setError("Stream unavailable. Tap to retry.");
        setIsPlaying(false);
        isPlayingRef.current = false;
      });
    };

    el.addEventListener("play",  onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("play",  onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
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
  const handleTogglePlay = () => {
    const el = audioRef?.current;
    if (!el) return;
    try {
      if (!isPlaying) {
        setError(null);
        // If src was cleared or changed, reset it
        if (!el.src || !el.src.includes("live365") && !el.src.includes("truevoice")) {
          el.src = streamUrlRef.current;
          el.load();
        }
        const p = el.play();
        if (p?.catch) p.catch(() => {
          setError("Tap again to start audio.");
          setIsPlaying(false);
        });
        setIsPlaying(true);
      } else {
        // Pause only — keep src intact so lock screen Play can resume
        el.pause();
        setIsPlaying(false);
      }
    } catch {
      setError("Tap again to start audio.");
      setIsPlaying(false);
    }
  };

  /* ── RENDER: Radio mode ────────────────────────────────────────────────── */
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

  /* ── RENDER: Live panel ────────────────────────────────────────────────── */
  return (
    <div className="tv-now-playing tv-now-playing--live">
      <div className="tv-live-panel">

        <div className="tv-live-video-block">
          {showPlaceholder ? (
            <div className="tv-live-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
              {art ? (
                <img
                  src={art}
                  alt={title}
                  style={{
                    height: '100%',
                    width: 'auto',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto'
                  }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#000' }} />
              )}
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
