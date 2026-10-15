# PULSE Phase 4C.5: preview readiness and blocked validation

Date: October 14, 2026. Branch: feature/truevoice-pulse.
Security milestone: `5f23839b15439d67180d5f9c18ecc32335c8f930`.
Assessment commit: `d3e71dfbb930137885c4e63b94aee1493cc7b544`.

## Outcome

**STOP before deployment: safe Preview environment isolation could not be
verified.** No preview was created, no hosted functionality was tested, and no
production/native configuration was changed. Required variable names exist in
the general Preview scope, but multiple entries target both Preview and Production,
including privileged backend/payment credentials. There are no listed branch
overrides for feature/truevoice-pulse. Variable presence is not evidence of safe
backend access, key restrictions or runtime validity.

This does not assert that sharing variables is inherently forbidden or that the
project is compromised. It means the required isolated/safe configuration cannot
be attested within this task. The earlier assessment calls for approved
nonproduction data or explicitly reviewed read-only production access; neither
has been verified. Do not quietly create a full app/API preview with that assumption.

| Requested deployment record | Result |
| --- | --- |
| Preview URL | None; not deployed |
| Preview deployment ID | None |
| Deployed preview commit | None |
| Candidate source commit | d3e71dfbb930137885c4e63b94aee1493cc7b544 on feature/truevoice-pulse |
| Production project | Verified true-voice-digital, prj_OMhlrkRX8NFQCMidqT4Z0shSzKOt |
| Production deployment | dpl_CCV6ZTvgme8Anj9axBtswKZKMSc8, READY, target production |
| Production Git source | main, c511c8905cffd9c11301d00a25b73d51127fc0f5 |

## Assessment commit and destination checks

Only docs/PULSE-Phase4C4-youtube-proxy-protection.md was staged and committed,
with message `docs: assess PULSE YouTube proxy release protection`. Claude outputs
was excluded. Local branch/HEAD and staged whitespace checks passed.

Read-only Vercel project and deployment queries confirm the project identity,
production commit/target and existing aliases including www.truevoice.digital
and truevoice.digital. SSO is reported enabled for all_except_custom_domains.
Preview deployment would require explicit target=preview from the reviewed branch
revision, without --prod, promote or production alias assignment. That command
would keep production hosting separate, but **no deployment request was issued**.
No preview artifact/target/alias isolation can be verified after deployment because
there is no new deployment. Production remains associated with the same main SHA.

## Environment evidence and blocker

CLI `vercel env ls preview feature/truevoice-pulse` returned no branch-specific
entries. A subsequent `vercel env ls preview` returned general Preview variables.
The first result must not be interpreted as absence of all effective Preview vars.
CLI authentication became available during the read-only listing; no deployment,
project relinking or environment mutation was performed.

Only names, encrypted markers and environment targets were displayed. No value
was decrypted, pulled, printed, written to a build log or copied into a preview.
The connector's metadata-list attempt returned an error, so the successful CLI
listing is the source for environment evidence.

| Configuration | Verified metadata / remaining unknown |
| --- | --- |
| YouTube proxy | YOUTUBE_API_KEY targets Preview and Production; VITE_YOUTUBE_API_KEY targets Development/Preview/Production. The VITE key takes precedence in current handler; actual key validity/restrictions/preview quota isolation not verified |
| Supabase client | VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY target Preview and Production; source requires them at client creation. Nonproduction endpoint/RLS and reviewed production access not verified |
| Privileged Supabase | SUPABASE_URL and SUPABASE_SERVICE_KEY target Preview and Production; full root API deploy includes backend routes. No separately restricted test access attested |
| Payment/backend secrets | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PRINTFUL_API_KEY and related configuration target both Preview and Production. Their values were not read; no explicit proxy-only scope or safe sandbox attested |
| Playback | VITE_TRUEVOICE_STREAM_URL and VITE_STREAM_DELAY_SEC are Preview entries; other stream/metadata delay settings span environments. Actual endpoint/value compatibility not inspected |
| Analytics | VITE_YOUTUBE_CHANNEL_ID targets Preview and Production; guest PULSE does not require the admin analytics panel |

Shared targets on these rows identify shared variable entries, not proof of
separate safe test credentials. A preview hosts the full application and API
directory; separate hosting is not sufficient to guarantee read-only backend
behavior. The browser app includes authenticated/write-capable features and
server routes. No secret or environment modification is authorized in this task.

To unblock: owner must review effective Preview variable targets/branch overrides,
confirm appropriate YouTube restrictions/budget and app data access, and establish
nonproduction credentials or an explicit reviewed access policy for the full
preview/API scope. Any changes require separate authorization. Do not remove
production variables, reuse/pull production secrets, or deploy an incomplete
preview just to obtain a URL. Then rerun destination/environment checks before
issuing the separately authorized preview deployment.

## Validation performed versus not performed

Local command:

```text
node --test tests/pulse-playback.test.mjs tests/pulse-bridge.test.mjs tests/pulse-stabilization.test.mjs
```

**38 passed.** Includes proxy allowlist/method/request/response/timeout/error
checks and navigation, deep links/history, thumbnails, modal/queue, Like/Share,
radio/video coordination, progress and bridge regressions. These are local mocked
and component tests, not hosted or physical-device evidence.

The committed Phase 4C.4 assessment records a passing local mock 429 check for
the actual catalog helper: one request, status preserved, no JSON decoding/retry
for browser and native modes. That evidence is unchanged; no edge rate-limit
test or new 429 traffic was generated here.

