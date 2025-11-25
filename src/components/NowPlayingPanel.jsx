// src/components/NowPlayingPanel.jsx
import { useEffect, useState } from "react";
import { fetchNowPlaying } from "../services/api";

export function NowPlayingPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const result = await fetchNowPlaying();
        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("NowPlaying error:", err);
          setError(err.message || "Failed to load now playing.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    const id = window.setInterval(load, 30_000);
    return () => {
      isMounted = false;
      window.clearInterval(id);
    };
  }, []);

  // ---- derive display values ----
  const song = data?.song;
  const title = song?.title || (loading ? "Loading current track…" : "Live Stream");
  const artist = song?.artist || "TrueVoice Digital";
  const art = song?.art || null;
  const listeners = data?.listeners ?? null;
  const isLive = data?.isLive ?? false;
  const liveStreamer = data?.liveStreamer || null;

  const liveLabel = error
    ? "OFF AIR"
    : isLive
    ? liveStreamer
      ? `LIVE • ${liveStreamer}`
      : "LIVE"
    : "AutoDJ";

  return (
    <>
      {/* LEFT: artwork area (uses your existing hero styles) */}
      <div className="tv-artwork-placeholder">
        {art && (
          <img
            src={art}
            alt={`${title} cover art`}
            className="tv-artwork-img"
          />
        )}
      </div>

      {/* RIGHT: text/meta area (uses your existing hero styles) */}
      <div className="tv-now-content">
        <span className="tv-eyebrow">
          {error ? "STREAM STATUS" : "NOW PLAYING"}
        </span>

        <h1 className="tv-song-title">{title}</h1>
        <p className="tv-artist-name">{artist}</p>

        <div className="tv-meta-row">
          <span
            className={
              isLive && !error ? "tv-live-pill tv-live-pill-on" : "tv-live-pill"
            }
          >
            {liveLabel}
          </span>

          {listeners != null && !Number.isNaN(listeners) && (
            <span className="tv-listeners">{listeners} listening</span>
          )}
        </div>
      </div>
    </>
  );
}
