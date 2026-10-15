# PULSE continuous playback feasibility

Assessment date: October 14, 2026. Branch: `feature/truevoice-pulse`.
Investigation only; no player architecture or product behavior changed.

## Decision

Recommend option C: retain the current player and genuine ENDED advancement,
with clear, persistent guidance beside the queue: “Autoplay Next advances when
YouTube reports the video ended. If a video repeats, select Next video.” This
copy is proposed, not implemented. Do not infer that a reset proves looping or
classify every Short as unreliable. The confirmed failure concerns
`uUWdS1feO3c` in the supplied Chrome session; it is not evidence about all Shorts.

No evaluated option is proven to reliably solve missing ENDED for that Short.
Automatic continuation can be offered conditionally, but uninterrupted automatic
playback across all YouTube videos and browsers cannot currently be promised.

## Current implementation and configuration

`VideoModal.jsx` keys the iframe by video identity. `App.jsx:advanceVideo(step,
expectedId)` validates the queue destination, invalidates the prior queue entry,
stops the old frame and selects the next video. The listener rejects retired
iframe sources and has a once-only ENDED guard. Progress updates the underline
and reset diagnostics; it never completes playback. Ready requests play once;
there is no reset handler that sends play, seek or Next.

`withVideoControls(url, {progress:true})` sets controls=1, progress=1, loop=0 and
removes playlist. The bridge only sets YouTube loop/playlist when loop is true.
It constructs `YT.Player` by video ID, using its actual HTTPS origin in hosted
mode. EXPLORE requests autoplay=1, mute=0 and defaults playsinline to 1. Clip
start/end are passed through. Local bridge selection is development-only and
explicitly opted into; native retains the hosted bridge.

Thus code inspection finds no explicit EXPLORE loop configuration or repeated
app Play command explaining the observed reset. This does not establish its
root cause. The deployed bridge version and actual runtime parameters must be
checked separately. Scroll's intentional loops are a separate integration and
must not be changed as part of an EXPLORE experiment.

