// src/hooks/useYouTubePlayer.js
// Loads the YouTube IFrame Player API once (shared across every card) and
// gives one card a real player instance -- mute/pause/play are real
// commands, not src swaps, so position is preserved and clip_start/
// clip_end are native player params instead of URL hacks. Also reports
// onEnded, so a clip finishing can drive auto-advance to the next card.
//
// Real-origin proxy fix: this does NOT create a YT.Player directly inside
// the app's own page anymore. Apple's WKWebView cannot be configured to
// give the native app's own address a genuine https:// origin (that's a
// platform restriction -- see public/yt-embed.html for the full story),
// and YouTube's IFrame Player refuses to play when the origin it's handed
// doesn't match where the page truly is, which showed as YouTube's own
// "configuration error" no matter what origin parameter we claimed.
//
// Instead, each card is a plain <iframe> pointing at our own real page --
// actually hosted at https://truevoice.digital/yt-embed.html, a genuine
// https address -- which itself runs the real YT.Player and relays
// commands/events to and from us over postMessage. Everything below this
// point (mute state, active/inactive handling, stuck detection, clip
// looping) works exactly as it did before; only the transport to the
// actual player changed.
import { useEffect, useRef, useState } from "react";

const EMBED_BASE = "https://truevoice.digital/yt-embed.html";

// Raw YouTube IFrame Player API state codes (window.YT isn't loaded in
// the app's own page anymore -- only inside the proxy page -- so these
// are hardcoded instead of read off a YT global that no longer exists
// here). See https://developers.google.com/youtube/iframe_api_reference
const YT_STATE_ENDED = 0;
const YT_STATE_PLAYING = 1;

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
// each new card is a brand-new embed, so the same refusal is near-certain
// to repeat, and after a few cards that wait reads as "keeps stalling"
// rather than a fast, expected tap-to-continue pattern.
let autoplayBlocked = false;

function setSharedMuted(next) {
  sharedMuted = next;
  muteListeners.forEach((listener) => listener(next));
}

function buildEmbedSrc({ videoId, clipStart, clipEnd }) {
  const params = new URLSearchParams({
    v: videoId,
    start: String(clipStart || 0),
    autoplay: "1",
    // Always request muted on creation -- browsers/WKWebView reliably
    // allow a muted autoplay with no user gesture, which is what every
    // card needs the instant it's created (see the isActive-effect
    // comments below for why). Real mute state is brought up to date via
    // postMessage right after the "ready" message arrives.
    mute: "1",
    controls: "0",
    rel: "0",
    modestbranding: "1",
  });
  if (clipEnd) params.set("end", String(clipEnd));
  return `${EMBED_BASE}?${params.toString()}`;
}

