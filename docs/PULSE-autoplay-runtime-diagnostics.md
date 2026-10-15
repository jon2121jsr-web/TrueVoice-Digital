# Collect actual Chrome autoplay evidence

Callback-driven listener churn has been confirmed and corrected. The cause of
missing audible autoplay is not yet established from actual player execution.
The modal embeds the hosted yt-embed.html, which creates a YouTube YT.Player.
The deployed bridge redirects to www.truevoice.digital, forwards ready/state/error,
and accepts play/unmute commands. It does not forward onAutoplayBlocked.
Changing the repository bridge alone would not update that hosted runtime.

The repository bridge now also forwards official onAutoplayBlocked events as
autoplayBlocked, and emits commandReceived only after the matching supported
API call returns. This acknowledgement proves the call ran, not that playback
started; only state 1 confirms playback. These additive events do not change
existing play/stop/mute behavior, player origins or native embedding. They require
an independently approved hosted deployment before actual clients receive them.
No deployment was performed. Until then use the DevTools procedure below.

## Local React diagnostics

### Opt-in local bridge (no deployment)

Run `npm run dev -- --host localhost --port 5173 --strictPort`, then open:

http://localhost:5173/explore?pulseLocalBridge=1&pulseVideoDebug=1

The modal now loads http://localhost:5173/yt-embed.html with the same public video,
clip and control parameters. This switch requires Vite development mode, a
loopback HTTP/HTTPS browser origin, non-native Capacitor status and the exact
pulseLocalBridge=1 query. Production, native and default development behavior
continue to use the existing hosted bridge. No credentials/configuration change.
Remove those query parameters to return to the hosted bridge; close/reopen the
modal or reload before comparing. Production share links omit diagnostic switches.

Console Preserve log + Info: click once, wait without another Play click, use
Next/Previous, then let an item end. Capture ready, commands, commandReceived
with executed=true, stateChange, autoplayBlocked and errors. Acknowledgement is
sent after the supported API call returns; it does NOT mean playback started.
State 1 is the playback confirmation. The bridge rejects commands not sent by
its actual parent; React still validates the emitting iframe window.

Verify Network shows the LOCAL bridge document. An origin/referrer restriction
or blocked YouTube resources may behave differently on localhost than the hosted
bridge; report actual errors, do not infer a successful production/native fix.
This switch covers explicit modals using videoEmbed.js, not Scroll's own player.

1. Run npm run dev, open local EXPLORE in normal Chrome, and open DevTools.
2. Enable Console Preserve log and Info messages. In the top-page console run:
   sessionStorage.setItem('pulse-video-debug', '1')
3. Reload, clear Console, start LIVE, then click one EXPLORE video. Wait for its
   ready/state messages without pressing the fallback button. Then press Play.
4. Repeat Next and Previous. Let a video genuinely finish with Autoplay Next on.
5. Filter Console by PULSE. Copy only the PULSE lines and relevant autoplay/error
   messages; do not export a full HAR or environment/credentials.
6. Disable diagnostics with sessionStorage.removeItem('pulse-video-debug').

Expected evidence sequence: selection (activation true/false), listener-attach,
iframe-load, bridge-event ready with capturedSource/currentSource true, commands
ready, bridge-event stateChange 1. Only state 1 proves the player reported PLAYING;
commands and iframe-load do not prove playback. State -1=unstarted, 0=ended,
1=playing, 2=paused, 3=buffering, 5=cued. Error codes are logged separately.
Use Chrome's Media panel or document.querySelector('audio').paused to check that
LIVE stays paused; do not log the audio URL.

listener-detach means listener cleanup, not necessarily DOM destruction. Check its
connected flag and the listener-attach/iframe-load sequence. Queue advancement records the
expected old ID, accepted/rejected result and next ID. Rejected source checks
identify old iframe messages. Compare the new player's sequence to the old one.

## Observe the real hosted player, including blocked autoplay

In DevTools Sources find the deployed yt-embed.html, not just the local copy.
Set a breakpoint inside its onReady callback or message command handler. When
paused in that lexical scope, run the following expressions individually:

    player.getPlayerState()
    player.getIframe().getAttribute('allow')
    new URL(player.getIframe().src).searchParams.get('enablejsapi')
    new URL(player.getIframe().src).searchParams.get('autoplay')
    navigator.userActivation && navigator.userActivation.isActive
    player.addEventListener('onAutoplayBlocked', function () {
      console.warn('[PULSE bridge] autoplay-blocked');
    })

