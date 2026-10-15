# Phase 4C.2 targeted release remediation

October 14, 2026; `feature/truevoice-pulse`; HEAD remains
`27dea31e5f95c89fadc22d7cd7b3d2855d210d8e`. All Phase 4C changes remain
uncommitted. This report supersedes the Workbox release blocker in the preceding
readiness review, without claiming native/device release readiness.

## Workbox outcome

Implemented the minimum published supported parent patch: workbox-build 7.4.0
to 7.4.1, with matching workbox-window/runtime modules 7.4.1. Existing
vite-plugin-pwa 1.2.0 declares ^7.4.0 for build/window and accepts Vite 7; installed
Vite remains 7.3.7. Node >=20 meets Workbox's requirement (local Node is 24.14.0;
Vite already requires ^20.19.0 or >=22.12.0). Package.json is byte-identical to the
start of this pass. No overrides or new direct dependencies were introduced.

The old chain was vite-plugin-pwa 1.2.0 → workbox-build 7.4.0 →
@rollup/plugin-terser 0.4.4 → serialize-javascript 6.0.2. The new supported chain
uses Workbox 7.4.1 → Terser plugin 1.0.0 → serializer 7.1.2, clearing:

- GHSA-5c6j-r48x-rmvq, serializer code injection via RegExp/Date hooks.
- GHSA-qj8w-gfj5-8c6v, serializer CPU exhaustion via crafted array-like objects.
- The inherited workbox-build and @rollup/plugin-terser audit package flags.

