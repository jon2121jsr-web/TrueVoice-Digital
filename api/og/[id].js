/**
 * Per-item Open Graph card — /api/og/[id].js
 *
 * TrueVoice Digital is a client-rendered SPA (Vite, no SSR) -- every route
 * normally serves the same static index.html, so a shared /scroll/:id link
 * would preview as the generic homepage no matter what card it points to.
 *
 * vercel.json rewrites requests to /scroll/:id to this function, but ONLY
 * when the User-Agent matches a known link-preview bot (Facebook, Twitter,
 * Slack, iMessage/Applebot, etc.) -- the standard "dynamic rendering"
 * workaround for a CSR app. A real visitor's browser never hits this file;
 * it still gets the SPA and ScrollFeed's own deep-link handling.
 *
 * Env vars (same names as api/analytics.js and api/ingest-feed.js):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SITE_URL = process.env.VITE_SITE_URL || 'https://truevoice.digital';
const FALLBACK_IMAGE = `${SITE_URL}/truevoice-favicon.png`;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function describeItem(item) {
  if (!item) {
    return { title: 'TrueVoice Digital', description: 'Spiritual Scrolling on TrueVoice Digital.', image: FALLBACK_IMAGE };
  }

  if (item.item_type === 'verse') {
    return {
      title: item.verse_ref ? `${item.verse_ref} · TrueVoice Digital` : 'Verse of the Day · TrueVoice Digital',
      description: item.verse_text ? `"${item.verse_text}"` : 'A verse from TrueVoice Digital.',
      image: FALLBACK_IMAGE,
    };
  }

  if (item.item_type === 'meme') {
    return {
      title: item.caption || 'TrueVoice Digital',
      description: 'Shared from TrueVoice Digital.',
      image: item.image_url || FALLBACK_IMAGE,
    };
  }

  // reel / snip
  return {
    title: item.title || 'TrueVoice Digital',
    description: [item.speaker, item.source_show].filter(Boolean).join(' · ') || 'Watch on TrueVoice Digital.',
    image: item.youtube_id ? `https://img.youtube.com/vi/${item.youtube_id}/hqdefault.jpg` : FALLBACK_IMAGE,
  };
}

export default async function handler(req, res) {
  const { id } = req.query;

  let item = null;
  if (id) {
    try {
      const { data } = await supabase.from('feed_items').select('*').eq('id', id).maybeSingle();
      item = data ?? null;
    } catch {
      // Bad or unreachable DB -- fall through to the generic card rather
      // than error out and lose the preview entirely.
    }
  }

  const { title, description, image } = describeItem(item);
  const url = `${SITE_URL}/scroll/${id ?? ''}`;

  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(image);
  const u = escapeHtml(url);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short cache -- content gets reviewed/edited from the admin queue and a
  // stale preview from a hard-cached edge response isn't worth the risk.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${t} · TrueVoice Digital</title>
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${u}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TrueVoice Digital">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
</head>
<body></body>
</html>`);
}
