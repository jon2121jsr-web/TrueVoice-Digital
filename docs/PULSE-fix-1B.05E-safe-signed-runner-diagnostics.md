# PULSE Fix 1B.05E — safe signed-runner diagnostics proposal

Local proposal only. No commit, push, provider action, signing, archive, IPA export,
upload or deployment was performed. This instrumentation does not correct or
relax the still-unconfirmed cause of the previous signed-workflow failure.

## Baseline and exact inventory

Isolated worktree: `.release-staging/fix-1b04-release/worktree`.
Branch: `release/ios-testflight-1b04`.
Approved HEAD: `99865d08185c119c47d7273fdcd610da6c9a07c8`; initially clean.

Exactly seven proposed files:

| Status | Path | Purpose |
| --- | --- | --- |
| Modified | `ci/ios-signed/validate.mjs` | Instrument processes and post-configuration failure window; retain checks and commands |
| Modified | `ci/ios-signed/policy.mjs` | Supply rejected mutation paths/types through a callback; preserve complete allowlist |
| Modified | `ci/ios-signed/run.mjs` | Dispatch through the redacted diagnostic boundary |
| Modified | `ci/ios-release/source-manifest.json` | Refresh complete source inventory and hashes |
| Added | `ci/ios-signed/diagnostics.mjs` | Controlled stage/process reporting and redaction |
| Added | `ci/ios-signed/diagnostics.test.mjs` | Synthetic regression and confidentiality tests |
| Added | `docs/PULSE-fix-1B.05E-safe-signed-runner-diagnostics.md` | This report |

The manifest contains 377 entries, excluding itself: the previous 374 plus the
three additions above. The original source ancestry anchor remains unchanged.
No production/native implementation, dependencies, workflow YAML, signing asset
selection, runtime fingerprint or export options are changed. Nothing is staged.

## Diagnostic contract

The existing `*-steps.json` now records each subprocess as `attempted`, with null
exit code, before launch. Afterward it records `completed` or `failed`, numeric
exit status, a restricted signal classification and a fixed result classification.
Known launch failures distinguish missing executable, denied execution, timeout
and output limit; other errors remain `PROCESS_ERROR` or `LAUNCH_EXCEPTION`.
Nonzero process statuses remain nonzero runner statuses; unknown exceptions fail
with exit 1. Child output remains privately captured with the same buffer/timeout.

New `*-diagnostics.json` files are collected by the existing JSON artifact glob;
no workflow or artifact-scope edit is needed. Stages are persisted before checks
and completed/failed afterward:

- `POST_CONFIG_JSON`: parse the returned post-configuration JSON.
- `PROJECT_MUTATIONS`: enforce the unchanged complete mutation allowlist.
- `APP_TARGET` and `RELEASE_CONFIG`: locate exactly one App target and Release config.
- `TEAM`, `SIGNING_STYLE`, `PROFILE_SPECIFIER`: retain exact existing assertions.
- `NATIVE_INTEGRITY`: retain Swift hashes, registration and source membership checks.
- `EXPORT_OPTIONS`, `EXPORT_OPTIONS_WRITE`: prepare existing options and write plist.
- `FRESH_ARTIFACTS`: retain stale-artifact rejection.
- `ARCHIVE_LAUNCH`: attempt the unchanged archive command.
- `RUNNER`: outer boundary for failures outside the detailed window.

Failure records and console messages contain fixed stage/classification codes,
such as `PULSE_DIAG_PROJECT_MUTATIONS_ASSERTION` or
`PULSE_DIAG_POST_CONFIG_JSON_INVALID_JSON`. The earliest failure is retained when
an exception propagates through the outer boundary. Raw exception text, stack,
assertion values, environment, command arguments and tool output are never copied
to diagnostic reports or messages.

Rejected mutations contain only `path` and `changeType` (`added`, `removed`, or
`modified`). All rejected paths are collected before the same rejection assertion.
Known structural keys, reviewed signing-setting names and 24-hex object IDs are
retained; unknown components become `[redacted-key]`. No old/new values or project
dumps are emitted. This intentional loss of unknown key names protects against
sensitive strings embedded in unexpected keys. A subsequent review may need a
specific safe key classification; it must not enable arbitrary value dumping.

## Offline validation

All 55 offline tests pass (42 existing plus 13 diagnostic tests), exit 0, with no
failures or skips. Run serially:

```sh
node --test --test-concurrency=1 --test-reporter=spec \
  tests/native-audio.test.mjs tests/native-routing.test.mjs \
  tests/live365-distribution.test.mjs tests/native-ci-preparation.test.mjs \
  ci/native-validation/runner.test.mjs ci/ios-release/release.test.mjs \
  ci/ios-signed/signed.test.mjs ci/ios-signed/diagnostics.test.mjs
```

New cases cover success; rejected mutation and sensitive-key/value redaction;
invalid post-configuration JSON; missing App/Release and malformed lookup;
incorrect team/style/specifier; unexpected JavaScript/native-integrity exception;
real missing-executable launch; pre-launch persistence; successful/nonzero/thrown
process completion; and parity with the approved mutation allowlist including SDK
suffixes and target attributes. Synthetic failures demonstrate that both JSON
reports exist before any archive process is launched. Only a nonexistent fixture
executable is attempted; no signing or native build tool runs in these tests.

The complete candidate manifest matches all 377 source entries and the exact
tracked/untracked inventory. JavaScript syntax, whitespace, narrow changed-file
inventory and credential-pattern checks pass. Existing tests verify unchanged
unsigned workflows/runners, exclusive signing scope and no automatic triggers,
integration or publishing sections. Read-only comparisons preserve all nine
other worktrees and refs. The signed helper commands, profile/certificate labels,
export options and runtime checks remain unchanged from the approved baseline.

## Limitations and recommendation

The earlier artifact proves six preparation subprocesses completed, not which
subsequent JavaScript assertion failed. This proposal makes that next failure
observable; it deliberately does not expand the allowlist or change signing.
Mac-specific helper behavior and real signing assets remain unverified locally.

Diagnostics require a writable report directory. If report persistence fails,
the runner fails closed and emits only `PULSE_DIAG_REPORT_IO_FAILED`; it cannot
guarantee an artifact on an unwritable filesystem or after abrupt worker loss.
A termination during execution may leave the last process marked `attempted`.
Existing raw tool output remains excluded. Existing artifact collection behavior,
including possible IPA collection after a later verification failure, is unchanged.

GO for a separately approved local commit of these seven files after review.
NO-GO for push, Codemagic execution, signing or export under this authorization.
Review the exact diff, mutation-allowlist parity tests, redaction boundary and
manifest before granting commit approval. A later push and diagnostic build need
separate explicit authorization.
