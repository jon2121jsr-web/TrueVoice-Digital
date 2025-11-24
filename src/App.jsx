// src/App.jsx
import './App.css';
import './components/NowPlaying.css';
import NowPlaying from './components/NowPlaying';

function App() {
  return (
    <div className="tv-page">
      {/* HERO SECTION – dark background with hero artwork + AzuraCast player */}
      <header className="tv-hero">
        <div className="tv-hero-inner">
          <div className="tv-hero-player">
            <iframe
              title="TrueVoice Digital Player"
              src="http://143.244.188.4/public/truevoice_digital/embed?theme=dark"
              scrolling="no"
              frameBorder="0"
              allow="autoplay"
            />
          </div>

          {/* HERO ARTWORK CARD – this is the big magenta rectangle */}
          <div className="tv-hero-art" />
        </div>
      </header>

      {/* MAIN LIGHT PANEL */}
      <main className="tv-main">
        {/* Top row: Now Playing + Verse card */}
        <section className="tv-row tv-row-top">
          <NowPlaying />

          <article className="verse-card">
            <p className="verse-label">Verse for Today</p>
            <p className="verse-text">
              “I came that they may have life and have it abundantly.”
            </p>
            <p className="verse-ref">
              John <strong>10:10</strong>
            </p>
          </article>
        </section>

        {/* Featured Podcasts */}
        <section className="tv-row">
          <h2 className="section-title">Featured Podcasts</h2>
          <div className="cards-3">
            <article className="pod-card">
              <div className="pod-thumb" />
              <h3 className="pod-title">Podcast Episode</h3>
              <p className="pod-subtitle">Brief dictat doloexiqs</p>
            </article>

            <article className="pod-card">
              <div className="pod-thumb" />
              <h3 className="pod-title">Podcast Episode</h3>
              <p className="pod-subtitle">Brief dictat doloexiqs</p>
            </article>

            <article className="pod-card">
              <div className="pod-thumb" />
              <h3 className="pod-title">Latest Videos</h3>
              <p className="pod-subtitle">Lorem ipsum door</p>
            </article>
          </div>
        </section>

        {/* Prayer + Encouragement */}
        <section className="tv-row tv-row-connect">
          <article className="connect-card connect-card-prayer">
            <h3 className="connect-title">Prayer Request</h3>
            <p className="connect-text">
              Lorem ipsum dolor sit amet — let the TrueVoice community stand
              with you in prayer.
            </p>
            <button className="np-btn np-btn-primary">Share a Request</button>
          </article>

          <article className="connect-card">
            <h3 className="connect-title">Share an encouragement</h3>
            <p className="connect-text">
              Tell a short testimony or word of encouragement for listeners.
            </p>
            <button className="np-btn np-btn-ghost">Share a story</button>
          </article>
        </section>

        {/* Support / Merch */}
        <section className="tv-row tv-row-support">
          <div className="support-copy">
            <h3 className="section-title">Support the Mission</h3>
            <p className="support-text">
              Keep TrueVoice streaming strong with one-time gifts, monthly
              support, or grabbing some merch to share the message.
            </p>
          </div>

          <div className="support-merch">
            <div className="merch-grid">
              <div className="merch-card">
                <div className="merch-thumb" />
                <p className="merch-label">Sticker</p>
              </div>
              <div className="merch-card">
                <div className="merch-thumb" />
                <p className="merch-label">T-Shirt</p>
              </div>
              <div className="merch-card">
                <div className="merch-thumb" />
                <p className="merch-label">Mug</p>
              </div>
            </div>
            <button className="shop-btn">Shop More</button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
