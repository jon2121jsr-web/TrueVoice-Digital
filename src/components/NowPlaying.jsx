// src/components/NowPlaying.jsx
import { useEffect, useState } from 'react';
import './NowPlaying.css';

const API_URL = 'http://143.244.188.4/api/nowplaying/truevoice_digital';

function NowPlaying() {
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchNowPlaying() {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Request failed');
        const data = await res.json();

        if (cancelled) return;

        const now = data.now_playing || data;
        const title = now.song?.title || 'Live Stream';
        const artist = now.song?.artist || 'TrueVoice Digital';

        setTrack({ title, artist });
        setError('');
      } catch (err) {
        if (cancelled) return;
        setError('Live data unavailable right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchNowPlaying();
    const id = setInterval(fetchNowPlaying, 30000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const title = loading
    ? 'Loading…'
    : track?.title || 'Song Title';

  const artist = loading
    ? ''
    : track?.artist || 'Artist Name';

  return (
    <section className="nowplaying-card">
      <p className="nowplaying-label">Now Playing</p>

      <div className="nowplaying-main">
        <div className="nowplaying-artwork-placeholder" />

        <div className="nowplaying-meta">
          <h2 className="nowplaying-title">{title}</h2>
          {artist && <p className="nowplaying-artist">{artist}</p>}
          {error && <p className="nowplaying-error">{error}</p>}

          <div className="nowplaying-actions">
            <button className="np-btn np-btn-primary">Play Live</button>
            <button className="np-btn np-btn-ghost">Recent Tracks</button>
            <button className="np-btn np-btn-ghost">Share</button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default NowPlaying;
