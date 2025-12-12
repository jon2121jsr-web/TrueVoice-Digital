// src/components/NowPlaying.jsx
import React, { useEffect, useState } from "react";
import { fetchNowPlaying } from "../services/azuracast";

export default function NowPlaying() {
  const [nowPlaying, setNowPlaying] = useState(null);
  const [listeners, setListeners] = useState(0);
  const [isLive, setIsLive] = useState(false);

  const loadNowPlaying = async () => {
    const data = await fetchNowPlaying();
    setNowPlaying(data);
    setListeners(data.listeners);
    setIsLive(data.is_live);
  };

  useEffect(() => {
    loadNowPlaying();              // initial load
    const interval = setInterval(loadNowPlaying, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, []);

  if (!nowPlaying) {
    return (
      <div className="now-playing-card">
        <p>Loading Now Playing…</p>
      </div>
    );
  }

  return (
    <div className="now-playing-card">
      <div className="np-header">
        <h3>{isLive ? "🔴 LIVE" : "Now Playing"}</h3>
        <span className="listener-count">{listeners} Listening</span>
      </div>

      <img
        src={nowPlaying.art}
        alt="Album Art"
        className="np-art"
      />

      <div className="np-info">
        <h2 className="np-title">{nowPlaying.title}</h2>
        <p className="np-artist">{nowPlaying.artist}</p>

        {nowPlaying.next && (
          <div className="np-next">
            <strong>Up Next:</strong>{" "}
            {nowPlaying.next.title} — {nowPlaying.next.artist}
          </div>
        )}
      </div>
    </div>
  );
}