| Requested hosted check | Phase 4C.5 result |
| --- | --- |
| Home / EXPLORE / mobile layouts | Not run; no hosted preview |
| LIVE audio / metadata / radio-video coordination | Hosted audio/network behavior unverified; local coordination regressions pass |
| Thumbnails / modal playback / Next-Previous queue | Hosted player behavior unverified; local regressions pass |
| Like / Share / deep links / browser history | Hosted behavior unverified; local regressions pass |
| Proxy invalid methods/requests | Local mocked tests pass; preview Function emission/routing unverified |
| HTTP 429 | Previous local helper mocks pass; WAF/native CORS/headers unverified |
| PWA registration / updates | No hosted service-worker test or registration; prior local build evidence does not attest preview activation/update lifecycle |
| Browser-specific failures | None observed because no browser session was run; compatibility cannot be inferred |

## Request patterns and rate-limit recommendation

No hosted request traces exist, so **60 requests/minute/IP is not proven safe**.
The static evidence remains ~16 completely cold EXPLORE calls and up to ~44 for
cold Home across parent/latest/reels hooks. Two simultaneous cold Home users on
one shared IP can exceed 60. Five-minute memory and one-hour persisted feed data
reduce repeat demand; no shared in-flight cache suppresses concurrent duplicate
requests. No automatic 429 retry loop was identified.

Retain 60/min as a candidate after representative logging and preview validation,
not production enforcement approval. Use the documented generous log stage,
then proposed-threshold logging; measure cold/warm loads and shared IPs before
enforcement. If traces confirm duplicated requests, propose narrowly scoped
in-flight deduplication/cache unification for separate review. No new threshold
or caching change is justified by hosted measurements that do not exist.

Active WAF/rate-limit/bot/challenge rules and plan remain unverified from Phase
4C.4; no rules were queried as empty or credited as protective in this report.
IP/regional limits cannot guarantee a global YouTube daily budget. Google key
restrictions, quota usage, alert ownership and native-readable edge 429/CORS remain
open. Nothing was activated or load-tested on production or preview.

## Native gates and production decision

Unmodified Capacitor clients still target www.truevoice.digital, not a future
preview. Native origin/config is unchanged. Java/Android compilation, macOS/Xcode
archive/signing, fresh sync of stale generated configs, icons/splash/device tests,
background audio, push provisioning, hosted Safari/Capacitor player and service
worker lifecycle gates remain outstanding. Conditional Firebase/uuid acceptance
remains documented; no migration or native asset regeneration was performed.

**Production go/no-go: no-go for release sign-off.** Required preview environment
verification and hosted functionality evidence are missing; reported production
still has the old proxy source association. Review active edge protection and
Google quota/key evidence, obtain a safe preview, then validate the hardened
handler/client/PWA before any separately approved production rollout.

Only this new report remains uncommitted; tracked working tree is clean after
the assessment commit. Existing Claude outputs remains untracked/untouched.
No push, merge, deploy, WAF change, native/signing change, dependency change,
secret/environment mutation or MY PULSE work occurred.

## Phase 4C.5A: environment isolation plan

Assessment/preparation only, October 14, 2026, HEAD
`d3e71dfbb930137885c4e63b94aee1493cc7b544`. No credentials, policies, data,
environment targets, payment links, products or deployment were changed.
**Deployment remains blocked.** This section replaces a general concern about
shared variables with concrete code paths and an approval-dependent plan.

### Environment dependency inventory

Source scan covered src and api environment reads plus repository configuration.
Names below are variable names only. No .env file or decrypted cloud value was read.
Every VITE-prefixed value must be treated as public browser/native build material.
Server-only naming alone does not establish safe privileges or data isolation.

