# PULSE Fix 1A.5 release candidate

2026-10-15. Branch `fix/pulse-postlaunch-1a`; HEAD remains
`337ef9d413ef41739d03f4442de95d83ad1fb37d`. The candidate is the uncommitted working
tree on that base; there is no new release SHA yet. No files are staged.

## Evidence and architecture

User-performed LIVE365/offset-55 listening: 0,+5,+1,0,0 seconds, mean +1.2; no
buffering or interruptions. This meets the requested approximately ±5-second target
for those five transitions. It validates that tested stream/session, not all
devices, a direct-AzuraCast path or the new source-handoff code in a hosted build.

Read-only Production configuration inspection reconfirmed:

- Primary configured URL: `https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3`.
- `VITE_STREAM_DELAY_SEC=15`.

The existing staged Fix 1A deployment was created with Production settings, not the
local LIVE365 override. Current project settings and earlier compiled-bundle
evidence indicate direct AzuraCast selection; a historical environment snapshot
and the staged browser's selected audio element have not been independently
captured here. Do not call that runtime verification. The public browser's actual
selected source also remains unverified. Local controlled listening was explicitly
reported by the user as LIVE365, and its served configuration was verified.

The audio controller can already switch sources: primary play failures in existing
reconnect/recovery paths assign the direct AzuraCast fallback. A subsequent explicit
primary reconnect or existing online recovery can retry the primary. These paths,
URLs, thresholds, play/pause logic, user-intent/epoch guards, MediaSession commands
and video coordination are unchanged by source-aware timing. No new audio-source
selection, switching, seeking, reload, or reconnect behavior was introduced.

### Actual source verification (user, Chrome)

Use Home, press LIVE, and while it audibly plays run the following on the public
site, the existing staged site after ordinary Vercel sign-in, and the candidate
when separately staged. Pause/close other players first. Queries and credentials
are excluded from the returned URL; no playback or network operation is performed:

```js
[...document.querySelectorAll('audio')].map(a => ({
  activeUrl: a.currentSrc ? (() => {
    const u = new URL(a.currentSrc);
    return u.origin + u.pathname;
  })() : null,
  paused: a.paused,
  readyState: a.readyState,
  errorCode: a.error?.code ?? null
}));
```

`activeUrl:null` is not a verified source. Repeat after any interruption/recovery.
Use Network → Media for provider redirects; `currentSrc` commonly retains the
original LIVE365 listener URL. Share sanitized origin/path only, not cookies,
authorization headers or a HAR. No authentication bypass or access-setting change
was attempted in this task.

## Source-aware candidate

The controller now reads **`HTMLMediaElement.currentSrc`**, not the configured
primary URL or a newly assigned `src` that may not yet be selected by the browser.
It classifies the resource after loadstart/loadedmetadata/playing, before applying
fresh metadata and on the existing one-second metadata tick. These observers do
not issue audio operations, new fetches, or new timers. The polling effect does not
restart when the selected source changes.

| Selected source | Candidate offset |
| --- | --- |
| HTTPS `streaming.live365.com/a61535` (query ignored) | 55 seconds by default |
| HTTPS provider `*.cdnstream.com/a61535` resource | same LIVE365 offset |
| Direct AzuraCast on `stream.truevoice.digital` | existing `VITE_STREAM_DELAY_SEC`, currently 15 in Production |
| Other/unrecognized selected resource | existing build offset, not a guessed LIVE365 delay |
| Transient empty `currentSrc` while loading | retain the previous timing until a resource is selected |

Station/host checks do not match lookalike domains, arbitrary paths containing
“live365”, or a different LIVE365 station. Native HLS, if this web code is later
built natively, retains the legacy offset; no native project or configuration was
changed.

`createMetadataTimeline.setDelay()` recalculates the existing pending occurrence's
source-based deadline. It preserves the displayed song and monotonic source
timestamp guard. A shorter fallback offset can publish an overdue pending tuple
once; a longer primary offset holds the pending tuple until its new deadline. It
does not blank the UI, restart the delay from polling time, replay stale history,
or reset the polling loop. Repeated events with the same offset do nothing.

Preserving the current display avoids a back-and-forth title/artwork flicker, but
does not reconstruct a prior audible song when returning from a lower-latency
source to a more delayed source. A handoff may need to settle through a transition;
verify that manually. The existing single-pending-song architecture is retained:
very short items or several source changes inside the offset window can supersede
a pending item. The five approved long-track measurements do not validate that
case; test short station items if they are in today's programming. No predictive
`playing_next` scheduling or new history queue was introduced.

