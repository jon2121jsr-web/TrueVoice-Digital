# PULSE Fix 1B.04A - Isolated iOS Release Candidate Preparation

October 30, 2026 (America/Phoenix). Local preparation only. No commit, push, signing, native archive, provider change, Codemagic execution, upload or publication is included.

## A. Baseline and worktree verification

The source commit was verified as a commit object with exact identity 1c3ebb18eee5151c47d844ea97100651624c98e6 and direct parent ac9dc373b4bcecabd89c173ac0b42fd6e1350b07. Proposed branch release/ios-testflight-1b04 and target directory were both absent. A new isolated worktree was created at:

`C:/Users/jon52/TrueVoice-Digital/.release-staging/fix-1b04-release/worktree`

The new branch starts exactly at that source SHA. HEAD remains there: preparation changes are intentionally uncommitted and unstaged. Existing validation branches were not edited. Local worktree inventory before creation:

| Worktree suffix | HEAD | Existing tracked modifications / untracked paths |
| --- | --- | --- |
| Root TrueVoice-Digital | 6f6b6aaf85a9d861f5c91bc6df88c79bf10bad35 | 10 / 138 |
| .release-staging/b081708 | b081708f5c981380b521c88a18abdfa26b1b2e2b | 0 / 0 |
| fix-1a45a/worktree | 6f6b6aaf85a9d861f5c91bc6df88c79bf10bad35 | 23 / 8 |
| fix-1b02a/worktree | 6f6b6aaf85a9d861f5c91bc6df88c79bf10bad35 | 33 / 24 |
| fix-1b03b-ci/worktree | 0120813edf11dee955aa35d5a717b0329055e1c3 | 0 / 0 |
| fix-1b03f-ci/worktree | 1c3ebb18eee5151c47d844ea97100651624c98e6 | 0 / 0 |
| postlaunch-1a | 337ef9d413ef41739d03f4442de95d83ad1fb37d | 0 / 0 |
| postlaunch-1a6 | de31bd64a91719bfb21cef1227ab4404df9aba9d | 0 / 0 |
| postlaunch-1a9 | e46a3df1ad1795912761df428899e0fdc7b5f3f2 | 0 / 0 |

All suffixes after the first two are under the existing .release-staging directory. Preservation checks capture each existing worktree's HEAD, status hash and aggregate tracked-file byte hash. These do not print environment values. Existing dirty work is not attributed to this task. The prior production web release worktree and development branches are preserved; no hosted production state was read or changed.

### Validation evidence reconciliation

Supplied Codemagic build 6ae51a98efa74786046f48e2 identifies ios-native-validation on ci/ios-native-validation-1b03f at the baseline SHA, with seven Swift policy tests and unsigned Debug iOS Simulator compilation reported successful using Xcode 26.2. Local validation scripts contain real Swift/npm/Capacitor/Pods/xcodebuild calls and required success evidence. The source manifest has 358 entries and SHA-256 cffb668632ddfcce5a16645da482fd77c548e28d8bac5c41b783d501f729069b. Native sources and the original validation scripts/configuration remain unchanged in this preparation.

Independent Codemagic artifacts are unavailable locally. No remote/provider request was made. Consequently the seven Swift results and remote compiler success remain user-supplied, not artifact-verified. They establish a reported simulator milestone, not a signed Release build, device runtime behavior, licensing authorization or TestFlight readiness. Before any worker execution approval, reconcile source.json, command status records, Swift output, compiler log, compilation.json and pod-lock evidence from that completed run with the baseline and original manifest.

## B. Exact changed-file inventory

All paths below are inside the new release worktree:

| Path | Change |
| --- | --- |
| codemagic.yaml | Append ios-release-archive-validation; preserve the existing ios-native-validation definition unchanged. |
| ci/ios-release/validate.mjs | New release branch/source/runtime guards and real future build/sync/unsigned Release archive runner, using existing sanitized command capture. |
| ci/ios-release/build-web.mjs | New real Vite build process with isolated environment/cache paths; it exits before separate emitted-code timing verification. |
| ci/ios-release/runtime-profile.json | New fingerprint-only approved public runtime profile and non-secret app/listener/metadata/timing identity. No actual public key or private credential copied. |
| ci/ios-release/source-manifest.json | New independent release inventory and SHA-256 review hashes, including this report; excludes itself. |
| ci/ios-release/release.test.mjs | New offline branch, manifest, runtime rejection and workflow-isolation regression checks. |
| docs/PULSE-fix-1B.04A-release-candidate-preparation.md | This preparation report. |

