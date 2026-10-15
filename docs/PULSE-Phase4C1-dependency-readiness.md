# Phase 4C.1 dependency readiness

October 14, 2026. Branch `feature/truevoice-pulse`, starting HEAD
`27dea31e5f95c89fadc22d7cd7b3d2855d210d8e`. Changes remain uncommitted.

Latest status: [Phase 4C.2 release remediation](PULSE-Phase4C2-release-remediation.md)
implements the supported Workbox patch and documents conditional uuid acceptance
and the native exclusion model. The audit inventory, proposed Workbox gate and
lockfile appendix below describe the earlier Phase 4C.1 snapshot; the 4C.2 report
supersedes that Workbox gate and records current audit results.

## Outcome and audit comparison

Targeted compatible updates remove the audited Router and ws findings and most
development-tooling findings. No PULSE source, YouTube bridge, LIVE coordination,
Capacitor configuration/platform project, backend code, environment variables,
Supabase policies or production infrastructure changed.

| Audit | Before | After |
| --- | --- | --- |
| Production (`npm audit --omit=dev`) | 3 high, 8 moderate; 11 total | 0 high/critical, 8 moderate; 8 total |
| Full (`npm audit`) | 1 critical, 21 high, 15 moderate, 1 low; 38 total | 1 critical, 4 high, 12 moderate, 0 low; 17 total |

Counts are affected package entries, including ancestor packages inheriting a
finding, not independent exploits. Both final audits exit 1 because findings
remain. The Phase 4B report's 3 high/13 moderate production count is historical;
the fresh pre-change audit already reported 3 high/8 moderate. Do not attribute
that registry/reporting difference to this patch. No audit fix/force, overrides,
new direct runtime dependencies, broad SDK major upgrade or audit suppression
was used. Registry metadata and audit results can change after this date.

## Implemented package changes

| Direct declaration | Previous declaration / installed | New declaration / installed |
| --- | --- | --- |
| react-router-dom | ^7.13.2 / 7.13.2 | ^7.18.4 / 7.18.4 |
| vite (development) | ^7.1.7 / 7.2.2 | ^7.3.7 / 7.3.7 |
| postcss (development) | ^8.5.6 / 8.5.6 | ^8.5.30 / 8.5.30 |
| baseline-browser-mapping (development) | ^2.9.14 / 2.9.14 | ^2.11.28 / 2.11.28 |

Matched transitive react-router is 7.18.4. ws changed from 8.20.0 to 8.22.0 solely
through the lockfile, within installed @supabase/realtime-js 2.101.1's ^8.18.2
range. Supabase itself is unchanged. Router's React >=18 and Node >=20 requirements
remain compatible with installed React 19 and local Node 24.14.0. Vite's Node
^20.19.0 or >=22.12.0 requirement is unchanged, and existing React/PWA plugin peer
ranges accept Vite 7. Vite requires the esbuild 0.28.2 resolution and its matching
platform binaries; this is its supported dependency, not a compiler override.

The explicit tooling refresh targeted @babel/core,
@babel/plugin-transform-modules-systemjs, @humanfs/node, ajv,
baseline-browser-mapping, brace-expansion, browserslist, fast-uri, flatted,
js-yaml, lodash, minimatch, picomatch and rollup. Resolutions stay within existing
parent ranges, including separate legacy/newer branches. Babel helper updates,
Browserslist data and platform binary entries follow those dependency edges.
A second brace-expansion refresh patched its remaining 1.x copy after minimatch
resolution changed. The appendix lists exact lockfile version changes and added
entries; dependency moves/metadata are reviewable in the lockfile diff.

Commands used: targeted `npm install` and named `npm update`, with
`--ignore-scripts --no-audit --no-fund`; no wholesale update. `npm ls --all --json`
reports no dependency problems. Existing installed Firebase, Capacitor parent
packages, React, Tailwind, Supabase and vite-plugin-pwa versions remain unchanged.

## React Router: advisory applicability and compatibility

The app uses createRoot + BrowserRouter/Routes, not Router Framework Mode, server
loaders/actions, RSC, __manifest, single-fetch or SSR hydration. Existing tests
cover actual routes, query consumption, history, EXPLORE selection and queue
navigation. There is no migration to Router 8 or data/framework mode.

