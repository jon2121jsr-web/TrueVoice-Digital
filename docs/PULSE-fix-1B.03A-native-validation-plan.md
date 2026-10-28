# Fix 1B.03A ? Native compilation validation plan and environment blocker

Status: BLOCKED ? no accessible macOS/Xcode environment. No Swift/iOS compilation or native behavior has been reported as passed.

## A. Environment and verified preconditions

Current host: Microsoft Windows 10.0.26200. OpenSSH client is available; swift, swiftc, xcodebuild, xcrun and pod are not available. No SSH config, supplied Mac host, remote-Mac environment entry or enabled remote-Mac execution tool was found. The existing Codemagic mac_mini_m2 workflow is not a usable validation route unchanged: it configures distribution signing, builds an IPA and automatically submits to TestFlight. It was not run or modified.

Verified isolated worktree: C:/Users/jon52/TrueVoice-Digital/.release-staging/fix-1b02a/worktree; branch fix/native-ios-1b02a; HEAD 6f6b6aaf85a9d861f5c91bc6df88c79bf10bad35.

Read the complete Fix 1B.02B report and its nine-modified/eight-added Stage B inventory. All 348 entries in ../stage-b-audit/stage-b-manifest.json match: zero missing and zero SHA-256 mismatches. The recorded /assets/index-D7HuKI8n.js bundle hash matches as well. The accepted Live365 selector remains present and native Swift uses the same fixed https://streaming.live365.com/a61535 endpoint, without a direct AzuraCast /listen/ or /hls/ fallback. The intentional native overlay is preserved; the unmodified 189-file web manifest is not misrepresented as the current edited-native-source manifest.

## B. Swift test status

Seven policy XCTest cases are present. Execution: NOT RUN. Source inspection and JavaScript fixtures do not establish Swift compilation or runtime correctness.

First command on the approved Mac snapshot:

    swift test --package-path ios/NativeAudioPolicy

Record compiler/Swift version, full output, actual executed test count and exit status. A passing policy package still does not compile AVFoundation/MediaPlayer/Capacitor integration; that requires the Xcode app build below.

## C. Validated build plan (prepared, NOT executed)

### Source handoff

Use a dedicated isolated Mac directory corresponding to this native worktree, not another dirty checkout. A Git clone of branch HEAD is insufficient: the reviewed implementation is uncommitted, including added Swift files. Transfer the manifest-listed current source plus the Stage B manifest and verify hashes before installing or building. Do not transfer node_modules, .git/worktree pointers, .env files, local credentials, signing material, dist, Pods, DerivedData or generated native configuration. Record environment-file exclusions explicitly in a transfer manifest rather than claiming an excluded file was verified. Rebuild web output on the Mac from the verified source. No commit or push is needed.

The baseline includes a historical tracked .env, but the approved local build helper excludes it from client environment loading. Do not transfer that file's contents. Supply only the approved public VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY through the Mac process environment. Do not paste values into logs or source, or copy backend/service-role credentials. The helper validates anon/publishable key type and clears the private Google-key build setting.

### Environment checks

Run on the Mac, capture results and stop if any required component is missing:

    uname -s
    sw_vers
    xcode-select -p
    xcodebuild -version
    xcrun --sdk iphonesimulator --show-sdk-version
    xcrun simctl list devices available
    swift --version
    node --version
    npm --version
    pod --version

Use a macOS release compatible with the chosen full Xcode release. Capacitor 7 documents iOS 14+ / Xcode 16+; use a compatible Xcode 26-or-later toolchain with iOS 26-or-later SDK for current release-representative validation. Check the selected toolchain's actual SDK rather than relying on a CI default. No Xcode selection, license acceptance, runtime download or system tool installation should be attempted without the Mac owner's authorization. Prefer Node 24.14.0, matching the established release environment, and exact package-lock dependencies.

### Local-only build sequence

In the verified isolated Mac source directory, with the two approved public client variables already configured:

    npm ci
    swift test --package-path ios/NativeAudioPolicy
    node tools/build-native-baseline.mjs
    ./node_modules/.bin/cap sync ios

These operations are permitted only on the isolated Mac/native build copy. npm ci uses the exact lock; it is not a dependency upgrade. Do not copy Windows node_modules to macOS. The local Capacitor executable avoids an npx fallback download. Capacitor sync resolves the existing local CocoaPods integrations; verify the resulting Podfile.lock and workspace. If CocoaPods resolution was not completed by sync, stop on the error and diagnose before an explicit pod install. Do not use pod update or add plugins/dependencies opportunistically. No existing Podfile.lock was supplied, so initial resolved pod versions must be recorded and reviewed.

Verify the generated Capacitor config still uses capacitor://localhost, no server.url, and digital.truevoice.app. Confirm public web assets and station artwork exist inside ios/App/App/public. Reinspect storyboard/custom plugin registration and source references after sync. Capture the full sync-generated diff; do not discard uncommitted changes or replace the custom Swift files.

Then compile the simulator app, without distribution signing or an archive:

    mkdir -p .native-validation/1b03a/results
    xcodebuild -list -workspace ios/App/App.xcworkspace
    xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath .native-validation/1b03a/DerivedData -resultBundlePath .native-validation/1b03a/results/simulator-build.xcresult CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build

