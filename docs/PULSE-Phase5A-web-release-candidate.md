# PULSE Phase 5A — web release candidate

Prepared 2026-10-15, America/Phoenix. **Release isolation: GO. Production deployment: NO-GO pending browser/integration validation.** No deployment is authorized by this report.

## 1. Baseline and candidate

| Item | Exact identity |
| --- | --- |
| Release branch | `release/truevoice-pulse-web` |
| Release commit | `46455d5caa6353762524e3674c8aeca334c2e3e9` |
| Direct parent / verified production commit | `c511c8905cffd9c11301d00a25b73d51127fc0f5` |
| Production deployment | `dpl_CCV6ZTvgme8Anj9axBtswKZKMSc8`, READY, production, Git/main |
| Production hostname | `true-voice-digital-i8ckaj637-johns-projects-861a7d26.vercel.app` |
| Verified aliases | `truevoice.digital`, `www.truevoice.digital` |
| Original PULSE branch, unchanged | `feature/truevoice-pulse` at `3c39fa7ea7114f0e3f3ec79426fb7e7bbc82783f` |
| Vercel project | `true-voice-digital`, `prj_OMhlrkRX8NFQCMidqT4Z0shSzKOt` |
| Team / CLI scope | `team_qJIIDlYcPRRWTRbel8YtLlxd` / `johns-projects-861a7d26` |

The authenticated Vercel lookup of `truevoice.digital` reconfirmed the production deployment and SHA during this phase. Local main/origin/main also identify that commit. Remote Git freshness was not established in the preceding assessment because Windows Git credentials failed; production identity comes from Vercel rather than assuming origin/main is current.

The candidate is one selected-content commit directly on production, not a merge of the development branch. It contains 80 changed files, 10,228 insertions and 3,273 deletions. Original PULSE versus production contains 86 changed files, 10,870 insertions and 3,285 deletions. The exact included file manifest is appended below; `git diff c511c8905cffd9c11301d00a25b73d51127fc0f5 46455d5caa6353762524e3674c8aeca334c2e3e9` reproduces the full candidate patch.

This report is intentionally **uncommitted**. The earlier same-day readiness report and pre-existing `Claude outputs/` remain untracked and were not included in the candidate. Temporary audit JSON files were removed after inspection. No push, merge, production SQL, credential/configuration change, native build/sync or MY PULSE development occurred.

## 2. Included changes and preservation review

| Included scope | Purpose / preservation evidence |
| --- | --- |
| App + PULSE Home, Intro, LIVE, EXPLORE and discovery styles/components | Web layout, category discovery, shared Home/Explore audio owner, route/query handoffs and support navigation. Existing `/admin`, `/privacy`, `/scroll`, `/scroll/:id` and unknown-route Home fallback remain. |
| NowPlayingPanel, media coordinator, Scroll/FeedCard and ReelsGrid | Coordinate radio/video, retain controller through Home/Explore layout changes, prevent overlapping audio and stale recovery; preserve explicit user playback intent. Scroll's verse cards are deliberately excluded for the PULSE video-first experience. |
| VideoModal, player hook, thumbnail, queue/progress/engagement helpers and yt-embed bridge | Selected-video identity, queue snapshot/navigation, official ended/autoplay messages, progress and stale generation handling, local Likes and share/deep links. Existing real-origin native embed workaround remains. |
| YouTube hooks/catalog + api/youtube.js | Existing proxy consumers retained, development fallback, fixed upstream host and operation/parameter allowlist, method/query/time/response bounds and sanitized errors. |
| Preview policy/client guards and existing privileged API guards | Fail closed before privileged initialization in Preview/unsafe metadata; suppress Preview auth, telemetry, payments and writes. Production paths remain enabled only with consistent Production system metadata. Guards on existing native-facing API routes are retained because they share the deployed backend; native project files are unchanged. |
| package.json/package-lock.json + vite.config.js | Carry the existing reviewed dependency security remediation and PWA generation compatibility. No additional dependency version changes were made in Phase 5A. Root optional artwork generator removed; no global overrides or forced major-version audit fixes introduced. |
| Six focused test files | Existing PULSE coverage, adjusted for the endpoint/route intentionally excluded; additional regression checks prove upload/UI/migration absence. |
| PULSE Phase 4 evidence docs + tools/native-assets | Security/playback/Preview provenance retained, including historical limitations. Optional generator remains an isolated, non-workspace package with its risk documentation/lock; root install/build does not install or execute it. Its presence is security-remediation provenance, not a native release step. Historical docs describe the development branch and must not be mistaken for this candidate's scope. |

