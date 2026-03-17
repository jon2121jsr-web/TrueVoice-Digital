// src/components/ReelsGrid.jsx
// ✅ RSS auto-updates first card in each channel with newest video
// ✅ Church in Shorts uses dedicated playlist RSS
// ✅ Static backlog remains intact below the newest entry
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

// Replace the first entry with live RSS data if available.
// Falls back to static data if RSS is loading or failed.
function mergeLatest(staticReels, rssData) {
  if (!rssData?.videoId || rssData.loading || rssData.error) return staticReels;

  const liveEntry = {
    ...staticReels[0],
    id:           rssData.videoId,
    title:        rssData.title     || staticReels[0]?.title || "Latest Episode",
    thumbnailUrl: rssData.thumbnail || staticReels[0]?.thumbnailUrl,
    embedUrl:     `https://www.youtube.com/embed/${rssData.videoId}?autoplay=1`,
    videoUrl:     `https://www.youtube.com/watch?v=${rssData.videoId}`,
  };

  // Put live entry first, then backlog (skipping the old first entry
  // only if it has the same video ID — avoids duplicates)
  const backlog = staticReels.slice(1).filter(
    (v) => v.id !== rssData.videoId
  );

  return [liveEntry, ...backlog];
}

function ReelsGrid() {
  const [activeVideo, setActiveVideo] = useState(null);

  const pigskinRss = useYouTubeLatest({ channelId:  CHANNEL_IDS.PIGSKIN });
  const churchRss  = useYouTubeLatest({ playlistId: CHURCH_PLAYLIST_ID });
  const gmaaRss    = useYouTubeLatest({ channelId:  CHANNEL_IDS.GMAA });
  const bpRss      = useYouTubeLatest({ channelId:  CHANNEL_IDS.BIBLEPROJECT });

  const pigskinReels = mergeLatest(PIGSKIN_REELS,       pigskinRss);
  const churchReels  = mergeLatest(CHURCH_SHORTS_REELS, churchRss);
  const gmaaReels    = mergeLatest(GMAA_REELS,          gmaaRss);
  const bpReels      = mergeLatest(BIBLEPROJECT_REELS,  bpRss);

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

      {renderChannel("Pigskin Frenzy",       pigskinReels)}
      {renderChannel("The Church in Shorts", churchReels)}
      {renderChannel("Give Me an Answer",    gmaaReels)}
      {renderChannel("BibleProject",         bpReels)}

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