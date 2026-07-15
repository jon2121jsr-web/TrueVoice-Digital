import "./MerchSection.css";

const MERCH_PRODUCTS = [
  {
    id: 1,
    name: "TrueVoice Hoodie",
    price: "$30.29",
    tag: "LOUD FAITH",
    tagStyle: "gold",
    image: "/images/gear-hoodie.jpg",
    accent: "#d4af37",
    scripture: "Ps 96:1",
  },
  {
    id: 2,
    name: "Unmute Truth Tee",
    price: "$14.75",
    tag: "NEW",
    tagStyle: "fire",
    image: "/images/gear-unmute-tee.jpg",
    accent: "#c0392b",
    scripture: "John 8:32",
  },
  {
    id: 3,
    name: "Heaven Louder Tee",
    price: "$14.75",
    tag: "FAN FAVORITE",
    tagStyle: "purple",
    image: "/images/gear-heaven-tee.jpg",
    accent: "#9b59b6",
    scripture: "Rom 8:31",
  },
  {
    id: 4,
    name: "Knit Beanie",
    price: "$16.79",
    tag: "WINTER DROP",
    tagStyle: "blue",
    image: "/images/gear-beanie.jpg",
    accent: "#275fdb",
    scripture: "Prov 3:5",
  },
  {
    id: 5,
    name: "Speak Truth Tee",
    price: "$14.75",
    tag: "BESTSELLER",
    tagStyle: "fire",
    image: "/images/gear-speak-tee.jpg",
    accent: "#e67e22",
    scripture: "Eph 4:15",
  },
  {
    id: 6,
    name: "TrueVoice Water Bottle",
    price: "$23.35",
    tag: "PREMIUM",
    tagStyle: "gold",
    image: "/images/gear-bottle.jpg",
    accent: "#d4af37",
    scripture: "John 4:14",
  },
];

function MerchCard({ product }) {
  return (
    <div className="tv-merch-card">
      <div className="tv-merch-visual">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="tv-merch-real-img"
            draggable="false"
          />
        ) : (
          <div className="tv-merch-placeholder" style={{ background: "#1a1a2e" }}>
            <svg viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="tv-merch-cross">
              <rect x="24" y="0" width="12" height="80" rx="3" fill="currentColor"/>
              <rect x="0" y="22" width="60" height="12" rx="3" fill="currentColor"/>
            </svg>
          </div>
        )}
        <div className={`tv-merch-badge tv-merch-badge--${product.tagStyle}`}>
          {product.tag}
        </div>
      </div>

      <div className="tv-merch-info">
        <span className="tv-merch-scripture" style={{ color: product.accent }}>
          {product.scripture}
        </span>
        <h3 className="tv-merch-name">{product.name}</h3>
        <p className="tv-merch-price">{product.price}</p>

        <button
          className="tv-merch-buy-btn"
          onClick={() => window.open("https://shop.truevoice.digital", "_blank", "noopener,noreferrer")}
          style={{ background: product.accent }}
        >
          Shop Now →
        </button>
      </div>
    </div>
  );
}

export default function MerchSection() {
  return (
    <section className="tv-gear-section" id="merch">
      <div className="tv-gear-header">
        <span className="tv-gear-eyebrow">FAITH IN BOLD</span>
        <h2 className="tv-gear-title">
          TRUEVOICE <span className="tv-gear-accent">GEAR</span>
        </h2>
        <p className="tv-gear-subtitle">
          Wear your faith loud. Curated merch for believers who don't blend in.
        </p>
      </div>

      <div className="tv-gear-grid">
        {MERCH_PRODUCTS.map((product) => (
          <MerchCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
