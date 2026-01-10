// src/App.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import Hero from "./components/Hero";
import { NowPlayingPanel } from "./components/NowPlayingPanel";
import { VerseOfTheDay } from "./components/VerseOfTheDay";
import PodcastList from "./components/PodcastList";
import ReelsGrid from "./components/ReelsGrid";
import { NowPlayingDebug } from "./components/NowPlayingDebug";
import TrueVoiceConnect from "./components/TrueVoiceConnect.jsx";
import RecentTracksBar from "./components/RecentTracksBar.jsx";
import VideoModal from "./components/VideoModal.jsx";

import { videoFeed, VIDEO_SECTIONS } from "./data/videoFeed";

// Stream URL (with env override for Vercel)
const LIVE_STREAM_URL =
  import.meta.env.VITE_TRUEVOICE_STREAM_URL ||
  "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

function App() {
  const playerRef = useRef(null);
  const [currentStation, setCurrentStation] = useState("TrueVoice Radio");
  const [showDebug, setShowDebug] = useState(false);

  // Video modal state
  const [videoOpen, setVideoOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);

  // Give thanks banner (Stripe redirect)
  const [showThanks, setShowThanks] = useState(false);

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

  // Show a "Thank you" confirmation if Stripe redirects back with ?thanks=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const thanks = params.get("thanks");

    if (thanks) {
      setShowThanks(true);

      // clean the URL after showing thanks
      params.delete("thanks");
      const newQs = params.toString();
      const newUrl = newQs ? `${window.location.pathname}?${newQs}` : window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      // auto-hide after a moment
      const t = window.setTimeout(() => setShowThanks(false), 9000);
      return () => window.clearTimeout(t);
    }
  }, []);

  // --- Video feed helpers ---
  const feedBySection = useMemo(() => {
    const active = (videoFeed || []).filter((v) => v && v.active);
    const grouped = {
      [VIDEO_SECTIONS.WATCH_LIVE]: [],
      [VIDEO_SECTIONS.LISTEN_AGAIN]: [],
      [VIDEO_SECTIONS.MUSIC_TESTIMONIES]: [],
    };

    for (const item of active) {
      if (grouped[item.section]) grouped[item.section].push(item);
    }

    // featured first, then newest
    for (const k of Object.keys(grouped)) {
      grouped[k].sort((a, b) => {
        const af = a.featured ? 1 : 0;
        const bf = b.featured ? 1 : 0;
        if (af !== bf) return bf - af;

        const ad = new Date(a.publishedAt || 0).getTime();
        const bd = new Date(b.publishedAt || 0).getTime();
        return bd - ad;
      });
    }

    return grouped;
  }, []);

  const openVideoForSection = (sectionKey) => {
    const list = feedBySection[sectionKey] || [];
    const chosen = list[0] || null;

    if (!chosen) {
      console.warn("No active video configured for section:", sectionKey);
      return;
    }

    setActiveVideo(chosen);
    setVideoOpen(true);
  };

  // Handlers for TrueVoice Connect buttons (now real)
  const handleWatchLive = () => openVideoForSection(VIDEO_SECTIONS.WATCH_LIVE);
  const handleListenAgain = () => openVideoForSection(VIDEO_SECTIONS.LISTEN_AGAIN);
  const handleMusicAndTestimonies = () => openVideoForSection(VIDEO_SECTIONS.MUSIC_TESTIMONIES);

  const closeVideo = () => {
    setVideoOpen(false);
    setActiveVideo(null);
  };

  return (
    <div className="app-container tv-app">
      {/* TOP BAR / BRAND + GIVE BUTTON */}
      <header className="tv-header">
        <div className="tv-header-inner">
          <div className="tv-brand">TrueVoice.Digital</div>

          <div className="tv-header-actions">
            <button type="button" className="tv-header-give" onClick={handleHeaderGiveClick}>
              Give
            </button>
          </div>
        </div>
      </header>

      {/* HERO BANNER */}
      <Hero />
      <audio ref={playerRef} preload="none" />

      <main className="tv-main">
        {/* Lightweight "Thank you" banner */}
        {showThanks && (
          <div
            style={{
              margin: "14px auto 0",
              maxWidth: "1100px",
              padding: "12px 14px",
              borderRadius: "14px",
              background: "rgba(37, 99, 235, 0.10)",
              border: "1px solid rgba(37, 99, 235, 0.18)",
              fontWeight: 600,
            }}
          >
            Thank you for supporting TrueVoice Digital. Your gift is received.
          </div>
        )}

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
                    // Add ?thanks=1 so Stripe redirect can land cleanly back here later
                    href="https://buy.stripe.com/eVa14K5ATf1o60o8ww"
                    className="tv-support-btn tv-support-btn-primary tv-donate-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Monthly Gift</span>
                    <span className="tv-support-subtext">Become a monthly partner.</span>
                  </a>

                  <a
                    href="https://buy.stripe.com/3cs8y88qbdzC0eIfZk"
                    className="tv-support-btn tv-support-btn-primary tv-donate-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>One-Time Gift</span>
                    <span className="tv-support-subtext">Make a one-time donation.</span>
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
          <p>© {new Date().getFullYear()} TrueVoice.Digital. All rights reserved.</p>
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

      {/* VIDEO MODAL */}
      <VideoModal open={videoOpen} onClose={closeVideo} video={activeVideo} />
    </div>
  );
}

export default App;
