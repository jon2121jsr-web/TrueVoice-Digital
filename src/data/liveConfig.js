// src/data/liveConfig.js
// ─────────────────────────────────────────────────────────────────
//  HOW TO GO LIVE:
//  1. Set isLive to true
//  2. Paste the YouTube Live video ID into videoId (the part after ?v=)
//     Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ
//              video ID = dQw4w9WgXcQ
//  3. Save the file
//  4. git add src/data/liveConfig.js
//  5. git commit -m "go live"
//  6. git push origin main
//  Site updates automatically within ~60 seconds.
//
//  TO END THE LIVE STREAM:
//  1. Set isLive back to false
//  2. Clear videoId back to ""
//  3. Repeat steps 3-6 above
// ─────────────────────────────────────────────────────────────────

export const LIVE_CONFIG = {
  isLive:  true,
  videoId: "",     // paste YouTube Live video ID here when going live
};