Use a fresh run-results path; do not overwrite a prior .xcresult or remove unrelated build directories. Validate build exit status, .xcresult diagnostics, executable/architectures, Info.plist bundle identifier/background audio mode, generated assets and plugin availability. Expected simulator artifact: .native-validation/1b03a/DerivedData/Build/Products/Debug-iphonesimulator/App.app. This artifact has NOT been created in this task.

Do not run archive, -exportArchive, build-ipa, distribution signing setup, -allowProvisioningUpdates, App Store Connect upload, or the existing Codemagic workflow. Simulator compilation needs no Apple distribution credential. A later physical-device development-signed build may use only an already-authorized development identity/profile; stop if provisioning changes would be required.

If actual compiler errors occur, retain diagnostics, make the smallest correction in this isolated native source, preserve a complete diff, and rerun the policy tests, focused JavaScript tests, approved web build and Xcode compilation. Do not make speculative source fixes from static inspection alone.

## D. Plugin registration findings

Static checks pass: TrueVoiceRadioPlugin.swift, RadioBridgeViewController.swift and RadioPlaybackPolicy.swift are included in the PBXSourcesBuildPhase. Source files exist. RadioBridgeViewController.capacitorDidLoad registers TrueVoiceRadioPlugin with registerPluginInstance; the plugin exposes CAPBridgedPlugin methods and JS name TrueVoiceRadio. Main.storyboard selects that custom controller. UIBackgroundModes declares audio.

Compilation, Objective-C selector visibility, actual storyboard instantiation, framework linkage, SDK availability and runtime JavaScript-to-native method dispatch remain UNVERIFIED.

## E. Audio lifecycle findings

Source retains one native AVPlayer, explicit intent/version guards, native interruption/route/reset observers, bounded retry cancellation, native metadata polling and remote commands. Browser HTML playback remains a separate platform-selected path. These are inspected implementation facts, not validated AVPlayer/AVAudioSession or thread-safety results.

On the Mac review main-queue confinement, observer/token lifetime and deinitialization, media-services reset, retry callbacks, pause during interruption/recovery, native-versus-WebKit session interaction, Now Playing/remote commands and disabled live seeking. Confirm native method calls reject stale Play intents after newer Pause. No changes were made to this implementation in Fix 1B.03A.

## F. Simulator and device results

Simulator: NOT AVAILABLE / NOT RUN. Physical device: NOT AVAILABLE / NOT RUN.

After a successful build, select an available simulator UDID from simctl. Install and launch the simulator .app with simctl install and simctl launch for digital.truevoice.app. Verify cold-start silence, bridge availability, initial Live365 Play, UI state, Pause, track/artwork updates, video handoff, native errors and one-player ownership. Any live listening must be deliberate and bounded; previous offline tests did not open listener sessions.

A simulator can support UI and some audio/network exercises but cannot sign off real lock-screen/background reliability, cellular handoff, Bluetooth/headphone routing, actual phone/Siri interruptions, system suspension or Live365 listener behavior on physical iOS hardware.

Physical-iPhone sign-off must follow the Fix 1B.02B plan: at least 30 minutes locked/background listening; remote controls; explicit Pause across retries/interruption; headphone/Bluetooth transitions; Wi-Fi/cellular and long outages; video/verse handoffs; ads and metadata alignment; Live365 listener reporting after its normal delay. AzuraCast listener counts are not evidence of downstream Live365 reach.

## G. Artifacts and validation status

This stage created only this plan/report. No application build artifact, policy-test result, simulator result, native sync or CocoaPods resolution was produced. The existing Windows web dist bundle remains a prior web-validation artifact, not a compiled iOS app. No Swift compilation is claimed.

## H. Exact access needed / next gate

Provide one accessible macOS execution environment through an existing authenticated session or SSH connection: host/connection name, login identity, isolated writable build directory and the approved existing authentication method. Do not send private keys, passwords or tokens in chat. The host needs full Xcode, iOS simulator SDK/runtime, Swift, Node/npm and CocoaPods, plus permitted npm/CocoaPods dependency network access. It must support command execution and retrieving logs/build diagnostics; simulator behavior testing additionally needs GUI/interactive access.

Alternatively, provide a separately reviewed validation-only macOS CI job with all publishing, distribution signing and App Store credentials removed. The existing auto-upload workflow is explicitly excluded. No CI job was created or started, no remote host was contacted and no paid build resource was provisioned.

For physical-device testing, additionally provide an accessible paired iPhone and an existing approved development signing setup. Those are not required for unsigned simulator compilation. Distribution/App Store credentials are not needed for this stage.

No code, project configuration, dependency, existing dirty worktree, production site, provider setting or signing credential was changed. No commit/push/merge, Vercel operation, Codemagic run, Capacitor sync, IPA/archive or upload occurred. Stop pending access to the Mac environment.

Sources: https://capacitorjs.com/docs/v7/ios ; https://developer.apple.com/news/?id=6lxhtioi .
