# PULSE Phase 4C.3: native packaging security assessment

Assessment date: October 14, 2026. Branch: `feature/truevoice-pulse`.
Baseline: `3079e1eb6e2c22b9377717cef8747c4299d7d4f2`.
The initial assessment below is historical. The implementation section at the end
supersedes its unimplemented-isolation decision. Option B is now authorized and
implemented; native projects, CI and application source remain unchanged.

## Decision

Recommend **B: isolate asset regeneration into an optional, separately locked
workflow and exclude its dependency tree from the normal release install**,
subject to approval and real native validation. Existing assets support this
approach; the inspected release commands do not require the generator. This is
evidence of feasibility, not a completed exclusion or signed packaging test.

Until exclusion is implemented and validated, the current checkout remains
**D: retain temporarily with controls and a native release blocker**. Isolation
does not patch the old generator. Regeneration with that generator needs an
explicit, limited risk decision or a validated supported replacement.

## Exact vulnerable dependency paths

All paths start at the root dev dependency `@capacitor/assets 3.0.5`:

| Dependency path | Finding | Supported combined patched target |
| --- | --- | --- |
| assets -> sharp 0.32.6 | High inherited native decoder findings: GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c, GHSA-wq5f-xc86-pv6w | Sharp >=0.35.5; outside assets' exact 0.32.6 contract |
| assets -> @capacitor/cli 5.7.8 -> tar 6.2.1 | Critical tar extraction/parser findings; nested CLI and assets inherit high flags | tar >=7.5.21; outside CLI 5's ^6.1.11 contract |
| assets -> @trapezedev/project 7.1.10 -> xcode 3.0.1 -> uuid 7.0.3 | Moderate GHSA-w5hq-g745-h8pq, inherited by project/xcode | uuid >=11.1.1; outside xcode's ^7.0.3 contract |

