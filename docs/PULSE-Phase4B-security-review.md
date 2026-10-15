# Phase 4B security follow-up

Reviewed from feature/truevoice-pulse, base 275ec66. No dependencies, credentials,
environment values, platform configuration, or database policies were changed.

## Catalog operations

Frontend consumers are useYouTubeFeed/useYouTubeLatest and useYouTubeAnalytics.
The proxy supports exactly:

| Endpoint | part | Other parameters |
| --- | --- | --- |
| channels | contentDetails | one channel id |
| playlistItems | snippet | playlistId, maxResults 1-50 |
| videos | snippet,statistics | 1-50 video ids (Admin analytics) |

Only GET and OPTIONS are accepted. Unsupported parameters (including client keys,
pagination and arbitrary parts), repeated/array values, malformed ids and oversized
queries are rejected before upstream fetch. Query encoding is capped at 2048
characters; upstream redirects are refused; the fetch and body read share an
8-second abort deadline. Responses are capped at 1 MiB, including streamed bodies.
Errors do not return upstream bodies, credential-bearing URLs or exception text.
Public CORS and existing key selection remain compatible with Capacitor and the
loopback production-proxy fallback. No authentication was added.

## Rate limiting: configuration proposal, not implemented

Per-request bounds do not prevent repeated valid requests or distributed quota
abuse. A process-local counter cannot provide a reliable serverless quota limit.

After separate approval, configure a Vercel WAF rule matching GET /api/youtube:
start with an IP-based fixed window of 120 requests per 60 seconds, observe in Log
mode, then enforce HTTP 429 after checking homepage cold-load bursts and shared
network users. This is an initial tuning proposal, not a verified capacity limit.
Avoid interactive challenges that break native/public fetches. Retain public
access. Add Google API quota alerts and review existing key API/referrer
restrictions. Never treat the supplied Referer header or CORS as authentication.

Vercel counters are regional; this rule is not a global daily quota guarantee.
If a global circuit breaker is required, approve a shared durable counter/cache
and a documented upstream budget separately. No platform configuration changed.

Reference: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting

## Dependency assessment

Current production audit reports 3 high and 13 moderate affected package entries,
not 16 independent exploit paths. Installed versions: react-router/dom 7.13.2,
ws 8.20.0 and production uuid 9.0.1. The extra uuid 7.0.3 belongs to native tooling.

### React Router (react-router and react-router-dom: high)

The application uses BrowserRouter/Routes; it has no React Router framework
server, RSC, manifest endpoint, single-fetch or SSR hydration pipeline.

| Advisory | Issue | Applicability here |
| --- | --- | --- |
| GHSA-49rj-9fvp-4h2h | turbo-stream constructor/RCE | Framework Mode only; not this application |
| GHSA-8x6r-g9mw-2r78 | manifest expansion DoS | Framework endpoint absent |
| GHSA-rxv8-25v2-qmq8 | single-fetch DoS | Server single-fetch absent |
| GHSA-84g9-w2xq-vcv6 | document request CSRF | Server actions absent |
| GHSA-wrjc-x8rr-h8h6 | backslash open redirect | Reviewable client navigation risk; current routes use fixed internal paths and encoded ids |
| GHSA-h8fp-f39c-q6mh | RSC error handler XSS | RSC absent |
| GHSA-337j-9hxr-rhxg | SSR hydration constructor injection | SSR hydration absent |
| GHSA-chx6-hx7r-mcp5 | manifest route-matching DoS | Framework Mode only |
| GHSA-2j2x-hqr9-3h42 | protocol-relative redirect | No loader/action redirects or user-provided redirect destinations found |
| GHSA-qwww-vcr4-c8h2 | RSC CSRF bypass | RSC absent |

Recommended isolated patch: update react-router-dom to 7.18.4 and its matched
react-router 7.18.4 dependency. Registry confirms matching versions and Node >=20.
Do not jump to React Router 8. Run route, query, history, playback and native tests.
This is a compatible-major candidate, not an already-tested upgrade.

Advisory details: https://github.com/advisories/GHSA-49rj-9fvp-4h2h and
https://github.com/advisories/GHSA-chx6-hx7r-mcp5 (explicit mode exclusions).
Other entries can be found at https://github.com/advisories/<advisory-id>.

### ws (high; inherited by Supabase packages)

GHSA-58qx-3vcg-4xpx: uninitialized memory disclosure, fixed in 8.20.1.
GHSA-96hv-2xvq-fx4p: fragmented/data-chunk memory exhaustion, fixed in 8.21.0.
These affect the Node ws implementation, not the browser's native WebSocket.
No public Node WebSocket server was found; Node clients remain exposed to
untrusted peers if those paths are exercised. This is not proof of exploitability.

Recommended isolated lockfile refresh to ws 8.22.0: the installed
@supabase/realtime-js 2.101.1 accepts ^8.18.2, so the target satisfies its range.
Verify all dependency edges and Supabase chat/realtime behavior after resolution.
The moderate @supabase/realtime-js and @supabase/supabase-js entries inherit this
advisory chain. A wholesale Supabase upgrade is unnecessary for this ws patch;
the latest 2.117.3 requires Node >=22 and needs separate runtime review.

References: https://github.com/advisories/GHSA-58qx-3vcg-4xpx and
https://github.com/advisories/GHSA-96hv-2xvq-fx4p

### uuid / Google / Firebase (moderate)

GHSA-w5hq-g745-h8pq affects v3/v5/v6 with caller-supplied undersized buffers or
invalid offsets. Fixed in 11.1.1, 12.0.1 and 13.0.1. No direct application uuid
buffer calls were found; transitive backend applicability requires further review.

The remaining moderate package entries inherit the uuid dependency chain:
uuid, gaxios, gcp-metadata, google-auth-library, google-gax, gtoken,
retry-request, teeny-request, @google-cloud/firestore, @google-cloud/storage,
firebase-admin. Together with the two Supabase entries, these account for 13.

gaxios 6.7.1, google-gax 4.6.1 and teeny-request 9.0.0 require uuid ^9.0.x.
A blanket uuid override to 11+ crosses a major API/module boundary and is not
recommended without compatibility tests. Approve a separate Google/Firebase
parent-dependency review, choose releases using fixed uuid, and test push,
authentication and any storage/Firestore paths. Installed firebase-admin is
13.10.0; latest 14.5.0 is a major upgrade requiring Node >=22, not a routine patch.

Reference: https://github.com/advisories/GHSA-w5hq-g745-h8pq

## Patch sequence for approval

1. Router 7.18.4 upgrade and route/history regression verification.
2. ws 8.22.0 lockfile refresh and Supabase/realtime regression verification.
3. Review Google/Firebase dependency edges, affected uuid call sites and Node
   runtime before selecting compatible parent updates.
4. Rerun production audit, build/PWA and device tests after each isolated patch.

No npm audit fix, forced upgrades, overrides or dependency changes were performed.
