# PULSE Fix 1A.4 — stream-specific synchronization test

2026-10-15. HEAD and clean test worktree:
`337ef9d413ef41739d03f4442de95d83ad1fb37d`.
Working branch: `fix/pulse-postlaunch-1a`. Existing uncommitted diagnostics,
regressions and reports are preserved. No application-code or environment-file
changes, commits, deployments, promotions, Vercel changes or stream-URL edits.

## Listening evidence

User-performed controlled LIVE365 A/B results:

| Offset | Signed observed errors (seconds) | Mean |
| --- | --- | --- |
| 0 | -60, -58, -53, -60, -54 | -57 |
| 15 | -44, -44, -48, -42, -44 | -44.4 |

No interruptions in either arm. Positive offset moved metadata later by an average
12.6 seconds across different live transitions, consistent with a 15-second
source-anchored hold plus observation phase and stream variability. This supports
substantial LIVE365 listener delay relative to AzuraCast metadata; it does not
establish one exact relay delay for every session. Offset 55 is a reasonable next
candidate, not yet a verified release value. At zero, the UI is observation-limited;
simply adding 55 to the measured mean is not an exact prediction of a scheduled
source-offset result.

## Actual browser audio source: verification limits

No browser was controlled in this task. HTTP GETs of Vite modules prove the served
configuration but cannot inspect a running browser's audio element, and a provider
GET does not prove which source the application is playing. No Vercel protection
bypass, temporary access link or access-setting change was attempted.

| Environment | Evidence available | Runtime status |
| --- | --- | --- |
| Public Production, previously identified as `dpl_HmbTwRKST61h4VuSiUYmEJUYWfpd` | Earlier compiled public bundle and read-only Production setting selected direct AzuraCast MP3 | Current audible element source UNVERIFIED; capture below |
| Staged Fix 1A, `dpl_2k21QhhiSyQP5fMziEHgic9cS7A4` | Exact staged source and Production configuration support direct AzuraCast selection; protected runtime was not inspected | UNVERIFIED; normal Vercel sign-in and capture required |
| Local A/B | User explicitly reports controlled LIVE365 listening; served modules select LIVE365 | User-reported LIVE365; independent element capture still requested |
| New local 55 test | Served module verified as LIVE365 and offset 55, same AzuraCast metadata | Actual playback awaits user; capture below |

Configured candidates are LIVE365 `https://streaming.live365.com/a61535` and direct
AzuraCast `https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3`.
Do not substitute configured URLs for actual element evidence: the existing
controller can fall back on playback failure. `currentSrc` identifies the selected
browser resource; Network may show a further LIVE365 CDN redirect.

### Safe DevTools capture

On each environment's Home page, start LIVE, then run this in Chrome Console.
For the staged URL, use ordinary authorized Vercel sign-in. Pause/close one player
before starting another. Do not paste cookies, authorization headers, tokens or a
full HAR. The command only reads audio state and removes URL queries, fragments
and credentials from the reported URL:

```js
(() => {
  const safe = value => {
    if (!value) return null;
    const u = new URL(value, location.href);
    return u.origin + u.pathname;
  };
  return [...document.querySelectorAll('audio')].map((a, index) => ({
    index,
    activeUrl: safe(a.currentSrc),
    assignedUrl: safe(a.getAttribute('src')),
    paused: a.paused,
    readyState: a.readyState,
    networkState: a.networkState,
    errorCode: a.error?.code ?? null
  }));
})();
```

Share the output with the environment label. `activeUrl:null` is not verification:
start LIVE and rerun after audio begins. Repeat after any interruption/recovery to
detect fallback. Network → Media → Headers can confirm the request/redirect path;
share only origin + pathname, with queries removed.

## Local offset-55 server

**http://localhost:5178/** — bound to localhost only, left running.

It serves the same clean detached `.release-staging/postlaunch-1a` commit as A/B,
uses the existing root local environment through Vite `envDir`, and sets only
process-local `VITE_STREAM_DELAY_SEC=55`. Served code confirms:

