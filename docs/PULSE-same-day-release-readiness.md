# TrueVoice PULSE — same-day web release readiness

Assessment date: 2026-10-15 (America/Phoenix). **Decision: NO-GO for the current branch as-is.** Local focused checks pass, but unrelated upload functionality is included and live release verification remains incomplete. This is preparation only. No push, merge, deployment, production SQL, credential change, firewall change, or external infrastructure change was performed. MY PULSE was not started.

## 1. Exact release scope

| Item | Verified identifier |
| --- | --- |
| Branch | `feature/truevoice-pulse` |
| Starting and assessed application HEAD | `3c39fa7ea7114f0e3f3ec79426fb7e7bbc82783f` |
| Local main and origin/main | `c511c8905cffd9c11301d00a25b73d51127fc0f5` |
| Actual production commit, independently confirmed through Vercel domain deployment metadata | `c511c8905cffd9c11301d00a25b73d51127fc0f5` |
| Actual production deployment | `dpl_CCV6ZTvgme8Anj9axBtswKZKMSc8` — READY, production, Git/main |
| Production deployment hostname | `true-voice-digital-i8ckaj637-johns-projects-861a7d26.vercel.app` |

The readiness document is an uncommitted addition; no new release commit was created. A scope-cleaned candidate does not yet exist and must receive a new exact SHA and validation before approval. Remote branch freshness could not be independently checked: `git ls-remote` failed with Windows Schannel `SEC_E_NO_CREDENTIALS`. Actual production identity above came from authenticated Vercel, not the cached Git ref.

Exact commits in `main..HEAD`, oldest first:

| SHA | Change |
| --- | --- |
| `0018cb405a8db16cbd3a19c6546b2ac000e750a4` | Unrelated WIP Drop Portal |
| `ab8e643d39bd6f28ca15ef445897fd274d1ecaec` | PULSE Home and visual system |
| `f16975d179aac6944cccb8384ab8c00a0f5da38c` | Persistent playback and video-first Scroll |
| `275ec666d65a4aa736b2efaac32199aab09fd1ee` | EXPLORE discovery |
| `27dea31e5f95c89fadc22d7cd7b3d2855d210d8e` | Playback/navigation stabilization |
| `3079e1eb6e2c22b9377717cef8747c4299d7d4f2` | Dependency and PWA security remediation |
| `5f23839b15439d67180d5f9c18ecc32335c8f930` | Isolated native asset tooling |
| `d3e71dfbb930137885c4e63b94aee1493cc7b544` | Proxy protection assessment |
| `db7573e9cc12cbfdd2c370ba4496d509e1f2c176` | Fail-closed Preview isolation |
| `3c39fa7ea7114f0e3f3ec79426fb7e7bbc82783f` | Test backend setup procedure |

The diff contains 86 files, 10,870 insertions and 3,285 deletions. Functional scope: App routing/layout/media ownership; Home/LIVE/EXPLORE styles and components; Scroll selection; modal/player/queue/progress/bridge handling; shared YouTube catalog transport; Preview guards on clients and privileged APIs; dependency locks/PWA build; docs/tests/tooling.

**Exclude Drop Portal from today's release:** `DROP_PORTAL_SETUP.md`, `api/drop-upload.js`, `src/pages/DropPortal.jsx`, `src/pages/DropPortal.css`, `supabase/migrations/20260920140000_drop_uploads_storage_bucket.sql`, plus its App import, `/drop` route and route exclusions. Do not blindly revert all of App.jsx or the shared Preview guards. The portal uploads to Storage before checking its shared password at the forwarding endpoint; its migration grants anonymous INSERT independently of that password. It then uses a service key to download/delete objects and an AzuraCast key to upload station media. This is unrelated production-write scope and must not ship incidentally. Nothing was removed during this assessment.

No `ios/`, `android/`, or Capacitor configuration diff exists against main. Native setup documentation and optional asset-generator isolation changed; normal root installs no longer include that optional generator. `npm run build` is web-only. Do not run `cap:sync`, native asset generation, store builds, or native releases. Existing installed native apps still consume shared production APIs/hosted bridge, so include compatibility smoke checks for those shared endpoints without rebuilding native apps.

