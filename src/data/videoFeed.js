// src/data/videoFeed.js
// Video content for TrueVoice Connect modals

export const VIDEO_SECTIONS = {
  WATCH_LIVE: 'WATCH_LIVE',
  NEW_EPISODES: 'NEW_EPISODES',        // ← Renamed from LISTEN_AGAIN
  SHORTS_AND_REELS: 'SHORTS_AND_REELS', // ← Renamed from MUSIC_TESTIMONIES
};

export const videoFeed = [
  // ═══════════════════════════════════════════════════════════════════════════
  // NEW EPISODES (formerly Listen Again)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'mESQkTA9AX0',
    title: 'Latest Episode',  // ← UPDATE THIS with actual title from YouTube
    description: 'Watch the latest from TrueVoice Digital',  // ← UPDATE THIS
    youtubeId: 'mESQkTA9AX0',
    thumbnailUrl: 'https://img.youtube.com/vi/mESQkTA9AX0/maxresdefault.jpg',
    section: 'NEW_EPISODES',
    featured: true,
    active: true,
    publishedAt: '2024-02-17T10:00:00Z',  // ← UPDATE THIS with actual publish date
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SHORTS & REELS (formerly Music & Testimonies)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'qlpeKRAAPuI',
    title: 'Short #1',  // ← UPDATE THIS with actual title
    description: 'Quick encouragement from TrueVoice',  // ← UPDATE THIS
    youtubeId: 'qlpeKRAAPuI',
    thumbnailUrl: 'https://img.youtube.com/vi/qlpeKRAAPuI/maxresdefault.jpg',
    section: 'SHORTS_AND_REELS',
    featured: true,
    active: true,
    publishedAt: '2024-02-17T09:00:00Z',
  },
  {
    id: 'ci_DHqR_8IU',
    title: 'Short #2',  // ← UPDATE THIS with actual title
    description: 'Daily word from TrueVoice',  // ← UPDATE THIS
    youtubeId: 'ci_DHqR_8IU',
    thumbnailUrl: 'https://img.youtube.com/vi/ci_DHqR_8IU/maxresdefault.jpg',
    section: 'SHORTS_AND_REELS',
    featured: false,
    active: true,
    publishedAt: '2024-02-16T09:00:00Z',
  },
  {
    id: 'CEFAcPF4nQA',
    title: 'Short #3',  // ← UPDATE THIS with actual title
    description: 'Faith in action',  // ← UPDATE THIS
    youtubeId: 'CEFAcPF4nQA',
    thumbnailUrl: 'https://img.youtube.com/vi/CEFAcPF4nQA/maxresdefault.jpg',
    section: 'SHORTS_AND_REELS',
    featured: false,
    active: true,
    publishedAt: '2024-02-15T09:00:00Z',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WATCH LIVE (placeholder for when live streaming starts)
  // ═══════════════════════════════════════════════════════════════════════════
  // {
  //   id: 'your_live_video_id',
  //   title: 'Sunday Service Live',
  //   description: 'Join us live every Sunday at 10 AM',
  //   youtubeId: 'your_live_video_id',
  //   thumbnailUrl: 'https://img.youtube.com/vi/your_live_video_id/maxresdefault.jpg',
  //   section: 'WATCH_LIVE',
  //   featured: true,
  //   active: true,
  //   publishedAt: '2024-02-18T15:00:00Z',
  // },
];
