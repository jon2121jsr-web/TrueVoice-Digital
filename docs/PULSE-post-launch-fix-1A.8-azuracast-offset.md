# PULSE Fix 1A.8 — optional AzuraCast metadata offset

2026-10-15. Branch `fix/pulse-postlaunch-1a`; HEAD remains
`de31bd64a91719bfb21cef1227ab4404df9aba9d`. Implementation and this report are
uncommitted; nothing is staged. Existing personal outputs, worktrees and release
reports were preserved.

## Listening evidence and limits

User-measured title/artwork differences with the previous local 2-second legacy
offset: +6,+5,+6,0,0 seconds, mean +3.4; no buffering, flicker, incorrect art or
unexpected reloads. The actual browser audio URL was unconfirmed (“other” was
selected). Do not attribute this run conclusively to direct AzuraCast. Two +6
measurements also exceed the nominal +5 target, so this is not an unconditional
five-transition pass. A source-verified repeat is needed before accepting the new
override as calibrated. No further offset adjustment was guessed.

## Exact changes

1. `src/lib/streamMetadataTiming.js`: optional AzuraCast override normalization and
   source-specific selection. Existing source classification is unchanged.
2. `src/components/NowPlayingPanel.jsx`: read
   `import.meta.env.VITE_AZURACAST_METADATA_DELAY_SEC` at build time, normalize with
   the legacy offset as fallback, and pass the value into the existing currentSrc
   resolver. Include that scalar in the metadata effect dependencies.
3. `tests/pulse-postlaunch.test.mjs`: source rules, missing/invalid/zero overrides,
   unknown-source retention and source-change deadline regressions.
4. `tests/pulse-playback.test.mjs`: reusable controller compilation fixture and an
   actual-controller build-time override test contrasting missing override (15)
   with configured override (2), without metadata-triggered audio transport calls.
5. `docs/PULSE-post-launch-fix-1A.8-azuracast-offset.md` (this report).

No changes to the audio element, App, audio URLs, recovery/play/pause commands,
video coordination, metadata timeline implementation, development diagnostics,
PWA/icon assets, dependencies, environment files, native projects, Stripe,
Supabase or privileged routes. No production writes or external configuration
changes were performed. No new secrets are used; the new setting is public timing
configuration intentionally embedded by Vite.

## Final offset-selection rules

The controller continues selecting from **audio.currentSrc**, not an assigned URL
or a configured primary that may have failed. Existing source-event/poll/tick
observers and pending-deadline handling are unchanged.

| Actual selected source | Timing rule |
| --- | --- |
| Recognized HTTPS LIVE365 `/a61535` listener/provider CDN | Existing `VITE_LIVE365_METADATA_DELAY_SEC` override, default 55 |
| Recognized HTTPS AzuraCast on `stream.truevoice.digital` | Valid `VITE_AZURACAST_METADATA_DELAY_SEC`; otherwise existing `VITE_STREAM_DELAY_SEC` |
| Unknown/unrecognized source | Existing `VITE_STREAM_DELAY_SEC`; ignore the AzuraCast override |
| Transient empty currentSrc | Keep previous selected timing, as before |

AzuraCast override accepts finite nonnegative numbers, including explicit zero.
Absent, null, empty/whitespace, nonnumeric, infinite or negative overrides fall
back to the normalized legacy value. With today's legacy setting of 15, omission
or invalid input preserves AzuraCast=15 and unknown=15. A valid value of 2 produces
AzuraCast=2 while retaining LIVE365=55 and unknown=15. The unrelated older
`VITE_STREAM_METADATA_DELAY_SEC` remains unused.

Source changes continue retiming only pending metadata without resetting polling,
blanking the visible song or dropping the stale-response guard. No audio sources
are switched by the resolver. Preserved handoff limitations include retaining a
previous visible song instead of reconstructing older audible history on a switch
to a more delayed source; very short items may supersede the single pending item.

## Validation

| Check | Result |
| --- | --- |
| Complete focused regression/security suite | PASS: 75/75, including all prior 72 |
| Targeted ESLint | PASS: controller and timing resolver |
| Production/PWA build | PASS: 809 modules, 16 precache entries (~1029.04 KiB), generated `sw.js` and Workbox |
| Built JavaScript behavior | PASS: executed the emitted pure resolver/helpers; configured AzuraCast=2, absent override=15, LIVE365=55, unknown=15 |
| Built controller wiring | PASS: emitted currentSrc resolver call receives the build-time literal 2 through its normalized variable |
| Existing icon/PWA/security/playback regressions | PASS in full suite |
| Diff checks | PASS; no unrelated/native/environment/dependency/stream-URL changes; empty index |
| Browser source-verified calibration and Safari | UNVERIFIED |

For the local production/PWA validation only, the build process received
`VITE_AZURACAST_METADATA_DELAY_SEC=2` and Production environment classification.
No `.env` file or Vercel value was changed. The compiled controller fixture also
verified the missing-override path, preserving legacy behavior. The emitted main
bundle is `assets/index-CeAnulXy.js`. The existing large-chunk warning remains.

## Configuration for a future staged Production build

After code review and separate authorization to commit/stage, the intended build
configuration is:

```text
VITE_AZURACAST_METADATA_DELAY_SEC=2    new, build-time value for the candidate
VITE_STREAM_DELAY_SEC=15             retain existing value for unknown sources
VITE_LIVE365_METADATA_DELAY_SEC       leave unchanged/absent; default remains 55
```

All existing audio URLs and other settings must stay unchanged. A build without
the new value deliberately retains AzuraCast=15. The currently staged de31bd6 code
does not consume the new setting, so changing a variable alone cannot validate
this implementation. A new approved-code build is required. Vite embeds the value:
editing a project variable does not rewrite an existing bundle. How to supply the
staging-only build value, or later persist it in Production project settings,
requires explicit authorization; no such operation was performed here.

## Source verification and next listening check

On Home, start LIVE and run this in Chrome Console while audio plays. It reads
state only and removes query strings/credentials from the returned URL:

```js
[...document.querySelectorAll('audio')].map(a => ({
  activeUrl: a.currentSrc ? (() => {
    const u = new URL(a.currentSrc);
    return u.origin + u.pathname;
  })() : null,
  paused: a.paused,
  readyState: a.readyState
}));
```

A null URL or a manual “other” label is not source verification. Record the actual
sanitized URL, then use the table above. Repeat after recovery to detect a fallback.
Do not share cookies, tokens or a full HAR, and do not modify the audio element.

On a separately prepared candidate test with the override enabled, verify direct
AzuraCast currentSrc before measuring five foreground transitions (skip initial
join/warm-up), recording audible/title/artwork times separately on the same clock.
Watch for buffering, wrong artwork, flicker and unexpected reloads. Preserve the
existing safe local environment and background-write blocking during manual tests.
If recognized as unknown, expect the legacy 15 rather than applying 2 to an
unidentified provider. Keep LIVE365 as a separate 55-second regression.

**Recommendation: ready for code review.** Before public release, obtain a
source-verified five-transition result and accept any residual timing variance;
the latest unconfirmed-source run does not justify claiming AzuraCast is fully
calibrated. No commit, staging, promotion, Vercel edit or public change occurred.