Pre-existing untracked `Claude outputs/` was left untouched and must not be included in a release upload.

## 2. Tests and build

| Check | Result |
| --- | --- |
| `NODE_ENV=development node --test tests/*.test.mjs` | **57 passed, 0 failed**, all six test files |
| Production/PWA `npm.cmd run build` with `VERCEL=1`, `VERCEL_ENV=production`, `VERCEL_TARGET_ENV=production` | **PASS**, Vite 7.3.7, 809 modules, PWA 1.2.0, generated sw.js/workbox, 13 precache entries / 1029.39 KiB |
| Targeted ESLint | **PASS**, no output/errors |
| `git diff --check` | **PASS** |
| `npm audit --omit=dev --json` | **11 moderate**, 0 high, 0 critical; exit 1 |
| Full `npm audit --json` | **11 moderate**, 0 high, 0 critical; exit 1 |
| Repository-wide `npm run lint` | **FAIL**, 611 errors / 2 warnings; not claimed clean |
| Real browser visual/audio/end-to-end checks | **Unverified**: browser connector reported no browser available |
| Public HEAD probes | Environment connection failures for site, metadata, stream and Stripe; no service outage conclusion can be drawn |

Targeted lint covered `src/features/pulse`, `src/pages/PulseExplore.jsx`, `src/components/VideoModal.jsx`, `src/hooks/useYouTubePlayer.js`, `src/lib/previewSafety.js`, `src/lib/youtubeCatalog.js`, `api/youtube.js`, `api/_lib/previewGuard.js`. It does not cover every changed file. Full lint includes legacy source issues and scripts/server files under browser-oriented rules; no same-run main baseline was produced, so the full count is not asserted to be entirely pre-existing.

The first test/build attempts failed because esbuild could not read the parent directory under sandbox restrictions. Reruns with local build permissions succeeded. The first test run also lacked explicit local deployment context and its proxy mock received 503; the successful run set NODE_ENV=development, which the deployment policy explicitly permits. npm.ps1 was blocked by PowerShell policy; npm.cmd worked without changing that policy.

The production build used existing local configuration plus explicit production system metadata, not fetched Production secret values. This proves compilation/PWA generation, not parity with all deployed values. Build warns about a 940.68 kB JavaScript chunk (281.21 kB gzip).

Tests exercise actual React components with mocks and production policy paths: Home/Explore shared parent and media ownership, compact/full controls, modal selection and queue snapshots, stale-event rejection, Next/Previous and genuine ENDED, blocked autoplay, Short-repeat manual Next, categories/empty/error states, cold deep links and handoffs, iframe bridge/progress, proxy validation/limits/sanitized errors, production admin/payment eligibility, Preview denial before privileged initialization, read-only Preview transport, patched dependencies, generated worker precache/cache/navigation policies, and existing native asset references. They do not prove live playback or deployed RLS.

### Local Supabase validation

Docker is not on PATH, and neither the standard Docker Desktop executable nor Docker CLI path exists. Supabase command shim exists, but `supabase --version` fails attempting to write its telemetry file outside the workspace. No installation or remote linking was attempted. Thus the condition for isolated local Supabase execution is unmet.

Phase 4C.5D documents selected schema, synthetic fixtures, hardening and grants/RLS checks; it is not an existing runnable local validation harness. Those SQL checks were **not executed**. Remaining checks: guest SELECT of active/auto_active feed only, hidden fixture exclusion, denied anon/authenticated writes, empty test Auth/admin/reaction/storage, and exposed functions/grants review. These are relevant to a new isolated Preview backend. PULSE reuses production feed tables already used by Scroll and needs no database migration for its new read-only discovery UI. Missing Docker alone is **not a release blocker**. Actual production policy/grant parity remains unverified and must not be inferred from migration text. No production SQL or trial writes were run.

## 3. Production integration safety

