import { Link } from "react-router-dom";
import VideoThumbnail from "../../components/VideoThumbnail";
export default function DiscoveryRail({ id, variant, title, description, cards, loading, error, empty, footer }) {
  return <section id={id} className={`pulse-discovery${variant ? ` pulse-discovery--${variant}` : ""}`} aria-label={title}>
    <div className="pulse-discovery__heading"><h2>{title}</h2><p>{description}</p></div>
    {loading && <p className="pulse-discovery__status" role="status">Loading {title.toLowerCase()}…</p>}
    {!loading && error && <p className="pulse-discovery__status" role="status">This feed is unavailable right now. Explore another section or try again later.</p>}
    {!loading && !error && cards.length === 0 && <p className="pulse-discovery__status" role="status">{empty}</p>}
    {cards.length > 0 && <div id={id ? `${id}-cards` : undefined} className="pulse-discovery__rail" tabIndex={0} aria-label={`${title} cards`}>
      {cards.map(card => {
        const content = <><div className="pulse-discovery__art"><VideoThumbnail src={card.art} videoId={card.videoId} /><span>{card.label}</span></div><div className="pulse-discovery__body"><h3>{card.title}</h3><p>{card.subtitle}</p>{card.action && <span className="pulse-discovery__action">{card.action}</span>}</div></>;
        if (card.to && card.onOpen) return <div key={card.id} className="pulse-discovery__card">
          <button type="button" className="pulse-discovery__open" onClick={card.onOpen} aria-label={`Play ${card.title}`}>{content}</button>
          <Link className="pulse-discovery__scroll" to={card.to}>View in Scroll →</Link>
        </div>;
        return card.to ? <Link key={card.id} to={card.to} className="pulse-discovery__card">{content}</Link> : <button key={card.id} type="button" className="pulse-discovery__card" onClick={card.onOpen}>{content}</button>;
      })}
    </div>}
    {footer}
  </section>;
}
