// src/components/PodcastList.jsx
import { useEffect, useState } from "react";
import { fetchPodcastEpisodes } from "../services/api";

export function PodcastList({ maxEpisodes = 8 }) {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const all = await fetchPodcastEpisodes(maxEpisodes);
        if (isMounted) {
          setEpisodes(all);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load podcasts.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    const id = window.setInterval(load, 15 * 60 * 1000);
    return () => {
      isMounted = false;
      window.clearInterval(id);
    };
  }, [maxEpisodes]);

  return (
    <section className="podcast-list card">
      <div className="podcast-header">
        <h3>Podcasts & Shows</h3>
      </div>

      {loading && !episodes.length && <p>Loading episodes…</p>}

      {error && (
        <p className="error">
          Could not load podcast episodes. <br />
          <small>{error}</small>
        </p>
      )}

      {!loading && !error && !episodes.length && (
        <p>No episodes available yet.</p>
      )}

      <ul className="podcast-episodes">
        {episodes.map((ep) => (
          <li key={ep.id} className="podcast-episode">
            <a href={ep.link} target="_blank" rel="noreferrer">
              <div className="podcast-episode-main">
                <p className="podcast-title">{ep.title}</p>
                <small className="podcast-date">
                  {new Date(ep.publishedAt).toLocaleDateString()}
                </small>
              </div>
              {ep.image && (
                <img
                  src={ep.image}
                  alt={ep.title}
                  className="podcast-thumb"
                  loading="lazy"
                />
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
