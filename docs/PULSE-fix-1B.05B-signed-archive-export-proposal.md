# PULSE Fix 1B.05B — isolated signed archive/export proposal

Status: LOCAL PROPOSAL ONLY. No commit, push, build, signing, archive, export,
upload, deployment, asset retrieval or provider change is authorized or performed.

## Baseline and inventory

Prepared in `.release-staging/fix-1b04-release/worktree`, branch
`release/ios-testflight-1b04`, HEAD
`6b4b5c39e53bc16bdb1df55c5c9c6962c912cc1e`. The initial release checkout was
clean and its 366-entry manifest matched. The candidate manifest has 374 entries
excluding the manifest itself. It retains the original validated ancestry anchor
`1c3ebb18eee5151c47d844ea97100651624c98e6`; the new policy additionally requires
ancestry from the approved 6b4b5c commit.

Exact proposal inventory (11 files):

- `codemagic.yaml`: add only the signed sibling workflow and correct root comment.
- `ci/ios-release/release.test.mjs`: retain unsigned checks, admit the new sibling.
- `ci/ios-release/source-manifest.json`: refresh complete candidate inventory/hashes.
- `ci/ios-signed/policy.json`: approved identifiers and reference names, no credentials.
- `ci/ios-signed/policy.mjs`: source selection, runtime, profile, identity, entitlement,
  export and project-mutation policies.
- `ci/ios-signed/run.mjs`: explicit CLI dispatch with controlled error output.
- `ci/ios-signed/validate.mjs`: future macOS pipeline and private tool capture.
- `ci/ios-signed/plist-metadata.py`: private in-memory plist metadata conversion.
- `ci/ios-signed/inspect-signature.swift`: Security-framework signature inspection.
- `ci/ios-signed/signed.test.mjs`: synthetic safety/regression cases.
- `docs/PULSE-fix-1B.05B-signed-archive-export-proposal.md`: this proposal.

No application, dependency lock, production deployment, native audio or legacy
distribution files change. Both existing unsigned workflow definitions and their
implementation runners remain unchanged. The separate legacy
`truevoice-ios-workflow` in the development checkout is neither changed nor called.

## Proposed workflow and commands

Workflow: `ios-signed-archive-export-validation`. Pins: Xcode 26.2, Node 24.14.0,
CocoaPods 1.16.2, mac_mini_m2. No triggering/events, publishing, integration,
App Store Connect API key, deployment or upload commands. Branch guard restricts
the release branch. The runner requires `CM_WORKFLOW_NAME` to match and
`CM_TRIGGER_SOURCE=api`; it rejects webhook/schedule runs. Codemagic uses `api`
for both UI-manual and API starts, so YAML cannot distinguish those two callers.
Provider permissions and automatic API clients require separate portal review.

Only the new workflow imports the existing signing references:

- Certificate reference: `Codemagic CI.` (trailing period is intentional).
- Profile reference: `truevoice_appstore_profile`, exposed as the *path*
  `PULSE_SIGNING_PROFILE_PATH`.
- Public group: `pulse_ios_public_runtime` (the approved Supabase URL/anon pair).
- Team: `BX8URAAMLD`; bundle: `digital.truevoice.app`.

