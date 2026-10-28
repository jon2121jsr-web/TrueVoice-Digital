# Fix 1B.02A ? Native iOS baseline implementation report

Status: LOCAL BASELINE COMPLETE; Stage B requires review. Not a signed or device-accepted native release.

## Isolation and provenance

- Worktree: C:/Users/jon52/TrueVoice-Digital/.release-staging/fix-1b02a/worktree
- Branch: fix/native-ios-1b02a
- HEAD: 6f6b6aaf85a9d861f5c91bc6df88c79bf10bad35 (no commits)
- Accepted deployment/source: dpl_298ogPcRZG1ptyThcQZtoJdwtf4Y; .release-staging/fix-1a45b/source and manifest.json.
- All 189 saved artifact files were SHA-256 verified before copying and again in the new worktree before edits: zero missing or mismatched entries.
- No unexpected application files were found under src/, api/, lib/, or public/. Seven additional regression files inherited from HEAD remain under tests/: pulse-bridge, pulse-dependency-security, pulse-preview-security, pulse-release-security, pulse-stabilization, pulse-youtube-cache.database, and pulse-youtube-cache (all .test.mjs).
- After the native overlay, 184 accepted entries remain byte-identical. Exactly five accepted entries intentionally differ; see below. This is a verified reconstruction plus a documented native overlay, not a claim that edited source still matches the immutable web manifest.
- The tracked historical .env is inherited unchanged from HEAD. The validated native build excludes it from client environment loading; no .env.local, hosted configuration, private key, or signing material was copied.

## Native overlay files

1. capacitor.config.ts: supported capacitor://localhost origin, bundled dist, no server.url; Android scheme remains https. Hostname is shared by Capacitor configuration, so verify Android separately if this branch is later used for Android. Bundle ID, display name, plugins, branding, and native assets unchanged.
2. src/lib/apiBase.js: rebase relative api/ and /api/ paths to the existing https://www.truevoice.digital origin on native platforms. Website URLs and explicit configured endpoint overrides retain their existing targets.
3. src/services/api.js: native Now Playing requests use the existing hosted /api/nowplaying proxy; website direct-origin metadata lookup and response normalization remain unchanged. AzuraCast metadata is allowed; direct-origin listener playback is not.
4. src/hooks/useAzuraCast.js: native listener/metadata polling uses the same resolver, preserving headers, deadline and no-store.
5. src/lib/pushNotifications.js: rebase default/relative registration endpoint without changing device-token payload, method, permissions, or registration logic.
6. src/lib/analytics.js: rebase default/relative analytics endpoint while preserving payload, method, keepalive and preview denial.
7. tests/native-routing.test.mjs (new): eight offline runtime tests covering resolver behavior, real metadata consumers, push payload, analytics/preview denial, catalog routing, admin authorization and parsed Capacitor config.
8. tools/build-native-baseline.mjs (new): local-only production artifact builder, existing production-policy classification in-process, accepted timing 55/2/15, explicit public Supabase inputs, no private Google API key, local cache/output, emitted timing and listener URL checks. No sync, signing or upload.
9. This report (new).

The accepted src/lib/streamUrl.js, src/App.jsx, src/components/NowPlayingPanel.jsx and src/hooks/useVerseRadioAudio.js remain unchanged from the accepted release. Listener selection is Live365-only, ignoring legacy overrides and retaining no MP3/HLS fallback. Existing YouTube/catalog routing already uses API_BASE and was retained and runtime-tested with native platform fixtures. API handlers, authorization, backend keys, security policy and provider settings were not changed.

## Validation results

