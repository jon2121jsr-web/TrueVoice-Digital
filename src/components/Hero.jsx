// src/components/Hero.jsx
import { useEffect, useMemo, useState } from "react";
import "./Hero.css";
import HeroMerchSlide from "./HeroMerchSlide.jsx";
import HeroPigskinSlide from "./HeroPigskinSlide.jsx";

export default function Hero() {
  const slides = useMemo(
    () => [
      {
        // 1️⃣ TrueVoice Digital — cover so it fills the full frame, bold and legible
        src:      "/images/truevoice-hero.jpg",
        alt:      "TrueVoice Digital — Faithful Voices. Inspired Content.",
        fit:      "cover",
        position: "center center",
        cover:    true,   // removes padding/radius so image bleeds edge to edge
        kind:     "legacy",
      },
      {
        // 2️⃣ TrueVoice LIVE hero
        src:      "/images/hero-truevoice-live.png",
        alt:      "TrueVoice LIVE — Where Truth and Faith Come Together",
        fit:      "contain",
        position: "center",
        kind:     "poster",
      },
      {
        // 3️⃣ The Church in Shorts — wide banner, cover fill
        src:      "/images/The-Church-Hero-2500x900-FULL__2_.png",
        alt:      "The Church in Shorts — Real Truth. Real Church. In Short Video.",
        fit:      "cover",
        position: "center center",
        cover:    true,
        kind:     "poster",
      },
      {
        // 4️⃣ TrueVoice Gear promo (React component)
        kind:      "component",
        component: HeroMerchSlide,
        alt:       "TrueVoice Gear — Coming Soon",
      },
      {
        // 5️⃣ Pigskin Frenzy — Coming Soon
        kind:      "component",
        component: HeroPigskinSlide,
        alt:       "Pigskin Frenzy with Joel Norris — Coming Soon",
      },
      {
        // 6️⃣ Public / Feature slide
        src:      "/images/hero-slide-4.png",
        alt:      "TrueVoice Digital — Featured",
        fit:      "contain",
        position: "center",
        kind:     "poster",
      },
      {
        // 7️⃣ Coming slide (last)
        src:      "/images/hero-coming.png",
        alt:      "He is coming back. Let's get ready.",
        fit:      "contain",
        position: "center",
        kind:     "poster",
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
        {slides.map((s, idx) => {
          const isActive = idx === active;

          // Component slides (HeroMerchSlide, HeroPigskinSlide)
          if (s.kind === "component" && s.component) {
            const Component = s.component;
            return (
              <div
                key={`component-${idx}`}
                className={`hero-slide ${isActive ? "is-active" : ""}`}
                aria-hidden={isActive ? "false" : "true"}
                data-kind="component"
              >
                <Component />
              </div>
            );
          }

          // Image slides — cover slides bleed edge to edge, contained slides use the framed look
          const mediaStyle = s.cover
            ? {
                width:        "100%",
                height:       "100%",
                padding:      0,
                borderRadius: 0,
                background:   "none",
                boxShadow:    "none",
              }
            : {};

          return (
            <div
              key={s.src}
              className={`hero-slide ${isActive ? "is-active" : ""}`}
              aria-hidden={isActive ? "false" : "true"}
              data-kind={s.kind || "legacy"}
            >
              <div className="hero-media" style={mediaStyle}>
                <img
                  className="hero-slide-img"
                  src={s.src}
                  alt={isActive ? s.alt : ""}
                  loading={idx === 0 ? "eager" : "lazy"}
                  decoding="async"
                  style={{
                    objectFit:      s.fit      || "contain",
                    objectPosition: s.position || "center",
                    borderRadius:   s.cover ? 0 : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}

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