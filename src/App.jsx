import { useRef, useState } from "react";
import "./App.css";
import Hero from "./components/Hero";

const LIVE_STREAM_URL = "https://YOUR-AZURACAST-STREAM-URL-HERE";

function App() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (!audio.src) {
        audio.src = LIVE_STREAM_URL;
      }
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error("Error playing stream:", err);
          alert("Unable to start the stream. Check the stream URL or server.");
        });
    }
  };

  return (
    <div className="tv-app">
      {/* hidden audio element for live stream */}
      <audio ref={audioRef} hidden />

      {/* Top band */}
      <header className="tv-header">
        <div className="tv-header-inner">
          <div className="tv-brand">TrueVoice.Digital</div>
        </div>
      </header>

      <Hero />

      <main className="tv-main">
        {/* HERO ROW */}
        <section className="tv-hero">
          {/* Now Playing card */}
          <div className="tv-now-playing">
            <div className="tv-artwork-placeholder" />
            <div className="tv-now-content">
              <span className="tv-eyebrow">NOW PLAYING</span>
              <h1 className="tv-song-title">Song Title</h1>
              <p className="tv-artist-name">Artist Name</p>

              <div className="tv-player-controls">
                <button
                  className="tv-btn tv-btn-primary"
                  onClick={handlePlayToggle}
                >
                  {isPlaying ? "Pause Live" : "Play Live"}
                </button>
                <button className="tv-btn tv-btn-secondary">
                  Recent Tracks
                </button>
                <button className="tv-icon-btn" title="Share stream">
                  ↗
                </button>
              </div>
            </div>
          </div>

          {/* Verse card */}
          <aside className="tv-verse-card">
            <h2 className="tv-verse-label">VERSE FOR TODAY</h2>
            <p className="tv-verse-text">
              “I came that they may have life and have it abundantly.”
            </p>
            <p className="tv-verse-ref">John 10:10</p>
          </aside>
        </section>

        {/* FEATURED PODCASTS */}
        <section className="tv-section">
          <h2 className="tv-section-title">Featured Podcasts</h2>
          <div className="tv-card-grid">
            <PodcastCard
              title="Podcast Episode"
              description="Brief description about this episode."
            />
            <PodcastCard
              title="Podcast Episode"
              description="Brief description about this episode."
            />
            <PodcastCard
              title="Latest Videos"
              description="Highlights, teachings, and stories."
            />
          </div>
        </section>

        {/* TRUEVOICE CONNECT */}
        <section className="tv-section">
          <h2 className="tv-section-title">TrueVoice Connect</h2>
          <div className="tv-card-grid">
            <ConnectCard label="Watch Live" />
            <ConnectCard label="Listen Again" />
            <ConnectCard label="Stories & Testimonies" />
          </div>
        </section>

        {/* SUPPORT / MERCH */}
        <section className="tv-section tv-support-grid">
          <div>
            <h2 className="tv-section-title">Support the Mission</h2>
            <div className="tv-support-actions">
              <button className="tv-support-btn tv-support-btn-primary">
                Prayer Request
                <span className="tv-support-subtext">
                  Share what we can pray for.
                </span>
              </button>
              <button className="tv-support-btn tv-support-btn-outline">
                Share an encouragement
                <span className="tv-support-subtext">
                  Share a testimony or story.
                </span>
              </button>
            </div>
          </div>

          <div>
            <h2 className="tv-section-title">Shop & Give</h2>
            <p className="tv-support-copy">
              Keep TrueVoice streaming strong through your support.
            </p>
            <div className="tv-merch-grid">
              <div className="tv-merch-item">Merch</div>
              <div className="tv-merch-item">Merch</div>
              <div className="tv-merch-item">Merch</div>
            </div>
            <button className="tv-btn tv-btn-primary tv-shop-btn">
              Shop More
            </button>
          </div>
        </section>
      </main>

      <footer className="tv-footer">
        <p>© {new Date().getFullYear()} TrueVoice.Digital · All rights reserved.</p>
      </footer>
    </div>
  );
}

function PodcastCard({ title, description }) {
  return (
    <article className="tv-card">
      <div className="tv-card-thumb" />
      <h3 className="tv-card-title">{title}</h3>
      <p className="tv-card-text">{description}</p>
    </article>
  );
}

function ConnectCard({ label }) {
  return (
    <article className="tv-card tv-connect-card">
      <div className="tv-play-icon">▶</div>
      <h3 className="tv-card-title">{label}</h3>
    </article>
  );
}

export default App;
