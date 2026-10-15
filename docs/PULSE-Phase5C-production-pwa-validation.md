# PULSE Phase 5C — production build and PWA validation

Assessment date: 2026-10-15, America/Phoenix.

Phase 5E update: the user has approved all six local production-preview Chrome checks and the final Hero/header visuals, framing and Gear navigation. This is manual user confirmation, not automated or hosted-production evidence. Original pending-check statements below describe the Phase 5C handoff; the Phase 5E authorization report governs the current release decision. Safari and any PWA lifecycle behavior not explicitly observed remain unverified.

**Local production preview: http://localhost:4173/** — running and left available for manual Chrome verification. **GO for manual production-build testing; NO-GO for production release sign-off until the remaining runtime checks are recorded.** No deployment was performed.

## 1. Candidate integrity and evidence sources

| Item | Confirmed value |
| --- | --- |
| Branch | `release/truevoice-pulse-web` |
| Exact release candidate | `46455d5caa6353762524e3674c8aeca334c2e3e9` |
| Production baseline parent | `c511c8905cffd9c11301d00a25b73d51127fc0f5` |
| Application worktree/index | No tracked or staged differences |
| Documentation | Phase 5B updated; this report created; both left uncommitted |

Read the Phase 5A candidate report and Phase 5B browser report. Existing untracked Phase 5A/same-day reports and `Claude outputs/` were left untouched. Application code, native projects, dependency files, environment files and credentials were not modified. The build only regenerated ignored `dist/` output and normal tool caches. No temporary launcher was created.

Evidence is separated into user-performed Chrome development tests, this phase's build/static/generated-worker checks, localhost HTTP checks, and runtime tests still pending. No Computer Use or browser automation was invoked.

## 2. User-confirmed Chrome development results

These results were supplied by the user and added to `PULSE-Phase5B-browser-playback-validation.md`. They concern the local Vite **development server**, following its startup at `http://localhost:5174/`, on the same candidate. They are not automated results, production-build preview observations, or hosted Production verification. Host context is Windows; Chrome version and viewport sizes were not supplied.

| User-performed test | Result |
| --- | --- |
| Home loads with PULSE layout and images | PASS |
| EXPLORE opens and categories work | PASS |
| LIVE radio plays, pauses and resumes | PASS |
| Opening video pauses LIVE audio | PASS |
| Video playback and manual Next/Previous work | PASS |
| Closing video permits LIVE playback to resume | PASS — ability to resume, not a claim of automatic resume on close |
| Browser Back/Forward | PASS |
| Refreshing `/explore` | PASS |

No user-confirmed result was supplied for a repeating Short without ENDED, metadata accuracy, Like/Share, all responsive breakpoints, console/network cleanliness, PWA lifecycle or Safari. No failure was reported in the supplied test list.

## 3. Production/PWA build

Executed the existing build script with process-only Production classification, matching the Phase 5A build:

```powershell
$env:VERCEL = '1'
$env:VERCEL_ENV = 'production'
$env:VERCEL_TARGET_ENV = 'production'
npm.cmd run build
```

The classification satisfies the existing fail-closed build policy; no policy was bypassed. Existing local values were used without printing/downloading secrets. These are not a fresh pull of Vercel Production variables, so deployed value parity remains unverified. Local esbuild parent-directory read access was required.

**PASS:** Vite 7.3.7 transformed 807 modules and completed in 14.76 seconds. PWA 1.2.0 `generateSW` generated `dist/sw.js` and `dist/workbox-77d36791.js`. The precache contains 13 entries totaling 1024.62 KiB.

| Generated artifact | Size |
| --- | --- |
| index.html | 5.37 kB |
| assets/index-BKRij3TO.css | 98.68 kB / 18.12 kB gzip |
| assets/index-D4RPxEvh.js | 0.11 kB / 0.11 kB gzip |
| assets/index-CaDdwcad.js | 937.38 kB / 280.27 kB gzip |

The main chunk exceeds Vite's 500 kB warning threshold. This is a performance warning, not a failed build. Asset names/sizes match Phase 5A. No broad dependency upgrade or audit remediation was attempted.

Compiled bundle checks confirm PULSE EXPLORE code and `/explore` route text are present. Source/compiled output checks found no `DropPortal`, `drop-upload` or `drop-uploads` functionality. The upload endpoint/UI/styles/migration remain absent from the filesystem. The production application is an SPA: PULSE routes are included in the JavaScript router and shell fallback, not generated as independent HTML/precache entries.

## 4. Local production preview and HTTP checks

Started using the existing configuration:

