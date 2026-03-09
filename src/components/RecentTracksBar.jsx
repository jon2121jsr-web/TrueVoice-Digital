// src/components/RecentTracksBar.jsx
// Reads data.song_history from api.js (AzuraCast field name, no translation)
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

        // api.js always returns song_history with nested song objects
        const raw = Array.isArray(data?.song_history) ? data.song_history : [];

        const normalized = raw.slice(0, 12).map((item) => ({
          id:        item.sh_id || item.played_at || undefined,
          played_at: item.played_at || 0,
          title:     item.song?.title  || "Unknown title",
          artist:    item.song?.artist || "",
          album:     item.song?.album  || "",
          art:       item.song?.art    || null,
        }));

        if (isMounted) {
          setTracks(normalized);
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
    const id = window.setInterval(load, 60_000);
    return () => { isMounted = false; window.clearInterval(id); };
  }, []);

  if ((loading || error) && tracks.length === 0) return null;

  return (
    <section className="tv-section tv-section--stacked">
      <h2 className="tv-section-title">Recently Played</h2>
      <div className="tv-history-strip">
        {tracks.map((item, idx) => (
          <div
            key={item.id || `${item.title}-${idx}`}
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