Automated comparison verified the four fixed `https://buy.stripe.com/…` destinations exactly match production. Existing telemetry/page_visits, Auth, chat/reactions, server admin verification, Stripe signature verification, cron ingestion, account deletion and native API behavior were reviewed through the diff; their new server changes are Preview guards/lazy client initialization, not altered Production business logic. Tests cover representative Production guard, admin and payment paths; live production parity is not established by that review alone.

There is **no diff against production** in `ios/`, `android/`, Capacitor configuration, `codemagic.yaml`, `vercel.json`, `supabase/` or `NATIVE_APP_SETUP.md`. No new database grant, storage bucket, station upload, payment service, paid service or migration is needed for this candidate. Production discovery reuses existing feed reads. Existing production telemetry and signed-in features can still write; this candidate is not globally read-only.

## 3. Drop Portal exclusion evidence

Drop Portal originally arrived in separate commit `0018cb405a8db16cbd3a19c6546b2ac000e750a4`, which added five standalone files and two App lines. It was subsequently mixed into other work:

- `f16975d179aac6944cccb8384ab8c00a0f5da38c` added `/drop` to the new PULSE layout exclusion list.
- `db7573e9cc12cbfdd2c370ba4496d509e1f2c176` added Preview guards to the upload endpoint and included it in privileged-route tests.
- Later App changes retained the portal import/route. Simply omitting the first commit or deleting the UI file would leave those dependencies behind.

The release branch was created on production and only selected tracked paths were imported from PULSE. These paths were never brought into it:

| Excluded path | Reason |
| --- | --- |
| `DROP_PORTAL_SETUP.md` | Unrelated upload/station provisioning procedure |
| `api/drop-upload.js` | New service-role storage download/delete and AzuraCast station upload path |
| `src/pages/DropPortal.jsx` | New upload UI with storage write before server password verification |
| `src/pages/DropPortal.css` | Portal-only styles |
| `supabase/migrations/20260920140000_drop_uploads_storage_bucket.sql` | New bucket and unauthenticated INSERT permission |
| `NATIVE_APP_SETUP.md` development changes | Native setup documentation is outside the web candidate; production version preserved |

Additional surgical edits removed the App import, explicit `/drop` route and PULSE layout exception. The route test now verifies `/drop` follows the same unknown-path Home fallback as production. The Preview test stops importing the absent upload Function, while retaining all nine existing protected endpoints and generic storage-write denial. A release test asserts all five portal files are absent. The `DROP_PORTAL_PASSWORD`/`AZURACAST_API_KEY` denylist entries remain as defense against accidentally inherited privileged credentials; they do not implement an upload feature.

One-off Git/filesystem assertions confirmed each portal file was absent in the **production tree and candidate filesystem**. Thus this removes unshipped development functionality, not a production feature. `git diff --name-status feature/truevoice-pulse HEAD` shows exactly the six excluded paths above and four adjusted files: App plus playback, Preview security and release security tests. Everything else imported matches the development tree byte-for-byte.

## 4. Validation results

| Check | Result |
| --- | --- |
| All six PULSE test files, explicit local development context | **58 passed, 0 failed, 0 skipped**, about 11 seconds |
| Production/PWA build | **PASS**, Vite 7.3.7, 807 modules, PWA 1.2.0; 13 precache entries, 1024.62 KiB |
| Focused original ESLint selection | **PASS** |
| All changed client/config JS/JSX | **PASS**, 36 files |
| All changed API JS with explicit Node globals in lint runner | **PASS**, 12 files |
| Production dependency audit | **11 moderate package entries**, 0 high/critical; audit exit 1 |
| Full dependency audit | Same **11 moderate**, 0 high/critical; audit exit 1 |
| `git diff --check` before commit and production-to-candidate diff | **PASS** |
| Stripe destination / native / SQL / deployment configuration comparison | **PASS**, as described above |
| Chrome/Safari, live audio/video and installed PWA | **Not performed**; no connected apps/browsers |

