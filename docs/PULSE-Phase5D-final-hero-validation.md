# PULSE Phase 5D — final Hero artwork validation

Prepared 2026-10-15, America/Phoenix.

## Phase 5E user approval record

The user explicitly approved all four replacement Hero slides, desktop/tablet/mobile framing, TrueVoice.Digital header branding, Gear navigation, and all six production-preview Chrome checks. These are user-performed/user-confirmed local browser results, not automated observations or a hosted-production test. They supersede the pending visual approval statements/checklist below, which document the original Phase 5D handoff. No Safari result or separate service-worker lifecycle trace was supplied. Phase 5E commits the approved working tree; see its authorization report for the final release SHA and decision.

**Visual approval URL: http://localhost:4173/** — the existing localhost-only Vite production-preview server is running and serves the rebuilt artwork/header. No push, merge or deployment occurred.

## Baseline and scope

Branch: `release/truevoice-pulse-web`. HEAD remains `46455d5caa6353762524e3674c8aeca334c2e3e9`. Phase 5D application changes, supplied PNGs and this report are **uncommitted**. The preview therefore represents that baseline **plus the Phase 5D working-tree visual changes**, not the unchanged baseline artifact. A later approved release needs a new commit SHA.

Existing Phase 5A/B/C/same-day reports and `Claude outputs/` remain untouched during this phase. No Drop Portal functionality was restored. No native projects, API routes, database schema, credentials, payments, LIVE/media coordination logic, EXPLORE implementation, dependency files or PWA configuration changed.

## Changed files

| File | Change |
| --- | --- |
| `src/components/Hero.jsx` | Four supplied artwork slides in approved order; uniform image rendering; Gear artwork retains scroll action; inactive slides inert; stable timer callbacks retain the seven-second interval and manual reset. |
| `src/components/Hero.css` | Scoped artwork sizing at source aspect ratio; contained image display; dark background; separate 44px carousel-controls rail; visible keyboard focus. Existing hover/touch/reduced-motion controls retained. |
| `src/features/pulse/PulseHome.css` | Removed the old fixed Hero height and slider/dot offsets that conflicted with uncropped aspect-ratio artwork, including the small-phone fixed height. |
| `src/App.jsx` | Header brand markup only: inline vector blue waveform, white TrueVoice, blue .Digital and tagline. Other App behavior unchanged. |
| `src/features/pulse/PulseTheme.css` | Header brand sizing, colors, tagline and narrow-phone treatment. |
| Four `public/images/` PNGs below | User-supplied original files used unchanged; new/untracked until a later approved commit. |
| This report | Validation and visual-approval record, uncommitted. |

Old artwork/components remain on disk for other references/history but are no longer selected by the homepage Hero. No asset deletion or artwork recreation was performed.

## Artwork and order

| Order | Original filename under public/images | Dimensions | Ratio | Bytes |
| --- | --- | --- | --- | --- |
| 1 | `TrueVoice Digital_ Music Is the Heartbeat.png` | 1958 × 803 | 2.438:1 | 2,550,631 |
| 2 | `TrueVoice Gear_ Faith in Bold.png` | 1958 × 803 | 2.438:1 | 2,967,134 |
| 3 | `TrueVoice.Digital Network Showcase(1).png` | 1960 × 802 | 2.444:1 | 3,551,042 |
| 4 | `TrueVoice Digital_ Faith in Sound.png` | 1958 × 803 | 2.438:1 | 3,271,998 |

All four originals were visually inspected as local image files. Their complete compositions, logos and embedded text were retained. No image crop, resampling, stretching, overlay caption, new shop URL or derived bitmap was introduced. Copies in `dist/images/` and bytes returned over the local preview HTTP connection exactly match the supplied originals.

Source SHA-256 checksums:

```text
Music Is the Heartbeat
2f327ad76e171f10a5d896d37e28ca3cece5902af96135e21ec4d89c36e05cde
Faith in Bold
eb2e2ab7f8d32ccd84650a0e62a93072c1700d5d1b94b1da506e2c03112ce1cd
Network Showcase
762da921f8afe5f1c9544582fb352bdb84107f4ca18b1fbaef2283db96aaa625
Faith in Sound
ecabd05b5bcf7cd9f9d7c62a11014c1274272a303beb883ae712b35d5406692f
```

## Composition, interaction and branding

