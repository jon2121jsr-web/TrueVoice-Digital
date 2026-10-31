# PULSE Fix 1B.04B - Local Web/PWA Build Failure Diagnosis

Diagnosis started October 30 and resumed October 31, 2026, America/Phoenix. Local-only work. **Resolved after user memory cleanup: the unchanged release build now exits 0, generates the complete PWA, and passes emitted-artifact verification. No application/configuration patch was necessary.**

## A. Original failure and preservation evidence

Branch release/ios-testflight-1b04 and HEAD 1c3ebb18eee5151c47d844ea97100651624c98e6 were verified before diagnosis. The isolated worktree remains C:/Users/jon52/TrueVoice-Digital/.release-staging/fix-1b04-release/worktree. It already contained the seven-file, uncommitted Fix 1B.04A proposal: root codemagic.yaml plus ci/ios-release/build-web.mjs, validate.mjs, release.test.mjs, runtime-profile.json, source-manifest.json and the 1B.04A report. No staged changes or preparation commit existed.

HEAD, porcelain-status hashes and aggregate tracked/untracked source-content hashes were captured for all ten worktrees before proceeding. Existing development, production web, native and validation worktrees are preserved; the only source changes authorized here are this report and its release-manifest metadata. The 1B.04A proposal itself is retained, not reset or replaced.

Original sanitized records are under .native-validation/release-local/logs and reports (ignored local evidence):

| Run | Evidence/outcome |
| --- | --- |
| local-web-build | Inherited tools/build-native-baseline.mjs, Node old-space budget 512 MiB: Vite/PWA output emitted, then its timing child suffered a zone-allocation failure. Outer helper exit 1, signal null. |
| local-web-build-retry | Same helper, 256 MiB old-space: explicit V8 heap exhaustion near 250 MiB; process exit 134, signal null. |
| release-web-build | Process-separated release helper, 512 MiB old-space: 814 modules and main asset emitted, then exit 3221226505 (0xC0000409), signal null, before complete PWA output. |

The last Windows code is a fail-fast termination code, not sufficient by itself to prove a memory cause or identify a faulting package. The new reproduction below supplies the missing allocation evidence. Prior partial files never constituted a passing complete build.

## B. Root-cause determination

### Confirmed host resource failure

A controlled reproduction used 384 MiB old-space and a 4 MiB maximum semi-space, midway between the previous budgets, with fatal diagnostics enabled but environment/network details excluded. It again transformed 814 modules and emitted the same main asset. During subsequent PWA processing a worker reported:

```
FATAL ERROR: Committing semi space failed.
Allocation failed - JavaScript heap out of memory
```

The last worker GC messages showed only about 3.6-4.8 MiB live heap and about 6.1-7.6 MiB heap capacity. This is allocation/commit failure at worker startup, not a worker consuming its 384 MiB configured old-space budget. The parent captured exit 3221226505, signal null. A worker diagnostic report was attempted (report.20261030.170141.2648.3.001.json) but truncated at 4096 bytes; it is not treated as a complete parsed diagnostic report. The fatal stderr and recorded exit status remain usable evidence.

At the same time, an unrelated read-only PowerShell diagnostic process could not initialize System.Management.Automation because Windows reported **the paging file was too small**, HRESULT 0x800705AF. This failure happened outside Vite/application JavaScript and corroborates a system commit limit, not merely a Rollup validation error.

Structured host metrics collected at 2026-10-31T00:00:02Z (October 30 at 17:00 Phoenix):

| Metric | Observed |
| --- | --- |
| Physical RAM visible | 6,108,668 KiB, about 5.83 GiB |
| Free physical memory | 685,736 KiB, about 670 MiB |
| Total virtual/commit capacity reported by Windows | 24,983,036 KiB, about 23.83 GiB |
| Free virtual/commit headroom | 374,088 KiB, about 365 MiB; an earlier sample was about 283 MiB |
| Logical processors | 8 |
| Pagefile allocated | 18,432 MiB |
| Pagefile current / peak usage | 4,428 / 5,076 MiB |

