# PULSE post-launch fixes 1A

Date: 2026-10-15. Branch: `fix/pulse-postlaunch-1a`.
Base/HEAD: `b081708f5c981380b521c88a18abdfa26b1b2e2b`.
This report originally recorded the uncommitted implementation review. The user
subsequently authorized committing these fixes and one staged Production
deployment with `--prod --skip-domain`, retaining the delay at 15. Promotion,
push/merge and environment changes remain unauthorized. The staging result is
recorded separately after the immutable commit is created.

## Baseline and boundaries

Read-only Vercel inspection resolved `www.truevoice.digital` to Ready Production deployment `dpl_HmbTwRKST61h4VuSiUYmEJUYWfpd`. Its `meta.releaseCommit` matches the base above. The branch was created from that verified commit. Existing untracked `.release-staging/`, `Claude outputs/`, and `docs/PULSE-Phase5E-production-release-authorization.md` were preserved and are outside this change.

No deployment, promotion, push, merge, environment/settings changes, SQL, transactions, uploads, native changes, or production-data tests were performed. Production inspection used GETs and public assets only. Only the two requested, non-secret timing values were read; credentials were not printed or written to files.

## Metadata diagnosis: confirmed causes and limits

The live bundle contains `Ste("15",65)` and queues each detected new song for `Date.now() + 15 * 1000`. This proves that the active hold is **15 seconds**, not the source fallback of 65 seconds. Production currently has:

| Setting | Value | Actual use |
| --- | --- | --- |
| `VITE_STREAM_DELAY_SEC` | `15` | LIVE controller's post-detection hold in the released code |
| `VITE_STREAM_METADATA_DELAY_SEC` | `35` | Unused by this controller; not an additional 35-second hold |

The released controller polls every 15 seconds. It ignores `played_at`, `elapsed`, and `remaining` when scheduling the UI change. Thus a new song already 20 seconds old still gets another full 15-second hold. `fetchNowPlaying()` allows normal HTTP caching; the PWA additionally has NetworkFirst metadata caching with a 30-second expiry and an offline stale-response path. NetworkFirst normally attempts the network; that worker policy alone does **not** prove a regular 30-second delay.

Public AzuraCast responses had `Cache-Control: public, max-age=15`. At UTC epoch `1792103562`, `played_at=1792103421`, but `elapsed=129`: the source snapshot was approximately 12 seconds behind wall-clock age. A later request with cache revalidation at epoch `1792103622` had `played_at=1792103598` and `elapsed=20` (approximately 4 seconds behind). These are read-only samples, not continuous transition measurements.

Confirmed avoidable causes are the arrival-based hold, slow polling, and permitted HTTP freshness/stale fallback. Polling (up to ~15 seconds), HTTP freshness (up to ~15 seconds), the fixed 15-second hold, upstream snapshot age, and the one-second scheduler can compound. This is consistent with the reported 45–55 seconds, but the exact audible offset and each layer's contribution were **not measured** here. The `35` setting is not the root cause in this source release.

Important audio finding: despite the LIVE365 default in `App.jsx`, the **actual public bundle** selects `https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3`. Production overrides the LIVE365 fallback. Both paths and `preferredStreamUrl()` were inspected; no audio URL or native HLS selection was changed. Browser buffering, reconnection, upstream metadata publication, cross-service relays if LIVE365 is selected later, and background timer throttling prevent a universal wall-clock-to-audible guarantee.

## Implemented timing correction

- Poll every 5 seconds with a single in-flight request per mounted controller.
- Fetch metadata with `cache: "no-store"`; the generated worker uses NetworkOnly for AzuraCast API requests. This bypasses browser metadata caching and avoids replaying the worker's old metadata cache. It cannot force AzuraCast's internal snapshots to refresh.
- Schedule against `played_at + configured stream delay`, consuming time already elapsed rather than starting the delay again after each poll. Missing timestamps publish promptly instead of inventing a new hold. Initial join also displays the available current song immediately.
- Reject older timestamped snapshots and conflicting songs with the same source start time. Repeated observations and artwork refinements do not restart a pending deadline. A single song object updates title, artist, album and artwork together and continues feeding App/MediaSession.
- Missing/invalid delay now defaults to zero instead of a hidden 65-second hold. Valid existing Production value 15 is retained.
- Do not predict changes from `playing_next`: one observed estimate was `1792103600`, while that track actually began at `1792103598`. Queue edits, live programming, and timing estimates can differ. Guessing would risk incorrect song/artwork changes.
- Audio play/pause/resume, recovery, live-edge reconnection, MediaSession commands, and video ownership logic are unchanged.

