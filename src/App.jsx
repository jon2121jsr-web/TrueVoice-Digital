import { useRef, useState } from "react";
import "./App.css";

import Hero from "./components/Hero";
import { NowPlayingPanel } from "./components/NowPlayingPanel";
import { VerseOfTheDay } from "./components/VerseOfTheDay";
import PodcastList from "./components/PodcastList";
import ReelsGrid from "./components/ReelsGrid";

// Real AzuraCast URLs (update later to https when ready)
const LIVE_STREAM_URL =
  "http://143.244.188.4/listen/truevoice_digital/radio.mp3";

const PUBLIC_PAGE_URL = "http://143.244.188.4/public/truevoice_digital";

function App() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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

  const handleToggleHistory = () => {
    setShowHistory((prev) => !prev);
  };

  const handleShare = () => {
    // Try to copy the public page URL; fall back to opening it
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(PUBLIC_PAGE_URL)
        .then(() => {
          alert("Stream link copied to clipboard.");
        })
        .catch(() => {
          window.open(PUBLIC_PAGE_URL, "_blank", "noopener,noreferrer");
        });
    } else {
      window.open(PUBLIC_PAGE_URL, "_blank", "noopener,noreferrer");
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

      {/* Hero banner */}
      <Hero />

      <main className="tv-main">
        {/* HERO ROW – dynamic Now Playing + Verse of the Day */}
        <section className="tv-hero">
          {/* Left: live now playing info + controls */}
          <div className="tv-now-playing">
            <NowPlayingPanel showHistory={showHistory} />

            <div className="tv-player-controls">
              <button
                className="tv-btn tv-btn-primary"
                onClick={handlePlayToggle}
              >
                {isPlaying ? "Pause Live" : "Play Live"}
              </button>

              <button
                className="tv-btn tv-btn-secondary"
                onClick={handleToggleHistory}
              >
                {showHistory ? "Hide Tracks" : "Recent Tracks"}
              </button>

              <button
                className="tv-icon-btn"
                title="Share stream"
                onClick={handleShare}
              >
                ↗
              </button>
            </div>
          </div>

          {/* Right: Verse of the Day card */}
          <aside className="tv-verse-card">
            <VerseOfTheDay />
          </aside>
        </section>

        {/* FEATURED PODCASTS – handled entirely inside PodcastList */}
        <section className="tv-section">
          <PodcastList maxEpisodes={6} />
        </section>

        {/* TRUEVOICE REELS – Give Me An Answer clips */}
        <section className="tv-section">
          <ReelsGrid />
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
        <p>
          © {new Date().getFullYear()} TrueVoice.Digital · All rights reserved.
        </p>
      </footer>
    </div>
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
