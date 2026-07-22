import "./HeroMerchSlide.css";

export default function HeroMerchSlide() {
  return (
    <div className="hero-std-slide">
      <img
        src="/images/hero-merch.png"
        alt="TrueVoice Gear — Shop Now"
        className="hero-std-img"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
      <div className="hero-merch-cta">
        <button
          className="hero-merch-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const section = document.querySelector('.tv-gear-section');
            if (section) {
              section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
        >
          Shop TrueVoice Gear →
        </button>
      </div>
    </div>
  );
}
