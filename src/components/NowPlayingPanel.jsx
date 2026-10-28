// src/components/NowPlayingPanel.jsx
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IS_NATIVE_RADIO, nativeRadio } from "../lib/nativeRadio";
import { fetchNowPlaying } from "../services/api";
import { trackStreamPlay } from '../lib/analytics.js';
import { createMetadataTimeline, metadataDelaySeconds, METADATA_POLL_MS } from "../lib/metadataTimeline";
import { azuracastMetadataDelaySeconds, live365MetadataDelaySeconds, streamMetadataTiming } from "../lib/streamMetadataTiming.js";
import PulseLive from "../features/pulse/PulseLive.jsx";
import { observeRadioDiagnostics, radioDiagnostic, radioBufferState } from "../features/pulse/radioDiagnostics.js";
import { createLiveContinuityMonitor } from "../features/pulse/liveContinuity.js";
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
  const [playbackError,  setError]          = useState(null);
  const [metadataError, setMetadataError] = useState(null);
  const error = playbackError || metadataError;
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [listeners,      setListeners]      = useState(null);
  const [displaySong,    setDisplaySong]    = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const isOwner = useIsOwner();

  const STREAM_DELAY_SEC   = metadataDelaySeconds(import.meta.env.VITE_STREAM_DELAY_SEC);
  const LIVE365_METADATA_DELAY_SEC = live365MetadataDelaySeconds(import.meta.env.VITE_LIVE365_METADATA_DELAY_SEC);
  const AZURACAST_METADATA_DELAY_SEC = azuracastMetadataDelaySeconds(import.meta.env.VITE_AZURACAST_METADATA_DELAY_SEC, STREAM_DELAY_SEC);

  // ── All mutable tracking in refs so polling closure never goes stale ──────
  const metadataRef = useRef(null);
  const syncSourceTimingRef = useRef(null);
  const displaySongRef = useRef(null);
  useEffect(() => { displaySongRef.current = displaySong; }, [displaySong]);
  const isPlayingRef   = useRef(false);
  const wantsPlaybackRef = useRef(false); // user intent, shared by UI and Media Session
  const controllerRef = useRef(null);
  const watchdogRef = useRef(null);
  const playbackEpochRef = useRef(0);
  const streamUrlRef   = useRef(streamUrl);
  useEffect(() => { streamUrlRef.current = streamUrl; }, [streamUrl]);

  useEffect(() => observeRadioDiagnostics(audioRef?.current, () => ({
    wantsPlayback: wantsPlaybackRef.current,
    videoActive: media?.isVideoActive() ?? false,
  })), [audioRef, media]);

  /* ── Pre-warm stream connection on mount ───────────────────────────────── */
  // Sets src early so the browser opens the connection and begins buffering
  // before the user hits play — dramatically reduces cold-start delay.
  useEffect(() => {
    const el = audioRef?.current;
    if (IS_NATIVE_RADIO || !el || el.src) return;
    el.preload = "metadata";
    el.src = streamUrl;
  }, [audioRef, streamUrl]);

  /* ── Poll fresh AzuraCast metadata every 5 seconds ──────────────────────────────────── */
  useEffect(() => {
    if (IS_NATIVE_RADIO) return; // Native owns background-safe metadata polling.
    let alive = true;
    let inFlight = false;
    const timeline = createMetadataTimeline(STREAM_DELAY_SEC);
    metadataRef.current = timeline;
    const el = audioRef?.current;
    const syncSourceTiming = () => {
      if (!alive || !el?.currentSrc) return; // Keep timing during transient empties.
      const timing = streamMetadataTiming(el.currentSrc, STREAM_DELAY_SEC, LIVE365_METADATA_DELAY_SEC, AZURACAST_METADATA_DELAY_SEC);
      const nextSong = timeline.setDelay(timing.seconds);
      if (nextSong) setDisplaySong(nextSong);
    };
    const sourceEvents = ['loadstart', 'loadedmetadata', 'playing'];
    syncSourceTimingRef.current = syncSourceTiming;
    sourceEvents.forEach(event => el?.addEventListener(event, syncSourceTiming));
    syncSourceTiming();

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

        syncSourceTiming();
        const nextSong = timeline.observe(result.now_playing);
        if (nextSong) setDisplaySong(nextSong);

        setMetadataError(null);
        setLoading(false);
      } catch (err) {
        if (!alive) return;
        setMetadataError(err?.message || "Failed to load now playing.");
        setLoading(false);
      } finally {
        inFlight = false;
      }
    }

    load();
    const id = window.setInterval(load, METADATA_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
      sourceEvents.forEach(event => el?.removeEventListener(event, syncSourceTiming));
      if (metadataRef.current === timeline) {
        metadataRef.current = null;
        syncSourceTimingRef.current = null;
      }
    };
  }, [STREAM_DELAY_SEC, LIVE365_METADATA_DELAY_SEC, AZURACAST_METADATA_DELAY_SEC, audioRef]);

  /* ── 1-second tick — flip pending song when delay expires ─────────────── */
  useEffect(() => {
    if (IS_NATIVE_RADIO) return;
    const id = window.setInterval(() => {
      watchdogRef.current?.();
      syncSourceTimingRef.current?.();
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

  // AVPlayer snapshots are the sole authority on native iOS. No optimistic
  // HTML state or JS watchdog competes with native recovery/remote commands.
  useLayoutEffect(() => {
    if (!IS_NATIVE_RADIO) return;
    const controls = {
      play: ({ reconnect = false } = {}) => {
        media?.stopVideo();
        nativeRadio.play('radio', reconnect).catch(() => {});
        trackStreamPlay(displaySongRef.current?.title ?? 'TrueVoice Radio');
      },
      pause: () => nativeRadio.pause('radio').catch(() => {}),
    };
    controllerRef.current = controls;
    const unsubscribe = nativeRadio.subscribe(state => {
      const owns = state.owner === 'radio';
      const active = owns && state.wantsPlayback && !state.interrupted && !state.videoActive;
      isPlayingRef.current = active;
      wantsPlaybackRef.current = owns && state.wantsPlayback;
      setIsPlaying(active);
      setIsReconnecting(owns && state.buffering);
      setError(state.error ?? null);
      setMetadataError(state.metadataError ?? null);
      setLoading(state.revision < 0 && !state.error);
      if (state.metadata?.title) setDisplaySong(state.metadata);
      setListeners(state.listeners ?? null); // AzuraCast count, never Live365 reach.
    });
    const refresh = () => { if (!document.hidden) nativeRadio.refresh().catch(() => {}); };
    document.addEventListener('visibilitychange', refresh);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', refresh);
      if (controllerRef.current === controls) controllerRef.current = null;
      nativeRadio.pause('radio').catch(() => {});
    };
  }, [media]);

  // One watchdog shares the existing one-second metadata clock. No per-event
  // timers: waiting/stalled/online cannot stack reloads or reset the grace period.
  useLayoutEffect(() => {
    const el = audioRef?.current;
    if (IS_NATIVE_RADIO || !el) return;
    const STALL_MS = 12_000;
    const BACKOFF_MS = [5_000, 10_000];
    const MAX_RECOVERIES = 3;
    let mounted = true, started = false, buffering = false;
    let attempts = 0, lastProgress = performance.now(), lastTime = el.currentTime;
    let nextAttemptAt = null, pending = null, serial = 0;
    const continuity = createLiveContinuityMonitor();
    let staleReconnectUsed = false;
    const sameSource = (a, b) => {
      try { return new URL(a, 'https://truevoice.digital').href === new URL(b, 'https://truevoice.digital').href; }
      catch { return a === b; }
    };
    const eligible = () => mounted && wantsPlaybackRef.current && !media?.isVideoActive();
    const diagnostic = (event, details = {}) => radioDiagnostic(event, el, {
      epoch: playbackEpochRef.current, attempt: attempts, buffering,
      noProgressMs: Math.round(performance.now() - lastProgress), ...details,
    });
    const cancel = () => {
      continuity.reset();
      wantsPlaybackRef.current = false;
      playbackEpochRef.current += 1;
      pending = null;
      nextAttemptAt = null;
      attempts = 0;
      buffering = false;
      el.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
      setIsReconnecting(false);
    };
    const stop = message => {
      diagnostic('recovery-stop');
      cancel();
      setError(message);
    };
    const failedAttempt = () => {
      pending = null;
      if (attempts >= MAX_RECOVERIES) {
        stop('Stream unavailable. Tap to retry.');
        return;
      }
      nextAttemptAt = performance.now() + (attempts === 0 ? 0 : BACKOFF_MS[attempts - 1]);
      diagnostic('recovery-backoff', { delayMs: nextAttemptAt - performance.now() });
    };
    const invokePlay = (reason) => {
      const token = { id: ++serial, epoch: playbackEpochRef.current, at: performance.now() };
      pending = token;
      const current = () => eligible() && pending === token && token.epoch === playbackEpochRef.current;
      const rejected = failure => {
        if (!current()) return;
        // Names only: exception text can contain signed URLs or other secrets.
        const knownNames = ['NotAllowedError', 'AbortError', 'NotSupportedError', 'NetworkError', 'InvalidStateError', 'SecurityError', 'Error'];
        const name = knownNames.includes(failure?.name) ? failure.name : 'OtherError';
        const category = name === 'NotAllowedError' ? 'policy' : name === 'AbortError' ? 'aborted' : 'transport';
        diagnostic('play-rejected', { reason, rejectionName: name, category });
        if (category === 'policy') { stop('Tap Play to allow audio.'); return; }
        if (category === 'aborted') { stop('Playback interrupted. Tap Play to retry.'); return; }
        buffering = true;
        setIsReconnecting(true);
        failedAttempt();
      };
      try {
        const promise = el.play();
        promise?.catch(rejected);
      } catch (failure) { rejected(failure); }
    };
    const tick = () => {
      if (!eligible()) return;
      const now = performance.now();
      const time = el.currentTime;
      const { bufferedAhead } = radioBufferState(el);
      const progressed = !el.paused && !el.seeking && Number.isFinite(time) &&
        Number.isFinite(lastTime) && time > lastTime + 0.05 && (el.readyState ?? 2) >= 2;
      lastTime = time;
      const stale = continuity.sample(el, now, progressed);
      if (stale && !staleReconnectUsed && !pending && nextAttemptAt === null && !document.hidden) {
        // One live-window correction per deliberate Play, sharing the existing
        // recovery budget/command ownership. Never change source or seek.
        staleReconnectUsed = true;
        continuity.reset();
        attempts += 1;
        buffering = true;
        setIsReconnecting(true);
        diagnostic('recovery-load', { stallKind: 'stale-live-window' });
        el.load();
        lastTime = el.currentTime;
        lastProgress = now;
        invokePlay('recovery');
        return;
      }
      if (progressed) {
        const recovered = buffering || attempts > 0;
        lastProgress = now;
        buffering = false;
        attempts = 0;
        nextAttemptAt = null;
        pending = null; // Retire promises that settle after proven playback.
        setIsReconnecting(false);
        setError(null);
        setIsPlaying(true);
        isPlayingRef.current = true;
        if (recovered) diagnostic('recovery-progress');
        return;
      }
      // Readiness/buffer depletion explains starvation; an unchanged position
      // with available data can instead indicate a stuck decoding pipeline.
      // Both require the full no-progress grace period before any reload.
      const starved = el.readyState < 3 || bufferedAhead < 0.1;
      if (starved && now - lastProgress >= 2_000) {
        buffering = true;
        setIsReconnecting(true);
      }
      if (pending) {
        if (now - pending.at < STALL_MS) return;
        // load() on the next attempt aborts the retired native play. Its late
        // rejection cannot touch the replacement attempt or resurrect playback.
        diagnostic('play-timeout');
        failedAttempt();
        if (!eligible()) return;
      }
      if (now - lastProgress < STALL_MS || (nextAttemptAt !== null && now < nextAttemptAt)) return;
      if (attempts >= MAX_RECOVERIES) { stop('Stream unavailable. Tap to retry.'); return; }
      buffering = true;
      setIsReconnecting(true);
      attempts += 1;
      nextAttemptAt = null;
      diagnostic('recovery-load', { stallKind: starved ? 'starved' : 'no-progress' });
      continuity.reset();
      // Preserve the selected provider. Reconnecting the same URL is one
      // attempt, never an immediate primary/fallback pair for identical URLs.
      el.load();
      lastTime = el.currentTime;
      invokePlay('recovery');
    };
    const play = ({ reconnect = false } = {}) => {
      if (!mounted || (!reconnect && wantsPlaybackRef.current &&
        (!el.paused || pending || nextAttemptAt !== null))) return;
      media?.stopVideo();
      const resume = started;
      continuity.reset();
      staleReconnectUsed = false;
      playbackEpochRef.current += 1;
      wantsPlaybackRef.current = true;
      pending = null;
      attempts = 0;
      nextAttemptAt = null;
      buffering = true;
      lastProgress = performance.now();
      setError(null);
      setIsReconnecting(true);
      diagnostic('command-play', { reconnect });
      if (!el.src || (reconnect && !sameSource(el.src, streamUrlRef.current))) el.src = streamUrlRef.current;
      // Initial Play uses the prewarmed resource; deliberate resume/reconnect
      // requests a fresh live resource. Repeated ordinary Play does neither.
      if (resume || reconnect) el.load();
      lastTime = el.currentTime;
      started = true;
      isPlayingRef.current = true;
      setIsPlaying(true);
      invokePlay('command');
      trackStreamPlay(displaySongRef.current?.title ?? 'TrueVoice Radio');
    };
    const pause = () => { diagnostic('command-pause'); cancel(); };
    const onPlay = () => {
      if (!eligible()) { el.pause(); return; }
      isPlayingRef.current = true;
      setIsPlaying(true);
    };
    const onPause = () => { setIsPlaying(false); isPlayingRef.current = false; };
    const onBuffering = () => {
      if (!eligible()) return;
      buffering = true;
      setIsReconnecting(true);
    };
    const onVisibilityChange = () => {
      continuity.reset();
      if (document.hidden && el.paused) { pause(); return; }
      // Timers may have been throttled while hidden. Establish a fresh sample
      // before judging a stall; do not reload merely because time elapsed.
      lastProgress = performance.now();
      lastTime = el.currentTime;
    };
    const onOnline = () => { diagnostic('online'); tick(); };
    const listeners = { play: onPlay, pause: onPause, ended: onBuffering,
      waiting: onBuffering, stalled: onBuffering, error: onBuffering };
    Object.entries(listeners).forEach(([event, fn]) => el.addEventListener(event, fn));
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onBuffering);
    const controls = { play, pause };
    controllerRef.current = controls;
    watchdogRef.current = tick;
    return () => {
      mounted = false;
      cancel();
      if (controllerRef.current === controls) controllerRef.current = null;
      if (watchdogRef.current === tick) watchdogRef.current = null;
      Object.entries(listeners).forEach(([event, fn]) => el.removeEventListener(event, fn));
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onBuffering);
    };
  }, [audioRef, media]);

  const pauseRadio = useCallback(() => controllerRef.current?.pause(), []);
  const playRadio = useCallback(options => controllerRef.current?.play(options), []);


  useLayoutEffect(() => {
    const el = audioRef?.current;
    const detach = media?.attachRadio({ play: playRadio, pause: pauseRadio });
    // Capture the element: React may clear audioRef before unmount cleanup.
    // Browser pause is synchronous; native pause is serialized and owner-scoped.
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
