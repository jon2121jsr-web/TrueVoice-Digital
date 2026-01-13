// src/components/Hero.jsx
import "./Hero.css";

export default function Hero() {
  // Visual hero banner; background handled in Hero.css
  return (
    <section className="hero-section" aria-label="TrueVoice Digital Hero">
      <div className="hero-overlay hero-overlay--edge" aria-hidden="true">
        <div className="hero-live-pill">TRUEVOICE LIVE</div>
        <div className="hero-live-line">Coming Soon</div>
      </div>
    </section>
  );
}