- The artwork area uses `aspect-ratio: 1958 / 803`, with `object-fit: contain`, centered images, no scale transform and a coordinated #030b16 background. The slightly wider Network image can letterbox minimally rather than crop. Fixed pixel Hero heights no longer override this layout at mobile breakpoints.
- Arrows/dots occupy a separate bottom rail, preventing controls from covering embedded words, logos or faces. Existing seven-second rotation, 450ms fade, manual timer reset, swipe threshold, drag click suppression, dots, arrow handlers and reduced-motion transitions remain. Small-phone arrow hiding follows the existing rule; dots and swipe remain available.
- The Gear source already contains its CTA text. Instead of adding a duplicate overlay, the displayed Gear artwork is a keyboard-accessible button labeled “Shop TrueVoice Gear.” A tap/click scrolls to the **existing `.tv-gear-section`** with the same smooth/start options. A swipe does not activate the destination. Inactive slides are inert to prevent hidden-button focus.
- No suitable clean standalone matching waveform/wordmark asset was found among repository brand/logo files. The existing favicon was inspected and uses the older magenta identity. No logo was cropped from a Hero image. The header uses crisp inline SVG bars and live styled text matching the approved blue/white/bright-blue identity, with the existing tagline. This is a header treatment for visual review, not a newly supplied official standalone logo file.
- The waveform is normally 44px; the wordmark scales from 24–32px. Small-phone rules reduce waveform/tagline size. Existing header action/navigation behavior is preserved. The tagline remains included at narrow sizes; actual legibility needs manual visual approval.

## Verification results

| Check | Result |
| --- | --- |
| Existing production/PWA build | **PASS** — Vite 7.3.7; 806 modules; final build 8.08 seconds |
| Generated worker | **PASS** — sw.js + workbox-77d36791.js; 13 precache entries, 1026.17 KiB |
| Existing regression/security suite | **58 passed, 0 failed, 0 skipped**, about 11.10 seconds |
| Targeted ESLint | **PASS**, Hero.jsx and App.jsx, no reported errors/warnings |
| git diff --check | **PASS**; Git additionally reports normal LF/CRLF normalization notices |
| Local production preview root | **HTTP 200**, serves final bundle index-C2WnN7FA.js |
| All four artwork URLs | **HTTP 200**, byte-identical to originals and dist copies |
| Header and Drop Portal compiled checks | New tv-brand-wave present; DropPortal/drop-upload absent |
| EXPLORE local shell | **HTTP 200**; this is HTTP evidence, not new browser interaction evidence |
| LIVE/EXPLORE/navigation/PWA regression coverage | Existing relevant tests pass; no related logic/configuration changed |
| Desktop/tablet/mobile screenshots and all-slide browser approval | **PENDING USER VISUAL REVIEW** — not claimed from static CSS/build/tests |

Build used the existing Production classification (`VERCEL=1`, `VERCEL_ENV=production`, `VERCEL_TARGET_ENV=production`) and existing local values, without retrieving/printing secrets. Tests ran in explicit local development context. Neither command deployed, ran production SQL or invoked production write tests.

Final assets include `index-DigBgrXk.css` (100.10 kB, 18.40 kB gzip) and `index-C2WnN7FA.js` (937.54 kB, 280.35 kB gzip). Vite retains its existing large-JS-chunk warning. PWA runtime caching/registration policy is unchanged; browser installation/update lifecycle has not been newly verified.

## Remaining visual concerns and approval checklist

The originals total **12,340,805 bytes** (about 12.34 MB). They were deliberately not recompressed or replaced. Only the first slide is eager; the other images retain lazy loading. Actual hidden-slide loading decisions are browser-dependent. Large original PNGs can delay a newly selected slide on slower connections. These four photos are not added to the shell precache; existing runtime image caching remains unchanged.

Containing a wide composition preserves everything on phones but necessarily reduces the embedded text size. No mobile crop or additional duplicate caption was added to compensate. Validate readability at the user's target device widths before release.

At **http://localhost:4173/**:

- [ ] Refresh to pick up the new worker/bundle; confirm the blue waveform/white TrueVoice/blue .Digital header and tagline look correct.
- [ ] Review desktop (e.g. 1440px), tablet (768px), phone (390px) and narrow phone (320px), using actual browser viewports. Confirm no horizontal overflow and no cropped image content; supplied image-file inspection is not a browser layout test.
- [ ] Use dots/swipe to review all four slides in the documented order. Confirm controls sit below the art and faces/logos/embedded CTA remain visible.
- [ ] Select Gear, tap its embedded CTA area, and confirm smooth scroll to the existing Gear section. Check keyboard focus and that dragging does not scroll to Gear.
- [ ] Confirm arrows/dots/swipe and seven-second rotation feel unchanged; check lazy-image loading on a slow connection.
- [ ] Briefly recheck LIVE continuity, Home ↔ EXPLORE and modal playback with the new header/Hero layout. Prior Phase 5C runtime PWA/Safari limitations still apply.

No Computer Use was invoked; browser visual approval is requested from the user. The production preview remains running. **Implementation/build/regressions are ready for visual review; final visual and production release approval remain pending.** Nothing was committed, pushed, merged or deployed during Phase 5D.
