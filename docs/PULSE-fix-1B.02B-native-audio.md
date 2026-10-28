# Fix 1B.02B ? Native iOS background radio implementation

Status: LOCAL IMPLEMENTATION COMPLETE; macOS/Xcode and physical-device validation NOT PERFORMED. This is not approval to build/upload an IPA or release the native app.

## A. Architecture and Phase 0 verification

Verified worktree: C:/Users/jon52/TrueVoice-Digital/.release-staging/fix-1b02a/worktree. Branch fix/native-ios-1b02a, HEAD 6f6b6aaf85a9d861f5c91bc6df88c79bf10bad35. The request's TrueVoice-Digital.release-staging path did not exist; the established Stage A worktree under TrueVoice-Digital/.release-staging was used. All 193 Stage A overlay-manifest entries matched before implementation. Stage A native API routing and supported capacitor://localhost configuration were present. No native scaffold was missing relative to that verified baseline; previously documented absent generated Pods/workspace/public resources remain unsynced intentionally.

Native iOS: PULSE controls -> serial nativeRadio adapter -> Capacitor TrueVoiceRadio plugin -> main-queue intent policy -> one AVPlayer. Native stateChanged snapshots carry increasing revisions; React ignores stale responses and never invents native playback success. A separate native intent version rejects delayed JS Play commands after a newer Pause, handoff or exhausted recovery. Conservatively stale commands can require a fresh tap after state refresh; device testing must cover bridge initialization and fast handoffs. Browser and Android continue using the existing HTML audio controller. iOS mounts no main HTML radio element and its verse hook never constructs Audio(). Missing native bridge fails closed, with no HTML or direct-origin fallback.

The supported Capacitor 7 registration pattern is CAPPlugin + CAPBridgedPlugin, registered in a CAPBridgeViewController subclass through registerPluginInstance. Main.storyboard selects that subclass; the Xcode sources phase includes plugin, view controller and policy. Existing external plugins, app identifier, dependency versions, signing settings and native assets are unchanged.

## B. Complete Stage B changed-file inventory

Modified relative to the Stage A snapshot:
- tests/live365-distribution.test.mjs
- ios/App/App.xcodeproj/project.pbxproj
- ios/App/App/Base.lproj/Main.storyboard
- ios/App/App/Info.plist
- src/App.jsx
- src/components/NowPlayingPanel.jsx
- src/features/pulse/mediaCoordinator.js
- src/hooks/useVerseRadioAudio.js
- src/hooks/useYouTubePlayer.js

Added:
- ios/App/App/RadioBridgeViewController.swift
- ios/App/App/TrueVoiceRadioPlugin.swift
- ios/NativeAudioPolicy/Package.swift
- ios/NativeAudioPolicy/Sources/NativeAudioPolicy/RadioPlaybackPolicy.swift
- ios/NativeAudioPolicy/Tests/NativeAudioPolicyTests/RadioPlaybackPolicyTests.swift
- src/lib/nativeRadio.js
- tests/native-audio.test.mjs
- docs/PULSE-fix-1B.02B-native-audio.md (this report)

The existing Live365 test changed only to supply the React context functions now imported by the shared verse hook; its distribution/rejection assertions remain intact. Stage A reconstruction changes are not attributed to Stage B. No CSS, artwork, branding, API handler, authentication policy, dependency, Codemagic workflow or provider configuration changed.

## C. Swift bridge and React integration

- TrueVoiceRadioPlugin.swift exposes play(owner,reconnect), pause(owner), getState and setVideoActive. It accepts no stream URL from JavaScript. AVPlayer always uses https://streaming.live365.com/a61535 with normal provider redirects, ads and delivery. No seeks, audio extraction, ad filtering, URL bypass or alternate listener endpoint exists.
- RadioPlaybackPolicy.swift contains the intent/ownership/interruption/retry rules. It is compiled directly into the app target; its separate dependency-free Swift package supports policy tests on a Swift-capable host without adding an app dependency.
- RadioBridgeViewController.swift registers exactly one plugin instance. Existing AppDelegate and signing code were retained.
- nativeRadio.js serializes bridge calls and shares a single listener connection. Production JS Play requires a recent trusted page gesture; cold listen-query/deep-link effects cannot silently start AVPlayer. Remote native commands operate independently of JavaScript timers and require previous explicit activation.
- NowPlayingPanel uses native snapshots for native playback, buffering, errors, metadata and AzuraCast listener counts. The existing PulseLive presentation and floating/compact controls are reused. Native mode bypasses the WebView recovery and metadata timers; browser mode retains them.
- App does not mount its HTML audio element on native iOS and does not install its radio browser MediaSession controls there. Native foreground refresh reads state without playing. Native background visibility pauses video, not radio.
- useVerseRadioAudio selects the existing browser hook or a native hook using the same bridge/owner. Native verse visibility does not autoplay. Explicit verse Play takes the shared engine; scoped cleanup cannot pause a different owner.
- mediaCoordinator and native video entry points wait for acknowledged native pause/video ownership before mounting or commanding video. A stale or failed handoff cannot admit that pending video. Browser handoffs remain synchronous. Video close never resumes radio. Starting radio explicitly stops video; WebKit video-stop/AVAudioSession interactions still require device confirmation.

