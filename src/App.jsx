// src/App.jsx  — v10  (Capturing Christianity, The Beat by Allen Parr, Cold Case Christianity added April 2026)
import { useCallback, useEffect, useRef, useState } from "react";
import { Routes, Route } from "react-router-dom";
import AdminDashboard from "./pages/AdminDashboard";
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
import MerchSection from "./components/MerchSection.jsx";
import HeroMerchSlide from "./components/HeroMerchSlide.jsx";

import { useYouTubeFeed } from "./hooks/useYouTubeFeed";

// ─── Video sections ───────────────────────────────────────────────────────────
const VIDEO_SECTIONS = {
  WATCH_LIVE:              'WATCH_LIVE',
  PIGSKIN_FRENZY:          'PIGSKIN_FRENZY',
  CAPTURING_CHRISTIANITY:  'CAPTURING_CHRISTIANITY',
  BEAT_ALLEN_PARR:         'BEAT_ALLEN_PARR',
  COLD_CASE_CHRISTIANITY:  'COLD_CASE_CHRISTIANITY',
};

const PIGSKIN_CHANNEL_ID          = "UC_khbgasHiiwUxPHOMfbR0A";
const CAPTURING_CHRISTIANITY_ID   = "UCux-_Fze30tFuI_5CArwSmg";
const BEAT_ALLEN_PARR_ID          = "UCm_RMW_fQk-ELpPYUzor8lw";
const COLD_CASE_CHRISTIANITY_ID   = "UCVFe7xhG6rl0ruoMQCJDtnw";
const pigskinEpisodeFilter = (title) => title?.trim().startsWith("Episode");

// ─── Stream URLs ──────────────────────────────────────────────────────────────
const LIVE365_STREAM_URL =
  "https://streaming.live365.com/a61535";

const LIVE_STREAM_URL =
  import.meta.env.VITE_TRUEVOICE_STREAM_URL || LIVE365_STREAM_URL;

const AZURACAST_FALLBACK_URL =
  "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

// ─── Social links ─────────────────────────────────────────────────────────────
const SOCIAL = {
  youtube:
    import.meta.env.VITE_TRUEVOICE_YOUTUBE_URL ||
    "https://www.youtube.com/@TrueVoiceDigital",
  x:
    import.meta.env.VITE_TRUEVOICE_X_URL ||
    "https://x.com/TrueVoiceStream",
  instagram:
    import.meta.env.VITE_TRUEVOICE_INSTAGRAM_URL ||
    "https://www.instagram.com/truevoicedigital",
};

// ─── Stripe links ─────────────────────────────────────────────────────────────
const STRIPE = {
  monthly:   "https://buy.stripe.com/cNi9AV6N326wdOA0LHds401",
  oneTime10: "https://buy.stripe.com/3cI14pb3j6mMdOA9idds404",
  oneTime25: "https://buy.stripe.com/3cI28t6N37qQbGsgKFds403",
  oneTime50: "https://buy.stripe.com/dRmcN7dbrh1qcKw8e9ds402",
};

// ─── Media Session helpers ────────────────────────────────────────────────────
const STATION_NAME      = "TrueVoice Digital";
const DEFAULT_MEDIA_ART = "/truevoice-favicon.png";

function safeText(v) {
  return (v ?? "").toString().trim();
}

function buildArtworkList(src) {
  const url = safeText(src) || DEFAULT_MEDIA_ART;
  return [
    { src: url, sizes: "512x512", type: "image/png" },
    { src: url, sizes: "256x256", type: "image/png" },
    { src: url, sizes: "128x128", type: "image/png" },
    { src: url, sizes: "96x96",   type: "image/png" },
  ];
}

function setMediaSessionMetadata({ title, artist, artUrl }) {
  if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title:   safeText(title)  || STATION_NAME,
    artist:  safeText(artist) || "Now Playing",
    album:   STATION_NAME,
    artwork: buildArtworkList(artUrl),
  });
}

function reconnectAndPlay(audioEl) {
  if (!audioEl) return;
  audioEl.src = LIVE_STREAM_URL;
  audioEl.load();
  audioEl.play().catch(() => {
    audioEl.src = AZURACAST_FALLBACK_URL;
    audioEl.load();
    audioEl.play().catch(() => {});
  });
}

