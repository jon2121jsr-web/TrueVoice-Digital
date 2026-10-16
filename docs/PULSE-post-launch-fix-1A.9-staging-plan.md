# PULSE Fix 1A.9: isolated AzuraCast calibration candidate

Approved scope: commit the optional AzuraCast timing override from Fix 1A.8 and
stage exactly one Production candidate without promotion. No audio transport,
recovery, fallback, URLs, native files or existing integration behavior changes.
The previously approved waveform icons remain inherited from the parent release.

## Deployment-only configuration

Use `--prod --skip-domain --build-env VITE_AZURACAST_METADATA_DELAY_SEC=2`.
Do not modify shared Vercel environment variables. Existing legacy timing must
remain 15; do not add a LIVE365 override (its default remains 55).

`tools/verify-stream-timing-build.mjs` checks the actual emitted main bundle and
its controller currentSrc wiring, executing only the small pure timing helpers.
It fails unless the controller's compiled settings select LIVE365=55,
AzuraCast=2 and unknown=15, and a service worker exists. It performs no network
requests or application execution and prints no environment values or secrets.

In the clean detached worktree, use a deployment-scoped `--local-config` file
under ignored `.vercel/`, preserving all committed rewrites and cron declarations
and overriding only `buildCommand` to:

```text
npm run build && node tools/verify-stream-timing-build.mjs
```

This verifies the Vercel-built artifact in cloud build logs rather than relying
on local environment settings or bypassing protected deployment authentication.
It does not change the project's saved build command. Verify project identity,
the exact committed source, cloud verification output, Ready status, and both
public domains remaining on `dpl_HmbTwRKST61h4VuSiUYmEJUYWfpd`.

## Acceptance remains pending

Sign in normally to the staged URL. Confirm actual audio.currentSrc before five
consecutive audible transitions. Record audible/title/artwork timestamps and
signed title/artwork differences; target is within +/-5 seconds. Skip initial
join. Direct AzuraCast must use 2; LIVE365 remains 55; unknown remains 15.
The previous local 2-second test did not confirm the source and had two +6-second
results, so it is not a conclusive calibration pass.

Check pause/resume, video coordination, buffering, artwork flicker, unexpected
reloads, waveform favicon and direct /explore refresh. Do not force hosted stream
failures, initiate writes, transactions or uploads. Natural fallback and Safari
remain unverified unless actually observed. No promotion is authorized.

Record final commit, checks, deployment ID/URL and domain checks in a separate
post-staging results report; no self-referential commit hash is needed here.