## Exact configuration requirements

**Required Vercel changes: none.** Keep the public primary URL unchanged and retain
`VITE_STREAM_DELAY_SEC=15`. It remains the legacy/AzuraCast/unknown-source offset.
The existing `VITE_STREAM_METADATA_DELAY_SEC` is still unused; do not repurpose or
add it to either offset.

New optional public build setting: **`VITE_LIVE365_METADATA_DELAY_SEC`**. Its code
default is **55** when absent, empty, invalid or negative. Explicit zero is accepted
for controlled testing. Adding the optional variable with value `55` would only
make the chosen default explicit; it is not required and was not done. Any future
Vercel variable edit requires separate authorization. Vite compiles these values,
so a changed value requires a new build.

This candidate intentionally does **not** remove the known late behavior of a
direct-AzuraCast primary: its offset stays at 15 until independently validated and
authorized. LIVE365 calibration must not silently change public stream routing.

## Exact candidate files

Changed since staged commit 337ef9d:

- `src/components/NowPlayingPanel.jsx`: source-timing observation/selection; includes
  the preserved, previously uncommitted 1A.1 development-only diagnostic hooks.
- `src/lib/metadataTimeline.js`: retime a pending occurrence without resetting its
  display/history guard.
- `src/lib/streamMetadataTiming.js` (new): strict source classification, optional
  LIVE365 override, approved default 55 and legacy-source fallback.
- `src/features/pulse/radioDiagnostics.js` (new from 1A.1, preserved): passive,
  opt-in development-only event/command/buffer observer; no Production telemetry.
- `tests/pulse-playback.test.mjs`: preserved lifecycle regression plus real
  controller rejection/fallback/primary-retry integration coverage.
- `tests/pulse-postlaunch.test.mjs`: preserved zero-offset/diagnostic regressions
  plus source identity and pending-deadline retiming coverage.
- `docs/PULSE-post-launch-fix-1A.5-release-candidate.md` (this report).

Existing uncommitted 1A.1, 1A.3 and 1A.4 reports remain evidence for review; the
staging-result report is also preserved. `Claude outputs/`, `.release-staging/`
and the unrelated uncommitted Phase 5E authorization report are not candidate
application files and must not be included through a blanket add.

The approved favicon/PWA change is already committed in base 337ef9d and remains
unchanged by this phase:

- `index.html`, `public/manifest.webmanifest`, and `vite.config.js` references.
- `public/truevoice-waveform-v1.svg` and `public/truevoice-favicon.png`.
- `public/icon-192-waveform-v1.png`, `public/icon-512-waveform-v1.png` and their
  unversioned aliases `public/icon-192.png`, `public/icon-512.png`.
- `public/icon-1024.png`.
- `public/apple-touch-icon-waveform-v1.png`,
  `public/apple-touch-icon-167-waveform-v1.png`,
  `public/apple-touch-icon-152-waveform-v1.png` and their unversioned counterparts.

No new diff to App routing/audio element, audio URL selection helper, worker policy,
API/Preview security, dependencies/lockfiles, tracked environment files, native
projects/assets, Stripe, Supabase or payment behavior. No Drop Portal work added.
Only public URL/timing settings were inspected; no credential values were printed
or added. The optional VITE setting is intentionally public timing data, not a key.

## Release verification

Final checks:

| Check | Result |
| --- | --- |
| Complete focused regression/security suite | PASS: 72/72, sequential run against the final generated build |
| Source-aware selection and actual controller fallback | PASS: strict station/CDN matching, unknown-source policy, selected versus assigned URL, 55→15 fallback and 15→55 primary retry, empty-source transition, no poll restart |
| Pending-song stability | PASS: no duplicate flip, stale rollback or blanking; no source change/reset to the audio transport from metadata |
| Existing audio/video/navigation/security behavior | PASS: complete suite includes pause/resume, video races, deep links, proxy, Preview protections and Drop Portal exclusion |
| Targeted ESLint | PASS: controller, timeline, source-timing helper, development diagnostics and App |
| Production/PWA build | PASS: 809 modules; 16 precache entries (~1028.86 KiB); generated `sw.js` and `workbox-080c8b91.js` |
| Approved favicon/PWA assets | PASS: original header waveform geometry/palette, PNG sizes, versioned URLs, generated manifest and precache references; unchanged since 337ef9d |
| Production diagnostics off | PASS: opt-in flags cannot enable logs/listeners in a Production build |
| Diff/staging/scope | PASS: `git diff --check`; empty index; no native, environment, dependency, Stripe/Supabase or audio-URL changes |
| Browser runtime-source capture / new candidate handoff listening / Safari | UNVERIFIED; still requires the procedures below |