Commands/context:

```powershell
$env:NODE_ENV = 'development'
node --test tests/*.test.mjs

# Separate process used for the build:
$env:VERCEL = '1'
$env:VERCEL_ENV = 'production'
$env:VERCEL_TARGET_ENV = 'production'
npm.cmd run build

npm.cmd audit --omit=dev --json
npm.cmd audit --json
git diff --check c511c8905cffd9c11301d00a25b73d51127fc0f5 HEAD
```

The build/tests required local esbuild parent-directory read access, as in the earlier assessment. Production secret values were not downloaded. The build used existing local configuration and explicit Production classification, so it proves compilation, not deployed environment parity. Its generated `dist` must **not** be treated as a safe browser sandbox or the eventual deploy artifact. Browser fixtures must use a separate sanitized build.

The API lint pass used the ESLint Node API with `overrideConfig: [{ files: ['api/**/*.js'], languageOptions: { globals: { process: 'readonly', Buffer: 'readonly' } } }]`. No repository lint configuration or code was changed to suppress findings. Without this runtime-aware override, the existing browser-oriented config reports 24 `no-undef` errors for legitimate Node globals in the changed server files. All changed client/config files pass without an override. The earlier repository-wide lint failure is not claimed fixed; no broad lint cleanup was attempted.

The large JS chunk remains 937.38 kB / 280.27 kB gzip, with Vite's size warning. Existing autoUpdate/skipWaiting/clientsClaim behavior is retained; contradictory prompt-mode comments are historical and are not evidence of deferred activation.

## 5. Assessment of the 11 moderate audit entries

These are **11 affected package entries tracing to one underlying advisory**, not 11 independently reachable application vulnerabilities. Root installed resolution is uuid 9.0.1.

| Entries | Dependency role / inspected evidence |
| --- | --- |
| uuid | GHSA-w5hq-g745-h8pq / CVE-2026-41907; vulnerable v3/v5 buffer-writing implementation present in installed `dist/v35.js` |
| gaxios 6.7.1, teeny-request 9.0.0, google-gax 4.6.1 | Direct uuid consumers; inspected implementations call `v4()` with no buffer/offset for multipart boundaries or generated IDs |
| google-auth-library, gcp-metadata, gtoken | Older nested Google auth/request chain inherits affected gaxios; not separate advisory triggers |
| retry-request | Inherits teeny-request finding |
| @google-cloud/storage, @google-cloud/firestore | Optional Firebase server dependency chains inherit findings; no application use of these services found |
| firebase-admin 13.10.0 | Root server dependency inheriting the optional Google chains; application imports it only in `api/push/send.js` |

The [upstream uuid advisory](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq) describes silent partial output when a vulnerable UUID method receives an undersized caller buffer or invalid offset. Its trigger differs from ordinary string-returning v4 generation. Patched versions include 11.1.1, 12.0.1 and 13.0.1. No source quotes or credentials were captured.

Local inspection evidence:

- `node_modules/gaxios/build/src/gaxios.js:417`: buffer-free uuid v4 multipart boundary.
- `node_modules/teeny-request/build/src/index.js:135`: buffer-free uuid v4 boundary.
- `node_modules/google-gax/build/src/util.js:108`: buffer-free uuid v4 helper.
- `src/` imports none of firebase-admin, these Google clients or uuid; no direct affected-method caller found in application source.
- Firebase namespace uses separate lazy getters for Messaging, Storage and Firestore. The app's push/send path calls credential initialization and Messaging, not Storage/Firestore; its root auth chain uses google-auth-library 10.9.1 / gaxios 7.3.1, outside the affected older uuid dependency path.

