// src/components/ReelsGrid.jsx
import { useState } from "react";
import { GMAA_REELS } from "../data/gmaaReels";
import { BIBLEPROJECT_REELS } from "../data/bibleProjectReels";
import "./ReelsGrid.css";

function ReelsGrid() {
  const [activeVideo, setActiveVideo] = useState(null);

  const handleOpen = (video) => {
    setActiveVideo(video);
  };

  const handleClose = () => {
    setActiveVideo(null);
  };

  const renderChannel = (channelTitle, items) => (
    <section className="reels-channel" key={channelTitle}>
      <div className="reels-channel-header">
        <h3 className="reels-channel-title">{channelTitle}</h3>
        <span className="reels-channel-count">
          {items.length} video{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="reels-grid">
        {items.map((item) => (
          <button
            key={item.id}
            className="reel-card"
            type="button"
            onClick={() => handleOpen(item)}
          >
            <div className="reel-thumb-wrap">
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="reel-thumb"
              />
              <div className="reel-play-pill">Watch</div>
            </div>
            <div className="reel-meta">
              <h4 className="reel-title">{item.title}</h4>
              <p className="reel-speaker">
                {item.speaker} • <span className="reel-topic">{item.topic}</span>
              </p>
              {item.source && (
                <p className="reel-source">Source: {item.source}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <section className="tv-section">
      <h2 className="tv-section-title">TrueVoice Reels</h2>
      <p className="reels-intro">
        Short-form, high-impact teaching and Q&amp;A content from trusted voices.
      </p>

      {renderChannel("Give Me an Answer", GMAA_REELS)}
      {renderChannel("BibleProject", BIBLEPROJECT_REELS)}

      {activeVideo && (
        <div className="reel-modal-backdrop" onClick={handleClose}>
          <div
            className="reel-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="reel-modal-header">
              <div>
                <h3 className="reel-modal-title">{activeVideo.title}</h3>
                <p className="reel-modal-subtitle">
                  {activeVideo.speaker}
                  {activeVideo.topic ? ` • ${activeVideo.topic}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="reel-modal-close"
                onClick={handleClose}
              >
                ×
              </button>
            </header>

            <div className="reel-modal-body">
              <div className="reel-modal-video-wrapper">
                <iframe
                  src={activeVideo.embedUrl}
                  title={activeVideo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              {activeVideo.description && (
                <p className="reel-modal-description">
                  {activeVideo.description}
                </p>
              )}
              {activeVideo.videoUrl && (
                <a
                  href={activeVideo.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="reel-modal-link"
                >
                  View on YouTube ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ReelsGrid;
