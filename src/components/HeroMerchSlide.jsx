import "./HeroMerchSlide.css";

export default function HeroMerchSlide() {
  return (
    <a
      href="https://shop.truevoice.digital"
      target="_blank"
      rel="noopener noreferrer"
      className="hero-std-slide hero-merch-link"
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src="/images/hero-merch.png"
        alt="TrueVoice Gear — Shop Now"
        className="hero-std-img"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
      <div className="hero-merch-cta">
        <span className="hero-merch-btn">Shop TrueVoice Gear →</span>
      </div>
    </a>
  );
}
