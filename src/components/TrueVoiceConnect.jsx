// src/components/TrueVoiceConnect.jsx
import React from "react";

export default function TrueVoiceConnect({
  onWatchLive,
  onNewEpisodes,
  onShortsAndReels,
}) {
  const cards = [
    {
      id: "watch-live",
      label: "Watch Live",
      description: "Join the live studio stream when we're on air.",
      tag: "LIVE",
      onClick: onWatchLive,
      thumbnail: null, // no live video yet
    },
    {
      id: "new-episodes",
      label: "New Episodes",
      description: "Catch the latest episodes and messages.",
      tag: "NEW",
      onClick: onNewEpisodes,
      thumbnail: "https://img.youtube.com/vi/mESQkTA9AX0/maxresdefault.jpg",
    },
    {
      id: "shorts-reels",
      label: "Shorts & Reels",
      description: "Quick encouragement and stories of faith.",
      tag: "SHORTS",
      onClick: onShortsAndReels,
      thumbnail: "https://img.youtube.com/vi/qlpeKRAAPuI/maxresdefault.jpg",
    },
  ];

  const handleClick = (card) => {
    if (typeof card.onClick === "function") {
      card.onClick();
    }
  };

  return (
    <section className="tv-connect">
      <div className="tv-connect-header">
        <h2>TrueVoice Connect</h2>
        <p>Go deeper with live video, replays, and stories.</p>
      </div>

      <div className="tv-connect-scroller">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="tv-connect-card"
            onClick={() => handleClick(card)}
          >
            {/* Thumbnail area */}
            <div
              className="tv-connect-card-thumb"
              style={
                card.thumbnail
                  ? {
                      backgroundImage: `url(${card.thumbnail})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : {}
              }
            >
              <span className="tv-connect-play-icon">▶</span>
            </div>

            <div className="tv-connect-card-body">
              <div className="tv-connect-card-top">
                <span className="tv-connect-card-label">{card.label}</span>
                <span className="tv-connect-card-tag">{card.tag}</span>
              </div>
              <p className="tv-connect-card-description">{card.description}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}