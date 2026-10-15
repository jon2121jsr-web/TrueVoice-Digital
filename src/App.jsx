import { IS_PREVIEW } from './lib/previewSafety';
// src/App.jsx  — v10  (Capturing Christianity, The Beat by Allen Parr, Cold Case Christianity added April 2026)
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";
import AdminDashboard from "./pages/AdminDashboard";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import PulseExplore from "./pages/PulseExplore";
import { consumeHandoffQuery, resolveShowHandoff } from "./lib/queryHandoff";
import { createVideoQueue, queueDestination } from "./features/pulse/videoQueue";
import { exploreVideoLocation } from "./features/pulse/videoEngagement";
import { videoDiagnostic } from "./features/pulse/videoDiagnostics";
import { MediaCoordinationContext } from "./features/pulse/MediaCoordinationContext";
import { createMediaCoordinator, stopEmbeddedVideo } from "./features/pulse/mediaCoordinator";
import "./App.css";

import Hero from "./components/Hero";
import PulseIntro from "./features/pulse/PulseIntro.jsx";
import "./features/pulse/PulseHome.css";
import { NowPlayingPanel } from "./components/NowPlayingPanel";
import { VerseOfTheDay } from "./components/VerseOfTheDay";
import PodcastList from "./components/PodcastList";
import ReelsGrid from "./components/ReelsGrid";
import { NowPlayingDebug } from "./components/NowPlayingDebug";
import TrueVoiceConnect from "./components/TrueVoiceConnect.jsx";
// import RecentTracksBar from "./components/RecentTracksBar.jsx";
import TrueVoiceScrollPreview from "./components/TrueVoiceScrollPreview.jsx";
import VideoModal from "./components/VideoModal.jsx";
import MerchSection from "./components/MerchSection.jsx";
import HeroMerchSlide from "./components/HeroMerchSlide.jsx";
import PullToRefresh from "./components/PullToRefresh";
import ChimeIn from "./components/ChimeIn";
import ScrollFeed from "./components/ScrollFeed";
import "./features/pulse/PulseTheme.css";

import { useYouTubeFeed } from "./hooks/useYouTubeFeed";
import { preferredStreamUrl } from "./lib/streamUrl";
import { useVisitorBeacon } from "./hooks/useVisitorBeacon";
import { initPushNotifications } from "./lib/pushNotifications.js";

// ─── Video sections ───────────────────────────────────────────────────────────
const VIDEO_SECTIONS = {
  WATCH_LIVE:              'WATCH_LIVE',
  PIGSKIN_FRENZY:          'PIGSKIN_FRENZY',
  DENISHA:                 'DENISHA',
  TVD_SHORTS:              'TVD_SHORTS',
  CAPTURING_CHRISTIANITY:  'CAPTURING_CHRISTIANITY',
  BEAT_ALLEN_PARR:         'BEAT_ALLEN_PARR',
  COLD_CASE_CHRISTIANITY:  'COLD_CASE_CHRISTIANITY',
  BIBLE_PROJECT:           'BIBLE_PROJECT',
  GIVE_ME_AN_ANSWER:       'GIVE_ME_AN_ANSWER',
};

const PIGSKIN_CHANNEL_ID          = "UC_khbgasHiiwUxPHOMfbR0A";
const DENISHA_CHANNEL_ID          = "UCd1zk8GJorg7Yl9yaqsEhGA";
const TVD_SHORTS_CHANNEL_ID       = "UCWpVof-rd5hs1xpchwj1MAQ";
const CAPTURING_CHRISTIANITY_ID   = "UCux-_Fze30tFuI_5CArwSmg";
const BEAT_ALLEN_PARR_ID          = "UCm_RMW_fQk-ELpPYUzor8lw";
const COLD_CASE_CHRISTIANITY_ID   = "UCVFe7xhG6rl0ruoMQCJDtnw";
const BIBLE_PROJECT_ID            = "UCVfwlh9XpX2Y_tQfjeln9QA";
const GIVE_ME_AN_ANSWER_ID        = "UCKr-liguaGWMf3f94eQXsug";
const pigskinEpisodeFilter = (title) => title?.trim().startsWith("Episode");

