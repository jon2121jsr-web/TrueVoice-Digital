import "./HeroMerchSlide.css";

export default function HeroMerchSlide() {
  return (
    <div className="hero-std-slide">
      <div className="hero-merch-slide-inner">
        <img
          src="/images/hero-merch.png"
          alt="TrueVoice Gear — Wear Your Faith Loud"
          className="hero-std-img"
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <div className="hero-merch-cta">
          <a
            href="https://shop.truevoice.digital"
            target="_blank"
            rel="noopener noreferrer"
            className="hero-merch-btn"
            onClick={(e) => e.stopPropagation()}
          >
            Shop TrueVoice Gear →
          </a>
        </div>
      </div>
    </div>
  );
}
