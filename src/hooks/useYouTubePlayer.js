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

// Once a scroll-triggered (non-gesture) unmuted resume has actually been
// refused for this /scroll session, stop making every later card wait out
// the same nudge-then-check cycle before it can show the tap target --
// each new card is a brand-new YouTube iframe, so the same refusal is
// near-certain to repeat, and after a few cards that wait reads as "keeps
// stalling" rather than a fast, expected tap-to-continue pattern.
let autoplayBlocked = false;

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
  // True when this card is active but playback never actually started --
  // mobile browsers can silently refuse to resume/unmute a video that
  // wasn't kicked off by a direct tap (scrolling into view doesn't count
  // as a user gesture), leaving it looking frozen with our own controls
  // hidden (controls: 0) and no way to recover. `resume` below is a real
  // gesture-driven escape hatch for exactly that case.
  const [stuck, setStuck] = useState(false);
  // Updated from onStateChange as events actually arrive -- more reliable
  // for the stuck check than calling player.getPlayerState() cold, since
  // that call has to round-trip the postMessage bridge to the iframe.
  const lastStateRef = useRef(null);

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
    lastStateRef.current = null;

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
      // browser DOES allow with no gesture. Every player starts this way
      // and stays playing (muted) even while not the active card -- see
      // the onReady/isActive-effect comments below for why.
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
              // the time it's actually scrolled to. Deliberately NOT
              // pausing it: a paused player can only be resumed by a
              // playVideo() JS call with no user gesture behind it -- the
              // exact call mobile browsers are free to refuse, which is
              // what forced a manual tap on every card. A muted player
              // that's already playing needs no such resume call; going
              // active from here is just mute()/unMute(), which browsers
              // don't gate the way they gate starting playback. Just
              // confirm it's muted in case shared state changed between
              // iframe creation and this instant.
              playerRef.current.mute();
            }
          },
          onStateChange: (event) => {
            lastStateRef.current = event.data;
            if (event.data === YT.PlayerState.PLAYING) {
              setStuck(false);
            }
            if (event.data === YT.PlayerState.ENDED) {
              if (isActiveRef.current) {
                onEndedRef.current?.();
              } else {
                // A background near-card ran out its clip while sitting
                // off-screen -- loop it quietly rather than let it sit
                // stopped. A stopped player needs a real playVideo() call
                // to come back once this card finally goes active, and
                // that's the same gesture-less resume call we're avoiding
                // above.
                playerRef.current?.seekTo?.(clipStart || 0, true);
                playerRef.current?.playVideo?.();
              }
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

      // This activation was triggered by scrolling (IntersectionObserver),
      // not a tap -- some browsers (mobile especially, but desktop too in
      // practice) honor that for a muted resume but quietly refuse it, or
      // silently stall, for an unmuted one -- the player just sits there
      // (buffering forever, or not even that) with no error and no
      // feedback, since controls: 0 means there's no native play button
      // either. Rather than trust a single cold getPlayerState() read,
      // track state from onStateChange (lastStateRef) as it actually
      // arrives.
      if (!sharedMuted && autoplayBlocked) {
        // Already learned this session that an unmuted, gesture-less
        // resume gets refused -- don't make this card sit through the
        // same nudge-then-wait cycle just to land on the same answer.
        // Surface the tap target right away; if this attempt happens to
        // succeed anyway, the PLAYING event above clears it instantly.
        const check = setTimeout(() => {
          if (lastStateRef.current !== window.YT?.PlayerState?.PLAYING) {
            setStuck(true);
          }
        }, 150);
        return () => clearTimeout(check);
      }

      // Nudge once with another playVideo() call partway through in case
      // it just needs a second attempt, then if it still hasn't reached
      // PLAYING, surface a real tap target so the user always has a way
      // to recover instead of a frozen card -- and remember it for next
      // time so later cards skip straight to the tap target.
      const nudge = setTimeout(() => {
        if (lastStateRef.current !== window.YT?.PlayerState?.PLAYING) {
          playerRef.current?.playVideo?.();
        }
      }, 700);
      const check = setTimeout(() => {
        if (lastStateRef.current !== window.YT?.PlayerState?.PLAYING) {
          if (!sharedMuted) autoplayBlocked = true;
          setStuck(true);
        }
      }, 1600);
      return () => {
        clearTimeout(nudge);
        clearTimeout(check);
      };
    } else {
      setStuck(false);
      // Mute, don't pause -- see the onReady comment above. Keeping it
      // playing (muted, looping past its own clip end via the ENDED
      // handler above) means the *next* time this card goes active, that
      // transition is a mute()/unMute() call instead of a playVideo()
      // resume -- which is the operation mobile browsers can silently
      // refuse without a gesture. That refusal is what made every card
      // need a manual tap.
      playerRef.current.mute();
    }
  }, [isActive, ready]);

  // Real user gesture (a tap on the resume overlay) -- browsers that
  // blocked the programmatic unmute above will allow this one.
  const resume = () => {
    if (!playerRef.current) return;
    if (sharedMuted) playerRef.current.mute();
    else playerRef.current.unMute();
    playerRef.current.playVideo();
    setStuck(false);
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    setSharedMuted(!sharedMuted);
  };

  return { ready, muted, toggleMute, stuck, resume };
}
