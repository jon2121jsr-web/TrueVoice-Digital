# PULSE Fix 1A.1 — metadata offset and buffering investigation

2026-10-15. Branch: `fix/pulse-postlaunch-1a`. HEAD remains
`337ef9d413ef41739d03f4442de95d83ad1fb37d`; this investigation is uncommitted.
Staged baseline: `dpl_2k21QhhiSyQP5fMziEHgic9cS7A4`.
Public deployment supplied by user: `dpl_HmbTwRKST61h4VuSiUYmEJUYWfpd`.
No deployment, promotion, push, merge, Vercel setting/variable change, native
change, database write, or transaction was performed. Existing untracked reports,
personal outputs and detached worktrees were preserved.

## Listening evidence and timing decision

User-performed staged listening results: +13, +15, +14, +14, +14 seconds;
mean +14, range +13 to +15. User also confirmed favicon, audio/video coordination
and EXPLORE refresh PASS, and reported several 1–2-second interruptions. These are
user observations, not automated browser results.

The code consumes `VITE_STREAM_DELAY_SEC=15` as the total offset from AzuraCast
`played_at`. `VITE_STREAM_METADATA_DELAY_SEC` is not referenced by the controller
or timeline; its previously verified Production value 35 is not added to 15 and
does not control five-second polling. Local production-mode settings still load
15; the second setting is absent locally. No new secret/environment download was
needed for this investigation.

The remaining lag is strongly explained by the configured **positive 15-second
offset**: when a fresh song is available before its deadline, the UI intentionally
waits until `played_at + 15 seconds`, plus up to one scheduler tick. This matches
the consistent listening measurements. Five-second polling is independent of that
deadline; it does not itself create a fixed 14-second hold. Without simultaneous
source timestamp, receipt time and audible transition measurements, the precise
contribution of audio buffering/upstream publication is not independently proven.

**Proposed configuration: `VITE_STREAM_DELAY_SEC=0`.** Leave
`VITE_STREAM_METADATA_DELAY_SEC` unchanged and unused. No timing-code change is
needed: zero already publishes each fresh current-song snapshot immediately,
keeps title/artwork atomic, ignores stale snapshots and does not forecast the next
song. A new regression verifies that behavior against the existing 15-second hold.

With zero, the UI changes on the first successful fresh poll, rather than waiting
for the 15-second source deadline. Expect the configured hold to disappear; the
remaining uncertainty is source freshness, audio latency, network delay and up to
five seconds of foreground polling. It is not valid to promise exactly “14 minus
15” for every sample because publication cannot precede the first fresh response.
Approximately ±5 seconds is the next listening-test target, not a verified result.
No Vercel variable was changed; separate authorization is required for this value.

## Audio lifecycle trace

- `App.jsx` owns one stable `playerRef` and one unkeyed `<audio>` in the shared
  Home/EXPLORE route parent. It has no declarative changing `src` prop. The
  coordinator is memoized; `handleStatusChange` is stable. Metadata updates set
  display/App/MediaSession metadata, not the audio source or transport state.
- `NowPlayingPanel` pre-warms `src` once when the element has no source. Its
  metadata effect only fetches and updates metadata/listener/error state; it
  depends on the numeric offset. The 5-second interval is single-flight and does
  not recreate the playback-event effect or coordinator registration.
- Full/floating/EXPLORE-strip changes reuse the controller and audio reference.
  Artwork fetches and MediaSession metadata assignment do not call `load()`.
- Explicit Play/resume deliberately calls `load()` to reconnect at the live edge.
  Pause/route teardown/video ownership deliberately pauses audio. Those operations
  are expected interruptions when requested, not a periodic metadata action.
- `waiting` only sets the reconnecting indicator. `stalled`/`error` schedule one
  3-second recovery, which reloads only when playback is still wanted AND the
  element is paused. A buffering-but-unpaused element is not forcibly reloaded by
  that path. `playing` clears the timer. `online` reloads only when paused and
  playback is wanted. Visibility recovery calls `play()` only for wanted, paused
  audio. A browser/network interruption could exercise these paths; no event
  capture from the reported glitches exists yet.
- YouTube start deliberately pauses radio via the shared coordinator; close does
  not automatically resume radio. Ownership/generation protections remain intact.
- The older `useVerseRadioAudio` has a separate lazy singleton for isolated Scroll
  verse cards, not the Home/EXPLORE LIVE controller. It is not a second LIVE element
  created by metadata polling. No change was made to that hook.
- `RecentTracksBar` is commented out in App. Main LIVE polling increased from 4
  to 12 requests/minute in 1A; there are not multiple polls per rendered player
  presentation. Metadata and audio are NetworkOnly in the worker and the metadata
  fetch uses `no-store`. Five-second polling has **no observed direct restart
  mechanism**; indirect contention on a constrained connection/server remains
  possible and needs a Network/performance trace. Do not infer causality solely
  because the interruptions were noticed after the polling change.

## Bounded stream comparison

Two parallel, read-only Node streaming GETs were sampled for 25 seconds, aborted
at the limit, without saving/decoding audio or changing application URLs:

| Endpoint | HTTP/type | First byte | Bytes/chunks | Largest inter-chunk gap |
| --- | --- | --- | --- | --- |
| LIVE365 `https://streaming.live365.com/a61535` | 200, audio/mpeg | 990 ms | 874,788 / 56 | 2,004 ms |
| AzuraCast `https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3` | 200, audio/mpeg | 288 ms | 403,749 / 199 | 603 ms |

LIVE365 followed its provider redirect to
`https://das-edge93-live365-dal05.cdnstream.com/a61535`. Neither request produced an
error before the deliberate timeout. Byte counts include startup delivery;
different encodings/chunking mean they are not an audible-quality comparison.
A 2-second chunk gap can be entirely covered by the browser buffer. This short
sample cannot prove a provider fault, decode glitch or actual audible silence,
and does not reproduce the user's browser/network environment.

Prior verified public-bundle inspection selected the direct AzuraCast MP3 through
the existing environment override, despite LIVE365 being the source-code default.
The protected staged browser's actual `currentSrc` was not captured here; confirm
it in the next reproduction before assigning glitches to LIVE365. Neither the
licensed listener-facing LIVE365 URL nor its selection/fallback logic was changed.

**Buffering classification: not yet determinable.** No metadata-driven remount or
reset was found, and the lifecycle regression passes. The strongest observed
delivery difference is LIVE365's burstier byte arrival, not proof of audible
buffering. A provider/network/browser issue or an actual recovery/coordination
event must be distinguished by captured event and buffer evidence. No speculative
buffer-size, recovery-timeout, preload, provider or polling change was made.

## Minimal code changes and diagnostics

- New `src/features/pulse/radioDiagnostics.js`: opt-in development-only event
  observer. No polling timer, network request, storage write or audio operation.
  Production is gated by `import.meta.env.DEV`, even with the opt-in flag set.
- `src/components/NowPlayingPanel.jsx`: attach/detach the observer using stable
  refs and record explicit command-play/command-pause, recovery-reload and
  online-reload entry points. All existing playback decisions remain unchanged.
- `tests/pulse-playback.test.mjs`: six actual-controller metadata/listener changes
  and compact/floating changes while playing, with waiting/stalled/playing events;
  assert no new source assignment, load, play or pause. Explicit resume must still
  reconnect once. Existing video/recovery race tests are retained.
- `tests/pulse-postlaunch.test.mjs`: zero-versus-15 offset regression and passive,
  sanitized, opt-in diagnostics with listener cleanup and no Production logs.
- This report. No changes to App, stream URL selection, manifests, dependencies,
  native projects, Stripe, Supabase or payment behavior.

For a safe local development reproduction, enable
`sessionStorage.setItem('pulse-radio-debug', '1')` then reload, or append
`?pulseRadioDebug=1` to the local URL. Disable with
`sessionStorage.removeItem('pulse-radio-debug')` and reload (remove the URL flag
too). These diagnostics do not activate on a Vite production build or the current
staged deployment. Only event/command transitions are logged, not timeupdate or
continuous production telemetry. Source query strings are stripped; song/user
data and credentials are not logged.

Capture `waiting`, `stalled`, `suspend`, `error`, `play`, `pause`, `playing`,
`loadstart`, `emptied`, `abort` and `ended`, with local monotonic time, currentTime,
buffered seconds ahead, readyState, networkState and media error code. Context
includes playback intent and video ownership. `suspend` alone is not evidence of
failure. A waiting event with zero buffer and no reload command suggests starvation;
`emptied/loadstart` following a command identifies an application reload path.
Silence while time/buffer advance normally needs stream-content/decoder evidence.

## Validation and next action

- PASS: 68/68 focused regression/security tests (65 previous + 3 new).
- PASS: targeted ESLint for controller, diagnostics, timeline and App.
- PASS: production/PWA build, 808 modules, 16 precache entries (~1027.95 KiB),
  generated `sw.js` and Workbox. Existing large-chunk warning remains.
- PASS: `git diff --check`; no native, environment, dependency or stream-URL diff.
- Browser playback/buffering reproduction, Safari, and zero-offset staged
  listening remain unverified. Node stream sampling is not browser playback QA.

**Exact recommended next action:** run a controlled local development listening
test with a process-local `VITE_STREAM_DELAY_SEC=0` and the radio diagnostic opt-in,
using the existing safe local environment. Record at least five transitions and
each interruption with the actual audio source and buffer/event sequence. Do not
change the application stream URL, and avoid production writes as in the earlier
staging test procedure. This can test zero without changing Vercel settings.

After that comparison, obtain separate authorization to change Production
`VITE_STREAM_DELAY_SEC` from 15 to 0 and create one new `--prod --skip-domain`
deployment. Vite embeds the offset at build time: the existing staged deployment
will stay at 15 and cannot validate zero without rebuilding. The existing 337ef9d
code already supports zero; a timing-only staged rebuild need not include these
uncommitted development diagnostics. Review/commit them separately if desired.
Do not deploy them expecting production event logs: they intentionally stay off.

GO for the local zero-offset comparison and diagnostics. No claim that buffering
is fixed; do not promote until timing and playback continuity are accepted. No new
deployment or environment change has been executed under this request.
