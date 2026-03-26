import "./HeroScottSlide.css";
export default function HeroScottSlide() {
  return (
    <div className="hero-scott-slide">
      <div className="hero-scott-inner">
        <img
          src="/images/Scott_Ritchie_on_TrueVoice_Digital.png"
          alt="Scott Ritchie on TrueVoice Digital"
          className="hero-scott-img"
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <div className="hero-scott-badge">
          <span className="hero-scott-dot" aria-hidden="true" />
          COMING SOON
        </div>
      </div>
    </div>
  );
}
