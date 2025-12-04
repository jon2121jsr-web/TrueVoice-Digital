// src/components/NowPlayingPanel.jsx
import { useEffect, useState } from "react";
import { fetchNowPlaying } from "../services/api";

export function NowPlayingPanel({ showHistory }) {
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
  const title =
    song?.title || (loading ? "Loading current track…" : "Live Stream");
  const artist = song?.artist || "TrueVoice Digital";
  const art = song?.art || null;
  const listeners = data?.listeners ?? null;
  const isLive = data?.isLive ?? false;
  const liveStreamer = data?.liveStreamer || null;

  // History – flexible in case of different API field names
  const historyRaw =
    (Array.isArray(data?.history) && data.history) ||
    (Array.isArray(data?.recent_tracks) && data.recent_tracks) ||
    [];
  const history = historyRaw.slice(0, 6);

  const liveLabel = error
    ? "OFF AIR"
    : isLive
    ? liveStreamer
      ? `LIVE • ${liveStreamer}`
      : "LIVE"
    : "AutoDJ";

  const formatTime = (value) => {
    if (!value) return "";
    const d = new Date(value * 1000 || value); // handles unix seconds or ISO
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="tv-now-inner">
      {/* LEFT: artwork area */}
      <div className="tv-artwork-placeholder">
        {art && (
          <img
            src={art}
            alt={`${title} cover art`}
            className="tv-artwork-img"
          />
        )}
      </div>

      {/* RIGHT: text/meta + optional history */}
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

        {showHistory && (
          <div className="tv-history-block">
            <h2 className="tv-history-heading">Recent Tracks</h2>
            {history.length === 0 ? (
              <p className="tv-history-empty">
                History will appear here as tracks play.
              </p>
            ) : (
              <ul className="tv-history-list">
                {history.map((item, idx) => (
                  <li
                    key={
                      item.id ||
                      item.song_id ||
                      item.played_at ||
                      `${item.title}-${idx}`
                    }
                    className="tv-history-item"
                  >
                    {item.art && (
                      <img
                        src={item.art}
                        alt={item.title || "Previous track"}
                        className="tv-history-thumb"
                      />
                    )}
                    <div className="tv-history-text">
                      <span className="tv-history-title">
                        {item.title || "Unknown title"}
                      </span>
                      {item.artist && (
                        <span className="tv-history-artist">
                          {item.artist}
                        </span>
                      )}
                    </div>
                    {item.played_at && (
                      <span className="tv-history-time">
                        {formatTime(item.played_at)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
