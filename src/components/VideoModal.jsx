// src/components/VideoModal.jsx
import React, { useEffect } from "react";
import "./VideoModal.css";

export default function VideoModal({ open, onClose, video }) {
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
  const embedUrl =
    video.embedUrl ||
    (video.youtubeId
      ? `https://truevoice.digital/yt-embed.html?v=${video.youtubeId}&autoplay=1&mute=0`
      : null) ||
    (video.videoId
      ? `https://truevoice.digital/yt-embed.html?v=${video.videoId}&autoplay=1&mute=0`
      : null);

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
          <div className="tv-modal-video">
            <iframe
              src={embedUrl}
              title={title}
              frameBorder="0"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  );
}