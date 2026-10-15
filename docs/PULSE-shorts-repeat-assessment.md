# Shorts repeat without ENDED

The confirmed Chrome session for `uUWdS1feO3c` reported PLAYING, duration
approximately 30.461 seconds, a reset from approximately 30.01 to 0, BUFFERING,
and PLAYING again. It did not report ENDED or request queue advancement.

## Decision

Do not implement position-wrap advancement. Genuine YouTube ENDED remains the
only automatic advancement signal. Reaching 100% is only progress information.

The [documented IFrame API](https://developers.google.com/youtube/iframe_api_reference)
provides current time, duration and state changes, but no seek/replay intent event.
The bridge can acknowledge its own `seekAndPlay` command, but cannot observe
interaction inside the cross-origin YouTube iframe. A user seeking to the start
near the end, or using YouTube replay controls, can produce the same observations
as a natural loop. Absence of a known command does not establish absence of a
user action. Watching most of the video first does not remove this ambiguity.

Buffering does not identify the cause of a reset. Delayed or out-of-order samples
can also appear to wrap; duplicate samples provide no extra evidence. Sequence
numbers could order bridge samples but could not establish user intent. Current
iframe identity and listener cleanup reject retired player lifetimes, including
returning to the same video after rapid navigation; these guards do not solve
the intent problem.

## Supported alternative

Use the existing Next video control for repeating Shorts. Keep Autoplay Next for
videos that deliver genuine ENDED. EXPLORE already explicitly sets `loop=0` and
removes the loop playlist parameter. That configuration does not guarantee the
observed Short will stop repeating. A future YouTube-managed playlist using the
documented playlist API is a candidate for continuous playback, but requires a
separate integration and runtime validation of queue boundaries, clip ranges,
manual navigation and audio ownership; it is not a verified fix for this Short.

No production or bridge code changes are needed for this decision. Existing
local/hosted bridge selection, teal progress, Like/Share and LIVE exclusivity
remain intact. Tests execute mocked API and component event lifetimes, not real
YouTube playback. Hosted Chrome, Safari and Capacitor playback, and any future
playlist solution remain unverified in this work.
