// src/components/HeroMerchSlide.jsx
// Hero slide promoting TrueVoice Gear with "Coming Soon" treatment
// Drop this into your Hero carousel rotation

import React from "react";
import "./HeroMerchSlide.css";

export default function HeroMerchSlide({ onShopClick }) {
  const handleClick = () => {
    // Always scroll to the section directly — don't delegate to onShopClick,
    // which doesn't guarantee a scroll and silently swallows the event.
    const merchSection = document.querySelector(".tv-gear-section");

    if (merchSection) {
      // getBoundingClientRect() is relative to the viewport at call time.
      // Adding window.pageYOffset converts it to an absolute page position.
      // The 80px offset clears a typical fixed nav bar — adjust if yours differs.
      const top =
        merchSection.getBoundingClientRect().top + window.pageYOffset - 80;

      window.scrollTo({ top, behavior: "smooth" });
    } else {
      // Section not found — fire the prop as a last resort so parent can handle it.
      if (typeof onShopClick === "function") {
        onShopClick();
      }
    }
  };

  return (
    <div className="hero-merch-slide">
      {/* Background gradient effect */}
      <div className="hero-merch-glow" aria-hidden="true" />

      <div className="hero-merch-content">
        {/* Eyebrow badge */}
        <div className="hero-merch-eyebrow">FAITH IN BOLD</div>

        {/* Main headline */}
        <h1 className="hero-merch-title">
          TRUEVOICE <span className="hero-merch-title-accent">GEAR</span>
        </h1>

        {/* Underline accent */}
        <div className="hero-merch-underline" aria-hidden="true" />

        {/* Subheadline */}
        <p className="hero-merch-subtitle">
          Wear your faith loud. Curated merch for believers who don't blend in.
        </p>

        {/* Coming Soon badge */}
        <div className="hero-merch-coming-soon">
          <span className="hero-merch-dot" aria-hidden="true" />
          COMING SOON
        </div>

        {/* CTA Button */}
        <button
          type="button"
          className="hero-merch-cta"
          onClick={handleClick}
          aria-label="Preview TrueVoice Gear collection"
        >
          Preview the Collection
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="hero-merch-arrow"
          >
            <path
              d="M1 8h14m0 0L8 1m7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
