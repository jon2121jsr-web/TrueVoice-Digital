// src/components/NowPlayingPanel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchNowPlaying } from "../services/api";
import { trackStreamPlay } from '../lib/analytics.js';
import { getActiveShow } from "../showSchedule.js";
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

function Waveform() {
  return (
    <span className="tv-waveform" aria-hidden="true">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className="tv-wave-bar" style={{ "--i": i }} />
      ))}
    </span>
  );
}

export function NowPlayingPanel({
  streamUrl,
  audioRef,
  showHistory = false,
  onStatusChange,
  isFloating = false,
}) {
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [listeners,   setListeners]   = useState(null);
  const [displaySong, setDisplaySong] = useState(null);
  const [activeShow,  setActiveShow]  = useState(() => getActiveShow());

  const isOwner = useIsOwner();

  const STREAM_DELAY_SEC   = toNum(import.meta.env.VITE_STREAM_DELAY_SEC, 65);
  const AZURACAST_FALLBACK = "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

  // ── All mutable tracking in refs so polling closure never goes stale ──────
  const displaySongRef = useRef(null);
  const pendingSongRef = useRef(null);
  const pendingFlipRef = useRef(null);
  const isPlayingRef   = useRef(false);
  const streamUrlRef   = useRef(streamUrl);
  useEffect(() => { streamUrlRef.current = streamUrl; }, [streamUrl]);

  /* ── Pre-warm stream connection on mount ───────────────────────────────── */
  // Sets src early so the browser opens the connection and begins buffering
  // before the user hits play — dramatically reduces cold-start delay.
  useEffect(() => {
    const el = audioRef?.current;
    if (!el || el.src) return;
    el.preload = "metadata";
    el.src = streamUrl;
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

  /* ── Update activeShow every 60 seconds ───────────────────────────────── */
  useEffect(() => {
    const id = window.setInterval(() => setActiveShow(getActiveShow()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  /* ── Derived display values ────────────────────────────────────────────── */
  const title  = displaySong?.title  || (loading ? "Loading…" : "Live Stream");
  const artist = displaySong?.artist || "TrueVoice Digital";
  const album  = displaySong?.album  || "TrueVoice Digital";
  const art    = displaySong?.art    || null;

  // Strip visible only when a show is live AND a song is playing between drops
  const showNowPlayingStrip = !!(
    activeShow &&
    displaySong?.title &&
    displaySong.title !== activeShow.name
  );

  /* ── Notify app (MediaSession) ─────────────────────────────────────────── */
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; });

  useEffect(() => {
    if (typeof onStatusChangeRef.current !== "function") return;
    onStatusChangeRef.current({
      isLive:      !!isPlaying && !error,
      hasError:    !!error,
      isLoading:   !!loading,
      station:     "TrueVoice Radio",
      now_playing: { song: { title, artist, album, art } },
      listeners:   listeners ?? undefined,
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

  /* ── Stream control ────────────────────────────────────────────────────── */
  const handleTogglePlay = () => {
    const el = audioRef?.current;
    if (!el) return;
    try {
      if (!isPlaying) {
        setError(null);
        // Always reload the live stream src before playing to snap to
        // the live edge — prevents the stale-buffer glitch after pause.
        const currentSrc = el.src;
        if (!currentSrc || (!currentSrc.includes("live365") && !currentSrc.includes("truevoice"))) {
          el.src = streamUrlRef.current;
        }
        el.load();
        const p = el.play();
        trackStreamPlay(displaySong?.title ?? 'TrueVoice Radio');
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

  /* ── RENDER: Floating compact ──────────────────────────────────────────── */
  if (isFloating) {
    return (
      <div className="tv-now-playing tv-radio-card tv-radio-card--float">
        {/* Album art thumbnail */}
        <div className="tv-float-art">
          {art ? (
            <img src={art} alt={title} className="tv-float-art-img" />
          ) : (
            <div className="tv-float-art-fallback">
              <img src="/truevoice-favicon.png" alt="" aria-hidden="true" className="tv-float-art-favicon" />
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="tv-float-info">
          <span className="tv-float-title">{title}</span>
          <span className="tv-float-artist">{artist}</span>
        </div>

        {/* Controls */}
        <div className="tv-float-controls">
          {isPlaying && <Waveform />}
          <button
            type="button"
            className="tv-btn-listen tv-btn-listen--sm"
            onPointerUp={handleTogglePlay}
            onClick={(e) => e.preventDefault()}
          >
            {isPlaying ? "Stop" : "Listen Live"}
          </button>
        </div>
      </div>
    );
  }

  /* ── RENDER: Full card ─────────────────────────────────────────────────── */
  return (
    <div className="tv-now-playing tv-radio-card">

      {/* Top banner */}
      <div className="tv-radio-banner">
        <span className="tv-banner-wordmark">
          TrueVoice<span className="tv-banner-dot">.</span>Digital
        </span>
        <div className="tv-onair-pill">
          <span className="tv-onair-dot" aria-hidden="true" />
          ON AIR
        </div>
      </div>

      {/* Body */}
      <div className="tv-radio-body">

        {/* Left panel */}
        <div className="tv-radio-left">

          {!activeShow ? (
            /* STATE 1 — Music only, no active show */
            <>
              <div className="tv-radio-eyebrow">
                <Waveform />
                <span>Now Playing</span>
              </div>
              <h2 className="tv-radio-title">{title}</h2>
              <p className="tv-radio-artist">{artist}</p>
            </>
          ) : (
            /* STATE 2 or 3 — Show is live */
            <>
              <p className="tv-show-tagline">{activeShow.tagline}</p>
              <h2 className="tv-radio-title tv-radio-title--show">{activeShow.name}</h2>
              {showNowPlayingStrip && (
                /* STATE 2 — Song playing between drops */
                <div className="tv-np-strip">
                  <Waveform />
                  <span className="tv-np-strip-label">NOW PLAYING</span>
                  <span className="tv-np-strip-divider" aria-hidden="true" />
                  <span className="tv-np-strip-track">
                    {displaySong.title}
                    {displaySong.artist
                      ? <span className="tv-np-strip-artist"> · {displaySong.artist}</span>
                      : null}
                  </span>
                </div>
              )}
            </>
          )}

          {error && <p className="tv-radio-error">{error}</p>}

          <button
            type="button"
            className="tv-btn-listen"
            onPointerUp={handleTogglePlay}
            onClick={(e) => e.preventDefault()}
          >
            <Waveform />
            {isPlaying ? "Stop" : "Listen Live"}
          </button>

          {isOwner && listeners != null && !Number.isNaN(listeners) && (
            <span className="tv-listeners" title="Live listeners (owner view)">
              {listeners} listening
            </span>
          )}
        </div>

        {/* Right panel — album art in all states */}
        <div className="tv-radio-right">
          <div className="tv-art-frame">
            {art ? (
              <img
                src={art}
                alt={`${title} cover art`}
                className="tv-art-img"
                loading="lazy"
              />
            ) : (
              <div className="tv-art-fallback">
                <img
                  src="/truevoice-favicon.png"
                  alt=""
                  className="tv-art-fallback-logo"
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
          <span className="tv-art-label">Album Art</span>
        </div>

      </div>
    </div>
  );
}