The twelve tar IDs and advisory-specific prerequisites are inventoried in
[the 4C.1 review](PULSE-Phase4C1-dependency-readiness.md#final-security-review-and-release-decision).
They are GHSA-34x7-hfp2-rc4v, GHSA-8qq5-rm4j-mr97, GHSA-83g3-92jg-28cx,
GHSA-qffp-2rhf-9h96, GHSA-9ppj-qmqm-q256, GHSA-r6q2-hw4h-h46w,
GHSA-vmf3-w455-68vh, GHSA-w8wr-v893-vjvp, GHSA-23hp-3jrh-7fpw,
GHSA-8x88-c5mf-7j5w, GHSA-gvwx-54wh-qm9j and GHSA-r292-9mhp-454m.

Sharp processes source image bytes during regeneration; hostile decoder input
can affect the development/build host. The nested CLI has an extraction sink
in `dist/util/template.js`: `tar.extract({ file: src, cwd: dir })`. Its presence
is confirmed; execution of that nested extraction sink in the current release
workflow or ordinary asset generation is **not demonstrated**. Do not conflate
the nested CLI with the project's release CLI.

The direct `@capacitor/cli 7.6.9` already resolves `tar 7.5.22`. Android sync can
extract its own packaged Cordova template through that patched dependency.
Updating the direct CLI would not fix the separate nested CLI 5 tree.
Inspected xcode UUID calls use buffer-free v4; the advisory concerns v3/v5/v6
buffer bounds. Unknown internal/future callers remain a residual risk, as recorded
in the conditional UUID acceptance in [4C.2](PULSE-Phase4C2-release-remediation.md).
Firebase remains unchanged and is separate from this native generator tree.

Fresh npm registry metadata still reports assets 3.0.5 as latest, with Sharp
0.32.6, CLI ^5.3.0 and project ^7.0.10. No compatible patched assets parent was
found. [Upstream package](https://github.com/ionic-team/capacitor-assets/blob/main/package.json).
No forced overrides, SDK major changes or package removals were applied.

## Current native release workflow and execution boundaries

| Step | Repository evidence | Generator execution |
| --- | --- | --- |
| Install dependencies | Codemagic: `npm ci` | Installs assets and its vulnerable tree. Sharp has an install script that downloads/copies native binaries or compiles them; this is install-time execution, not image regeneration |
| Build web bundle | `build`: `vite build` | No generator command; produces `dist` and PWA worker |
| Sync native projects | `cap:sync`: `vite build && npx cap sync`; CI: `npx cap sync ios` | Direct CLI copies web assets and updates native/plugin dependencies; no icon generation |
| iOS dependency resolution | Podfile paths to installed Capacitor and three plugins; CI additionally runs `pod install` | No assets dependency in Podfile |
| iOS packaging | Codemagic Mac M2: increment build number, apply profiles, build IPA from App workspace/scheme | Uses committed asset catalogs; configured TestFlight publishing is not executed in this assessment |
| Android packaging | Runbook: `android/gradlew bundleRelease`; Gradle references Capacitor and three plugin projects | Uses committed resources; no checked-in Android CI publishing workflow found |
| Optional regeneration | NATIVE_APP_SETUP.md section 5: `capacitor-assets generate` with dark background colors | Explicitly invokes Sharp/image generation; needed for changed artwork, not every web release |

Only `codemagic.yaml` was found as checked-in CI automation; external dashboard
scripts, cache settings, actual CI logs and signing state are not visible here.
Root package scripts contain no install/build/sync lifecycle hook invoking assets.
Installed App, PushNotifications and SplashScreen packages have no Capacitor
script hooks. CLI source runs root/plugin hooks, then copy/update. No assets or
Sharp invocation was found in the inspected direct copy/update/sync paths.
[Capacitor v7 sync reference](https://capacitorjs.com/docs/v7/cli/commands/sync).

Absence of image generation does not eliminate install-host exposure: regular
`npm ci` includes development dependencies and lifecycle scripts. `--omit=dev`
would also remove required Vite and native build tooling. `--ignore-scripts`
alone neither removes vulnerable packages nor establishes working native tools.

## Asset inventory and consumers

There are **66 tracked files** under the iOS asset catalog and Android resource
trees, plus **two tracked source PNGs** under `assets/` (68 total inspected files).

| Assets | Inventory and checks | Native consumer |
| --- | --- | --- |
| iOS AppIcon | One PNG, 1024x1024, RGB without PNG alpha channel; catalog filename exists and is tracked | Xcode target selects AppIcon; asset catalog is in Resources |
| iOS Splash | Three PNGs, each 2732x2732, referenced by 1x/2x/3x catalog entries | LaunchScreen storyboard references Splash; Info.plist selects LaunchScreen |
| Android launchers | 24 PNGs: launcher, round, foreground and background for ldpi/mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi | Manifest launcher/round references; two v26 adaptive XMLs reference foreground/background |
| Android splash | 26 PNGs covering base/night and portrait/landscape density variants | Launch theme and SplashScreen plugin reference splash |
| Other resource files | XML catalog/resource/theme/layout/string/file-provider files present | Native compilation resolves resources, including colors supplied by Capacitor Android |
| Source artwork | assets/icon.png and assets/splash.png, both 1024x1024 RGB PNGs | Optional generator inputs; kept even if normal release dependency is removed |

All 56 inspected PNGs have PNG signatures and readable IHDR dimensions. This is
header/reference checking, not complete image decoding, visual approval or proof
of provenance. The source splash is below the documented 2732px recommendation;
existing generated splashes are 2732px, but future regeneration quality must be
reviewed. The runbook's suggestion to start from a 512px PWA icon is also weaker
than the 1024px source already available. Restrict future native-only generation
to iOS/Android so it cannot rewrite the existing PWA manifest or icons.
[Capacitor asset guidance](https://capacitorjs.com/docs/v7/guides/splash-screens-and-icons).

## Configuration and native dependency prerequisites

- Loaded root config: appId `digital.truevoice.app`, webDir `dist`; iOS bundle ID,
  Android namespace/applicationId and Java package agree. No server.url is set.
- Root config retains hostname truevoice.digital and https scheme settings. Both
  checked-in generated native capacitor.config.json files omit the root `server`
  block. They are stale relative to root; verify fresh sync propagates intended
  settings. Do not use those old copies as release-readiness evidence or change
  the existing YouTube/iOS workaround during dependency isolation.
- Core, CLI, iOS and Android resolve 7.6.9. Plugins: App 7.1.2, PushNotifications
  7.0.7, SplashScreen 7.0.5. `cap ls` identifies all three on both platforms.
- iOS Podfile/local podspec references exist; target minimum is 14.0. No local
  Podfile.lock or workspace contents file exists. CocoaPods must materialize and
  validate the workspace/dependency graph on macOS; no native dependency audit
  or reproducibility claim is made from npm alone.
- Android Gradle 8.11.1 wrapper/JAR is tracked; AGP 8.7.2, min/compile/target SDK
  23/35/35 and Java 21 source/target are configured. Referenced Capacitor/plugin
  Gradle projects exist. No Java executable/JAVA_HOME, adb, Android SDK variables
  or android/local.properties was found in this environment. Gradle cannot start.
- Android google-services.json is absent locally and Gradle explicitly disables
  the Google services plugin when absent. Push delivery is not ready to validate
  here. No iOS GoogleService-Info file was found in inspected project files.
- Android release signing is not configured in the inspected app Gradle file;
  the runbook delegates it to Android Studio. iOS signing is configured through
  Codemagic's external integration, which was not inspected or exercised.
- iOS checked-in Info.plist lacks the runbook's background modes, and AppDelegate
  has no AVAudioSession setup. Android background service is explicitly future
  work in the runbook. These are existing device-validation gaps, not changes
  proposed by this security assessment; background audio readiness is not proven.

## Feasible remediation options

| Option | Benefit | Tradeoff / decision |
| --- | --- | --- |
| A: remove generator completely | Removes native audit tree from normal installs; current assets remain consumable | Future regeneration workflow would be lost unless replaced and validated; not recommend unconditional deletion |
| B: separate optional workflow | Keeps reproducible artwork generation available while ordinary installs/build hosts exclude the vulnerable tree | Requires separate manifest/lock/install boundary and native validation; old generator remains risky in its isolated environment. Recommended next implementation |
| C: supported alternative | Can eventually remove vulnerable generation code as well | Xcode asset catalogs and Android Studio Image Asset Studio are supported icon-authoring paths; full splash/density/dark/adaptive parity has not been demonstrated. No drop-in patched npm replacement established |
| D: retain with controls | No tooling changes now | Native release blocker remains; trusted files do not clear vulnerable versions. Current assessment state only |

Platform tools offer supported icon creation, but do not automatically constitute
a replacement for all outputs of this generator. Validate icon sizes, crop/alpha,
adaptive layers and splash behavior before adopting them.
[Apple asset catalogs](https://developer.apple.com/documentation/xcode/configuring-your-app-icon),
[Android Image Asset Studio](https://developer.android.com/studio/write/create-app-icons).

The prior 4C.2 temporary release-lock model removed only assets and reported a
full audit of eight moderate findings with no high/critical and no surviving
package version changes. It was not installed or used to build/sync/archive, and
is not a release lock. This assessment does not repeat or apply that model.

## Proposed implementation plan requiring approval

1. Approve B's dependency isolation and the regeneration risk policy. Remove
   assets only from the main manifest/lock; retain all direct Capacitor build tools,
   native assets, source artwork and existing application/configuration behavior.
2. Add a separate optional asset-generation directory with its own manifest/lock,
   outside npm workspaces/main install. Pin the tool, audit it separately and do
   not install it in privileged release jobs. Do not replace isolation with ad hoc
   npx downloads or an install into the root project's node_modules.
3. Document explicit regeneration into a disposable checkout containing native
   projects and reviewed artwork. Use a disposable restricted environment with no
   signing keys, backend credentials or privileged CI access. Allow only necessary
   dependency downloads; restrict filesystem/network access during processing.
   These are proposed controls, not currently enforced. If owner does not accept
   the remaining generation risks, block regeneration until C is demonstrated.
4. Review generated PNG/XML/catalog changes and visual results, then copy only
   approved outputs into the main checkout. Preserve PWA assets/config and native
   plugin settings. Update NATIVE_APP_SETUP.md to use this separate workflow.
5. From a clean release checkout/install, verify vulnerable packages are absent
   physically and from lock/audit, run existing tests/build, snapshot asset digests,
   sync each platform with the direct local CLI and compare assets afterward.
   Check root settings reach generated native config; do not reuse stale CI caches.
6. On macOS, resolve CocoaPods and archive signed iOS; on a Java 21/SDK-equipped
   host compile Android debug and signed release AAB. Record actual native
   dependencies and signing inputs; verify no generator process runs during release.
7. Test icons/splash on supported devices, Android pre/post-12 appearance,
   background/resume audio, LIVE/PULSE exclusivity, embeds, queue and push.
   Clear the native tooling gate only after exclusion and packaging evidence pass.

Expected future file scope: main package.json/package-lock.json, isolated tool
manifest/lock and run instructions, NATIVE_APP_SETUP.md, native dependency/resource
checks and any explicitly needed CI exclusion enforcement. No architecture rewrite,
Firebase migration, native SDK upgrade or infrastructure change is needed for B.

## Checks performed and results

- Branch/HEAD match requested baseline; initial tracked tree clean.
- Fresh registry metadata and full audit: **14 package findings: 1 critical,
  3 high, 10 moderate**. Native generator tree remains present. Inherited package
  flags are not distinct vulnerabilities. No new audit reduction claimed.
- `npm ls --all --json`: no dependency problems. Main package declarations match
  lock root; installed native graph and local podspec/Gradle references checked.
- Loaded Capacitor config and `cap ls`: success, three plugins on each platform.
- PNG headers, tracked catalogs/resources, bundle IDs and build scripts checked.
- Production/PWA build succeeds: 808 modules, service worker and Workbox chunk,
  13 precache entries. Existing >500kB bundle warning; no stale Browserslist warning.
- All 47 existing focused PULSE/security tests pass, including native asset tests.
- Android wrapper `--version` fails before Gradle startup: JAVA_HOME unset and
  java absent from PATH. No Android compile/AAB was possible.
- Xcode/CocoaPods unavailable on Windows; no iOS sync/pods/archive/signing test.
- No cap sync, asset generation, native build, install/removal/upgrade, CI job or
  device test was run. Sync would rewrite native state; actual platform validation
  belongs to the approved implementation in a disposable checkout.
- Documentation whitespace/diff checks pass; only this new report is added.

## Release implications

**Native release: no-go for security sign-off in the current state.** Exclusion is
feasible but unimplemented; critical/high generator dependencies remain installed
on build hosts. Conditional UUID acceptance does not waive Sharp/tar. A separate
isolated vulnerable generation workflow cannot itself be declared secure.

**After B: conditional go for native packaging validation**, provided fresh
install/audit shows exclusion and actual sync/archive/AAB succeeds with unchanged
approved assets. This alone is not App Store/Play Store or physical-device readiness.
Signing, push provisioning, native dependency resolution, fresh config sync,
background audio and Safari/Capacitor playback/lifecycle gates remain outstanding.

The previously fixed web/PWA serializer remains patched. Firebase UUID risk
acceptance and any earlier web release controls remain as documented in 4C.2.
No package or source changes, commit, push, merge or deployment occurred here.

## Approved Option B implementation

The root manifest no longer declares @capacitor/assets. Its lockfile excludes the
generator-only dependency closure, including Sharp, nested CLI 5/tar 6 and xcode.
Direct Capacitor CLI/core/iOS/Android and all surviving dependency versions are
unchanged. npm removes 117 old lock entries and materializes six optional nested
Tailwind WASI metadata entries; this is not a native SDK or application upgrade.

`tools/native-assets/` is a private standalone npm project with an exact assets
3.0.5 declaration and independent lockfile. It is not a root workspace, linked
dependency or lifecycle hook. Its 200 dependency entries retain the previous
resolved versions/integrities; it introduces no floating generator download.
The package is removed from normal installations, not deleted as a repository
capability. Source artwork and all committed native assets remain intact.

### Installation and regeneration

Normal web/native release prerequisites, from the root:

```powershell
npm ci --no-audit --no-fund
npm audit
npm audit --omit=dev
npm run build
node node_modules/@capacitor/cli/bin/capacitor ls
```

Do not use --omit=dev for build hosts: native/Vite build tools are development
dependencies. Root production-only installs also exclude the generator, but cannot
build the app. Existing Codemagic npm ci now consumes the generator-free root
lock; no CI/signing configuration change is needed. Clear old install caches/use
fresh CI checkout installs before relying on exclusion.

Optional regeneration, only in a disposable restricted source copy:

```powershell
npm ci --prefix tools/native-assets --no-audit --no-fund
npm audit --prefix tools/native-assets
node tools/native-assets/node_modules/@capacitor/assets/bin/capacitor-assets generate --ios --android --assetPath assets --iconBackgroundColor "#050816" --splashBackgroundColor "#050816"
```

See [the isolated workflow](../tools/native-assets/README.md) for input/output
review, secrets exclusion, native install-script risks and generation limitations.
The separate npm project is not a sandbox. Regeneration still requires the
documented security controls and an explicit limited risk decision; this change
does not patch its dependencies or permit it on privileged release hosts.
The isolated generator is not approved for routine release execution.
The native-only flags preserve PWA outputs. Upstream can swallow generation
errors/skip platforms, so verify real output and visual results, not just exit code.

### Stale configuration synchronization

No generated native config or signing file was overwritten here. In a disposable
release checkout after root npm ci and npm run build, run the installed local CLI:

```powershell
# macOS/Xcode/CocoaPods host
node node_modules/@capacitor/cli/bin/capacitor sync ios
# Java 21 / Android SDK host
node node_modules/@capacitor/cli/bin/capacitor sync android
```

Review `git diff -- ios android`, confirm the root server/plugin settings reach
`ios/App/App/capacitor.config.json` and
`android/app/src/main/assets/capacitor.config.json`, compare native asset digests,
and inspect Podfile/Gradle/plugin changes. Do not copy project/signing diffs blindly.
With a reviewed existing Podfile.lock, use `sync ios --deployment` to enforce
locked pods; current checkout has no such lock, so establish/review pod resolution
first. The root config, schemes, hostname and YouTube workaround are unchanged.

### Changed files

- package.json
- package-lock.json
- NATIVE_APP_SETUP.md
- docs/PULSE-Phase4C3-native-packaging-assessment.md
- tests/pulse-release-security.test.mjs
- tools/native-assets/package.json
- tools/native-assets/package-lock.json
- tools/native-assets/README.md

The test additions assert root exclusion, supported direct Capacitor versions,
absence of workspace/override/release-script coupling, and the separate exact
generator lock/risk instructions. Existing asset/PWA checks remain in place.

### Security counts and release decision

| Audit environment | Before | After |
| --- | --- | --- |
| Normal full tree | 1 critical, 3 high, 10 moderate (14) | 0 critical, 0 high, 8 moderate (8) |
| Normal production | 8 moderate | 8 moderate |
| Optional generator | Previously inside normal tree | 1 critical, 3 high, 3 moderate (7), separately audited |

Root high/critical native tool dependencies are excluded, rather than hidden by
overrides or disabled audits. Production findings remain the Firebase/Google uuid
chain under existing conditional acceptance; no Firebase changes occurred.
Optional Sharp/tar/xcode risks persist. Native packaging approval remains
conditional on clean host exclusion, actual sync/compile/archive/signing and device
checks; no App Store/Play Store readiness claim is made.

### Implementation validation results

- A fresh temporary normal-release install of the root manifest/lock completed
  with lifecycle scripts enabled (715 packages). Physical assets/Sharp/xcode
  directories are absent; direct Capacitor CLI is present. Its full npm ls has
  no problems. The temporary install contains no native projects or credentials.
- The original checkout's npm ci initially failed on an IDE-held lightningcss
  Windows binary. Root npm install restored the reviewed lock's dependencies
  successfully; old locked lightningcss/oxide cleanup directories remain ignored
  under node_modules. No unrelated process was stopped. Root npm ls has no problems,
  and physical generator/Sharp/xcode directories are absent from root node_modules.
- Optional npm ci --prefix tools/native-assets --ignore-scripts installs exactly
  200 packages, reports no npm ls problems and retains all previous versions and
  integrity hashes. This proves pinned dependency installation, not functioning
  native image bindings: vulnerable install scripts and generation were not run.
- Fresh audits produce the table above and exit nonzero for remaining findings.
  The root audit reduction does not clear the separately audited optional tool.
- Production/PWA build passes: 808 modules, unchanged CSS/JS hashes, sw.js and
  workbox-77d36791.js produced, 13 precache entries. Existing bundle-size warning
  remains; stale Browserslist warning is absent.
- All **49 focused PULSE/security tests pass** (47 previous plus two isolation
  checks). Targeted source/test ESLint, lockfile consistency and whitespace checks
  pass. Retained version/integrity comparisons against the baseline pass.
- Direct cap ls discovers the same three plugins on both platforms. Asset
  inventory/catalog tests pass; git diff confirms source, public/PWA inputs,
  ios, android, assets, Capacitor/Vite configuration and Codemagic are unchanged.
  LIVE365, AzuraCast, EXPLORE, YouTube bridge and runtime settings are preserved.
- Java/adb/Xcode/CocoaPods remain unavailable. No sync, native compilation,
  archive/AAB, signing, physical-device or actual regeneration output was tested.
  The existing stale generated native configuration remains for reviewed platform
  sync using the commands above. CocoaPods/Gradle resolution and signing/push/
  background-audio/device gates remain outstanding.
- All eight changed/new files are uncommitted. Existing Claude outputs are
  untouched. No push, merge, deployment or MY PULSE work occurred.
