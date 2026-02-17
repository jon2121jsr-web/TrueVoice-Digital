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
    id: "tv-gear-01",
    name: "No Weapon Formed Tee",
    price: "$34",
    tag: "BESTSELLER",
    tagStyle: "gold",
    href: "#",  // ← replace with affiliate link
    // Use a real product image URL from the affiliate partner:
    image: null,
    colorway: "#1a0a00",
    accent: "#ff6b00",
    scripture: "Isaiah 54:17",
  },
  {
    id: "tv-gear-02",
    name: "Armour of God Hoodie",
    price: "$68",
    tag: "NEW",
    tagStyle: "fire",
    href: "#",
    image: null,
    colorway: "#000000",
    accent: "#e63946",
    scripture: "Ephesians 6:11",
  },
  {
    id: "tv-gear-03",
    name: "Lion of Judah Heavyweight",
    price: "$42",
    tag: "LIMITED",
    tagStyle: "purple",
    href: "#",
    image: null,
    colorway: "#0d0d0d",
    accent: "#9d4edd",
    scripture: "Revelation 5:5",
  },
  {
    id: "tv-gear-04",
    name: "Faith Over Fear Crewneck",
    price: "$58",
    tag: "TRENDING",
    tagStyle: "blue",
    href: "#",
    image: null,
    colorway: "#050816",
    accent: "#2563eb",
    scripture: "2 Timothy 1:7",
  },
  {
    id: "tv-gear-05",
    name: "I Am Not Ashamed Drop-Shoulder",
    price: "$38",
    tag: "BOLD",
    tagStyle: "gold",
    href: "#",
    image: null,
    colorway: "#1a1a1a",
    accent: "#f4a261",
    scripture: "Romans 1:16",
  },
  {
    id: "tv-gear-06",
    name: "Kingdom Come Oversized Tee",
    price: "$36",
    tag: "NEW",
    tagStyle: "fire",
    href: "#",
    image: null,
    colorway: "#0a0a0a",
    accent: "#e63946",
    scripture: "Matthew 6:10",
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
            className="tv-merch-img"
            loading="lazy"
          />
        ) : (
          // Placeholder until real product images are loaded
          <div className="tv-merch-placeholder">
            <div className="tv-merch-placeholder-cross" aria-hidden="true">✝</div>
            <div className="tv-merch-placeholder-label">TrueVoice Gear</div>
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
