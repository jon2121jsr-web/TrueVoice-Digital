// api/ingest-feed.js
// Daily automated ingest for the Spiritual Scrolling feed (/scroll).
// Triggered by Vercel Cron (see vercel.json "crons"). Protected by
// CRON_SECRET so only Vercel's scheduler (or someone holding the secret)
// can trigger it -- this writes to feed_items with the service-role key,
// which bypasses RLS entirely.
//
// Three sources, each mapped to a feed_items item_type:
//   - TrueVoice's own shows            -> 'reel'  (full uploads, no clip trim)
//   - Curated music/worship artists    -> 'snip'  (same ingest path, different label)
//   - OurManna verse-of-the-day        -> 'verse' (same source VerseOfTheDay.jsx uses)
//
// Everything that passes the keyword screen goes straight to
// status='auto_active' -- no manual review queue. The channel allowlist
// below *is* the vetting step (John curates who's on it); the keyword
// screen is a lightweight backstop, mainly for the non-TrueVoice channels.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const YOUTUBE_API_KEY = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;

// ─── Channel allowlist ────────────────────────────────────────────────────
// item_type 'reel' -- TrueVoice's own shows (same channels as ReelsGrid.jsx
// / TrueVoiceConnect.jsx).
const REEL_CHANNELS = [
  { id: "UC_khbgasHiiwUxPHOMfbR0A", speaker: "Joel Norris",           source: "Pigskin Frenzy" },
  { id: "UCxcSYXrZQWHRF8iwdWCf3gg", speaker: "Denisha Workizer",      source: "Living the Reclaimed Life" },
  { id: "UCKr-liguaGWMf3f94eQXsug", speaker: "Cliffe Knechtle",       source: "Give Me an Answer" },
  { id: "UCVfwlh9XpX2Y_tQfjeln9QA", speaker: "BibleProject",          source: "BibleProject" },
  { id: "UCux-_Fze30tFuI_5CArwSmg", speaker: "Cameron Bertuzzi",      source: "Capturing Christianity" },
  { id: "UCm_RMW_fQk-ELpPYUzor8lw", speaker: "Allen Parr",            source: "The Beat by Allen Parr" },
  { id: "UCVFe7xhG6rl0ruoMQCJDtnw", speaker: "J. Warner Wallace",     source: "Cold Case Christianity" },
];

// item_type 'snip' -- curated music/worship artists (channel IDs researched
// and cross-checked against each artist's own site/bio, Sep 2026).
// Alana Springfield dropped -- no confidently-identified official channel.
// "Jordan Davis" on the original list resolved to Jordan St. Cyr.
const SNIP_CHANNELS = [
  { id: "UCKmcSqv0TcJMw_Bew0rawNQ", speaker: "Cory Asbury",                 source: "Cory Asbury" },
  { id: "UC27u44EeHMLGKFV7fYAY2ew", speaker: "Josh Baldwin",                source: "Josh Baldwin" },
  { id: "UCzu0vyhMK-03q3C1RpbTVww", speaker: "Jamie MacDonald",             source: "Jamie MacDonald" },
  { id: "UCki9DfoJu3ng0fOSV_51SZQ", speaker: "Cochren & Co",                source: "Cochren & Co" },
  { id: "UCPJFvbf8tNE9-_aYgeXfdKA", speaker: "Lauren Daigle",               source: "Lauren Daigle" },
  { id: "UCkEIal9gPIFeRHFkt0yXIlg", speaker: "Franni Cash",                 source: "Franni Cash" },
  { id: "UCoZTkqP5bhKeihbPpalsIIQ", speaker: "Benjamin William Hastings",   source: "Benjamin William Hastings" },
  { id: "UC3VijGbhKgqlwpvPqDoOL6w", speaker: "Seph Schlueter",              source: "Seph Schlueter" },
  { id: "UCJVhvnXSXF-raZDl6O2BlrQ", speaker: "Lifehouse",                  source: "Lifehouse" },
  { id: "UCi9lvMuNrySHqoFfiOLcudQ", speaker: "Switchfoot",                 source: "Switchfoot" },
  { id: "UC5__Uexru2WvNLuDc_v4y2g", speaker: "Mat Kearney",                source: "Mat Kearney" },
  { id: "UCl_X3EjSITWnwFVsq0hUvew", speaker: "TobyMac",                    source: "TobyMac" },
  { id: "UCAuUjH6w5FQjcxzUs-e-Szg", speaker: "We Are Messengers",          source: "We Are Messengers" },
  { id: "UCl4l--hjP42ETotjWUzQEBw", speaker: "Matt Maher",                 source: "Matt Maher" },
  { id: "UCue8bKszbbImxl7LstA_JDQ", speaker: "Erik Nieder",                source: "Erik Nieder" },
  { id: "UCs7x1ETqOho69bBQqHCJx7A", speaker: "Matthew West",               source: "Matthew West" },
  { id: "UC9upUGtX5mcWmfiokVWurAQ", speaker: "Peter Burton",               source: "Peter Burton" },
  { id: "UCUvrv1Ox5rRwzG-SHCN7zrg", speaker: "Brandon Lake",               source: "Brandon Lake" },
  { id: "UCbR1q9f7-C1itmIVpE9nHLw", speaker: "Jordan St. Cyr",             source: "Jordan St. Cyr" },
];