```powershell
$env:VERCEL = '1'
$env:VERCEL_ENV = 'production'
$env:VERCEL_TARGET_ENV = 'production'
npm.cmd run preview -- --host localhost --port 4173 --strictPort
```

The server explicitly binds to **localhost only**, serves the generated production build, and remains running. It is separate from the development server. Vite preview is a static server; it does not run Vercel API Functions, cron jobs, webhooks or migrations.

| Local HTTP request | Result |
| --- | --- |
| `/` | 200, application HTML shell |
| `/explore` | 200, application HTML shell |
| `/explore?video=uUWdS1feO3c` | 200, application shell; no video availability claim |
| `/scroll/phase5c-readonly-check` | 200, application shell; no record lookup performed |
| `/sw.js` | 200, JavaScript; Cache-Control: no-cache |
| `/registerSW.js` | 200, JavaScript |
| `/manifest.webmanifest` | 200, application/manifest+json |
| `/yt-embed.html?v=uUWdS1feO3c` | 200, its own HTML document, not the SPA shell |
| Main JS, icon-192.png, icon-512.png | 200, expected JavaScript/PNG types |

All 13 precache assets were additionally retrieved from localhost and verified byte-for-byte against their generated disk files. There are no extra/stale filenames in the current `dist/assets` directory outside the precache list. This checks the current server/build consistency, not an existing browser's CacheStorage or previously installed app.

HTTP requests did not execute client JavaScript or visit external services. **When manually opened, this Production-classified app retains normal production-capable client behavior**, including automatic telemetry/page_visits and session restoration using existing local values. The preview is not a read-only backend sandbox. Do not submit forms, payments, uploads, admin operations or production write tests. This phase did not invoke those actions. A successful Vite preview page does not validate a deployed API Function.

## 5. Static PWA validation

The generated worker was evaluated in a Node VM with Workbox declaration stubs to inspect registrations, precache and cache strategies. This is static/generated-policy evidence, not a browser worker execution test.

| Check | Static result / implication |
| --- | --- |
| Registration and scope | index.html loads registerSW.js; it registers `/sw.js` on window load with scope `/` when service workers are supported. Scope is the localhost:4173 origin and cannot control the development-server or production origin. Actual registration/control unverified. |
| Manifest | id `/`, start_url `/`, scope `/`, display `standalone`, portrait-primary, name TrueVoice Digital, theme/background #050816, lang en, music/lifestyle/entertainment categories. Parsed successfully. |
| Icons | 192/512 PNG any icons, 512 maskable entry and 180 Apple touch icon entry; files are present/served. Manifest configuration alone does not prove installability or icon safe-area appearance. |
| Navigation fallback | Generated NavigationRoute uses `/index.html`. API paths and `/yt-embed.html` are denylisted, including query-bearing embed URLs. `/explore` can use the fallback. Local HTTP deep-route shell delivery also passes. Offline/runtime navigation remains unverified. |
| Asset precaching | 13 unique existing files: HTML shell/bridge, register script, manifest, 3 hashed JS/CSS assets, favicon and five touch/app icon files. All are locally served with identical bytes. External videos/audio/feed data are not precached. |
| Revision handling | Unhashed HTML/manifest/icons use content revisions. Bundled JS/CSS use hashed filenames with null Workbox revisions. Changed content should change revision/hash and update worker contents; no controlled two-build browser update experiment was performed. |
| Activation/update policy | Generated worker calls skipWaiting and clientsClaim; cleanupOutdatedCaches is enabled. Source uses autoUpdate. This can activate/claim existing clients mid-session. Source comments describing prompt/deferred activation are stale and do not describe the effective policy. Actual audio/session behavior during update remains unverified. |
| LIVE365 | NetworkOnly; stream is not cached. |
| AzuraCast metadata | NetworkFirst, cache azuracast-api, 30-second expiration. |
| Fonts | CacheFirst, google-fonts, 10 entries / one-year expiration. |
| Images | StaleWhileRevalidate, images, 60 entries / 30-day expiration. Art may remain cached until revalidation; this is not proof of a stale app bundle. |
| Potential stale clients | Current disk output is consistent. Older open pages/installed PWAs may retain old HTML/assets/worker state; immediate worker activation is not proof that every page reloads or stays interruption-free. Existing-client update/rollback must be tested in-browser. |

Generated SHA-256 evidence:

```text
dist/sw.js
ecd1c3c40d4ee3e2ae32323f3c054ae7b707069d8865b1855ccc99f596d20373
dist/index.html
d6aee287347e3637d871b05dcbabefc5605f7f6d445aca5eb8b0f3ef091f7f66
dist/manifest.webmanifest
102cd4242fda81ade0597c023085844ece9f852596ffcca64786a1485d18891f
```