function wireMediaSessionControls(audioEl) {
  if (!audioEl || !("mediaSession" in navigator)) return;

  try {
    navigator.mediaSession.setActionHandler("play", () => {
      reconnectAndPlay(audioEl);
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      try { audioEl.pause(); } catch { /* ignore */ }
    });

    ["previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto"]
      .forEach((action) => {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* ignore */ }
      });
  } catch { /* ignore */ }

  const syncPlaybackState = () => {
    try {
      navigator.mediaSession.playbackState = audioEl.paused ? "paused" : "playing";
    } catch { /* ignore */ }
  };

  audioEl.addEventListener("play",  syncPlaybackState);
  audioEl.addEventListener("pause", syncPlaybackState);
  audioEl.addEventListener("ended", syncPlaybackState);
  syncPlaybackState();

  return () => {
    audioEl.removeEventListener("play",  syncPlaybackState);
    audioEl.removeEventListener("pause", syncPlaybackState);
    audioEl.removeEventListener("ended", syncPlaybackState);
  };
}

// ─── iOS PWA detection ────────────────────────────────────────────────────────
function isRunningAsIOSPWA() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

// ─── SocialIconLink — iOS PWA-safe ───────────────────────────────────────────
function SocialIconLink({ href, label, children }) {
  const url = safeText(href);

  const handleClick = (e) => {
    if (!url || url === "#") { e.preventDefault(); return; }
    if (isRunningAsIOSPWA() && navigator.share) {
      e.preventDefault();
      navigator.share({ url }).catch(() => { window.location.href = url; });
    }
  };

  return (
    <a
      className="tv-social-link"
      href={url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      style={{
        pointerEvents: "auto", position: "relative", zIndex: 50,
        cursor: "pointer", WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation", display: "inline-flex",
        alignItems: "center", justifyContent: "center",
        minWidth: "44px", minHeight: "44px",
      }}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const YoutubeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ pointerEvents: "none" }}>
    <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.5 12 4.5 12 4.5s-5.7 0-7.5.6A3 3 0 0 0 2.4 7.2 31.2 31.2 0 0 0 1.8 12c0 1.6.2 3.2.6 4.8a3 3 0 0 0 2.1 2.1c1.8.6 7.5.6 7.5.6s5.7 0 7.5-.6a3 3 0 0 0 2.1-2.1c.4-1.6.6-3.2.6-4.8s-.2-3.2-.6-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ pointerEvents: "none" }}>
    <path d="M18.9 2H22l-6.8 7.8L23 22h-6.8l-5.3-6.7L4.8 22H2l7.4-8.5L1 2h6.9l4.8 6.1L18.9 2Zm-1.2 18h1.7L7.2 3.9H5.4L17.7 20Z" />
  </svg>
);

