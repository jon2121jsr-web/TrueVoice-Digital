# TrueVoice Digital — Native App Setup Runbook

Phase 1: wrap the existing React/Vite site with Capacitor so it ships as a
real iOS + Android app — reliable background audio, push notifications,
and an App Store/Play Store presence — without rebuilding the UI. This
doc is the step-by-step for taking what's already in the repo
(`capacitor.config.ts`, the Capacitor packages in `package.json`, the
`push_subscriptions` table + `/api/push/*` endpoints, and
`src/lib/pushNotifications.js`) and turning it into installable app
builds.

Run every command below from the repo root (`C:\Users\jon52\TrueVoice-Digital`)
in PowerShell, in order. Sections are marked **(Mac only)** where they need
Xcode and can't be done on Windows.

---

## 0. Bundle ID

**`digital.truevoice.app`** — already set as `appId` in `capacitor.config.ts`.
This is the reverse-DNS ID that has to match exactly in three places:
the iOS App ID in the Apple Developer portal, the Android
`applicationId` in Google Play Console, and the app registrations you
create in Firebase (step 4). Register it identically everywhere — a
mismatch anywhere is the single most common Capacitor setup mistake.

---

## 1. Install dependencies and add the native platforms

```powershell
npm install
npm run build
npx cap add ios       # (Mac only — see note below)
npx cap add android
npx cap sync
```

`npx cap add ios` generates the `ios/` folder using CocoaPods, which only
runs on macOS. If you're doing this step from Windows, skip it for now
and run it later on the Mac — `npx cap add android` and everything else
in this doc works fine on Windows in the meantime. `npx cap sync` copies
the built `dist/` web bundle plus the Capacitor plugin bindings into
whichever native folders already exist, and is safe to re-run any time
after a `npm run build`.

From here on, **every time you change the web app**, ship it to the
native shells with:

```powershell
npm run cap:sync      # = vite build && npx cap sync
```

---

## 2. iOS — background audio + push (Mac only)

Do this in Xcode (`npx cap open ios` opens the generated project).

**2a. Signing.** In the project's Signing & Capabilities tab, select your
renewed Apple Developer team. Xcode will register the `digital.truevoice.app`
App ID automatically the first time you build, as long as your Developer
Program membership is active.

**2b. Background Modes.** Add the "Background Modes" capability, and
check:
- **Audio, AirPlay, and Picture in Picture** — required for the stream
  to keep playing when the phone locks or the app backgrounds.
- **Remote notifications** — required for silent/background push delivery.

This adds `UIBackgroundModes` (`audio`, `remote-notification`) to
`Info.plist`. Without the `audio` entry, iOS suspends the WKWebView's
audio the moment the app backgrounds — this is the actual mechanism
behind "consistent audio," not just a nice-to-have.

**2c. AVAudioSession category.** A WKWebView's `<audio>`/HTML5 audio
element doesn't automatically get the right session category for
background playback — it needs the native side to set one. In
`ios/App/App/AppDelegate.swift`, inside `application(_:didFinishLaunchingWithOptions:)`,
add:

```swift
import AVFoundation
// ...
try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
try? AVAudioSession.sharedInstance().setActive(true)
```

`.playback` is the category that keeps audio alive in the background and
mixes correctly with CarPlay in a later phase — `.ambient` or the
default category will get silenced on backgrounding, which is the exact
symptom to watch for if audio still stops when this step is skipped.

**2d. Push capability.** Add the "Push Notifications" capability (separate
from Background Modes) — this is what lets the app receive an APNs
token at all, which `src/lib/pushNotifications.js`'s `PushNotifications.register()`
call depends on.

---

## 3. Android — background audio + push

**3a. Foreground service for background audio.** Android is stricter
than iOS about backgrounded audio: a WebView's `<audio>` playback gets
throttled/killed in the background unless it's backed by a real foreground
service with a persistent notification (the same mechanism Spotify/YouTube
Music use). The `@capacitor-community/background-mode` community plugin
is the fastest path for wrapping the current architecture:

```powershell
npm install @capacitor-community/background-mode
npx cap sync
```

Then in the app's init code (alongside `initPushNotifications`, e.g. in
`src/App.jsx`), enable it once when audio starts playing:

```js
import { BackgroundMode } from '@capacitor-community/background-mode';
// when the stream starts playing:
BackgroundMode.enable();
```

This keeps a low-priority "TrueVoice Digital is playing" notification
up while backgrounded, which is what keeps Android from suspending the
WebView's audio thread. (Not yet wired into the repo — this is scoped
for the native testing pass, since it needs a real device to verify.)

**3b. Push (FCM) is automatic.** Unlike iOS, Android push doesn't need a
manual capability toggle — `google-services.json` (step 4) is what
enables it, picked up automatically by the Capacitor Android Gradle
build once it's dropped into `android/app/`.

