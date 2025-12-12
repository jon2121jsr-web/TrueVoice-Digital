// src/App.jsx
import { useEffect, useRef, useState } from "react";
import "./App.css";

import Hero from "./components/Hero";
import { NowPlayingPanel } from "./components/NowPlayingPanel";
import { VerseOfTheDay } from "./components/VerseOfTheDay";
import PodcastList from "./components/PodcastList";
import ReelsGrid from "./components/ReelsGrid";
import { NowPlayingDebug } from "./components/NowPlayingDebug";
import TrueVoiceConnect from "./components/TrueVoiceConnect.jsx";
import RecentTracksBar from "./components/RecentTracksBar.jsx";

// Stream URL (with env override for Vercel)
const LIVE_STREAM_URL =
  import.meta.env.VITE_TRUEVOICE_STREAM_URL ||
  "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

function App() {
  const playerRef = useRef(null);
  const [currentStation, setCurrentStation] = useState("TrueVoice Radio");
  const [showDebug, setShowDebug] = useState(false);

  const handleStatusChange = (status) => {
    if (status && status.station) {
      setCurrentStation(status.station);
    }
  };

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.altKey && event.key.toLowerCase() === "d") {
        setShowDebug((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleHeaderGiveClick = () => {
    const el = document.getElementById("tv-support-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Auto night mode based on local time
  useEffect(() => {
    const updateTheme = () => {
      const hour = new Date().getHours();
      const isNight = hour >= 20 || hour < 6; // 8pm–6am
      document.body.classList.toggle("tv-night", isNight);
    };

    updateTheme();
    const id = window.setInterval(updateTheme, 15 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // PLACEHOLDER handlers for TrueVoice Connect buttons
  const handleWatchLive = () => console.log("Watch Live clicked");
  const handleListenAgain = () => console.log("Listen Again clicked");
  const handleMusicAndTestimonies = () =>
    console.log("Music & Testimonies clicked");

  return (
    <div className="app-container tv-app">
      {/* TOP BAR / BRAND + GIVE BUTTON */}
      <header className="tv-header">
        <div className="tv-header-inner">
          <div className="tv-brand">TrueVoice.Digital</div>

          <div className="tv-header-actions">
            <button
              type="button"
              className="tv-header-give"
              onClick={handleHeaderGiveClick}
            >
              Give
            </button>
          </div>
        </div>
      </header>

      {/* HERO BANNER */}
      <Hero />
      <audio ref={playerRef} preload="none" />

      <main className="tv-main">
        {/* NOW PLAYING + VERSE OF THE DAY GRID */}
        <div className="tv-hero">
          <NowPlayingPanel
            streamUrl={LIVE_STREAM_URL}
            audioRef={playerRef}
            showHistory={false} // ✅ disable internal recent tracks block
            onStatusChange={handleStatusChange}
          />

          {/* ✅ FORCE THE VERSE TO ALWAYS RENDER INSIDE A "CARD" */}
          <div className="tv-verse-card">
            <VerseOfTheDay />
          </div>
        </div>

        {/* ✅ RECENTLY PLAYED BAR */}
        <RecentTracksBar />

        {/* TRUEVOICE CONNECT */}
        <section className="tv-section tv-section--stacked">
          <TrueVoiceConnect
            onWatchLive={handleWatchLive}
            onListenAgain={handleListenAgain}
            onMusicAndTestimonies={handleMusicAndTestimonies}
          />
        </section>

        {/* REELS GRID */}
        <section className="tv-section tv-section--stacked">
          <ReelsGrid />
        </section>

        {/* PODCAST LIST */}
        <section className="tv-section tv-section--stacked">
          <PodcastList />
        </section>

        {/* SUPPORT / GIVING CARD */}
        <section id="tv-support-section" className="tv-section">
          <div className="tv-support-grid">
            <div>
              <h2>Support the Mission</h2>
              <p className="tv-support-copy">
                Your generosity helps keep TrueVoice Digital streaming worldwide.
              </p>

              <div className="tv-support-actions">
                <div className="tv-donate-row">
                  <a
                    href="https://buy.stripe.com/eVa14K5ATf1o60o8ww"
                    className="tv-support-btn tv-support-btn-primary tv-donate-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Monthly Gift</span>
                    <span className="tv-support-subtext">
                      Become a monthly partner.
                    </span>
                  </a>

                  <a
                    href="https://buy.stripe.com/3cs8y88qbdzC0eIfZk"
                    className="tv-support-btn tv-support-btn-primary tv-donate-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>One-Time Gift</span>
                    <span className="tv-support-subtext">
                      Make a one-time donation.
                    </span>
                  </a>
                </div>
              </div>
            </div>

            <div>
              <div className="tv-merch-grid">
                <div className="tv-merch-item">T-Shirts</div>
                <div className="tv-merch-item">Hoodies</div>
                <div className="tv-merch-item">Mugs</div>
              </div>
              <button className="tv-btn tv-btn-secondary tv-shop-btn" disabled>
                Shop Merch (Coming Soon)
              </button>
            </div>
          </div>
        </section>

        {/* FOOTER + ATTRIBUTION */}
        <footer className="tv-footer">
          <p>
            © {new Date().getFullYear()} TrueVoice.Digital. All rights reserved.
          </p>
          <p className="tv-footer-attrib">POWERED BY OUTPUT DIGITAL</p>
        </footer>
      </main>

      {/* DEBUG PANEL (ALT+D) */}
      {showDebug && (
        <NowPlayingDebug
          playerRef={playerRef}
          currentStation={currentStation}
          liveUrl={LIVE_STREAM_URL}
        />
      )}
    </div>
  );
}

export default App;
