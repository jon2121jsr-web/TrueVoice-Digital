// src/data/videoFeed.js

export const VIDEO_SECTIONS = {
  WATCH_LIVE: "watch_live",
  LISTEN_AGAIN: "listen_again",
  MUSIC_TESTIMONIES: "music_testimonies",
};

/**
 * Add/maintain content here.
 * Workflow:
 * 1) Upload to YouTube
 * 2) Paste the videoId (recommended) OR a full URL
 * 3) Deploy
 */
export const videoFeed = [
  {
    id: "live-1",
    section: VIDEO_SECTIONS.WATCH_LIVE,
    title: "TrueVoice Live",
    description: "Join the live studio stream when we’re on air.",
    videoId: "YOUR_LIVE_VIDEO_ID", // <-- replace
    featured: true,
    active: true,
    publishedAt: "2026-01-01",
  },
  {
    id: "replay-1",
    section: VIDEO_SECTIONS.LISTEN_AGAIN,
    title: "Listen Again",
    description: "Catch replays of recent shows and messages.",
    videoId: "YOUR_REPLAY_VIDEO_ID", // <-- replace
    featured: true,
    active: true,
    publishedAt: "2026-01-08",
  },
  {
    id: "mt-1",
    section: VIDEO_SECTIONS.MUSIC_TESTIMONIES,
    title: "Music & Testimonies",
    description: "Watch new music videos and stories of faith.",
    videoId: "YOUR_MUSIC_OR_TESTIMONY_VIDEO_ID", // <-- replace
    featured: true,
    active: true,
    publishedAt: "2026-01-05",
  },
];
