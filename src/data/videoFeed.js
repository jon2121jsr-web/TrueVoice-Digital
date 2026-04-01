// src/data/videoFeed.js
// Video content for TrueVoice Connect modals
// When adding new videos, set featured: true on the newest one
// and set featured: false on the previous one.

export const VIDEO_SECTIONS = {
  WATCH_LIVE:       'WATCH_LIVE',
  NEW_EPISODES:     'NEW_EPISODES',
  SHORTS_AND_REELS: 'SHORTS_AND_REELS',
  PIGSKIN_FRENZY:   'PIGSKIN_FRENZY',
  CHURCH_IN_SHORTS: 'CHURCH_IN_SHORTS',
};

export const videoFeed = [
  // ═══════════════════════════════════════════════════════════════════════════
  // NEW EPISODES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id:           'hIgy8zgcLH0',
    title:        'The Church — Latest Episode',
    description:  'Real Truth. Real Church. In Short Video.',
    youtubeId:    'hIgy8zgcLH0',
    thumbnailUrl: 'https://img.youtube.com/vi/hIgy8zgcLH0/maxresdefault.jpg',
    section:      'NEW_EPISODES',
    featured:     true,
    active:       true,
    publishedAt:  '2025-03-09T10:00:00Z',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SHORTS & REELS — newest first
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id:           'BeUX5DGGj0s',
    title:        'The Church — Short',
    description:  'Real Truth. Real Church. In Short Video.',
    youtubeId:    'BeUX5DGGj0s',
    thumbnailUrl: 'https://img.youtube.com/vi/BeUX5DGGj0s/maxresdefault.jpg',
    section:      'SHORTS_AND_REELS',
    featured:     true,
    active:       true,
    publishedAt:  '2025-03-09T09:00:00Z',
  },
  {
    id:           '35nP63Hh91E',
    title:        'The Church — Short',
    description:  'Real Truth. Real Church. In Short Video.',
    youtubeId:    '35nP63Hh91E',
    thumbnailUrl: 'https://img.youtube.com/vi/35nP63Hh91E/maxresdefault.jpg',
    section:      'SHORTS_AND_REELS',
    featured:     false,
    active:       true,
    publishedAt:  '2025-03-08T09:00:00Z',
  },
  {
    id:           'z2WqMQgNjs0',
    title:        'The Church — Short',
    description:  'Real Truth. Real Church. In Short Video.',
    youtubeId:    'z2WqMQgNjs0',
    thumbnailUrl: 'https://img.youtube.com/vi/z2WqMQgNjs0/maxresdefault.jpg',
    section:      'SHORTS_AND_REELS',
    featured:     false,
    active:       true,
    publishedAt:  '2025-03-07T09:00:00Z',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PIGSKIN FRENZY — newest first
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id:           '2yASg53Y9iw',
    title:        'Episode 310: 2026 Spring Outlooks: Kentucky, Arkansas, UCLA, & Ole Miss',
    description:  'The boldest takes in College Football. Unfiltered analysis. Unashamed faith.',
    youtubeId:    '2yASg53Y9iw',
    thumbnailUrl: 'https://img.youtube.com/vi/2yASg53Y9iw/maxresdefault.jpg',
    section:      'PIGSKIN_FRENZY',
    featured:     true,
    active:       true,
    publishedAt:  '2026-03-31T10:00:00Z',
  },
  {
    id:           'gC4VikZ0dcA',
    title:        'Pigskin Frenzy — Latest Episode',
    description:  'The boldest takes in College Football. Unfiltered analysis. Unashamed faith.',
    youtubeId:    'gC4VikZ0dcA',
    thumbnailUrl: 'https://img.youtube.com/vi/gC4VikZ0dcA/maxresdefault.jpg',
    section:      'PIGSKIN_FRENZY',
    featured:     false,
    active:       true,
    publishedAt:  '2025-03-17T10:00:00Z',
  },
  {
    id:           'rvNBHCgsMTc',
    title:        'Pigskin Frenzy — Episode 2',
    description:  'The boldest takes in College Football. Unfiltered analysis. Unashamed faith.',
    youtubeId:    'rvNBHCgsMTc',
    thumbnailUrl: 'https://img.youtube.com/vi/rvNBHCgsMTc/maxresdefault.jpg',
    section:      'PIGSKIN_FRENZY',
    featured:     false,
    active:       true,
    publishedAt:  '2025-03-09T10:00:00Z',
  },
  {
    id:           'clVOoGRAVMQ',
    title:        'Pigskin Frenzy — Episode 3',
    description:  'The boldest takes in College Football. Unfiltered analysis. Unashamed faith.',
    youtubeId:    'clVOoGRAVMQ',
    thumbnailUrl: 'https://img.youtube.com/vi/clVOoGRAVMQ/maxresdefault.jpg',
    section:      'PIGSKIN_FRENZY',
    featured:     false,
    active:       true,
    publishedAt:  '2025-03-08T10:00:00Z',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHURCH IN SHORTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id:           'church-1BngrEWflKs',
    title:        'The Church — Latest Episode',
    description:  'Real Truth. Real Church. In Short Video.',
    youtubeId:    'hIgy8zgcLH0',
    thumbnailUrl: 'https://img.youtube.com/vi/hIgy8zgcLH0/maxresdefault.jpg',
    section:      'CHURCH_IN_SHORTS',
    featured:     true,
    active:       true,
    publishedAt:  '2025-03-09T10:00:00Z',
  },
];