// One bridge-backed player per nearby Scroll card. Only the active card may
// play/unmute; inactive and removed frames are explicitly muted and stopped.
// Keep the hosted real-origin bridge for native iOS compatibility.
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MediaCoordinationContext } from "../features/pulse/MediaCoordinationContext";

const EMBED_BASE = "https://truevoice.digital/yt-embed.html";
let sharedMuted = true;
let autoplayBlocked = false;
const muteListeners = new Set();
function setSharedMuted(next) {
  sharedMuted = next;
  muteListeners.forEach((listener) => listener(next));
}

function buildEmbedSrc({ videoId, clipStart, clipEnd }) {
  const params = new URLSearchParams({ v: videoId, start: String(clipStart || 0),
    autoplay: "0", mute: "1", controls: "0", rel: "0", modestbranding: "1" });
  if (clipEnd) params.set("end", String(clipEnd));
  return `${EMBED_BASE}?${params}`;
}

export function useYouTubePlayer({ containerRef, videoId, clipStart, clipEnd, isActive, onEnded }) {
  const media = useContext(MediaCoordinationContext);
  const iframeRef = useRef(null);
  const activeRef = useRef(isActive);
  const allowedRef = useRef(false);
  const readyRef = useRef(false);
  const endedRef = useRef(onEnded);
  const lastStateRef = useRef(null);
  const timersRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(sharedMuted);
  const [stuck, setStuck] = useState(false);
  const [errorCode, setErrorCode] = useState(null);

  useLayoutEffect(() => { activeRef.current = isActive; endedRef.current = onEnded; });
  const post = useCallback((type, extra = {}, iframe = iframeRef.current) => {
    iframe?.contentWindow?.postMessage({ source: "tvd-yt-embed-cmd", type, ...extra }, "*");
  }, []);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);
  const stopPlayer = useCallback(() => {
    allowedRef.current = false;
    clearTimers();
    post("mute");
    post("stop"); // Supported by the already-deployed native bridge.
  }, [clearTimers, post]);

  const playActive = useCallback(() => {
    if (!activeRef.current || !readyRef.current || !iframeRef.current) return;
    media?.startVideo(stopPlayer, playActive);
    allowedRef.current = true;
    clearTimers();
    lastStateRef.current = null;
    post(sharedMuted ? "mute" : "unmute");
    post("play");
    setStuck(false);
    const valid = () => activeRef.current && allowedRef.current && readyRef.current;
    timersRef.current = [
      setTimeout(() => {
        if (valid() && lastStateRef.current !== 1) post("play");
      }, 700),
      setTimeout(() => {
        if (!valid() || lastStateRef.current === 1) return;
        if (!sharedMuted) autoplayBlocked = true;
        setStuck(true);
      }, !sharedMuted && autoplayBlocked ? 150 : 1600),
    ];
  }, [media, stopPlayer, clearTimers, post]);

  useEffect(() => {
    const onChange = (next) => {
      setMuted(next);
      // Preference is shared; permission to produce sound is not.
      post(!next && activeRef.current && allowedRef.current ? "unmute" : "mute");
    };
    muteListeners.add(onChange);
    return () => muteListeners.delete(onChange);
  }, [post]);

  useLayoutEffect(() => {
    if (!containerRef.current || !videoId) return;
    readyRef.current = false;
    allowedRef.current = false;
    setReady(false);
    setErrorCode(null);
    lastStateRef.current = null;
    const iframe = document.createElement("iframe");
    iframe.src = buildEmbedSrc({ videoId, clipStart, clipEnd });
    Object.assign(iframe.style, { width: "100%", height: "100%", border: "0" });
    iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    iframe.title = "TrueVoice Scroll video";
    iframe.setAttribute("playsinline", "true");
    containerRef.current.appendChild(iframe);
    iframeRef.current = iframe;
    let alive = true;
    const onMessage = (event) => {
      if (!alive || event.source !== iframe.contentWindow || event.data?.source !== "tvd-yt-embed") return;
      const data = event.data;
      if (data.type === "ready") {
        readyRef.current = true;
        setReady(true);
        if (activeRef.current && allowedRef.current) playActive();
        else { post("mute"); post("stop"); }
      } else if (data.type === "stateChange") {
        lastStateRef.current = data.state;
        if (!activeRef.current || !allowedRef.current) {
          if (data.state === 1) { post("mute"); post("stop"); }
          return;
        }
        if (data.state === 1) { clearTimers(); setStuck(false); }
        if (data.state === 0) endedRef.current?.();
      } else if (data.type === "error") {
        clearTimers();
        setErrorCode(data.code);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      alive = false;
      stopPlayer();
      media?.endVideo(stopPlayer);
      post("mute", {}, iframe);
      post("stop", {}, iframe);
      window.removeEventListener("message", onMessage);
      readyRef.current = false;
      iframeRef.current = null;
      iframe.parentNode?.removeChild(iframe);
    };
  }, [containerRef, videoId, clipStart, clipEnd, media, playActive, post, stopPlayer, clearTimers]);

  // Layout cleanup deactivates the old card before the next player is activated.
  useLayoutEffect(() => {
    if (isActive && videoId) {
      if (readyRef.current) playActive();
      else {
        media?.startVideo(stopPlayer, playActive);
        allowedRef.current = true;
      }
    } else {
      stopPlayer();
      media?.endVideo(stopPlayer);
      setStuck(false);
    }
    return () => { stopPlayer(); media?.endVideo(stopPlayer); };
  }, [isActive, videoId, media, playActive, stopPlayer]);

  const toggleMute = () => {
    if (!activeRef.current || !iframeRef.current) return;
    setSharedMuted(!sharedMuted);
    if (!allowedRef.current || stuck) playActive();
  };
  return { ready, muted, toggleMute, stuck, resume: playActive, errorCode };
}
