# Fix 1B.03B - Codemagic validation-only preparation

Status: PREPARED LOCALLY. No commit, push, Codemagic request or macOS build has run. Swift tests/compilation remain unverified.

## Worktree and Git status

Actual worktree: C:/Users/jon52/TrueVoice-Digital/.release-staging/fix-1b02a/worktree. The request's TrueVoice-Digital.release-staging spelling omits the directory separator; the established native worktree is used.

Active branch remains fix/native-ios-1b02a, HEAD 6f6b6aaf85a9d861f5c91bc6df88c79bf10bad35. A local reference ci/ios-native-validation-1b03b was created at that HEAD WITHOUT checkout, staging or commit. That ref does not yet contain the uncommitted native implementation or proposed CI workflow. It must not be pushed as-is and mistaken for the reviewed source.

Stage B's 348 manifest entries are checked again by the preparation tool before copying. Git status including every untracked path is saved in ../ci-preparation/git-status.txt. The complete tracked source diff is saved locally in ../ci-preparation/source-diff.patch; untracked source is included in the reviewed snapshot and transfer manifest. No source/environment values are printed by the audit. Existing native implementation files and other worktrees remain unchanged.

## Existing Codemagic workflow audit

The original native-worktree codemagic.yaml is unchanged. Its only workflow is truevoice-ios-workflow (display name TrueVoice iOS Workflow), on mac_mini_m2, 60-minute limit. It has no triggering/events or workflow condition in YAML. Account-level schedules, API callers and repository webhooks were not inspected or changed; absence of YAML events is not a claim about external automation.

It imports App Store Connect integration Codemagic CI, environment group truevoice_frontend, provisioning profile truevoice_appstore_profile and certificate Codemagic CI. Group contents are unknown and are not imported into validation. Existing variables select ios/App/App.xcworkspace / App. The workflow runs npm ci, ordinary web build, npx cap sync ios, an additional pod install, PROJECT_BUILD_NUMBER substitution, verbose signing-profile setup and xcode-project build-ipa. Artifacts include IPA files and Xcode logs. Its publishing.app_store_connect uses auth integration and submit_to_testflight true. No Xcode or Node version is pinned there. Do not select or run this workflow for validation.

## Isolation design and proposed changes

The reviewed candidate is ../ci-preparation/source, a separate data snapshot, not a checkout and not a running CI job. It is prepared from ALL current tracked and untracked source files, with ignored/generated/credential files explicitly excluded. In that candidate only:

1. Root codemagic.yaml is replaced by the standalone ci/native-validation/codemagic.yaml below. Only ios-native-validation exists, so the TestFlight workflow cannot be selected on the eventual dedicated CI branch. The existing native and production branches retain their original workflow. Do not merge this CI-only replacement into a release branch.
2. vercel.json receives git.deploymentEnabled=false to prevent the future CI branch push from triggering Vercel Git deployments. This is a branch-local source guard, not a hosted setting change. The original native-worktree vercel.json is unchanged.
3. .gitattributes enforces LF text checkouts; binary assets remain byte-identical. The transfer manifest records normalized hashes. Stage B raw hashes are separately verified before normalization; the candidate is not misrepresented as a raw byte-for-byte copy of every Windows text file.
4. .gitignore excludes environment files and generated validation/Swift output on the CI branch. The baseline tracks .env, so a future CI commit must explicitly delete that tracked file: ignoring it alone will not remove it.

No changes to existing production workflow steps, signing references, credentials or provider settings were made. Removing the publishing workflow from the dedicated branch candidate is the proposed accidental-execution safeguard.

## Proposed root YAML for the dedicated CI branch

```yaml
# Candidate root codemagic.yaml for the dedicated CI branch only.
# No events, publishing, signing, integrations, or credential groups.
workflows:
  ios-native-validation:
    name: ios-native-validation
    instance_type: mac_mini_m2
    max_build_duration: 60
    when:
      condition: env.CM_BRANCH == "ci/ios-native-validation-1b03b"
    environment:
      xcode: "26.2"
      node: "24.14.0"
      cocoapods: "1.16.2"
      vars:
        # Non-secret, nonfunctional fixtures: compilation only, no app launch.
        VITE_SUPABASE_URL: "https://native-validation.invalid"
        VITE_SUPABASE_ANON_KEY: "sb_publishable_validation_only_not_a_real_key"
        NODE_OPTIONS: "--max-old-space-size=512"
    scripts:
      - name: Verify branch, source manifest and unsigned environment
        script: node ci/native-validation/validate.mjs preflight
      - name: Install exact locked Node dependencies
        script: node ci/native-validation/validate.mjs dependencies
      - name: Run seven Swift policy tests
        script: node ci/native-validation/validate.mjs swift-tests
      - name: Build and inspect local Vite artifacts
        script: node ci/native-validation/validate.mjs web-build
      - name: Sync Capacitor and resolve CocoaPods
        script: node ci/native-validation/validate.mjs sync
      - name: Compile unsigned Debug iOS Simulator application
        script: node ci/native-validation/validate.mjs compile
    artifacts:
      # Sanitized text/JSON only; no .app, IPA, archive, keys or raw workspace.
      - .native-validation/ci/logs/*.log
      - .native-validation/ci/reports/*.json
```

