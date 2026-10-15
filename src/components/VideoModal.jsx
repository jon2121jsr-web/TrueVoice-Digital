// src/components/VideoModal.jsx
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import VideoThumbnail from "./VideoThumbnail";
import { createEndedGuard, videoId } from "../features/pulse/videoQueue";
import { exploreShareUrl, isLocallyLiked, setLocalLike } from "../features/pulse/videoEngagement";
import "./VideoModal.css";
import { withVideoControls } from "../lib/videoEmbed";
import { videoDiagnostic, diagnosticEmbed } from "../features/pulse/videoDiagnostics";
import { playbackProgress, createPositionObserver } from "../features/pulse/videoProgress";

export default function VideoModal({ open, onClose, video, iframeRef, queue, onAdvance }) {
  const localIframeRef = useRef(null);
  const playerRef = iframeRef || localIframeRef;
  const [playerStatus, setPlayerStatus] = useState("Loading video…");
  const playRequestedRef = useRef(false);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const autoplayNextRef = useRef(true);
  const playbackContextRef = useRef({ queue, onAdvance });
  // Callback/location changes must not reset a ready player's lifecycle.
  useLayoutEffect(() => { playbackContextRef.current = { queue, onAdvance }; });
  const [liked, setLiked] = useState(false);
  const [engagementStatus, setEngagementStatus] = useState("");
  const [copyLink, setCopyLink] = useState("");
  const [progress, setProgress] = useState(null);
  const [repeatGuidance, setRepeatGuidance] = useState(false);
  useEffect(() => {
    setLiked(isLocallyLiked(videoId(video)));
    setEngagementStatus("");
    setCopyLink("");
  }, [video]);
  useEffect(() => {
    autoplayNextRef.current = true;
    setAutoplayNext(true);
  }, [queue?.sessionId]);
  const sendPlay = () => {
    const frame = playerRef.current;
    if (!frame?.contentWindow) return;
    videoDiagnostic("commands", { id: videoId(video), commands: ["unmute", "play"], reason: "explicit-play" });
    frame.contentWindow.postMessage({ source: "tvd-yt-embed-cmd", type: "unmute" }, "*");
    frame.contentWindow.postMessage({ source: "tvd-yt-embed-cmd", type: "play" }, "*");
  };
  useLayoutEffect(() => {
    setRepeatGuidance(false);
    if (!open || !video) return;
    const frame = playerRef.current;
    videoDiagnostic("listener-attach", { id: videoId(video), queueIndex: playbackContextRef.current.queue?.index, embed: diagnosticEmbed(frame?.src), allow: frame?.allow });
    let alive = true;
    const genuinelyEnded = createEndedGuard();
    const positionObserver = createPositionObserver();
    const summary = { id: videoId(video), ready: false, sawPlaying: false, sawEnded: false, resets: 0 };
    let guidanceShown = false;
    setPlayerStatus("Loading video…");
    setProgress(null);
    playRequestedRef.current = true;
    const onMessage = (event) => {
      const { queue: currentQueue, onAdvance: advance } = playbackContextRef.current;
      if (event.data?.source === "tvd-yt-embed") videoDiagnostic("bridge-event", {
        id: videoId(video), type: event.data.type, state: event.data.state, error: event.data.code,
        alive, capturedSource: event.source === frame?.contentWindow, currentSource: event.source === playerRef.current?.contentWindow,
      });
      if (!alive || event.source !== frame?.contentWindow || event.source !== playerRef.current?.contentWindow || event.data?.source !== "tvd-yt-embed") return;
      if (event.data.type === "ready") {
        summary.ready = true;
        if (!playRequestedRef.current) {
          videoDiagnostic("duplicate-ready-ignored", { id: videoId(video) });
          return;
        }
        setPlayerStatus("Requesting playback. If your browser blocks it, press Play.");
        if (playRequestedRef.current) {
          videoDiagnostic("commands", { id: videoId(video), commands: ["unmute", "play"], reason: "ready" });
          const win = playerRef.current?.contentWindow;
          win?.postMessage({ source: "tvd-yt-embed-cmd", type: "unmute" }, "*");
          win?.postMessage({ source: "tvd-yt-embed-cmd", type: "play" }, "*");
          playRequestedRef.current = false;
        }
      } else if (event.data.type === "stateChange") {
        const state = event.data.state;
        if (state === 1) summary.sawPlaying = true;
        if (state === 0) summary.sawEnded = true;
        if (state === 1) setPlayerStatus("Playing");
        if (state === 2) setPlayerStatus("Paused. Press Play to continue.");
        if (state === -1 || state === 5) setPlayerStatus("Press Play to start this video if autoplay is blocked.");
        if (genuinelyEnded(state)) {
          playRequestedRef.current = false;
          videoDiagnostic("ended", { id: videoId(video), autoplayNext: autoplayNextRef.current, queueIndex: currentQueue?.index });
          setPlayerStatus(currentQueue && currentQueue.index === currentQueue.videos.length - 1 ? "End of collection." : "Video ended.");
          if (currentQueue && currentQueue.index < currentQueue.videos.length - 1 && autoplayNextRef.current) {
            videoDiagnostic("automatic-next-request", { id: videoId(video), nextId: videoId(currentQueue.videos[currentQueue.index + 1]) });
            advance?.(1, videoId(video));
          }
        }
      }
      else if (event.data.type === "progress" && event.data.videoId === videoId(video)) {
        setProgress(playbackProgress(event.data));
        const reset = positionObserver(event.data);
        if (reset) {
          summary.resets += 1;
          videoDiagnostic("position-reset", { id: videoId(video), ...reset });
          // A seek or replay can look identical. Offer conditional guidance only;
          // neither the reset nor this message is a completion/advancement signal.
          const start = Math.max(0, Number(event.data.start) || 0);
          if (!guidanceShown && summary.sawPlaying && !summary.sawEnded && reset.nearEnd &&
            reset.to >= start && reset.to <= start + 1 && [1, 3].includes(event.data.state) &&
            currentQueue && currentQueue.index < currentQueue.videos.length - 1) {
            guidanceShown = true;
            setRepeatGuidance(true);
          }
        }
      }
      else if (event.data.type === "autoplayBlocked") setPlayerStatus("Your browser blocked autoplay. Press Play to start this video.");
      else if (event.data.type === "commandReceived") videoDiagnostic("bridge-command-received", { id: videoId(video), command: event.data.command, executed: event.data.executed === true });
      else if (event.data.type === "error") setPlayerStatus(`Video unavailable (YouTube error ${event.data.code}).`);
    };
    window.addEventListener("message", onMessage);
    return () => { videoDiagnostic("transition-summary", summary); videoDiagnostic("listener-detach", { id: videoId(video), connected: frame?.isConnected }); alive = false; playRequestedRef.current = false; window.removeEventListener("message", onMessage); };
  }, [open, video, playerRef]);
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !video) return null;

  const title = video.title || "Video";
  const description = video.description || "";

  // Support embedUrl, videoId, OR youtubeId (videoFeed uses youtubeId).
  //
  // Real-origin proxy fix: iOS can't make the native app's own address a
  // genuine https:// origin (Apple platform restriction on WKWebView, not
  // a config we can flip -- see public/yt-embed.html for the full
  // explanation), so YouTube rejected a direct embed no matter what
  // origin parameter we claimed, showing their own "configuration error"
  // page instead of the video. This points at our own real page instead,
  // which itself embeds YouTube from a genuine https origin. mute=0
  // because opening this modal IS the user's play gesture -- they expect
  // sound, unlike a passive background preview.
  const embedUrl = withVideoControls(
    video.embedUrl ||
    (video.youtubeId
      ? `https://truevoice.digital/yt-embed.html?v=${video.youtubeId}&autoplay=1&mute=0`
      : null) ||
    (video.videoId
      ? `https://truevoice.digital/yt-embed.html?v=${video.videoId}&autoplay=1&mute=0`
      : null), { progress: !!queue });

  if (!embedUrl) return null;

  const stop = (e) => e.stopPropagation();

  return (
    <div className="tv-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tv-modal" onClick={stop}>
        <div className="tv-modal-header">
          <div className="tv-modal-title-wrap">
            <div className="tv-modal-title">{title}</div>
            {description ? <div className="tv-modal-subtitle">{description}</div> : null}
          </div>

          <button className="tv-modal-close" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="tv-modal-body">
          <div className="tv-modal-playback">
            <button type="button" className="tv-modal-close" onClick={() => {
              playRequestedRef.current = true;
              sendPlay();
              setPlayerStatus("Starting video… If playback is blocked, use the player’s Play control.");
            }}>Play video</button>
            <span role="status">{playerStatus}</span>
          </div>
          <div className="tv-modal-video">
            <iframe
              ref={playerRef}
              key={video.youtubeId || video.videoId || video.embedUrl}
              src={embedUrl}
              title={title}
              frameBorder="0"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              onLoad={() => videoDiagnostic("iframe-load", { id: videoId(video), embed: diagnosticEmbed(embedUrl) })}
            />
          </div>
          {queue && <div className="tv-modal-queue" aria-label="EXPLORE video collection">
            <div className="tv-modal-queue__controls">
              <button type="button" disabled={queue.index === 0} onClick={() => onAdvance(-1, videoId(video))}>Previous video</button>
              <span aria-live="polite">{queue.index + 1} of {queue.videos.length}</span>
              <button type="button" className="tv-modal-queue__advance" aria-describedby={repeatGuidance ? "pulse-repeat-guidance" : undefined} disabled={queue.index === queue.videos.length - 1} onClick={() => onAdvance(1, videoId(video))}>
                Next video
                {progress !== null && <span className="tv-modal-queue__progress" aria-hidden="true" style={{ width: `${progress * 100}%` }} />}
              </button>
              <label><input type="checkbox" checked={autoplayNext} onChange={event => {
                autoplayNextRef.current = event.target.checked;
                setAutoplayNext(event.target.checked);
              }} /> Autoplay Next</label>
            </div>
            {repeatGuidance && <p id="pulse-repeat-guidance" className="tv-modal-queue__guidance">If this video repeats, tap Next to keep watching.</p>}
            {queue.videos[queue.index + 1] && <button type="button" className="tv-modal-queue__next" onClick={() => onAdvance(1, videoId(video))}>
              <VideoThumbnail src={queue.videos[queue.index + 1].thumbnailUrl} videoId={videoId(queue.videos[queue.index + 1])} />
              <span><small>UP NEXT</small>{queue.videos[queue.index + 1].title || "Next video"}</span>
            </button>}
          </div>}
        </div>
          {queue && <div className="tv-modal-playback" aria-label="TrueVoice engagement">
            <button type="button" className="tv-modal-close" aria-pressed={liked} onClick={() => {
              try { setLocalLike(videoId(video), !liked); setLiked(!liked); setEngagementStatus("Preference stored on this device only."); }
              catch { setEngagementStatus("Local storage is unavailable; Like could not be saved."); }
            }}>{liked ? "Liked" : "Like"} · This device only</button>
            <button type="button" className="tv-modal-close" onClick={async () => {
              const url = exploreShareUrl(videoId(video));
              try {
                if (navigator.share) { await navigator.share({ title, url }); setEngagementStatus("Share completed."); }
                else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setEngagementStatus("TrueVoice link copied."); }
                else setCopyLink(url);
              } catch (error) { if (error.name !== "AbortError") setCopyLink(url); }
            }}>Share on TrueVoice</button>
            <a href={`https://www.youtube.com/watch?v=${videoId(video)}`} target="_blank" rel="noreferrer">Original on YouTube</a>
            <span role="status">{engagementStatus}</span>
            {copyLink && <label>Copy TrueVoice link <input readOnly value={copyLink} onFocus={event => event.target.select()} /></label>}
          </div>}
      </div>
    </div>
  );
}