export function useYouTubePlayer({ containerRef, videoId, clipStart, clipEnd, isActive, onEnded }) {
  const iframeRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(sharedMuted);
  // True when this card is active but playback never actually started --
  // mobile browsers can silently refuse to resume/unmute a video that
  // wasn't kicked off by a direct tap (scrolling into view doesn't count
  // as a user gesture), leaving it looking frozen with our own controls
  // hidden (controls: 0) and no way to recover. `resume` below is a real
  // gesture-driven escape hatch for exactly that case.
  const [stuck, setStuck] = useState(false);
  // TEMPORARY diagnostic (remove once the native "configuration error" is
  // resolved): captures YouTube's actual numeric error code relayed from
  // the proxy page, surfaced on-screen in FeedCard so we can see real
  // device data without Mac/Safari dev tools attached.
  const [errorCode, setErrorCode] = useState(null);
  // Updated from postMessage stateChange events as they actually arrive --
  // more reliable for the stuck check than any cold/synchronous read,
  // since everything now round-trips the iframe's postMessage bridge.
  const lastStateRef = useRef(null);

  // Keep the latest onEnded without re-creating the player when it changes
  // identity (ScrollFeed passes a fresh closure each render).
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  // Read inside the "ready" handler (which only runs once, at creation)
  // without retriggering the player-creation effect when isActive flips.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // A small facade so the rest of this hook can keep calling
  // player.mute()/.unMute()/.playVideo()/.seekTo() exactly as before --
  // each just posts the matching command to the proxy iframe instead of
  // calling the YT.Player API directly (which now lives inside that
  // iframe's own page, not here).
  function postCommand(type, extra) {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(Object.assign({ source: "tvd-yt-embed-cmd", type }, extra), "*");
  }
  const player = {
    mute: () => postCommand("mute"),
    unMute: () => postCommand("unmute"),
    playVideo: () => postCommand("play"),
    seekTo: (time) => postCommand("seekAndPlay", { time }),
  };

  // Stay in sync when mute is toggled from *any* card (including this
  // one, via toggleMute below) -- applies immediately to this card's own
  // player if it already exists, and to newly-created ones via the
  // "ready" handler.
  useEffect(() => {
    const onChange = (next) => {
      setMuted(next);
      if (iframeRef.current) {
        if (next) player.mute();
        else player.unMute();
      }
    };
    muteListeners.add(onChange);
    return () => muteListeners.delete(onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create the iframe once per videoId. clipStart/clipEnd are read at
  // creation time via the embed URL's own params -- the proxy page hands
  // them to YouTube as native playerVars, no manual seeking/polling
  // required.
  useEffect(() => {
    if (!containerRef.current || !videoId) return undefined;

    setReady(false);
    setErrorCode(null);
    lastStateRef.current = null;

    const iframe = document.createElement("iframe");
    iframe.src = buildEmbedSrc({ videoId, clipStart, clipEnd });
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    iframe.setAttribute("playsinline", "true");
    containerRef.current.appendChild(iframe);
    iframeRef.current = iframe;

    function onMessage(event) {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "tvd-yt-embed") return;

      if (data.type === "ready") {
        setReady(true);

        if (isActiveRef.current) {
          // This is the real slide the user is on. Autoplay already
          // started it muted; bring mute state up to the actual shared
          // choice and make sure it's playing.
          if (sharedMuted) player.mute();
          else player.unMute();
          player.playVideo();
        } else {
          // Not active yet -- autoplay (muted, via the embed URL) already
          // kicked off real buffering the instant the iframe loaded,
          // which is what a "near" card needs to be ready by the time
          // it's actually scrolled to. Deliberately NOT pausing it: a
          // paused player can only be resumed by a playVideo() call with
          // no user gesture behind it -- the exact call mobile browsers
          // are free to refuse, which is what forced a manual tap on
          // every card. A muted player that's already playing needs no
          // such resume call; going active from here is just mute()/
          // unMute(). Just confirm it's muted in case shared state
          // changed between iframe creation and this instant.
          player.mute();
        }
      } else if (data.type === "stateChange") {
        lastStateRef.current = data.state;
        if (data.state === YT_STATE_PLAYING) {
          setStuck(false);
        }
        if (data.state === YT_STATE_ENDED) {
          if (isActiveRef.current) {
            onEndedRef.current?.();
          } else {
            // A background near-card ran out its clip while sitting
            // off-screen -- loop it quietly rather than let it sit
            // stopped. A stopped player needs a real playVideo() call to
            // come back once this card finally goes active, and that's
            // the same gesture-less resume call we're avoiding above.
            player.seekTo(clipStart || 0);
          }
        }
      } else if (data.type === "error") {
        setErrorCode(data.code);
      }
    }

    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
      iframeRef.current = null;
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Play/pause tracks isActive via real commands -- no remount, no
  // restart, playback position is preserved when a card scrolls back in.
  useEffect(() => {
    if (!ready || !iframeRef.current) return undefined;
    if (isActive) {
      // A card that primed itself while merely "near" force-muted its
      // player to stay silent -- make sure real mute state is restored
      // before it actually plays, in case activation beat the priming
      // timeout to it.
      if (sharedMuted) player.mute();
      else player.unMute();
      player.playVideo();

      // This activation was triggered by scrolling (IntersectionObserver),
      // not a tap -- some browsers (mobile especially, but desktop too in
      // practice) honor that for a muted resume but quietly refuse it, or
      // silently stall, for an unmuted one -- the player just sits there
      // (buffering forever, or not even that) with no error and no
      // feedback, since controls: 0 means there's no native play button
      // either. Rather than trust a single cold state read, track state
      // from the postMessage stateChange events as they actually arrive.
      if (!sharedMuted && autoplayBlocked) {
        // Already learned this session that an unmuted, gesture-less
        // resume gets refused -- don't make this card sit through the
        // same nudge-then-wait cycle just to land on the same answer.
        // Surface the tap target right away; if this attempt happens to
        // succeed anyway, the PLAYING event above clears it instantly.
        const check = setTimeout(() => {
          if (lastStateRef.current !== YT_STATE_PLAYING) {
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
        if (lastStateRef.current !== YT_STATE_PLAYING) {
          player.playVideo();
        }
      }, 700);
      const check = setTimeout(() => {
        if (lastStateRef.current !== YT_STATE_PLAYING) {
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
      // Mute, don't pause -- see the "ready" handler comment above.
      // Keeping it playing (muted, looping past its own clip end via the
      // stateChange handler above) means the *next* time this card goes
      // active, that transition is a mute()/unMute() call instead of a
      // playVideo() resume -- which is the operation mobile browsers can
      // silently refuse without a gesture. That refusal is what made
      // every card need a manual tap.
      player.mute();
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, ready]);

  // Real user gesture (a tap on the resume overlay) -- browsers that
  // blocked the programmatic unmute above will allow this one.
  const resume = () => {
    if (!iframeRef.current) return;
    if (sharedMuted) player.mute();
    else player.unMute();
    player.playVideo();
    setStuck(false);
  };

  const toggleMute = () => {
    if (!iframeRef.current) return;
    setSharedMuted(!sharedMuted);
  };

  return { ready, muted, toggleMute, stuck, resume, errorCode };
}
