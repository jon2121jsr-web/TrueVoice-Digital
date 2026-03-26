// src/components/ReelsGrid.jsx
// ✅ TrueVoice Channels shows full episodes only — no Shorts
// ✅ Pigskin Frenzy filters uploads playlist to episodes (title starts with "Episode")
// ✅ Dynamic hook prepends newest episode; static backlog is fallback
import { useState } from "react";
import { useYouTubeLatest } from "../hooks/useYouTubeLatest";
import { GMAA_REELS } from "../data/gmaaReels";
import { BIBLEPROJECT_REELS } from "../data/bibleProjectReels";
import { PIGSKIN_REELS } from "../data/pigskinReels";
import { CHURCH_SHORTS_REELS } from "../data/churchShortsReels";
import "./ReelsGrid.css";

const CHANNEL_IDS = {
  PIGSKIN:      "UC_khbgasHiiwUxPHOMfbR0A",
  GMAA:         "UCKr-liguaGWMf3f94eQXsug",
  BIBLEPROJECT: "UCVfwlh9XpX2Y_tQfjeln9QA",
};

const CHURCH_PLAYLIST_ID = "PLPq8uhR5C2XRyO0tvkJpW18OeplMh3Ggc";

// Pigskin Frenzy: full episodes have titles starting with "Episode"
const pigskinEpisodeFilter = (snippet) =>
  snippet?.title?.trim().startsWith("Episode");

// Merges live API result in front of static backlog.
// Skips if already present (no duplicates).
function mergeLatest(staticReels, apiData, refFields = {}) {
  if (!apiData?.videoId || apiData.loading || apiData.error) return staticReels;
  if (staticReels.some((v) => v.id === apiData.videoId)) return staticReels;

  const ref = staticReels[0] ?? {};
  const liveCard = {
    id:           apiData.videoId,
    title:        apiData.title     || "Latest Episode",
    thumbnailUrl: apiData.thumbnail || ref.thumbnailUrl || null,
    embedUrl:     `https://www.youtube.com/embed/${apiData.videoId}?autoplay=1`,
    videoUrl:     `https://www.youtube.com/watch?v=${apiData.videoId}`,
    speaker:      refFields.speaker      || ref.speaker      || null,
    topic:        refFields.topic        || ref.topic        || null,
    source:       refFields.source       || ref.source       || null,
    description:  refFields.description  || ref.description  || null,
  };

  return [liveCard, ...staticReels];
}

function ReelsGrid() {
  const [activeVideo, setActiveVideo] = useState(null);

  // Pigskin: filter to full episodes only
  const pigskinRss = useYouTubeLatest({
    channelId: CHANNEL_IDS.PIGSKIN,
    filterFn:  pigskinEpisodeFilter,
  });
  const churchRss = useYouTubeLatest({ playlistId: CHURCH_PLAYLIST_ID });
  const gmaaRss   = useYouTubeLatest({ channelId:  CHANNEL_IDS.GMAA });
  const bpRss     = useYouTubeLatest({ channelId:  CHANNEL_IDS.BIBLEPROJECT });

  const pigskinReels = mergeLatest(PIGSKIN_REELS, pigskinRss, {
    speaker: "Joel Norris", topic: "College Football", source: "Pigskin Frenzy",
    description: "The boldest takes in College Football. Unfiltered analysis. Unashamed faith.",
  });
  const churchReels = mergeLatest(CHURCH_SHORTS_REELS, churchRss, {
    speaker: "Pastor Erica (FCC)", topic: "Faith & Church", source: "The Cut with Erica",
    description: "Real Truth. Real Church. In Short Video.",
  });
  const gmaaReels = mergeLatest(GMAA_REELS, gmaaRss);
  const bpReels   = mergeLatest(BIBLEPROJECT_REELS, bpRss);

  const handleOpen  = (video) => setActiveVideo(video);
  const handleClose = () => setActiveVideo(null);

  const renderChannel = (channelTitle, items) => (
    <section className="reels-channel" key={channelTitle}>
      <div className="reels-channel-header">
        <h3 className="reels-channel-title">{channelTitle}</h3>
        <span className="reels-channel-count">
          {items.length} video{items.length !== 1 ? "s" : ""}
        </span>
      </div>

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
    </section>
  );

  return (
    <>
      <h2 className="tv-section-title">TrueVoice Channels</h2>
      <p className="reels-intro">
        Short-form, high-impact teaching and Q&amp;A content from trusted voices.
      </p>

      {renderChannel("Pigskin Frenzy",    pigskinReels)}
      {renderChannel("The Cut with Erica", churchReels)}
      {renderChannel("Give Me an Answer",  gmaaReels)}
      {renderChannel("BibleProject",       bpReels)}

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
