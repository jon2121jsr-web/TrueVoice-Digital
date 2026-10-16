# PULSE Fix 1A.3 — resolve the uncontrolled timing comparison

Date: 2026-10-15. Branch `fix/pulse-postlaunch-1a`, HEAD
`337ef9d413ef41739d03f4442de95d83ad1fb37d`. Existing 1A.1 diagnostics/tests and
untracked material are preserved. No application code, timing configuration file,
stream URL, Vercel setting, native project or dependency was changed. No commit,
push, merge, deployment, promotion, production write or transaction occurred.

## Finding and correction to the previous recommendation

User-measured staged results with offset 15: +13,+15,+14,+14,+14 seconds, mean +14.
User-measured local results with offset zero: -40,-30,-30,-45,-40, mean -37,
with no interruptions or metadata flicker. Their means differ by 51 seconds.

**The tests used different audio delivery paths.** Local environment inspection
and the previously served development code select LIVE365
`https://streaming.live365.com/a61535`. Read-only inspection of the public
Production stream setting selects direct AzuraCast
`https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3`. Production's
metadata base remains `https://stream.truevoice.digital`, matching local metadata.
Prior public-bundle inspection independently confirmed the direct-AzuraCast
selection in the live release. Current project settings are not a historical
snapshot or a substitute for recording the staged browser's actual `currentSrc`:
a fallback could also change the effective audio path.

The staged source and local working tree have identical `metadataTimeline.js`,
`services/api.js`, `App.jsx`, `streamUrl.js` and PWA configuration. Controller
differences are the 1A.1 passive diagnostic import, observer effect and command
markers; they do not change metadata scheduling or audio operations. New tests
also do not affect playback. The local server process overrode the file value 15
with zero; file-based development/production local configuration both still load
15 and LIVE365. `VITE_STREAM_METADATA_DELAY_SEC` is absent locally and previously
verified as 35 in Production, but is unused by this controller.

Thus the 51-second difference is **not evidence of a 51-second offset effect or a
timing-code regression**. The confirmed configuration mismatch invalidates that
interpretation. The exact additional audio latency has not been measured. A
first-order explanation is ~15 seconds of UI offset plus ~36 seconds of additional
LIVE365-versus-upstream delivery latency, but polling phase, source publication,
buffer depth and differing songs make that a hypothesis, not an exact breakdown.
Local metadata 30–45 seconds before audible LIVE365 is consistent with a delayed
relay/browser audio path relative to AzuraCast metadata; the measurements alone
cannot distinguish provider delay from browser buffering.

**Withdraw the earlier unconditional recommendation to set Production to zero.**
It was based on an uncontrolled comparison. Zero is appropriate as one test arm,
not yet a validated universal Production setting. For a LIVE365 listener path that
is consistently ~37 seconds behind AzuraCast, zero naturally shows metadata early;
a positive measured source-to-listener offset may instead be needed. Do not choose
37, 40, or 51 as a release value without the controlled trace below. The licensed
LIVE365 URL and existing Production audio configuration have not been modified.

Protected staged-bundle retrieval was rejected by automatic approval review because
the connector may create a temporary authentication-bypass link. No retry,
workaround or bypass/access-setting change was attempted. Exact protected staged
asset/runtime source verification remains unavailable to the agent; a tester can
record `currentSrc` and the Network media request using ordinary authorized Vercel
sign-in. Approving a temporary authentication-bypass link would be required before
using that connector path; it is unnecessary for this local controlled test.

## Exact timing semantics

`VITE_STREAM_DELAY_SEC` is a **nonnegative number of seconds**, multiplied by 1000
for milliseconds. Positive values delay metadata relative to the source song's
Unix `played_at` timestamp. They do not delay audio, seek it, alter its buffer, or
start a full new hold on each poll. Invalid, missing or negative values normalize
to zero. `VITE_STREAM_METADATA_DELAY_SEC` has no effect on this code path.

For a new established-session song with a valid, non-future source timestamp:

```
deadline = played_at * 1000 + offsetSeconds * 1000
publish time ≈ max(first fresh observation time, deadline)
```

The one-second scheduler adds up to roughly a second when a deadline is pending.
The code caps a future-clock deadline at observation time + offset. Initial join,
missing timestamps and same-song artwork refinement are special immediate-update
cases; do not include initial joining in the transition sample. Older timestamped
snapshots are rejected; duplicate observations do not restart a deadline.

The metadata API uses `fetch(..., {cache:'no-store'})`. Production's generated worker
uses NetworkOnly for the metadata API; development has no generated PWA worker.
Neither forces AzuraCast's backend snapshots to update. Earlier source responses
advertised `max-age=15` and showed several seconds of snapshot age. Polling is
single-flight every five seconds; a late network response or background timer
throttling can extend observation delay. Browser HTTP freshness and upstream cache
behavior must be distinguished. Existing service workers in an old browser profile
are another reason to use a fresh local profile.