// Scroll's "Watch Latest Episode" / "Visit Show Channel" CTAs hand off here
// as /?show=<slug>[&autoplay=1] -- this maps that slug to a VIDEO_SECTIONS
// key. Only shows TrueVoice actually produces get the autoplay-straight-
// into-the-latest-episode treatment (Pigskin Frenzy, Denisha, TVD Shorts);
// the licensed/third-party shows only ever get the no-autoplay "channel"
// version, wired up where the CTA is rendered in FeedCard.jsx.
const SHOW_SLUG_TO_SECTION = {
  pigskin:                 VIDEO_SECTIONS.PIGSKIN_FRENZY,
  denisha:                 VIDEO_SECTIONS.DENISHA,
  tvd_shorts:              VIDEO_SECTIONS.TVD_SHORTS,
  capturing_christianity:  VIDEO_SECTIONS.CAPTURING_CHRISTIANITY,
  beat_allen_parr:         VIDEO_SECTIONS.BEAT_ALLEN_PARR,
  cold_case_christianity:  VIDEO_SECTIONS.COLD_CASE_CHRISTIANITY,
  bible_project:           VIDEO_SECTIONS.BIBLE_PROJECT,
  give_me_an_answer:       VIDEO_SECTIONS.GIVE_ME_AN_ANSWER,
};

// ─── Stream URLs ──────────────────────────────────────────────────────────────
const LIVE365_STREAM_URL =
  "https://streaming.live365.com/a61535";

const LIVE_STREAM_URL = preferredStreamUrl(
  import.meta.env.VITE_TRUEVOICE_STREAM_URL || LIVE365_STREAM_URL
);

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
  facebook:
    import.meta.env.VITE_TRUEVOICE_FACEBOOK_URL ||
    "https://www.facebook.com/profile.php?id=61592697160695",
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

