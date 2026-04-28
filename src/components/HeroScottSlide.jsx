import "./HeroScottSlide.css";
export default function HeroScottSlide() {
  return (
    <div className="hero-std-slide">
      <img
        src="/images/hero-scott.png"
        alt="Scott Ritchie on TrueVoice Digital"
        className="hero-std-img"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
    </div>
  );
}