**Conclusion:** no exploitable call path for this advisory was identified in the browser bundle or inspected deployed application routes. There is no evidence that request input can select the vulnerable UUID method or supply its output buffer/offset. The packages are still affected and npm audit correctly remains nonzero. This is a source/dependency reachability assessment, not proof about every SDK path or a deployed exploit test. Retain as a documented WARNING; reassess if Google Storage/Firestore or buffer-based UUID APIs become used. Do not force uuid across parent major-version contracts or upgrade Firebase broadly merely to clear this audit.

The optional `tools/native-assets` project has a separate known-vulnerable lock and is not part of the root audit/install or web runtime. It was not installed or run. Do not invoke it in release CI.

## 6. Browser testing preparation and safe environment boundary

Vercel returned **zero Preview deployments for feature/truevoice-pulse**. This local release commit has not been pushed/deployed. No safe hosted candidate Preview was identified. The earlier environment-name inspection found production service credentials shared into Preview; the retained guard will deliberately reject them. No variable setting was changed or bypassed. Current computer-use inventory is `apps: []`, `browsers: []`; no automated Chrome or Safari session is available.

**Fastest safe route without infrastructure changes:** use a disposable local test checkout and browser fixture/interception harness, with no copied `.env` files or credentials. Run the same candidate's UI in Chrome and real Safari on a Mac/iPhone. This is a proposed validation setup, not a harness implemented or executed in this phase:

1. Use synthetic feed/catalog responses and fixture public IDs; provide only dummy Supabase public values. Keep server secrets absent. Build with the existing **Preview classification and assertions intact**, using distinct synthetic project refs, an anon-shaped synthetic token and a nonfunctional test-only YouTube key. Serve the resulting static output locally; do not run privileged production Functions. Never reuse the current locally built Production-mode `dist` for this test.
2. Before first navigation, the harness must intercept Supabase REST reads, local/production-origin `/api/youtube` catalog requests and auxiliary content with reviewed fixtures. Abort Supabase Auth/Realtime/Storage and every application request that could write. Stub same-origin analytics/admin/payment/push/ingestion endpoints and intercept outbound checkout navigation. No production write-capable endpoint or real Supabase key may be reachable. Existing Preview client checks are additional protection, not a replacement for the network boundary. A complete usable fixture feed/queue requires this harness; it does not exist in the repo today.
3. First test UI/navigation/queue with all external requests denied. For actual playback, deliberately permit only the public LIVE365 stream, AzuraCast now-playing GET, YouTube player/thumbnail hosts and required player subresources. These media services may have their own playback telemetry, but require no application write credentials. Keep app write destinations blocked. Validate allowed hosts from actual player requests instead of broadly allowing the production site or all Google hosts.
4. Candidate bridge caveat: the production build intentionally uses the existing real-origin hosted yt-embed bridge. Local tests otherwise exercise that live bridge rather than the candidate file. A separately isolated **development-mode** pass with the already-supported `?pulseLocalBridge=1` option can exercise the candidate bridge on loopback; keep the same network blocking/fixtures and Preview restrictions. Do not change production bridge selection or label that development pass Production parity.
5. For Safari on another device, localhost refers to that device. Use the Mac's local server for desktop Safari first. iPhone media checks can use a private LAN fixture server after its request boundary is verified, but that HTTP origin cannot prove installed-PWA secure-context behavior. Installed Safari PWA/update tests need an existing trusted HTTPS test origin (or properly trusted local HTTPS), under separately authorized setup if absent. Do not bypass certificate warnings, disable safeguards, or create a paid service.

This path can validate visuals, route handling, queue logic and selected real media, but cannot validate deployed RLS, Vercel runtime system-variable exposure, real catalog key restrictions/quota, production auth/webhooks, social crawler rewrites or PWA origin behavior end-to-end. A production-configured staging deployment is **not** isolated from production writes: telemetry, sign-in and existing server integrations can still act on live services, and a Production target can involve cron behavior. `--skip-domain` only defers domain assignment. Do not use it as a substitute for a safe Preview under the current no-deployment instruction.

**Precise remaining release risk:** compilation/mocked tests can pass while the real deployment has blocked embeds/autoplay, lost LIVE continuity, missing feed access, incorrect Production classification, cold-link failures or service-worker update interruption. No current real Chrome/Safari/PWA evidence resolves those risks, so this candidate is not approved for launch yet.

