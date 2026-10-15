import { useState } from "react";

export default function VideoThumbnail({ src, videoId, alt = "", className }) {
  const [failed, setFailed] = useState([]);
  const fallback = "/truevoice-favicon.png";
  const candidates = [src, videoId && `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, fallback].filter(Boolean);
  const current = candidates.find((candidate) => !failed.includes(candidate)) || fallback;
  return <img src={current} alt={alt} className={className} loading="lazy"
    data-fallback={current === fallback}
    onError={current === fallback ? undefined : () => setFailed((previous) => [...previous, current])} />;
}