Workbox itself changes Rollup plugins, templating and its worker bundler in this
patch. The supported upgrade removed obsolete bundled Rollup 2 and associated
plugin copies. Required related lock resolutions are listed precisely in the
appendix; no application/PWA configuration was edited.
[Workbox release notes](https://github.com/GoogleChrome/workbox/releases/tag/v7.4.1)

## Audit results

| Actual project audit | At start of 4C.2 | After Workbox patch |
| --- | --- | --- |
| Production | 8 moderate; 0 high/critical | 8 moderate; 0 high/critical |
| Full | 17: 1 critical, 4 high, 12 moderate | 14: 1 critical, 3 high, 10 moderate |

Counts are affected package entries, not independent advisories. Actual full
results still contain the native asset tooling chain; do not replace these counts
with the exclusion-model results below. Both actual audits exit 1 for remaining
findings. No audit suppression or force fix was used.

Remaining production entries: firebase-admin 13.10.0, @google-cloud/firestore
7.11.6, @google-cloud/storage 7.22.0, google-gax 4.6.1, gaxios 6.7.1,
retry-request 7.0.2, teeny-request 9.0.0 and uuid 9.0.1. They inherit the single
uuid advisory. Other full-tree entries are @capacitor/assets 3.0.5 (high), nested
@capacitor/cli 5.7.8 (high), Sharp 0.32.6 (high), tar 6.2.1 (critical),
@trapezedev/project 7.1.10 and xcode 3.0.1 (moderate); uuid also has the tooling
7.0.3 resolution. The prior report retains their complete advisory inventory.

## PWA verification

Production build passed and generated `dist/sw.js` and
`dist/workbox-77d36791.js`; the prior helper was `workbox-65c92adb.js`. The 13
precache entries, their revisions and the application JS/CSS asset hashes match
the pre-upgrade build. Manifest and registration script are byte-identical.
The helper hash change is expected for the updated runtime; it is not disabling
the worker or suppressing caching.

Before/after generated worker declarations were executed and compared, proving
equivalent configured routing, activation and caching policy:

- skipWaiting, clientsClaim and outdated-cache cleanup retained.
- SPA navigation fallback remains /index.html; /api/ and /yt-embed.html remain
  excluded. The built bridge matches public/yt-embed.html byte-for-byte.
- LIVE365 remains GET NetworkOnly, without a stream cache.
- AzuraCast metadata remains GET NetworkFirst in azuracast-api with 30-second
  expiry.
- Google Fonts remain CacheFirst, 10 entries / one-year expiry.
- Images remain StaleWhileRevalidate, 60 entries / 30-day expiry.
- YouTube embed URLs receive no new runtime cache route.

New tests verify generated worker declarations and precache files, navigation
exclusion, registration, serializer sanitization/rejection, bounded array-like
serialization and native asset references. The array-like regression runs in an
isolated child with a deadline so an old vulnerable implementation cannot hang
the entire test runner.

These are artifact/configuration-policy checks. Browser CacheStorage behavior,
real offline navigation, installed-PWA updates, iOS suspension/audio recovery and
physical device behavior were not tested here. Those remain release validations;
this report does not present stubbed Workbox registration as a live browser test.

## Native tooling: precise blocker and exclusion evidence

Latest published @capacitor/assets is still 3.0.5. It pins Sharp 0.32.6 exactly,
requires CLI ^5.3.0, and uses @trapezedev/project ^7.0.10. Its resolved chain is:

```text
@capacitor/assets 3.0.5
  sharp 0.32.6 (vulnerable libvips/libheif/librsvg decoders)
  @capacitor/cli 5.7.8 -> tar 6.2.1 (extraction/parse findings)
  @trapezedev/project 7.1.10 -> xcode 3.0.1 -> uuid 7.0.3
```

No supported parent patch clearing this chain was found. Sharp >=0.35.5 and tar
>=7.5.21 fall outside those contracts; latest project/xcode still retain uuid 7.
Updating the project's direct CLI 7.6.9 cannot repair the separate nested CLI 5.
The direct CLI already uses patched tar 7.5.22. No forced child override, native
SDK major change, tool removal, asset regeneration or platform configuration
change was performed. [Native generator](https://github.com/ionic-team/capacitor-assets)

Execution evidence:

- The documented developer regeneration command in NATIVE_APP_SETUP.md uses
  capacitor-assets; it invokes Sharp on icon/splash inputs. This remains an exposed
  local tooling path when run, especially for untrusted image/SVG inputs.
- Codemagic currently runs npm ci, npm run build, npx cap sync ios and native
  packaging. It does not explicitly invoke capacitor-assets or nested CLI 5.
  npm ci still installs the generator and may run package lifecycle scripts, so
  lack of an explicit generation step is not proof of safe install-time execution.
- Existing iOS catalogs and Android resource files are checked into Git. Tests
  verify referenced iOS icon/splash files, the 1024×1024 iOS icon, all six density
  launcher/foreground/background/round PNG sets, adaptive XML references and
  stored splash. The inspected native resource trees contain 66 tracked files.
  Catalog and manifest references consume these assets; cap sync is not an icon
  generator. No images/project files were modified.

An **isolated temporary release-lock model**, not the actual project, removed
only the direct @capacitor/assets declaration and recalculated a lock without
installing packages or running lifecycle scripts. Its full audit reports **8
moderate, 0 high, 0 critical**. It removes 117 package entries and materializes six
optional Tailwind WASI metadata entries; no surviving package version changes.
The affected assets/nested CLI/tar/Sharp/xcode chain disappears, while existing
Vite/PWA/runtime/direct Capacitor package versions are retained. The temporary
model is not committed, installed, used for a build or applied to CI.

This establishes dependency exclusion feasibility for a release that consumes
the existing reviewed assets. It is not proof of native compilation/signing or a
replacement generator for future art changes. The canonical tooling is retained
because no safe regeneration replacement has been demonstrated.

A safe future exclusion workflow would:

1. Use a separately reviewed release-only checkout/manifest/lock excluding assets,
   not a global npm --omit=dev (which would remove required Vite/Capacitor tools).
2. Preserve approved application/build/native dependency versions and verify both
   audit scopes. Inspect optional-platform metadata and run a fresh CI install.
3. Consume reviewed, tracked assets from the same source revision; run the resource
   checks before cap sync and verify resource digests remain unchanged afterward.
4. Build/archive iOS and Android on their actual toolchains and verify icons, splash,
   adaptive resources and signed package behavior on physical devices.
5. Keep asset regeneration out of privileged release jobs. Before new artwork is
   generated, provide and validate a maintained replacement workflow or supported
   upstream update. Do not fetch the vulnerable generator ad hoc with npx in CI.

This exclusion is documented, not enforced. No release-specific manifest or CI
configuration was added. **Native tooling remains an unresolved release blocker**
until a supported replacement/update or validated exclusion is applied. Trusted
inputs and a dev-only label do not eliminate the vulnerability.

## Conditional temporary uuid risk acceptance

Per the Phase 4C.2 instruction, retain Firebase 13.10.0 and its current API. Accept
GHSA-w5hq-g745-h8pq conditionally for this remediation scope; it remains present
in both audits. This is not a clean-audit claim or acceptance of native Sharp/tar
risks. No external security owner or release waiver is invented here.

Current paths:

```text
firebase-admin 13.10.0 -> optional Firestore 7.11.6 -> google-gax 4.6.1 -> uuid 9.0.1
firebase-admin 13.10.0 -> optional Storage 7.22.0 -> gaxios 6.7.1 -> uuid 9.0.1
Storage 7.22.0 -> retry-request 7.0.2 -> teeny-request 9.0.0 -> uuid 9.0.1
Storage 7.22.0 -> teeny-request 9.0.0 -> uuid 9.0.1
assets 3.0.5 -> project 7.1.10 -> xcode 3.0.1 -> uuid 7.0.3
```

The advisory concerns v3/v5/v6 output into caller-provided undersized buffers or
invalid offsets. Inspected Google multipart/ID helpers and xcode use v4() without
those arguments. TrueVoice itself has no direct uuid calls. Its Firebase path is
authenticated FCM messaging in api/push/send.js, not Firestore/Storage calls;
Firebase's inspected getters load optional products lazily. Direct credentials
use auth-library 10.9.1/gaxios 7.3.1, outside the uuid 9 branch.
[uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq)

Remaining uncertainty: not every third-party internal caller, future feature or
deployed function bundle has been dynamically traced. Installed vulnerable APIs
remain available, and upstream implementation changes can invalidate the bounded
source inspection.

Controls/conditions:

- Retain the reviewed lock and existing admin authentication; keep this decision
  visible in release review rather than suppressing npm audit output.
- Do not add Firestore/Storage use, direct v3/v5/v6 buffer APIs or user-controlled
  buffer/offset behavior without reassessment.
- Reassess on dependency updates, backend/native feature changes, new advisory
  information, evidence of a vulnerable call, or the next release security review.
- Process only reviewed asset/project inputs in any interim tooling use; do not
  interpret uuid acceptance as authorization for unsafe native asset processing.

Planned separate task: evaluate Firebase 14.5.0 with modular app/messaging APIs,
Node >=22, a verified Storage 8.4.0-or-newer permitted resolution and newer Google
parents. Storage 8.1/8.2 alone retain gaxios 6/uuid 9. Preserve credentials,
verifyAdmin, warm-instance initialization and multicast/dead-token cleanup;
validate FCM and native delivery before adoption. No Firebase migration, API
change, environment or production infrastructure change is part of this pass.

## Validation, file scope and remaining gates

- All focused PULSE tests and dependency/release-security regressions: 47 pass.
- Production/PWA build passes with 13 precache entries and correct emitted worker.
- Targeted ESLint, dependency consistency (`npm ls --all`: no problems), tracked
  diff whitespace checks and new-file whitespace checks pass.
- Actual production/full audits run; results are reported above, with known
  remaining failures. The exclusion-model audit is reported separately.
- Package.json and protected PWA/Capacitor/CI/Firebase/bridge source/config hashes
  match the start of 4C.2. All prior Phase 4C.1 upgrades remain preserved.
- Existing main-bundle warning remains (approximately 941 kB / gzip 281 kB).
  The prior outdated Browserslist warning is absent.

Changed by this pass: package-lock.json; docs/PULSE-Phase4C1-dependency-readiness.md
(latest-status link); this report; tests/pulse-release-security.test.mjs.

Complete cumulative uncommitted Phase 4C file list:

- package.json (Phase 4C.1 direct declarations, unchanged in 4C.2).
- package-lock.json (4C.1 updates plus the 4C.2 supported Workbox patch).
- docs/PULSE-Phase4C1-dependency-readiness.md.
- docs/PULSE-Phase4C2-release-remediation.md.
- tests/pulse-dependency-security.test.mjs (unchanged in 4C.2).
- tests/pulse-release-security.test.mjs.

Existing Claude outputs remain untouched/untracked. Generated dist files and
temporary exclusion/snapshot data are not included. No unrelated application
source, native project/resource, LIVE365/AzuraCast/queue/bridge or CI files changed.

Workbox's audited dependency blocker is resolved. Native generator remediation or
validated release exclusion remains blocked by the unsupported old parent chain
and lack of an established replacement/actual native packaging validation.
Physical Safari/Capacitor playback, PWA lifecycle/offline checks and native signed
packaging remain release gates. Conditional uuid acceptance does not remove its
remaining vulnerability. No commit, push, merge, deployment or MY PULSE work.

## Exact Phase 4C.2 lockfile changes

The following table compares the final lockfile with the preserved uncommitted
4C.1 lockfile at the start of this pass (not the earlier committed baseline).

| Lockfile entry | Before | After |
| --- | --- | --- |
| node_modules/@rollup/plugin-babel | not present | 6.1.0 |
| node_modules/@rollup/plugin-node-resolve | 15.3.1 | 16.0.3 |
| node_modules/@rollup/plugin-replace | not present | 6.0.3 |
| node_modules/@rollup/plugin-terser | 0.4.4 | 1.0.0 |
| node_modules/@rollup/pluginutils | 5.3.0 | 5.4.0 |
| node_modules/@surma/rollup-plugin-off-main-thread | 2.2.3 | removed |
| node_modules/@surma/rollup-plugin-off-main-thread/node_modules/magic-string | 0.25.9 | removed |
| node_modules/@trickfilm400/rollup-plugin-off-main-thread | not present | 3.0.0-pre1 |
| node_modules/call-bind | 1.0.8 | 1.0.9 |
| node_modules/es-abstract | 1.24.1 | 1.24.2 |
| node_modules/es-abstract-get | not present | 1.0.0 |
| node_modules/es-object-atoms | 1.1.1 | 1.1.2 |
| node_modules/es-to-primitive | 1.3.0 | 1.3.4 |
| node_modules/eta | not present | 4.6.0 |
| node_modules/filelist | 1.0.4 | 1.0.6 |
| node_modules/function.prototype.name | 1.1.8 | 1.2.0 |
| node_modules/is-document.all | not present | 1.0.0 |
| node_modules/own-keys | 1.0.1 | 1.0.2 |
| node_modules/randombytes | 2.1.0 | removed |
| node_modules/safe-array-concat | 1.1.3 | 1.1.4 |
| node_modules/serialize-javascript | 6.0.2 | 7.1.2 |
| node_modules/side-channel | 1.1.0 | 1.1.1 |
| node_modules/side-channel-list | 1.0.0 | 1.0.1 |
| node_modules/smob | 1.6.1 | 1.6.2 |
| node_modules/sourcemap-codec | 1.4.8 | removed |
| node_modules/string.prototype.matchall | 4.0.12 | 4.1.0 |
| node_modules/string.prototype.trim | 1.2.10 | 1.2.11 |
| node_modules/string.prototype.trimend | 1.0.9 | 1.0.10 |
| node_modules/typed-array-byte-offset | 1.0.4 | 1.0.5 |
| node_modules/typed-array-length | 1.0.7 | 1.0.8 |
| node_modules/which-typed-array | 1.1.20 | 1.1.24 |
| node_modules/workbox-background-sync | 7.4.0 | 7.4.1 |
| node_modules/workbox-broadcast-update | 7.4.0 | 7.4.1 |
| node_modules/workbox-build | 7.4.0 | 7.4.1 |
| node_modules/workbox-build/node_modules/@rollup/plugin-babel | 5.3.1 | removed |
| node_modules/workbox-build/node_modules/@rollup/plugin-replace | 2.4.2 | removed |
| node_modules/workbox-build/node_modules/@rollup/pluginutils | 3.1.0 | removed |
| node_modules/workbox-build/node_modules/@types/estree | 0.0.39 | removed |
| node_modules/workbox-build/node_modules/estree-walker | 1.0.1 | removed |
| node_modules/workbox-build/node_modules/magic-string | 0.25.9 | removed |
| node_modules/workbox-build/node_modules/picomatch | 2.3.2 | removed |
| node_modules/workbox-build/node_modules/rollup | 2.80.0 | removed |
| node_modules/workbox-cacheable-response | 7.4.0 | 7.4.1 |
| node_modules/workbox-core | 7.4.0 | 7.4.1 |
| node_modules/workbox-expiration | 7.4.0 | 7.4.1 |
| node_modules/workbox-google-analytics | 7.4.0 | 7.4.1 |
| node_modules/workbox-navigation-preload | 7.4.0 | 7.4.1 |
| node_modules/workbox-precaching | 7.4.0 | 7.4.1 |
| node_modules/workbox-range-requests | 7.4.0 | 7.4.1 |
| node_modules/workbox-recipes | 7.4.0 | 7.4.1 |
| node_modules/workbox-routing | 7.4.0 | 7.4.1 |
| node_modules/workbox-strategies | 7.4.0 | 7.4.1 |
| node_modules/workbox-streams | 7.4.0 | 7.4.1 |
| node_modules/workbox-sw | 7.4.0 | 7.4.1 |
| node_modules/workbox-window | 7.4.0 | 7.4.1 |
