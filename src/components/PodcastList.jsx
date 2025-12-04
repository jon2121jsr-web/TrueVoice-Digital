// src/components/PodcastList.jsx
import React, { useEffect, useState } from "react";

const PODCASTS = [
  {
    id: "bibleproject",
    title: "BibleProject",
    audience: "Young adults, college & up",
    description:
      "In-depth conversations about the Bible and theology from the team behind BibleProject videos.",
    feedUrl:
      "https://api.rss2json.com/v1/api.json?rss_url=https://feeds.simplecast.com/3NVmUWZO",
    image: "/images/podcasts/bibleproject.jpg",
    websiteUrl: "https://thebibleproject.simplecast.com/episodes",
  },
  {
    id: "becoming-something",
    title: "Becoming Something with Jonathan Pokluda",
    audience: "20s & 30s, young professionals",
    description:
      "Straightforward, practical teaching for young adults navigating faith, dating, work, and calling.",
    feedUrl:
      "https://api.rss2json.com/v1/api.json?rss_url=https://podcasts.subsplash.com/z73b3th/podcast.rss",
    image: "/images/podcasts/becoming-something.jpg",
    websiteUrl:
      "https://podcasts.apple.com/us/podcast/becoming-something-with-jonathan-pokluda/id1454045768",
  },
  {
    id: "whoa-thats-good",
    title: "WHOA That's Good with Sadie Robertson Huff",
    audience: "Young women, teens & 20s",
    description:
      "Conversations with Sadie about faith, purpose, and real-life questions with guests from all walks of life.",
    feedUrl:
      "https://api.rss2json.com/v1/api.json?rss_url=https://feeds.megaphone.fm/LEW1514366617",
    image: "/images/podcasts/whoa-thats-good.jpg",
    websiteUrl: "https://www.liveoriginal.com/podcast",
  },
  {
    id: "made-for-this",
    title: "Made For This with Jennie Allen",
    audience: "Women, small group leaders",
    description:
      "Biblical teaching and honest conversations to help you live the life God made you for.",
    feedUrl:
      "https://api.rss2json.com/v1/api.json?rss_url=https://feeds.transistor.fm/made-for-this-with-jennie-allen",
    image: "/images/podcasts/made-for-this.jpg",
    websiteUrl: "https://www.jennieallen.com/podcast",
  },
];

function PodcastList() {
  const [episodesByShow, setEpisodesByShow] = useState({});
  const [loadingByShow, setLoadingByShow] = useState({});
  const [errorByShow, setErrorByShow] = useState({});
  const [expandedByShow, setExpandedByShow] = useState({});

  useEffect(() => {
    PODCASTS.forEach((podcast) => {
      setLoadingByShow((prev) => ({ ...prev, [podcast.id]: true }));
      setErrorByShow((prev) => ({ ...prev, [podcast.id]: null }));

      fetch(podcast.feedUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          const items = Array.isArray(data.items) ? data.items : [];
          setEpisodesByShow((prev) => ({
            ...prev,
            [podcast.id]: items,
          }));
        })
        .catch((err) => {
          console.error("Podcast fetch error for", podcast.id, err);
          setErrorByShow((prev) => ({
            ...prev,
            [podcast.id]: "Could not load podcast feed. Try again later.",
          }));
        })
        .finally(() => {
          setLoadingByShow((prev) => ({ ...prev, [podcast.id]: false }));
        });
    });
  }, []);

  const toggleExpanded = (id) => {
    setExpandedByShow((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <section className="tv-section">
      <h2 className="tv-section-title">TrueVoice Network Podcasts</h2>
      <div className="tv-podcast-grid">
        {PODCASTS.map((podcast) => {
          const episodes = episodesByShow[podcast.id] || [];
          const isLoading = loadingByShow[podcast.id];
          const error = errorByShow[podcast.id];
          const isExpanded = !!expandedByShow[podcast.id];

          const displayEpisodes = isExpanded
            ? episodes.slice(0, 12)
            : episodes.slice(0, 3);

          return (
            <article key={podcast.id} className="tv-podcast-card">
              <div className="tv-podcast-header">
                <img
                  src={podcast.image}
                  alt={podcast.title}
                  className="tv-podcast-art"
                  loading="lazy"
                />
                <div className="tv-podcast-heading">
                  <h3 className="tv-podcast-title">{podcast.title}</h3>
                  <p className="tv-podcast-audience">{podcast.audience}</p>
                  <p className="tv-podcast-description">
                    {podcast.description}
                  </p>
                </div>
              </div>

              <div
                className={
                  "tv-podcast-episodes " +
                  (isExpanded
                    ? "tv-podcast-episodes--expanded"
                    : "tv-podcast-episodes--compact")
                }
              >
                {isLoading && (
                  <p className="tv-podcast-status">Loading latest episodes…</p>
                )}

                {!isLoading && error && (
                  <p className="tv-podcast-status">{error}</p>
                )}

                {!isLoading &&
                  !error &&
                  episodes.length === 0 && (
                    <p className="tv-podcast-status">
                      Browse episodes on the original feed below.
                    </p>
                  )}

                {!isLoading &&
                  !error &&
                  displayEpisodes.map((ep) => {
                    const episodeUrl =
                      (ep.enclosure && (ep.enclosure.link || ep.enclosure.url)) ||
                      ep.link ||
                      podcast.websiteUrl;

                    return (
                      <a
                        key={ep.guid || ep.link || ep.title}
                        href={episodeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="tv-podcast-episode-row"
                      >
                        <span className="tv-podcast-episode-title">
                          {ep.title}
                        </span>
                        {ep.pubDate && (
                          <span className="tv-podcast-episode-date">
                            {new Date(ep.pubDate).toLocaleDateString()}
                          </span>
                        )}
                      </a>
                    );
                  })}
              </div>

              {/* View all / less toggle */}
              {!isLoading && !error && episodes.length > 3 && (
                <button
                  type="button"
                  className="tv-podcast-viewall"
                  onClick={() => toggleExpanded(podcast.id)}
                >
                  {isExpanded ? "View less" : "View all"}
                </button>
              )}

              <div className="tv-podcast-footer">
                <a
                  href={podcast.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="tv-btn tv-btn-secondary tv-podcast-cta"
                >
                  Listen on original feed
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default PodcastList;
