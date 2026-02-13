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

// Stream URL (ENV-FIRST; safe fallback)
// ✅ Primary: Live365 public stream endpoint (licensed)
// ✅ Fallback: your legacy AzuraCast public stream (kept for safety)
const LIVE365_STREAM_URL = "https://streaming.live365.com/a61535";
const AZURACAST_FALLBACK_URL =
  "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

const LIVE_STREAM_URL =
  import.meta.env.VITE_TRUEVOICE_STREAM_URL || LIVE365_STREAM_URL;

// Social links (ENV-FIRST; safe fallbacks)
const SOCIAL = {
  youtube:
    import.meta.env.VITE_TRUEVOICE_YOUTUBE_URL ||
    "https://www.youtube.com/channel/UCWpVof-rd5hs1xpchwj1MAQl",
  x: import.meta.env.VITE_TRUEVOICE_X_URL || "https://x.com/YOUR_HANDLE",
  instagram:
    import.meta.env.VITE_TRUEVOICE_INSTAGRAM_URL ||
    "https://www.instagram.com/YOUR_HANDLE",
};

// Stripe links (LOCKED)
const STRIPE = {
  monthly: "https://buy.stripe.com/cNi9AV6N326wdOA0LHds401",
  oneTime10: "https://buy.stripe.com/3cI14pb3j6mMdOA9idds404",
  oneTime25: "https://buy.stripe.com/3cI28t6N37qQbGsgKFds403",
  oneTime50: "https://buy.stripe.com/dRmcN7dbrh1qcKw8e9ds402",
};

// --- Media Session helpers (lock screen + car metadata) ---
const DEFAULT_MEDIA_TITLE = "TrueVoice Digital";
const DEFAULT_MEDIA_ART = "/truevoice-favicon.png"; // assumes this exists in /public

function safeText(v) {
  return (v ?? "").toString().trim();
}

function buildArtworkList(src) {
  const url = safeText(src) || DEFAULT_MEDIA_ART;
  // iOS/Android are happier with multiple sizes; type is best-effort
  return [
    { src: url, sizes: "512x512", type: "image/png" },
    { src: url, sizes: "256x256", type: "image/png" },
    { src: url, sizes: "128x128", type: "image/png" },
    { src: url, sizes: "96x96", type: "image/png" },
  ];
}

function setMediaSessionMetadata({ title, artist, album, artUrl }) {
  if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;

  const t = safeText(title) || DEFAULT_MEDIA_TITLE;
  const a = safeText(artist) || "Now Playing";
  const al = safeText(album) || DEFAULT_MEDIA_TITLE;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: t,
    artist: a,
    album: al,
    artwork: buildArtworkList(artUrl),
  });
}

function wireMediaSessionControls(audioEl) {
  if (!audioEl || !("mediaSession" in navigator)) return;

  // Play/pause handlers help Android + many car head units
  try {
    navigator.mediaSession.setActionHandler("play", async () => {
      try {
        // Ensure src exists in case something cleared it
        if (!audioEl.src) audioEl.src = LIVE_STREAM_URL;
        await audioEl.play();
      } catch {
        // ignore
      }
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      try {
        audioEl.pause();
      } catch {
        // ignore
      }
    });

    // If you don't support these, disable to avoid "broken" controls
    ["previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto"].forEach(
      (action) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    );
  } catch {
    // ignore
  }

  const syncPlaybackState = () => {
    try {
      navigator.mediaSession.playbackState = audioEl.paused ? "paused" : "playing";
    } catch {
      // ignore
    }
  };

  audioEl.addEventListener("play", syncPlaybackState);
  audioEl.addEventListener("pause", syncPlaybackState);
  audioEl.addEventListener("ended", syncPlaybackState);

  syncPlaybackState();

  return () => {
    audioEl.removeEventListener("play", syncPlaybackState);
    audioEl.removeEventListener("pause", syncPlaybackState);
    audioEl.removeEventListener("ended", syncPlaybackState);
  };
}