- Focused native/routing/playback/admin suite: 83/83 pass, including all eight new tests and existing Live365 distribution tests.
- Full local suite: 146 tests, 144 pass, 1 fail, 1 skipped. The failure is the pre-existing pulse-stabilization catalog-proxy expectation (503 instead of 200), matching the previously documented baseline failure. The explicitly disabled disposable-database integration test was skipped; no SQL or migrations ran.
- Focused ESLint on the five edited JavaScript files: pass.
- Full ESLint: 22 existing process/Buffer no-undef errors in unchanged API files, plus one existing unused-disable warning in TrueVoiceScrollPreview.jsx. No blanket lint cleanup or security-policy change was made.
- Local production Vite build: pass; 813 modules; PWA generated with 16 precache entries.
- Main bundle: /assets/index-BkjhuXAK.js, 944.07 kB (282.83 kB gzip); large-chunk warning persists.
- Emitted timing verification: Live365 55 seconds / AzuraCast 2 seconds / unknown 15 seconds. Classification helpers are not audio routing fallbacks.
- Emitted main bundle: approved Live365 endpoint present; no https://stream.truevoice.digital/listen/ or /hls/ listener URLs.
- Initial sandbox test run was not valid due to esbuild access restrictions and missing dist. Retried with permitted execution access after build. The first local build exposed inherited timing settings; the final profile explicitly fixes the accepted timing and excludes historical environment-file injection.

The two existing public Supabase settings were supplied only to the build process from approved local configuration, with values withheld. No backend secrets were supplied, and no environment file from either dirty checkout was copied. A fresh build must receive approved public Supabase configuration; it must not receive a service-role key. The helper rejects service-role JWTs and accepts anon/publishable client keys.

## Reproduction and review

Use the exact package-lock.json and approved existing dependencies. No dependencies were installed or upgraded in this task. The isolated worktree currently resolves dependencies from the existing ancestor node_modules; a future standalone checkout needs its normal separately authorized locked dependency installation.

Supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY through the process environment from approved public configuration. Run node tools/build-native-baseline.mjs from this worktree (optionally NODE_OPTIONS=--max-old-space-size=512 and GOMAXPROCS=2 for constrained machines). The helper does not fetch configuration or contact providers. It is separate from the historical npm run cap:sync/Codemagic path; do not use those paths before Stage B approval.

Run the five focused files: tests/native-routing.test.mjs, tests/live365-distribution.test.mjs, tests/pulse-playback.test.mjs, tests/pulse-postlaunch.test.mjs and tests/pulse-admin.test.mjs. For the full suite, enumerate tests/*.test.mjs with Node's --test and --test-concurrency=1, leaving PULSE_CACHE_TEST_DATABASE_URL and PULSE_CACHE_TEST_DISPOSABLE unset.

Evidence beside this worktree: accepted-source-verification.json, reconstruction.json, final-verification.json, focused-tests.log, focused-lint.log, all-tests.log, full-lint.log and build.log. final-verification.json contains the complete Git status inventory of reconstructed and overlay files, not just a summary of the five final web changes.

## Preservation and remaining requirements

Preservation checks: root checkout 468 recorded files and Live365 worktree 339 recorded files unchanged; no added untracked files outside the new release-staging area; both HEADs unchanged. ios/, android/, assets/, codemagic.yaml, package.json and package-lock.json match their committed baseline. The new worktree's capacitor.config.ts is intentionally changed. Existing dirty worktrees and immutable release source were not edited.

No native bundle was synced; there is no new native binary or device acceptance. AVAudioSession, UIBackgroundModes, interruption/route handling, native Now Playing/remote controls, and background recovery remain Stage B work. Existing JavaScript recovery is not proof of WKWebView behavior while suspended. Push callbacks/APNs-to-FCM integration, native CORS, authentication redirects, explicit endpoint overrides, and YouTube WebView identification still require device validation. The new origin can change origin-scoped browser storage; verify login/cookies and do not assume old sessions migrate.

Rights evidence for branded Live365 native distribution and third-party media, privacy/archive declarations, macOS signing/toolchain/build number, old icon/splash replacement, and physical-iPhone acceptance remain open from Fix 1B.01. Branding was intentionally preserved. Known dependency vulnerabilities and optional artwork-generator risks were not remediated or re-audited by installing anything.

No commits, pushes, merges, Vercel calls, provider changes, Codemagic runs, Capacitor sync, IPA build, TestFlight/App Store upload, or production changes occurred. Stop for Stage B review.
