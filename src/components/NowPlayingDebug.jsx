// src/components/NowPlayingDebug.jsx
//
// Safe debug panel for AzuraCast now-playing.
// Uses fetchRawNowPlaying from src/services/azuracast.js
// and shows both a quick summary + full JSON payload.
//
// NOTE: This component is NOT used anywhere by default.
// The live UI won't change unless you explicitly import
// and render <NowPlayingDebug /> somewhere.

import React, { useEffect, useState } from "react";
import { fetchRawNowPlaying } from "../services/azuracast";

export function NowPlayingDebug() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchRawNowPlaying();
        if (isMounted) {
          setPayload(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("[NowPlayingDebug] error:", err);
          setError(err?.message || "Failed to load now-playing payload.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    const id = window.setInterval(load, 30000); // 30s poll
    return () => {
      isMounted = false;
      window.clearInterval(id);
    };
  }, []);

  const np = payload && (payload.now_playing || payload);
  const song = np?.song || {};
  const listeners =
    payload?.listeners?.total ??
    payload?.listeners?.current ??
    payload?.listeners ??
    null;
  const isLive = !!(payload?.live && payload.live.is_live);
  const liveStreamer = payload?.live?.streamer_name || null;

  return (
    <div
      style={{
        marginTop: "2rem",
        padding: "1rem",
        borderRadius: "12px",
        background: "#f5f5ff",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: "0.85rem",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
        AzuraCast NowPlaying Debug
      </h3>

      {loading && <p>Loading raw now-playing data…</p>}

      {error && (
        <p style={{ color: "#b00020", fontWeight: 600 }}>
          Error: {error}
        </p>
      )}

      {!loading && !error && np && (
        <div style={{ marginBottom: "0.75rem" }}>
          <div>
            <strong>Title:</strong> {song.title || "—"}
          </div>
          <div>
            <strong>Artist:</strong> {song.artist || "—"}
          </div>
          <div>
            <strong>Is Live:</strong> {isLive ? "Yes" : "No"}
          </div>
          <div>
            <strong>Streamer:</strong> {liveStreamer || "—"}
          </div>
          <div>
            <strong>Listeners:</strong>{" "}
            {listeners != null ? listeners : "—"}
          </div>
        </div>
      )}

      <details>
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 600,
            marginBottom: "0.5rem",
          }}
        >
          Raw JSON Payload
        </summary>
        <pre
          style={{
            maxHeight: "300px",
            overflow: "auto",
            background: "#1e1e2f",
            color: "#eaeaff",
            padding: "0.75rem",
            borderRadius: "8px",
            fontSize: "0.75rem",
          }}
        >
          {payload
            ? JSON.stringify(payload, null, 2)
            : "// No data loaded yet"}
        </pre>
      </details>
    </div>
  );
}