References are labels, not credential bytes. Explicit references cannot be mixed
with `ios_signing.distribution_type`/`bundle_identifier`; distribution is enforced
by profile policy and generated export options instead. See
[Codemagic signing reference syntax](https://docs.codemagic.io/yaml-code-signing/signing-ios/).
Codemagic would make the existing selected assets available to the future worker
and initialize its signing keychain. No API-based automatic provisioning or asset
generation is requested. Nothing was retrieved during local preparation.

YAML runs these exact entry points, sequentially:

```sh
node ci/ios-signed/run.mjs preflight
node ci/ios-signed/run.mjs dependencies
node ci/ios-signed/run.mjs swift-tests
node ci/ios-signed/run.mjs web-build
node ci/ios-signed/run.mjs sync
node ci/ios-signed/run.mjs archive-export
```

They perform clean committed source/manifest/native registration checks before
generated changes, validate the unchanged approved runtime fingerprint, verify
distribution asset metadata, then run:

```sh
npm ci --no-audit --no-fund
swift test --package-path ios/NativeAudioPolicy --verbose
node ci/ios-release/build-web.mjs
node tools/verify-stream-timing-build.mjs
npx --no-install cap sync ios
# cwd ios/App:
pod install
```

The final step selects only the approved profile and one valid matching
distribution identity. It applies the existing profile using
`xcode-project use-profiles --silent --project ios/App/App.xcodeproj --profile
<selected-path> --archive-method app-store --export-options-plist
<private>/helper-export-options.plist`. A before/after project comparison permits
only signing-setting changes. The helper plist is not used for export; reviewed
options are independently generated. Native membership/hashes are rechecked.

Archive invocation (absolute worker paths substituted by the runner):

```sh
xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
  -configuration Release -sdk iphoneos -destination generic/platform=iOS \
  -archivePath <output>/App-signed.xcarchive \
  -derivedDataPath <private>/DerivedData -resultBundlePath <private>/Archive.xcresult \
  DEVELOPMENT_TEAM=BX8URAAMLD CODE_SIGN_STYLE=Manual CODE_SIGNING_ALLOWED=YES archive
xcodebuild -exportArchive -archivePath <output>/App-signed.xcarchive \
  -exportOptionsPlist <private>/ExportOptions.plist -exportPath <output>/export
```

Export options specify `method=app-store-connect`, `destination=export`, manual
signing, exact team, selected certificate SHA-1, bundle-to-selected-profile UUID,
`manageAppVersionAndBuildNumber=false`, `uploadSymbols=false`. There is no
`-allowProvisioningUpdates`, upload destination or legacy workflow fallback.

## Verification and artifact policy

Future execution requires: seven actual Swift tests, real web/PWA/timing checks,
native plugin registration, App Release compilation of all three native Swift
files and the archive-success marker. Nonzero child exit codes fail the step;
timeouts/signals also fail. No partial output is accepted as success.

Before and after export, checks include strict/deep codesign verification, leaf
certificate SHA-1 match to the valid selected keychain identity, team, bundle,
version/build, audio background mode, embedded profile byte hash and UUID match,
profile expiry/type, and authorized entitlements. App Store distribution requires
no device list, no enterprise distribution, `get-task-allow=false` and
`beta-reports-active=true`. Unexpected application prefixes, extensions, project
mutations or entitlements fail closed and require review, not a bypass.

The final controlled JSON records verification booleans, entitlement *names*,
archive/app deterministic tree SHA-256 hashes and exported IPA SHA-256. YAML
collects only the IPA and controlled JSON reports. The signed archive remains
worker-local; raw build logs, xcresult, export plists, profiles, certificate data
and keychain files are excluded. IPA payload/provisioning data is an intentional
signed artifact and must be handled as restricted build output.

Signing-tool stdout/stderr is captured in private process memory, never printed
or retained as an artifact. Failure evidence is limited to controlled step/exit
status. This protects credentials but reduces troubleshooting detail. Future
diagnostic changes require review. Codemagic's own asset-initialization logs are
provider-controlled; their redaction has not been verified by this local proposal.

Child processes receive only OS/tool paths and the approved two public inputs;
the unchanged unsigned runtime guard runs in that restricted environment. The
new signed guard checks the full parent environment first. This is environment
separation, not a keychain sandbox: trusted dependency/build tools in the same
future job could access its signing keychain. Review locked dependency/lifecycle
scripts and worker permissions before approving execution.

## Local validation

The serial offline regression command completed with exit 0: 42 tests passed
(the existing 33 plus nine signing-policy/isolation tests), none failed or skipped:

```sh
node --test --test-concurrency=1 --test-reporter=spec \
  tests/native-audio.test.mjs tests/native-routing.test.mjs \
  tests/live365-distribution.test.mjs tests/native-ci-preparation.test.mjs \
  ci/native-validation/runner.test.mjs ci/ios-release/release.test.mjs \
  ci/ios-signed/signed.test.mjs
```

Manifest verification covers all 374 candidate entries and the exact complete
source inventory. YAML parses successfully. Synthetic tests confirm unchanged
unsigned definitions/runners, exclusive signing scope, wrong-input rejection,
entitlement/profile/identity checks, export-only options and artifact safeguards.
JavaScript syntax, complete changed-file inventory, credential-pattern and
whitespace checks pass. The real Git index remains empty of staged changes.
Read-only before/after comparisons confirm the nine other worktrees' HEADs,
statuses and source hashes, plus all local branch/remote-tracking/tag refs,
are unchanged. No remote refs are contacted or changed in this task.

No Swift compilation, Xcode, signing-asset decoding, archive/export or web build
is executed locally. Windows cannot establish macOS helper/API compatibility or
the validity of the named portal assets. Offline tests use synthetic metadata and
an obviously synthetic public pair, never a real JWT or signing asset.

## Risks, missing evidence and review instructions

The reference labels/team are user-approved inputs, not independent verification
of current portal validity. Before any run, manually inspect existing asset
metadata (do not regenerate/download): distribution identity with private key,
valid expiry/revocation state, matching profile certificate/team/explicit bundle,
App Store type and required capabilities. Verify public group scope contains only
approved public inputs. Check provider triggers, schedules, API clients and access
permissions separately; absence of YAML triggers does not prove portal isolation.

The Swift Security-framework helper, Python conversion and CLI project changes
are source-reviewed only until a separately authorized macOS run. Strict prefix,
entitlement and embedded-profile equality rules may intentionally stop that run.
Do not relax them without reviewing the specific mismatch. Existing version 1.0 /
build 1 is retained; App Store Connect uniqueness requires separate review before
any later upload. No upload credentials are needed for this export-only proposal.

An App Store Connect IPA is not directly installable on a physical iPhone. A
separately approved TestFlight upload/processing/tester setup, or a separately
designed device-distribution path, is still required. Live365 authorization,
third-party content rights, privacy/store disclosures and physical-device
background audio, interruptions, lock-screen, route-change and resume acceptance
remain release gates. A signed archive alone does not establish those outcomes.

Review, without running the signed entry points:

1. Confirm HEAD/branch; inspect `git diff -- codemagic.yaml ci/ios-release/release.test.mjs`
   and every new file under `ci/ios-signed` plus this report.
2. Verify manifest paths/hash bytes and the exact 11-file inventory; compare both
   unsigned workflows and runners to the approved baseline.
3. Review synthetic negative tests, export options, project-mutation allowlist,
   no-upload command paths and narrow artifact globs.
4. Review portal asset metadata, dependencies and provider permissions manually.
5. Seek separate approval for a local commit. Push and the first manually selected
   signed-workflow run each require their own explicit approval. None is executed.

GO for local proposal review only; NO-GO for signing, export, distribution or any
provider execution until the missing evidence and approval gates are satisfied.
Rollback before commit is discarding only these reviewed proposal files; do not
alter other worktrees or approved baseline workflows.

Additional reference: [Codemagic built-in workflow/trigger variables](https://docs.codemagic.io/yaml-basic-configuration/environment-variables/)
and [profile application CLI options](https://github.com/codemagic-ci-cd/cli-tools/blob/master/docs/xcode-project/use-profiles.md).