## D. Playback, recovery and interruption behavior

- AVAudioSession category .playback is configured and activated on Play; UIBackgroundModes contains only audio. No perpetual background task or silent-audio workaround is used.
- Cold start remains paused. Explicit Pause clears intent, invalidates pending recovery, releases the current listener item, cancels native metadata requests and deactivates the session with notifyOthersOnDeactivation. Resume is an explicit fresh Live365 connection, so provider intro ads may legitimately repeat.
- Interruption began pauses AVPlayer and cancels recovery while preserving existing user intent. Ended resumes only when the system supplies shouldResume, intent still exists, and video does not own playback. Pause during an interruption prevents resume.
- Losing headphones/Bluetooth through oldDeviceUnavailable clears intent and pauses, avoiding an unexpected speaker restart. Other route changes are left to AVAudioSession/AVPlayer and need device tests.
- Media-services reset disposes old player observations, pauses the old player, creates its replacement and resumes only if the existing policy permits. A paused app stays paused.
- Recovery uses native observation and a native wall-clock watchdog. After 20 seconds without progress, or item failure/end, retries are bounded to 2/5/10-second delays. Pause, video ownership and interruption invalidate queued work. The budget resets only on new explicit Play or 30 seconds of sustained progress. Exhaustion requires another user Play. No failure path changes provider.
- MPRemoteCommandCenter provides Play/Pause/toggle, disabled before first activation and while video owns playback. Seek/skip/next/previous commands are disabled. MPNowPlayingInfoCenter publishes live-stream status and playback rate without a fabricated duration or seek timeline. Station artwork uses the already-approved public/icon-512-waveform-v1.png; native icon/splash assets were not changed.
- Native metadata polling uses the existing public https://www.truevoice.digital/api/nowplaying endpoint, no cookies, a 10-second timeout and single-flight requests. It preserves the accepted 55-second Live365 display offset using played_at, with bounded title/art fields and cancellation-generation checks. Track artwork remains available to the React UI; native Now Playing uses station artwork. Metadata errors do not trigger stream replacement. Listener counts from this endpoint remain AzuraCast counts, not evidence of Live365 audience reach.

## E. Local validation

Windows checks:

- Focused bridge/native routing/playback/admin/post-launch suite: 108 passed, zero failures.
- Full JavaScript suite: 158 tests; 156 passed, 1 failed, 1 skipped. The only failure is the pre-existing catalog-proxy test expecting 200 but receiving 503 (pulse-stabilization.test.mjs). Disposable database execution was explicitly disabled; no SQL or migrations ran.
- Twelve new JavaScript tests cover platform selection, one listener connection, stale snapshots, serialized Pause/reconnect, interruption/remote events, failure without fallback, native verse silence/ownership, trusted-gesture gating, acknowledged/stale/failed video handoff, project registration, and the actual native PULSE controller receiving native track/remote-Pause snapshots without WebView polling.
- Focused ESLint for all edited JavaScript implementation files: passed. Full lint remains at the pre-existing 22 process/Buffer errors in unchanged API files and one unused-disable warning in unchanged TrueVoiceScrollPreview.jsx.
- Final local production build: passed, 814 modules, 16 PWA precache entries. Main bundle /assets/index-D7HuKI8n.js, 946.94 kB (283.89 kB gzip). Large-chunk warning remains.
- Emitted timing check passed: Live365 55 / AzuraCast 2 / unknown 15 seconds. Live365 URL present; forbidden direct-origin /listen/ and /hls/ listener URLs absent. The AzuraCast timing classifier and metadata APIs do not select listener audio.
- Native plist and storyboard XML parse successfully; source-registration and capability checks pass. git diff --check passes. These are structural checks, not a Swift compilation or an Xcode project build.
- Seven Swift policy XCTest cases were authored for cold start, explicit Pause during interruption, system resume permission, video handoff, stale-owner cleanup, bounded retries and stale Play after remote Pause. They were NOT EXECUTED: Swift, swiftc and Xcode are unavailable on this Windows host.