| Advisory (linked primary report) | Audited affected range | Trigger / assessment here |
| --- | --- | --- |
| [49rj-9fvp-4h2h](https://github.com/advisories/GHSA-49rj-9fvp-4h2h) | >=7.0.0 <=7.14.1 | Constructor deserialization/RCE in Framework Mode; that server path is absent |
| [8x6r-g9mw-2r78](https://github.com/advisories/GHSA-8x6r-g9mw-2r78) | >=7.0.0 <7.15.0 | Unbounded __manifest expansion; endpoint absent |
| [rxv8-25v2-qmq8](https://github.com/advisories/GHSA-rxv8-25v2-qmq8) | >=7.0.0 <7.14.0 | Reflected single-fetch input DoS; server pipeline absent |
| [84g9-w2xq-vcv6](https://github.com/advisories/GHSA-84g9-w2xq-vcv6) | >=7.12.0 <7.15.1 | PUT/PATCH/DELETE document-action CSRF; Router server actions absent |
| [wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) | >=6.0.0 <7.18.0 | Backslash redirect through Link/useNavigate; relevant client API, but inspected app destinations are fixed internal paths or encoded IDs, not arbitrary user URL destinations |
| [h8fp-f39c-q6mh](https://github.com/advisories/GHSA-h8fp-f39c-q6mh) | >=7.11.0 <7.18.0 | RSC error-handler protocol validation/XSS; RSC absent |
| [337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg) | >=6.4.0 <7.18.0 | SSR error hydration constructor injection; SSR hydration absent |
| [chx6-hx7r-mcp5](https://github.com/advisories/GHSA-chx6-hx7r-mcp5) | >=7.0.0 <7.18.0 | Inefficient server route matching DoS in Framework Mode; that server absent |
| [2j2x-hqr9-3h42](https://github.com/advisories/GHSA-2j2x-hqr9-3h42) | >=7.0.0 <7.14.1 | Server redirect reinterpretation to protocol-relative URL; no Router loader/action redirects found |
| [qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) | >=7.12.0 <7.18.2 | Unstable RSC action CSRF; RSC absent |

All are absent from the final audit at 7.18.4. This removes vulnerable dependency
versions without claiming the prior client app had reachable server RCE.
The v7.18 CSRF host-check change matters to server adapters/reverse proxies, which
this app does not use. [Router changelog](https://reactrouter.com/changelog)

## ws: real trigger and security regressions

[GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx)
affects >=8.0.0 <8.20.1: multi-byte TypedArray close reasons can disclose
uninitialized bytes. [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p)
affects >=8.0.0 <8.21.0: a connected peer can exhaust structural memory through
tiny fragments/chunks despite a payload limit. 8.22.0 clears both.

These concern Node ws, not browsers' native WebSocket. Installed Supabase runtime
detection prefers native WebSocket; explicit custom ws transport is a separate
Node path. No public application WebSocket server or app-provided ws transport
was found. Patching is still useful for the dependency and future Node use.
New isolated loopback tests verify rejection of multi-byte close reasons,
complete supported byte-view transmission, fragment-count enforcement and an
unchanged Supabase RealtimeClient connecting/disconnecting through patched ws.
No production Supabase request, channel write, notification or database operation
was performed. This is transport compatibility evidence, not a live chat test.

## Google/Firebase uuid: remaining production finding

Installed chain:

```text
firebase-admin 13.10.0
  optional @google-cloud/firestore 7.11.6 -> google-gax 4.6.1 -> uuid 9.0.1
  optional @google-cloud/storage 7.22.0
    -> gaxios 6.7.1 -> uuid 9.0.1
    -> retry-request 7.0.2 -> teeny-request 9.0.0 -> uuid 9.0.1
```

An additional uuid 7.0.3 copy belongs to xcode/native asset tooling, not this
production chain. google-auth-library 9.15.1, gcp-metadata 6.1.1 and gtoken 7.1.0
also depend on gaxios 6, but are not separate entries in this fresh audit.
Firebase's direct google-auth-library 10.9.1 uses gaxios 7.3.1, which has no uuid
dependency. Ancestor flags do not mean every Firebase feature is vulnerable.

[GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
flags uuid <11.1.1 and affects v3/v5/v6 with caller-supplied undersized buffers or
invalid offsets. The inspected Google and xcode call sites use v4() without a
buffer. Application code has no direct uuid use; `api/push/send.js` initializes
Firebase credentials and uses messaging, not Firestore/Storage APIs. No matching
exploit path was identified in those inspected calls. That is a bounded reachability
assessment, not proof about all code paths or an audit waiver.

All eight remaining production entries inherit this single advisory:
firebase-admin (direct), @google-cloud/firestore, @google-cloud/storage,
google-gax, gaxios, retry-request, teeny-request and uuid (transitive).

Registry review confirms Firebase 13.10.0 is the latest 13.x release and its
optional ranges are Firestore ^7.11.0 and Storage ^7.19.0; installed 7.11.6 and
7.22.0 are their latest 7.x releases. google-gax/gaxios/teeny-request require
uuid ^9.0.x, excluding patched uuid 11+. An individual uuid override would violate
those ranges. Do not globally omit optional dependencies: native bundler binaries
also use optional dependencies, and omission does not remove lockfile audit flags.

The supported remediation candidate is a separately approved Firebase 14.5.0
migration using maintained parent ranges (Firestore ^9.1.0, Storage ^8.1.0,
google-auth-library ^11.1.0, jwks-rsa ^4.0.1). The final review below verifies that
Storage must resolve to a newer permitted release, such as 8.4.0: minimum 8.1.0
still retains gaxios 6/uuid 9. It requires Node >=22 and multiple parent-major
changes, including removal of the legacy namespace API. Local Node qualifies;
deployed runtime and SDK behavior were not verified. Assess credential handling,
FCM admin authorization, multicast results/dead-token cleanup, and physical iOS/
Android push before adopting. No Firebase upgrade was implemented.
[Firebase release notes](https://firebase.google.com/support/release-notes/admin/node)

## Tooling advisories resolved

These packages run during development/build, not inside the deployed static
PULSE player. Their exploit conditions still matter for developer/CI machines.
The fresh audit's advisory families and the inspected local configuration support
the following assessments; they are not a whole-CI trust-boundary audit.

| Family / previous versions | Advisory IDs (GHSA-) | Trigger and applicability |
| --- | --- | --- |
| Babel core 7.28.5 / SystemJS transform 7.29.0 | 4x5r-pxfx-6jf8; fv7c-fp4j-7gwp | Untrusted source-map comments/file reads or malicious compiler input; build-only, app does not provide a public compilation service |
| humanfs/node 0.16.7 | p498-v437-472g | Recursive copy of attacker-controlled symlinked trees; lint/tooling, not a runtime file-copy endpoint |
| ajv 6.12.6 | 2g4f-4pwh-qvx6 | ReDoS using $data and untrusted schemas/data; lint/build configuration, not a PULSE schema API |
| baseline-browser-mapping 2.9.14 | w5vr-8v7q-w6rv | Invalid mapping input terminates process; tooling inputs, not listener content |
| brace-expansion 1.1.12/2.0.2/5.0.2 | f886-m6hf-6m8v; jxxr-4gwj-5jf2; 3jxr-9vmj-r5cp; mh99-v99m-4gvg; rgw5-rvv9-x895; q2hr-2g5m-vwhr; qhr7-859c-m2p7; 6j4f-fj2g-mc7p | Crafted ranges/nesting/nonexpanding groups cause CPU, stack or allocation DoS; build/lint glob inputs, not a public glob service |
| browserslist 4.28.1 | c83g-rgw3-j3cx; 73wf-gq98-2v4g | Many query results or malicious custom stats cause memory growth/crash/prototype writes; build configuration boundary |
| fast-uri 3.1.0 | v2hh-gcrm-f6hx; 7p8r-x3mc-p8w7; q3j6-qgpj-74h6; v39h-62p7-jpjc; f65p-4m7j-42xc; jqff-g426-hqxp; 4c8g-83qw-93j6; qw65-cvwx-89v3; hrr3-gc8f-f4qj | Malformed URI normalization can defeat host/path checks; installed via build validator, not app URL routing or backend allowlist |
| flatted 3.3.3 | 25h7-pfq9-p65f; rf6f-7fwh-wjgh | Malicious serialized input causes recursion/prototype pollution; lint cache/tooling rather than a PULSE deserialization endpoint |
| js-yaml 4.1.0 | mh29-5h37-fv8m; h67p-54hq-rp68; 52cp-r559-cp3m; 5p4m-2wfm-xmqj; 2883-xcg3-v3hh | Crafted YAML merge/alias/omap inputs cause pollution or CPU exhaustion; project/build config, no public YAML parser |
| lodash 4.17.23 | r5fr-rjxr-66jc; f23m-r3pf-42rh | Attacker-controlled template import keys or unset/omit paths; build tooling, no corresponding app input path found |
| minimatch 3.1.2/5.1.6/10.2.0 | 3ppc-4f35-3m26; 7r86-cg39-jmmj; 23c5-xmqv-rm74 | Crafted wildcard/globstar/extglob patterns cause ReDoS; tooling globs |
| nanoid 3.3.11 | 28wg-ghj8-5hjv; 2v37-7h3g-55p8; xwg4-73v4-xw9w | Invalid sizes/custom generators cause loops or integer wrap; PostCSS build dependency, no user-selected generator sizes |
| picomatch 2.3.1/4.0.3 | 3v7f-55p6-f55p; c2c7-rcm5-vvqj | POSIX class method injection/incorrect matching or crafted extglob ReDoS; tooling patterns |
| postcss 8.5.6 | qx2v-qp2m-jg93; 6g55-p6wh-862q; fxqj-rqcc-2cmp; r28c-9q8g-f849 | Untrusted CSS/stringify or implicit source-map file access; no runtime CSS compilation, but protecting developer/CI reads is worthwhile |
| rollup 4.53.1/2.79.2 | mw96-cpmx-2vgc | Untrusted emitted output/source-map paths can escape output directory; bundler/plugin boundary |
| source-map-js 1.2.1 | 68fv-2mgg-jv7q | Crafted indexed section offsets cause event-loop DoS; build source-map input |
| vite 7.2.2 | 4w7w-66w2-5vf9; v2wj-q39q-566r; p9ff-h696-f583; v6wh-96g9-6wx3; fx2h-pf6j-xcff | Dev-server file access/fs.deny bypass and Windows editor UNC credential disclosure; not the deployed static bundle. Windows developer host makes mitigation relevant if server access is exposed |

Patched versions and required related updates are in the exact appendix. All
above families are absent from the final audit. Relevant primary detail:
[Vite Windows path advisory](https://github.com/advisories/GHSA-fx2h-pf6j-xcff),
[editor UNC advisory](https://github.com/advisories/GHSA-v6wh-96g9-6wx3),
[PostCSS map-read advisory](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp),
[Rollup path advisory](https://github.com/advisories/GHSA-mw96-cpmx-2vgc).
Complete individual reports are at `https://github.com/advisories/GHSA-<ID>`.

## Remaining tooling findings and blockers

| Installed chain | Severity / trigger | Decision |
| --- | --- | --- |
| @capacitor/assets 3.0.5 -> nested @capacitor/cli 5.7.8 -> tar 6.2.1 | tar critical; crafted archive hardlink/symlink paths, parser metadata, resource exhaustion and macOS reservation races. Ancestor assets/CLI entries are high | No fixed tar 6 release; assets is still latest 3.0.5 and requires CLI ^5.3.0. Do not force tar 7 or swap Capacitor major versions. Separate native-tooling remediation/acceptance required |
| @capacitor/assets -> sharp 0.32.6 | High inherited libvips/libheif/librsvg vulnerabilities processing hostile image/SVG input | assets pins this exact sharp version; patched sharp >=0.35.5 is outside its contract. Seek maintained assets replacement/upstream update, then regenerate/compare trusted assets on native CI |
| assets -> @trapezedev/project 7.1.10 -> xcode 3.0.1 -> uuid 7.0.3 | Moderate uuid chain; inspected xcode call is v4(), not buffer-based v3/v5/v6 | No audit-supported fix in this parent chain; no global uuid override |
| vite-plugin-pwa 1.2.0 -> workbox-build 7.4.0 -> @rollup/plugin-terser 0.4.4 -> serialize-javascript 6.0.2 | High serialization code injection with hostile RegExp/Date objects evaluated later, or crafted array-like CPU exhaustion; two ancestor entries are moderate | Workbox 7.4.1 is supported by the range but replaces Rollup 2 with 4, several Rollup plugin majors, templating and off-main-thread plugin. Treat as a separate PWA change with worker/lifecycle/device verification, not a trivial minifier override |

The full remaining package list is: @capacitor/assets, nested @capacitor/cli,
@google-cloud/firestore, @google-cloud/storage, @rollup/plugin-terser,
@trapezedev/project, firebase-admin, gaxios, google-gax, retry-request,
serialize-javascript, sharp, tar, teeny-request, uuid, workbox-build and xcode.
Only Firebase and assets are direct audited dependencies in that list. The
project's direct Capacitor CLI 7.6.9 uses patched tar 7.5.22; upgrading that direct
CLI again would not fix assets' separate CLI 5 copy.

Remaining advisory IDs, with their audit affected ranges:

- uuid: GHSA-w5hq-g745-h8pq (<11.1.1).
- serialize-javascript: GHSA-5c6j-r48x-rmvq (<=7.0.2), GHSA-qj8w-gfj5-8c6v (>=5.0.0 <7.0.5). A future maintained fix must resolve >=7.0.5.
- sharp: GHSA-f88m-g3jw-g9cj (<0.35.0), GHSA-rgj7-g3m4-5g8c (<0.35.4), GHSA-wq5f-xc86-pv6w (<0.35.5).
- tar: GHSA-34x7-hfp2-rc4v (<7.5.7), GHSA-8qq5-rm4j-mr97 (<=7.5.2), GHSA-83g3-92jg-28cx (<7.5.8), GHSA-qffp-2rhf-9h96 (<=7.5.9), GHSA-9ppj-qmqm-q256 (<=7.5.10), GHSA-r6q2-hw4h-h46w (<=7.5.3), GHSA-vmf3-w455-68vh (<=7.5.15), GHSA-w8wr-v893-vjvp (<=7.5.17), GHSA-23hp-3jrh-7fpw (<=7.5.18), GHSA-8x88-c5mf-7j5w (<=7.5.17), GHSA-gvwx-54wh-qm9j (<=7.5.16), GHSA-r292-9mhp-454m (<=7.5.20).

The app supplies trusted checked-in build configuration; no malicious serializer
object path was found. Asset tools are not production HTTP endpoints. These facts
reduce observed exposure but do not make critical/high tooling findings harmless
or justify claiming a clean audit. Do not process untrusted archives/assets or
untrusted build configuration with those unresolved toolchains.
[Serialization advisory](https://github.com/advisories/GHSA-5c6j-r48x-rmvq),
[tar traversal advisory](https://github.com/advisories/GHSA-34x7-hfp2-rc4v),
[sharp inherited advisory](https://github.com/advisories/GHSA-f88m-g3jw-g9cj).

## Validation and release implications

- All focused PULSE tests plus dependency-security regressions: 42 passed.
- New tests cover ws type safety/fragment limits, isolated Supabase transport,
  blocked implicit external PostCSS maps and explicit trusted map compatibility.
- Production/PWA build passes on Vite 7.3.7; generateSW precaches 13 entries.
  PULSE CSS output hash stayed unchanged during the compared builds.
- Targeted ESLint passes for Phase 4B implementation and the new security test.
- Full dependency tree reports no problems; diff whitespace checks pass.
- Main JS remains above 500 kB (about 941 kB / gzip 281 kB). The prior stale
  Browserslist warning no longer appears after the security-related data refresh.
- npm installs completed but reported Windows EPERM cleanup warnings for old
  esbuild/Rollup binaries held open. Resolved versions, tests and build pass;
  unused node_modules leftovers are untracked and not release artifacts. No
  unrelated process was terminated to remove them. No clean native build ran.

No assertion of fully cleared release readiness: production uuid requires either
documented reachability/risk acceptance or the approved Firebase modernization;
native critical/high asset tooling and PWA serializer findings require separate
remediation or explicit scoped risk acceptance. For Workbox, validate generated
worker activation, caching, bridge navigation exclusion, offline shell and physical
iOS lifecycle/audio behavior before release. For Firebase, validate runtime and
FCM/device delivery. No live push or production API testing was performed.

Hosted Safari/physical Capacitor playback remains a release gate from Phase 4B.
Shorts may still repeat without ENDED; manual Next guidance and the existing
player architecture are unchanged. Proxy rate limiting/quota monitoring is still
an independent infrastructure decision. No commit, push, merge, deployment or
MY PULSE work was performed; existing Claude outputs remain untouched/untracked.

## Final security review and release decision

This section supersedes the earlier tentative release discussion. No packages or
application/test code were changed during this final review. Audits rerun on
October 14, 2026 still report 8 moderate production package entries and 17 full
entries (1 critical, 4 high, 12 moderate). These map to **18 distinct GHSA
advisories**; inherited parent flags are not additional advisories. Severity below
is the registry advisory severity, which can differ from a displayed CVSS score.

Release classifications are recommendations awaiting owner approval, not enacted
controls or proof of exploitation:

- **Must remediate before production release:** Workbox's serializer chain; this
  includes native releases built from the same web/PWA pipeline.
- **Must remediate before native release:** applicable Sharp and nested-CLI tar
  findings, or approve and verify exclusion/replacement of the affected tools from
  release generation. This is a build-host/supply-chain gate, not a claimed
  vulnerability in the installed Capacitor application's runtime.
- **Acceptable temporarily with documented controls:** both uuid copies and
  their inherited parent entries. Acceptance itself needs approval; no waiver is
  implied by the absence of a demonstrated trigger.
- **Not applicable, with supporting evidence:** two tar API-specific triggers
  absent from the inspected CLI; Windows-only exclusion for the APFS race. These
  narrow exclusions do not clear the rest of the tar/native chain.

### Complete affected-package inventory and paths

Every arrow below denotes a dependency edge from the project root. F is
`firebase-admin 13.10.0`; S is `@google-cloud/storage 7.22.0`; G is
`@google-cloud/firestore 7.11.6`; A is `@capacitor/assets 3.0.5`; W is
`vite-plugin-pwa 1.2.0`. These abbreviations only shorten the path table.
The production browser imports none of the affected packages. The PWA/native
application contains generated assets/worker code, not these Node build tools.
Vercel's actual bundled function contents and deployed Node version were not
inspected; installed optional packages are not assumed to be excluded by tracing.

| Package / installed version | Directness | Dependency path | Execution environment and advisory linkage | Classification / action |
| --- | --- | --- | --- | --- |
| firebase-admin 13.10.0 | Direct production | root → F | Confirmed serverless use in api/push/send.js for credentials and FCM; inherits uuid advisory through optional G/S. No browser import | Temporary with uuid controls; plan modular SDK migration |
| @google-cloud/firestore 7.11.6 | Transitive, optional production | root → F → G | Available to serverless Firestore namespace; no application call found; inherits uuid through google-gax | Temporary with uuid controls; no independent advisory |
| @google-cloud/storage 7.22.0 | Transitive, optional production | root → F → S | Available to serverless Storage namespace; no application call found; inherits uuid through request clients | Temporary with uuid controls; no independent advisory |
| google-gax 4.6.1 | Transitive, optional production | root → F → G → google-gax | Firestore's Node client; inspected UUID helper uses v4(); inherits GHSA-w5hq-g745-h8pq | Temporary with uuid controls |
| gaxios 6.7.1 | Transitive, optional production | root → F → S → gaxios; also G → google-gax → google-auth-library 9.15.1 → gaxios | Node request/multipart boundary helper uses v4(); Firebase credential path instead uses direct auth-library 10.9.1/gaxios 7.3.1 | Temporary with uuid controls |
| retry-request 7.0.2 | Transitive, optional production | root → F → S → retry-request; also G → google-gax → retry-request | Node request wrapper inherits uuid through teeny-request; no separate advisory | Temporary with uuid controls |
| teeny-request 9.0.0 | Transitive, optional production | root → F → S → teeny-request; also retry-request → teeny-request | Node multipart boundary uses v4(); inherits uuid advisory | Temporary with uuid controls |
| uuid 9.0.1 and 7.0.3 | Transitive; first optional production, second development | root → F → G → google-gax → uuid 9; root → F → S → gaxios/teeny-request → uuid 9; root → A → @trapezedev/project 7.1.10 → xcode 3.0.1 → uuid 7 | Node Google clients and native project generation; one advisory, two resolutions. Inspected consumer calls are v4(), not vulnerable buffer APIs | Temporary with uuid controls; v4 call sites specifically outside trigger |
| @capacitor/assets 3.0.5 | Direct development | root → A | Native/PWA asset generator on developer/CI host; inherits Sharp/tar/uuid flags, no separate advisory | Native release gate for applicable child findings |
| nested @capacitor/cli 5.7.8 | Transitive development | root → A → @capacitor/cli 5.7.8 | Contains template extraction using vulnerable tar. Different from direct CLI 7.6.9 | Native release gate, subject to proof of release-path exclusion |
| tar 6.2.1 | Transitive development | root → A → nested @capacitor/cli 5.7.8 → tar | Developer/CI template extraction, 12 advisories detailed below; not browser/serverless/native runtime | Native gate for applicable extraction findings; narrow API exclusions below |
| sharp 0.32.6 | Transitive development, exact parent pin | root → A → sharp | Developer/CI icon/splash/image/SVG decoding, three inherited native-library advisories | Native release gate; also applies if used to regenerate web/PWA assets |
| @trapezedev/project 7.1.10 | Transitive development | root → A → @trapezedev/project | Node mobile project editing; inherits xcode/uuid flag | Temporary with uuid controls |
| xcode 3.0.1 | Transitive development | root → A → @trapezedev/project → xcode | Node project ID generation calls uuid.v4(); not Apple Xcode's compiler executable | Temporary with uuid controls |
| workbox-build 7.4.0 | Transitive development | root → W → workbox-build | Confirmed production/PWA and native CI web builds; inherits serializer advisories | Production release gate; approve parent update |
| @rollup/plugin-terser 0.4.4 | Transitive development | root → W → workbox-build → @rollup/plugin-terser | Serializes options then evaluates them in Node build worker; inherits serializer advisories | Production release gate; update through Workbox |
| serialize-javascript 6.0.2 | Transitive development | root → W → workbox-build → @rollup/plugin-terser → serialize-javascript | Node build workers, two advisories. No corresponding runtime endpoint | Production release gate; resolve >=7.0.5 through supported parent |

The table accounts for all 17 audit entries; uuid's two installations count as
one audit package entry. No parent has an additional hidden independent advisory
in the rerun: its `via` linkage points to the leaf findings below.

### Every remaining advisory: trigger, patch and decision

For uuid, the dependency paths/environments are the two resolutions above. For
serializer rows, the complete W → Workbox → Terser → serializer path and build
environment apply. For Sharp rows, A → Sharp and developer/native/PWA asset
generation apply. All tar rows use A → nested CLI 5 → tar 6 and the Node
development/native packaging environment. Every leaf is transitive, but the
following decisions depend on its code and inputs, not that label.

| Affected package / installed | Severity / linked GHSA | Exploit prerequisites, observed exposure and uncertainty | First patched version for this advisory | Recommended release classification and action |
| --- | --- | --- | --- | --- |
| uuid 9.0.1 / 7.0.3 | Moderate [w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | v3/v5/v6 output into short caller buffer or invalid offset. Confirmed Google/xcode consumers use buffer-free v4(); optional Google APIs not used by inspected app. Deployed reachability beyond inspected code is unverified | 11.1.1; also 12.0.1/13.0.1 in those majors | Acceptable temporarily with documented uuid controls; approve migration if a clean production audit is required |
| serialize-javascript 6.0.2 | High [5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq) | Attacker controls RegExp.flags or Date serialization hooks and output is evaluated. Serialize/eval sink confirmed in plugin worker; attacker-controlled options not found in app | 7.0.3 | Must remediate before production release; Workbox 7.4.1 candidate, require >=7.0.5 to also clear next row |
| serialize-javascript 6.0.2 | Moderate [qj8w-gfj5-8c6v](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v) | Crafted Array.prototype-derived object with huge length causes CPU loop; requires hostile options, potentially introduced through prototype pollution. No public options input found | 7.0.5 | Must remediate before production release with same parent update; avoid untrusted config/plugins meanwhile |
| sharp 0.32.6 | High [f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) | Untrusted input reaches vulnerable libvips decoders (including GIF/TIFF/VIPS). Installed prebuilt libvips is 8.14.5. Asset generator calls Sharp; malicious input not observed | sharp 0.35.0; primary report recommends patched libvips 8.18.3 | Must remediate before native release or prove generator excluded; trusted inputs alone require explicit scoped acceptance |
| sharp 0.32.6 | High [rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) | Hostile HEIF/AVIF input reaches libheif; possible RCE under specified glibc Linux conditions. Local libheif 1.16.2 installed; local host is Windows, Linux CI characteristics unknown | sharp 0.35.4 / libheif 1.23.2 | Must remediate before native release; do not claim local Windows excludes every decoder impact |
| sharp 0.32.6 | High [wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | Hostile SVG reaches librsvg; conditional glibc Linux RCE. SVG is explicitly accepted by asset generator. Local librsvg 2.57.0; actual Linux host/PIE setup unknown | sharp 0.35.5 / librsvg 2.63.2 | Must remediate before native release; choose supported generator/library parent, not exact-pin override |
| tar 6.2.1 | High [34x7-hfp2-rc4v](https://github.com/advisories/GHSA-34x7-hfp2-rc4v) | Crafted hardlink paths escape extraction root; attacker archive/template must reach nested CLI's extract call. Call exists; no hostile template or invocation confirmed | 7.5.7 | Must remediate before native release or verify affected extractor excluded from release workflow |
| tar 6.2.1 | High [8qq5-rm4j-mr97](https://github.com/advisories/GHSA-8qq5-rm4j-mr97) | Malicious archive symlink/path sanitization bypass enables overwrite as build user; same conditional nested extraction exposure | 7.5.3 | Must remediate before native release; isolate template inputs and host until approved remediation |
| tar 6.2.1 | High [83g3-92jg-28cx](https://github.com/advisories/GHSA-83g3-92jg-28cx) | Symlink chain + hardlink permits outside-root file read/write during default extraction; no root privilege required | 7.5.8 | Must remediate before native release; no safe inference from default extract settings |
| tar 6.2.1 | High [qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96) | Drive-relative hardlink target bypasses path checks when hostile archive is extracted. Primary PoC also runs on Linux; not exclusively a Windows problem | 7.5.10 | Must remediate before native release; use supported parent remediation |
| tar 6.2.1 | High [9ppj-qmqm-q256](https://github.com/advisories/GHSA-9ppj-qmqm-q256) | Drive-relative symlink target escapes extraction directory in ordinary extract; hostile archive prerequisite | 7.5.11 | Must remediate before native release; same host/input controls pending approval |
| tar 6.2.1 | High [r6q2-hw4h-h46w](https://github.com/advisories/GHSA-r6q2-hw4h-h46w) | Colliding Unicode paths on normalization/case-insensitive filesystems cause extraction race. Not applicable to the local Windows reservation branch; macOS APFS iOS CI risk remains conditional | 7.5.4 | Must remediate before native release on affected CI paths; do not extrapolate Windows exclusion to Mac |
| tar 6.2.1 | Moderate [vmf3-w455-68vh](https://github.com/advisories/GHSA-vmf3-w455-68vh) | PAX sizes on intermediary headers cause parser disagreement/file smuggling; crafted archive and scanner/extractor boundary needed. That scanning boundary is not documented here | 7.5.16 | Must remediate before native release with shared tar remediation; uncertainty is recorded, not called harmless |
| tar 6.2.1 | Moderate [w8wr-v893-vjvp](https://github.com/advisories/GHSA-w8wr-v893-vjvp) | Numeric PAX path fields crash extract process; malicious template can disrupt developer/CI job; ordinary promise catch may not intercept | 7.5.18 | Must remediate before native release if nested extractor retained |
| tar 6.2.1 | Critical [23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) | Compressed archive with unbounded decompressed bytes/entries consumes host disk/CPU. Extract call has no cumulative limits. Input compromise/invocation is unconfirmed, but potential impact includes CI host/release integrity | 7.5.19 | Must remediate before native release or verified exclusion; compressed-size limits alone are insufficient |
| tar 6.2.1 | High [8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w) | Negative entry size in attacker-controlled existing archive causes replace/update scan loop. Inspected CLI only calls extract and contains no tar.replace/update use | 7.5.18 | Not applicable to inspected CLI API path; reclassify if archive replacement is introduced. Package remains flagged for other issues |
| tar 6.2.1 | Moderate [gvwx-54wh-qm9j](https://github.com/advisories/GHSA-gvwx-54wh-qm9j) | Embedded NUL in PAX path/linkpath produces uncaught process error during hostile extraction; nested extract code can reach parser | 7.5.17 | Must remediate before native release with shared extraction remediation |
| tar 6.2.1 | High [r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m) | Long paths plus nonempty member-selection list trigger recursive filesFilter. Inspected extract({file,cwd}) call supplies no selection list/filter | 7.5.21 | Not applicable to inspected CLI call; reclassify on filter/member-selection additions |

The first-fixed versions are advisory-specific, not recommended combined targets.
A supported future resolution must clear all findings: tar >=7.5.21 (direct CLI
already resolves 7.5.22), Sharp >=0.35.5, serializer >=7.0.5. No backported fix
exists in the inspected tar 6/Sharp 0.32 exact dependency contracts.

### Evidence for actual execution and exposure boundaries

- `src/` has no Firebase Admin/Google/uuid/Sharp/Workbox build imports. These
  findings do not describe JavaScript executed by a listener's browser or the
  embedded YouTube player. This is source inspection, not a live deployment SBOM.
- `api/push/send.js:32` imports Firebase Admin and calls credential.cert,
  initializeApp and messaging().sendEachForMulticast after admin verification.
  Firebase's namespace source has lazy getters for Firestore/Storage; those getters
  are not invoked by the inspected function. Credentials use auth-library 10.9.1
  / gaxios 7.3.1, outside the vulnerable uuid chain. Source confirms inspected
  Google/xcode UUID helpers use v4(); no buffer-based v3/v5/v6 call was found.
- `node_modules/@rollup/plugin-terser/dist/cjs/index.js:144` serializes options;
  its worker evaluates the options string before minification. Vite PWA generateSW
  uses this build chain. Inputs are checked-in configuration/plugin objects, not
  public video/feed data. A compromised plugin or unsafe config input can threaten
  a build host and generated artifact even though the serializer is development-only.
- `node_modules/@capacitor/assets/dist/input-asset.js:37` calls Sharp then reads
  metadata; iOS/Android/PWA generators also resize/composite. The generator accepts
  PNG/JPEG/WebP/SVG filenames; filename extension alone does not establish that
  hostile bytes cannot reach other decoders. No generator was run in this review.
- `node_modules/@capacitor/assets/node_modules/@capacitor/cli/dist/util/template.js:9`
  extracts template archives with only file and cwd, establishing a conditional
  tar sink. The project's direct CLI 7.6.9 is separate and uses patched tar 7.5.22.
- `codemagic.yaml` declares a Mac M2 workflow running npm ci, npm run build and
  npx cap sync ios, then native packaging. It does not explicitly run assets generate
  or the nested CLI 5. `NATIVE_APP_SETUP.md:186` documents capacitor-assets generate
  as a developer step. Thus serializer execution is confirmed on the configured
  CI build path; Sharp is reachable when documented asset generation runs;
  vulnerable nested tar execution in the current native CI job is **not confirmed**.
  npm lifecycle scripts and any external CI configuration were not fully traced.
- Native Node asset tooling runs on development/CI machines before packaging; it
  is not the Capacitor runtime engine. Compromising that host could affect signing
  material, source or outputs. Trust of current inputs and CI isolation has not been
  verified, and proposed controls below have not been implemented.

### Compatible parent options and proposed approval sequence

1. **Approve Workbox 7.4.0 → 7.4.1 first.** It satisfies existing
   vite-plugin-pwa 1.2.0's ^7.4.0 contract and Node >=20. It adopts Terser plugin
   1.x with serialize-javascript ^7.0.3; final resolution must be >=7.0.5. This is
   a supported parent update, not a global override. It also changes Rollup/plugin
   majors, templating and worker bundling, so approval includes build output,
   worker activation/caching/offline/bridge-exclusion and physical iOS PWA checks.
   [Workbox release](https://github.com/GoogleChrome/workbox/releases/tag/v7.4.1)
2. **Approve a native asset-tool remediation investigation.** Current/latest
   assets 3.0.5 pins Sharp 0.32.6 and CLI ^5.3.0; CLI 5.7.8 requires tar ^6.1.11.
   Latest project 7.1.10 and xcode 3.0.1 retain uuid ^7.0.3. No compatible parent
   release clearing those native paths was found. Proposed actions are a maintained
   generator/upstream fix, or verified removal/exclusion of unused asset tooling
   from release generation while retaining reviewed assets. Neither removal nor a
   replacement design is authorized here. Do not swap nested CLI to 7, tar to 7,
   or force Sharp/uuid across parent contracts. Validate icon/splash outputs, Xcode/
   Android project files, fresh native CI install and packaging before release.
3. **Approve temporary uuid acceptance or an explicit Firebase migration.**
   Firebase 13.10.0 is latest 13.x; latest permitted Firestore 7.11.6/Storage 7.22.0
   retain uuid 9 through their request clients. No compatible 13.x parent fix was
   found. Audit-supported Firebase 14.5.0 uses newer Google parent majors and Node
   >=22. Verify the actual candidate graph rather than the audit fix label:
   Storage 8.1.0 and 8.2.0 still require gaxios ^6.0.2/uuid ^9.0.1, so resolving
   only to those minima does not clear the UUID path. Storage 8.3.0 and 8.4.0,
   allowed by Firebase's ^8.1.0 range, require gaxios ^7.1.4; verified 8.4.0 also
   uses auth-library 11, retry-request 9 and teeny-request 11. Firestore 9.1.0
   requires google-gax ^6.0.1; inspected 6.0.2 and teeny-request 11.0.1 metadata
   have no uuid dependency. Thus a maintained parent route exists, with the future
   lock resolving Storage 8.4.0 (or another verified patched resolution), not an
   override. A clean candidate audit remains to be demonstrated after approval.
   Importantly, Firebase 14 removes the legacy namespace API used by this
   backend. A version-only bump would be unsafe: migration must update
   `api/push/send.js` to modular app/messaging entry points, verify warm-instance
   initialization and credential behavior, preserve verifyAdmin and multicast/dead
   token handling, and test delivery on real devices. Deployed runtime remains
   unknown; no environment/runtime setting is changed or assumed approved.
   [Firebase breaking changes](https://firebase.google.com/support/release-notes/admin/node)
4. After separately approved changes, rerun both audits, reproducible install,
   PULSE/security regressions and native/PWA validations. A clean production audit
   does not imply native/build dependencies are safe. Keep this inventory current.

### Temporary controls, residual risks and explicit release blockers

Uuid acceptance is **proposed**, not granted. Document the approving owner and
review checkpoint; retain the lockfile and checked-in authenticated FCM-only path;
do not add optional Firestore/Storage or caller-buffer UUID APIs without a fresh
review. Do not accept a blanket transitive-dependency waiver. Recheck on backend
feature/dependency changes and at the next release security review. The inspected
v4 paths are not vulnerable to this advisory, but artifact tracing and unknown
future callers remain residual risks.

Pending remediation approval, keep builds on reviewed code/configuration and
known asset/template inputs, pin installs with the reviewed lockfile, avoid
untrusted PR builds with release/signing credentials, and isolate build processes
with resource limits and least filesystem privileges. Asset provenance matters
even when files are checked into Git. These are proposed operational controls;
repo inspection does not prove they are enforced. No infrastructure was altered.

**Production release is held on the recommended decision** until the supported
Workbox fix is approved and validated, or an owner expressly accepts a scoped
build-risk exception. The eight uuid production entries do not demonstrate a
reachable FCM exploit, but temporary acceptance or a tested migration must be
recorded before a release sign-off. No current browser-runtime advisory was found
among the remaining entries.

**Native release is additionally held** until the Sharp/extraction tool paths are
remediated, or their exclusion from the actual release process is verified and
approved. The two API-specific tar exclusions do not waive critical extraction
DoS or file-write risks. Windows tests cannot clear a macOS CI path or Linux image
decoder conditions. Hosted Safari/Capacitor, worker lifecycle, packaging and real
push-delivery gates remain unverified.

### Final-review validation

Production/full audits rerun and unchanged; npm ls reports no problems. Installed
versions match the lockfile. This review changed only this report. SHA-256 checks
preserve package.json, package-lock.json and the existing dependency-security test
byte-for-byte from the start of review. Focused tests, production/PWA build,
targeted lint and whitespace checks were rerun after the documentation update;
results are 42 passing tests, successful build/PWA, lint and diff checks. The
existing bundle-size warning remains; Browserslist stale-data warning is absent.
Audits still exit 1 for known findings, not a clean security result. No upgrades,
commit, push, merge, deployment, PULSE code changes or control enforcement occurred.

## Exact lockfile version changes

The following appendix is generated by comparing the final lockfile with the
starting commit. It includes every package entry whose version changed or was
added/removed; platform variants are intentionally explicit.

| Lockfile package path | Before | After |
| --- | --- | --- |
| node_modules/@babel/code-frame | 7.29.0 | 7.29.7 |
| node_modules/@babel/compat-data | 7.29.0 | 7.29.7 |
| node_modules/@babel/core | 7.28.5 | 7.29.7 |
| node_modules/@babel/generator | 7.29.1 | 7.29.8 |
| node_modules/@babel/helper-compilation-targets | 7.28.6 | 7.29.7 |
| node_modules/@babel/helper-globals | 7.28.0 | 7.29.7 |
| node_modules/@babel/helper-module-imports | 7.28.6 | 7.29.7 |
| node_modules/@babel/helper-module-transforms | 7.28.6 | 7.29.7 |
| node_modules/@babel/helper-plugin-utils | 7.28.6 | 7.29.7 |
| node_modules/@babel/helper-string-parser | 7.27.1 | 7.29.7 |
| node_modules/@babel/helper-validator-identifier | 7.28.5 | 7.29.7 |
| node_modules/@babel/helper-validator-option | 7.27.1 | 7.29.7 |
| node_modules/@babel/helpers | 7.28.4 | 7.29.10 |
| node_modules/@babel/parser | 7.29.0 | 7.29.9 |
| node_modules/@babel/plugin-transform-modules-systemjs | 7.29.0 | 7.29.8 |
| node_modules/@babel/template | 7.28.6 | 7.29.7 |
| node_modules/@babel/traverse | 7.29.0 | 7.29.10 |
| node_modules/@babel/types | 7.29.0 | 7.29.8 |
| node_modules/@esbuild/aix-ppc64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/android-arm | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/android-arm64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/android-x64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/darwin-arm64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/darwin-x64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/freebsd-arm64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/freebsd-x64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/linux-arm | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/linux-arm64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/linux-ia32 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/linux-loong64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/linux-mips64el | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/linux-ppc64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/linux-riscv64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/linux-s390x | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/linux-x64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/netbsd-arm64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/netbsd-x64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/openbsd-arm64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/openbsd-x64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/openharmony-arm64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/sunos-x64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/win32-arm64 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/win32-ia32 | 0.25.12 | 0.28.2 |
| node_modules/@esbuild/win32-x64 | 0.25.12 | 0.28.2 |
| node_modules/@humanfs/core | 0.19.1 | 0.19.2 |
| node_modules/@humanfs/node | 0.16.7 | 0.16.8 |
| node_modules/@humanfs/types | not present | 0.15.0 |
| node_modules/@napi-rs/lzma-linux-x64-gnu | not present | 1.5.1 |
| node_modules/@rollup/rollup-android-arm-eabi | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-android-arm64 | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-darwin-arm64 | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-darwin-x64 | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-freebsd-arm64 | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-freebsd-x64 | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-linux-arm-gnueabihf | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-linux-arm-musleabihf | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-linux-arm64-gnu | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-linux-arm64-musl | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-linux-loong64-gnu | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-linux-loong64-musl | not present | 4.64.6 |
| node_modules/@rollup/rollup-linux-ppc64-gnu | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-linux-ppc64-musl | not present | 4.64.6 |
| node_modules/@rollup/rollup-linux-riscv64-gnu | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-linux-riscv64-musl | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-linux-s390x-gnu | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-linux-x64-gnu | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-linux-x64-musl | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-openbsd-x64 | not present | 4.64.6 |
| node_modules/@rollup/rollup-openharmony-arm64 | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-win32-arm64-msvc | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-win32-ia32-msvc | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-win32-x64-gnu | 4.53.1 | 4.64.6 |
| node_modules/@rollup/rollup-win32-x64-msvc | 4.53.1 | 4.64.6 |
| node_modules/@types/estree | 1.0.8 | 1.0.9 |
| node_modules/ajv | 6.12.6 | 6.15.0 |
| node_modules/baseline-browser-mapping | 2.9.14 | 2.11.28 |
| node_modules/brace-expansion | 1.1.12 | 1.1.21 |
| node_modules/browserslist | 4.28.1 | 4.29.3 |
| node_modules/caniuse-lite | 1.0.30001770 | 1.0.30001816 |
| node_modules/electron-to-chromium | 1.5.286 | 1.5.456 |
| node_modules/esbuild | 0.25.12 | 0.28.2 |
| node_modules/fast-uri | 3.1.0 | 3.1.8 |
| node_modules/filelist/node_modules/brace-expansion | 2.0.2 | 2.1.7 |
| node_modules/filelist/node_modules/minimatch | 5.1.6 | 5.1.9 |
| node_modules/flatted | 3.3.3 | 3.4.4 |
| node_modules/glob/node_modules/balanced-match | 4.0.2 | 4.0.4 |
| node_modules/glob/node_modules/brace-expansion | 5.0.2 | 5.0.12 |
| node_modules/glob/node_modules/minimatch | 10.2.0 | 10.2.6 |
| node_modules/js-yaml | 4.1.0 | 4.3.2 |
| node_modules/lodash | 4.17.23 | 4.18.1 |
| node_modules/minimatch | 3.1.2 | 3.1.5 |
| node_modules/nanoid | 3.3.11 | 3.3.20 |
| node_modules/node-releases | 2.0.27 | 2.0.58 |
| node_modules/picomatch | 4.0.3 | 4.0.7 |
| node_modules/postcss | 8.5.6 | 8.5.30 |
| node_modules/react-router | 7.13.2 | 7.18.4 |
| node_modules/react-router-dom | 7.13.2 | 7.18.4 |
| node_modules/rollup | 4.53.1 | 4.64.6 |
| node_modules/source-map-js | 1.2.1 | 1.2.2 |
| node_modules/update-browserslist-db | 1.2.3 | 1.3.4 |
| node_modules/vite | 7.2.2 | 7.3.7 |
| node_modules/workbox-build/node_modules/ajv | 8.18.0 | 8.20.0 |
| node_modules/workbox-build/node_modules/picomatch | 2.3.1 | 2.3.2 |
| node_modules/workbox-build/node_modules/rollup | 2.79.2 | 2.80.0 |
| node_modules/ws | 8.20.0 | 8.22.0 |
