// src/components/TrueVoiceConnect.jsx
// ✅ All cards open video modal on click
// ✅ Capturing Christianity, The Beat by Allen Parr, Cold Case Christianity added April 2026
// ✅ The Cut with Erica removed April 2026
// ✅ New Episodes and Shorts & Reels removed April 2026 (re-enable when needed)
import React from "react";
import { useYouTubeLatest } from "../hooks/useYouTubeLatest";

const CHANNEL_IDS = {
  PIGSKIN:                "UC_khbgasHiiwUxPHOMfbR0A",
  DENISHA:                "UCxcSYXrZQWHRF8iwdWCf3gg",
  CAPTURING_CHRISTIANITY: "UCux-_Fze30tFuI_5CArwSmg",
  BEAT_ALLEN_PARR:        "UCm_RMW_fQk-ELpPYUzor8lw",
  COLD_CASE_CHRISTIANITY: "UCVFe7xhG6rl0ruoMQCJDtnw",
  BIBLE_PROJECT:          "UCVfwlh9XpX2Y_tQfjeln9QA",
  GIVE_ME_AN_ANSWER:      "UCKr-liguaGWMf3f94eQXsug",
};

const FALLBACKS = {
  pigskin:               "https://img.youtube.com/vi/gC4VikZ0dcA/maxresdefault.jpg",
  denisha:               "https://img.youtube.com/vi/default/maxresdefault.jpg",
  capturingChristianity: "https://img.youtube.com/vi/default/maxresdefault.jpg",
  beatAllenParr:         "https://img.youtube.com/vi/default/maxresdefault.jpg",
  coldCase:              "https://img.youtube.com/vi/default/maxresdefault.jpg",
  bibleProject:          "https://img.youtube.com/vi/default/maxresdefault.jpg",
  giveMeAnAnswer:        "https://img.youtube.com/vi/default/maxresdefault.jpg",
};

export default function TrueVoiceConnect({
  onPigskinFrenzy,
  onDenisha,
  onCapturingChristianity,
  onBeatAllenParr,
  onColdCaseChristianity,
  onBibleProject,
  onGiveMeAnAnswer,
}) {
  const pigskinLatest        = useYouTubeLatest({ channelId: CHANNEL_IDS.PIGSKIN });
  const denishaLatest        = useYouTubeLatest({ channelId: CHANNEL_IDS.DENISHA });
  const capturingLatest      = useYouTubeLatest({ channelId: CHANNEL_IDS.CAPTURING_CHRISTIANITY });
  const beatLatest           = useYouTubeLatest({ channelId: CHANNEL_IDS.BEAT_ALLEN_PARR });
  const coldCaseLatest       = useYouTubeLatest({ channelId: CHANNEL_IDS.COLD_CASE_CHRISTIANITY });
  const bibleProjectLatest   = useYouTubeLatest({ channelId: CHANNEL_IDS.BIBLE_PROJECT });
  const giveMeAnAnswerLatest = useYouTubeLatest({ channelId: CHANNEL_IDS.GIVE_ME_AN_ANSWER });

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
      id:          "denisha-workizer",
      label:       "Living the Reclaimed Life",
      description: "Denisha Workizer — where faith meets real life. You were made for more.",
      tag:         "FAITH",
      onClick:     onDenisha,
      thumbnail:   denishaLatest.thumbnail || FALLBACKS.denisha,
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
    {
      id:          "bible-project",
      label:       "BibleProject",
      description: "Animated videos and podcasts that help you experience the Bible as a unified story that leads to Jesus.",
      tag:         "BIBLE",
      onClick:     onBibleProject,
      thumbnail:   bibleProjectLatest.thumbnail || FALLBACKS.bibleProject,
    },
    {
      id:          "give-me-an-answer",
      label:       "Give Me An Answer",
      description: "Stuart & Cliffe Knechtle take faith to the streets — real conversations answering hard questions about Jesus.",
      tag:         "APOLOGETICS",
      onClick:     onGiveMeAnAnswer,
      thumbnail:   giveMeAnAnswerLatest.thumbnail || FALLBACKS.giveMeAnAnswer,
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