Physical free memory alone did not establish allocation capacity: Windows commit headroom was also low and fluctuating. No applications were terminated, pagefile settings changed, resource limits increased or services restarted. The diagnostic run released memory when it exited, but a later observation again showed only about 392 MiB free physical memory; sufficient stable build capacity was not established.

### Build phase and process handling

Vite completed transformation/chunk emission; failure occurred before the PWA plugin's completion summary and generated service-worker/runtime files. Inspection of installed workbox-build/build/lib/bundle.js shows production service-worker output is bundled through Rollup and @rollup/plugin-terser. The latter creates Node Worker threads and has a CPU-count-based default maximum. This identifies additional worker allocation during the failing phase; the exact number of workers alive at failure was not independently measured. No claim is made that all eight workers were created or that the dependency has a functional bug.

The release tooling already separates Vite and the emitted-code verifier into sequential processes, propagates nonzero child exit codes and preserves output. The failure occurred in about eleven seconds, not at the 25-minute command timeout. Logs are far below the 50 MiB capture ceiling; there is no ENOBUFS indication. No POSIX-style signal was reported on Windows. Neither a hidden successful exit nor a timeout/buffer-management error explains these records.

The 256 MiB retry also imposed an independently inadequate heap limit on Vite. Reducing heap caps further would not fix host commit exhaustion. The 384 MiB reproduction retained the failure and produced more specific allocation evidence; it is a diagnostic command, not a newly approved production build setting.

### Versions, dependencies and environment

Node is v24.14.0, npm.cmd reports 11.9.0, Vite is 7.3.7 and vite-plugin-pwa is 1.2.0. Installed Workbox 7.4.1, @rollup/plugin-terser 1.0.0, Rollup 4.64.6, esbuild 0.28.2 and @babel/parser 7.29.9 all match package-lock.json's corresponding versions. package-lock.json and vite.config.js are byte-identical to the validated baseline. No dependency installation/upgrade or tarball integrity revalidation was performed; matching versions are not a full cryptographic audit of installed node_modules. Local packages resolve through the already installed root node_modules, unlike a fresh CI npm ci.

PowerShell's npm.ps1 launch was blocked by existing execution policy during version inspection. npm.cmd worked. The failing build invokes node directly, so that policy is unrelated to its PWA failure. No execution-policy change was made.

Runtime inputs came from the previously approved public pair, in memory, and passed the existing fingerprint/anon-role/project-reference guard before Vite started. No .env file was copied into the release worktree. No private/signing input or placeholder client configuration was added. Source identity, native audio and shared build/PWA configuration remain unchanged from the prior proposal.

The supplied Codemagic success is for the baseline's unsigned Debug simulator workflow, reportedly using Xcode 26.2/Node 24.14.0 and a Mac worker. It is not independent evidence that this Windows host has sufficient memory. No remote Codemagic logs were retrieved, so exact remote peak memory, resolved files and artifact hashes are unverified. Local source and locked versions show no evidence of an application/dependency change causing the observed resource failure, but successful application/PWA completion must still be demonstrated on a sufficiently resourced host.

## C. Exact changes made

**No build-wrapper, application-source, PWA/shared-configuration, dependency, native-audio or workflow changes were made.** The existing release wrapper correctly rejects the failure, and the new evidence does not justify a source patch. Capping Workbox by monkey-patching dependencies, disabling/minimizing PWA features, changing shared build configuration or fabricating service-worker files would exceed the justified remediation and is not done.

The user completed memory cleanup and authorized resumption. Before any build, Windows was rechecked: commit headroom was 2,018 MiB (previously only 51-365 MiB), with 406 MiB free physical RAM. This provided commit capacity for one bounded, serialized retry despite low physical free memory. Existing Git branch, exact HEAD and partial changes were inspected first. The same release source and 384 MiB old-space / 4 MiB semi-space command then completed with exit 0, signal null, including PWA generation. This successful controlled repeat supports the host-resource diagnosis. No pagefile, OS, dependency or application-source change was made, and unrelated processes were not terminated. Build and test runs were serialized.