Resume execution. Set a logpoint on player.playVideo() in the bridge command
handler to establish whether the actual API method runs. Do not change mute,
autoplay settings or synthesize clicks during evidence collection. A breakpoint
can itself alter activation timing; repeat with logpoints after attaching the
observer, and record whether the failure also occurs without pausing.

Inspect Network's Permissions-Policy response headers and both the outer bridge
iframe and generated YouTube iframe autoplay permissions. The outer iframe
already declares allow="autoplay; encrypted-media; picture-in-picture".
Capture the generated inner iframe's actual enablejsapi/autoplay flags, rather
than inferring them from the outer bridge query. Check Console and Chrome's
Media panel for autoplay policy messages, player errors or failed YouTube assets.

## Interpret evidence before changing code

Routine progress messages are suppressed in development Console output; UI
progress still updates. A backward position change emits one position-reset
diagnostic identifying from/to/duration/state and whether it was near the end.
This is evidence only: supported player data cannot reliably distinguish automatic
wrap, manual seek-to-start or explicit replay. No wrap-based advancement is enabled.
Closing/switching emits transition-summary (ready/playing/ended observed, resets).
Record a complete uninterrupted cycle: playing through the end, reset if present,
and subsequent playback. A screenshot during state 1/3 alone is insufficient to
establish a missing ENDED event or Shorts-specific looping. Compare affected video
IDs with a normal non-Shorts video; do not assume every reel/snip is a Short.

Queue sources use YouTube video IDs and YT.Player; no /shorts/ page URL is embedded.
The modal query specifies loop=0 and no playlist, but actual browser/API behavior
must still be observed. ENDED remains the sole advancement signal. If a player
reproducibly omits it, manual Next remains the reliable option pending a supported
fix. No hidden click interception, position threshold or countdown substitutes it.

Progress is opt-in for EXPLORE queue modals (bridge query progress=1). The updated
bridge reads getCurrentTime/getDuration every 500ms while playing, paused or
buffering, stops its timer when hidden, ended, stopped or failed, and reports
state/clip boundaries. Paused reads allow real seeks without fabricated time.
Progress messages never trigger advancement. To confirm automatic advancement,
look for stateChange 0, ended, automatic-next-request, then accepted queue-advance
without clicking Next. Hosted bridge progress requires an approved deployment;
older bridges keep ordinary Next buttons without progress.

* No ready relay: inspect bridge/YouTube initialization and network failures.
* Ready rejected by source checks: inspect iframe replacement/listener lifecycle.
* Ready accepted but no bridge play handler: investigate command delivery.
* playVideo runs and onAutoplayBlocked fires: browser policy is the demonstrated
  cause. Retain accessible explicit Play; do not claim unmuted autoplay can be
  guaranteed across Chrome, Safari or Capacitor.
* Player errors: use the actual code to distinguish unavailable content, embed
  restrictions and origin/configuration issues.

Current queue transitions intentionally remount the iframe by video ID. Keeping
one YouTube player and calling supported loadVideoById could retain more playback
continuity, but the hosted bridge does not currently implement that command.
Such a change requires separate bridge-compatible testing and eventual approved
deployment; it is not a proven fix for browser autoplay restrictions.

Persistent-player protocol requirements: add a loadVideo command accepting the
public video ID, optional start/end boundaries and a load generation; use the
supported loadVideoById object form. Tag acknowledgements and states with generation
and actual getVideoData().video_id, and reject outdated state/ended messages.
Keep the iframe src/key fixed for the EXPLORE session, retain explicit stop on
close, and keep legacy Scroll/modal bridge commands backward compatible. Evaluate
web, Safari and Capacitor user-activation behavior before enabling it. Avoid silently
adopting this protocol before the hosted bridge supports it.

Acceptance checks: initial selection, Next/Previous, real-ended advancement,
automatic next playback when permitted, explicit fallback when blocked, radio
remaining paused, close cleanup and rapid-switch stale-event rejection.
Repeat on Safari and native Capacitor; desktop evidence alone cannot validate
native audio focus, gesture policy or background playback.
