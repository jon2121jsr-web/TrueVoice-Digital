import "./HeroRyanSlide.css";
export default function HeroRyanSlide() {
  return (
    <div className="hero-ryan-slide">
      <div className="hero-ryan-inner">
        <img
          src="/images/Ryan_Kliesch_on_TrueVoice_Digital.png"
          alt="Ryan Kliesch on TrueVoice Digital"
          className="hero-ryan-img"
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <div className="hero-ryan-badge">
          <span className="hero-ryan-dot" aria-hidden="true" />
          COMING SOON
        </div>
      </div>
    </div>
  );
}
