// src/components/TrueVoiceConnect.jsx
// ✅ RSS auto-thumbnails for TrueVoice channel and Pigskin Frenzy
// ✅ Church in Shorts pulls from dedicated playlist
// ✅ All cards open video modal on click
import React from "react";
import { useYouTubeLatest } from "../hooks/useYouTubeLatest";

const CHANNEL_IDS = {
  TRUEVOICE: "UCWpVof-rd5hs1xpchwj1MAQ",
  PIGSKIN:   "UC_khbgasHiiwUxPHOMfbR0A",
};

// The Cut with Erica playlist on TrueVoice channel
const CHURCH_PLAYLIST_ID = "PLPq8uhR5C2XRyO0tvkJpW18OeplMh3Ggc";

const FALLBACKS = {
  truevoice: "https://img.youtube.com/vi/hIgy8zgcLH0/maxresdefault.jpg",
  pigskin:   "https://img.youtube.com/vi/gC4VikZ0dcA/maxresdefault.jpg",
  church:    "/images/The-Church-Hero-2500x900-FULL__2_.png",
};

export default function TrueVoiceConnect({
  onNewEpisodes,
  onShortsAndReels,
  onPigskinFrenzy,
  onChurchInShorts,
}) {
  const tvLatest      = useYouTubeLatest({ channelId:  CHANNEL_IDS.TRUEVOICE });
  const pigskinLatest = useYouTubeLatest({ channelId:  CHANNEL_IDS.PIGSKIN });
  const churchLatest  = useYouTubeLatest({ playlistId: CHURCH_PLAYLIST_ID });

  const cards = [
    {
      id:          "new-episodes",
      label:       "New Episodes",
      description: "Catch the latest episodes and messages.",
      tag:         "NEW",
      onClick:     onNewEpisodes,
      thumbnail:   tvLatest.thumbnail      || FALLBACKS.truevoice,
    },
    {
      id:          "shorts-reels",
      label:       "Shorts & Reels",
      description: "Quick encouragement and stories of faith.",
      tag:         "SHORTS",
      onClick:     onShortsAndReels,
      thumbnail:   tvLatest.thumbnail      || FALLBACKS.truevoice,
    },
    {
      id:          "the-cut-with-erica",
      label:       "The Cut with Erica",
      description: "Real Truth. Real Church. In Short Video.",
      tag:         "SHORTS",
      onClick:     onChurchInShorts,
      thumbnail:   churchLatest.thumbnail  || FALLBACKS.church,
    },
    {
      id:          "pigskin-frenzy",
      label:       "Pigskin Frenzy",
      description: "The boldest takes in College Football. Unfiltered analysis. Unashamed faith.",
      tag:         "CFB",
      onClick:     onPigskinFrenzy,
      thumbnail:   pigskinLatest.thumbnail || FALLBACKS.pigskin,
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