## 7. Remaining tests and GO / NO-GO

- [ ] Chrome and desktop/mobile Safari: Home/EXPLORE responsive rendering; loading/empty/partial/error content; category filtering and Show More; keyboard/modal close behavior.
- [ ] Real LIVE gesture play/pause, Home ↔ EXPLORE continuity, compact/full transitions, metadata, reconnect, Safari lock screen/background behavior.
- [ ] Exact selected video, no radio overlap, Next/Previous boundaries, ended/autoplay, blocked-play recovery, stale messages and repeating-Short manual Next; no automatic radio restart on modal close.
- [ ] Cold refresh and back/forward on Explore shared-video, Scroll and show/listen handoffs; support hashes and unknown-path fallback. Confirm candidate bridge separately from the currently hosted bridge.
- [ ] Installed PWA: first install, existing-client update while audio is playing, reopen/offline shell, no embed-to-SPA fallback, rollback asset/cache behavior. PWA cannot be signed off from a localhost development pass.
- [ ] Privately confirm actual Production RLS/grants and system metadata without production SQL/credential disclosure; verify existing admin, Auth, ingestion and webhook functionality through reviewed evidence/safe staging policy before release.
- [ ] Owner confirms unchanged Stripe destinations still show the intended merchant, amount/currency, one-time/recurring mode and return URL, without submitting a payment.
- [ ] Review existing YouTube quota/key restrictions and accept remaining valid-request quota-abuse risk. No active custom firewall protection was established in the earlier assessment.

**GO for the isolated local candidate and review. NO-GO for production deployment today until the required browser/media/PWA and environment checks are recorded and explicit deployment authorization is received.** Drop Portal scope blocker is resolved. The 11 moderate inherited entries are not a demonstrated exploitable web path; they remain a documented warning. Missing Docker/local database validation alone does not block this existing-backend web release.

Existing concerns from the earlier assessment remain outside this change: repository migrations permit anonymous reads on donations/page_visits, actual live grants are unverified, and FIREBASE_SERVICE_ACCOUNT_JSON was absent from the Production name listing. If private-data exposure is confirmed, treat it as a blocker requiring separately authorized remediation. Native push/send is not required for today's web UI; do not silently configure or remove it.

## 8. Future deployment and rollback — not executed

