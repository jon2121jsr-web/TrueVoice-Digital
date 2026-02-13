// src/components/NowPlayingPanel.jsx
import { useEffect, useMemo, useState } from "react";
import { fetchNowPlaying } from "../services/api";

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

  // Safety fallback (keeps you from going dark if Live365 is temporarily flaky)
  const AZURACAST_FALLBACK_URL =
    "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

  /* ----------------------------------------
     Poll AzuraCast Now Playing
  ---------------------------------------- */
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

  /* ----------------------------------------
     Derived display values
  ---------------------------------------- */
  const song = data?.song || null;
  const title =
    song?.title || (loading ? "Loading current track…" : "Live Stream");
  const artist = song?.artist || "TrueVoice Digital";
  const album = song?.album || "TrueVoice Digital";
  const art = song?.art || null;
  const listeners = data?.listeners ?? null;

  const liveLabel = useMemo(() => {
    if (error) return "OFF AIR";
    return isPlaying ? "NOW STREAMING" : "READY";
  }, [error, isPlaying]);

  /* ----------------------------------------
     Inform App of status (MediaSession, LIVE dot, etc.)
     ✅ Include song details so App can populate lock screen metadata
  ---------------------------------------- */
  useEffect(() => {
    if (typeof onStatusChange === "function") {
      onStatusChange({
        isLive: !!isPlaying && !error,
        hasError: !!error,
        isLoading: !!loading,
        station: "TrueVoice Radio",
        // Pass through a shape App already knows how to read
        now_playing: {
          song: {
            title,
            artist,
            album,
            art,
          },
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
     LIVE RADIO TOGGLE (STOP / START)
     - Pause = STOP (kill stream)
     - Play = START fresh (new connection)
     ✅ Adds safe fallback to AzuraCast if primary stream fails
  ---------------------------------------- */
  const handleTogglePlay = async () => {
    const el = audioRef?.current;
    if (!el) return;

    try {
      if (!isPlaying) {
        // START: fresh live connection
        setError(null);

        // Primary
        el.src = streamUrl;
        el.load();
        try {
          await el.play();
          setIsPlaying(true);
          return;
        } catch (primaryErr) {
          console.warn("Primary stream failed, trying fallback…", primaryErr);
        }

        // Fallback (AzuraCast)
        el.src = AZURACAST_FALLBACK_URL;
        el.load();
        await el.play();
        setIsPlaying(true);
      } else {
        // STOP: kill stream completely
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
                onClick={handleTogglePlay}
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