function App() {
  const playerRef = useRef(null);

  // Station label (shown in debug, etc.)
  const [currentStation, setCurrentStation] = useState("TrueVoice Digital");
  const [showDebug, setShowDebug] = useState(false);

  // Now Playing state for Media Session + (optional future UI use)
  const [nowPlaying, setNowPlaying] = useState({
    title: "",
    artist: "",
    album: "",
    artUrl: "",
  });

  // Video modal state
  const [videoOpen, setVideoOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);

  // Give thanks banner (Stripe redirect)
  const [showThanks, setShowThanks] = useState(false);

  // --- Floating player state (Task 1) ---
  const sentinelRef = useRef(null);
  const surfaceRef = useRef(null);
  const [isFloatingPlayer, setIsFloatingPlayer] = useState(false);
  const [dockHeight, setDockHeight] = useState(0);

  const handleStatusChange = (status) => {
    if (!status) return;

    // Keep station label updated (best effort)
    if (status.station) setCurrentStation(status.station);
    if (status?.station?.name) setCurrentStation(status.station.name);

    // --- Robust extraction of "now playing" from whatever shape NowPlayingPanel emits ---
    const s =
      status?.now_playing?.song ||
      status?.nowPlaying?.song ||
      status?.song ||
      status?.now_playing ||
      status?.nowPlaying ||
      null;

    if (s) {
      const title = safeText(s.title) || safeText(s.text) || "";
      const artist = safeText(s.artist) || "";
      const album = safeText(s.album) || "";
      const artUrl = safeText(s.art) || safeText(s.artUrl) || "";

      if (title || artist || album || artUrl) {
        setNowPlaying({ title, artist, album, artUrl });
      }
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
      const newUrl = newQs
        ? `${window.location.pathname}?${newQs}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      // auto-hide after a moment
      const t = window.setTimeout(() => setShowThanks(false), 9000);
      return () => window.clearTimeout(t);
    }
  }, []);

  // --- Media Session: wire controls once the audio element exists ---
  useEffect(() => {
    const audioEl = playerRef.current;
    if (!audioEl) return;

    // Ensure src exists early
    if (!audioEl.src) {
      audioEl.src = LIVE_STREAM_URL;
    }

    // ✅ Safety: if Live365 ever fails to load, fall back to AzuraCast
    const handleAudioError = () => {
      try {
        // Only fall back if we're not already on the fallback
        const current = (audioEl.currentSrc || audioEl.src || "").toString();
        if (current.includes("streaming.live365.com")) {
          audioEl.src = AZURACAST_FALLBACK_URL;
        }
      } catch {
        // ignore
      }
    };

    audioEl.addEventListener("error", handleAudioError);

    const cleanup = wireMediaSessionControls(audioEl);

    return () => {
      audioEl.removeEventListener("error", handleAudioError);
      cleanup?.();
    };
  }, []);

  // --- Media Session: update metadata whenever Now Playing changes ---
  useEffect(() => {
    const title = nowPlaying.title || DEFAULT_MEDIA_TITLE;
    const artist = nowPlaying.artist || "Streaming";
    const album = nowPlaying.album || DEFAULT_MEDIA_TITLE;
    const artUrl = nowPlaying.artUrl || DEFAULT_MEDIA_ART;

    setMediaSessionMetadata({ title, artist, album, artUrl });
  }, [nowPlaying]);

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

  const closeVideo = () => {
    setVideoOpen(false);
    setActiveVideo(null);
  };

  const SocialIconLink = ({ href, label, children }) => (
    <a
      className="tv-social-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
    >
      {children}
    </a>
  );

  // Keep dockHeight accurate (spacer avoids layout jump)
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const h = entry?.contentRect?.height || 0;
      setDockHeight(h);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Detect when the player scrolls out of view (then float it)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsFloatingPlayer(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        rootMargin: "-12px 0px 0px 0px",
      }
    );

    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  return (
    <div className="app-container tv-app">
      {/* TOP BAR / BRAND + SOCIAL + GIVE BUTTON */}
      <header className="tv-header">
        <div className="tv-header-inner">
          <div className="tv-brand">TrueVoice.Digital</div>

          <div className="tv-header-actions">
            <div className="tv-social-row" aria-label="TrueVoice social links">
              <SocialIconLink href={SOCIAL.youtube} label="YouTube">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.5 12 4.5 12 4.5s-5.7 0-7.5.6A3 3 0 0 0 2.4 7.2 31.2 31.2 0 0 0 1.8 12c0 1.6.2 3.2.6 4.8a3 3 0 0 0 2.1 2.1c1.8.6 7.5.6 7.5.6s5.7 0 7.5-.6a3 3 0 0 0 2.1-2.1c.4-1.6.6-3.2.6-4.8s-.2-3.2-.6-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
                </svg>
              </SocialIconLink>

              <SocialIconLink href={SOCIAL.x} label="X">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M18.9 2H22l-6.8 7.8L23 22h-6.8l-5.3-6.7L4.8 22H2l7.4-8.5L1 2h6.9l4.8 6.1L18.9 2Zm-1.2 18h1.7L7.2 3.9H5.4L17.7 20Z" />
                </svg>
              </SocialIconLink>

              <SocialIconLink href={SOCIAL.instagram} label="Instagram">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm-5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5Zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5ZM18 6.8a1.2 1.2 0 1 1-1.2-1.2A1.2 1.2 0 0 1 18 6.8Z" />
                </svg>
              </SocialIconLink>
            </div>

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

      <main
        className={`tv-main ${isFloatingPlayer ? "tv-main--player-floating" : ""}`}
      >
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
            onWatchLive={() => openVideoForSection(VIDEO_SECTIONS.WATCH_LIVE)}
            onListenAgain={() => openVideoForSection(VIDEO_SECTIONS.LISTEN_AGAIN)}
            onMusicAndTestimonies={() =>
              openVideoForSection(VIDEO_SECTIONS.MUSIC_TESTIMONIES)
            }
          />
        </section>

        <section className="tv-section tv-section--stacked">
          <ReelsGrid />
        </section>

        <section className="tv-section tv-section--stacked">
          <PodcastList />
        </section>

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
                    href={STRIPE.monthly}
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
                    href={STRIPE.oneTime10}
                    className="tv-support-btn tv-support-btn-primary tv-donate-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="One-Time Gift $10"
                    title="One-Time Gift $10"
                  >
                    <span>One-Time $10</span>
                    <span className="tv-support-subtext">Seed Gift</span>
                  </a>

                  <a
                    href={STRIPE.oneTime25}
                    className="tv-support-btn tv-support-btn-primary tv-donate-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="One-Time Gift $25"
                    title="One-Time Gift $25"
                  >
                    <span>One-Time $25</span>
                    <span className="tv-support-subtext">Supporter Gift</span>
                  </a>

                  <a
                    href={STRIPE.oneTime50}
                    className="tv-support-btn tv-support-btn-primary tv-donate-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="One-Time Gift $50"
                    title="One-Time Gift $50"
                  >
                    <span>One-Time $50</span>
                    <span className="tv-support-subtext">Impact Gift</span>
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

        <footer className="tv-footer">
          <div className="tv-footer-social">
            <span className="tv-footer-follow">Follow TrueVoice Digital</span>
            <div className="tv-social-row" aria-label="TrueVoice social links">
              <SocialIconLink href={SOCIAL.youtube} label="YouTube">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.5 12 4.5 12 4.5s-5.7 0-7.5.6A3 3 0 0 0 2.4 7.2 31.2 31.2 0 0 0 1.8 12c0 1.6.2 3.2.6 4.8a3 3 0 0 0 2.1 2.1c1.8.6 7.5.6 7.5.6s5.7 0 7.5-.6a3 3 0 0 0 2.1-2.1c.4-1.6.6-3.2.6-4.8s-.2-3.2-.6-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
                </svg>
              </SocialIconLink>

              <SocialIconLink href={SOCIAL.x} label="X">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M18.9 2H22l-6.8 7.8L23 22h-6.8l-5.3-6.7L4.8 22H2l7.4-8.5L1 2h6.9l4.8 6.1L18.9 2Zm-1.2 18h1.7L7.2 3.9H5.4L17.7 20Z" />
                </svg>
              </SocialIconLink>

              <SocialIconLink href={SOCIAL.instagram} label="Instagram">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm-5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5Zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5ZM18 6.8a1.2 1.2 0 1 1-1.2-1.2A1.2 1.2 0 0 1 18 6.8Z" />
                </svg>
              </SocialIconLink>
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
  );
}

export default App;
