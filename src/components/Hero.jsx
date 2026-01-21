// src/components/Hero.jsx
import { useEffect, useMemo, useState } from "react";
import "./Hero.css";

export default function Hero() {
  const slides = useMemo(
    () => [
      {
        // 1️⃣ Legacy hero banner
        src: "/images/truevoice-hero.jpg",
        alt: "TrueVoice Digital hero",
        fit: "contain",
        position: "center",
        kind: "legacy",
      },
      {
        // 2️⃣ TrueVoice LIVE hero
        src: "/images/hero-truevoice-live.png",
        alt: "TrueVoice LIVE — Where Truth and Faith Come Together",
        fit: "contain",
        position: "center",
        kind: "poster",
      },
      {
        // 3️⃣ Public / Feature slide
        src: "/images/hero-slide-4.png",
        alt: "TrueVoice Digital — Featured",
        fit: "contain",
        position: "center",
        kind: "poster",
      },
      {
        // 4️⃣ Coming slide (now last)
        src: "/images/hero-coming.png",
        alt: "He is coming back. Let's get ready.",
        fit: "contain",
        position: "center",
        kind: "poster",
      },
    ],
    []
  );

  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  const goTo = (idx) => {
    if (idx < 0 || idx >= slides.length) return;
    setActive(idx);
  };

  return (
    <section className="hero-section" aria-label="TrueVoice Hero">
      <div className="hero-slider" role="region" aria-label="Hero slides">
        {slides.map((s, idx) => (
          <div
            key={s.src}
            className={`hero-slide ${idx === active ? "is-active" : ""}`}
            aria-hidden={idx === active ? "false" : "true"}
            data-kind={s.kind || "legacy"}
          >
            <div className="hero-media">
              <img
                className="hero-slide-img"
                src={s.src}
                alt={idx === active ? s.alt : ""}
                loading={idx === 0 ? "eager" : "lazy"}
                decoding="async"
                style={{
                  objectFit: s.fit,
                  objectPosition: s.position || "center",
                }}
              />
            </div>
          </div>
        ))}

        <div className="hero-dots" aria-label="Hero slide controls">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`hero-dot ${idx === active ? "is-active" : ""}`}
              aria-label={`Go to slide ${idx + 1}`}
              aria-pressed={idx === active}
              onClick={() => goTo(idx)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
