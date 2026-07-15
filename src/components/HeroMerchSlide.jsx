import "./HeroMerchSlide.css";

export default function HeroMerchSlide({ onShopClick }) {
  const handleClick = () => {
    const merchSection = document.querySelector(".tv-gear-section");
    if (merchSection) {
      const top = merchSection.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top, behavior: "smooth" });
    } else if (typeof onShopClick === "function") {
      onShopClick();
    }
  };

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
          <button className="hero-merch-btn" onClick={(e) => { e.stopPropagation(); handleClick(); }}>
            Shop TrueVoice Gear →
          </button>
        </div>
      </div>
    </div>
  );
}