| Name(s) | Purpose and inspected consumer | Exposure / privileges | Minimum preview treatment |
| --- | --- | --- | --- |
| VITE_SUPABASE_URL | supabaseClient, supabaseRealtime and visitorStore project URL | Public endpoint; selects data/auth/storage backend | Separate test project (C) |
| VITE_SUPABASE_ANON_KEY | Same clients and visitorStore REST requests | Public anon/publishable-class credential; effective anon/authenticated permissions depend on grants/RLS/session; not read-only | Test project's compatible public key (C) |
| SUPABASE_URL | analytics, delete-account, drop-upload, ingest-feed, OG, push registration and adminAuth | Server endpoint; must match associated credential | Exclude for minimum preview (D); test project only if server features later approved (C) |
| SUPABASE_SERVICE_KEY | Same routes / adminAuth | Privileged RLS-bypassing data/storage/auth administration; analytics inserts, user deletion/invitations, moderation, ingestion, push writes | Exclude production credential; no service key needed for minimum PULSE preview (D) |
| STRIPE_SECRET_KEY | stripe-webhook.js Stripe client / charges lookup | Server payment API access; live/test mode unverified | Exclude (D); Stripe sandbox only for separate payment validation (B) |
| STRIPE_WEBHOOK_SECRET | Stripe signature verification | Server authentication of payment events; handler writes donations | Exclude (D); test webhook endpoint/secret only if separately approved (B) |
| STRIPE_PUBLISHABLE_KEY | Present in Vercel metadata; no inspected code env reference | Public payment identifier, not permission to expose live checkout | Exclude unnecessary entry (D) |
| YOUTUBE_API_KEY | youtube.js and ingest-feed.js | Server API quota credential; public catalog requests, not private user OAuth | Dedicated approved preview key/project budget (B); only proxy enabled |
| VITE_YOUTUBE_API_KEY | youtubeCatalog development path; analytics config check; server proxy/ingest first-choice key | Client-exposable quota credential; takes precedence over server key | Exclude Preview/build (D); use server YOUTUBE_API_KEY instead; admin analytics unavailable |
| VITE_YOUTUBE_CHANNEL_ID | Admin analytics uploads selection | Public channel ID, no privilege | Unnecessary for guest PULSE (D); only optional approved analytics scope |
| VITE_TRUEVOICE_STREAM_URL | App and useVerseRadioAudio LIVE URL | Public playback GET endpoint; no station control | Approved public LIVE365 listen URL/default (A) |
| VITE_STREAM_DELAY_SEC | NowPlayingPanel synchronization | Public numeric timing setting | Optional approved nonsecret playback value |
| VITE_AZURACAST_BASE_URL, VITE_AZURACAST_STATION_SLUG | services/api.js and azuracast.js metadata URLs | Public nowplaying GET endpoints | Approved public metadata endpoint/default (A) |
| AZURACAST_BASE_URL, AZURACAST_STATION | drop-upload server target | Server station management destination | Exclude unused upload settings (D) |
| AZURACAST_API_KEY | drop-upload.js station upload X-API-Key | Server station write/upload authority | Exclude (D); separate test station/account only for later upload testing (B/C) |
| DROP_PORTAL_PASSWORD | drop-upload shared-password gate | Server shared upload authorization; does not constrain direct anon storage insertion | Exclude (D) |
| CRON_SECRET | ingest-feed bearer authentication | Server ingestion/write authorization | Exclude (D); no manual ingestion or scheduled test job |
| FIREBASE_SERVICE_ACCOUNT_JSON | push/send.js credential.cert/admin messaging | Server service-account push delivery authority | Exclude (D); separate test Firebase project only if separately approved (B/C); no migration |
| VITE_ANALYTICS_ENDPOINT, VITE_ANALYTICS_SITE_ID | analytics.js automatic page/play events | Public event destination/label; HTTP POST writes through server endpoint | Omit production destination; disable narrowly for minimum preview, not just relabel |
| VITE_PUSH_REGISTER_ENDPOINT | native pushNotifications.js POST target | Public destination; registration writes via server service key | Exclude (D); browser path no-ops, native not part of this preview |
| VITE_SITE_URL | api/og/[id].js canonical URL | Public output URL used by server; OG currently uses service key to read feed | Unnecessary server route for minimum preview (D) |
| VITE_TRUEVOICE_YOUTUBE_URL, VITE_TRUEVOICE_X_URL, VITE_TRUEVOICE_INSTAGRAM_URL, VITE_TRUEVOICE_FACEBOOK_URL | App outbound social links | Public URLs; no secret or management privilege | Approved public links (A), no account modification |
| NEXT_PUBLIC_SITE_URL | Vercel-listed; no inspected application read | Nonsecret URL by convention; actual value not read | Exclude unused entry (D) |
| PRINTFUL_STORE_ID, PRINTFUL_API_KEY | Vercel-listed; no inspected src/api environment consumer | Store selector / potentially privileged commerce API key; actual rights unverified | Exclude (D); separate test account if future commerce scope (B) |
| VITE_STREAM_METADATA_DELAY_SEC, VITE_TRUEVOICE_PUBLIC_PAGE_URL | Vercel-listed; no matching current source read found | Public configuration by prefix, no credential expected | Exclude unused entries unless owner documents a consumer (D) |

No direct SMTP/Resend/email-provider environment reader was identified. Email is
sent indirectly through Supabase Auth: magic links and admin inviteUserByEmail.
Auth provider/SMTP settings, callback allowlists and backend permissions are
unknown because the Supabase dashboard was not inspected. SDK/platform-internal
environment configuration and external automation are outside this code inventory.

### Concrete write and payment risks

1. `App.jsx` calls useVisitorBeacon; visitorStore.recordVisit POSTs page_visits
   directly using the public key. The checked-in migration explicitly allows anon
   insert. Normal page navigation can write without a login or service key.
2. analytics.js is imported by main.jsx, sends page/navigation/play events to
   /api/analytics, and that handler inserts analytics_events with SUPABASE_SERVICE_KEY.
   A new site label does not isolate the target database.
3. The checked-in drop-uploads storage policy allows anon insertion into the
   bucket. The upload password is checked later by the server; it does not protect
   direct storage writes. Excluding the service key/password does not make the
   production public key safe for a generally accessible preview.
4. Authenticated chat messages/reports/feed reactions are insert/delete capable;
   admins update feed/moderation data, invite users and change passwords. Server
   delete-account can delete an authenticated user with privileged credentials.
   Auth-disabled UI alone would not revoke backend capabilities.
5. ChimeIn magic links hardcode a production callback. ReactionRail uses current
   origin/scroll. A preview login could email a link to production unless separately
   disabled or redirected only in approved preview code and test Auth configuration.
6. Home donation anchors use hardcoded buy.stripe.com URLs; MerchSection also
   contains outbound commerce navigation. No environment switch disables those
   links. Whether individual payment links are live-mode was not checked. Treat
   them as potentially production transactions; omitting Stripe keys is insufficient.

