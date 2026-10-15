# PULSE Phase 4C.4: YouTube proxy protection assessment

October 14, 2026. Branch `feature/truevoice-pulse`, baseline
`5f23839b15439d67180d5f9c18ecc32335c8f930`.
Assessment only: no source, dependencies, environment, infrastructure or deployment changes.

## Decision and deployed-source gap

Recommend a narrowly scoped Vercel WAF IP rate limit, staged through logging,
preview enforcement and production enforcement, plus quota monitoring and a
documented incident response. Application-level limiting is not proposed: edge
limiting is supported, but its actual project configuration is not verified.

**Do not sign off the proxy's deployed protections yet.** The connected project
reports production deployment `dpl_CCV6ZTvgme8Anj9axBtswKZKMSc8` as READY, from
`main` commit `c511c8905cffd9c11301d00a25b73d51127fc0f5`. It is not the assessed
PULSE commit. The repository source at that deployed SHA contains the older
permissive handler: caller-selected endpoint/params, no method/operation/query
allowlist, no explicit timeout/response cap, raw upstream JSON and exception
messages. Deployment metadata plus historical source establish a material gap;
the actual deployed function bundle and custom-domain traffic were not tested.
Do not represent local hardening as already deployed.

## Current branch protection inventory

`api/youtube.js` and tests/pulse-stabilization.test.mjs:

| Control | Exact behavior / limit |
| --- | --- |
| Methods | GET only; OPTIONS 204 without upstream work; other methods 405 with Allow GET, OPTIONS |
| Operations | channels/contentDetails; playlistItems/snippet; videos/snippet,statistics only; search and mutations excluded |
| Params | Per-operation key allowlist, exact part; rejects unknown keys including caller key/pageToken; all values must be strings, so duplicate-array values rejected |
| Query size | URLSearchParams-encoded normalized query length <=2048; this is not a raw request/header/body byte limit |
| channels ID | UC followed by exactly 22 allowed alphanumeric/underscore/hyphen characters; one channel |
| video IDs | 1-50 comma-separated IDs, each exactly 11 allowed characters; duplicates are not deduplicated |
| playlist ID / result count | 3-128 allowed characters; maxResults integer text 1-50; no paging |
| Upstream boundary | HTTPS fixed Google YouTube v3 base with an allowlisted operation; redirect:error; caller cannot choose a host |
| Deadline | AbortController, 8000ms across fetch/body processing; finally clears timer |
| Response bound | 1MiB advertised content-length check and actual streamed-byte check; reader lock released |
| Errors | Bad query 400; missing key 503; upstream non-success status preserved with generic JSON; timeout 504; transport/oversize/invalid JSON 502; no exception text or upstream error body returned |
| Credentials | Server reads VITE_YOUTUBE_API_KEY first, then YOUTUBE_API_KEY; overwrites any key in upstream construction; no key in proxy response code |
| CORS | Allow-Origin:*; Allow-Methods GET, OPTIONS; no browser-origin authentication |

The handler does not inspect a GET body or enforce an independent request-body
size limit. Platform parsing/header/request limits apply, but project-specific
limits were not inspected. A successfully bounded public response is returned
as Google JSON, without schema filtering. No authentication, per-client counting,
global quota budget, concurrency limit or explicit server/CDN cache policy exists
in this file. A syntactically valid but nonexistent ID still reaches Google.

## Verified versus unverified Vercel controls

Repository vercel.json preserves /api routing and contains no WAF/rate-limit
configuration. That does not prove dashboard rules are absent.

Read-only Vercel plugin queries used the project/team from .vercel/project.json.
No environment values, tokens or signing credentials were fetched.

