// src/components/Hero.jsx
// ✅ Touch swipe left/right + mouse drag to navigate slides
import { useEffect, useMemo, useRef, useState } from "react";
import "./Hero.css";
import HeroMerchSlide from "./HeroMerchSlide.jsx";
import HeroPigskinSlide from "./HeroPigskinSlide.jsx";

// Minimum px travel before we count it as a swipe (not a tap)
const SWIPE_THRESHOLD = 40;

export default function Hero() {
  const slides = useMemo(
    () => [
      {
        src:      "/images/truevoice-hero.jpg",
        alt:      "TrueVoice Digital — Faithful Voices. Inspired Content.",
        fit:      "cover",
        position: "center center",
        cover:    true,
        kind:     "legacy",
      },
      {
        src:      "/images/hero-truevoice-live.png",
        alt:      "TrueVoice LIVE — Where Truth and Faith Come Together",
        fit:      "contain",
        position: "center",
        kind:     "poster",
      },
      {
        src:      "/images/The-Church-Hero-2500x900-FULL__2_.png",
        alt:      "The Church in Shorts — Real Truth. Real Church. In Short Video.",
        fit:      "cover",
        position: "center center",
        cover:    true,
        kind:     "poster",
      },
      {
        kind:      "component",
        component: HeroMerchSlide,
        alt:       "TrueVoice Gear — Coming Soon",
      },
      {
        kind:      "component",
        component: HeroPigskinSlide,
        alt:       "Pigskin Frenzy with Joel Norris",
      },
      {
        src:      "/images/hero-slide-4.png",
        alt:      "TrueVoice Digital — Featured",
        fit:      "contain",
        position: "center",
        kind:     "poster",
      },
      {
        src:      "/images/hero-coming.png",
        alt:      "He is coming back. Let's get ready.",
        fit:      "cover",
        position: "center center",
        cover:    true,
        kind:     "poster",
      },
    ],
    []
  );

  const [active, setActive] = useState(0);
  const intervalRef = useRef(null);

  // Touch / mouse drag state
  const dragStart  = useRef(null);   // { x, y } at pointer down
  const isDragging = useRef(false);

  const startAutoPlay = () => {
    stopAutoPlay();
    intervalRef.current = window.setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 7000);
  };

  const stopAutoPlay = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
  };

  useEffect(() => {
    startAutoPlay();
    return stopAutoPlay;
  }, [slides.length]);

  const goTo = (idx) => {
    if (idx < 0 || idx >= slides.length) return;
    setActive(idx);
    // Reset timer on manual navigation
    startAutoPlay();
  };

  const goNext = () => goTo((active + 1) % slides.length);
  const goPrev = () => goTo((active - 1 + slides.length) % slides.length);

  // ── Pointer events (works for both touch and mouse) ──────────────────────
  const handlePointerDown = (e) => {
    // Only track left mouse button or touch
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
  };

  const handlePointerMove = (e) => {
    if (!dragStart.current) return;
    const dx = Math.abs(e.clientX - dragStart.current.x);
    const dy = Math.abs(e.clientY - dragStart.current.y);
    if (dx > 8 || dy > 8) isDragging.current = true;
  };

  const handlePointerUp = (e) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    dragStart.current = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD) return; // not a real swipe

    if (dx < 0) goNext(); // swiped left → next
    else goPrev();         // swiped right → prev
  };

  const handlePointerCancel = () => {
    dragStart.current  = null;
    isDragging.current = false;
  };

  // Prevent click-through on drag so cards/buttons don't fire
  const handleClick = (e) => {
    if (isDragging.current) {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = false;
    }
  };

  return (
    <section className="hero-section" aria-label="TrueVoice Hero">
      <div
        className="hero-slider"
        role="region"
        aria-label="Hero slides"
        // Pointer events — unified touch + mouse
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
        style={{ cursor: "grab", userSelect: "none" }}
      >
        {slides.map((s, idx) => {
          const isActive = idx === active;

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
                  draggable="false"
                  style={{
                    objectFit:      s.fit      || "contain",
                    objectPosition: s.position || "center",
                    borderRadius:   s.cover ? 0 : undefined,
                    pointerEvents:  "none", // prevent img drag interfering
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* ── Prev / Next chevron arrows ── */}
        <button
          type="button"
          className="hero-arrow hero-arrow--prev"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          aria-label="Previous slide"
        >
          ‹
        </button>
        <button
          type="button"
          className="hero-arrow hero-arrow--next"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          aria-label="Next slide"
        >
          ›
        </button>

        {/* ── Dots ── */}
        <div className="hero-dots" aria-label="Hero slide controls">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`hero-dot ${idx === active ? "is-active" : ""}`}
              aria-label={`Go to slide ${idx + 1}`}
              aria-pressed={idx === active}
              onClick={(e) => { e.stopPropagation(); goTo(idx); }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}