`playing_next` is parsed by the service but not used to predict/display the next
song. Its estimates can differ from actual current-song `played_at`; source current
metadata is authoritative for the UI. No automatic song-to-YouTube video mapping
exists. Artwork and title derive from one displayed song; image load completion
can still lag a source/DOM update.

Given identical source responses, foreground scheduling and audio, changing offset
15 to zero changes the scheduled hold by at most 15 seconds (plus tick granularity).
It cannot account for 51. Audible error is UI publication time minus the actual
listener audio transition, whose latency is outside this setting.

## Prepared controlled A/B environment

Two development servers are running on localhost only, from the existing clean
detached `.release-staging/postlaunch-1a` worktree at **exactly 337ef9d**. Both read
the same existing root local environment via Vite `envDir`; no file was copied or
edited and no stream override was introduced. Each process overrides only the
metadata offset. Neither uses the uncommitted diagnostic overlay.

| Arm | URL | Process-local offset | Verified audio URL |
| --- | --- | --- | --- |
| A | http://localhost:5176/ | 0 | `https://streaming.live365.com/a61535` |
| B | http://localhost:5177/ | 15 | same LIVE365 URL |

Both returned HTTP 200. Transformed controller modules confirm the respective
offsets, the same metadata base, and absence of the 1A.1 observer overlay. The
detached worktree remains clean. Source commit, development mode, browser/network,
metadata endpoint, configuration and stream should be held constant; only the
offset differs. Different localhost ports are the necessary server-origin
distinction; these are not a development-versus-production comparison.

### Listening protocol

1. Use the same Chrome profile, device, network, output and system clock for both
   arms. Close/pause all other audio, including the older localhost:5175 session,
   public site and direct-stream tabs. Use a clean local profile without an old
   worker. Block background analytics and Supabase requests before navigating, as
   in 1A.2, so the browser test does not write production data. Do not sign into the
   application or use uploads/payments/admin functions.
2. Open A only. Start LIVE once, verify the media Network request is LIVE365 and
   has not fallen back to AzuraCast, and let one full transition pass to settle.
   Install the optional recorder below after load, before the measured transitions.
3. Measure five consecutive comparable music transitions. Record track identities,
   audible transition, metadata response receipt, source `played_at`, title DOM
   update, artwork load completion, source URL and buffer state. Mark audible
   transitions with Alt+Shift+M (or `pulseTiming.mark('audible')`). Use a screen/audio
   recording if available to reduce manual reaction error. Tag buffering events.
4. Pause and close A before opening B. Repeat the same warm-up and five-transition
   procedure on B, using the same recorder. Do not reuse an old audio buffer or
   keep a muted second stream connected. Never run both players simultaneously.
5. If practical repeat A–B–A–B to detect drift/provider variability. Sequential live
   radio cannot guarantee the exact same songs in both arms; record song IDs,
   durations, breaks and station announcements so comparable transitions can be
   selected. A repeatable recorded metadata trace can verify scheduler arithmetic,
   but cannot reproduce a live audible relay latency.
6. Evaluate UI-to-source delay separately from audible-to-source delay. Confirm B
   waits only the remaining source offset, and source-to-audio latency is comparable
   across arms. If latency drifts substantially, a single fixed offset may not meet
   ±5 seconds reliably. Do not infer an offset from mixed endpoints or an unlogged
   fallback. Leave Vercel variables unchanged until the result is accepted.

### Optional local-only recorder (paste into a Chrome DevTools Snippet)

This wraps existing metadata fetch responses without adding requests; it reads
audio/DOM state and keeps a bounded in-memory record. It never calls play, pause,
load, seek, or changes a source. Run the identical snippet in each arm. It is
restricted to the two localhost ports; it is not production instrumentation.
Response Date/Age/Cache-Control may be null when CORS does not expose them.