| Setting/evidence | Status |
| --- | --- |
| Project identity | Verified true-voice-digital, Vite, Node 24.x; custom domains www.truevoice.digital and truevoice.digital plus Vercel aliases |
| Password / trusted-IP deployment protection | Project response reports disabled |
| SSO deployment protection | Enabled for all_except_custom_domains; custom domains are outside that SSO restriction |
| Public proxy intent | No application auth; custom-domain setting permits anonymous access absent other WAF controls. Runtime anonymous reachability not probed |
| Active firewall config | API GET active returns 404, Seawall Config not found. This is not a successful empty rule inventory and does not prove all platform protection is absent |
| CLI fallback | Read-only scoped firewall status fails: account not accessible. CLI identity differs from connector access; no relinking/login performed |
| Custom rate limits, WAF bypass ordering, IP blocks, bot rules, Attack Mode | Unverified; no rule can be credited as active |
| Plan/rule allowance, traffic baselines, dashboard alerts | Unverified |
| Automatic platform DDoS mitigation | Documented Vercel capability, not project-specific status verification or a YouTube quota control |
| Google key restrictions, project quota/usage, alerts | Unverified; no Google dashboard access performed |

Vercel documents rate limiting across plans, fixed windows and per-region counters.
Available rule counts vary; plan and remaining slots must be verified before
choosing multiple limits. [WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).
Platform DDoS filtering is not proof of application quota protection.
[DDoS documentation](https://vercel.com/docs/vercel-firewall/ddos-mitigation).

## Callers and threat assessment

- Production browser catalog requests use relative /api/youtube; native Capacitor
  uses https://www.truevoice.digital/api/youtube through apiBase.js. Local browser
  development can fall back to this production proxy. Analytics also uses it in
  production/native mode. Neither native origin nor browser Referer is identity.
- App.jsx mounts eight discovery feeds. A completely cold channel fetch can use
  two calls each (channel lookup then playlist); additional route consumers/analytics
  can add calls. Five-minute memory caches and persisted feed caches reduce normal
  demand, but an attacker can omit them and every fresh client has its own cache.
  Video playback/queue progress itself does not require a Data API call per tick.
- Any caller can spend the shared key's quota on arbitrary syntactically valid
  public channels/playlists/video IDs. CORS:* explicitly enables other browser
  sites; restrictive CORS alone would still not stop scripts or direct HTTP.
  Request bounds prevent high-cost operation selection on this branch, not repeated
  low-cost requests, distributed IPs, concurrency spikes or function spending.
- Current deployed-source endpoint selection permits operations outside the new
  allowlist. Its unbounded response/error handling adds resource and disclosure
  risk beyond the assessed branch. Release verification must cover that difference.
- The server sends a fixed Referer to Google. It is not evidence that the inbound
  caller came from TrueVoice. Referer/Origin/UA/device identifiers and public client
  headers are forgeable; do not exempt clients based on them or embed a bypass secret.
- The server key is in Google's request URL; avoid logging full fetch URLs/errors.
  Client source references VITE_YOUTUBE_API_KEY, including an analytics config
  check even in proxy mode. A VITE-prefixed variable is not inherently server-only.
  Redacted inspection of current local built JS found zero Google-key-pattern
  occurrences; this does not establish deployed web/native artifact secrecy or
  Google key restrictions. Verify both separately before release. A leaked key
  used directly against Google bypasses Vercel limiting entirely.
  [Google key practices](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices).

The three allowed list operations cost one quota unit each; invalid upstream
requests also cost at least one. Google's documented default combined quota for
these endpoints is 10,000/day, resetting at midnight Pacific; actual project
allocation is unverified. [YouTube quota costs](https://developers.google.com/youtube/v3/determine_quota_cost).
At 60/min, one continuously allowed IP/region could spend 10,000 units in about
167 minutes. IP limits are friction, not a global quota guarantee. Other consumers
of the same Google project also count. Rejected local 400s do not reach Google;
edge-rejected calls should consume neither a function invocation nor upstream quota.

## Recommended initial policy (proposal, not traffic measurement)

| Item | Proposed value |
| --- | --- |
| Match | Project-wide exact normalized path /api/youtube, GET; include trailing-slash/routed aliases if deployed routing accepts them; no host-only gap through Vercel aliases |
| Key | Vercel-observed client IP; do not trust caller X-Forwarded-For or an anonymous custom client ID |
| Primary limit | 60 requests per 60-second fixed window per IP/region |
| Burst | Up to 60 in a window accommodates initial ~16-call load plus other feeds; adjacent window boundaries can permit ~120 closely spaced requests; not a smooth token bucket |
| Optional sustained limit | Where rule allowance and evaluation semantics support it, separately enforce 180 per 600 seconds per IP/region; validate both rules actually count/enforce before relying on the combination |
| Rollout | Begin rate-limit exceed action Log at 300/60s for 24-48h representative traffic; record proposed-limit simulations, then preview 429, then approved production 60/60s |
| Enforcement | Default HTTP 429, no challenge page, no persistent deny/ban duration |
| OPTIONS | Excluded from quota GET limiter; preflight remains available. Hardened handler rejects other methods. Do not apply GET-only protection to the legacy handler as sufficient mitigation |

These are launch assumptions, not proven safe thresholds. Shared Wi-Fi/carrier
NAT may represent many legitimate users; four simultaneous cold ~16-call loads
can exceed 60/min. Mobile IPs change and IPv6/privacy addressing can evade an IP
budget. Review shared-IP traffic before tightening, raise the IP allowance only
with a reviewed quota budget, and do not broadly allowlist carrier ranges. Avoid
JA4-only grouping, which can throttle entire browser cohorts. If expected NAT
loads exceed limits, select a revised documented policy after logs, not silent bypass.
If only one rate-limit rule is allowed, use the primary rule; the sustained layer
is not assumed present. Neither layer prevents distributed/global quota exhaustion.

429 is an HTTP result, not a promised JSON body. Confirm actual WAF CORS headers
on native cross-origin responses and inspect whether Retry-After is supplied;
do not assume either. Existing fetch readers check !ok before decoding JSON and
surface generic feed failure/stale cached content; they do not implement a timed
retry loop or Retry-After UI. Validate that behavior on browser/native clients.
Future explicit retry should honor Retry-After or wait at least a window with
jitter and bounded attempts; no such client change is implemented in this assessment.

### Monitoring and quota response

Assign an owner and alert destination before enforcement; configuring them needs
approval. Monitor allowed/limited endpoint requests by host, IP/region and status,
Google project quota and function failures without storing keys/full upstream URLs.

- Warn at 50% daily quota, escalate at 75%, page at 90%; for a verified 10,000
  quota these are 5,000/7,500/9,000 units. Recalculate for actual quota.
- Warn if projected daily usage exceeds 80% or allowed proxy volume exceeds
  100/min for five minutes; treat as an investigation threshold, not a global cap.
- Investigate 429s >5% of matched requests over ten minutes with >=100 requests,
  or >10/min for five minutes; separate shared-IP false positives from abuse.
- Page on proxy/upstream failures >5% over five minutes with >=20 requests, or
  evidence of quota exhaustion; generic 403 cannot distinguish quota from key
  restrictions, so correlate with Google's usage/error monitoring.

At 90%/active abuse, the owner follows an approved narrow emergency path rule to
log/limit more aggressively or deny the catalog endpoint temporarily, preserving
playback/static assets and leaving feed errors graceful. Review remaining legitimate
budget first. WAF cannot enforce a verified global daily YouTube budget through
per-IP/region counters. If logs demonstrate distributed abuse defeats this policy,
seek separate approval for stronger verified identities/shared caching/global
budget enforcement; only then assess application limiting if edge controls are
demonstrably insufficient. No new dependencies or application limiter now.

## Exact approval-dependent configuration sequence

1. Owner verifies correct Vercel project/team, current plan, rule slots and active
   published WAF config in Dashboard > project > Firewall > Configure. Record
   rule order/bypasses and traffic baseline. Verify Google key's API restriction
   to YouTube Data API, appropriate application restrictions and actual quota.
   Any key/environment changes require a separate authorized task.
2. Review and approve deployment of the hardened PULSE handler in the normal
   release process. Confirm deployment SHA/bundle and method/validation behavior;
   this assessment deploys nothing and does not authorize infrastructure writes.
3. In Firewall > Configure > New Rule, create PULSE YouTube catalog rate limit.
   Conditions: path equals /api/youtube (plus verified aliases), method GET.
   Rate Limit, Fixed Window, 60 seconds, 300 requests, IP key, exceed action Log.
   Apply on all project hosts; review bypass ordering. Review Changes then owner
   Publish only after explicit approval. Log mode does not protect quota.
4. Owner reviews 24-48h traffic against cold loads, shared IPs and proposed 60/min.
   Use a separately scoped preview rule with 60/60s and Default 429 for controlled
   validation; do not replace production log coverage inadvertently. Publish
   preview changes only after approval and verify the protection layer tested.
5. After preview and log review, owner approves 60/60s Default 429 production
   enforcement, and optional sustained layer if supported. Review exact path,
   methods, hosts, bypass precedence and published diff before Publish.
6. Configure quota/status alerts and owner incident procedure; record screenshots/
   active rule export, deployment SHA and validation evidence in release checklist.
   Monitor first 24h and keep a reviewed rollback to log/disable the specific rule.

No draft rule, publish command, bypass change, Attack Mode, credential update or
production load test was performed. Browser challenge/Attack Mode is not the
proposed API rate-limit response. Available read-only access cannot currently
substitute for owner verification of the dashboard.

## Local validation and future acceptance plan

`node --test tests/pulse-stabilization.test.mjs`: **4 passed**, including both
proxy security tests. Mocked upstream checks cover supported operations, unknown
keys, array query values, bad IDs/parts/counts, prototype-like operation, methods,
redirect policy, 8s abort, advertised/streamed >1MiB responses, and sanitized
upstream/transport failures. No real Google request or production traffic generated.
Oversized query length and >50 IDs were reviewed in code; those exact boundaries
are not individually exercised by the existing test cases. No new tests/source
were added in this documentation assessment. Malformed successful upstream JSON
falls into generic 502 by inspection; no deployed behavior claimed.

After approval, use mocked/local cases to fill those boundary gaps; in isolated
preview use a temporary low threshold and rejected/no-upstream query fixtures to
verify WAF 429 without consuming quota. Confirm rejected traffic never invokes
the function. Do not stress production. Validate accepted real catalog calls
sparingly within a known quota budget, and test web/native error behavior,
shared-IP concurrency and window recovery. Verify active rule covers all accessible
aliases/regions and that preview deployment authentication is not what produced
the apparent block. Test actual retry headers/CORS; preserve OPTIONS/native access.

## Remaining release blockers and changed files

- Confirm hardened proxy deployed: currently reported production SHA has old source.
- Verify active edge rate-limit configuration, bypass ordering and plan suitability;
  404/config-access errors are not evidence of effective quota controls.
- Approve/tune/enforce policy and verify browser/native 429/CORS behavior.
- Establish Google quota/key restriction/artifact-secrecy evidence, monitoring,
  ownership and documented residual distributed-abuse acceptance/response.
- Existing Safari/Capacitor/native packaging gates and conditional Firebase/uuid
  acceptance from Phase 4C remain independent; this report clears none of them.

Only docs/PULSE-Phase4C4-youtube-proxy-protection.md is added, uncommitted.
Existing Claude outputs remain untouched; no source, runtime, environment,
dependencies, infrastructure, signing, commit, push, merge or deployment changed.

## Rollout preparation follow-up

This follow-up supersedes tentative rollout assumptions above. No implementation
or deployment is authorized by this preparation. Only this report changes.

### Rechecked deployment and access

Read-only project/deployment queries again report production
`dpl_CCV6ZTvgme8Anj9axBtswKZKMSc8`, READY, Git SHA
`c511c8905cffd9c11301d00a25b73d51127fc0f5`, branch main. Historical source at that
SHA is the old handler, not this branch's hardened implementation. This establishes
the deployed-source association, not runtime execution/bundle attestation; no
production endpoint probe or load test was run.

Active firewall retrieval again returns 404/Seawall Config not found. Relevant
rules, rate limits, bot controls, challenge actions, bypass precedence and available
rule slots remain unknown. The earlier scoped CLI account-access failure remains
unresolved; no identity switch or relinking was performed. Team lookup confirms
slug johns-projects-861a7d26 but returns no billing/plan fields, so **plan remains
unverified**. Do not interpret these responses as proof that WAF is disabled.

### Actual browser/native request behavior

| Caller | Burst/cache behavior | 429 outcome by code inspection |
| --- | --- | --- |
| RadioLayout/App eight useYouTubeFeed hooks | Up to 16 calls on a completely cold start; eight channel lookups followed by playlists; channels can start concurrently | Catch sets loading false and feed error; accepted cached data can be shown |
| EXPLORE | Uses those parent feeds; filters do not mount separate catalog requests or retry each click | Partial/failed rails render existing generic unavailable messages; queue playback does not retry catalog |
| Home TrueVoiceConnect | Seven useYouTubeLatest hooks, up to 14 cold calls | Catches failure into error state; no timed retry |
| Home ReelsGrid | Seven useYouTubeFeed hooks, up to 14 cold calls; maxResults differs from several parent feeds, producing distinct cache keys | Catches error, retains existing video state; no timed retry |
| AdminDashboard analytics | Two sequential calls: playlist then video batch; only when its VITE key/channel config checks pass; no result cache | Promise catch/finally sets error/loading; HTTP error text is rendered as React text, not executed HTML |
| Shared catalog helper | One request in production/native; development-only Google-to-proxy fallback on transport/401/403, not on 429 | Throws an Error with status 429 before JSON parsing; caller catches it |

Fully cold Home can therefore create **up to about 44 calls** across these mounted
consumers (16+14+14), before considering other navigation. This is a static upper
estimate of those paths, not measured network traffic. Concurrent channel lookups
and latest/feed caches are separate: there is no shared in-flight promise cache.
Completed data reduces future calls, but does not suppress duplicate pending work.
Two simultaneous cold Home users on one shared IP can exceed 60/min. React
StrictMode is enabled; development effect replay can increase requests further,
whereas that replay does not apply to production builds.

Feed cache details: module memory TTL five minutes; persisted video data TTL one
hour; persisted uploads mapping has no explicit TTL. On failure, getCached only
returns unexpired persisted data, so the earlier term "stale" does not mean an
expired record is accepted. Latest cache is separate, five-minute module memory
with its own uploads mapping. Analytics has no cache. None is a shared server cache.
Effects can fetch again on remount/source change; there is no rate-limit backoff
state, cancellation of outstanding network work or automatic retry timer. Failed
work is not cached, so user reload/remount activity can repeat it, but no autonomous
429 retry storm was identified. Stable filters avoid routine dependency churn.

Native API_BASE is always https://www.truevoice.digital. Production-built web,
including a Vercel preview, uses relative /api/youtube on that preview's origin.
Local web development may fall back to production; use the hosted preview or mocked
tests, not localhost fallback, for rate-limit validation. Hosted embed URLs remain
truevoice.digital and are independent of the preview catalog endpoint.

A local in-memory esbuild harness executed the actual catalog helper in browser
and native modes with mocked 429 responses: one fetch each, error.status 429,
no JSON parsing, correct relative/web versus production/native origin. No source
file or network request was created. Hook catches/render states are inspected and
covered by general existing failure regressions, not a physical native 429 test.
If edge CORS prevents reading the response, hooks catch a network error instead;
actual native CORS remains an acceptance gate.

**No narrow 429 fix is necessary on current evidence** to prevent a crash or retry
loop. If preview testing shows an unacceptable message, separately propose a small
status-preserving error/message change before implementing it. In-flight dedup or
backoff would be a separate reviewed improvement, not required preparation scope.

### Exact rule recommendation and plan limits

Approved target proposal: GET, normalized exact path /api/youtube (and any verified
equivalent trailing slash), IP key, **60 requests / 60 seconds**, Fixed Window,
exceeded action **Default 429**, no persistent action, no challenge. Production
enforcement is scoped to environment=production across project hosts; preview
validation uses environment=preview and its deployment host where supported.
Do not bind only www and leave another publicly accessible alias outside protection.

Initial monitoring follows the generous 300/60s Log stage above, then **60/60s Log**
to expose proposed-threshold false positives before preview/production enforcement.
Review at least 24-48h representative cold loads and shared-IP traffic. Log mode
is not protection. Fixed-window 60 admits the burst within a window and potentially
120 across a boundary; it does not provide a separate refill/burst parameter.
Keep thresholds under review because cold Home costs more than cold EXPLORE.

Current official control support, not verified project entitlement:

- IP counting, fixed windows, 60-second windows and default 429 are supported on
  Hobby/Pro/Enterprise. Hobby permits one rate-limit rule, Pro 40, Enterprise 1000;
  Hobby has three total custom rules. Verify actual free slots before staging.
- Token bucket is Enterprise-only; do not promise smoother bursts on an unknown
  plan. Custom authenticated header grouping is also plan-specific and no trusted
  client header is available here. IP counters are regional, not global quota caps.
- On a one-rate-rule plan, sequentially edit the single rule: log stage, then
  preview-only enforcement, then separately approved production enforcement.
  Do not assume simultaneous production-log and preview-rate rules are possible.
  Optionally retain a plain Log rule if total custom slots allow it. On a plan
  with slots, separate environment-scoped rules may coexist after order review.
- The optional sustained second limit is deferred until entitlement and rule
  evaluation are verified; it is not part of the minimum 60/min policy.
- Native-readable CORS, Retry-After and response body shape are not guaranteed by
  the current documentation review and must be tested. No CAPTCHA/challenge or
  browser-only bypass is proposed for this API.

These capability facts are from [Vercel rate-limit documentation](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).
Monitoring thresholds, Google quota warnings at 50/75/90%, incident ownership and
distributed-abuse residual risk remain as defined above. No monitor is activated.

### Isolated preview readiness and environment inventory

Use the existing project's **Preview** environment, not production promotion or a
custom-domain alias. A preview has separate hosting, but shared backend credentials
can still access production services. Confirm environment targets without exposing
values; this preparation did not retrieve or modify secret values.

| Requirement | Preview scope / known limitation |
| --- | --- |
| Proxy credential | YOUTUBE_API_KEY server variable required unless VITE_YOUTUBE_API_KEY supplies it; VITE value takes precedence. Prefer a separately approved preview-restricted key/budget; do not silently reuse or mutate production credentials |
| Application data | VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required by client creation; use approved nonproduction data or explicitly reviewed read-only production access. Existing app/admin actions can write; separate hosting is not data isolation |
| Analytics panel | Existing hook also requires VITE_YOUTUBE_CHANNEL_ID and VITE_YOUTUBE_API_KEY; exposing a VITE key in build artifacts must be reviewed. Not necessary for guest EXPLORE; do not add one just to make admin analytics pass |
| Other API credentials | Full root api directory deploys with the app; do not copy payment, Firebase, ingestion/admin or production service-role secrets for proxy-only testing. Missing credentials may make unrelated APIs unavailable; keep testing scoped |
| Route/build | npm ci, npm run build, Vite dist; root api/youtube.js must be emitted as a Vercel Function. vercel.json /api rewrite precedes SPA fallback. Inspect built deployment routes; static vite preview alone has no serverless API |
| Deployment protection | Reported SSO all_except_custom_domains covers Vercel preview host. Testers need authorized access. 401/login pages are not proxy/WAF 429 evidence; use approved tester authentication or protected automation, never put bypass credentials in client bundles |
| Cron | Vercel documents cron calls to production deployment. Keep preview target; never invoke ingestion manually or promote preview to test the proxy |

Environment names come from source; presence/targets/values of current Preview
variables remain unverified. [Environment scoping](https://vercel.com/docs/environment-variables),
[preview environments](https://vercel.com/docs/deployments/environments),
[cron target](https://vercel.com/docs/cron-jobs).

### Preview creation, validation and rollback plan (not executed)

1. Obtain separate approval for preview deployment and Preview-only credentials/
   data access. Resolve CLI/team access; verify linked project, main production
   target and Preview environment metadata. Capture production ID/aliases and
   active WAF config as baseline. Decide a reproducible reviewed source revision
   containing the hardened handler; exclude Claude outputs, secrets and tool
   node_modules. Do not upload the current workspace wholesale without inspection.
2. In a disposable checkout of that reviewed revision, use root npm ci and run
   focused tests/build. Authenticate the CLI to the verified team/project without
   changing the working project's link. For an approved CLI source deployment,
   use `vercel deploy --target=preview --scope johns-projects-861a7d26` from the
   correctly linked disposable checkout. No --prod, promote, production alias,
   production env pull or push is needed. Preview CLI deployment uploads source;
   verify the upload manifest excludes unrelated/untracked material.
   [CLI deployment](https://vercel.com/docs/cli/deploy).
3. Record returned deployment ID/URL/target and source provenance/build logs;
   local CLI metadata may not automatically attest Git SHA, so retain revision
   and upload manifest. Inspect Function output for api/youtube. Verify production
   ID/aliases stayed unchanged. Confirm preview SPA routes and catalog API are
   distinct; use malformed fixtures to prove 400/405 without upstream quota use,
   and at most a few permitted requests with approved quota.
4. Browser preview uses its own catalog automatically. Inspect browser network
   origin on EXPLORE and Home, cold/warm loads, multiple users on one test IP, 429
   error rendering and recovery. Retain expected production LIVE/embedded content
   dependencies as explicit scope limits; no player architecture or stream change.
5. For WAF verification, separately approve a preview-scoped rule and publish
   only after reviewing environment/host/path/method and existing rules. Temporarily
   lower preview-only threshold to two requests/minute and use invalid-query GETs
   (no upstream) to prove 429 and no function invocation; restore 60 before normal
   browsing. This avoids production load tests and quota exhaustion. Inspect CORS,
   headers, recovery and actual regional counter behavior.
6. Unmodified native apps still call production, even if a WebView loads preview
   web content. Native end-to-end preview requires separate approval of a narrowly
   scoped API-origin override in a disposable test build, leaving checked-in
   apiBase/Capacitor config unchanged; no current env switch exists. Do not claim
   native preview validation from web results. First test protected preview API
   responses/CORS separately; never embed a protection bypass token in the app.
7. Rollback for preview-only work: stop use/delete the test preview after approval,
   remove only the named preview test rule or restore its captured config through
   reviewed publish, and remove only separately approved preview variable changes.
   Production deployment stays untouched; do not run production rollback/promote.
   If production enforcement is later approved and causes false positives, restore
   only that rule to Log/disable by owner approval while keeping hardened handler;
   full WAF publish can include other drafts, so inspect the complete diff first.

The plan can test the web proxy without changing production hosting. Native origin
is a separate blocker. WAF edits are project settings even when preview-scoped;
they still require explicit approval. No deployment/configuration action above ran.

### Follow-up validation and approvals

Existing playback/bridge/stabilization suites: **38 passed**, including the two
proxy/security tests and navigation/queue/coordination regressions. Mocked helper
429 checks passed in both modes. Static routing/client/cache review completed.
No deployed HTTP test, new test file, client fix, dependency or infrastructure
change. Documentation whitespace/diff checks pass.

Outstanding approvals/evidence: preview deployment and scoped environment/data
access; active WAF/plan visibility; separate preview rule publication; optional
native test-origin override; Google quota/key restrictions and alert ownership;
reviewed production deployment/enforcement after preview acceptance. Hardened
production deployment, shared-IP fit, edge CORS/429 behavior, native packaging/
device tests and earlier conditional Firebase/uuid gates remain open.
