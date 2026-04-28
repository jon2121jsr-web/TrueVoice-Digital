// src/components/MerchSection.jsx
// TrueVoice Gear — Affiliate merch section
// Swap `MERCH_PRODUCTS` data when Revelation Threadz affiliate links are confirmed.

import React, { useState } from "react";
import "./MerchSection.css";

// ─── Product Data ─────────────────────────────────────────────────────────────
// TO UPDATE: Replace href, image, name, price, and tag with real affiliate data.
// Each `href` should be your unique affiliate tracking link.
const MERCH_PRODUCTS = [
  {
    id: 1,
    name: "TrueVoice Hoodie",
    price: "$52",
    tag: "LOUD FAITH",
    tagStyle: "gold",
    href: "#",
    image: "/images/gear-hoodie.jpg",
    colorway: "#1a1a2e",
    accent: "#d4af37",
    scripture: "Ps 96:1",
  },
  {
    id: 2,
    name: "Unmute Truth Tee",
    price: "$34",
    tag: "NEW",
    tagStyle: "fire",
    href: "#",
    image: "/images/gear-unmute-tee.jpg",
    colorway: "#f5f0e8",
    accent: "#c0392b",
    scripture: "John 8:32",
  },
  {
    id: 3,
    name: "Heaven Louder Tee",
    price: "$34",
    tag: "FAN FAVORITE",
    tagStyle: "purple",
    href: "#",
    image: "/images/gear-heaven-tee.jpg",
    colorway: "#1c1c2e",
    accent: "#9b59b6",
    scripture: "Rom 8:31",
  },
  {
    id: 4,
    name: "Knit Beanie",
    price: "$28",
    tag: "WINTER DROP",
    tagStyle: "blue",
    href: "#",
    image: "/images/gear-beanie.jpg",
    colorway: "#1a1a2e",
    accent: "#275fdb",
    scripture: "Prov 3:5",
  },
  {
    id: 5,
    name: "Speak Truth Tee",
    price: "$34",
    tag: "BESTSELLER",
    tagStyle: "fire",
    href: "#",
    image: "/images/gear-speak-tee.jpg",
    colorway: "#1c1c2e",
    accent: "#e67e22",
    scripture: "Eph 4:15",
  },
  {
    id: 6,
    name: "TrueVoice Water Bottle",
    price: "$38",
    tag: "PREMIUM",
    tagStyle: "gold",
    href: "#",
    image: "/images/gear-bottle.jpg",
    colorway: "#0a0a0a",
    accent: "#d4af37",
    scripture: "John 4:14",
  },
];

// ─── Product Card ─────────────────────────────────────────────────────────────
function MerchCard({ product }) {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e) => {
    const url = product.href;
    if (!url || url === "#") {
      e.preventDefault();
      return;
    }
    // iOS PWA safe navigation
    const isIOSPWA =
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (isIOSPWA && navigator.share) {
      e.preventDefault();
      navigator.share({ url }).catch(() => { window.location.href = url; });
      return;
    }
  };

  return (
    <a
      href={product.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`tv-merch-card ${hovered ? "tv-merch-card--hovered" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      aria-label={`Shop ${product.name} — ${product.price}`}
      style={{ "--card-accent": product.accent, "--card-bg": product.colorway }}
    >
      {/* Tag badge */}
      <div className={`tv-merch-badge tv-merch-badge--${product.tagStyle}`}>
        {product.tag}
      </div>

      {/* Product visual */}
      <div className="tv-merch-visual">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="tv-merch-real-img"
            draggable="false"
          />
        ) : (
          <div className="tv-merch-placeholder" style={{"--card-accent": product.accent, "--card-color": product.colorway}}>
            <svg viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="tv-merch-cross">
              <rect x="24" y="0" width="12" height="80" rx="3" fill="currentColor"/>
              <rect x="0" y="22" width="60" height="12" rx="3" fill="currentColor"/>
            </svg>
          </div>
        )}

        {/* Hover overlay */}
        <div className="tv-merch-overlay">
          <span className="tv-merch-cta">Shop Now →</span>
        </div>
      </div>

      {/* Product info */}
      <div className="tv-merch-info">
        <div className="tv-merch-scripture">{product.scripture}</div>
        <div className="tv-merch-name">{product.name}</div>
        <div className="tv-merch-price">{product.price}</div>
      </div>
    </a>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────
export default function MerchSection() {
  return (
    <section className="tv-gear-section" aria-label="TrueVoice Gear Shop">
      {/* Section header */}
      <div className="tv-gear-header">
        <div className="tv-gear-eyebrow">FAITH IN BOLD</div>
        <h2 className="tv-gear-title">
          TrueVoice <span className="tv-gear-title-accent">Gear</span>
        </h2>
        <p className="tv-gear-subtitle">
          Wear your faith loud. Curated merch for believers who don't blend in.
        </p>
      </div>

      {/* Product grid */}
      <div className="tv-gear-grid">
        {MERCH_PRODUCTS.map((product) => (
          <MerchCard key={product.id} product={product} />
        ))}
      </div>

      {/* Footer CTA */}
      <div className="tv-gear-footer">
        <div className="tv-gear-coming-own">
          <span className="tv-gear-dot" aria-hidden="true" />
          TrueVoice original gear dropping soon — stay tuned
        </div>
      </div>
    </section>
  );
}