1. Reconfirm domain/project/team and current production SHA/ID. If production has moved, compare again and revalidate the candidate before proceeding. Keep this report and personal files out of deployment sources. Use a clean checkout of `46455d5caa6353762524e3674c8aeca334c2e3e9`, with the verified existing Vercel project link.
2. Complete safe browser validation above and review remaining warning acceptance. Verify Production variable names and automatic VERCEL_ENV/VERCEL_TARGET_ENV exposure without downloading values. Both must classify Production correctly; absent/conflicting metadata deliberately denies privileged operations or fails the build. Do not weaken isolation to pass a test.
3. Obtain explicit authorization for deployment, including any production-connected smoke testing. No push/merge is needed just to inspect this local candidate; any push/merge needs its own authorization. Normal branch Preview using today's shared variables is not an approved route.
4. After authorization only, stage a remote Production build on the existing project: `vercel --scope johns-projects-861a7d26 deploy --prod --skip-domain`. Record its source SHA/build/deployment ID and verify it is the reviewed candidate. This is a deployment and can access live integrations; it is not authorized now. Avoid using the local build artifact or promoting a restricted Preview build.
5. Use existing Vercel authentication, without disabling SSO. Perform only the specifically authorized staging smoke checks; prohibit payments, uploads, push sends, manual ingestion, trial writes or SQL. Check guard classification, Home/Explore, public catalog/media and intended auth/admin behavior. Stop on failure.
6. After explicit promotion authorization, `vercel --scope johns-projects-861a7d26 promote <verified-staged-production-id-or-url>`. Verify apex/www now resolve to that exact deployment and run the immediate public smoke checklist. No migration, station change, native sync/release, credential update or new paid service accompanies it.
7. Rollback target for a future PULSE promotion is current baseline **`dpl_CCV6ZTvgme8Anj9axBtswKZKMSc8`**, commit **`c511c8905cffd9c11301d00a25b73d51127fc0f5`**. Reconfirm availability immediately before launch. Under rollback authorization, use `vercel --scope johns-projects-861a7d26 rollback dpl_CCV6ZTvgme8Anj9axBtswKZKMSc8`, then verify apex/www, LIVE, videos and installed PWA after reopen/reload. Do not pick an older pre-embed-fix build merely because it is READY.
8. Rollback restores routing/code, not payments, telemetry or database writes. No production migration should need reversal. Review automatic domain-assignment status before a future authorized promotion; rollback can alter that workflow. See [Vercel deployment promotion guidance](https://vercel.com/docs/deployments/promoting-a-deployment).

## Exact included file manifest

Paths below are the committed candidate diff against its verified production parent. This report itself is excluded.

```text
api/_lib/adminAuth.js
api/_lib/previewGuard.js
api/admin-invite.js
api/admin-team.js
api/analytics.js
api/delete-account.js
api/ingest-feed.js
api/og/[id].js
api/push/register.js
api/push/send.js
api/stripe-webhook.js
api/youtube.js
docs/PULSE-Phase4B-final-validation.md
docs/PULSE-Phase4B-security-review.md
docs/PULSE-Phase4C1-dependency-readiness.md
docs/PULSE-Phase4C2-release-remediation.md
docs/PULSE-Phase4C3-native-packaging-assessment.md
docs/PULSE-Phase4C4-youtube-proxy-protection.md
docs/PULSE-Phase4C5-hosted-preview-validation.md
docs/PULSE-Phase4C5D-test-backend-setup.md
docs/PULSE-autoplay-runtime-diagnostics.md
docs/PULSE-continuous-playback-feasibility.md
docs/PULSE-shorts-repeat-assessment.md
lib/previewPolicy.mjs
package-lock.json
package.json
public/yt-embed.html
src/App.jsx
src/components/ChimeIn.jsx
src/components/FeedCard.css
src/components/FeedCard.jsx
src/components/MerchSection.jsx
src/components/NowPlayingPanel.jsx
src/components/ReelsGrid.jsx
src/components/ScrollFeed.css
src/components/ScrollFeed.jsx
src/components/TrueVoiceConnect.jsx
src/components/VideoModal.css
src/components/VideoModal.jsx
src/components/VideoThumbnail.jsx
src/features/pulse/DiscoveryRail.jsx
src/features/pulse/MediaCoordinationContext.js
src/features/pulse/PulseExplore.css
src/features/pulse/PulseHome.css
src/features/pulse/PulseIntro.css
src/features/pulse/PulseIntro.jsx
src/features/pulse/PulseLive.css
src/features/pulse/PulseLive.jsx
src/features/pulse/PulseTheme.css
src/features/pulse/exploreContent.js
src/features/pulse/mediaCoordinator.js
src/features/pulse/videoDiagnostics.js
src/features/pulse/videoEngagement.js
src/features/pulse/videoProgress.js
src/features/pulse/videoQueue.js
src/hooks/useFeedItems.js
src/hooks/useYouTubeFeed.js
src/hooks/useYouTubeLatest.js
src/hooks/useYouTubePlayer.js
src/lib/analytics.js
src/lib/apiBase.js
src/lib/previewSafety.js
src/lib/queryHandoff.js
src/lib/scrollItems.js
src/lib/supabaseClient.js
src/lib/supabaseRealtime.js
src/lib/videoEmbed.js
src/lib/visitorStore.js
src/lib/youtubeCatalog.js
src/pages/PulseExplore.jsx
tests/pulse-bridge.test.mjs
tests/pulse-dependency-security.test.mjs
tests/pulse-playback.test.mjs
tests/pulse-preview-security.test.mjs
tests/pulse-release-security.test.mjs
tests/pulse-stabilization.test.mjs
tools/native-assets/README.md
tools/native-assets/package-lock.json
tools/native-assets/package.json
vite.config.js
```