- `VITE_TRUEVOICE_STREAM_URL`: unchanged LIVE365 listener URL.
- Metadata base: `https://stream.truevoice.digital`; same API station/default as A/B.
- Five-second single-flight metadata polling and source-based timeline unchanged.
- Offset 55, HTTP 200. Test worktree remains clean.
- Existing servers http://localhost:5176/ (0) and http://localhost:5177/ (15) still
  respond with their original offset and LIVE365 configuration; they were not
  restarted or altered. The older diagnostic server/working-tree code is preserved.

The exact 337ef9d test code intentionally excludes the uncommitted 1A.1 diagnostic
overlay. Those files remain untouched in the main working tree. If using the
optional 1A.3 DevTools recorder, allow port `5178` in its local-only guard and label
that port `C55` before pasting; its original guard intentionally rejects this new
port. No recorder or app playback changes are necessary for the stopwatch test.

### Five-transition procedure

1. Use the same Chrome/profile, network, output and stopwatch as A/B. Close/pause
   all other players, including the A/B and direct-stream tabs. Keep the tab in the
   foreground. Preserve the earlier no-production-write request blocking for
   analytics/Supabase before navigating. Do not submit application forms/actions.
2. Open http://localhost:5178/, start LIVE once and capture the actual source using
   the command above. Confirm LIVE365; do not count a fallback run as a LIVE365 test.
3. Let one full track transition pass first: initial metadata displays immediately
   on join and is not a valid measurement of the established-session deadline.
4. Measure five consecutive transitions. Record song identities, audible-change
   time, title-change time and artwork-change time on one stopwatch. Signed error
   is displayed-change time minus audible-change time; negative is early. Record
   title and artwork separately, any incorrect art/flicker, and any interruption.
5. Target approximately -5 to +5 seconds for each title/artwork update. Capture the
   source again at the end and after any recovery. Report all five values, their
   range/mean, browser/device and source captures. Do not tune the offset mid-run
   or restart playback to hide a symptom. If results drift, repeat rather than
   claiming one five-track average is universally stable.

## Smallest configuration approach

The current architecture has **one compiled offset per build**, independent of
the actual audio source. `VITE_STREAM_METADATA_DELAY_SEC` is unused; it is not a
second stream-specific offset. Existing fallback to direct AzuraCast inherits the
same offset, so a LIVE365-calibrated 55 could produce substantial lateness after
fallback. No new stream selector or recovery change is implemented here.

For a stable single primary source, the smallest approach needs no new code:
review the existing stream URL and offset **as a pair for each build/environment**.
Calibrate LIVE365 separately from direct AzuraCast. Do not apply a LIVE365 result
to a direct-AzuraCast Production player or silently change its stream routing.
Do not claim the earlier direct-source 15 result proves a zero value is calibrated.

If accurate timing must also survive the existing cross-provider fallback within
one build, a future narrowly scoped change could choose only the metadata offset
from the actual selected audio source, with separately calibrated LIVE365 and
AzuraCast offsets. That need not choose/change audio sources or introduce a new
stream-selection system. It requires explicit authorization, rules for unknown
sources, pending-metadata reset on source change, and regression/listening coverage.
No such resolver or new variables were added under this request.

## Validation and release sequence

No application code changed, so no new build/regression run was required. HTTP and
transformed-module checks PASS for all three local arms; detached Git worktree
clean and `git diff --check` PASS. Existing diagnostic/recovery logic is preserved.
No buffering occurred in the user's controlled A/B sessions, but that does not
prove all environments are interruption-free.

1. Capture actual runtime audio sources for public, staged and local players.
2. Complete the local 55-second test. Accept a value only for its verified source.
3. Decide the intended primary/fallback synchronization scope without changing
   licensed/public routing implicitly. Address fallback timing before declaring
   calibration robust across both providers.
4. Separately authorize any chosen Vercel offset/configuration changes and a new
   staged Production rebuild. Vite compiles the offset; old deployments will not
   change when a project variable changes. Verify staged source and repeat timing,
   playback coordination, favicon/PWA and navigation checks before requesting
   promotion authorization.

**Current recommendation: GO for the local 55 test; HOLD Production timing changes
and promotion pending runtime-source evidence and listening acceptance.**
