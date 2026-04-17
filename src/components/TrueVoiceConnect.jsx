// src/components/TrueVoiceConnect.jsx
// ✅ All cards open video modal on click
// ✅ Capturing Christianity, The Beat by Allen Parr, Cold Case Christianity added April 2026
// ✅ The Cut with Erica removed April 2026
// ✅ New Episodes and Shorts & Reels removed April 2026 (re-enable when needed)
import React from "react";
import { useYouTubeLatest } from "../hooks/useYouTubeLatest";

const CHANNEL_IDS = {
  PIGSKIN:                "UC_khbgasHiiwUxPHOMfbR0A",
  CAPTURING_CHRISTIANITY: "UCux-_Fze30tFuI_5CArwSmg",
  BEAT_ALLEN_PARR:        "UCm_RMW_fQk-ELpPYUzor8lw",
  COLD_CASE_CHRISTIANITY: "UCVFe7xhG6rl0ruoMQCJDtnw",
};

const FALLBACKS = {
  pigskin:               "https://img.youtube.com/vi/gC4VikZ0dcA/maxresdefault.jpg",
  capturingChristianity: "https://img.youtube.com/vi/default/maxresdefault.jpg",
  beatAllenParr:         "https://img.youtube.com/vi/default/maxresdefault.jpg",
  coldCase:              "https://img.youtube.com/vi/default/maxresdefault.jpg",
};

export default function TrueVoiceConnect({
  onPigskinFrenzy,
  onCapturingChristianity,
  onBeatAllenParr,
  onColdCaseChristianity,
}) {
  const pigskinLatest   = useYouTubeLatest({ channelId: CHANNEL_IDS.PIGSKIN });
  const capturingLatest = useYouTubeLatest({ channelId: CHANNEL_IDS.CAPTURING_CHRISTIANITY });
  const beatLatest      = useYouTubeLatest({ channelId: CHANNEL_IDS.BEAT_ALLEN_PARR });
  const coldCaseLatest  = useYouTubeLatest({ channelId: CHANNEL_IDS.COLD_CASE_CHRISTIANITY });

  const cards = [
    {
      id:          "pigskin-frenzy",
      label:       "Pigskin Frenzy",
      description: "The boldest takes in College Football. Unfiltered analysis. Unashamed faith.",
      tag:         "CFB",
      onClick:     onPigskinFrenzy,
      thumbnail:   pigskinLatest.thumbnail   || FALLBACKS.pigskin,
    },
    {
      id:          "capturing-christianity",
      label:       "Capturing Christianity",
      description: "Apologetics, philosophy & theology with Cameron Bertuzzi — the rational case for Christian faith.",
      tag:         "APOLOGETICS",
      onClick:     onCapturingChristianity,
      thumbnail:   capturingLatest.thumbnail || FALLBACKS.capturingChristianity,
    },
    {
      id:          "beat-allen-parr",
      label:       "The Beat by Allen Parr",
      description: "Biblical Encouragement And Truth — tackling hard theological questions with clarity and grace.",
      tag:         "BIBLE",
      onClick:     onBeatAllenParr,
      thumbnail:   beatLatest.thumbnail      || FALLBACKS.beatAllenParr,
    },
    {
      id:          "cold-case-christianity",
      label:       "Cold Case Christianity",
      description: "J. Warner Wallace applies cold-case detective methodology to examine the evidence for the Christian worldview.",
      tag:         "APOLOGETICS",
      onClick:     onColdCaseChristianity,
      thumbnail:   coldCaseLatest.thumbnail  || FALLBACKS.coldCase,
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