YouTube documents loop=0 as the default; single-video looping uses loop=1 with
a matching playlist ID. Playlist specifies subsequent videos. Autoplay requests
initial playback; playsinline controls iOS presentation, requiring inline-enabled
WebViews. Neither is a completion switch. Modestbranding is deprecated and
ineffective; rel=0 limits related content to the same channel rather than removing
it. No documented parameter specifically promises nonrepeating Shorts or repairs
missing ENDED. [Player parameters](https://developers.google.com/youtube/player_parameters)

Standard videos and Shorts use the same video-ID-based integration here. The
reviewed reference exposes no separate Shorts completion contract. Test both;
do not treat video length, aspect ratio or feed reel/snip labels as a guarantee.

## Supported capabilities and evidence limits

The API supports `loadVideoById` with optional startSeconds/endSeconds;
`loadPlaylist` accepts an ID array. Playlist controls include nextVideo,
previousVideo, playVideoAt, getPlaylistIndex, setLoop and setShuffle. ENDED is
state 0. `onAutoplayBlocked` covers scripted playback, including loading videos
and playlists. No documented seek/replay-cause event distinguishes a natural
wrap. None of these APIs promises to restore missing ENDED for Shorts.
[IFrame API](https://developers.google.com/youtube/iframe_api_reference)

| Option | Technical support and experience | Complexity | Web and native risk | Missing ENDED result |
| --- | --- | --- | --- | --- |
| A. Current embeds, ENDED plus manual Next | Existing implementation; automatic advance when accepted ENDED arrives, user can always choose an available Next | Lowest; already built | Remount reloads player; subsequent audible playback may need Play. Hosted bridge still required on iOS | Known repeating Short remains manual |
| B. Persistent player, loadVideoById | Supported loading command; potentially smoother transitions without iframe recreation | High: new bridge protocol and load lifecycle | Possible continuity benefit is an inference, not measured; autoplay, origin and stale-event races remain | Does not supply a completion signal; no proven fix |
| C. Mixed experience | A plus honest generic fallback guidance; automatic advancement remains event-based | Low: copy and focused UI validation | Same playback risks as A; no new native integration | Recommended; communicates rather than conceals the limitation |
| D. YouTube-managed playlist | Supported candidate: let YouTube manage transitions and reconcile actual selection | High: competing queue authorities, toggle and clip handling | Requires web and device experiment; actual Short behavior unknown | Could avoid app dependence on ENDED if YouTube advances internally; not demonstrated |

B changes how the next selection loads, not how the app knows to select it.
Persistent playback must not be marketed as a fix based only on avoiding remounts.
For D, playlist progression and TrueVoice queue advancement must never both own
the same transition. Turning Autoplay Next off must prevent internal continuation;
setting loop=false alone only prevents playlist cycling. Per-item clip boundaries
are not represented by the documented playlist loading arguments. Existing
clipped content therefore makes D materially harder than a full-video playlist.

Opening an ordinary YouTube playlist externally is an optional handoff, not a
guarantee of TrueVoice queue continuity. Independently licensed original media
could use another player, but no such source or rights are established here.
Extracting/rehosting YouTube streams is not a supported alternative: YouTube
restricts downloading and storage without approval, undocumented access, audio
separation and background-player features.
[Developer policies](https://developers.google.com/youtube/terms/developer-policies)

## Player requirements

All embedded options retain YouTube controls, branding, ads and functionality;
guidance belongs outside the player. Verify a minimum 200 by 200 pixel viewport
and adequate control space, more than half visibility before autoplay, only one
simultaneously autoplaying YouTube player, and required client identification.
Use OS-provided WebViews. These are acceptance criteria, not a claim that this
investigation completed a whole-app compliance audit.
[Required minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)

The modal uses responsive 16:9 dimensions; a narrow phone viewport can produce
height below 200 pixels. Measure it before claiming requirements are met on all
devices. No CSS changes were made. Native retains the real HTTPS bridge: Capacitor
does not allow http/https as its iOS local scheme. A persistent player can live
inside that bridge; it does not justify replacing it with a fabricated origin.
[Capacitor configuration](https://capacitorjs.com/docs/config)

## Exact prospective change surfaces

No production files need changing for A. For recommended C:

- `src/components/VideoModal.jsx`: add generic fallback guidance adjacent to
  Autoplay Next/Next, without changing `onAdvance(step, expectedId)` semantics.
- `src/components/VideoModal.css`: only if guidance requires layout styling;
  also a separately scoped viewport correction if measurement confirms a shortfall.
- `tests/pulse-playback.test.mjs`: verify guidance and existing queue controls.
- This report and existing runtime-diagnostics documentation: record limitations
  and browser/device evidence. No backend or content-schema changes required.

If B is separately authorized, the required surfaces are:

- `public/yt-embed.html`: backward-compatible capability/version handshake and
  a `loadVideo` command with video ID, optional clip bounds and request generation.
  Relay ready, acknowledgements, state, progress, error and autoplayBlocked with
  load identity. Replace closure-fixed progress video/clip metadata on each load.
- `src/components/VideoModal.jsx`: stable iframe key/src per session; load after
  bridge capability confirmation; reset ENDED/progress state per accepted load.
  Preserve explicit Play and legacy remount fallback for older hosted bridges.
- `src/App.jsx`: adapt the stop/remount interaction in `advanceVideo` for accepted
  persistent loads while preserving queue ordering and LIVE ownership. Its existing
  expected-ID check is insufficient for A→B→A delayed loads; add session/load
  identity to transition validation if adopting this architecture.
- `src/features/pulse/videoQueue.js`: guard lifetime per load and validate load
  identity alongside expected video ID; retain queue ordering and boundaries.
- `src/lib/videoEmbed.js`: session bootstrap URL/capability selection if needed;
  preserve native HTTPS and local opt-in routing.
- `src/features/pulse/videoDiagnostics.js`, `tests/pulse-bridge.test.mjs`,
  `tests/pulse-playback.test.mjs`: load acknowledgements, stale events and legacy
  bridge compatibility evidence.

Simply stamping every callback with the newest requested generation is unsafe:
it can relabel an older asynchronous callback. The future design must establish
accepted-load identity and test ambiguous/in-flight callbacks, not assume a token
solves them. No protocol was designed or implemented in this investigation.

D requires the same bridge/modal/App/test surfaces plus a distinct selection
reconciliation interface for actual playlist index/video, disabled shuffle/loop,
Autoplay Next off, final boundary and manual Previous semantics. Do not reuse
`onAdvance` to guess completion from playlist progress. Clip compatibility and
the authoritative queue owner must be settled before implementation.

`mediaCoordinator.js`, LIVE components, `videoEngagement.js`, active navigation
styles, Supabase and backend systems need no change for the recommendation.

## Validation required before stronger claims

Run a recorded comparison on local bridge and the matching hosted bridge version:
current construction, persistent loading and managed playlist, if experiments
are separately authorized. Use the confirmed Short, several other Shorts,
standard videos, full-length and clipped items. Keep loop disabled; verify actual
parameters, commands, states and automatic/manual transition origin. Do not
assume substituting an end boundary derived from duration fixes completion.

Test current desktop Chrome, Firefox, macOS Safari, iPhone/iPad Safari, and physical
Capacitor iOS devices across supported OS versions. Include a fresh session,
prior user interaction, muted/unmuted playback, autoplay denial, slow network,
buffering, player errors, ads, seeks, replay, fullscreen, orientation and background
then foreground. Browser policy may still require explicit Play.

Verify initial selection, repeated automatic transitions where ENDED occurs,
Autoplay Next off, final boundary, Next/Previous spam including A→B→A, stale and
duplicate callbacks, clips, unavailable items, close/reopen and route changes.
Check actual video against queue label, progress, Like/Share identity, and verify
LIVE stays paused while video owns audio and does not resume on close. Validate
controls visibility, viewport size, keyboard/accessibility and no hidden playback.
On iOS verify real bridge origin/client identification, no error 153, inline
playback configuration, audio focus and recovery after app lifecycle transitions.

Evidence retained: supplied Chrome repeat trace; previous pass of 36 focused
tests, targeted lint, production/PWA build and diff checks. Those mocked tests
establish event handling, not real-world ENDED delivery. This investigation did
not run new browser/device experiments or repeat builds for documentation only.

## Phase 4B commit decision

The missing ENDED limitation alone need not block committing Phase 4B as a
documented, best-effort ENDED-based queue with manual fallback. It must not be
described as guaranteed continuous Shorts playback. Include the limitation and
test coverage; make fallback expectations visible before a product release.

This is a conditional source-control assessment, not blanket approval of every
uncommitted Phase 4B file or a release/compliance sign-off. Review the full pending
diff and existing security follow-up separately. Native/hosted validation and
player-size/client-identification checks remain outstanding. No commit, push,
merge or deployment was performed.