Only this report is created and ci/ios-release/source-manifest.json is refreshed to include it. Diagnostic logs, command results and the incomplete fatal report are stored under the ignored .native-validation/1b04b directory. No diagnostic data containing environment values was printed.

## D. Commands and exit codes

The approved public pair is supplied through the process environment after validation; its values are never command-line arguments. GOMAXPROCS=2 limits the Go/esbuild side but does not control Node/Workbox worker allocation.

```powershell
# Identical bounded command: before cleanup exit 3221226505; after cleanup exit 0; signal null:
node --max-old-space-size=384 --max-semi-space-size=4 `
  --report-on-fatalerror --report-exclude-env --report-exclude-network `
  --report-directory=<release-worktree>/.native-validation/1b04b `
  ci/ios-release/build-web.mjs

# Complete emitted timing/PWA verifier: before cleanup exit 1; after cleanup exit 0:
node --max-old-space-size=512 tools/verify-stream-timing-build.mjs
```

Before cleanup, the verifier reached its final PWA-presence assertion and failed because dist/sw.js was absent. After cleanup, the same verifier exited 0 and reported BUNDLE_TIMING_VERIFIED: Live365=55, AzuraCast metadata=2, unknown=15, with PWA generated. Both outcomes are retained; the previous failure was never converted to success.

Historical evidence: .native-validation/1b04b/build-384.log, build-384.json and artifacts.json. Successful resumed evidence: build-after-cleanup.log/json, reports/timing-after-cleanup-command.json, logs/timing-after-cleanup.log, syntax command records and artifacts-after-cleanup.json. The resumed build used the same command above and recorded exit 0, signal null; the verifier and generated-file syntax checks each recorded exit 0. No exit code was suppressed or converted.

## E. Vite/PWA artifact verification

| Artifact/check | Result |
| --- | --- |
| Vite modules | 814 transformed; chunks emitted |
| Main bundle | /assets/index-D7HuKI8n.js; 946,943 bytes |
| Main SHA-256 | 119289e4a9187110a38380999aa4d5d76b157bb115736f9d068ab3112559f7ba |
| index.html | Present, references expected main bundle |
| manifest.webmanifest | Present, parses as JSON; referenced icons exist |
| registerSW.js | Present |
| sw.js | Present after cleanup; node --check exits 0 |
| workbox-*.js | workbox-080c8b91.js present; node --check exits 0 |
| Generated precache | All 16 entries resolve to existing output files |
| Approved listener URL | Live365 endpoint present |
| Direct AzuraCast listener /listen/ or /hls/ URL | Absent from emitted main listener bundle |
| Nonfunctional validation URL/key fixtures | Absent |
| Private-key/server-key patterns | No matching private key, AWS access-key or Stripe-secret patterns found; emitted JWTs do not declare service_role |

Public anon client configuration is expected to be embedded by Vite; it is not treated as a private server credential. Values are withheld. Pattern checks are scoped evidence, not proof of every possible secret absence. The main bundle retains the pre-existing large-chunk warning; it is not the fatal failure.

**The new complete build and PWA artifacts are accepted for local web-build verification only.** The build regenerated sw.js and the Workbox runtime; none was copied from an older run. Earlier partial artifacts were rejected. Successful local web output is not an installable iPhone artifact. No Capacitor sync, CocoaPods install, Swift execution, Xcode archive or signing occurred.

## F. Tests, source manifest and preservation

The focused regression repeat uses one test-file process at a time to reduce local resource overlap:

```powershell
node --test --test-concurrency=1 --test-reporter=dot `
  tests/native-audio.test.mjs tests/native-routing.test.mjs `
  tests/live365-distribution.test.mjs tests/native-ci-preparation.test.mjs `
  ci/native-validation/runner.test.mjs ci/ios-release/release.test.mjs
```

The pre-cleanup repeat exited 1: 15 tests passed and 18 esbuild-backed tests failed to start their build service with spawn UNKNOWN (errno -4094). This is an infrastructure failure before those application assertions, not a valid all-tests-pass result. The preceding 1B.04A milestone passed the same 33 tests, but that historical result does not replace a successful current repeat. No tested implementation changed here. That attempt passed the release branch/runtime/YAML/inventory checks and other checks not requiring esbuild service startup. After cleanup, the same serialized suite passed all 33 tests with exit 0, zero failures and zero skips. Captured evidence is logs/tests-after-cleanup.log and reports/tests-after-cleanup-command.json.