No triggering/events section is defined; Codemagic documents this as manual-only YAML triggering. The when condition and an independent runtime check restrict the candidate to ci/ios-native-validation-1b03b. No API trigger, schedule or webhook was configured. Before a later push, review existing external automation read-only; do not assume unknown schedules or Git-host workflows are disabled.

The selected Xcode 26.2 image supports Mac mini M2; Node is pinned to 24.14.0 and CocoaPods to 1.16.2. The worker checks actual Xcode/SDK versions and fails closed on unexpected versions or unrelated app/signing secrets in its environment.

The Supabase values are explicit, NONFUNCTIONAL public fixtures for compilation only. No existing environment group or real backend key is required. The app is not launched, packaged as an IPA, distributed or uploaded. Passing compilation does not establish authentication, backend integration, Live365 runtime behavior or a release-ready configuration. A future runtime/device build needs separately approved real public client configuration.

## Scripts, logs and success criteria

ci/native-validation/validate.mjs uses Node built-ins and sanitized subprocess capture. It never dumps the environment. It runs these steps, stopping on failure:

1. preflight: require Darwin and the dedicated branch; verify every source-manifest entry against the exact Git tree; reject environment/credential files; check required native sources/assets/config/package files and seven Swift policy cases; confirm Vercel Git deployment is disabled; record commit/manifest hash and toolchain versions.
2. dependencies: npm ci --no-audit --no-fund from the unchanged package-lock.json. No npm update/audit fix or optional artwork tool installation.
3. swift-tests: swift test --package-path ios/NativeAudioPolicy. Exit zero AND an actual XCTest summary of seven tests / zero failures are required.
4. web-build: node tools/build-native-baseline.mjs using its existing approved timing and no-private-Google-key profile. Live365 and forbidden listener URL checks must pass.
5. sync: invoke the installed Capacitor CLI directly, sync ios, and let its existing CocoaPods integration resolve pods. Require generated Podfile.lock/workspace, retain all reviewed Swift bytes, confirm plugin/storyboard/source membership and capacitor://localhost. Do not use pod update. Record pod versions and lock hash.
6. compile: xcodebuild Debug / iphonesimulator / generic iOS Simulator destination with CODE_SIGNING_ALLOWED=NO, CODE_SIGNING_REQUIRED=NO, empty CODE_SIGN_IDENTITY and DEVELOPMENT_TEAM. Run build, never archive/exportArchive/build-ipa. Require App.app, no app signature, digital.truevoice.app and audio background mode. No simulator app launch occurs.

Only sanitized *.log and JSON reports under .native-validation/ci/logs and reports are collected. DerivedData, raw .xcresult, App.app, Pods, dist, IPA/archive files, environment files and signing material are not artifacts. Compiler/test logs remain available even when a step fails. Initial Pod resolution is not claimed reproducible from an existing Podfile.lock: none exists yet; the first actual resolved versions must be reviewed.

Overall success requires seven Swift tests passing, Vite/timing/distribution checks passing, successful Capacitor/Pods resolution, successful unsigned simulator compilation, retained plugin wiring, expected bundle identity/audio mode and no distribution. No such result is claimed now. Local checks only parse YAML, inspect guards, exercise redaction and verify manifest failure cases.

## Full source and sensitive-information review

The preparation tool scans current tracked, untracked AND ignored files without printing matched values. It flags private keys, Google/API and AWS keys, Stripe secrets and service-role JWTs, and excludes environment/credential files. The local audit is ../ci-preparation/audit.json; it reports filenames/categories/counts, not secret values. This is a bounded automated scan plus source review, not proof that arbitrary secrets can never exist.

The historical tracked .env is excluded. It must not be uploaded or force-added. Any prior credential in Git history is unaffected by deleting the current file; use only the existing approved repository and do not publish this branch/history to a new public remote. Rotation/history remediation would require separate scope.

Ignored dist and native generated configuration/public resources, Pods, node_modules, caches and local settings are not assumed to transfer. They are regenerated by the workflow. All required Swift files, policy package/tests, Capacitor configuration, package files, public artwork, native icon/splash catalogs and the Xcode project are explicitly required by the transfer verifier. No dependency install/sync/build occurred while preparing this snapshot.

## Exact future source-transfer procedure - DO NOT EXECUTE YET

Separate approval is required for the CI commit, push and build execution. No production/native branch merge is needed.