```js
(() => {
  if (location.hostname !== 'localhost' || !['5176', '5177'].includes(location.port))
    throw new Error('Use only the controlled localhost test arms');
  window.pulseTiming?.stop();
  const entries = [], originalFetch = window.fetch;
  const cleanUrl = value => {
    try { const u = new URL(value, location.href); return u.origin + u.pathname; }
    catch { return null; }
  };
  function state() {
    const a = document.querySelector('audio');
    if (!a) return { audioMissing: true };
    let ahead = 0;
    for (let i = 0; i < a.buffered.length; i++)
      if (a.buffered.start(i) <= a.currentTime && a.buffered.end(i) >= a.currentTime)
        ahead = a.buffered.end(i) - a.currentTime;
    return { source: cleanUrl(a.currentSrc || a.src), paused: a.paused,
      currentTime: a.currentTime, bufferedAhead: ahead,
      readyState: a.readyState, networkState: a.networkState,
      errorCode: a.error?.code ?? null };
  }
  function mark(type, details = {}) {
    const row = { arm: location.port === '5176' ? 'A0' : 'B15',
      epochMs: Date.now(), iso: new Date().toISOString(),
      monotonicMs: performance.now(), type, ...state(), ...details };
    entries.push(row); if (entries.length > 2000) entries.shift();
    console.info('[PULSE timing]', row); return row;
  }
  const wrappedFetch = async function (...args) {
    const input = args[0], started = Date.now();
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const response = await originalFetch.apply(window, args);
    if (new URL(url, location.href).pathname.includes('/api/nowplaying/')) {
      const received = Date.now();
      response.clone().json().then(payload => {
        const root = Array.isArray(payload) ? payload[0] : payload;
        const np = root.now_playing || root, next = root.playing_next;
        mark('metadata-response', { requestStartMs: started, receivedMs: received,
          requestMs: received - started, httpStatus: response.status,
          responseDate: response.headers.get('date'), age: response.headers.get('age'),
          cacheControl: response.headers.get('cache-control'),
          playedAt: np.played_at, elapsed: np.elapsed, remaining: np.remaining,
          songId: np.song?.id, title: np.song?.title, artist: np.song?.artist,
          art: cleanUrl(np.song?.art), nextPlayedAt: next?.played_at,
          nextSongId: next?.song?.id, nextTitle: next?.song?.title });
      }).catch(() => mark('metadata-parse-failed'));
    }
    return response;
  };
  window.fetch = wrappedFetch;
  const audio = document.querySelector('audio');
  const events = ['waiting','stalled','suspend','error','pause','play','playing',
    'loadstart','emptied','abort','ended'];
  const listeners = events.map(type => {
    const fn = () => mark('audio-' + type);
    audio?.addEventListener(type, fn); return [type, fn];
  });
  let previous = '';
  function display() {
    const player = document.querySelector('.pulse-live:not([inert])');
    const title = player?.querySelector('h2')?.textContent;
    const img = player?.querySelector('.pulse-live__art img');
    const art = cleanUrl(img?.currentSrc || img?.src);
    const signature = JSON.stringify([title, art, img?.complete, img?.naturalWidth]);
    if (signature !== previous) {
      previous = signature; mark('display', { title, art,
        imageLoaded: Boolean(img?.complete && img?.naturalWidth) });
    }
  }
  const observer = new MutationObserver(display);
  observer.observe(document.body, { subtree: true, childList: true,
    characterData: true, attributes: true, attributeFilter: ['src','inert'] });
  const imageLoad = event => {
    if (event.target.matches?.('.pulse-live__art img')) display();
  };
  const audibleKey = event => {
    if (event.altKey && event.shiftKey && event.code === 'KeyM') mark('audible');
  };
  document.addEventListener('load', imageLoad, true);
  window.addEventListener('keydown', audibleKey);
  window.pulseTiming = { entries, mark, stop() {
    if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    observer.disconnect();
    listeners.forEach(([type, fn]) => audio?.removeEventListener(type, fn));
    document.removeEventListener('load', imageLoad, true);
    window.removeEventListener('keydown', audibleKey);
  } };
  mark('recorder-start'); display();
})();
```

Use `pulseTiming.mark('interruption-start')` and
`pulseTiming.mark('interruption-end')` for audible dropouts. Export locally with
Chrome's `copy(JSON.stringify(pulseTiming.entries, null, 2))`, then stop with
`pulseTiming.stop()`. Initial metadata before installing the snippet is not
captured; warm up first. Manual markers include human reaction delay. `currentTime`
and buffer depth alone are not an absolute broadcast timestamp, and chunk arrival
gaps are not proof of audible silence. This snippet is a proposed manual recording
aid, not an automated browser-verified test result; it does not run until pasted.

## Buffering and release decision

The user observed no interruptions locally. That does not establish that LIVE365
or Production is interruption-free: audio path, buffer state, browser mode and
different sessions were not controlled. Earlier 25-second GET samples succeeded
for both streams; LIVE365 had up to ~2-second inter-chunk gaps versus ~0.6 seconds
upstream. Those were byte-delivery observations, not decoded listening results.
No proven audio-lifecycle defect warrants changing recovery or preload behavior.

No new timing defect was identified and no timing/application-code correction was
made. Existing zero-offset, source-offset and audio-lifecycle regressions were
rechecked: **3/3 PASS**. Recorder snippet JavaScript syntax check PASS (not executed
in a browser). `git diff --check` PASS. Production/PWA build and broader 68 tests last
passed in 1A.1; no application-code change here requires a new build. Browser A/B
results remain pending. Both prepared test servers are development servers, not
PWA lifecycle validation environments.

**Next release recommendation: HOLD timing configuration changes and promotion.**
Run the A/B test above and capture the staged browser's actual audio URL. No new
staged deployment is necessary to diagnose this discrepancy. Once a reproducible
offset is established for the intended listener-facing path, separately authorize
the exact configuration and staged rebuild; Vite embeds the offset, so a changed
value requires a new build to validate. Do not silently switch Production between
AzuraCast and LIVE365 to make timing results match. Stream-routing changes, if
desired, are a separate explicit decision.