| Integration | Findings and limits |
| --- | --- |
| Supabase | Same client variable names and existing backend. PULSE reads live feed rows, excludes verses, orders published_at/id and selects a wider pool for diversity. Repository feed RLS allows active/auto_active reads and admin-managed writes; reactions require user identity. No PULSE schema changes are needed. Actual deployed RLS/grants were not inspected. |
| Production writes | Existing page_visits POST and analytics_events collector remain enabled in Production; existing chat/reactions/auth/admin/webhook/push/ingestion behavior remains. PULSE Likes are localStorage only; Share/queue/progress add no database permissions. More routes can generate existing telemetry. Drop Portal is the unrelated new storage/station write path described above. |
| LIVE365 audio | Default remains `https://streaming.live365.com/a61535`; `VITE_TRUEVOICE_STREAM_URL` can override it and exists in Production. Its value was not read, so the actual configured stream host is not confirmed. Shared Home/Explore parent retains the audio controller; video takes ownership, pauses radio and does not silently resume it on close. Existing AzuraCast fallback remains. Tests prove controller behavior, not real stream continuity. |
| AzuraCast metadata | Existing public GET at base URL plus `/api/nowplaying/truevoice_digital`; Production has VITE_AZURACAST_BASE_URL. Default station slug is used unless configured. No station-management credential needed for PULSE. Fifteen-second polling and delayed song presentation remain; direct availability/CORS unverified. |
| YouTube proxy | GET/OPTIONS only; fixed Google host; allowlisted channels/contentDetails, playlistItems/snippet, videos/snippet,statistics; bounded IDs/count/query size; redirect rejection; 8-second timeout; 1 MiB response cap; sanitized errors. Production keeps VITE_YOUTUBE_API_KEY fallback to YOUTUBE_API_KEY. Feed and admin analytics request forms pass tests. No search/arbitrary URL relay. |
| YouTube abuse/key risk | No in-code shared quota/rate limiter/cache or channel allowlist. Syntactically valid arbitrary catalog IDs can consume shared quota. Vercel active firewall lookup returned 404 `Seawall Config not found`; no quota-specific rule can be credited. Google key restrictions/quota/alerts were not accessible. Existing VITE_ key is client-exposed by design; no actual key or built key value was inspected. This is a residual risk requiring owner review, not evidence of active abuse. Do not add paid protection or change firewall/credentials for this assessment. |
| Stripe payment links | Four fixed HTTPS buy.stripe.com links in App.jsx are unchanged against main; production opens existing checkout, Preview suppresses payment actions. No new checkout service, price, webhook contract or payment write. Webhook still verifies Stripe signature. Merchant, price, currency, mode and live checkout availability require an owner/browser check without purchasing. |
| Authentication | Existing Supabase session/sign-in remains in Production; Preview disables session persistence/URL detection/auth transport. Admin API verifies bearer token with Supabase and checks admin_users; missing/invalid/nonadmin paths covered by tests. No new provider or callback required for web PULSE. |
| Storage | PULSE uses public thumbnails/art/assets; no new bucket/upload permission required. Drop Portal bucket/anonymous INSERT migration is unrelated and excluded. Existing production storage grants remain unverified. |
| Privileged analytics/admin routes | API admin-team/invite and push/send use server admin verification; cron ingestion requires CRON_SECRET; webhook requires Stripe signature; delete-account requires identity. Preview guard precedes privileged work. `/api/analytics` is intentionally a public event collector, not an admin reporting endpoint, and still performs service-role inserts in Production. |
| Analytics data access | Admin UI reads Supabase directly. Repository migrations allow anonymous SELECT on donations and page_visits; UI login is not database access control. analytics_events migration is service-role-only, which may also prevent direct authenticated dashboard reads. These are existing policy concerns, not changed by PULSE; actual deployed policy status and sensitive columns must be reviewed privately before claiming privileged data is protected. No donor/visit records were fetched. |

### Preview isolation versus legitimate Production

`classifyDeployment` requires both VERCEL_ENV and VERCEL_TARGET_ENV to equal production for Production permission. Conflicting, absent or custom metadata fails closed; request headers cannot override it. Production classification bypasses Preview credential prohibitions/read-only transport and retains auth, payments, telemetry and privileged routes in tests.

