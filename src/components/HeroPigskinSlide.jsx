// src/components/HeroPigskinSlide.jsx
// Pigskin Frenzy — Coming Soon hero slide
// Matches the existing hero slide card format

export default function HeroPigskinSlide() {
  return (
    <div className="hero-media hero-pigskin">
      <img
        src="/images/Pigskin_Frenzy_Hero_Banner.png"
        alt="Pigskin Frenzy with Joel Norris — Coming Soon"
        className="hero-slide-img"
        style={{ objectFit: "contain", objectPosition: "center" }}
        loading="lazy"
        decoding="async"
      />
      <div className="hero-pigskin-badge">
        <span className="hero-pigskin-badge-dot" />
        COMING SOON
      </div>
    </div>
  );
}