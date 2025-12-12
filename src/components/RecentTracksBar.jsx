// src/components/RecentTracksBar.jsx
import { useEffect, useState } from "react";
import { fetchNowPlaying } from "../services/api";

export default function RecentTracksBar() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchNowPlaying();

        // Same logic as NowPlayingPanel history
        const historyRaw =
          (Array.isArray(data?.history) && data.history) ||
          (Array.isArray(data?.recent_tracks) && data.recent_tracks) ||
          [];

        if (isMounted) {
          setTracks(historyRaw.slice(0, 12));
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("RecentTracksBar error:", err);
          setError(err?.message || "Failed to load recent tracks.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    const id = window.setInterval(load, 60_000); // refresh every 60s

    return () => {
      isMounted = false;
      window.clearInterval(id);
    };
  }, []);

  if ((loading || error) && tracks.length === 0) {
    // fail silently – don't show an empty bar
    return null;
  }

  return (
    <section className="tv-section tv-section--stacked">
      <h2 className="tv-section-title">Recently Played</h2>
      <div className="tv-history-strip">
        {tracks.map((item, idx) => (
          <div
            key={
              item.id ||
              item.song_id ||
              item.played_at ||
              `${item.title}-${idx}`
            }
            className="tv-history-chip"
          >
            {item.art && (
              <img
                src={item.art}
                alt={item.title || "Previous track"}
                className="tv-history-chip-art"
                loading="lazy"
              />
            )}
            <div className="tv-history-chip-text">
              <span className="tv-history-chip-title">
                {item.title || "Unknown title"}
              </span>
              {item.artist && (
                <span className="tv-history-chip-artist">{item.artist}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
