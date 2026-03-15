// src/components/HeroPigskinSlide.jsx
// Pigskin Frenzy hero slide — no Coming Soon badge, just the banner

export default function HeroPigskinSlide() {
  return (
    <div className="hero-media hero-pigskin">
      <img
        src="/images/Pigskin_Frenzy_Hero_Banner.png"
        alt="Pigskin Frenzy with Joel Norris"
        className="hero-slide-img"
        style={{ objectFit: "contain", objectPosition: "center" }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}