const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ pointerEvents: "none" }}>
    <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm-5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5Zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5ZM18 6.8a1.2 1.2 0 1 1-1.2-1.2A1.2 1.2 0 0 1 18 6.8Z" />
  </svg>
);

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const playerRef = useRef(null);

  const [currentStation, setCurrentStation] = useState(STATION_NAME);
  const [showDebug,      setShowDebug]      = useState(false);

  const [nowPlaying, setNowPlaying] = useState({
    title: "", artist: "", artUrl: "",
  });

  const [videoOpen,   setVideoOpen]   = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [showThanks,  setShowThanks]  = useState(false);

  // Floating player
  const sentinelRef        = useRef(null);
  const surfaceRef         = useRef(null);
  const [isFloatingPlayer, setIsFloatingPlayer] = useState(false);
  const [dockHeight,       setDockHeight]       = useState(0);

  const handleStatusChange = useCallback((status) => {
    if (!status) return;

    if (status?.station?.name) {
      setCurrentStation(status.station.name);
    } else if (typeof status.station === "string" && status.station) {
      setCurrentStation(status.station);
    }

    const s =
      status?.now_playing?.song  ||
      status?.nowPlaying?.song   ||
      status?.song               ||
      status?.now_playing        ||
      status?.nowPlaying         ||
      null;

    if (s) {
      const title  = safeText(s.title)  || safeText(s.text) || "";
      const artist = safeText(s.artist) || "";
      const artUrl = safeText(s.art)    || safeText(s.artUrl) || "";

      setNowPlaying((prev) => {
        if (
          prev.title  === title  &&
          prev.artist === artist &&
          prev.artUrl === artUrl
        ) return prev;
        return { title, artist, artUrl };
      });
    }
  }, []);

  // Alt+D debug toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === "d") setShowDebug((p) => !p);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleHeaderGiveClick = () => {
    document.getElementById("tv-support-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Auto night mode
  useEffect(() => {
    const updateTheme = () => {
      const hour = new Date().getHours();
      document.body.classList.toggle("tv-night", hour >= 20 || hour < 6);
    };
    updateTheme();
    const id = window.setInterval(updateTheme, 15 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // Stripe thanks param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("thanks")) return;
    setShowThanks(true);
    params.delete("thanks");
    const qs     = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
    const t = window.setTimeout(() => setShowThanks(false), 9000);
    return () => window.clearTimeout(t);
  }, []);

  // Wire MediaSession AFTER first user-initiated play
  useEffect(() => {
    const audioEl = playerRef.current;
    if (!audioEl) return;

    let cleanupFn = null;
    let wired = false;

    const onFirstPlay = () => {
      if (wired) return;
      wired = true;
      cleanupFn = wireMediaSessionControls(audioEl);
    };

    audioEl.addEventListener("play", onFirstPlay);
    return () => {
      audioEl.removeEventListener("play", onFirstPlay);
      cleanupFn?.();
    };
  }, []);

  // Update MediaSession metadata whenever song changes
  useEffect(() => {
    setMediaSessionMetadata({
      title:  nowPlaying.title  || STATION_NAME,
      artist: nowPlaying.artist || "Streaming",
      artUrl: nowPlaying.artUrl || DEFAULT_MEDIA_ART,
    });
  }, [nowPlaying]);

  // Dynamic video feeds
  const pigskinFeed           = useYouTubeFeed({ channelId:  PIGSKIN_CHANNEL_ID,         maxResults: 1, filterFn: pigskinEpisodeFilter });
const capturingFeed         = useYouTubeFeed({ channelId:  CAPTURING_CHRISTIANITY_ID,  maxResults: 1 });
  const beatFeed              = useYouTubeFeed({ channelId:  BEAT_ALLEN_PARR_ID,         maxResults: 1 });
  const coldCaseFeed          = useYouTubeFeed({ channelId:  COLD_CASE_CHRISTIANITY_ID,  maxResults: 1 });

  const feedBySection = {
    [VIDEO_SECTIONS.WATCH_LIVE]:             [],
    [VIDEO_SECTIONS.PIGSKIN_FRENZY]:         pigskinFeed.videos,
[VIDEO_SECTIONS.CAPTURING_CHRISTIANITY]: capturingFeed.videos,
    [VIDEO_SECTIONS.BEAT_ALLEN_PARR]:        beatFeed.videos,
    [VIDEO_SECTIONS.COLD_CASE_CHRISTIANITY]: coldCaseFeed.videos,
  };

  const openVideoForSection = (sectionKey) => {
    const chosen = (feedBySection[sectionKey] || [])[0] || null;
    if (!chosen) {
      console.warn("No active video for section:", sectionKey);
      return;
    }
    setActiveVideo(chosen);
    setVideoOpen(true);
  };

  const closeVideo = () => {
    setVideoOpen(false);
    setActiveVideo(null);
  };

  // Dock height observer
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      setDockHeight(entry?.contentRect?.height || 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Floating player sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setIsFloatingPlayer(!entry.isIntersecting),
      { root: null, threshold: 0, rootMargin: "-12px 0px 0px 0px" }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  return (
    <Routes>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={
        <div className="app-container tv-app">

          {/* ── HEADER ── */}
          <header className="tv-header">
            <div className="tv-header-inner">
              <div className="tv-brand">TrueVoice.Digital</div>

              <div className="tv-header-actions">
                <div
                  className="tv-social-row"
                  aria-label="TrueVoice social links"
                  style={{ pointerEvents: "auto", position: "relative", zIndex: 50 }}
                >
                  <SocialIconLink href={SOCIAL.youtube}   label="YouTube">   <YoutubeIcon />   </SocialIconLink>
                  <SocialIconLink href={SOCIAL.x}         label="X">         <XIcon />         </SocialIconLink>
                  <SocialIconLink href={SOCIAL.instagram} label="Instagram"> <InstagramIcon /> </SocialIconLink>
                </div>

                <button
                  type="button"
                  className="tv-header-give"
                  onClick={handleHeaderGiveClick}
                  style={{ touchAction: "manipulation" }}
                >
                  Give
                </button>
              </div>
            </div>
          </header>

          {/* ── HERO ── */}
          <Hero />

          <audio ref={playerRef} preload="metadata" playsInline />

          <main className={`tv-main ${isFloatingPlayer ? "tv-main--player-floating" : ""}`}>

            {showThanks && (
              <div style={{
                margin: "14px auto 0", maxWidth: "1100px", padding: "12px 14px",
                borderRadius: "14px", background: "rgba(37,99,235,0.10)",
                border: "1px solid rgba(37,99,235,0.18)", fontWeight: 600,
              }}>
                Thank you for supporting TrueVoice Digital. Your gift is received.
              </div>
            )}

            <div className="tv-hero">
              <div className={`tv-player-dock ${isFloatingPlayer ? "is-floating" : ""}`}>
                <div ref={sentinelRef} className="tv-player-sentinel" aria-hidden="true" />

                {isFloatingPlayer && (
                  <div
                    className="tv-player-spacer"
                    style={{ height: dockHeight || 0 }}
                    aria-hidden="true"
                  />
                )}

                <div ref={surfaceRef} className="tv-player-surface">
                  <NowPlayingPanel
                    streamUrl={LIVE_STREAM_URL}
                    audioRef={playerRef}
                    showHistory={false}
                    onStatusChange={handleStatusChange}
                    isFloating={isFloatingPlayer}
                  />
                </div>
              </div>

              <div className="tv-verse-card">
                <VerseOfTheDay />
              </div>
            </div>

            <RecentTracksBar />

            <section className="tv-section tv-section--stacked">
              <TrueVoiceConnect
                onWatchLive={()               => openVideoForSection(VIDEO_SECTIONS.WATCH_LIVE)}
                onPigskinFrenzy={()           => openVideoForSection(VIDEO_SECTIONS.PIGSKIN_FRENZY)}
onCapturingChristianity={()   => openVideoForSection(VIDEO_SECTIONS.CAPTURING_CHRISTIANITY)}
                onBeatAllenParr={()           => openVideoForSection(VIDEO_SECTIONS.BEAT_ALLEN_PARR)}
                onColdCaseChristianity={()    => openVideoForSection(VIDEO_SECTIONS.COLD_CASE_CHRISTIANITY)}
              />
            </section>

            <section className="tv-section tv-section--stacked"><ReelsGrid /></section>
            <section className="tv-section tv-section--stacked"><PodcastList /></section>

            {/* ── SUPPORT THE MISSION ── */}
            <section id="tv-support-section" className="tv-section">
              <h2 className="tv-section-title">Support the Mission</h2>
              <p className="tv-support-copy">
                Your generosity helps keep TrueVoice Digital streaming worldwide.
              </p>

              <div className="tv-donate-row">
                {[
                  { href: STRIPE.monthly,   label: "Monthly Gift",  sub: "Become a monthly partner." },
                  { href: STRIPE.oneTime10, label: "One-Time $10",  sub: "Seed Gift" },
                  { href: STRIPE.oneTime25, label: "One-Time $25",  sub: "Supporter Gift" },
                  { href: STRIPE.oneTime50, label: "One-Time $50",  sub: "Impact Gift" },
                ].map(({ href, label, sub }) => (
                  <a
                    key={label}
                    href={href}
                    className="tv-support-btn tv-support-btn-primary tv-donate-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                  >
                    <span>{label}</span>
                    <span className="tv-support-subtext">{sub}</span>
                  </a>
                ))}
              </div>
            </section>

            <MerchSection />

            {/* ── FOOTER ── */}
            <footer className="tv-footer">
              <div className="tv-footer-social">
                <span className="tv-footer-follow">Follow TrueVoice Digital</span>
                <div
                  className="tv-social-row"
                  aria-label="TrueVoice social links"
                  style={{ pointerEvents: "auto", position: "relative", zIndex: 50 }}
                >
                  <SocialIconLink href={SOCIAL.youtube}   label="YouTube">   <YoutubeIcon />   </SocialIconLink>
                  <SocialIconLink href={SOCIAL.x}         label="X">         <XIcon />         </SocialIconLink>
                  <SocialIconLink href={SOCIAL.instagram} label="Instagram"> <InstagramIcon /> </SocialIconLink>
                </div>
              </div>

              <p>© {new Date().getFullYear()} TrueVoice.Digital. All rights reserved.</p>
              <p className="tv-footer-attrib">POWERED BY OUTPUT DIGITAL</p>
            </footer>
          </main>

          {showDebug && (
            <NowPlayingDebug
              playerRef={playerRef}
              currentStation={currentStation}
              liveUrl={LIVE_STREAM_URL}
            />
          )}

          <VideoModal open={videoOpen} onClose={closeVideo} video={activeVideo} />
        </div>
      } />
    </Routes>
  );
}

export default App;
