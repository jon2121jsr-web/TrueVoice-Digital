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

  // Support embedUrl, videoId, OR youtubeId (videoFeed uses youtubeId)
  const embedUrl =
    video.embedUrl ||
    (video.youtubeId
      ? `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0`
      : null) ||
    (video.videoId
      ? `https://www.youtube.com/embed/${video.videoId}?autoplay=1&rel=0`
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