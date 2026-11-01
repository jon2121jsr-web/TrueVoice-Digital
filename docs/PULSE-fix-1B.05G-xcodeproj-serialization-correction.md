# PULSE Fix 1B.05G — exact-path Xcodeproj serialization correction

Local proposal only; no staging, commit, push, build, signing, provisioning,
archive/export, upload, deployment or provider action is performed.

## Baseline and exact inventory

Branch: `release/ios-testflight-1b04`.
HEAD: `19f36873ace72dbcc5bf446ea7bfba419c82c351`.
Worktree: `.release-staging/fix-1b04-release/worktree`; initially clean with an
empty staging index. Exactly four files are proposed:

| Status | File | Purpose |
| --- | --- | --- |
| Modified | `ci/ios-signed/policy.mjs` | Add the single guarded serialization exception |
| Modified | `ci/ios-release/source-manifest.json` | Refresh source hashes and inventory |
| Added | `ci/ios-signed/serialization.test.mjs` | Ten focused regression tests |
| Added | `docs/PULSE-fix-1B.05G-xcodeproj-serialization-correction.md` | This report |

No Xcode project or workflow source is edited to avoid the assertion.

## Before and after

The reported worker failure is `PROJECT_MUTATIONS / ASSERTION` for removal of
`objects.504EC2FC1FED79650016851F.packageReferences`. The committed project identifies
this root object as `PBXProject` and its packageReferences value is an empty array.
No local/remote package-reference or package-product dependency objects are present
in the App project. Capacitor uses CocoaPods. The separate NativeAudioPolicy test
package is invoked directly, and its implementation is in App's source build phase.

Previously, all such removals failed the signing-only allowlist. The proposal
retains both existing signing-setting/target-attribute predicates byte-for-byte and
adds one alternative that requires every condition below:

1. Exactly three path components: `objects`, the exact expected object ID, and
   `packageReferences`.
2. Change type is exactly `removed`.
3. Both `rootObject` values equal `504EC2FC1FED79650016851F`.
4. Both corresponding objects have `isa === 'PBXProject'`.
5. The original object has its own packageReferences property.
6. Its original value satisfies `Array.isArray(value)` and `value.length === 0`.
7. The replacement object has no own packageReferences property.

The exception neither filters other changes out of the comparison nor bypasses
any later validation. Every other changed path still passes through the existing
predicates and rejection assertion. Removal of actual dependencies, adding or
replacing references, changing another object, or changing native source/project
settings remains rejected. An unchanged property is a no-op, not an exception.

This is consistent with Xcodeproj's documented implementation: its PBXProject
serializer deliberately omits empty packageReferences. Codemagic's helper opens
and saves the project through Xcodeproj. The exact gem version on the failed worker
has not been independently confirmed. References from the preceding investigation:
[Xcodeproj 1.27.0 PBXProject serializer](https://github.com/CocoaPods/Xcodeproj/blob/1.27.0/lib/xcodeproj/project/object/root_object.rb#L83-L94),
[Codemagic profile helper](https://github.com/codemagic-ci-cd/cli-tools/blob/master/src/codemagic/scripts/code_signing_manager.rb).

## Offline verification

All 65 offline tests pass, exit 0: the existing 55 plus ten serialization tests.
No failures, cancellations or skips. Command, run serially:

```sh
node --test --test-concurrency=1 --test-reporter=spec \
  tests/native-audio.test.mjs tests/native-routing.test.mjs \
  tests/live365-distribution.test.mjs tests/native-ci-preparation.test.mjs \
  ci/native-validation/runner.test.mjs ci/ios-release/release.test.mjs \
  ci/ios-signed/signed.test.mjs ci/ios-signed/diagnostics.test.mjs \
  ci/ios-signed/serialization.test.mjs
```

New cases cover exact permitted omission and unchanged states; nonempty remote and
local dependencies; malformed original values; replacements/nulling/additions;
an own replacement property whose value is undefined; another object; mismatched
or missing roots/types; lookalike/nested properties; unrelated forbidden changes;
and compatibility with existing permitted signing changes. The diagnostic rejection
callback continues to report accompanying unauthorized mutations. Existing tests
retain parity with the original signing-only allowlist outside this new exact case.

The refreshed manifest contains 379 entries excluding itself: 377 prior entries
plus this report and the new test. Every SHA-256 matches complete working-source
bytes, with exact source inventory, safe paths and no duplicate entries. The
original ancestry anchor remains unchanged. Manifest refresh is required because
the existing source-integrity gate covers all source/test/report bytes.

JavaScript syntax, credential-pattern, whitespace and exact four-file inventory
checks pass. The policy prefix containing all team, certificate, profile,
entitlement, runtime and export-option checks is unchanged. Archive/export runner,
all workflow YAML, diagnostics, public-runtime fingerprint and unsigned validation
implementations remain byte-identical to HEAD. Thus command arguments, manual-only
guards, restricted signing-asset references and no publishing/TestFlight settings
remain unchanged. Other nine worktrees and all refs remain unchanged. No files are
staged and no generated build artifacts are part of the proposal.

## Uncertainties and recommendation

The narrow omission represents no dependency loss for an originally empty list.
It does not prove that a signed archive or IPA will succeed, establish runtime
device acceptance, or resolve any subsequent worker error. Mac-specific helper,
signing and export behavior remains unexecuted locally. The strict guard will
continue to fail if meaningful package dependencies are introduced later and
removed by a helper. The exception intentionally cannot follow a changed project
object ID without a separate review.

GO for one separately authorized local commit of these four reviewed files after
verification. No authorization for staging, commit, push or any build is implied
by this proposal. Review the exact policy diff and negative tests, verify the
379-entry manifest, then obtain explicit commit approval. A later push and manual
Codemagic run each require separate approval.
