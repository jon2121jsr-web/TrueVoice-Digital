// src/components/Hero.jsx
// ✅ Touch swipe left/right + mouse drag to navigate slides
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Hero.css";
// Minimum px travel before we count it as a swipe (not a tap)
const SWIPE_THRESHOLD = 40;

export default function Hero() {
  const slides = useMemo(() => [
    {
      src: "/images/TrueVoice Digital_ Music Is the Heartbeat.png",
      alt: "TrueVoice Digital — Music is the heartbeat. Discovery is the experience.",
      width: 1958, height: 803,
    },
    {
      src: "/images/TrueVoice Gear_ Faith in Bold.png",
      alt: "TrueVoice Gear — Faith in Bold. Shop TrueVoice Gear.",
      width: 1958, height: 803, gear: true,
    },
    {
      src: "/images/TrueVoice.Digital Network Showcase(1).png",
      alt: "TrueVoice.Digital Network Showcase — Faithful Voices. Inspired Content.",
      width: 1960, height: 802,
    },
    {
      src: "/images/TrueVoice Digital_ Faith in Sound.png",
      alt: "TrueVoice Digital — Faith in Sound. Music, podcasts, teaching, stories and community.",
      width: 1958, height: 803,
    },
  ], []);

  const [active, setActive] = useState(0);
  const intervalRef = useRef(null);

  // Touch / mouse drag state
  const dragStart = useRef(null); // { x, y } at pointer down
  const isDragging = useRef(false);

  const stopAutoPlay = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
  }, []);

  const startAutoPlay = useCallback(() => {
    stopAutoPlay();
    intervalRef.current = window.setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 7000);
  }, [slides.length, stopAutoPlay]);

  useEffect(() => {
    startAutoPlay();
    return stopAutoPlay;
  }, [startAutoPlay, stopAutoPlay]);

  const goTo = (idx) => {
    if (idx < 0 || idx >= slides.length) return;
    setActive(idx);
    // Reset timer on manual navigation
    startAutoPlay();
  };

  const goNext = () => goTo((active + 1) % slides.length);
  const goPrev = () => goTo((active - 1 + slides.length) % slides.length);

  // ── Pointer events (works for both touch and mouse) ────────────────────────
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
    else goPrev();        // swiped right → prev
  };

  const handlePointerCancel = () => {
    dragStart.current = null;
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
    <section className="hero-section hero-section--artwork" aria-label="TrueVoice Hero">
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
        {slides.map((slide, idx) => {
          const isActive = idx === active;
          const artwork = <img
            className="hero-slide-img"
            src={slide.src}
            alt={isActive ? slide.alt : ""}
            width={slide.width}
            height={slide.height}
            loading={idx === 0 ? "eager" : "lazy"}
            decoding="async"
            draggable="false"
          />;
          return <div
            key={slide.src}
            className={"hero-slide " + (isActive ? "is-active" : "")}
            aria-hidden={!isActive}
            inert={!isActive}
            data-kind="artwork"
          >
            {slide.gear ? <button
              type="button"
              className="hero-artwork-link"
              aria-label="Shop TrueVoice Gear"
              onClick={(event) => {
                // A swipe must not activate the button embedded in the artwork.
                if (isDragging.current) return;
                event.stopPropagation();
                document.querySelector('.tv-gear-section')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >{artwork}</button> : <div className="hero-media">{artwork}</div>}
          </div>;
        })}

        {/* ── Prev / Next chevron arrows ── */}
        <button
          type="button"
          className="hero-arrow hero-arrow--prev"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Previous slide"
        >
          ‹
        </button>
        <button
          type="button"
          className="hero-arrow hero-arrow--next"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
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
              onClick={(e) => {
                e.stopPropagation();
                goTo(idx);
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
