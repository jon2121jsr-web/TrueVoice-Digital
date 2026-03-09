// src/components/NowPlayingPanel.jsx
// ✅ When AzuraCast flips to next song, waits STREAM_DELAY_SEC before showing it
// ✅ This compensates for Live365 CDN relay buffer (~50-55 seconds)
// ✅ Owner-only listener count via ?owner=true
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchNowPlaying } from "../services/api";

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

// Extra seconds to wait AFTER AzuraCast says the next song started,
// before we update the display. This matches the Live365 CDN relay buffer.
// Tune via .env: VITE_STREAM_DELAY_SEC=55
// Too early → increase. Too late → decrease.
const STREAM_DELAY_SEC = toNum(import.meta.env.VITE_STREAM_DELAY_SEC, 65);

export function NowPlayingPanel({
  streamUrl,
  audioRef,
  showHistory = false,
  onStatusChange,
}) {
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [listeners, setListeners] = useState(null);
  const isOwner = useIsOwner();

  // displaySong: what the UI shows right now
  // pendingFlipAt: Date.now() ms timestamp when we should flip to pendingSong
  const [displaySong,  setDisplaySong]  = useState(null);
  const pendingSongRef  = useRef(null);   // { song } waiting to be shown
  const pendingFlipRef  = useRef(null);   // ms timestamp to flip at
  const displaySongRef  = useRef(null);   // mirrors displaySong for use in callbacks

  const AZURACAST_FALLBACK_URL =
    "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

  /* ──────────────────────────────────────────────────────────────────────────
     POLL AZURACAST every 15 seconds
  ────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const result = await fetchNowPlaying();
        if (!alive) return;

        const song = result?.now_playing?.song || null;

        // Listeners
        const rawL = result?.listeners;
        if (rawL != null) {
          const c = typeof rawL === "object"
            ? (rawL.current ?? rawL.total ?? 0)
            : Number(rawL);
          setListeners(Number.isFinite(c) ? c : null);
        }

        if (!song?.title) {
          if (alive) setLoading(false);
          return;
        }

        const incomingId = song.id    || song.title;
        const currentId  = displaySongRef.current?.id || displaySongRef.current?.title;
        const pendingId  = pendingSongRef.current?.song?.id || pendingSongRef.current?.song?.title;

        if (!displaySongRef.current) {
          // First load — show immediately, no delay needed
          displaySongRef.current = song;
          setDisplaySong(song);

        } else if (incomingId === currentId) {
          // Same song still playing on AzuraCast — nothing to do
          // (clear any stale pending if AzuraCast rolled back somehow)
          if (pendingId && pendingId !== incomingId) {
            // keep pending — different song is queued
          }

        } else if (incomingId === pendingId) {
          // AzuraCast confirms the pending song again — flip time already set
          // Nothing to update

        } else {
          // New song detected on AzuraCast that we haven't seen before.
          // Schedule it to appear STREAM_DELAY_SEC seconds from now.
          // This is the CDN buffer delay — listeners still hear the old song.
          pendingSongRef.current  = { song };
          pendingFlipRef.current  = Date.now() + (STREAM_DELAY_SEC * 1000);
        }

        setError(null);
        setLoading(false);
      } catch (err) {
        if (!alive) return;
        console.error("NowPlaying error:", err);
        setError(err?.message || "Failed to load now playing.");
        setLoading(false);
      }
    }

    load();
    const id = window.setInterval(load, 15_000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  /* ──────────────────────────────────────────────────────────────────────────
     1-SECOND TICK — checks if it's time to flip to pending song
  ────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pendingSongRef.current || !pendingFlipRef.current) return;
      if (Date.now() >= pendingFlipRef.current) {
        // Time to flip
        const next = pendingSongRef.current.song;
        displaySongRef.current = next;
        setDisplaySong(next);
        pendingSongRef.current = null;
        pendingFlipRef.current = null;
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, []);

  /* ──────────────────────────────────────────────────────────────────────────
     DERIVED DISPLAY VALUES
  ────────────────────────────────────────────────────────────────────────── */
  const title  = displaySong?.title  || (loading ? "Loading current track…" : "Live Stream");
  const artist = displaySong?.artist || "TrueVoice Digital";
  const album  = displaySong?.album  || "TrueVoice Digital";
  const art    = displaySong?.art    || null;

  const liveLabel = useMemo(() => {
    if (error) return "OFF AIR";
    return isPlaying ? "NOW STREAMING" : "READY";
  }, [error, isPlaying]);

  /* ──────────────────────────────────────────────────────────────────────────
     NOTIFY APP (lock screen / MediaSession)
  ────────────────────────────────────────────────────────────────────────── */
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

  /* ──────────────────────────────────────────────────────────────────────────
     AUDIO ELEMENT EVENTS
  ────────────────────────────────────────────────────────────────────────── */
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

  /* ──────────────────────────────────────────────────────────────────────────
     STREAM CONTROL
  ────────────────────────────────────────────────────────────────────────── */
  const startStream = (el, url) => {
    el.src = url;
    el.load();
    const p = el.play();
    if (p?.catch) p.catch((e) => {
      console.error("play() failed:", e);
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
          try { if (el.paused) startStream(el, AZURACAST_FALLBACK_URL); }
          catch { /* ignore */ }
        }, 600);
        setIsPlaying(true);
      } else {
        el.pause();
        el.removeAttribute("src");
        el.load();
        setIsPlaying(false);
      }
    } catch (err) {
      console.error("Stream toggle failed:", err);
      setError("Tap again to start audio.");
      setIsPlaying(false);
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────
     RENDER
  ────────────────────────────────────────────────────────────────────────── */
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

          {showHistory && null}
        </div>
      </div>
    </div>
  );
}