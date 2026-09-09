// src/hooks/useYouTubePlayer.js
// Loads the YouTube IFrame Player API once (shared across every card) and
// gives one card a real player instance -- mute/pause/play are API calls,
// not src swaps, so position is preserved and clip_start/clip_end are
// native player params instead of URL hacks. Also reports onEnded, so a
// clip finishing can drive auto-advance to the next card.
import { useEffect, useRef, useState } from "react";

let apiPromise = null;

// Shared across every card in the feed, not per-instance. Without this,
// each new player starts muted regardless of what the user chose on the
// previous card -- so unmuting felt like it never "stuck" as the feed
// scrolled. Once the user unmutes once, every current AND future player
// in this page session follows that choice.
let sharedMuted = true;
const muteListeners = new Set();

function setSharedMuted(next) {
  sharedMuted = next;
  muteListeners.forEach((listener) => listener(next));
}

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
  const [muted, setMuted] = useState(sharedMuted);

  // Keep the latest onEnded without re-creating the player when it changes
  // identity (ScrollFeed passes a fresh closure each render).
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  // Read inside onReady (which only runs once, at creation) without
  // retriggering the player-creation effect when isActive flips.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // Stay in sync when mute is toggled from *any* card (including this
  // one, via toggleMute below) -- applies immediately to this card's own
  // player if it already exists, and to newly-created ones via onReady.
  useEffect(() => {
    const onChange = (next) => {
      setMuted(next);
      if (playerRef.current) {
        if (next) playerRef.current.mute();
        else playerRef.current.unMute();
      }
    };
    muteListeners.add(onChange);
    return () => muteListeners.delete(onChange);
  }, []);

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
      // Mobile browsers block a JS-triggered playVideo() call that has no
      // user gesture behind it (which is exactly what our isActive effect
      // does when a card scrolls into view) -- that's why cards needed a
      // manual tap on mobile. A native autoplay+mute embed is treated the
      // same as <video muted autoplay playsinline>, which every mobile
      // browser DOES allow with no gesture. Every player starts this way;
      // onReady immediately pauses whichever ones aren't the active card.
      autoplay: 1,
      mute: 1,
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
            setMuted(sharedMuted);
            setReady(true);

            if (isActiveRef.current) {
              // This is the real slide the user is on. Autoplay already
              // started it muted; bring mute state up to the actual
              // shared choice and make sure it's playing.
              if (sharedMuted) playerRef.current.mute();
              else playerRef.current.unMute();
              playerRef.current.playVideo();
            } else {
              // Not active yet -- native autoplay (muted, via playerVars)
              // already kicked off real buffering the instant the iframe
              // loaded, which is what a "near" card needs to be ready by
              // the time it's actually scrolled to. Pause right away so
              // nothing is seen playing before its turn; YouTube keeps
              // buffering ahead regardless, so playVideo() resumes
              // instantly instead of starting cold once this card goes
              // active.
              playerRef.current.pauseVideo();
            }
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
      // A card that primed itself while merely "near" force-muted its
      // player to stay silent -- make sure real mute state is restored
      // before it actually plays, in case activation beat the priming
      // timeout to it.
      if (sharedMuted) playerRef.current.mute();
      else playerRef.current.unMute();
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [isActive, ready]);

  const toggleMute = () => {
    if (!playerRef.current) return;
    setSharedMuted(!sharedMuted);
  };

  return { ready, muted, toggleMute };
}
