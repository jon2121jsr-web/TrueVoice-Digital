// src/components/TrueVoiceConnect.jsx
import React from "react";

export default function TrueVoiceConnect({
  onWatchLive,
  onNewEpisodes,
  onShortsAndReels,
  onPigskinFrenzy,
  onChurchInShorts,
}) {
  const cards = [
    {
      id:          "watch-live",
      label:       "Watch Live",
      description: "Join the live studio stream when we're on air.",
      tag:         "LIVE",
      onClick:     onWatchLive,
      thumbnail:   null,
    },
    {
      id:          "new-episodes",
      label:       "New Episodes",
      description: "Catch the latest episodes and messages.",
      tag:         "NEW",
      onClick:     onNewEpisodes,
      thumbnail:   "https://img.youtube.com/vi/hIgy8zgcLH0/maxresdefault.jpg",
    },
    {
      id:          "shorts-reels",
      label:       "Shorts & Reels",
      description: "Quick encouragement and stories of faith.",
      tag:         "SHORTS",
      onClick:     onShortsAndReels,
      thumbnail:   "https://img.youtube.com/vi/BeUX5DGGj0s/maxresdefault.jpg",
    },
    {
      id:          "the-church-in-shorts",
      label:       "The Church in Shorts",
      description: "Real Truth. Real Church. In Short Video.",
      tag:         "SHORTS",
      onClick:     onChurchInShorts,
      thumbnail:   "/images/The-Church-Hero-2500x900-FULL__2_.png",
    },
    {
      id:          "pigskin-frenzy",
      label:       "Pigskin Frenzy",
      description: "The boldest takes in College Football. Unfiltered analysis. Unashamed faith.",
      tag:         "CFB",
      onClick:     onPigskinFrenzy,
      thumbnail:   "/images/Pigskin_Frenzy_Hero_Banner.png",
    },
    {
      id:          "scott-ryan-show",
      label:       "The Scott & Ryan Show",
      description: "Coming Soon — stay tuned.",
      tag:         "SOON",
      onClick:     null,
      thumbnail:   null,
    },
  ];

  const handleClick = (card) => {
    if (typeof card.onClick === "function") card.onClick();
  };

  return (
    <section className="tv-connect">
      <div className="tv-connect-header">
        <h2>TrueVoice Connect</h2>
        <p>Go deeper with live video, replays, and stories.</p>
      </div>

      {/* Wrap gives fade-edge scroll indicator */}
      <div className="tv-connect-scroller-wrap">
        <div className="tv-connect-scroller">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              className="tv-connect-card"
              onClick={() => handleClick(card)}
              aria-label={card.label}
            >
              <div
                className="tv-connect-card-thumb"
                style={
                  card.thumbnail
                    ? {
                        backgroundImage:    `url(${card.thumbnail})`,
                        backgroundSize:     "cover",
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
      </div>
    </section>
  );
}