Vercel documents both variables at build/runtime: [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables). Actual system-variable exposure for a newly built release has not been demonstrated. If either is absent, the build aborts and Functions deny legitimate traffic. Verify automatic system-variable exposure and staged runtime classification before promotion; do not weaken the guard or set contradictory overrides.

Current Preview variable targets include SUPABASE_SERVICE_KEY, SUPABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PRINTFUL_API_KEY and VITE_YOUTUBE_API_KEY. The new guard intentionally rejects that configuration. No dedicated test backend refs were shown in the variable-name listing. A normal branch Preview is therefore not a usable release validation target as currently configured. This does not block correctly classified Production; do not promote a Preview build or provision a new paid backend to work around it.

## 4. Existing deployment and rollback configuration

Authenticated Vercel project inspection and domain deployment lookup confirmed:

- Team `team_qJIIDlYcPRRWTRbel8YtLlxd`, scope `johns-projects-861a7d26`.
- Project `true-voice-digital`, ID `prj_OMhlrkRX8NFQCMidqT4Z0shSzKOt`; local .vercel link matches.
- Domains include `truevoice.digital` and `www.truevoice.digital`, both aliases of the current deployment.
- Vite preset, root `.`, Node 24.x, install `npm install`, build `npm run build`, output `dist`; current deployment region iad1.
- Password protection disabled; SSO enabled for `all_except_custom_domains`; no trusted-IP restriction reported.
- vercel.json is unchanged against main: API rewrite, crawler Scroll OG rewrite, SPA fallback and existing daily ingest cron at `0 13 * * *`.

`vercel env ls production` confirmed **names and targets only**, without decrypting/fetching values:

| Requirement | Configured Production names |
| --- | --- |
| Public Supabase client | VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY |
| Existing server Supabase routes | SUPABASE_URL, SUPABASE_SERVICE_KEY |
| YouTube | YOUTUBE_API_KEY, VITE_YOUTUBE_API_KEY, VITE_YOUTUBE_CHANNEL_ID |
| Audio/metadata | VITE_TRUEVOICE_STREAM_URL, VITE_STREAM_DELAY_SEC, VITE_STREAM_METADATA_DELAY_SEC, VITE_AZURACAST_BASE_URL, VITE_AZURACAST_PROXY_URL, VITE_AZURACAST_STATION_ID, VITE_TRUEVOICE_PUBLIC_PAGE_URL |
| Existing payments | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY |
| Existing telemetry/cron | VITE_ANALYTICS_SITE_ID, VITE_ANALYTICS_ENDPOINT, CRON_SECRET |
| Other existing configuration | NEXT_PUBLIC_SITE_URL, PRINTFUL_STORE_ID, PRINTFUL_API_KEY, VITE_ADMIN_PIN |

VITE_AZURACAST_STATION_SLUG and VITE_SITE_URL are absent; source has defaults. DROP_PORTAL_PASSWORD and AZURACAST_API_KEY are absent, further confirming the unrelated portal is not configured. FIREBASE_SERVICE_ACCOUNT_JSON is absent: existing push/send parses it at module initialization in Production and may fail if called. Native push sending is not needed for web PULSE; do not enable/configure it today.

Rollback baseline for a future PULSE launch is **today's current production** `dpl_CCV6ZTvgme8Anj9axBtswKZKMSc8`, commit `c511c8905cffd9c11301d00a25b73d51127fc0f5`, READY and marked rollback candidate. This is the operational baseline, not a newly end-to-end-certified deployment. The next older READY production rollback candidate is `dpl_AxXMBYM1ECYcenW2SC8jAu6FczDh`, commit `066297dc4594557083e15fa291b07f0259bbf95d`, hostname `true-voice-digital-l8xh7548p-johns-projects-861a7d26.vercel.app`. Its commit precedes the embed denylist/audio fix in current main, so it is **not recommended as known-good for video**. No additional independently smoke-tested previous deployment can honestly be certified here.

## 5. Findings and launch gates