Early local build attempts
completed the Vite bundle but failed before PWA generation under Windows memory
pressure, including a 256 MB heap failure. Those attempts are not a passing PWA
build. The existing test-server preservation instruction was honored while asking
for memory relief. The user then explicitly authorized stopping completed test
servers on ports 5176–5178. Only their verified localhost Node processes were
stopped; all source files and diagnostic instrumentation remain intact. The final
build succeeded with process-local Node heap settings, followed by the complete
72-test passing run. Existing large-JS-chunk warnings remain; no broad dependency
upgrades or persistent build-setting changes were introduced.

## Required release sequence (future authorization only)

1. Review this uncommitted candidate and obtain public/staged runtime source
   captures. Accept the intentionally unchanged direct-AzuraCast offset separately
   from the measured LIVE365 result. Review short-item and source-handoff risks.
2. Verify candidate LIVE365 playback/metadata and a controlled local primary-failure
   fallback to AzuraCast, then explicit primary retry. Confirm currentSrc, no blank
   or stale rollback, one audio element, no new reloads, pause/resume and video
   coordination. Do not simulate failures against public Production or perform
   privileged actions. Safari remains unverified until tested independently.
3. After separate commit authorization, explicitly stage only approved files,
   commit, record the full SHA and create a clean detached worktree at that SHA.
   Never deploy the mixed main working tree or silently ship personal outputs.
4. Reconfirm Vercel project `prj_OMhlrkRX8NFQCMidqT4Z0shSzKOt`, team
   `team_qJIIDlYcPRRWTRbel8YtLlxd`, Production classification and unchanged public
   deployment. No environment edit is required for this candidate.
5. After separate staging authorization, create a **new** staged Production build:

   ```powershell
   vercel.cmd --scope johns-projects-861a7d26 deploy --prod --skip-domain --meta releaseCommit=<approved-candidate-sha>
   ```

   The existing staged 337ef9d deployment lacks this source-aware resolver. Record
   the new ID/immutable URL, Ready status, source SHA and actual runtime source.
   Confirm both custom domains remain on the existing live deployment.
6. Smoke-test the staged immutable build using normal Vercel authentication: Home,
   approved favicon/icons/Hero artwork, EXPLORE/video/queue, LIVE continuity and
   coordination, direct `/explore` refresh, worker update/reload, and integration
   reachability without transactions/writes. Test LIVE365 timing only on a verified
   LIVE365 path; a direct-AzuraCast primary is not expected to use 55. Do not change
   routing merely to manufacture a passing result.
7. Only after explicit promotion authorization, promote that exact tested staged
   build with `vercel.cmd --scope johns-projects-861a7d26 promote <new-staged-url>`.
   Recheck both public domains and immediate playback/navigation/PWA smoke tests.

### Rollback plan (not executed)

Revalidate that known-good deployment `dpl_HmbTwRKST61h4VuSiUYmEJUYWfpd` remains
Ready and rollback-eligible before any promotion. On a core playback/navigation
failure, major metadata regression, audio overlap or broken production integration,
seek/use explicit rollback authorization for:

```powershell
vercel.cmd --scope johns-projects-861a7d26 rollback dpl_HmbTwRKST61h4VuSiUYmEJUYWfpd
```

Rollback changes hosted deployment routing, not Git. No environment changes are
required by this candidate; if optional settings are added later, a hosted rollback
does not necessarily revert those project settings. Confirm both custom domains
resolve to the rollback ID, check Ready, then test Home, direct EXPLORE refresh,
LIVE/video ownership and service-worker reload in a fresh browser session. Existing
installed PWA clients may need a reload/update to leave cached code. Inspect Vercel
auto-assignment state after rollback rather than assuming future pushes go live.

**Recommendation: GO for candidate review and, after separate authorization,
staged validation. HOLD public promotion until runtime source identity and the new
candidate's handoff/browser checks are accepted.** No commit, staging, promotion or
configuration change is authorized by this report or was performed under this task.