The additional report increases the release inventory from 364 to 365 entries, excluding the manifest itself. This refresh does not change any code under test or claim a complete web/PWA pass. The original validated manifest stays unchanged as historical evidence. Earlier host samples remained insufficient at about 51 MiB and then 117 MiB commit headroom, so builds were held. The October 31 resumed build started only after the user confirmed cleanup and Windows metrics demonstrated recovered commit capacity.

All nine other worktrees were confirmed to retain their captured HEAD, status and tracked/untracked source hashes. The release worktree retains its prior proposal byte-for-byte except for the manifest refresh and this report. HEAD remains the baseline and the index stays unstaged. The completion record below states actual results, not a prospective claim.

## G. Remaining blockers

1. The local resource/PWA blocker is cleared by the successful resumed build, but low free physical RAM remains an operating constraint. Recheck capacity and serialize future heavy runs; this result does not promise success under renewed commit pressure.
2. Complete exit-zero build, generated sw.js/Workbox runtime, full emitted verifier and valid artifact inventory were obtained. Partial output remains unacceptable.
3. Original release gates remain: independent Codemagic evidence reconciliation; approved future public-input delivery; reviewed release source commit; signing/account/version/minimum-OS requirements; installable-device acceptance; and Live365/third-party rights evidence.
4. A change to shared application/PWA configuration would require separate approval. None is currently justified.

## H. GO / NO-GO recommendation

**GO for accepting the local web/PWA build and reviewing the uncommitted release-preparation proposal, subject to the final test/manifest record below. NO-GO for unapproved native/archive/provider actions, signing or distribution.** The local blocker is resolved; independent native release gates remain.

Next action requiring explicit authorization: one local release-preparation commit after review of the complete eight-file proposal and its source manifest. This task does not authorize that commit. No push, provider action, Codemagic build, signing, archive, export or upload is included. Any later remote or native execution requires separate approval.

## I. Changed-file inventory

Relative to the preserved 1B.04A proposal:

- New: docs/PULSE-fix-1B.04B-web-build-remediation.md.
- Updated metadata only: ci/ios-release/source-manifest.json.
- Ignored diagnostic evidence only: .native-validation/1b04b/.

All prior seven proposal files remain present and uncommitted. No commit, push, merge, rebase, production configuration change, deployment, signing, archive, upload or provider action occurred.

### Completion record

Resolved October 31, 2026 after user-confirmed memory cleanup and measured 2,018 MiB commit headroom. One build/test run at a time:

- Complete real Vite/PWA build: exit 0, signal null; 814 modules, generated sw.js and workbox-080c8b91.js, 16 precache entries.
- Full emitted timing/PWA verifier: exit 0; Live365=55, AzuraCast metadata=2, unknown=15. All 16 precache assets exist.
- Generated service-worker and Workbox runtime syntax checks: exit 0 each.
- Focused native/release regressions: 33 passed, zero failed/skipped; suite exit 0. Earlier infrastructure failures remain recorded rather than erased.
- Emitted listener/placeholder/private-credential pattern checks: pass within their stated scope. No public or private credential values were printed.
- Release manifest: 365 source entries, with this final report hash refreshed and complete candidate inventory verified. No staged files or commit.
- Preservation: all nine other worktrees retain their HEAD, status and tracked/untracked source hashes; release HEAD remains 1c3ebb18eee5151c47d844ea97100651624c98e6 and its prior seven-file proposal is unchanged except for authorized manifest metadata.
- No application/shared PWA configuration, dependency, native audio, OS/pagefile or workflow code change was necessary. No push, deployment, signing, archive, upload or Codemagic action occurred.

Final recommendation: GO for review and separately authorized local release-preparation commit. The memory/PWA blocker is cleared. Signing, native archive execution, TestFlight and production release remain outside authorization and subject to the prior readiness gates.