| Classification | Finding / required treatment |
| --- | --- |
| BLOCKER | Current branch includes unrelated Drop Portal route, upload Function and storage permission migration. Prepare a candidate excluding them; record its new SHA and rerun checks. Do not ship the whole branch as-is. |
| BLOCKER — verification gate | Home/EXPLORE visual rendering, real LIVE continuity, video/embed autoplay and queue, installed PWA update behavior and Production guard runtime have no current end-to-end evidence. Complete the checklist on the exact staged Production candidate before promotion. No browser was connected; this is an evidence gap, not a demonstrated playback defect. |
| WARNING | Isolated local database checks unavailable because Docker is absent. Workaround for today's existing production read path: no migration or new permission; retain existing backend. Do not treat this alone as NO-GO. |
| WARNING | Preview rejects inherited production credentials by design. Use an explicitly authorized staged Production build for final checks; do not change settings or create services during preparation. |
| WARNING | YouTube quota protection/key restrictions unverified; no active custom firewall config retrieved. Existing bounded proxy is improved, but repeated valid requests remain possible. Owner must review existing quota/usage and accept residual risk before GO. |
| WARNING | Existing anonymous analytics/donation/visit read policies require private review; no live policy proof available. If sensitive data is actually public, escalate to BLOCKER and resolve under separate authorization. |
| WARNING | Full lint fails (611 errors/2 warnings); targeted security/PULSE subset passes. Workaround: constrain release scope, review changed-file findings, do not claim repository lint is green. |
| WARNING | Eleven moderate Firebase/Google/uuid dependency entries remain; no high/critical. Web PULSE does not invoke push/send. Keep optional native asset tooling excluded and address upgrades separately. |
| WARNING | PWA retains autoUpdate, skipWaiting and clientsClaim. Comments suggesting prompt behavior are stale; no deferred-activation guarantee exists. Test an already open playing PWA across release. |
| WARNING | Stripe destinations unchanged but live merchant/amount/checkout status unverified. Verify without payment before GO. |
| WARNING | Native push/send lacks its Firebase variable and can fail on invocation; outside today's web flow, leave unused. |
| FOLLOW-UP | Split the 940.68 kB JS chunk, reconcile PWA comments, establish lint baseline, review analytics collection validation/privacy and repair authenticated analytics reporting policy/API design. |

Warnings above describe this assessor's proposed same-day workarounds. They do not represent owner acceptance already received. No paid service is required by PULSE; no external-service or native configuration change is required for its discovery/playback UI after excluding Drop Portal.

The read-only CLI firewall-status fallback also failed while loading the user (`err` out-of-range error); it provided no additional firewall evidence. Neither failure justifies changing settings or assuming protection exists.

## 6. Deployment procedure — only after explicit authorization

1. Resolve the scope blocker locally without rewriting/pushing history, obtain an exact reviewed candidate SHA, and keep untracked personal files out. Recheck current production domain deployment and rollback ID immediately before release.
2. Rerun the six focused test files in explicit development context, targeted lint, production/PWA build and audit. Review all changed-file lint findings. Confirm no SQL/native sync/build scripts or new integration setup are in the web deployment path.
3. Privately confirm automatic system variables are exposed at build/runtime and the Production names above remain present. Confirm existing feed reads/RLS and checkout destinations through authorized owner evidence; do not run production SQL or test writes.
4. Obtain explicit authorization for a staged Production deployment and subsequent promotion. This report provides neither authorization. Use the existing project/team and standard remote Production build so Vercel supplies the Production environment. A local build with local values is not a substitute.
5. After authorization only, from the reviewed clean candidate: `vercel --scope johns-projects-861a7d26 deploy --prod --skip-domain`. This creates a deployment even though it does not assign the production domains. Record its deployment ID, source SHA and build metadata. Do not promote an existing restricted Preview.
6. Use existing authorized Vercel authentication for the protected staged URL; do not disable SSO. Complete Home/Explore/audio/queue/deep-link and safe API checks below. Confirm Functions allow Production classification and do not return Preview-denial errors. Stop on any failure.
7. After explicit promotion authorization, `vercel --scope johns-projects-861a7d26 promote <verified-staged-production-url-or-id>`. Confirm apex/www point to that exact ID/SHA. No DB migration, credential change, station modification, firewall change or native release accompanies this operation.