For an established foreground session with valid timestamps, publication is approximately `max(first fresh observation, played_at + 15 seconds)`, with up to one additional scheduler second for a pending change. The source is checked every 5 seconds. Example regression: a song starting at second 200 and observed at second 212 now changes at 215, rather than 227. Already-overdue metadata publishes on observation. Source timestamp validity and the device clock still matter.

The existing release has **no automatic song-matched YouTube video linkage**. EXPLORE/Scroll videos and their modal queues are independently selected; the LIVE presentation has artwork, not an automatic music-video player. No attempt was made to retarget an independently playing video when radio metadata changes. If the reported “video” refers to an external stream/player, it needs its own reproduction and authoritative track mapping. Tests verify audio/video coordination is preserved, not song-video synchronization.

### Environment recommendation

No Vercel variable change is required to run this code improvement. No variables were changed. Keep the current 15-second value for the first controlled comparison rather than combining code and environment changes without a measurement. `VITE_STREAM_METADATA_DELAY_SEC=35` remains unused intentionally; adding it would create a new delay.

If post-fix listening still shows metadata late, the smallest next proposed adjustment is **`VITE_STREAM_DELAY_SEC=0`**, subject to separate authorization and a fresh build (Vite values are compiled into the client). Do not change the unused 35-second setting to try to tune this controller. Measure several transitions before choosing a final calibrated offset. A fixed positive offset cannot correct metadata that is itself later than the audible source. The smallest reliable long-term improvement, if publication remains too late, is metadata tied to the actual audio delivery timeline; `playing_next` guesses cannot guarantee that.

## Web branding assets

No suitable standalone new mark existed. The approved Phase 5D header already contains a clean vector: five rounded bars with the `#00d9eb` to `#0086ff` gradient. The web SVG and PNGs reuse that exact geometry; nothing was cropped from Hero artwork or redesigned. The generated 512 icon was visually inspected locally.

- New browser favicon: `public/truevoice-waveform-v1.svg`, padded vector viewBox, crisp at browser sizes.
- New PWA PNG URLs: `icon-192-waveform-v1.png` (192²) and `icon-512-waveform-v1.png` (512²), including maskable use.
- New Apple web touch icons: `apple-touch-icon-waveform-v1.png` (180²), `apple-touch-icon-167-waveform-v1.png` (167²), `apple-touch-icon-152-waveform-v1.png` (152²).
- PNGs have the established dark `#050816` background and a 60% mark that fits the central maskable safe circle without clipping.
- Existing web aliases were also replaced with the new artwork: `truevoice-favicon.png` (512²), `icon-192.png`, `icon-512.png`, `icon-1024.png` (1024²), and the three unversioned Apple touch icons. Existing fallback artwork references continue working.
- `index.html`, the checked-in static manifest, and Vite's generated manifest reference the new versioned URLs. Worker revisions and changed URL names make the new assets distinguishable from old browser/image caches. Worker activation behavior is preserved.
- Existing installed PWA/OS icon refresh is platform-controlled: an already installed icon may require relaunch or reinstallation. Runtime installation, update lifecycle, and Safari were not tested here.
- `assets/icon.png`, `ios/`, `android/`, and native configuration are unchanged. Do not run Capacitor sync as part of this web fix.

`tools/generate-web-icons.ps1` reproduces web icons from the approved header vector using Windows System.Drawing, without a dependency or paid service. With this machine's script policy, the inspected script can be run from the repository root with `& ([scriptblock]::Create((Get-Content -Raw tools/generate-web-icons.ps1)))`.

## Exact changed files

Application/configuration:

- `src/components/NowPlayingPanel.jsx`
- `src/lib/metadataTimeline.js` (new)
- `src/services/api.js`
- `vite.config.js`
- `index.html`
- `public/manifest.webmanifest`

Assets:

