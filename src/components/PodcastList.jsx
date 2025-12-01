import React, { useEffect, useState } from "react";

const PODCASTS = [
  {
    id: "bibleproject",
    title: "BibleProject",
    audience: "Young adults, college & up",
    description:
      "In-depth conversations about the Bible and theology from the team behind BibleProject videos.",
    // rss2json proxy around the Simplecast RSS feed
    feedUrl:
      "https://api.rss2json.com/v1/api.json?rss_url=https://feeds.simplecast.com/3NVmUWZO",
    // local artwork in /public/images/podcasts
    image: "/images/podcasts/bibleproject.jpg",
    // Working show page for the BibleProject podcast
    websiteUrl: "https://thebibleproject.simplecast.com/episodes",
  },
  {
    id: "becoming-something",
    title: "Becoming Something with Jonathan Pokluda",
    audience: "20s & 30s, young professionals",
    description:
      "Straightforward, practical teaching for young adults navigating faith, dating, work, and calling.",
    feedUrl:
      "https://api.rss2json.com/v1/api.json?rss_url=https://feeds.simplecast.com/ppXLGdTb",
    image: "/images/podcasts/becoming-something.jpg",
    // Correct Apple Podcasts show page
    websiteUrl:
      "https://podcasts.apple.com/us/podcast/becoming-something-with-jonathan-pokluda/id1454045768",
  },

  // When you're ready to add the next shows, just copy one of the objects
  // above, update id/title/feeds/image/websiteUrl and you're done.
  // {
  //   id: "whoa-thats-good",
  //   title: "WHOA That’s Good with Sadie Robertson Huff",
  //   audience: "Young women, teens & 20s",
  //   description: "Conversations with Sadie about faith, purpose, and real life.",
  //   feedUrl: "https://api.rss2json.com/v1/api.json?rss_url=<<Sadie RSS URL>>",
  //   image: "/images/podcasts/whoa-thats-good.jpg",
  //   websiteUrl: "<<Sadie show page (Apple/Spotify/etc.)>>",
  // },
  // {
  //   id: "made-for-this",
  //   title: "Made For This with Jennie Allen",
  //   audience: "Women, small group leaders",
  //   description:
  //     "Biblical teaching and honest conversations to help you live the life God made you for.",
  //   feedUrl: "https://api.rss2json.com/v1/api.json?rss_url=<<Jennie RSS URL>>",
  //   image: "/images/podcasts/made-for-this.jpg",
  //   websiteUrl: "<<Jennie show page>>",
  // },
];

function PodcastsList() {
  const [episodesByShow, setEpisodesByShow] = useState({});
  const [loadingByShow, setLoadingByShow] = useState({});
  const [errorByShow, setErrorByShow] = useState({});

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
            [podcast.id]: items.slice(0, 6),
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

  return (
    <section className="tv-section">
      <h2 className="tv-section-title">TrueVoice Network Podcasts</h2>
      <div className="tv-podcast-grid">
        {PODCASTS.map((podcast) => {
          const episodes = episodesByShow[podcast.id] || [];
          const isLoading = loadingByShow[podcast.id];
          const error = errorByShow[podcast.id];

          return (
            <article key={podcast.id} className="tv-podcast-card">
              <div className="tv-podcast-header">
                <img
                  src={podcast.image}
                  alt={podcast.title}
                  className="tv-podcast-art"
                />
                <div className="tv-podcast-heading">
                  <h3 className="tv-podcast-title">{podcast.title}</h3>
                  <p className="tv-podcast-audience">{podcast.audience}</p>
                  <p className="tv-podcast-description">
                    {podcast.description}
                  </p>
                </div>
              </div>

              <div className="tv-podcast-episodes">
                {isLoading && (
                  <p className="tv-podcast-status">Loading latest episodes…</p>
                )}

                {/* Do NOT show the red error message anymore */}
                {/* error is still logged to console but not shown to users */}

                {!isLoading && episodes.length === 0 && (
                  <p className="tv-podcast-status">
                    Browse episodes on the original feed below.
                  </p>
                )}

                {!isLoading &&
                  !error &&
                  episodes.map((ep) => {
                    // Prefer the audio file if we have it; fall back to link/website
                    const episodeUrl =
                      (ep.enclosure && ep.enclosure.link) ||
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

export default PodcastsList;
