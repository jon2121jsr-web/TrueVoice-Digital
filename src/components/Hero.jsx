// src/components/Hero.jsx
import "./Hero.css";

const WAVE_BARS = 24;

export default function Hero() {
  return (
    <section
      className="hero-section"
      aria-label="TrueVoice Digital - Faithful Voices. Inspired Content."
    >
      {/* Overlay just for effects, doesn’t block clicks below */}
      <div className="hero-effects-layer">
        <div className="hero-wave">
          {Array.from({ length: WAVE_BARS }).map((_, i) => (
            <span key={i} style={{ "--i": i }} />
          ))}
        </div>
      </div>
    </section>
  );
}