## 7. Rollback procedure — do not execute during preparation

1. On playback failure, blank Home/EXPLORE, unexpected 403 Preview denials, write-permission exposure or checkout misrouting, stop promotion or roll back immediately under release authorization. Preserve nonsecret error/status evidence.
2. Reconfirm the baseline remains available in the same project/team. Restore `dpl_CCV6ZTvgme8Anj9axBtswKZKMSc8` using the existing dashboard rollback or `vercel --scope johns-projects-861a7d26 rollback dpl_CCV6ZTvgme8Anj9axBtswKZKMSc8`.
3. Verify apex/www aliases, baseline SHA, Home, live audio, embed playback and checkout links. Check a fresh session and an already installed PWA: cached clients may need reopen/reload to receive the restored worker/assets.
4. Rollback restores code/domain routing; it does not undo telemetry, payments, station writes or SQL. None should be introduced by this launch. Do not run compensating production SQL.
5. Vercel rollback can disable automatic production-domain assignment; review the release state before a later authorized promotion. See [promotion/rollback guidance](https://vercel.com/docs/deployments/promoting-a-deployment).

## 8. Immediate smoke-test checklist

Run first on the authorized staged Production deployment, then immediately on apex and www after promotion. Never post user content, pay, send push, upload media or execute a migration as a smoke test.

- [ ] Confirm deployment ID/SHA, no build/runtime Preview-isolation error, no service-role secret in browser/network output.
- [ ] Home desktop/mobile renders PULSE, LIVE controls, content, support links and navigation without blank/error states.
- [ ] EXPLORE loads active curated videos and channels; test All/Music/Videos/creators/podcasts, loading/empty/error recovery and Show More.
- [ ] Start LIVE by gesture; verify audible stream and metadata. Move Home ↔ EXPLORE and change layout/scroll without restart, duplicate audio or losing pause state. Check mobile Safari and lock-screen controls on an existing PWA.
- [ ] Open the exact selected video; verify radio pauses, official player plays, only one video is audible, Next/Previous preserve queue and genuine ENDED advances only when enabled. Manual Next remains available for repeating Shorts. Close video: radio stays paused until a deliberate play.
- [ ] Cold-load/refresh `/explore?video=<available-id>`, `/scroll/<existing-id>`, `/?listen=1` and a valid show handoff; check back/forward, hashes, invalid/unavailable IDs and share-link identity.
- [ ] Confirm YouTube catalog valid feed/statistics requests work; unsupported endpoint/query and non-GET method are rejected without upstream work. No load/quota stress test.
- [ ] Check PWA manifest/install, generated worker, offline shell and real `/yt-embed.html?...` navigation; test an already open playing PWA across update with no shell embedded inside the video or unprompted double audio.
- [ ] Open existing Stripe links without submitting payment; owner verifies merchant, amount/currency, recurring versus one-time, live mode and return URL. Query `thanks` only displays UI and does not grant entitlement.
- [ ] Signed-out admin routes expose no privileged UI/data; safe unauthorized admin API calls reject. Confirm real RLS/grant evidence privately, including donations/page_visits; do not fetch private records to demonstrate exposure.
- [ ] Confirm PULSE Like is local-only and discovery adds no new write/Storage requests. Existing production telemetry remains expected; do not enable Drop Portal.
- [ ] Check existing Functions errors/metadata/YouTube failures and audio health through current tooling. Confirm rollback baseline remains selectable and record smoke-test owner/time/result.

## Final recommendation

**NO-GO for `3c39fa7ea7114f0e3f3ec79426fb7e7bbc82783f` as-is.** The focused application/security suite and web/PWA build are green. Same-day release can use existing infrastructure without paid additions or native changes, but needs a scoped candidate excluding Drop Portal and live verification of that exact candidate. Missing Docker is not the reason for this decision. Stop here; do not deploy until explicitly authorized.