const MAX_NEW_PER_CHANNEL = 5; // per channel per run -- keeps each day's batch sane

// ─── Keyword screen ───────────────────────────────────────────────────────
// Case-insensitive substring match against title + description. Any hit
// skips the item entirely. Starter list, mainly aimed at the non-TrueVoice
// (music) channels -- tune freely as real ingested titles come in.
const BLOCKED_TERMS = [
  "explicit", "nsfw", "cover song", "reaction video", "unofficial",
  "bootleg", "leaked", "parody",
];

function isBlocked(title, description) {
  const text = `${title || ""} ${description || ""}`.toLowerCase();
  return BLOCKED_TERMS.some((term) => text.includes(term));
}

// ─── YouTube helpers ───────────────────────────────────────────────────────
// channels.list(contentDetails) + playlistItems.list is 1 quota unit each --
// far cheaper than search.list (100 units) -- so a daily run across ~26
// channels costs well under 100 units against the daily 10,000 quota,
// leaving plenty of headroom for the rest of the site.
async function youtube(endpoint, params) {
  const qs = new URLSearchParams({ ...params, key: YOUTUBE_API_KEY }).toString();
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${qs}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`YouTube ${endpoint} ${res.status}: ${json?.error?.message || "unknown error"}`);
  }
  return json;
}

async function fetchRecentUploads(channelId, maxResults) {
  const chRes = await youtube("channels", { part: "contentDetails", id: channelId });
  const uploadsPlaylistId = chRes?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return [];

  const plRes = await youtube("playlistItems", {
    part: "snippet,contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: String(maxResults),
  });
  return plRes?.items ?? [];
}

// ─── Ingest one channel bucket (reel or snip) ──────────────────────────────
async function ingestChannelGroup(channels, itemType) {
  let inserted = 0, skippedBlocked = 0, skippedExisting = 0;
  const errors = [];

  for (const channel of channels) {
    let videos;
    try {
      videos = await fetchRecentUploads(channel.id, MAX_NEW_PER_CHANNEL);
    } catch (err) {
      errors.push(`${channel.source}: ${err.message}`);
      continue;
    }

    for (const video of videos) {
      const youtubeId = video?.contentDetails?.videoId;
      const title = video?.snippet?.title;
      const description = video?.snippet?.description;
      if (!youtubeId || !title || title === "Private video" || title === "Deleted video") continue;

      if (isBlocked(title, description)) { skippedBlocked++; continue; }

      // upsert + ignoreDuplicates relies on the unique constraint on
      // youtube_id (see the accompanying migration) -- one round trip,
      // no race between a separate "does this exist" check and the insert.
      const { data, error: insertErr } = await supabaseAdmin
        .from("feed_items")
        .upsert(
          {
            item_type: itemType,
            status: "auto_active",
            title,
            description: description ? description.slice(0, 500) : null,
            source_show: channel.source,
            speaker: channel.speaker,
            youtube_id: youtubeId,
            source_channel_id: channel.id,
            published_at: video?.snippet?.publishedAt || new Date().toISOString(),
          },
          { onConflict: "youtube_id", ignoreDuplicates: true }
        )
        .select("id");

      if (insertErr) { errors.push(`${channel.source}/${youtubeId}: ${insertErr.message}`); continue; }
      if (data && data.length > 0) inserted++; else skippedExisting++;
    }
  }

  return { inserted, skippedBlocked, skippedExisting, errors };
}

// ─── Verse of the day (same source as the homepage VerseOfTheDay card) ────
async function ingestVerseOfTheDay() {
  // Already ran today? Don't duplicate.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: existing } = await supabaseAdmin
    .from("feed_items")
    .select("id")
    .eq("item_type", "verse")
    .gte("published_at", todayStart.toISOString())
    .maybeSingle();
  if (existing) return { inserted: 0, note: "verse already ingested today" };

  const res = await fetch("https://beta.ourmanna.com/api/v1/get/?format=json");
  const json = await res.json();
  const item = json?.verse?.details || json?.verse || {};
  const text = item.text;
  const reference = item.reference;
  if (!text || !reference) return { inserted: 0, note: "OurManna returned no verse" };

  const { error: insertErr } = await supabaseAdmin.from("feed_items").insert({
    item_type: "verse",
    status: "auto_active",
    verse_text: text,
    verse_ref: reference,
    published_at: new Date().toISOString(),
  });
  if (insertErr) return { inserted: 0, error: insertErr.message };
  return { inserted: 1 };
}

// ─── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Vercel Cron sends the CRON_SECRET as a bearer token when configured;
  // also accept it as a ?secret= query param for a manual test run.
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.query.secret;
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!YOUTUBE_API_KEY) {
    return res.status(500).json({ error: "Missing YouTube API key env var" });
  }

  try {
    const [reels, snips, verse] = await Promise.all([
      ingestChannelGroup(REEL_CHANNELS, "reel"),
      ingestChannelGroup(SNIP_CHANNELS, "snip"),
      ingestVerseOfTheDay(),
    ]);
    res.status(200).json({ ok: true, reels, snips, verse });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
