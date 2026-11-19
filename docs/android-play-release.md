# TrueVoice Digital — Android Google Play Release Track

Status: **device-test candidate only**. Do not submit for production until signed AAB, Android playback acceptance, data safety and rights review pass.

## Source and controls

- Base: reviewed iOS Build 27 source at `release/ios-testflight-1b04`; Android changes isolated in `release/android-play-1`.
- Android application ID: `digital.truevoice.app`, initial `versionCode 1`, `versionName 1.0`.
- Stream: `https://streaming.live365.com/a61535` via the existing shared web player.
- Android target and compile SDK: 36. AGP 8.13.2, Gradle 8.13, Java 21.
- Launcher icon: approved blue TrueVoice waveform on dark canvas, vector in `android/app/src/main/res/drawable/truevoice_app_icon.xml`.
- Codemagic: manually trigger `android-play-debug-v1` on `release/android-play-1`. It produces a test APK only, with no Google Play publishing integration and no release signing configuration.

## Device acceptance — REQUIRED

Test on a physical Android phone, preferably with both Wi-Fi and cellular:
1. App launches and shows the TrueVoice PULSE UI, correct branding and navigation.
2. Start live playback by tapping Play; listen through **10 voice drops**.
3. Open other apps and lock the screen. Verify uninterrupted playback.
4. Test Android notification media controls, Play/Pause, and metadata updates.
5. Verify Wi-Fi-to-cellular and cellular-to-Wi-Fi transition recovery.
6. Play a YouTube video; confirm radio is paused, and radio does not unexpectedly restart over the video.
7. Verify podcast links, Chime In, support and store links; check permissions.
8. Confirm no crash and verify startup on modern Android (including API 36).

### Known release blocker to investigate

The iOS application uses a native Swift audio plugin. `IS_NATIVE_RADIO` currently enables that plugin **only on iOS**. Android therefore uses HTML audio inside the Capacitor WebView, which may not provide reliable background playback, media notifications, or lock-screen controls. **Do not claim Android is feature-parity with Build 27 until those are implemented and device-tested.** A Media3 foreground playback service is the recommended native path if tests confirm this deficiency.

## Google Play prerequisites

- Google Play developer account and app record; verify organization or personal-account status. Certain newer personal accounts require **12 continuously opted-in closed testers over 14 days** before production access.
- Signed Android App Bundle (.aab), unique upload signing key, Google Play App Signing setup, and version code management. Never check signing secrets into Git.
- Complete store listing, 512×512 PNG icon, 1024×500 feature graphic, device screenshots, support contact and privacy policy.
- Complete Data safety and App content declarations, including permissions, user-generated content / reporting, age rating, and payment/distribution policy.
- Use the same evidence strategy as Apple: Live365 broadcasting coverage, authorized YouTube embeddings and published podcast feeds. Confirm the territories in which the licensed music stream may be made available.
- Start in internal testing or closed testing, validate, then advance to production after policy approval.

## Build

Trigger `android-play-debug-v1` in Codemagic on `release/android-play-1`. Download the `app-debug.apk` artifact and test on Android. **This debug APK is not an upload-ready Play Store bundle.**

## Android Firebase startup crash — first APK diagnosed 19 Nov 2026

The initial `app-debug.apk` crashes on Android 14 and 17 because `@capacitor/push-notifications` attempts to register with FCM when `google-services.json` and a default FirebaseApp are absent (`java.lang.IllegalStateException: Default FirebaseApp is not initialized`).

The test-build fix deliberately skips Android push registration before loading the native push plugin. **Android push notifications are not available in this candidate.** iOS notification behavior is unchanged. Before enabling Android push, provision the correct Firebase project/client configuration and implement a guarded initialization test. Rebuild the APK; reinstall it on Pixel 4a and verify startup and Live365 audio. Do not confuse successful compilation with a successful device test.


## Android media controls test candidate — 19 Nov 2026

The Android notification panel exposed no media session while the HTML-audio stream continued playing. The Android-only Media3 implementation adds:
- `TrueVoicePlaybackService`: one ExoPlayer and MediaSessionService owning the Live365 stream and its Android media notification.
- `TrueVoiceRadioPlugin`: Capacitor commands for play, pause, native state and video handoff. No second HTML audio decoder.
- Native player metadata receives the established delayed Live365 song timeline from `NowPlayingPanel`, replacing metadata on the same URI.
- `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` permissions, and a `mediaPlayback` foreground service.
- Android testing and native routing guards in Codemagic; iOS Swift radio and public site remain unchanged.

**Status: source candidate, not device validated.** Run the Android debug workflow, uninstall the previous debug-signed APK if signatures differ, and install the new APK on the Pixel 4a. First verify launch and stream playback. Then with audio active: Home -> notification controls -> pause -> play -> lock screen -> unlock -> video handoff -> 10 clean voice drops. Capture logs for any crash or stalled stream. The previously passing WebView audio route has been replaced only on Android; no Android feature can be marked passed until re-tested.

**Do not publish** until the session service is stable, signing and AAB are configured, and Google Play policy checks are complete.