Checked-in migrations are evidence of intended permissions, not verification of
deployed policies. The donations migration's comment says non-PII reads, but its
anon SELECT policy is row-level and does not itself redact donor columns; actual
column grants/views remain unknown. Do not clone production tables or PII as seeds.
Supabase documents that public keys reach grants/RLS permissions while secret keys
bypass RLS. [Key privileges](https://supabase.com/docs/guides/getting-started/api-keys).
No broad "anon is harmless" or "authenticated equals safe" assumption is acceptable.

### Integration decisions A-D

- **A: public read-only sharing:** LIVE365 listen endpoint, public AzuraCast
  nowplaying, public YouTube embeds/thumbnails and approved public social links.
  These still produce service traffic/audience metrics and require normal usage
  restraint; no station/API management credentials are needed.
- **B: sandbox/test credentials:** dedicated YouTube quota key/project for proxy
  requests; Stripe test environment, test webhook and safe test links only if
  payments are added to a separately approved scope. Test email/Firebase/AzuraCast
  accounts only if their respective features are later included.
- **C: separate backend:** Supabase test project for public app data, Auth,
  Realtime and any permitted test writes. Use sanitized fixture feed/chat/schema,
  no production user/session/customer/device/donation clone. Actual RLS/grants,
  storage access and auth mail settings require review on that test project.
- **D: exclude for minimum preview:** privileged Supabase server credentials,
  Stripe/Printful secrets and payment actions, ingestion, admin mutation APIs,
  uploads, push sending/registration and production analytics. Do not supply
  dummy/fake credentials to suppress initialization errors.

### Minimum viable configuration and safeguards

Required effective variable allowlist:

```text
VITE_SUPABASE_URL        -> approved separate test Supabase endpoint
VITE_SUPABASE_ANON_KEY   -> compatible public key for that test project
YOUTUBE_API_KEY         -> approved preview quota credential, server-only
```

Optional nonsecret allowlist: VITE_TRUEVOICE_STREAM_URL, VITE_STREAM_DELAY_SEC,
VITE_AZURACAST_BASE_URL, VITE_AZURACAST_STATION_SLUG and reviewed social URLs.
Existing public stream/metadata defaults may suffice after endpoint verification.
Do not place a secret in any VITE-prefixed entry. Existing visitorStore raw REST
uses the anon value as a Bearer token as well as apikey: do not assume a new-style
publishable key is a drop-in JWT for that code. Verify compatibility or disable
that nonessential beacon with the narrow preview safeguard; no key migration here.

The test backend must expose approved fixture feed_items so Home/EXPLORE render
meaningful data, with appropriate schema for mounted components and harmless test
telemetry if retained. Modal queue/Like/Share/router/PWA need no service-role,
payment, Firebase or administrative secrets. Missing server credentials can
cause module-initialization errors in routes that create clients at import time;
simply leaving all those Functions deployed is not a clean disable strategy.

Environment changes alone **cannot** fully implement the safe preview. Separately
approve only these minimal preview-scoped safeguards, preserving production behavior:

- Disable automatic analytics/visitor telemetry or constrain all retained telemetry
  to the isolated test backend. No existing genuine disable switch is available;
  VITE_ANALYTICS_ENDPOINT pointing elsewhere is not an authorization control.
- Render payment/commerce actions noninteractive or omit them only in preview;
  do not change live Stripe products/links. No broad mock catalog or payment SDK needed.
- Disable preview Auth/admin/upload/push actions for this guest-only validation.
  If Auth is later tested, replace ChimeIn's production callback in the preview
  build and configure exact preview callbacks only in the test Auth project.
- Build/deploy a reviewed preview Function allowlist containing /api/youtube,
  excluding privileged routes; alternatively implement reviewed fail-closed
  preview guards before privileged clients initialize. Do not rely solely on
  hidden links or WAF settings. Verify excluded /api paths do not fall through
  as successful SPA HTML. No production api files are removed in this assessment.

Potential narrowly scoped files for later approval: App/commerce action rendering,
analytics.js/useVisitorBeacon, Auth entry controls and a reviewed preview build/
function-selection boundary. Use verified build-target metadata for the guard;
do not let a URL query/client toggle enable privileged services. This is a proposal,
not a new architecture or implementation. Test guest paths with network inspection
before approving that change. PWA retains existing assets/caching; no mock worker.

### Reverified Vercel names and targets

Read-only CLI again lists 17 general Preview entries; branch-specific listing
returns none. No decrypted values were requested. Effective targets shown:

| Scope | Names |
| --- | --- |
| Preview only | VITE_STREAM_DELAY_SEC, VITE_TRUEVOICE_STREAM_URL |
| Preview + Production | NEXT_PUBLIC_SITE_URL, PRINTFUL_STORE_ID, PRINTFUL_API_KEY, STRIPE_PUBLISHABLE_KEY, YOUTUBE_API_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_URL, VITE_YOUTUBE_CHANNEL_ID |
| Preview + Production + Development | VITE_YOUTUBE_API_KEY, VITE_STREAM_METADATA_DELAY_SEC, VITE_TRUEVOICE_PUBLIC_PAGE_URL |

There are no listed feature/truevoice-pulse overrides. General entries can still
apply; absent overrides are not credential exclusion. Shared account-level vars,
provider restrictions and actual backend/project identities remain unverified.
Project/production/SSO metadata remains as verified above; it does not grant
confidence in safe database or payment privileges. No Supabase/Stripe dashboard
or backend permissions were inspected; no operations were performed there.

### Exact changes needed, subject to approval

1. Obtain owner-approved separate test Supabase project/schema/fixtures and a
   server-only preview YouTube key/quota budget. Account/project creation and
   credential changes are separate tasks, not executed or silently authorized here.
2. Ensure this branch's **effective** Preview variables match the allowlist:
   replace VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY with test-project entries;
   replace YOUTUBE_API_KEY with the dedicated preview entry. Prefer branch-specific
   entries where isolation from other previews matters.
3. Exclude Preview copies of SUPABASE_SERVICE_KEY, SUPABASE_URL, STRIPE_SECRET_KEY,
   STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY, PRINTFUL_API_KEY, PRINTFUL_STORE_ID,
   VITE_YOUTUBE_API_KEY and VITE_YOUTUBE_CHANNEL_ID. Remove unused NEXT_PUBLIC_SITE_URL,
   VITE_STREAM_METADATA_DELAY_SEC and VITE_TRUEVOICE_PUBLIC_PAGE_URL from this minimum
   Preview scope unless a verified consumer justifies them.
4. Ensure FIREBASE_SERVICE_ACCOUNT_JSON, AZURACAST_API_KEY, DROP_PORTAL_PASSWORD,
   CRON_SECRET, upload station server settings, production analytics/push endpoint
   overrides and any shared privileged variables are absent. They were not listed
   as current Preview entries; absence must be rechecked in effective runtime settings.
5. An absent branch override does not remove an inherited general credential.
   Owner may remove **Preview target only** from a shared entry, preserving its
   Production/Development targets and value, but that affects every preview in the
   existing project. Review impact first; do not unset with empty strings/fake keys
   or delete shared production entries. Branch overrides alone cannot be credited
   as exclusion until effective inherited configuration is verified.
6. Approve/implement the minimal guest-preview safeguards/Function allowlist above,
   then audit the upload/build manifest and bundled public variables for leaks.

**Existing project suitability:** conditionally possible if its Preview target can
be made clean without disrupting other previews, while preserving all production
targets/aliases/settings. Current configuration is not yet safe. If shared Preview
exclusion cannot be accomplished within those constraints, prefer a separately
approved dedicated Vercel test project with a clean allowlist and no live secrets.
That is an alternative destination requiring explicit project/deployment approval,
not permission to create one or circumvent the current project's constraints.
[Vercel environment scope](https://vercel.com/docs/environment-variables).

### Before-deployment verification, cleanup and approvals

- Owner records project/branch, effective variable **names/targets** and backend
  identities without publishing values. Verify test credentials point only to
  isolated services; inspect actual test RLS/grants/storage/Auth settings without
  touching production policies. Repository migrations alone cannot clear the gate.
- Test backend seed contains approved public fixture content only; no real users,
  donor records, tokens or uploaded private media. Guest page loads must produce
  zero production DB writes, email, payment, ingestion or administrative activity.
- Verify public metadata/stream GETs, proxy key/budget and server-only build usage.
  If Auth is included later, review exact callback URLs and test mailboxes/SMTP;
  never add broad preview wildcards to production Auth configuration.
  [Supabase callback guidance](https://supabase.com/docs/guides/auth/redirect-urls).
- Run existing PULSE/proxy tests and build, inspect Function/public artifact
  allowlists, and check preview guards cannot change production output behavior.
  Deployment remains a later authorized action after these prerequisites pass.
- After preview deployment is separately approved, use disposable browser profiles,
  inspect network destinations and test excluded APIs/actions, verify production
  deployment/aliases unchanged, and avoid native testing against production origins.
- Cleanup requires approval: stop preview tests, remove only the test deployment,
  branch-scoped variables, fixture/test accounts and temporary code/build selection
  as appropriate. Revoke only dedicated test credentials when no longer needed.
  Restore changed Preview targets from a securely recorded metadata baseline if
  necessary; never restore live secrets into Preview as an automatic rollback.
  Keep Production values/targets, payment products and policies untouched.

Explicit decisions required: existing versus dedicated Vercel project; provisioning
test Supabase and preview YouTube budget; whether any test writes/Auth are in scope;
minimal preview guards/API boundary; impact on other previews of target removal;
environment mutation authorization; then a new deployment/validation approval.
No user secret should be pasted into chat, documentation or CLI command arguments.

### Assessment checks and final gate

Code inspection and read-only Vercel scope listing completed. Documentation
whitespace/diff checks pass. No code changed, so existing local test results above
remain historical evidence; no new build, test-service call or backend write ran.
Only this report changes and remains uncommitted; Claude outputs is untouched.
**No-go until effective environment and the minimal action safeguards are verified.**
The plan preserves LIVE365/AzuraCast playback, catalog/modal/queue/router/PWA
architecture and production/native configuration; hosted/native release gates remain.

## Phase 4C.5B: implemented guest Preview safeguards

Implementation remains uncommitted. No cloud resources, credentials, settings,
policies, data or deployment changed. This section supersedes the earlier proposed
client/API safeguards; external configuration remains a deployment blocker.

### Deployment indicator and fail-closed configuration

`lib/previewPolicy.mjs` uses server/build `VERCEL_ENV=preview`. If VERCEL=1 but
VERCEL_ENV is missing, malformed or not production, restricted mode also applies.
Local builds without Vercel indicators retain existing behavior. Vite injects a
boolean `import.meta.env.TRUEVOICE_RESTRICTED_PREVIEW` derived from those trusted
build variables; no VITE flag, URL, header or user action can enable privileged
features. Server guards independently use runtime metadata, not the client flag.
[Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables).

Enable/verify Vercel system-variable exposure before deployment. If all platform
indicators are withheld, the code cannot infer a trusted deployment identity;
do not deploy or reuse local/prebuilt production output as Preview. Confirm actual
build/runtime metadata and rebuilt client flag on a future hosted preview.

Preview build rejects configuration unless:

- TRUEVOICE_PREVIEW_SUPABASE_REF and TRUEVOICE_PRODUCTION_SUPABASE_REF are distinct
  canonical 20-character project refs, and public URL exactly matches the test ref.
- VITE_SUPABASE_ANON_KEY is a legacy public JWT with anon role and matching ref.
  This decodes claims to catch mistakes; it does not verify signature, expiration,
  provider validity, RLS or owner truthfulness. External verification is still required.
- YOUTUBE_API_KEY is present and matches expected Google key syntax; actual API
  restriction, project ownership and budget must be verified externally.
- No nonempty excluded credentials remain: SUPABASE_SERVICE_KEY, SUPABASE_URL,
  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PRINTFUL_API_KEY,
  FIREBASE_SERVICE_ACCOUNT_JSON, AZURACAST_API_KEY, DROP_PORTAL_PASSWORD,
  CRON_SECRET or VITE_YOUTUBE_API_KEY. Error text is generic and prints no values.

This deliberately fails the current shared Preview configuration. It does not
silently substitute production data or create a mock backend. Canonical hosted
test URLs/legacy anon keys are supported initially; custom domains/new publishable
key compatibility is a separately reviewed extension, not a credential migration.

### Server enforcement and client behavior

- Preview analytics, delete-account, drop-upload, ingest-feed, Stripe webhook,
  admin-team, admin-invite, push/register, push/send and OG handlers immediately
  return generic 403 for every method. Privileged Supabase/Stripe clients and
  Firebase initialization are skipped at module load. Shared verifyAdmin also
  rejects Preview before session lookup. Production method/auth/signature/body
  logic remains intact; no production authorization bypass was added.
- YouTube remains available with bounded validated operations. Preview ignores
  the VITE key as a source, rejects excluded credential contamination and requires
  a syntactically valid server YOUTUBE_API_KEY; missing/malformed configuration
  yields 503 without upstream work. Production key precedence/validation stays
  unchanged. OPTIONS and malformed catalog requests remain safely bounded.
- Browser analytics and visitor writes no-op in Preview. Donation anchors have
  no href and are aria-disabled; commerce button is disabled and its callback
  also refuses Preview navigation. Production links/URLs remain unchanged.
  This does not block a human opening a known public store URL independently.
- Both Supabase clients use a Preview-only fetch wrapper: GET/HEAD permitted
  only for REST/public-storage reads at the exact configured backend origin;
  writes, uploads and Auth HTTP operations reject before networking. Session
  persistence, refresh and URL-token detection are disabled in Preview. Supabase
  UI mutations cannot rely on a stored production login. Client guards complement
  separate-backend RLS; they cannot revoke a public key or replace backend policy.
- Read-only Realtime connections remain available against the configured test
  project. Guest chat may be empty/unauthorized under existing authenticated-read
  policies; signing in, moderation and storage upload are not preview test goals.
- Home/EXPLORE catalogs, LIVE/metadata, thumbnails, video modal/queue/progress,
  Like/Share, history/deep links and PWA architecture are preserved. No audio,
  player, native origin, stream, bridge or caching-strategy rewrite was made.

### Separate Supabase project preparation (not provisioned)

Only a separately approved test project may supply the refs/public credential.
No production data or policies were queried or copied. Apply/review migrations
chronologically **in the test project only**, not against production:

- 20260812000000 analytics/donations/page_visits and 20260812010000 admin_users;
  leave donations/admin rows empty, no donor/user/admin data copied.
- 20260904090000 chime base, 20260904090100 authenticated reads,
  20260904090200 feed_items/feed_reactions, 20260908193000 unique YouTube IDs,
  20260909100000 funnel fields; these support mounted data shapes and rendering.
- 20260910120000 push_subscriptions, 20260920140000 storage bucket,
  20260925180000 moderation and 20260927120000 message reports are optional-feature
  schema history. Review completeness separately; guest PULSE requires no push
  tokens, uploads, private buckets or messages.

Do not apply a migration bundle blindly: existing history permits anon page_visits
inserts, anon drop-uploads storage insertion and anon donation SELECT. For the
guest-only test project, review grants/RLS to deny nonessential writes and sensitive
reads; do not populate donation PII or create an upload bucket unless its testing
is separately approved. No SQL/policy change has been implemented here.
Public active/auto_active feed reads are required; seed only approved fixture rows
with valid public video IDs, titles/images and clip bounds. No production users,
sessions, customer/donation/device rows or private media.

Auth is disabled in the Preview client, so no mail/signup/callback test is required
for this milestone. Review the test project's signup/SMTP/site URL/redirect settings
to avoid production callbacks; no production Auth configuration is changed. If Auth
testing is later requested, first address the hardcoded ChimeIn production redirect
and use exact approved preview callbacks and test mailboxes. No service-role key
is needed by the guest preview; privileged fixture seeding is a separate owner task.
Actual database/migration execution, RLS, Auth and storage configuration remain
unverified until that external project is approved and inspected.

### Effective Preview variable checklist

Required: VERCEL/VERCEL_ENV system metadata; TRUEVOICE_PREVIEW_SUPABASE_REF,
TRUEVOICE_PRODUCTION_SUPABASE_REF (nonsecret owner-verified identifiers),
VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the isolated test backend,
and server-only YOUTUBE_API_KEY for an approved test quota budget.

Safely shared after read-only endpoint review: public LIVE365 stream and AzuraCast
nowplaying settings, playback delay and social URLs. Remove unused commerce/admin
and production endpoint overrides as listed in 4C.5A. Exclude all privileged
credentials above plus unnecessary publishable payment/store identifiers. Removing
an inherited Preview target requires explicit approval; no fake keys or branch
omission should be used as a substitute. Current shared variables were not modified.
Do not add VITE_YOUTUBE_API_KEY to enable analytics: its presence blocks Preview.

### Changed files and focused tests

New: lib/previewPolicy.mjs, api/_lib/previewGuard.js,
src/lib/previewSafety.js, tests/pulse-preview-security.test.mjs.

Modified: vite.config.js; api/_lib/adminAuth.js; api/admin-invite.js;
api/admin-team.js; api/analytics.js; api/delete-account.js; api/drop-upload.js;
api/ingest-feed.js; api/og/[id].js; api/push/register.js; api/push/send.js;
api/stripe-webhook.js; api/youtube.js; src/App.jsx; src/components/MerchSection.jsx;
src/lib/analytics.js; src/lib/visitorStore.js; src/lib/supabaseClient.js;
src/lib/supabaseRealtime.js; this report (already uncommitted from 4C.5).

Six new focused tests exercise invalid/missing/test-vs-production configuration,
service-role/client-key contamination, all ten server route guards before SDK
initialization, rejected write/Auth/storage/wrong-origin requests, Preview visitor
no-op versus production visitor requests, production missing-token/non-admin checks,
normal client payment eligibility, and Preview proxy 503 without upstream work.
Payments/analytics source guard checks complement runtime boundary tests; no actual
Stripe, Firebase, Supabase or Google operation ran.

Validation: **55 focused PULSE/security tests pass**; production/PWA build passes,
809 modules, 13 precache entries, service worker/Workbox produced. CSS hash remains
unchanged; JS hashes change with guards. Synthetic valid Preview build passes with
fake fixture identifiers/credentials, generates a worker in a verified temporary
directory, then deletes it. This proves build paths, not external credentials or
backend/network functionality. Targeted ESLint passes (Node globals for existing
server files), npm ls reports no dependency problems; lockfile/dependencies remain
unchanged. Whitespace checks pass. Existing >500kB bundle warning remains, no stale
Browserslist warning. First local test harness issues were corrected before final
validation; no failure is being waived.

### Verification and remaining blockers

Review the uncommitted safeguards, then approve external test project/fixtures,
YouTube budget and Preview variable target changes separately. Verify system
metadata exposure, backend identity/key validity/grants/RLS and clean effective
variable list; rerun build/tests with approved configuration without printing values.
After separately authorized deployment, inspect actual client flag and server
403/503 boundaries, network destinations, public reads and real hosted PWA/player
behavior. Confirm no production writes/payments/privileged calls occur and production
aliases/build behavior remain unchanged. New backend/project creation, credentials
and deployment are still unauthorized here. Current Preview settings will fail
closed until prepared; hosted, WAF/rate-limit and native release gates remain open.

No commit, push, merge, deployment, secret retrieval/rotation, policy/data mutation,
Stripe product/link change, cloud setting change or MY PULSE work occurred.

## Final security review: commit blocked

The final review found a significant inconsistent-target fail-open case. No commit
was created and the implementation is not approved as complete. Previous successful
build/test results remain historical; they did not cover this case.

`restrictedDeployment({ VERCEL: '1', VERCEL_ENV: 'production',
VERCEL_TARGET_ENV: 'preview' })` returns false. `assertPreviewConfiguration`
therefore accepts missing Preview configuration without checking it. The server
guard uses the same classification, so direct privileged routes can initialize
their production service clients in that inconsistent configuration.

A new focused regression in pulse-preview-security.test.mjs imports the actual
analytics handler with conflicting deployment metadata and a service stub that
throws on initialization. It fails with **Privileged client initialized** before
the requested Preview denial. Independent bundle identities prevent that expected
failed import from contaminating later tests. Final focused Preview suite: six
pass, one fails. No real credential, service request or backend write was used.

This is a deployment configuration bypass, not a demonstrated ability for a remote
HTTP caller to change process.env. Headers/query values are not used for deployment
classification. The platform may normally supply consistent targets, but the
requested fail-closed inconsistent-target requirement is not met. The implementation
must reconcile trusted VERCEL_ENV/VERCEL_TARGET_ENV signals and reject conflicts
before build validation, service initialization and endpoint execution. It must
preserve legitimate production/local behavior and add corresponding regression
coverage. No repair was made because the final-review instruction requires stopping
without committing when a significant gap is found.

Other reviewed boundaries: all ten privileged routes have early guards and skipped
Preview service initialization under consistent Preview metadata; the unmodified
nowplaying route only fetches a fixed public metadata URL, with no privileged key
or mutation. No additional unguarded privileged serverless route was identified.
Client payment/telemetry/read-only transport guards are not server authorization;
separate test backend permissions remain necessary. Public key claims/URL syntax
cannot establish project ownership, cryptographic validity or safe deployed RLS.
Owner-verified distinct production/test identities and clean runtime credentials
are still external prerequisites. Complete absence of exposed platform indicators
also remains a deployment blocker, as documented above.

Test lint and diff checks pass. Full regression/build/synthetic-build validation
was not repeated after the stop condition; successful builds cannot waive the
reproduced security failure. All prior uncommitted work is preserved, with only
the review regression/test-harness isolation and this report added during review.
Nothing staged, committed, pushed, deployed or changed in production infrastructure.

## Phase 4C.5C: metadata conflict fix and final commit gate

This section supersedes the blocked review above. Root cause was treating only
VERCEL_ENV as authoritative and ignoring VERCEL_TARGET_ENV. Production/Preview
contradictions therefore skipped both runtime denials and build isolation checks.
The original direct analytics regression is preserved and now passes.

### Single classification policy

`classifyDeployment` in lib/previewPolicy.mjs is shared by runtime restrictions
and build validation. It returns production, preview, development or unsafe:

| Metadata | Classification / effect |
| --- | --- |
| VERCEL_ENV=production AND VERCEL_TARGET_ENV=production | Production; original authorization, services and build behavior retained |
| Both fields preview | Preview; guest restrictions and mandatory isolated configuration |
| Both fields development | Recognized development; existing local developer functionality |
| No platform metadata and NODE_ENV=development | Explicit local development; not Production classification |
| NODE_ENV=production alone / no identity / either environment field missing | Unsafe; no privileged initialization or route operations; build rejected |
| production/preview or preview/production | Unsafe; no initialization/operations, build rejected |
| Unknown fields, malformed/non-1 VERCEL marker, partial platform metadata | Unsafe; same denial |
| Custom target slug, including preview/staging | Unsupported by this release policy; conservatively unsafe, not a claim that Vercel's configuration is invalid |

Vercel documents VERCEL_ENV's three base values and VERCEL_TARGET_ENV's standard
or custom names. Legitimate custom targets can therefore differ; this implementation
does not invent a mapping or grant them production authority. They need a separate
reviewed policy before use. [System-variable reference](https://vercel.com/docs/environment-variables/system-environment-variables),
[custom environments](https://vercel.com/docs/deployments/environments).

The code consumes process/build metadata only, never headers, query parameters or
bodies. No custom application flag overrides the classification. NODE_ENV and Vite
mode describe compilation/development, not hosted Production identity. Vite's client
boolean is derived from the shared policy; server guards independently classify
runtime metadata. Missing metadata is now denied rather than relying only on an
external instruction to enable system exposure.

Local dev must have NODE_ENV=development with no platform markers, or an explicit
consistent development pair. A local production-style build without authoritative
metadata intentionally fails. For this validation, consistent production metadata
was supplied only in the test shell to npm run build; no Vercel settings were changed.
Hosted production must expose both authoritative fields. Do not upload a local
development/Production prebuilt artifact as Preview: future deployment verification
must attest the build target and independently inspect runtime/client restrictions.

### Runtime and build denial evidence

All ten privileged handlers and shared admin verification deny restricted/unsafe
classifications before service initialization. No incoming request flag bypasses
the server guard. Generic 403/503/error messages contain no environment values.
The unmodified nowplaying route remains a fixed public metadata read, with no
privileged credential or mutation; no uncovered privileged route was identified.
The complete earlier safeguard diff was inspected: no production method, signature,
admin authorization, live payment URL, playback, stream/native config or dependency
change was introduced by classification repair.

Build validation rejects unsafe metadata outright, even with syntactically valid
isolated credentials. Consistent Preview still requires distinct owner-supplied
Supabase refs, matching anon JWT claims and canonical URL, a server YouTube key,
and absence of excluded privileged/client-exposed credentials. Claim decoding is
not signature verification or proof of backend ownership/permissions. A mistaken
owner-supplied production ref can still misdescribe the backend: provider identity,
actual RLS/grants, key validity and clean effective variables remain external gates.
Client read-only/payment guards are not substitutes for backend authorization.

### Final validation

- **57 focused PULSE/security tests pass**, including eight Preview security tests.
  Matrix covers both conflict directions, missing/partial/unknown metadata, custom
  unsupported targets, malformed VERCEL marker, genuine Production/Preview and
  explicit development. All ten privileged routes are imported under five denied
  metadata contexts with SDK stubs that fail on initialization, and tested with
  GET/POST/OPTIONS. The original failing direct analytics case is retained.
- Recognized Production admin authorization and visitor logging regressions pass;
  Preview telemetry, read-only transport, payments and YouTube isolation tests pass.
  Test runner uses explicit NODE_ENV=development for local legacy proxy fixtures.
- Production/PWA build with consistent Production metadata passes: 809 modules,
  13 precache entries, sw.js and workbox chunk generated. Existing bundle-size
  warning remains; no stale Browserslist warning. Production CSS hash unchanged.
- Synthetic consistent Preview build passes with fixture credentials only and
  generates a worker. Synthetic production/preview, preview/production, missing
  and unknown metadata builds reject before generating index.html/artifacts.
  Temporary outputs were path-verified and removed. No external service called.
- Targeted ESLint, dependency consistency and whitespace checks pass. Dependencies,
  lockfile, native projects/config, bridge assets and playback architecture unchanged.

Changes in 4C.5C are confined to lib/previewPolicy.mjs, expanded existing
tests/pulse-preview-security.test.mjs and this report. The complete intended commit
also includes all earlier uncommitted 4C.5B files listed in its manifest above;
no work is discarded. Claude outputs, env/credentials and generated dist are excluded.
All credential/role fixtures in tests are synthetic, not retrieved secrets.

### Remaining configuration and release gates

Commit eligibility is satisfied by local review/tests/builds, not hosted release
readiness. Separate approved Supabase test project/fixtures/RLS/Auth configuration,
server-only test YouTube key/quota restrictions, clean Preview variable targets,
both platform fields exposed at build/runtime and deployment provenance verification
are still required. Custom Vercel environments remain unsupported until reviewed.
No Preview or Production deployment, settings/data/policy/credential change,
push or merge occurred. Hosted browser/PWA, native packaging/Safari/Capacitor,
Google quota/WAF policy and conditional Firebase/uuid gates remain open.

## Phase 4C.5D: test backend preparation

[The ordered test-backend procedure](PULSE-Phase4C5D-test-backend-setup.md) now
documents the minimum guest resources, four selected repository migrations,
test-only read grants/RLS hardening, synthetic queue seed with placeholder guards,
credential-free verification queries, Auth/storage settings and effective Preview
variable checklist. It supersedes the earlier suggestion to apply all migrations
chronologically for the guest-only preview; unrelated production-feature tables
and permissive write policies are unnecessary.

No SQL was applied, project provisioned, credential retrieved/created or Vercel
entry changed. Additional approval is required for project organization/plan/region,
test schema/seed/Auth configuration, owner-verified separate refs/key compatibility,
two additional playable fixture IDs, Preview-only YouTube budget and effective
variable target changes. Then obtain separate hosted deployment/validation approval.
Actual test-backend grants/RLS/provider identity remain unverified. Documentation
checks do not establish database or hosted readiness; existing release gates remain.