The original ci/native-validation/source-manifest.json stays unchanged as historical validation evidence; it is not misrepresented as covering the revised root YAML. The new release manifest covers all candidate tracked and untracked source files. No application code, Swift/audio implementation, Capacitor config, iOS project, dependency file, old workflow snapshot or Vercel configuration is changed. Local web output and sanitized local build logs are ignored under dist/ and .native-validation/; they are not proposed source files and are not an iOS package.

## C. Runtime configuration decisions

The new workflow does not use the validation workflow's nonfunctional Supabase URL/key fixtures. The release guard requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as process inputs matching the approved pair's SHA-256 fingerprint. Values were read only from the existing root .env.local allowlist in memory; no whole environment file was copied or printed. The key declares role anon, its project reference matches the HTTPS Supabase hostname, and the guard rejects expired keys. This confirms public configuration structure, not hosted project ownership, RLS correctness or service availability. Prior Stage A records document use of approved local public values; no independent provider corroboration was performed.

The checked-in release profile stores only pair fingerprint a1bad6faabacc9b093db8d0cd09779cfca2d521af1afa826929b2dd0e9a35779. The release workflow attaches no variable/credential groups, integrations, signing resources or actual runtime values. Future manual worker execution therefore **fails closed until the same approved public inputs are explicitly supplied** through a separately approved method. This is an intentional execution gate, not a fabricated replacement credential. A changed public key/project requires a newly reviewed fingerprint. Do not paste values into logs or restore the old tracked .env.

Listener audio remains Live365 https://streaming.live365.com/a61535 for native and browser entry points, with no direct-origin listener fallback. Metadata remains at the permitted hosted https://www.truevoice.digital/api/nowplaying endpoint backed by the existing metadata system; AzuraCast counts are not evidence of Live365 reach. App ID remains digital.truevoice.app, bundled origin capacitor://localhost and webDir dist, with no remote server.url. The native AVPlayer owner, plugin registration, JS bridge, background-audio declaration and browser/native separation are byte-identical to the baseline.

The release-specific real Vite helper ci/ios-release/build-web.mjs preserves the existing native helper's environment isolation, local production classification and listener checks. It exits before the existing tools/verify-stream-timing-build.mjs runs in a separate process. This avoids retaining the large Vite heap while parsing emitted code. The original validated helper remains unchanged. The combined stages require accepted Live365/AzuraCast/unknown timing values 55/2/15 and reject direct-origin listener URLs in the main bundle. This classification is local build policy, not a Vercel deployment. Native runtime still talks to hosted production APIs; future device testing needs explicit live-service scope/consent. The release runtime guard rejects unrelated VITE overrides and named server/signing secret inputs; it does not print the environment. No private key is embedded in the profile or app.

## D. Proposed archive-only workflow

The root YAML has exactly two workflows: unchanged ios-native-validation and new ios-release-archive-validation. The latter is restricted to CM_BRANCH=release/ios-testflight-1b04, pins Xcode 26.2, Node 24.14.0 and CocoaPods 1.16.2, uses Mac mini M2 and has a 60-minute limit. There are no triggering/events, publishing, App Store Connect integration, environment groups, ios_signing entries or IPA artifacts. No truevoice-ios-workflow is imported or reused. The original distribution workflow in other worktrees is untouched.

Each future step invokes `node ci/ios-release/validate.mjs STEP`:

| Step | Actual proposed command/action |
| --- | --- |
| preflight | Require macOS, exact selected release branch, approved public inputs, clean committed checkout, baseline ancestry and complete release manifest; check original Swift hashes/registration and disabled Vercel Git deployment; run xcodebuild -version, swift --version, pod --version. Record actual commit and manifest hash. A detached CI checkout is accepted only with the correct CM_BRANCH. |
| dependencies | npm ci --no-audit --no-fund; unchanged package-lock.json, no upgrade command. |
| swift-tests | swift test --package-path ios/NativeAudioPolicy --verbose; require seven executed tests and zero failures in real captured output. |
| web-build | node ci/ios-release/build-web.mjs; after it exits, node tools/verify-stream-timing-build.mjs. Real Vite compilation and emitted timing/transport checks use the approved public pair. |
| sync | npx --no-install cap sync ios; then pod install in ios/App; verify native Swift bytes, app ID/local origin, copied art, generated workspace and lock hash. |
| archive | xcodebuild for App/Release, generic iOS device destination, unsigned archive; require actual ARCHIVE SUCCEEDED, three native source filenames, archived App.app, correct bundle ID/audio mode and no app signature. |

Proposed archive command, **not executed**:

```sh
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath '<repository>/.native-validation/release/App-unsigned.xcarchive' \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY= DEVELOPMENT_TEAM= archive
```

This future unsigned device archive validates Release compilation/archive structure only. It is not a signed archive, installable iPhone artifact, exported IPA or distributable build. No exportArchive/build-ipa/upload command exists in the new runner. The archive itself stays worker-local; artifacts include only sanitized logs and JSON. archive.json explicitly records signed=false, distributable=false, exportedIPA=false and uploaded=false. A fresh archive path is required, command failures retain exit status, and no missing/failed compiler invocation can generate success evidence.

Real signing must be a separate reviewed future stage requiring verified developer/team/profile/certificate/app record, an approved version/build number and an explicit archive/export proposal. Do not add credentials to this unsigned workflow, bypass the branch guard or run the old automatic distribution workflow. No worker build has been triggered here.

## E. Local validation results

Applicable checks include JavaScript syntax; parsed YAML workflow isolation; exact baseline/branch/ancestry; complete release inventory hashes; unchanged native and package files; runtime pair structure/fingerprint/rejection; source credential-pattern checks; Live365-only listener selection; plugin/storyboard/App source membership; and existing focused offline tests. Local preparation accepts the intentional uncommitted candidate inventory; future CI preflight requires a clean committed checkout.

Focused existing tests cover native-audio, native-routing, live365-distribution, native-ci-preparation and the native validation runner; release-specific tests add guard and YAML checks. Test fixtures exercise offline contracts and fail-closed cases, not actual Swift/AVPlayer behavior. A real local web build uses already installed shared Node dependencies with public inputs in memory; no npm installation or dependency upgrade is performed. Its ignored output is for local verification only, not a reproducible worker package. The future worker must use npm ci against the unchanged lockfile. Native sync, CocoaPods, Swift tests and archive execution are not run on Windows.

Final pass/fail counts, manifest identity and preservation results are recorded in the completion record below after checks finish. No remote or provider evidence is implied by these local results.

## F. Remaining signing and device-test blockers

NO-GO for distribution until independently reviewed signing/account references, app record/team/bundle identity, effective minimum OS and version/build sequence, Release archive/export evidence and installable-device tests exist. Project version remains 1.0/build 1 and minimum iOS remains 14.0; no build-number or deployment-target change is made. Resolved CocoaPods lock evidence from the completed validation run remains unavailable; current preparation does not claim a resolved native lockfile.

Repeat the 1B.04 physical-device acceptance matrix on a separately approved installable candidate: Live365 session registration, pause persistence, background/lock, system/headset commands, interruptions, route/network changes, bounded recovery, video/verse handoffs and no HTML/native overlap. Native lock-screen art remains station-only; song-art expectations require explicit scope review. Push/auth/privacy, iPad coverage and third-party rights remain unresolved release scope. Live365/native distribution and other content authorization were not established by compilation and are not asserted here.

## G. Risks and rollback considerations