1. Inspect audit.json, git-status.txt, source-diff.patch, candidate YAML and the complete candidate source-manifest.json. Re-run node ci/native-validation/verify-transfer.mjs against the candidate directory; it must report no missing or mismatched entries.
2. Create a NEW clean CI worktree at the already-created ci/ios-native-validation-1b03b ref, e.g. C:/Users/jon52/TrueVoice-Digital/.release-staging/fix-1b03b-ci/worktree. Require an unused path and a clean worktree at the expected baseline. Never overlay another dirty worktree.
3. In that new CI worktree only, git rm -- .env. This stages deletion of the historical tracked environment file; do not display its deletion contents in logs. Overlay the reviewed candidate snapshot, including its validation-only root YAML and branch-local Vercel guard.
4. Stage only the paths in ../ci-preparation/transfer-paths.nul with git add --pathspec-from-file=<absolute path to transfer-paths.nul> --pathspec-file-nul. Do not use git add . or force-add ignored files. The staged .env deletion from step 3 remains.
5. Run node <CI-worktree>/ci/native-validation/verify-transfer.mjs <CI-worktree> --git-index. It verifies the exact staged file set and every staged blob against the LF-normalized manifest, including the manifest itself. Stop on any mismatch, missing untracked file, unexpected tracked file or lingering .env. This prevents Windows Git line-ending conversion or accidental omissions from silently changing what Codemagic will receive.
6. Review git diff --cached --name-status and the content diff excluding .env. Source diff review must include all reconstructed native/web changes, not just the new CI files. Confirm only validation workflow exists at root, no publishing/signing/integrations/groups, and vercel.json disables Git deployments.
7. After explicit commit approval, create the dedicated CI commit (an additional [skip ci] message marker may be used as defense in depth). Record its SHA and rerun staged/tree verification. A branch ref pointing to the old HEAD is NOT a source transfer.
8. After explicit push approval and read-only review of external automation, push only ci/ios-native-validation-1b03b to the existing approved origin. Never push --all, --mirror, tags, main or a production branch. No force-push, merge or production promotion.
9. Verify Codemagic can see the exact approved commit. It receives committed Git files; it cannot see this Windows worktree's ignored/untracked files until they are deliberately included in that CI commit. No source archive is uploaded through a build-trigger API in this preparation.

Example future PowerShell operations after the appropriate approvals (paths must be checked first):

```powershell
$ciWorktree = 'C:\Users\jon52\TrueVoice-Digital\.release-staging\fix-1b03b-ci\worktree'
$snapshot = 'C:\Users\jon52\TrueVoice-Digital\.release-staging\fix-1b02a\ci-preparation\source'
$pathList = 'C:\Users\jon52\TrueVoice-Digital\.release-staging\fix-1b02a\ci-preparation\transfer-paths.nul'
# Require $ciWorktree to be unused, and verify source snapshot first.
git worktree add $ciWorktree ci/ios-native-validation-1b03b
# Require git -C $ciWorktree status --porcelain to be empty.
git -C $ciWorktree rm -- .env
Get-ChildItem -LiteralPath $snapshot -Force | Copy-Item -Destination $ciWorktree -Recurse -Force
git -C $ciWorktree add --pathspec-from-file=$pathList --pathspec-file-nul
node "$ciWorktree/ci/native-validation/verify-transfer.mjs" $ciWorktree --git-index
git -C $ciWorktree diff --cached --name-status
# STOP for commit/push approval. No commit or push command was run here.
```

## Manual Codemagic dashboard selection - only after later execution approval

Open the existing TrueVoice application in Codemagic and choose Start new build. Select branch ci/ios-native-validation-1b03b FIRST, then select workflow ios-native-validation, and verify the exact approved commit SHA. The reviewed branch's root YAML contains only that workflow. If TrueVoice iOS Workflow / truevoice-ios-workflow appears as the selected workflow, stop: the wrong branch/configuration is loaded. Do not edit the application's default workflow or signing settings to work around this.

Check the displayed macOS image/Node/CocoaPods selections and confirm no publishing or signing is configured. Only after explicit build-execution approval press Start new build. During the build inspect the unsigned preflight, actual seven-test summary and build steps. Download only the listed logs/JSON reports and record results. A Swift/Xcode error requires narrow documented corrections and a newly reviewed CI commit; do not repurpose the TestFlight workflow.

## Remaining risks / approval gates

No Codemagic account-level configuration or server-side YAML validation was accessed. Image availability, permissions, external schedules/API triggers and inherited global environment must be checked at the future execution gate. The pinned image is supported by published provider documentation, not by a build executed here.

The existing catalog-proxy regression, full-lint baseline issues, large Vite chunk, dependency/artwork-tool warnings, native rights/privacy/signing/branding gaps and all physical-device tests remain separate from compilation preparation. The validation workflow does not fix or hide them. Fixture configuration deliberately prevents treating this compilation-only candidate as a runtime/release build.

Stop here. No push, commit, Codemagic execution, distribution, provider-setting change, credential change, production operation or modification to another worktree has occurred.

Sources:
- https://docs.codemagic.io/yaml-running-builds/starting-builds-automatically/
- https://docs.codemagic.io/partials/yaml-conditional-run/
- https://docs.codemagic.io/specs-macos/xcode-26-2/
- https://docs.codemagic.io/yaml-basic-configuration/yaml-getting-started/
- https://help.codemagic.io/articles/5988076910-how-do-i-start-a-new-build-in-codemagic
- https://vercel.com/docs/project-configuration/git-configuration
