# PULSE Fix 1B.04G - Public Runtime Group Integration

Local proposal on release/ios-testflight-1b04, starting at a33f4210cc6894c3467fcf93ad7ec16694a2f6cc. No commit, push, provider configuration or build execution is authorized by this preparation.

## Change

Only ios-release-archive-validation's environment receives:

```yaml
groups:
  - pulse_ios_public_runtime
```

Xcode 26.2, Node 24.14.0 and CocoaPods 1.16.2 remain pinned. All scripts, runtime fingerprint/anon-role guards, source validation, native implementation and unsigned archive checks are unchanged. The existing validation workflow and legacy distribution workflows are unchanged. No triggers, publishing, signing integration, credential profiles, IPA export or TestFlight commands are added.

The workflow-isolation regression now permits exactly this group at exactly the release environment location and rejects other group imports. It also asserts all three toolchain versions. This updates the test's former blanket group prohibition without relaxing runtime or unsigned-build checks.

## Exact file inventory

- codemagic.yaml: two-line release-only environment group import.
- ci/ios-release/release.test.mjs: exact group/location and preserved-version assertions.
- ci/ios-release/source-manifest.json: refreshed hashes, phase metadata and this report's inventory entry.
- docs/PULSE-fix-1B.04G-public-runtime-integration.md: this report.

The release manifest contains 366 entries, excluding itself (367 candidate source files). No environment file, actual anon JWT, generated build artifact or signing material is copied into source. This task does not read the local public key.

## Validation and remaining approval

Offline regression suite: 33 passed, zero failed/skipped, exit 0. Parsed YAML comparison confirms that removing only the new group import restores the exact baseline configuration. Security-pattern checks and the source inventory pass. A disposable alternate Git index is used for staged-byte verification; the user's actual index remains untouched and the temporary index is removed. No commit or ref change is made.

The hosted pulse_ios_public_runtime group must exist and contain only VITE_SUPABASE_URL and the exact approved VITE_SUPABASE_ANON_KEY. Its contents are not created or inspected in this local task. The existing runtime fingerprint remains authoritative; missing, incorrect, unexpected or private/signing inputs continue to fail closed. Source inspection cannot certify the contents of an unseen hosted group. A future actual run still requires separately approved provider configuration, source publication and manual execution.

The proposed workflow remains manual and unsigned archive-only, with sanitized text/JSON artifacts and no upload path. Local tests do not establish an actual native archive, signing or iPhone behavior.

Completion: 33 tests passed; YAML/security/source checks passed; 366 manifest entries (367 candidate files) are verified. Proposed staged-byte verification uses a disposable alternate index, checks every blob against the exact reviewed bytes, and verifies that the real index is unchanged. The alternate index is removed after verification. Final command evidence is ignored under .native-validation/1b04g/. No signing/publishing/TestFlight path was added: all original runner commands and guards remain byte-identical. No .env.local or actual anon JWT was read or copied by this task. No commit, push, Codemagic run, signing, native archive, deployment or upload occurred. The real index remains unstaged; present this four-file proposal for approval.