function wireMediaSessionControls(audioEl, media) {
  if (!audioEl || !("mediaSession" in navigator)) return;

  try {
    navigator.mediaSession.setActionHandler("play", () => {
      media.playRadio({ reconnect: true });
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      media.pauseAll();
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
    try {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    } catch { /* unsupported action */ }
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

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ pointerEvents: "none" }}>
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.23 10.44 22v-7.03H7.9v-2.91h2.54V9.86c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.77l-.44 2.91h-2.33V22C18.34 21.23 22 17.08 22 12.06Z" />
  </svg>
);

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  useVisitorBeacon();

  // Subscribing to location here (not just inside <Routes>) is what makes
  // App itself re-render on an in-app navigation like /scroll -> /?listen=1
  // -- without it, the effect below that reads window.location.search only
  // ever ran once, on the very first real page load, and silently missed
  // every later client-side route change (App never unmounts between
  // /scroll and / -- that's the whole point of client-side routing).
  const location = useLocation();
  const navigate = useNavigate();
  const isExplore = !!matchPath("/explore", location.pathname);
  const hasPulseLayout = !["/admin", "/privacy", "/scroll", "/scroll/:id"]
    .some((path) => matchPath(path, location.pathname));
  const media = useMemo(() => createMediaCoordinator(), []);
  const videoIframeRef = useRef(null);
  const previousPathRef = useRef(location.pathname);
  useLayoutEffect(() => {
    if (previousPathRef.current !== location.pathname && hasPulseLayout) window.scrollTo(0, 0);
    previousPathRef.current = location.pathname;
  }, [location.pathname, hasPulseLayout]);

  // Native app only (no-ops entirely on the web build -- see
  // src/lib/pushNotifications.js). Deliberately [] -- this registers the
  // device once per app session, not per route, so it doesn't need the
  // location-remount fix the two effects below needed.
  useEffect(() => {
    initPushNotifications(navigate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playerRef = useRef(null);

  const [currentStation, setCurrentStation] = useState(STATION_NAME);
  const [showDebug,      setShowDebug]      = useState(false);

  const [nowPlaying, setNowPlaying] = useState({
    title: "", artist: "", artUrl: "",
  });
  const nowPlayingRef = useRef(nowPlaying);
  useEffect(() => { nowPlayingRef.current = nowPlaying; }, [nowPlaying]);

  const [videoOpen,   setVideoOpen]   = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [videoQueue, setVideoQueue] = useState(null);
  const videoQueueRef = useRef(null);
  const videoSessionRef = useRef(0);
  const [showThanks,  setShowThanks]  = useState(false);

  // Floating player
  const surfaceRef         = useRef(null);
  const [isFloatingPlayer, setIsFloatingPlayer] = useState(false);

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
    if (isExplore) { navigate("/#tv-support-section"); return; }
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
  const processedThanksRef = useRef(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.get("thanks") || params.has("listen") || params.has("show")) return;
    if (processedThanksRef.current === location.key) return;
    processedThanksRef.current = location.key;
    setShowThanks(true);
    params.delete("thanks");
    navigate(consumeHandoffQuery(location, ["thanks"]), { replace: true, state: location.state });
  }, [location, navigate]);
  useEffect(() => {
    if (!showThanks) return;
    const t = window.setTimeout(() => setShowThanks(false), 9000);
    return () => window.clearTimeout(t);
  }, [showThanks]);

  // Scroll "Listen Live" CTA handoff -- /scroll's CTAStrip lands here as
  // /?listen=1. This is a same-document client-side navigation (React
  // Router, not a real page load), so the tap that triggered it stays
  // "sticky" as far as the browser's autoplay policy is concerned -- no
  // second tap needed. Depends on location.search (not []) so it fires on
  // every arrival here, not just the first real page load of the session.
  const processedListenRef = useRef(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!hasPulseLayout || !params.get("listen") || params.has("show")) return;
    if (processedListenRef.current === location.key) return;
    processedListenRef.current = location.key;
    if (params.get("thanks")) setShowThanks(true);
    params.delete("listen");
    navigate(consumeHandoffQuery(location, ["listen", "thanks"]), { replace: true, state: location.state });
    media.playRadio({ reconnect: true });
    surfaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location, hasPulseLayout, media, navigate]);

  // Wire MediaSession AFTER first user-initiated play
  useEffect(() => {
    const audioEl = playerRef.current;
    if (!audioEl) return;

    let cleanupFn = null;
    let wired = false;

    const onFirstPlay = () => {
      if (audioEl.paused) return;
      const current = nowPlayingRef.current;
      setMediaSessionMetadata({
        title: current.title || STATION_NAME,
        artist: current.artist || "Streaming",
        artUrl: current.artUrl || DEFAULT_MEDIA_ART,
      });
      if (wired) return;
      wired = true;
      cleanupFn = wireMediaSessionControls(audioEl, media);
    };

    audioEl.addEventListener("play", onFirstPlay);
    if (!audioEl.paused) onFirstPlay();
    return () => {
      audioEl.removeEventListener("play", onFirstPlay);
      cleanupFn?.();
    };
  }, [hasPulseLayout, media]);

  // Update MediaSession metadata whenever song changes
  useEffect(() => {
    if (!hasPulseLayout || media.isVideoActive()) return;
    setMediaSessionMetadata({
      title:  nowPlaying.title  || STATION_NAME,
      artist: nowPlaying.artist || "Streaming",
      artUrl: nowPlaying.artUrl || DEFAULT_MEDIA_ART,
    });
  }, [nowPlaying, hasPulseLayout, media]);

  // Dynamic video feeds
  const pigskinFeed           = useYouTubeFeed({ channelId:  PIGSKIN_CHANNEL_ID,         maxResults: 10, filterFn: pigskinEpisodeFilter });
  const denishaFeed           = useYouTubeFeed({ channelId:  DENISHA_CHANNEL_ID,         maxResults: 1 });
  const tvdShortsFeed         = useYouTubeFeed({ channelId:  TVD_SHORTS_CHANNEL_ID,      maxResults: 1 });