- `public/truevoice-waveform-v1.svg` (new)
- `public/icon-192-waveform-v1.png` (new)
- `public/icon-512-waveform-v1.png` (new)
- `public/apple-touch-icon-waveform-v1.png` (new)
- `public/apple-touch-icon-167-waveform-v1.png` (new)
- `public/apple-touch-icon-152-waveform-v1.png` (new)
- `public/truevoice-favicon.png`
- `public/icon-192.png`
- `public/icon-512.png`
- `public/icon-1024.png`
- `public/apple-touch-icon.png`
- `public/apple-touch-icon-167.png`
- `public/apple-touch-icon-152.png`

Tests/tooling/documentation:

- `tests/pulse-playback.test.mjs`
- `tests/pulse-release-security.test.mjs`
- `tests/pulse-postlaunch.test.mjs` (new)
- `tools/generate-web-icons.ps1` (new)
- `docs/PULSE-post-launch-fixes-1A.md` (new)

## Verification

| Check | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | PASS: 65/65, original 58 plus 7 new tests |
| Targeted ESLint: controller, timeline, metadata API, Vite config | PASS |
| `npm.cmd run build` with Production classification | PASS: 807 modules; generated `sw.js` and `workbox-080c8b91.js`; 16 precache entries, ~1026.88 KiB |
| Generated PWA policy and asset/reference checks | PASS: icon dimensions, header geometry/palette, versioned manifest URLs, precache files, activation, SPA/bridge fallback rules, NetworkOnly metadata/audio policy |
| `git diff --check` | PASS |
| Native, dependency, tracked `.env`, staged changes | No changes |
| Drop Portal exclusion | Existing release regression PASS; no Drop Portal code added |
| Audible timing / Chrome / Safari / installed PWA lifecycle | UNVERIFIED for this fix; no browser automation or production writes |

Some repeated builds hit local Node memory allocation failures, including a PWA generation failure after the Vite bundle completed. The final complete build succeeded with process-local `NODE_OPTIONS='--max-old-space-size=384 --max-semi-space-size=4'`; the final 65-test run followed that completed build. No project configuration was changed to work around memory pressure. The existing >500 kB chunk-size warning remains; dependencies and lockfiles are unchanged. Local production-mode loading confirmed `VITE_STREAM_DELAY_SEC=15`, matching Production; the unused second setting is absent locally.

## Review and release procedure

**GO for code review and controlled listening; NO-GO for claiming the 0–5-second synchronization target is verified.** No release is authorized by this report.

1. Review only the files listed above, excluding the pre-existing untracked material. Obtain visual approval for the browser/PWA icons and separate authorization for any environment adjustment. Commit explicitly selected fix files only after review.
2. Serve the complete production build on localhost with `npm.cmd run preview -- --host localhost --port 4173 --strictPort` when that port is available. Use an isolated browser profile; do not submit forms, uploads, payments, or sign-in actions. A normal Production-classified client can still send its existing analytics, so use the established safe local environment or approved restricted browser setup for runtime tests.
3. In foreground Chrome, record at least five audible track transitions against title, artist, artwork and MediaSession changes. Target -5 to +5 seconds; look for flicker, stale rollback, repeated flips, or wrong art. Record whether direct AzuraCast or LIVE365 actually played. Test pause/resume and LIVE → video → close → manual LIVE resume, plus Next/Previous and `/explore` refresh. Repeat critical checks in Safari when available. Verify independent video selection is not mistaken for song-linked video.
4. Test browser favicon after a normal reload and new-profile load. Test a PWA installed before the update as well as a fresh installation: manifest icons, worker activation/reload, offline app shell and deep-link fallback. Offline metadata must retain the last displayed song/error, not replay another cached song as current. Artwork still depends on the image request succeeding.
5. If residual lateness remains, seek separate approval for the proposed delay value zero and rebuild. If upstream publication remains too late, report the measured limitation rather than predicting `playing_next`.
6. Only after explicit deployment authorization, use an exact committed detached worktree linked to the verified existing Vercel project. Reconfirm the current public deployment before staging one Production deployment with `--prod --skip-domain`, then inspect and smoke-test its immutable URL. Do not use a Preview connected to privileged services or change isolation safeguards. Promotion requires explicit authorization.
7. Preserve `dpl_HmbTwRKST61h4VuSiUYmEJUYWfpd` as this fix's known-good rollback target, revalidating availability before release. Any authorized rollback should change hosted routing only. Roll back on broken LIVE playback, audio overlap, navigation failure, or unacceptable metadata regression; confirm public routing, source release metadata, Home/EXPLORE and LIVE afterward. No deployment, promotion or rollback was executed here.