Public Supabase configuration was supplied in memory through the existing Stage A local build helper. No credentials were printed or persisted, no dependency was installed/upgraded and no native bundle was synced.

## F. Required macOS/Xcode validation (not performed)

After separate approval, run swift test --package-path ios/NativeAudioPolicy. Resolve and type-check the plugin against installed Capacitor 7.6.9 and the chosen supported Apple SDK. Verify CAPPlugin Objective-C selectors, storyboard module/registration, PBX source paths, AVFoundation/MediaPlayer framework autolinking and native asset availability after an authorized sync. Verify the audio capability in the resulting archive and confirm signing/profile entitlements without changing credentials casually.

No CocoaPods, Capacitor sync, Xcode build, IPA archive, Codemagic, TestFlight or App Store upload ran here. The local dist bundle is not inside a new native package. The pre-existing deployment target is still iOS 14.0; validate minimum-supported and current iOS behavior explicitly, particularly WebKit media/session interactions and background recovery.

## G. Risks and unresolved questions

Native Swift compilation and AVPlayer runtime behavior are unverified. Windows JS fixtures prove the bridge contract and UI routing, not actual AVPlayer audio, OS suspension behavior or interruptions. The tests must not be cited as physical-iPhone acceptance.

A long network outage can cause iOS to suspend an app after audio stops; real background recovery and remote-command delivery need physical testing. The 55-second fixed metadata delay is inherited, not a new latency measurement; ads/network buffering can cause station-specific drift. Native session reconnection can create a new Live365 session or replay provider intro ads; this implementation does not bypass that behavior.

Check whether Live365 accepts the native client's normal delivery/session characteristics and obtain branded-native distribution authorization. Live365 does not establish rights for YouTube/podcasts. Existing signing/toolchain/build-number, privacy, push/APNs-FCM, authentication return links, old app icon/splash and third-party media issues remain from Fix 1B.01. None were silently resolved or expanded in this stage. Existing dependency and optional artwork-tool vulnerabilities remain.

## H. Proposed physical-iPhone acceptance

1. Cold launch, background launch and cold listen deep link remain silent until explicit Play. Missing bridge/failed connection never falls back to HTML or AzuraCast listener URLs.
2. Listen for at least 30 minutes while locked and backgrounded. Confirm one radio session/owner and verify listener reporting in Live365 after its normal delay. Do not infer reach from AzuraCast counts.
3. Test PULSE, floating/compact and Control Center/lock-screen Play/Pause. Pause during buffering and pending retry; wait beyond every backoff and confirm silence persists.
4. Test calls, Siri/alarms, interruption with/without permitted resume, and explicit Pause during interruption. Test headphones unplugged, Bluetooth disconnection/reconnection and speaker/AirPlay routing.
5. Exercise Wi-Fi/mobile handoff and short/long offline periods in foreground/background. Confirm bounded retries, accurate UI error, explicit retry after exhaustion and no origin fallback.
6. Exercise video -> radio, radio -> video, rapid switching, video close, route navigation and verse controls. Confirm no overlapping audio or stale callbacks resurrecting playback. Video must not gain background-radio behavior.
7. Observe multiple song/ad transitions, native metadata/artwork, accepted offset and Live365 delivery. Record ad/metadata drift rather than hiding it with seeks or reloads.
8. Test foreground state refresh after remote commands and WebView suspension. Simulate media-services reset using supported Xcode/device diagnostics and verify paused intent survives.
9. Cover both the minimum supported iOS version and a current release, supported iPhone sizes and iPad behavior where the target remains enabled.

## Preservation and stop point

Original root checkout: 468 recorded files unchanged. Original Live365 worktree: 339 recorded files unchanged. Only the authorized native worktree and its local audit evidence were edited; Stage A routing/configuration changes and uncommitted work were retained.

No commits, pushes, merges, production/Vercel calls, provider changes, signing-credential changes or branding changes occurred. Evidence lives in ../stage-b-audit/ (relative to the worktree): before.json, change-inventory.json, focused-tests.log, all-tests.log, focused-lint.log, full-lint.log and build.log. Stop for review before any macOS build/TestFlight stage.

References: https://capacitorjs.com/docs/v7/ios/custom-code ; https://developer.apple.com/documentation/AVFAudio/handling-audio-interruptions ; https://developer.apple.com/documentation/avfaudio/responding-to-audio-route-changes .
