// src/components/TrueVoiceConnect.jsx
import React from "react";

export default function TrueVoiceConnect({
  onWatchLive,
  onListenAgain,
  onMusicAndTestimonies,
}) {
  const cards = [
    {
      id: "watch-live",
      label: "Watch Live",
      description: "Join the live studio stream when we’re on air.",
      tag: "LIVE",
      onClick: onWatchLive,
    },
    {
      id: "listen-again",
      label: "Listen Again",
      description: "Catch replays of recent shows and messages.",
      tag: "REPLAY",
      onClick: onListenAgain,
    },
    {
      id: "music-testimonies",
      label: "Music & Testimonies",
      description: "Watch new music videos and stories of faith.",
      tag: "VIDEOS",
      onClick: onMusicAndTestimonies,
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
            <div className="tv-connect-card-icon">
              <span className="tv-connect-play-icon">▶</span>
            </div>

            <div className="tv-connect-card-body">
              <div className="tv-connect-card-top">
                <span className="tv-connect-card-label">
                  {card.label}
                </span>
                <span className="tv-connect-card-tag">
                  {card.tag}
                </span>
              </div>
              <p className="tv-connect-card-description">
                {card.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
