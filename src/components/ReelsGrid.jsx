// src/components/ReelsGrid.jsx
// Fully dynamic — all sections pull directly from YouTube API.
// No static data files required.
// ✅ The Cut with Erica removed April 2026
// ✅ Capturing Christianity, The Beat by Allen Parr, Cold Case Christianity added April 2026
import { useState } from "react";
import { useYouTubeFeed } from "../hooks/useYouTubeFeed";
import "./ReelsGrid.css";

const CHANNEL_IDS = {
  PIGSKIN:                "UC_khbgasHiiwUxPHOMfbR0A",
  GMAA:                   "UCKr-liguaGWMf3f94eQXsug",
  BIBLEPROJECT:           "UCVfwlh9XpX2Y_tQfjeln9QA",
  CAPTURING_CHRISTIANITY: "UCux-_Fze30tFuI_5CArwSmg",
  BEAT_ALLEN_PARR:        "UCm_RMW_fQk-ELpPYUzor8lw",
  COLD_CASE_CHRISTIANITY: "UCVFe7xhG6rl0ruoMQCJDtnw",
};

// Module-level constant — stable reference across renders
const pigskinFilter = (title) => typeof title === "string" && title.toLowerCase().includes("episode");

function enrichVideos(videos, defaults) {
  return videos.map(v => ({ ...defaults, ...v }));
}

function SkeletonRow() {
  return (
    <div className="reels-scroller-wrap">
      <div className="reels-scroller">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="reel-card reel-card--skeleton">
            <div className="reel-thumb-wrap reel-thumb-wrap--skeleton" />
            <div className="reel-meta">
              <div className="reel-skeleton-line reel-skeleton-line--title" />
              <div className="reel-skeleton-line reel-skeleton-line--sub" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReelsGrid() {
  const [activeVideo, setActiveVideo] = useState(null);

  const pigskinFeed   = useYouTubeFeed({ channelId: CHANNEL_IDS.PIGSKIN,                maxResults: 50, filterFn: pigskinFilter });
  const gmaaFeed      = useYouTubeFeed({ channelId: CHANNEL_IDS.GMAA,                   maxResults: 10 });
  const bpFeed        = useYouTubeFeed({ channelId: CHANNEL_IDS.BIBLEPROJECT,            maxResults: 10 });
  const capturingFeed = useYouTubeFeed({ channelId: CHANNEL_IDS.CAPTURING_CHRISTIANITY,  maxResults: 10 });
  const beatFeed      = useYouTubeFeed({ channelId: CHANNEL_IDS.BEAT_ALLEN_PARR,         maxResults: 10 });
  const coldCaseFeed  = useYouTubeFeed({ channelId: CHANNEL_IDS.COLD_CASE_CHRISTIANITY,  maxResults: 10 });

  const pigskinReels = enrichVideos(pigskinFeed.videos, {
    speaker:     "Joel Norris",
    topic:       "College Football",
    source:      "Pigskin Frenzy",
    description: "The boldest takes in College Football. Unfiltered analysis. Unashamed faith.",
  });
  const gmaaReels = enrichVideos(gmaaFeed.videos, {
    speaker:     "Cliffe Knechtle",
    topic:       "Apologetics",
    source:      "Give Me An Answer",
    description: "Real answers to real questions about faith, Jesus, and the Bible.",
  });
  const bpReels = enrichVideos(bpFeed.videos, {
    speaker:     "BibleProject",
    topic:       "Bible Overview",
    source:      "BibleProject",
    description: "Animated videos exploring the story and themes of the Bible.",
  });
  const capturingReels = enrichVideos(capturingFeed.videos, {
    speaker:     "Cameron Bertuzzi",
    topic:       "Apologetics",
    source:      "Capturing Christianity",
    description: "Apologetics, philosophy & theology — the rational case for Christian faith.",
  });
  const beatReels = enrichVideos(beatFeed.videos, {
    speaker:     "Allen Parr",
    topic:       "Bible Teaching",
    source:      "The Beat by Allen Parr",
    description: "Biblical Encouragement And Truth — tackling hard theological questions with clarity and grace.",
  });
  const coldCaseReels = enrichVideos(coldCaseFeed.videos, {
    speaker:     "J. Warner Wallace",
    topic:       "Apologetics",
    source:      "Cold Case Christianity",
    description: "Cold-case detective methodology applied to the evidence for the Christian worldview.",
  });

  const handleOpen  = (video) => setActiveVideo(video);
  const handleClose = () => setActiveVideo(null);

  const renderChannel = (channelTitle, items, feedState) => (
    <section className="reels-channel" key={channelTitle}>
      <div className="reels-channel-header">
        <h3 className="reels-channel-title">{channelTitle}</h3>
        {!feedState.loading && (
          <span className="reels-channel-count">
            {items.length} video{items.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {feedState.loading ? (
        <SkeletonRow />
      ) : (
        <div className="reels-scroller-wrap">
          <div className="reels-scroller">
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
                    loading="lazy"
                  />
                  <div className="reel-play-pill">Watch</div>
                </div>
                <div className="reel-meta">
                  <h4 className="reel-title">{item.title}</h4>
                  <p className="reel-speaker">
                    {item.speaker} •{" "}
                    <span className="reel-topic">{item.topic}</span>
                  </p>
                  {item.source && (
                    <p className="reel-source">Source: {item.source}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );

  return (
    <>
      <h2 className="tv-section-title">TrueVoice Channels</h2>
      <p className="reels-intro">
        Short-form, high-impact teaching and Q&amp;A content from trusted voices.
      </p>

      {renderChannel("Pigskin Frenzy",          pigskinReels,   pigskinFeed)}
      {renderChannel("Give Me an Answer",        gmaaReels,      gmaaFeed)}
      {renderChannel("Capturing Christianity",   capturingReels, capturingFeed)}
      {renderChannel("The Beat by Allen Parr",   beatReels,      beatFeed)}
      {renderChannel("Cold Case Christianity",   coldCaseReels,  coldCaseFeed)}
      {renderChannel("BibleProject",             bpReels,        bpFeed)}

      {activeVideo && (
        <div className="reel-modal-backdrop" onClick={handleClose}>
          <div className="reel-modal" onClick={(e) => e.stopPropagation()}>
            <header className="reel-modal-header">
              <div>
                <h3 className="reel-modal-title">{activeVideo.title}</h3>
                <p className="reel-modal-subtitle">
                  {activeVideo.speaker}
                  {activeVideo.topic ? ` • ${activeVideo.topic}` : ""}
                </p>
              </div>
              <button type="button" className="reel-modal-close" onClick={handleClose}>×</button>
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
                <p className="reel-modal-description">{activeVideo.description}</p>
              )}
              {activeVideo.videoUrl && (
                <a href={activeVideo.videoUrl} target="_blank" rel="noreferrer" className="reel-modal-link">
                  View on YouTube ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ReelsGrid;
