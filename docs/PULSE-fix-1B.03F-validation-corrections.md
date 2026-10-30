# Fix 1B.03F — auditable native validation

Prepared locally from 0120813edf11dee955aa35d5a717b0329055e1c3 on isolated branch ci/ios-native-validation-1b03f. No push or Codemagic execution is authorized by this preparation. Fix 1B.03H updates the workflow and runtime guard to CM_BRANCH=ci/ios-native-validation-1b03f. The previous 1B.03F commit restricted execution to ci/ios-native-validation-1b03b.

## Findings

The inspected source already used real subprocess calls for Swift tests, dependency installation, Capacitor and Xcode. No simulated implementations were found. Run #1 logs and worker source were not supplied, so its reported skipped compilation cannot be attributed conclusively to this source. Earlier local harness/fixture results do not establish macOS compilation. Nonfunctional public Supabase build values remain intentional; they do not simulate compilers or tests and do not establish backend/runtime behavior.

## Corrections

Both YAML copies call an explicit run.mjs entry point. It always dispatches a known step or fails. Each subprocess prints its command and captured sanitized stdout/stderr, writes a log and command/exit-status JSON, and preserves nonzero child exit codes. Missing executables and timeouts fail. No shell pipeline masks failures. Output is captured synchronously and printed when each command ends; the capture limit is 50 MiB and the command timeout is 25 minutes, both fail closed.

The web stage now explicitly runs npm run build with the existing approved build classification and 15/2/55 second timing values scoped to that child process. No deployment command runs. Existing emitted timing and listener URL checks remain. Capacitor uses the installed locked CLI; explicit pod install verifies resolution without pod update. A fresh DerivedData/result-bundle location is required. The compiler selects an available iPhone UDID from installed iOS simulator runtimes and records Xcode destinations. PASS requires a successful real xcodebuild command, BUILD SUCCEEDED output, all three reviewed native Swift filenames in compiler output, App.app, expected bundle ID/audio mode, and absence of an app signature.

## Commands Codemagic executes

The six YAML steps invoke `node ci/native-validation/run.mjs STEP`, in order: preflight, dependencies, swift-tests, web-build, sync, compile. The runner executes these commands sequentially, stopping on failure:

```sh
# preflight: source hashes, source membership, registration, unsigned environment
git ls-files -z
xcodebuild -version
xcrun --sdk iphonesimulator --show-sdk-version
swift --version
pod --version
git rev-parse HEAD

npm ci --no-audit --no-fund
swift test --package-path ios/NativeAudioPolicy --verbose
npm run build
node tools/verify-stream-timing-build.mjs
npx --no-install cap sync ios
# cwd: ios/App (Capacitor sync also invokes CocoaPods)
pod install
# cwd: repository root
xcrun simctl list devices available --json
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -showdestinations
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug \
  -sdk iphonesimulator -destination "platform=iOS Simulator,id=<discovered-UDID>" \
  -derivedDataPath <repository>/.native-validation/ci/DerivedData \
  -resultBundlePath <repository>/.native-validation/ci/SimulatorBuild.xcresult \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY= DEVELOPMENT_TEAM= build
plutil -extract CFBundleIdentifier raw -o - <App.app>/Info.plist
plutil -extract UIBackgroundModes json -o - <App.app>/Info.plist
```

The Node executable for timing verification is the current process executable. Paths and the discovered UDID are recorded in command JSON rather than assumed. No simulator boot or app launch is needed for compilation. Swift tests use ios/NativeAudioPolicy/Package.swift through --package-path and require the actual XCTest summary of seven tests with zero failures.

## Native wiring and image

App's PBXNativeTarget references the PBXSourcesBuildPhase containing TrueVoiceRadioPlugin.swift, RadioBridgeViewController.swift and RadioPlaybackPolicy.swift. File references resolve to the reviewed native sources. Main.storyboard selects RadioBridgeViewController; capacitorDidLoad registers TrueVoiceRadioPlugin(). Static checks verify these facts before and after sync; Swift hashes must remain unchanged. This confirms source wiring, not device playback behavior.

Xcode 26.2 remains pinned, with Node 24.14.0 and CocoaPods 1.16.2 unchanged. Codemagic's current image documentation lists Xcode 26.2 (17C52), Mac mini M2 and iOS 26.1/26.2 simulator runtimes: https://docs.codemagic.io/specs-macos/xcode-26-2/. Preflight verifies actual Xcode/SDK versions; availability on a future worker is established only when that job runs.

## Local verification and expected evidence

Local checks cover JavaScript syntax, parsed YAML policy, matching YAML copies, manifest hashes and complete Git tree coverage, native target/registration wiring, credential patterns, and unchanged package files. Runner regression tests execute a real child exiting 37, verify output/status capture, reject a missing executable, reject unknown CLI steps, and ensure Windows compilation fails without PASS. These tests do not impersonate Swift or Xcode.

Expected downloadable artifacts remain sanitized logs and JSON under .native-validation/ci/logs and reports. They include actual Swift output, web/timing output, Capacitor and CocoaPods logs, simulator/destination inventory, xcode-build.log, per-command status records, source commit/manifest hash, resolved pod versions/lock hash, swift-tests.json, and compilation.json. DerivedData, App.app and raw xcresult remain worker-local and are not published. A failing command preserves its log and status record and prevents subsequent PASS. Fresh workers prevent stale success evidence.

Windows cannot execute the macOS toolchain. No claim is made that Swift tests, Pods, Capacitor sync or simulator compilation passed locally. Native compilation remains unverified pending an independently approved Codemagic run.

The workflow has one manual-only workflow, no triggering/events, integration, credential group, signing material, publishing, archive/export/IPA or TestFlight action. Vercel Git deployment remains disabled. No dependencies or signing credentials were changed. External schedules/webhooks were not inspected or modified.

## Fix 1B.03H - branch guard correction

Prepared locally from ac9dc373b4bcecabd89c173ac0b42fd6e1350b07 on ci/ios-native-validation-1b03f. Both workflow conditions, the runtime branch guard, the preparation script's generated manifest branch, and current source-manifest branch metadata now use ci/ios-native-validation-1b03f. Historical documents retain their original branch references. Regression coverage accepts the corrected branch and rejects the former branch, missing/empty values, main and the production workflow name. All tool commands, native audio sources, dependency files and unsigned/manual-only policy remain unchanged. YAML/security, manifest and staged-byte checks were performed locally; no macOS compilation or Codemagic execution was performed. No push is included.
