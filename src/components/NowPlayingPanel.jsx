// src/components/NowPlayingPanel.jsx
// ✅ Duration-based metadata hold — shows current track until it actually ends
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

  // Current and scheduled tracks
  const [currentTrack,    setCurrentTrack]    = useState(null);
  const [scheduledTrack,  setScheduledTrack]  = useState(null);
  const [listeners,       setListeners]       = useState(null);

  const AZURACAST_FALLBACK_URL =
    "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

  /* ────────────────────────────────────────────────────────────────────────
     POLL AZURACAST NOW PLAYING
     Every 15 seconds, fetch metadata and calculate when the current track ends.
     The UI only switches tracks when the calculated end time passes.
  ──────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const result = await fetchNowPlaying();
        if (!alive) return;

        const nowPlayingSong = result?.now_playing?.song || result?.song || null;
        const nextSong       = result?.playing_next?.song || null;
        const nowPlayingData = result?.now_playing || result || {};
        const playingNextData = result?.playing_next || {};

        // Update listener count
        if (typeof result?.listeners?.current === "number") {
          setListeners(result.listeners.current);
        } else if (typeof result?.listeners === "number") {
          setListeners(result.listeners);
        }

        // If no song data at all, bail
        if (!nowPlayingSong?.title) {
          if (alive) setLoading(false);
          return;
        }

        /* ─── Calculate track duration ──────────────────────────────────────
           Priority:
           1. now_playing.duration (if > 0)
           2. Time delta between played_at timestamps (next - current)
           3. Fallback: 180 seconds (3 min average)
        ──────────────────────────────────────────────────────────────────── */
        let durationSec = 180; // default fallback

        const apiDuration = toInt(nowPlayingData.duration, 0);
        if (apiDuration > 0) {
          durationSec = apiDuration;
        } else {
          // Calculate from timestamps if both exist
          const currentPlayedAt = toInt(nowPlayingData.played_at, 0);
          const nextPlayedAt    = toInt(playingNextData.played_at, 0);

          if (currentPlayedAt > 0 && nextPlayedAt > currentPlayedAt) {
            durationSec = nextPlayedAt - currentPlayedAt;
          }
        }

        // Calculate when this track ends (absolute UNIX timestamp in ms)
        const playedAtMs = toInt(nowPlayingData.played_at, Date.now() / 1000) * 1000;
        const endsAtMs   = playedAtMs + (durationSec * 1000);

        /* ─── Track change detection ────────────────────────────────────────
           Only update scheduled track if the song ID or title changed.
           This prevents re-triggering on every 15-second poll.
        ──────────────────────────────────────────────────────────────────── */
        setScheduledTrack((prev) => {
          const newId    = nowPlayingSong.id || nowPlayingSong.title;
          const prevId   = prev?.song?.id || prev?.song?.title;

          if (newId === prevId) {
            return prev; // Same track, don't update
          }

          // New track detected
          return {
            song: nowPlayingSong,
            endsAtMs,
            playedAtMs,
            durationSec,
          };
        });

        setError(null);
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
  }, []); // no deps — runs once on mount

  /* ────────────────────────────────────────────────────────────────────────
     1-SECOND TICK
     Re-evaluate which track to display based on current time vs. endsAtMs.
  ──────────────────────────────────────────────────────────────────────── */
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  /* ────────────────────────────────────────────────────────────────────────
     DISPLAY LOGIC
     Show currentTrack until its endsAtMs passes, then switch to scheduledTrack.
  ──────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!scheduledTrack) return;

    const now = Date.now();

    // If no current track, or current track has ended, switch immediately
    if (!currentTrack || now >= currentTrack.endsAtMs) {
      setCurrentTrack(scheduledTrack);
      return;
    }

    // Current track is still playing — keep showing it
    // (scheduledTrack will display once endsAtMs passes on next tick)
  }, [scheduledTrack, currentTrack, tick]);

  /* ────────────────────────────────────────────────────────────────────────
     DERIVED DISPLAY VALUES
  ──────────────────────────────────────────────────────────────────────── */
  const displaySong = currentTrack?.song || null;

  const title  = displaySong?.title  || (loading ? "Loading current track…" : "Live Stream");
  const artist = displaySong?.artist || "TrueVoice Digital";
  const album  = displaySong?.album  || "TrueVoice Digital";
  const art    = displaySong?.art    || null;

  const liveLabel = useMemo(() => {
    if (error) return "OFF AIR";
    return isPlaying ? "NOW STREAMING" : "READY";
  }, [error, isPlaying]);

  /* ────────────────────────────────────────────────────────────────────────
     NOTIFY APP OF STATUS CHANGES (lock screen / MediaSession)
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

  /* ────────────────────────────────────────────────────────────────────────
     WIRE AUDIO ELEMENT EVENTS
  ──────────────────────────────────────────────────────────────────────── */
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

  /* ────────────────────────────────────────────────────────────────────────
     STREAM CONTROL
  ──────────────────────────────────────────────────────────────────────── */
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

        // Quick fallback if primary doesn't start
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

  /* ────────────────────────────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────────────────────────────── */
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