const capturingFeed         = useYouTubeFeed({ channelId:  CAPTURING_CHRISTIANITY_ID,  maxResults: 1 });
  const beatFeed              = useYouTubeFeed({ channelId:  BEAT_ALLEN_PARR_ID,         maxResults: 1 });
  const coldCaseFeed          = useYouTubeFeed({ channelId:  COLD_CASE_CHRISTIANITY_ID,  maxResults: 1 });
  const bibleProjectFeed      = useYouTubeFeed({ channelId:  BIBLE_PROJECT_ID,           maxResults: 1 });
  const giveMeAnAnswerFeed    = useYouTubeFeed({ channelId:  GIVE_ME_AN_ANSWER_ID,        maxResults: 1 });

  const feedBySection = {
    [VIDEO_SECTIONS.WATCH_LIVE]:             [],
    [VIDEO_SECTIONS.PIGSKIN_FRENZY]:         pigskinFeed.videos,
    [VIDEO_SECTIONS.DENISHA]:                denishaFeed.videos,
    [VIDEO_SECTIONS.TVD_SHORTS]:             tvdShortsFeed.videos,
[VIDEO_SECTIONS.CAPTURING_CHRISTIANITY]: capturingFeed.videos,
    [VIDEO_SECTIONS.BEAT_ALLEN_PARR]:        beatFeed.videos,
    [VIDEO_SECTIONS.COLD_CASE_CHRISTIANITY]: coldCaseFeed.videos,
    [VIDEO_SECTIONS.BIBLE_PROJECT]:          bibleProjectFeed.videos,
    [VIDEO_SECTIONS.GIVE_ME_AN_ANSWER]:      giveMeAnAnswerFeed.videos,
  };

  const closeVideo = useCallback(() => {
    videoQueueRef.current = null;
    setVideoQueue(null);
    stopEmbeddedVideo(videoIframeRef.current);
    setVideoOpen(false);
    setActiveVideo(null);
    media.endVideo(closeVideo);
  }, [media]);

  const openVideo = useCallback((chosen, collection) => {
    if (!chosen) return;
    const queue = collection ? createVideoQueue(collection, chosen) : null;
    if (collection && !queue) return;
    stopEmbeddedVideo(videoIframeRef.current);
    media.startVideo(closeVideo);
    const session = queue ? { ...queue, sessionId: ++videoSessionRef.current } : null;
    videoQueueRef.current = session;
    setVideoQueue(session);
    setActiveVideo(chosen);
    setVideoOpen(true);
  }, [media, closeVideo]);
  const advanceVideo = useCallback((step, expectedId) => {
    const next = queueDestination(videoQueueRef.current, step, expectedId);
    videoDiagnostic("queue-advance", { step, expectedId, accepted: !!next, nextId: next?.videos[next.index]?.youtubeId });
    if (!next) return;
    // Invalidate stale ended callbacks before replacing the iframe.
    videoQueueRef.current = next;
    stopEmbeddedVideo(videoIframeRef.current);
    media.startVideo(closeVideo);
    setVideoQueue(next);
    setActiveVideo(next.videos[next.index]);
    if (isExplore) navigate(exploreVideoLocation(location, next.videos[next.index].youtubeId || next.videos[next.index].videoId), { replace: true, state: location.state });
  }, [media, closeVideo, isExplore, navigate, location]);
  const openVideoForSection = (sectionKey) => openVideo((feedBySection[sectionKey] || [])[0]);

  // Stop audible video on navigation; never resume radio as a side effect.
  useLayoutEffect(() => () => media.stopVideo(), [location.pathname, media]);

  useEffect(() => {
    if (isExplore || !location.hash) return;
    const id = location.hash.slice(1);
    if (!["tv-support-section", "tv-connect-section"].includes(id)) return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isExplore, location.hash]);

  // Scroll "Watch Latest Episode" / "Visit Show Channel" CTA handoff --
  // /?show=<slug>[&autoplay=1]. Originals (Pigskin Frenzy, Denisha, TVD
  // Shorts) arrive with autoplay=1 and jump straight into the latest
  // episode via the same openVideoForSection() the TrueVoiceConnect tiles
  // use. Licensed/third-party shows arrive without it and just scroll the
  // visitor to TrueVoice Connect to browse -- there's no "TrueVoice
  // episode" of theirs to force-play. Same location.search-dependent
  // pattern as the Listen Live handoff above, for the same reason.
  const handoffFeed = {
    [VIDEO_SECTIONS.PIGSKIN_FRENZY]: pigskinFeed,
    [VIDEO_SECTIONS.DENISHA]: denishaFeed,
    [VIDEO_SECTIONS.TVD_SHORTS]: tvdShortsFeed,
    [VIDEO_SECTIONS.CAPTURING_CHRISTIANITY]: capturingFeed,
    [VIDEO_SECTIONS.BEAT_ALLEN_PARR]: beatFeed,
    [VIDEO_SECTIONS.COLD_CASE_CHRISTIANITY]: coldCaseFeed,
    [VIDEO_SECTIONS.BIBLE_PROJECT]: bibleProjectFeed,
    [VIDEO_SECTIONS.GIVE_ME_AN_ANSWER]: giveMeAnAnswerFeed,
  }[SHOW_SLUG_TO_SECTION[new URLSearchParams(location.search).get("show")]];
  const processedShowRef = useRef(null);
  const [handoffNotice, setHandoffNotice] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const show = params.get("show");
    if (!hasPulseLayout || !show) return;
    const token = `${location.key}:${location.pathname}:${location.search}`;
    if (processedShowRef.current === token) return;
    const autoplay = params.get("autoplay") === "1";
    const section = SHOW_SLUG_TO_SECTION[show];
    const result = resolveShowHandoff(show, autoplay, section, handoffFeed);
    if (result.action === "wait") return;
    processedShowRef.current = token;
    setHandoffNotice(result.message || "");
    if (params.get("thanks")) setShowThanks(true);
    if (!autoplay && params.get("listen")) media.playRadio({ reconnect: true });
    if (result.action === "open") {
      openVideo(result.video);
    } else if (result.action === "browse") {
      document.getElementById("tv-connect-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    navigate(consumeHandoffQuery(location, ["show", "autoplay", "listen", "thanks"]), { replace: true, state: location.state });
  }, [location, hasPulseLayout, handoffFeed, openVideo, navigate, media]);

  // Observe the full in-flow player, not its top edge. Below-viewport cards
  // must not activate the dock; only a card entirely above the viewport does.
  useEffect(() => {
    const surface = surfaceRef.current;
    setIsFloatingPlayer(false);
    if (isExplore || !surface || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      const above = !entry.isIntersecting &&
        entry.boundingClientRect.height > 0 &&
        entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? 0);
      setIsFloatingPlayer((previous) => previous === above ? previous : above);
    }, { root: null, threshold: 0 });
    io.observe(surface);
    return () => io.disconnect();
  }, [location.pathname, isExplore]);
  return (
    <MediaCoordinationContext.Provider value={media}>
    <Routes>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/scroll" element={<ScrollFeed />} />
      <Route path="/scroll/:id" element={<ScrollFeed />} />
      <Route element={
        <div className="app-container tv-app tv-app--pulse">
          <PullToRefresh />

          {/* ── HEADER ── */}
          <header className="tv-header">
            <div className="tv-header-inner">
              <div className="tv-brand" aria-label="TrueVoice.Digital — Faithful Voices. Inspired Content.">
                <svg className="tv-brand-wave" viewBox="0 0 56 56" aria-hidden="true" focusable="false">
                  <defs>
                    <linearGradient id="tv-brand-blue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00d9eb" />
                      <stop offset="100%" stopColor="#0086ff" />
                    </linearGradient>
                  </defs>
                  <g fill="url(#tv-brand-blue)">
                    <rect x="2" y="23" width="7" height="14" rx="3.5" />
                    <rect x="13" y="16" width="7" height="28" rx="3.5" />
                    <rect x="24" y="8" width="7" height="42" rx="3.5" />
                    <rect x="35" y="0" width="7" height="56" rx="3.5" />
                    <rect x="46" y="10" width="7" height="38" rx="3.5" />
                  </g>
                </svg>
                <span className="tv-brand-copy">
                  <span className="tv-brand-wordmark">TrueVoice<span>.Digital</span></span>
                  <span className="tv-brand-tagline">Faithful Voices. Inspired Content.</span>
                </span>
              </div>

              <div className="tv-header-actions">
                <div
                  className="tv-social-row"
                  aria-label="TrueVoice social links"
                  style={{ pointerEvents: "auto", position: "relative", zIndex: 50 }}
                >
                  <SocialIconLink href={SOCIAL.youtube}   label="YouTube">   <YoutubeIcon />   </SocialIconLink>
                  <SocialIconLink href={SOCIAL.x}         label="X">         <XIcon />         </SocialIconLink>
                  <SocialIconLink href={SOCIAL.instagram} label="Instagram"> <InstagramIcon /> </SocialIconLink>
                  <SocialIconLink href={SOCIAL.facebook}  label="Facebook">  <FacebookIcon />  </SocialIconLink>
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


          <audio ref={playerRef} preload="metadata" playsInline />

          <main className="tv-main tv-main--pulse">

            {showThanks && (
              <div style={{
                margin: "14px auto 0", maxWidth: "1100px", padding: "12px 14px",
                borderRadius: "14px", background: "rgba(37,99,235,0.10)",
                border: "1px solid rgba(37,99,235,0.18)", fontWeight: 600,
              }}>
                Thank you for supporting TrueVoice Digital. Your gift is received.
              </div>
            )}

            <section className="pulse-listening" aria-labelledby="pulse-title">
              <PulseIntro />
              <div className={isExplore ? "pulse-radio-strip" : "tv-hero"}>
                <div className="tv-player-dock pulse-player-dock">
                  <div ref={surfaceRef} className="tv-player-surface">
                    <NowPlayingPanel
                      streamUrl={LIVE_STREAM_URL}
                      audioRef={playerRef}
                      onStatusChange={handleStatusChange}
                      isFloating={isFloatingPlayer}
                      compact={isExplore}
                      media={media}
                    />
                  </div>
                </div>

                <div className="tv-verse-card" hidden={isExplore}>
                  <VerseOfTheDay />
                </div>
              </div>
            </section>

            {handoffNotice && <p role="status">{handoffNotice}</p>}
            <Outlet context={{ discoveryChannels: [
              { id: VIDEO_SECTIONS.PIGSKIN_FRENZY, title: "Pigskin Frenzy", creator: "Joel Norris", feed: pigskinFeed },
              { id: VIDEO_SECTIONS.DENISHA, title: "Living the Reclaimed Life", creator: "Denisha Workizer", feed: denishaFeed },
              { id: VIDEO_SECTIONS.CAPTURING_CHRISTIANITY, title: "Capturing Christianity", creator: "Cameron Bertuzzi", feed: capturingFeed },
              { id: VIDEO_SECTIONS.BEAT_ALLEN_PARR, title: "The Beat by Allen Parr", creator: "Allen Parr", feed: beatFeed },
              { id: VIDEO_SECTIONS.COLD_CASE_CHRISTIANITY, title: "Cold Case Christianity", creator: "J. Warner Wallace", feed: coldCaseFeed },
              { id: VIDEO_SECTIONS.BIBLE_PROJECT, title: "BibleProject", creator: "BibleProject", feed: bibleProjectFeed },
              { id: VIDEO_SECTIONS.GIVE_ME_AN_ANSWER, title: "Give Me An Answer", creator: "Stuart & Cliffe Knechtle", feed: giveMeAnAnswerFeed },
            ], openChannel: openVideoForSection, openVideo, activeVideoId: videoOpen ? activeVideo?.youtubeId || activeVideo?.videoId : null }} />
            {!isExplore && <>
            <section className="pulse-featured" aria-labelledby="pulse-featured-title">
              <div className="pulse-featured__heading">
                <h2 id="pulse-featured-title">Featured / Discover</h2>
                <p>Fresh voices. Familiar favorites.</p>
              </div>
              <Hero />
            </section>

            {/* <RecentTracksBar /> */}

            <TrueVoiceScrollPreview />

            <section id="tv-connect-section" className="tv-section tv-section--stacked">
              <TrueVoiceConnect
                onWatchLive={()               => openVideoForSection(VIDEO_SECTIONS.WATCH_LIVE)}
                onPigskinFrenzy={()           => openVideoForSection(VIDEO_SECTIONS.PIGSKIN_FRENZY)}
                onDenisha={()                 => openVideoForSection(VIDEO_SECTIONS.DENISHA)}
onCapturingChristianity={()   => openVideoForSection(VIDEO_SECTIONS.CAPTURING_CHRISTIANITY)}
                onBeatAllenParr={()           => openVideoForSection(VIDEO_SECTIONS.BEAT_ALLEN_PARR)}
                onColdCaseChristianity={()    => openVideoForSection(VIDEO_SECTIONS.COLD_CASE_CHRISTIANITY)}
                onBibleProject={()            => openVideoForSection(VIDEO_SECTIONS.BIBLE_PROJECT)}
                onGiveMeAnAnswer={()          => openVideoForSection(VIDEO_SECTIONS.GIVE_ME_AN_ANSWER)}
              />
            </section>

            <section className="tv-section tv-section--stacked"><ReelsGrid /></section>
            <PodcastList />

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
                    href={IS_PREVIEW ? undefined : href}
                    aria-disabled={IS_PREVIEW || undefined}
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
            </>}

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
                  <SocialIconLink href={SOCIAL.facebook}  label="Facebook">  <FacebookIcon />  </SocialIconLink>
                </div>
              </div>

              <p>© {new Date().getFullYear()} TrueVoice.Digital. All rights reserved.</p>
              <p><a href="/privacy" style={{ color: "inherit" }}>Privacy Policy</a></p>
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

          <VideoModal open={videoOpen} onClose={closeVideo} video={activeVideo} iframeRef={videoIframeRef} queue={videoQueue} onAdvance={advanceVideo} />

          <ChimeIn />
        </div>
      }>
        <Route index element={null} />
        <Route path="explore" element={<PulseExplore />} />
        <Route path="*" element={null} />
      </Route>
    </Routes>
    </MediaCoordinationContext.Provider>
  );
}

export default App;