**3c. Icon-driven splash.** Android 12+ ignores a custom splash layout in
favor of its own icon-based splash unless `windowSplashScreenAnimatedIcon`
is set — `@capacitor/assets` (step 5) generates this correctly from the
existing icon, no manual XML needed for Phase 1.

---

## 4. Firebase + APNs (push notifications)

This wires up `api/push/send.js`'s Firebase Admin call and the native
apps' ability to receive pushes at all.

1. **Create the Firebase project.** [console.firebase.google.com](https://console.firebase.google.com) →
   Add project → name it "TrueVoice Digital" (Google Analytics for the
   project is optional, can skip).
2. **Add the Android app.** Project Settings → Add app → Android.
   Package name: `digital.truevoice.app` (must match `capacitor.config.ts`
   exactly). Download `google-services.json` and place it at
   `android/app/google-services.json` in this repo (after `npx cap add android`
   has created that folder).
3. **Add the iOS app.** Same screen → Add app → iOS. Bundle ID:
   `digital.truevoice.app`. Download `GoogleService-Info.plist` and add
   it to the Xcode project (drag into the `App` target in Xcode — this
   step needs the Mac).
4. **Upload the APNs key.** Project Settings → Cloud Messaging → Apple
   app configuration → upload an APNs Auth Key. Generate that key in the
   Apple Developer portal under Certificates, Identifiers & Profiles →
   Keys → "+" → check "Apple Push Notifications service (APNs)" → download
   the `.p8` file (Apple only lets you download it once — save it
   somewhere safe). You'll also enter the Key ID and your Apple Team ID
   alongside the upload.
5. **Generate the server credential.** Project Settings → Service
   Accounts → "Generate new private key" — downloads a JSON file. Open
   it, copy the entire JSON as one line, and set it as the
   `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable in the Vercel
   project (`true-voice-digital` → Settings → Environment Variables).
   This is what `api/push/send.js` reads to authenticate to FCM.

After this, `/api/push/register.js` and `/api/push/send.js` are fully
live — no further code changes needed to start sending pushes once real
device tokens are registered.

---

## 5. App icons and splash screen

Generate every required native icon/splash size from the existing PWA
icons already in `public/` (`icon-512.png` etc. — see `vite.config.js`'s
manifest) instead of exporting a new asset by hand:

```powershell
npm install -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor "#050816" --splashBackgroundColor "#050816"
```

Point it at `icon-512.png` (or a higher-res master if you have one — 1024×1024
is the App Store's minimum). Re-run this any time the logo changes and
follow with `npx cap sync`.

---

## 6. TestFlight (iOS internal testing) — Mac only

1. In App Store Connect ([appstoreconnect.apple.com](https://appstoreconnect.apple.com)),
   create a new app: bundle ID `digital.truevoice.app`, name "TrueVoice
   Digital". Requires the Apple Developer Program renewal to be active.
2. In Xcode: Product → Archive (with a Release build config and your
   signing team selected).
3. Once archived, Window → Organizer → Distribute App → App Store
   Connect → Upload.
4. Back in App Store Connect, under TestFlight, the build appears after
   Apple finishes processing (usually 10-30 min). Add yourself (and any
   other testers) to an internal testing group — internal testers don't
   need App Review, so this is the fastest way to get it on a phone.
5. Testers install the **TestFlight** app from the App Store, accept the
   invite email, and install TrueVoice Digital through it.

---

## 7. Google Play internal testing track

1. In Play Console ([play.google.com/console](https://play.google.com/console)),
   create the app: package name `digital.truevoice.app`.
2. Build a signed release bundle:
   ```powershell
   cd android
   ./gradlew bundleRelease
   ```
   This needs a signing keystore — Android Studio's Build → Generate
   Signed Bundle/APK wizard will create one the first time and walk
   through it; keep that keystore file and its password somewhere safe
   and backed up, since a lost keystore means you can never update the
   app under the same listing again.
3. In Play Console, Testing → Internal testing → Create release, upload
   the `.aab` from `android/app/build/outputs/bundle/release/`.
4. Add tester emails to the internal testing list, share the opt-in
   link Play Console generates — testers install it as a normal Play
   Store listing (no separate app needed, unlike TestFlight).

---

## Later phases (not in this pass)

- **CarPlay / Android Auto** — needs real native Swift/Kotlin
  integration on top of this Capacitor shell (a `MPPlayableContentManager`
  data source on iOS, a `MediaBrowserService` on Android); scoped as its
  own phase once the base app is stable in testers' hands.
- **In-App Purchase parity** — if/when donation flows move into the
  native apps rather than staying web-based via Stripe Checkout, Apple's
  post-*Epic v. Apple* external-link rules still leave most non-"reader"
  apps needing StoreKit/Play Billing alongside any external link;
  revisit before submitting for full public release, not internal
  testing.
