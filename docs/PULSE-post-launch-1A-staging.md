# PULSE post-launch 1A staged Production deployment

Date: 2026-10-15. Status: Ready for manual listening; NOT promoted.

## Immutable release

- Fix branch: `fix/pulse-postlaunch-1a`.
- Commit: `337ef9d413ef41739d03f4442de95d83ad1fb37d`.
- Parent/live baseline: `b081708f5c981380b521c88a18abdfa26b1b2e2b`.
- Commit message: `fix: synchronize PULSE metadata and refresh web icons`.
- Detached deployment worktree: `.release-staging/postlaunch-1a`.
- Only the 24 explicitly reviewed metadata, web-icon, test, generator and implementation-report files were committed. No native, dependency/lockfile, tracked environment, Drop Portal or unrelated changes were included. Pre-existing personal outputs and the untracked Phase 5E report remain outside the commit.

## Verification

- 65/65 tests PASS, run sequentially against the completed production/PWA build.
- Targeted ESLint PASS: `NowPlayingPanel.jsx`, `metadataTimeline.js`, `api.js`, `vite.config.js`.
- `git diff --check` and staged diff check PASS.
- Local production/PWA build PASS: 807 modules, 16 precache entries; service worker and Workbox generated.
- Local memory pressure initially caused allocation failures. After the user freed memory, the final build passed with process-local `NODE_OPTIONS=--max-old-space-size=384 --max-semi-space-size=4` and `RAYON_NUM_THREADS=1`. No project settings were changed.
- Production `VITE_STREAM_DELAY_SEC` was confirmed to remain `15` immediately before staging. No Vercel variables were changed. `VITE_STREAM_METADATA_DELAY_SEC` remains unused by the LIVE controller.

## Staging result

Team: `johns-projects-861a7d26` (`team_qJIIDlYcPRRWTRbel8YtLlxd`).
Project: `true-voice-digital` (`prj_OMhlrkRX8NFQCMidqT4Z0shSzKOt`).

One deployment was executed from the verified clean detached worktree, using process-local project/organization IDs:

```powershell
vercel.cmd --scope johns-projects-861a7d26 deploy --prod --skip-domain --meta releaseCommit=337ef9d413ef41739d03f4442de95d83ad1fb37d
```

- Deployment: `dpl_2k21QhhiSyQP5fMziEHgic9cS7A4`.
- Immutable test URL: https://true-voice-digital-7205qdimf-johns-projects-861a7d26.vercel.app
- Inspector: https://vercel.com/johns-projects-861a7d26/true-voice-digital/2k21QhhiSyQP5fMziEHgic9cS7A4
- Status: `READY`; target: `production`; project ID and `meta.releaseCommit` match the approved committed source.
- Deployment metadata includes `VERCEL_ENV` and `VERCEL_TARGET_ENV` in its environment-name lists; the production guard passed during the cloud build. No privileged runtime endpoints were called to test classification.
- Cloud build PASS: Vite 7.3.7, 807 modules, PWA 16 precache entries (~1027.04 KiB), generated `sw.js` and `workbox-080c8b91.js`.
- Nonfatal cloud warnings: existing >500 kB JS chunk, 8 moderate dependency advisories, npm cache-dir deprecation and dependency install-script notices. Dependencies were not changed to clear warnings.
- CLI assigned the Vercel convenience alias `true-voice-digital-johns-projects-861a7d26.vercel.app`; use the immutable test URL above. This is distinct from the two custom public domains.
- Post-completion inspections of **both** `www.truevoice.digital` and `truevoice.digital` still resolve to Ready deployment **`dpl_HmbTwRKST61h4VuSiUYmEJUYWfpd`**, the existing public PULSE release. Neither public domain was promoted to this fix.
- An unauthenticated request to the staged URL redirects to Vercel SSO. Manual testers must sign into an account with access to John's projects. No access settings were changed. CLI 56.5.0's automatic curl helper can create a bypass token when none exists, so it was not invoked; protected deployed asset bodies and audible behavior were not independently browser-verified here. Local build/icon validation passed.

## Exact manual listening procedure

1. Use foreground Chrome with headphones and an accurate system clock. Open a fresh browser profile or Incognito window. Sign into Vercel using the account that can access John's projects. Open only the **immutable staged URL above** for this test; keep the public site paused/closed so a second player cannot confuse the result.
2. The Production-classified app retains its normal analytics behavior. If the no-production-writes constraint is to apply to browser telemetry as well, open DevTools on a blank tab first, enable Network request blocking for analytics requests (`*analytics*`) and Supabase (`*.supabase.co/*`), and keep DevTools open before navigating to the staged app. Add the actual analytics URL if a custom endpoint does not contain “analytics”. Do not interpret intentionally blocked telemetry/Supabase requests as playback failures; do not block the AzuraCast metadata or MP3 URLs. Do not sign into the application, submit forms, upload, invoke administrative routes or initiate payments.
3. In Network, confirm metadata GETs go to the configured AzuraCast endpoint approximately every 5 seconds and note the actual MP3 request URL. The live baseline selected direct AzuraCast MP3 rather than the LIVE365 source fallback. Leave browser/OS volume fixed. Press LIVE once and allow at least one full track transition before measuring; initial joining metadata publishes immediately.
4. Keep the tab visible and listen through **at least five consecutive song changes**, preferably including a short track. For each, record: old/new title, audible transition time, displayed title/artist time, artwork time, and `display time minus audible time`. Positive means late; negative means early. Target is approximately -5 to +5 seconds with no repeated flips, stale rollback or wrong artwork. If useful, record `now_playing.played_at`, `elapsed`, and response receipt time from Network without changing the response. Do not assume the next-song estimate is authoritative.
5. Check the title/artist/artwork tuple changes consistently and the MediaSession display follows it. Artwork loading still depends on network success. There is no automatic song-matched YouTube video in this release: independently selected EXPLORE/Scroll videos should not be retargeted by radio song changes. Record any specific externally observed “video” mismatch separately.
6. Pause LIVE, wait 10–20 seconds, then resume. Confirm it reconnects to current live audio and does not replay a stale buffer. Repeat a measured transition after resuming. Open one EXPLORE video: LIVE must pause. Exercise Next/Previous; close the modal; explicitly press LIVE to resume. Verify no competing radio/video audio or unexpected automatic radio restart.
7. Verify the blue waveform favicon in a fresh tab, all four Hero slides, header, and direct `/explore` refresh. Inspect Application → Manifest/Service Workers for versioned waveform icon URLs and active worker. Installed-PWA icon refresh and Safari need separate manual testing; Chrome results do not establish Safari compatibility. An existing installed icon can require relaunch or reinstallation.
8. Report the five signed timing offsets, device/OS/browser version, actual audio URL, any flicker/artwork mismatch, playback/navigation result, and favicon/PWA observations. Leave `VITE_STREAM_DELAY_SEC=15` throughout. If residual delay remains, stop and report it; no environment adjustment or public promotion is authorized by these results.

GO for the manual staged listening comparison. The 0–5-second target remains unverified. No promotion, Git push/merge, rollback, environment change, SQL, application database writes or payment transactions were performed by this staging work.

This staging-result report remains uncommitted so that the deployed source commit stays immutable.