## 6. Release checks

| Check | Result |
| --- | --- |
| All six focused PULSE/security test files | **58 passed, 0 failed, 0 skipped**, 11.08 seconds |
| All changed client/config JS/JSX | **36 files**, 0 ESLint errors/warnings |
| All changed API JS | **12 files**, 0 ESLint errors/warnings with Node globals supplied to lint runner |
| npm ls --depth=0 | PASS; no missing/invalid direct dependency reported |
| Manifest versus lock consistency | PASS; dependencies/devDependencies declarations exactly match lock root |
| Installed direct versions versus lock | PASS for every direct dependency/devDependency |
| Drop Portal absence | PASS; source/filesystem and compiled bundle checks |
| git diff --check | PASS |
| Production baseline-to-candidate diff --check | PASS |
| Tracked/index integrity | PASS; exact candidate unchanged |

Focused tests ran with NODE_ENV=development so mocked local policy paths are explicit; generated-worker assertions inspected this phase's new production build. Tests include media ownership, actual component queue/handoff behavior, bridge security, proxy limits, Preview isolation and representative Production paths. They do not prove live server configuration or real browser audio/PWA lifecycle.

Client lint used the existing config. API lint used the same ESLint Node API override as Phase 5A, declaring process/Buffer read-only; no repository lint config/rules were changed. The repository-wide legacy lint failure is not claimed fixed. Dependency consistency was requested and checked; Phase 5A's 11 moderate inherited audit entries/reachability assessment remains the audit baseline, not a new audit performed in this phase.

## 7. Manual production-preview tests still required

Use **http://localhost:4173/**, not the development-server URL. No runtime result is claimed until the user supplies it.

- [ ] Repeat the eight confirmed development-server cases on this compiled build: Home/images, Explore/categories, LIVE play/pause/resume, video pauses LIVE, modal video/Next/Previous, deliberate LIVE resume after close, Back/Forward and Explore refresh.
- [ ] Verify Now Playing metadata, responsive layouts, cold shared-video/Scroll/show/listen links, repeating-Short manual Next, local Like and Share UI without posting anything externally.
- [ ] Inspect console/network for failed catalog/media/assets. Production build still uses the existing loopback-to-live YouTube catalog proxy and real-origin hosted bridge; this does not prove the candidate's deployed Function or new hosted bridge works. Do not mistake a live baseline proxy response for a local API test.
- [ ] In Chrome's Application panel, confirm `/sw.js` is activated and controls localhost:4173, with scope `/`, manifest parsed and expected precache contents. No production-origin worker should be affected.
- [ ] Check installation where supported, installed-app launch, ordinary deep-route refresh and cached shell behavior. Offline external radio/YouTube playback is not expected from static precaching.
- [ ] Test an existing open/installed client across an explicitly prepared local update, including ongoing audio, new hashed assets and absence of broken routes. Do not change candidate source merely to manufacture an update in this phase. Runtime update/rollback evidence remains outstanding.

**Safari:** no Safari/remote Safari result was supplied. Safari and installed iOS PWA behavior remain **UNVERIFIED**. Chrome development results and static Workbox checks cannot establish Safari compatibility.

## 8. Findings and recommendation

- **No critical production-only build failure identified** by compilation, generated-worker checks, dependency consistency, focused tests or localhost HTTP checks.
- **Release sign-off blocker:** compiled-build Chrome playback/navigation and runtime PWA registration/install/update/cache behavior are still awaiting manual evidence. The static preview is ready to collect that evidence.
- **Remaining verification limitation:** Safari/iOS playback and installed-PWA lifecycle are unverified; obtain those results or explicit risk acceptance before claiming cross-browser release readiness.
- **Warnings:** large initial JS chunk; immediate worker activation may affect existing audio sessions; local preview does not validate Vercel Function deployment/system variables/RLS/live key restrictions; existing dependency/privacy concerns from Phase 5A are not resolved here.

**Recommendation: GO for manual localhost production-preview testing; NO-GO for final production release sign-off pending the remaining browser/PWA evidence.** The supplied development-server Chrome passes materially improve playback evidence but are not production-build/PWA results.

The preview remains running at **http://localhost:4173/**. Documentation is uncommitted. No Computer Use, deployment, push, merge, SQL/migration, credential change, external infrastructure change, native modification or MY PULSE development occurred. No production service operation was executed by these static/HTTP checks.
