# PULSE Phase 4C.5D: test backend setup procedure

Prepared against `db7573e9cc12cbfdd2c370ba4496d509e1f2c176` on
feature/truevoice-pulse. **Preparation only; nothing below has been provisioned,
applied or deployed.** External actions require separate explicit approval,
including project/cost selection, test schema/seeding and Preview variable changes.
Never run this procedure against Production or paste credentials into reports.

## 1. Approve scope and identify the project

1. Owner approves a new standalone Supabase test project and permitted cost/plan,
   organization, region and lifetime. In Supabase Dashboard > organization > New
   project, select only the approved plan. Do not restore/fork production data.
   **Do not perform this step until approval.** No CLI provisioning dependency
   or linked remote migration workflow is configured in this repo.
2. Record the new test project ref and the verified Production ref privately in
   the setup checklist (refs are identifiers, not secrets). Dashboard > Project
   Settings > General identifies the project; Connect/Data API settings identifies
   its URL. Verify both projects directly and confirm refs differ; a name such as
   "test" is not proof. Exact settings labels may vary with dashboard updates.
3. Use a separate browser profile and keep only the test project's SQL Editor open.
   Check organization/name/ref before every SQL action. No production user, Auth,
   donor, device, analytics or storage records may be copied.

## 2. Minimum resources and dependencies

| Resource | Need / treatment |
| --- | --- |
| public.feed_items | Essential: useFeedItems reads active/auto_active rows, excludes verse, orders published_at/id; Home Scroll preview and EXPLORE consume it |
| public.admin_users | Empty migration dependency: existing feed admin policy references it; guest access revoked and feed admin policy removed in test setup |
| public.feed_reactions | Created by existing feed migration; not needed for Preview's local TrueVoice Like or signed-out feed; no guest grants |
| Other public tables | No analytics_events, donations, page_visits, chime_messages/reports or push_subscriptions needed for guest scope |
| Views / custom functions / triggers | None required by guest PULSE queries; existing UUID generation defaults are sufficient; no callable write RPCs |
| Storage buckets | None: public YouTube thumbnails and repository assets suffice; no drop-uploads bucket, production object copy or guest storage grants |
| Auth / Realtime | Client session detection/sign-in/writes disabled in Preview; ChimeIn skips message query/subscription without session; no test users or publication additions required |
| LIVE365 / AzuraCast | Existing public listen/nowplaying GETs; no Supabase resource or station management credential |
| YouTube catalog / playback | Dedicated server key for proxy; embed/thumbnail hosts unchanged; no database ingestion service required |
| Podcasts | Existing public RSS/RSS2JSON GETs; no Supabase table/provider credential |
| Router / deep links / PWA | Client/static functionality. Matching video IDs must exist in fixture/catalog; no backend routing Function needed beyond YouTube proxy |

Auth-required reactions/chat/admin/payments/uploads/push/ingestion are outside this
setup. Their pages may display unavailable/error states; do not populate production
data to remove those messages. Preview privileged API routes deliberately return 403.

## 3. Apply the selected repository schema, test project only

After project/schema approval, use Dashboard > test project > SQL Editor > New
query. Paste each repository file's exact SQL in this order and run once:

1. `supabase/migrations/20260812010000_admin_users.sql`
2. `supabase/migrations/20260904090200_feed_items_and_reactions.sql`
3. `supabase/migrations/20260908193000_feed_items_youtube_id_unique.sql`
4. `supabase/migrations/20260909100000_scroll_funnel_phase1.sql`

Run all setup/hardening before exposing any preview. These files include policies
for production features, so the test hardening below is mandatory. Do not run the
whole migration directory: that would introduce telemetry, upload and other write
features unnecessary for this scope. This is a selected test-schema setup, not a
claim of full production migration parity. Record file hashes/revision and applied
steps in the test project's setup log; dashboard SQL does not populate a CLI
migration ledger automatically. Policies/constraints make these original files
non-idempotent: do not replay them blindly on an already initialized project.

The following **test-only** hardening is reproducible after those four files.
It changes no repository migration or production policy:

```sql
begin;
alter table public.feed_items enable row level security;
alter table public.admin_users enable row level security;
alter table public.feed_reactions enable row level security;

revoke all on public.feed_items, public.admin_users, public.feed_reactions
  from public, anon, authenticated;
grant usage on schema public to anon;
grant select on public.feed_items to anon;

drop policy if exists "Admins manage feed items" on public.feed_items;
drop policy if exists "Public can read live feed items" on public.feed_items;
drop policy if exists "Preview guest reads fixture feed" on public.feed_items;
create policy "Preview guest reads fixture feed"
  on public.feed_items for select to anon
  using (status in ('active', 'auto_active'));
commit;
```

Dropping the admin policy avoids its subquery requiring guest admin_users access.
No authenticated grants or write policy is added. Review any automatically granted
privileges on other exposed test tables/functions before approval. Grants and RLS
must both be checked; an anon/publishable key is not itself read-only.
[Supabase RLS reference](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 4. Seed synthetic fixture content

Owner must approve three distinct public, embeddable YouTube IDs. The known repeat
case uUWdS1feO3c is a candidate, not proof of current availability or rights. Supply
two additional IDs before running this seed; placeholders intentionally abort it.
Titles/descriptions/UUIDs below are synthetic and contain no production DB data.
No copied channel statistics or user/customer objects are needed.

In the same verified test SQL Editor, run this transaction after replacing the
two placeholder IDs with approved values:

```sql
begin;
create temporary table pulse_fixture_seed (
  id uuid, item_type text, title text, source_show text, youtube_id text, category text
) on commit drop;
insert into pulse_fixture_seed values
 ('00000000-0000-4000-8000-000000000001','snip','Preview fixture A','Fixture source A','uUWdS1feO3c','music'),
 ('00000000-0000-4000-8000-000000000002','reel','Preview fixture B','Fixture source B','<VIDEO_ID_B>','test'),
 ('00000000-0000-4000-8000-000000000003','snip','Preview fixture C','Fixture source C','<VIDEO_ID_C>','music');
do $$ begin
  if exists (select 1 from pulse_fixture_seed where youtube_id !~ '^[A-Za-z0-9_-]{11}$')
     or (select count(distinct youtube_id) from pulse_fixture_seed) <> 3 then
    raise exception 'Supply three distinct approved video IDs before seeding';
  end if;
end $$;
insert into public.feed_items
 (id,item_type,status,title,description,source_show,youtube_id,category,published_at)
select id,item_type,'active',title,'Synthetic guest Preview content',source_show,
       youtube_id,category,'2026-10-14T12:00:00Z'::timestamptz
from pulse_fixture_seed
on conflict (id) do update set
 item_type=excluded.item_type, status=excluded.status, title=excluded.title,
 description=excluded.description, source_show=excluded.source_show,
 youtube_id=excluded.youtube_id, category=excluded.category;

-- Hidden-row control, with no playable/user data.
insert into public.feed_items (id,item_type,status,title)
values ('00000000-0000-4000-8000-000000000004','meme','inactive','Hidden fixture')
on conflict (id) do update set status='inactive';
commit;
```

Use no clip bounds until durations/availability have been checked; full-video queue
tests then cover three valid fixtures and final boundary. The known Short can still
repeat without ENDED; manual Next is expected. Retrying with changed IDs is safe
only for these reviewed fixture UUIDs; unique youtube_id conflicts must be resolved
in the test project, never by copying/deleting production rows.

## 5. Verify grants, policies and isolation without exposing data

Run these read-only queries in the verified **test** SQL Editor. Expected evidence
contains schema/policy names, booleans and counts only, not credentials or PII:

```sql
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('feed_items','admin_users','feed_reactions');

select policyname, roles, cmd, qual
from pg_policies where schemaname='public' and tablename='feed_items';

select role_name,
 has_table_privilege(role_name,'public.feed_items','SELECT') as can_read,
 has_table_privilege(role_name,'public.feed_items','INSERT') as can_insert,
 has_table_privilege(role_name,'public.feed_items','UPDATE') as can_update,
 has_table_privilege(role_name,'public.feed_items','DELETE') as can_delete,
 has_table_privilege(role_name,'public.feed_items','TRUNCATE') as can_truncate
from (values ('anon'),('authenticated')) as roles(role_name);

select count(*) as test_admin_rows from public.admin_users;
select count(*) as test_reaction_rows from public.feed_reactions;
select count(*) as test_auth_users from auth.users;
select count(*) as test_buckets from storage.buckets;

begin;
set local role anon;
select count(*) as visible_fixture_count from public.feed_items;
select count(*) as hidden_fixture_count from public.feed_items where status='inactive';
rollback;
```

Expected: all three tables have RLS; feed has only the fixture SELECT policy; anon
SELECT true and all listed writes false; authenticated all false; admin/reaction/
Auth/bucket counts zero; anon sees three fixtures and zero inactive rows.
These statements do not attempt real writes. Complete owner review of storage
objects grants/policies, callable functions and exposed schemas too; no user-defined
write function/view should exist in the fresh minimum project. PostgreSQL role
checks do not prove project identity: separately compare dashboard refs and URL.
Future hosted tests must use approved test credentials privately, never pasted
into curl arguments, screenshots, traces or chat.

## 6. Auth, storage and key configuration

- Dashboard > Authentication > configuration (Sign In/Providers): disable new
  signups/anonymous sign-in and unneeded providers in the **test project** after
  approval. No Auth users, SMTP credentials, magic-link or password reset test needed.
- Authentication > URL Configuration: do not use production as test Site URL or
  callback. Once a preview hostname exists, owner may approve its exact HTTPS URL
  and /scroll callback in the **test project only** if future Auth testing is added.
  No wildcard production redirects. Current Preview client disables URL token
  detection/Auth requests, and ChimeIn's production callback makes Auth testing
  explicitly out of scope. [Redirect settings](https://supabase.com/docs/guides/auth/redirect-urls).
- Storage > Buckets: leave empty; do not create drop-uploads or permit guest object
  insert/update/delete. No Realtime publication is needed for signed-out guest PULSE.
- Connect / Settings > API Keys: owner configures only the test public legacy anon
  JWT for VITE_SUPABASE_ANON_KEY. Current validation decodes role/ref and rejects
  service-role/new-style non-JWT keys; it does not verify signatures. If a new
  project cannot supply a compatible legacy key, stop for a separate narrow key-
  compatibility task; do not weaken validation or use a privileged key.
  No secret/service-role/DB password belongs in Vercel Preview. SQL Editor setup
  is an owner task, not a reason to deploy a privileged key.
  [Supabase key reference](https://supabase.com/docs/guides/getting-started/api-keys).

## 7. Variable-name-only Vercel checklist

After separate environment-change approval: Vercel Dashboard > verified
true-voice-digital project > Settings/Environment Variables. Select Preview and,
where supported, feature/truevoice-pulse branch. Do not alter Production targets,
values or aliases. Confirm effective inheritance before creating a deployment.

| Group | Names / requirements (no values in this document) |
| --- | --- |
| Test backend required | TRUEVOICE_PREVIEW_SUPABASE_REF, TRUEVOICE_PRODUCTION_SUPABASE_REF, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY; owner-verified distinct refs, canonical test URL, matching test anon JWT |
| Server-only Preview credential | YOUTUBE_API_KEY; separately approved Google project/key budget, YouTube Data API restrictions; no client exposure |
| Platform metadata | VERCEL_ENV and VERCEL_TARGET_ENV must both be preview; VERCEL, if exposed, must be 1. Verify system-variable exposure, not a custom client flag. NODE_ENV=production does not authorize Production |
| Must be absent | SUPABASE_SERVICE_KEY, SUPABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PRINTFUL_API_KEY, FIREBASE_SERVICE_ACCOUNT_JSON, AZURACAST_API_KEY, DROP_PORTAL_PASSWORD, CRON_SECRET, VITE_YOUTUBE_API_KEY |
| Unnecessary: exclude | STRIPE_PUBLISHABLE_KEY, PRINTFUL_STORE_ID, NEXT_PUBLIC_SITE_URL, VITE_YOUTUBE_CHANNEL_ID, AZURACAST_BASE_URL, AZURACAST_STATION, VITE_ANALYTICS_ENDPOINT, VITE_PUSH_REGISTER_ENDPOINT and unverified unused overrides |
| Public shared settings only | Optional VITE_TRUEVOICE_STREAM_URL, VITE_STREAM_DELAY_SEC, VITE_AZURACAST_BASE_URL, VITE_AZURACAST_STATION_SLUG and approved VITE_TRUEVOICE social URL settings; public listen/metadata GETs, never station-management access |

Both public Supabase fields must point to the test project, including any generic
and branch-specific Preview entries. Current general Preview entries overlap
Production and no branch overrides were previously listed. An absent branch entry
does not exclude an inherited secret. Owner must remove **Preview target only**
from inappropriate shared entries, preserving Production/Development, and review
effects on other previews. If that cannot be done safely, seek separate approval
for a clean dedicated Vercel test project. No entry was changed or read in this task.

Build validators reject conflicts/missing/unknown deployment metadata and invalid
Preview config before artifacts. Production/Production is recognized only as
Production; custom target slugs remain unsupported. Do not use a development or
Production prebuilt bundle for Preview. Syntactic validation cannot prove that an
owner-supplied test ref is actually a separate authorized project, or establish
provider key validity, quota restrictions, RLS/grants or payment sandbox status.

## 8. Local checks, later hosted acceptance and cleanup

Commands already supported by this repository, after reviewed test configuration
is supplied privately to the shell/build environment (never in printed arguments):

```powershell
# Explicit local test context; no platform variables may contradict it.
$env:NODE_ENV = 'development'
node --test tests/pulse-preview-security.test.mjs tests/pulse-playback.test.mjs tests/pulse-bridge.test.mjs tests/pulse-stabilization.test.mjs tests/pulse-dependency-security.test.mjs tests/pulse-release-security.test.mjs

# For the later isolated Preview build, both real platform fields must be preview.
# Supply the required reviewed refs/credentials privately, then:
npm run build
git diff --check
```

This document does not authorize these commands to contact a remote database or
deploy. The test runner uses mocks; the previous synthetic build used fake config
and was not an external service test. Do not run supabase db push against a linked
project: no approved remote migration workflow exists for this minimal subset.

After separate deployment approval, record preview ID/SHA/target and verify:

1. Browser Supabase requests go only to the owner-verified test host; public feed
   reads succeed, and no production DB/Auth/storage requests occur. Use a fresh
   browser profile; do not import production sessions.
2. Preview auth actions and uploads fail before networking; test grants deny direct
   guest writes independently of client guards. No test sign-in reaches production.
3. All ten privileged routes return generic 403 on direct requests, including
   analytics/admin/upload/ingestion/payment/push/OG; no privileged SDK initializes.
   Invalid YouTube requests reject locally; a few valid calls use only test quota.
4. Donation links have no actionable href, commerce controls are disabled, and
   Stripe endpoint is denied. No checkout or webhook is triggered.
5. Home/EXPLORE fixture queue, boundary navigation, local Like, Share/deep links,
   history, LIVE metadata/audio coordination and PWA update behavior work. Current
   Share URLs and hosted embed bridge still reference production public origins;
   test navigation on preview by substituting its hostname, without changing native
   origins or production aliases. Do not claim fully isolated external playback.
6. Owner dashboard confirms production ID/aliases and data/settings unchanged.
   Rate-limit/WAF and Google quota monitoring remain separate approval gates.

Cleanup after explicit approval: remove test deployment/branch entries, disposable
fixture project or only its fixture rows as agreed, and revoke only dedicated test
credentials. Do not delete production entries, mutate production policies, restore
live secrets into Preview or copy test users/media into Production.

## Missing information and approval gates

- Approved Supabase organization/plan/region, project owner and retention budget.
- Verified Production project ref, approved separate test ref, compatible public
  key availability, and actual test grants/RLS/Auth/storage identity evidence.
- Two additional approved playable/embeddable video IDs and confirmation of the
  Short fixture's current availability; fixture failure must not be solved by cloning data.
- Approved Preview-only Google key/project restrictions, quota/alert owner.
- Authority to change Preview targets without affecting other previews, or approval
  of a dedicated Vercel project; actual system-variable exposure and safe test access.
- Separate permission to apply schema/seed/Auth configuration, then deploy/validate.

No backend project, credential or environment has been created/read/changed here.
SQL and setup steps are prepared but not remotely executed or database-tested.
Only this document and the Phase 4C.5 report are changed, uncommitted. Prior native,
Safari/Capacitor, hosted PWA, WAF/quota and conditional Firebase/uuid gates remain.
