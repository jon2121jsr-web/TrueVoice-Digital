// src/hooks/useYouTubePlayer.js
// Loads the YouTube IFrame Player API once (shared across every card) and
// gives one card a real player instance -- mute/pause/play are API calls,
// not src swaps, so position is preserved and clip_start/clip_end are
// native player params instead of URL hacks. Also reports onEnded, so a
// clip finishing can drive auto-advance to the next card.
import { useEffect, useRef, useState } from "react";

let apiPromise = null;

function loadYouTubeApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
  return apiPromise;
}

export function useYouTubePlayer({ containerRef, videoId, clipStart, clipEnd, isActive, onEnded }) {
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);

  // Keep the latest onEnded without re-creating the player when it changes
  // identity (ScrollFeed passes a fresh closure each render).
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  // Create the player once per videoId. clipStart/clipEnd are read at
  // creation time via native playerVars -- YouTube handles the clip
  // boundary itself, no manual seeking/polling required.
  //
  // IMPORTANT: YT.Player doesn't render *inside* the element you give it --
  // it replaces that element outright with its own <iframe>, invisibly to
  // React. If we handed it containerRef.current directly, React would later
  // try to remove a node that YouTube already swapped out from under it,
  // throwing "Failed to execute 'removeChild' on 'Node'" the first time a
  // card unmounts (e.g. scrolling a second video out of the isNear window).
  // Fix: React only ever owns containerRef.current itself. We create a
  // plain inner div, append it as a child, and hand THAT to YT.Player --
  // so only a node React never touches gets replaced/removed.
  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current || !videoId) return undefined;

    setReady(false);

    const mountNode = document.createElement("div");
    containerRef.current.appendChild(mountNode);

    const playerVars = {
      start: clipStart || 0,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      controls: 0,
    };
    if (clipEnd) playerVars.end = clipEnd;

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(mountNode, {
        videoId,
        playerVars,
        events: {
          onReady: () => {
            if (cancelled) return;
            playerRef.current.mute();
            setMuted(true);
            setReady(true);
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              onEndedRef.current?.();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch { /* already gone */ }
      playerRef.current = null;
      // destroy() already removes YouTube's iframe from the DOM in place
      // of mountNode; only clean mountNode up if it's still attached
      // (e.g. the API never finished loading before unmount).
      if (mountNode.parentNode) {
        mountNode.parentNode.removeChild(mountNode);
      }
    };
  }, [videoId]);

  // Play/pause tracks isActive via real API calls -- no remount, no
  // restart, playback position is preserved when a card scrolls back in.
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    if (isActive) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [isActive, ready]);

  const toggleMute = () => {
    if (!playerRef.current) return;
    setMuted((m) => {
      const next = !m;
      if (next) playerRef.current.mute();
      else playerRef.current.unMute();
      return next;
    });
  };

  return { ready, muted, toggleMute };
}
