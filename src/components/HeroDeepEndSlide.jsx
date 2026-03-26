import "./HeroDeepEndSlide.css";
export default function HeroDeepEndSlide() {
  return (
    <div className="hero-deepend-slide">
      <div className="hero-deepend-inner">
        <img
          src="/images/hero-deep-end.png"
          alt="The Deep End with Scott & Ryan — Coming Soon on TrueVoice Digital"
          className="hero-deepend-img"
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <div className="hero-deepend-coming-soon">
          <span className="hero-deepend-dot" aria-hidden="true" />
          COMING SOON
        </div>
      </div>
    </div>
  );
}
