// src/components/NowPlayingPanel.jsx
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fetchNowPlaying } from "../services/api";
import { trackStreamPlay } from '../lib/analytics.js';
import { createMetadataTimeline, metadataDelaySeconds, METADATA_POLL_MS } from "../lib/metadataTimeline";
import PulseLive from "../features/pulse/PulseLive.jsx";
import "./NowPlayingPanel.css";

function useIsOwner() {
  return useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("owner") === "true";
    } catch { return false; }
  }, []);
}

export function NowPlayingPanel({
  streamUrl,
  audioRef,
  onStatusChange,
  isFloating = false,
  compact = false,
  media,
}) {
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [listeners,      setListeners]      = useState(null);
  const [displaySong,    setDisplaySong]    = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const isOwner = useIsOwner();

  const STREAM_DELAY_SEC   = metadataDelaySeconds(import.meta.env.VITE_STREAM_DELAY_SEC);
  const AZURACAST_FALLBACK = "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

  // ── All mutable tracking in refs so polling closure never goes stale ──────
  const metadataRef = useRef(null);
  const displaySongRef = useRef(null);
  useEffect(() => { displaySongRef.current = displaySong; }, [displaySong]);
  const isPlayingRef   = useRef(false);
  const wantsPlaybackRef = useRef(false); // user intent, shared by UI and Media Session
  const recoveryTimerRef = useRef(null);
  const playbackEpochRef = useRef(0);
  const streamUrlRef   = useRef(streamUrl);
  useEffect(() => { streamUrlRef.current = streamUrl; }, [streamUrl]);

  /* ── Pre-warm stream connection on mount ───────────────────────────────── */
  // Sets src early so the browser opens the connection and begins buffering
  // before the user hits play — dramatically reduces cold-start delay.
  useEffect(() => {
    const el = audioRef?.current;
    if (!el || el.src) return;
    el.preload = "metadata";
    el.src = streamUrl;
  }, [audioRef, streamUrl]);

  /* ── Poll fresh AzuraCast metadata every 5 seconds ──────────────────────────────────── */
  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const timeline = createMetadataTimeline(STREAM_DELAY_SEC);
    metadataRef.current = timeline;

    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await fetchNowPlaying();
        if (!alive) return;

        const song = result?.now_playing?.song || null;

        const rawL = result?.listeners;
        if (rawL != null) {
          const c = typeof rawL === "object"
            ? (rawL.current ?? rawL.total ?? 0)
            : Number(rawL);
          setListeners(Number.isFinite(c) ? c : null);
        }

        if (!song?.title) { if (alive) setLoading(false); return; }

        const nextSong = timeline.observe(result.now_playing);
        if (nextSong) setDisplaySong(nextSong);

        setError(null);
        setLoading(false);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Failed to load now playing.");
        setLoading(false);
      } finally {
        inFlight = false;
      }
    }

    load();
    const id = window.setInterval(load, METADATA_POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [STREAM_DELAY_SEC]);

  /* ── 1-second tick — flip pending song when delay expires ─────────────── */
  useEffect(() => {
    const id = window.setInterval(() => {
      const nextSong = metadataRef.current?.tick();
      if (nextSong) setDisplaySong(nextSong);
    }, 1_000);
    return () => window.clearInterval(id);
  }, []);

  /* ── Derived display values ────────────────────────────────────────────── */
  const title  = displaySong?.title  || (loading ? "Loading…" : "Live Stream");
  const artist = displaySong?.artist || "TrueVoice Digital";
  const album  = displaySong?.album  || "TrueVoice Digital";
  const art    = displaySong?.art    || null;

  /* ── Notify app (MediaSession) ─────────────────────────────────────────── */
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; });

  useEffect(() => {
    if (typeof onStatusChangeRef.current !== "function") return;
    onStatusChangeRef.current({
      isLive:      !!isPlaying && !error,
      hasError:    !!error,
      isLoading:   !!loading,
      station:     "TrueVoice Radio",
      now_playing: { song: { title, artist, album, art } },
      listeners:   listeners ?? undefined,
    });
  }, [isPlaying, error, loading, title, artist, album, art, listeners]);

  /* ── Audio element events ──────────────────────────────────────────────── */
  useEffect(() => {
    const el = audioRef?.current;
    if (!el) return;

    // Single-flight recovery timer — error/stalled/online can all fire within
    // milliseconds of the same hiccup. Only one reload attempt is ever in
    // flight at a time, so they can't stack and repeatedly .load() the
    // element (each .load() drops the buffer and can itself trigger another
    // "stalled", which was causing the reconnect storm behind the pausing).
    const clearRecoveryTimer = () => {
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    };
    const scheduleRecovery = (delayMs) => {
      if (!wantsPlaybackRef.current || recoveryTimerRef.current) return;
      recoveryTimerRef.current = setTimeout(() => {
        recoveryTimerRef.current = null;
        if (!wantsPlaybackRef.current || !el.paused) return;
        const epoch = playbackEpochRef.current;
        const onFallback = el.src.includes(AZURACAST_FALLBACK);
        if (!onFallback) el.src = streamUrlRef.current;
        el.load();
        el.play().catch(() => {
          if (!wantsPlaybackRef.current || epoch !== playbackEpochRef.current) return;
          el.src = AZURACAST_FALLBACK;
          el.load();
          el.play().catch(() => {
            if (!wantsPlaybackRef.current || epoch !== playbackEpochRef.current) return;
            setError("Stream unavailable. Tap to retry.");
            setIsPlaying(false);
            isPlayingRef.current = false;
          });
        });
      }, delayMs);
    };

    const onPlay = () => {
      // A pending play promise must not resurrect radio after a video handoff.
      if (!wantsPlaybackRef.current) { el.pause(); return; }
      setIsPlaying(true);
      isPlayingRef.current = true;
    };
    const onPause = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
    };
    const onEnded = () => { setIsPlaying(false); isPlayingRef.current = false; };

    // Any error/stall funnels into the same debounced recovery — no more
    // separate immediate + delayed attempts racing each other.
    const onError = () => {
      if (!isPlayingRef.current && !wantsPlaybackRef.current) return;
      scheduleRecovery(3000);
    };
    const onStalled = () => {
      if (!wantsPlaybackRef.current) return;
      scheduleRecovery(3000);
    };

    // Reconnecting indicator while buffering
    const onWaiting = () => { setIsReconnecting(true); };
    const onPlaying = () => { setIsReconnecting(false); clearRecoveryTimer(); };

    // Phone call / audio focus recovery + interruption detection
    const onVisibilityChange = () => {
      if (document.hidden && el.paused) {
        // Backgrounded while paused (phone call, screen lock, app switch) —
        // stand down so nothing auto-resumes playback into the interruption.
        // User must tap Play to resume.
        wantsPlaybackRef.current = false;
        clearRecoveryTimer();
        return;
      }
      if (
        document.visibilityState === "visible" &&
        wantsPlaybackRef.current &&
        el.paused
      ) {
        el.play().catch(() => {});
      }
    };

    // Network drop/restore recovery (WiFi<->cellular handoff, dead zones).
    // `online` often fires when a silent stall never produced an "error" event.
    const onOnline = () => {
      // Connection restored — if playback survived the blip, clear the indicator.
      // Must run BEFORE the paused guard, else a never-paused element stays
      // stuck on "Reconnecting…" forever.
      setIsReconnecting(false);
      if (!wantsPlaybackRef.current || !el.paused) return; // only if user wants playback
      clearRecoveryTimer(); // supersede any pending debounced attempt — retry now
      const epoch = playbackEpochRef.current;
      setIsReconnecting(true);
      el.src = streamUrlRef.current; // primary first
      el.load();
      el.play().catch(() => {
        if (!wantsPlaybackRef.current || epoch !== playbackEpochRef.current) return;
        el.src = AZURACAST_FALLBACK; // then fallback
        el.load();
        el.play().catch(() => {});
      });
    };
    const onOffline = () => { if (wantsPlaybackRef.current) setIsReconnecting(true); };

    el.addEventListener("play",    onPlay);
    el.addEventListener("pause",   onPause);
    el.addEventListener("ended",   onEnded);
    el.addEventListener("error",   onError);
    el.addEventListener("stalled", onStalled);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      clearRecoveryTimer();
      el.removeEventListener("play",    onPlay);
      el.removeEventListener("pause",   onPause);
      el.removeEventListener("ended",   onEnded);
      el.removeEventListener("error",   onError);
      el.removeEventListener("stalled", onStalled);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("playing", onPlaying);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [audioRef]);

  /* ── Shared controller commands: no second state or audio element ─────── */
  const pauseRadio = useCallback(() => {
    wantsPlaybackRef.current = false;
    playbackEpochRef.current += 1;
    window.clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = null;
    audioRef?.current?.pause();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsReconnecting(false);
  }, [audioRef]);

  const playRadio = useCallback(({ reconnect = false } = {}) => {
    const el = audioRef?.current;
    if (!el) return;
    try {
        media?.stopVideo();
        window.clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
        setError(null);
        wantsPlaybackRef.current = true; // user wants playback
        const epoch = ++playbackEpochRef.current;
        // Always reload the live stream src before playing to snap to
        // the live edge — prevents the stale-buffer glitch after pause.
        const currentSrc = el.src;
        if (reconnect || !currentSrc || (!currentSrc.includes("live365") && !currentSrc.includes("truevoice"))) {
          el.src = streamUrlRef.current;
        }
        el.load();
        const p = el.play();
        trackStreamPlay(displaySongRef.current?.title ?? 'TrueVoice Radio');
        if (p?.catch) p.catch(() => {
          if (!wantsPlaybackRef.current || epoch !== playbackEpochRef.current) return;
          if (reconnect) {
            el.src = AZURACAST_FALLBACK;
            el.load();
            el.play().catch(() => {
              if (!wantsPlaybackRef.current || epoch !== playbackEpochRef.current) return;
              setError("Tap again to start audio.");
              setIsPlaying(false);
            });
            return;
          }
          setError("Tap again to start audio.");
          setIsPlaying(false);
        });
        setIsPlaying(true);
    } catch {
      setError("Tap again to start audio.");
      setIsPlaying(false);
    }
  }, [audioRef, media, AZURACAST_FALLBACK]);

  useLayoutEffect(() => {
    const el = audioRef?.current;
    const detach = media?.attachRadio({ play: playRadio, pause: pauseRadio });
    // Capture the element: React may clear audioRef before unmount cleanup.
    // Stop radio synchronously before Scroll's next player can be activated.
    return () => { pauseRadio(); el?.pause(); detach?.(); };
  }, [audioRef, media, playRadio, pauseRadio]);

  const handleTogglePlay = () => {
    if (isPlayingRef.current) pauseRadio();
    else playRadio();
  };

  return (
    <PulseLive
      title={title}
      artist={artist}
      art={art}
      isPlaying={isPlaying}
      isReconnecting={isReconnecting}
      loading={loading}
      error={error}
      onTogglePlay={handleTogglePlay}
      isFloating={isFloating}
      compact={compact}
      listeners={isOwner ? listeners : null}
    />
  );
}