The candidate is isolated from production and existing validation branches; Vercel Git deployment remains disabled. Root dirty work was neither copied wholesale nor edited. The public pair binds to existing local configuration but requires separate ownership/runtime verification before device use. Fingerprint pinning may deliberately block a rotated key. Missing public inputs, unexpected overrides, private/signing inputs, changed source, wrong branch or stale archive fail closed.

No deployed state exists to roll back. Preserve this uncommitted worktree for review. If preparation is rejected, do not delete shared source or reset other worktrees; obtain explicit scope before removing the isolated worktree/branch. Keep the original validated SHA and its manifest as evidence. A future signed release should remain a descendant with a reviewed minimal delta, never an unreviewed merge of dirty development source.

## H. Proposed next-stage commands - NOT EXECUTED

First approval requested: a local-only follow-up to diagnose and complete the failed web-build/PWA verification, with no remote/provider action. The seven-file proposal remains uncommitted. Only after that blocker is resolved should a separate approval authorize one local preparation commit; no push or worker execution is bundled with it.

```powershell
# In the new release worktree only; NOT EXECUTED:
git diff -- codemagic.yaml
git add -- codemagic.yaml ci/ios-release docs/PULSE-fix-1B.04A-release-candidate-preparation.md
git commit -m "ci(ios): prepare isolated unsigned Release archive validation"
```

After that, reconcile completed Codemagic validation artifacts read-only and approve the public runtime input delivery method. Separate approval is required to push the reviewed release commit, then manually execute ios-release-archive-validation on its exact SHA with the approved public pair and no signing credentials. A later signing/export proposal and any TestFlight upload/tester audience require their own explicit approvals. None of these actions has run.

## I. GO / NO-GO recommendation

**GO for review of the isolated local proposal. NO-GO for committing or executing the archive workflow until the local web-build verification passes. NO-GO for signing, device distribution, TestFlight or App Store release.** Source/runtime/workflow preparation does not resolve the remote-evidence, signing, licensing and device-test blockers. Stop at this uncommitted proposal and request approval for the local-only web-build follow-up.

### Completion record

- Focused offline regression checks: 33 passed, zero failures (existing audio/routing/Live365/native CI tests plus three release-specific tests). The same 33 tests passed again after the final implementation and inventory refresh.
- JavaScript syntax, parsed YAML isolation, branch/base identity, unchanged original validation workflow, native/plugin/Live365 wiring and credential-pattern/environment-file checks pass. Source changes remain confined to the seven-file inventory above.
- A complete local web-build pass is NOT established. Initial use of the inherited helper emitted 814 modules/PWA output but its concurrent timing subprocess failed with a Node zone-memory error. A 256 MiB retry failed in Vite with heap exhaustion. After process separation in the new release helper, Vite emitted the same main asset index-D7HuKI8n.js (946.94 kB; 283.89 kB gzip), but Windows terminated the build process with exit 3221226505 before PWA generation completed. Its cause is not conclusively established; do not call that final run successful.
- A standalone emitted-code timing check reached its final PWA-presence assertion and failed because dist/sw.js is absent after the incomplete final build. Thus generated output is incomplete and must not be packaged or represented as accepted. No fake service worker or success evidence was added. Large-bundle warnings remain.
- Ignored sanitized evidence is under .native-validation/release-local/logs and reports, including local-web-build, local-web-build-retry and release-web-build command records. These failures are retained and require a successful full web build/timing check in an adequately resourced local environment before executing any archive workflow. No dependency upgrade or application-source correction was made to conceal them.
- The independent release manifest covers 364 source entries (plus its own file). Its hashes include this final report and preserve the original baseline manifest as historical evidence. Head remains the original source SHA; no index staging or commit occurs.
- All nine pre-existing worktrees were confirmed unchanged by HEAD, status hash and tracked-content hash. The new worktree is intentionally dirty only with the reviewed proposal and ignored local verification output.

Final recommendation: GO for review of this isolated local proposal; **NO-GO for a release-preparation commit or any worker/archive action until the local web-build failure is resolved and its full verification passes**. The next approval request is a local-only follow-up to diagnose/complete web-build verification and review the resulting seven-file proposal; no push, provider action, signing or upload. No local commit is requested until that verification succeeds.
