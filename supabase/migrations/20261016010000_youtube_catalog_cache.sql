-- PREPARED ONLY: additive, server-only catalog cache. Do not execute without approval.
begin;
create table public.youtube_catalog_cache (
  cache_key text primary key check (cache_key ~ '^yt:v1:[a-f0-9]{64}$'),
  request jsonb not null check (octet_length(request::text) <= 4096),
  is_core boolean not null default false,
  payload jsonb check (payload is null or (jsonb_typeof(payload) = 'object'
    and jsonb_typeof(payload->'items') is not distinct from 'array' and octet_length(payload::text) <= 1048576)),
  last_success timestamptz,
  fresh_until timestamptz,
  stale_until timestamptz,
  lease_owner uuid,
  lease_until timestamptz,
  check (payload is null or (last_success is not null and fresh_until is not null and stale_until is not null and fresh_until >= last_success
    and stale_until >= fresh_until and stale_until <= fresh_until + interval '24 hours'))
);
create table public.youtube_catalog_control (
  id integer primary key check (id = 1),
  quota_until timestamptz,
  budget_day date,
  attempts integer not null default 0 check (attempts between 0 and 1000),
  optional_attempts integer not null default 0 check (optional_attempts between 0 and 150 and optional_attempts <= attempts)
);
insert into public.youtube_catalog_control(id) values (1);
alter table public.youtube_catalog_cache enable row level security;
alter table public.youtube_catalog_control enable row level security;
revoke all on public.youtube_catalog_cache, public.youtube_catalog_control from public, anon, authenticated;
grant select, insert, update, delete on public.youtube_catalog_cache, public.youtube_catalog_control to service_role;

-- SECURITY INVOKER: no privilege escalation; only service_role has table access.
-- Global row lock serializes short claim/finish transactions, never HTTP requests.
create function public.youtube_catalog_cache_v1(
  p_action text, p_key text default null, p_query jsonb default null,
  p_owner uuid default null, p_payload jsonb default null, p_ttl integer default null,
  p_until timestamptz default null, p_quota boolean default false,
  p_channels text[] default null, p_core boolean default false
) returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  t timestamptz := clock_timestamp();
  c public.youtube_catalog_control%rowtype;
  e public.youtube_catalog_cache%rowtype;
  stale jsonb;
  lifetime_ms numeric;
  reset_at timestamptz := (((clock_timestamp() at time zone 'America/Los_Angeles')::date + 1)::timestamp at time zone 'America/Los_Angeles');
begin
  if p_action = 'authorize' then
    if p_query->>'endpoint' = 'playlistItems' then
      return to_jsonb(exists(select 1 from public.youtube_catalog_cache x
        where x.request->>'endpoint' = 'channels' and x.request->>'id' = any(p_channels)
          and x.stale_until > t and exists(select 1 from jsonb_array_elements(x.payload->'items') i
            where i->'contentDetails'->'relatedPlaylists'->>'uploads' = p_query->>'playlistId')));
    elsif p_query->>'endpoint' = 'videos' then
      return to_jsonb(not exists(select 1 from unnest(string_to_array(p_query->>'id', ',')) wanted
        where not exists(select 1 from public.youtube_catalog_cache x,
          lateral jsonb_array_elements(x.payload->'items') i
          where x.request->>'endpoint' = 'playlistItems' and x.stale_until > t
            and i->'snippet'->'resourceId'->>'videoId' = wanted
            and (exists(select 1 from unnest(p_channels) ch where x.request->>'playlistId' = 'UU' || substr(ch,3))
              or exists(select 1 from public.youtube_catalog_cache m,
                lateral jsonb_array_elements(m.payload->'items') mi
                where m.request->>'endpoint' = 'channels' and m.request->>'id' = any(p_channels)
                  and m.stale_until > t and mi->'contentDetails'->'relatedPlaylists'->>'uploads' = x.request->>'playlistId')))));
    end if;
    return 'false'::jsonb;
  end if;
  select * into c from public.youtube_catalog_control where id = 1 for update;
  if not found then raise exception 'Cache control unavailable'; end if;
  t := clock_timestamp();
  reset_at := (((t at time zone 'America/Los_Angeles')::date + 1)::timestamp at time zone 'America/Los_Angeles');
  select * into e from public.youtube_catalog_cache where cache_key = p_key for update;
  if p_action = 'claim' then
    -- Opportunistic bounded cleanup, protected by the same lock as insert.
    delete from public.youtube_catalog_cache where coalesce(stale_until, '-infinity') < t
      and coalesce(lease_until, '-infinity') < t;
    select * into e from public.youtube_catalog_cache where cache_key = p_key;
    stale := case when e.stale_until > t then e.payload else null end;
    lifetime_ms := greatest(0, floor(extract(epoch from (e.stale_until - t)) * 1000));
    if e.fresh_until > t and stale is not null then
      return jsonb_build_object('fresh', true, 'payload', stale, 'stale_remaining_ms', lifetime_ms, 'acquired', false);
    end if;
    if c.budget_day is distinct from (t at time zone 'America/Los_Angeles')::date then
      update public.youtube_catalog_control set budget_day = (t at time zone 'America/Los_Angeles')::date, attempts = 0, optional_attempts = 0 where id = 1;
      c.attempts := 0;
      c.optional_attempts := 0;
    end if;
    if e.cache_key is not null and e.is_core is distinct from p_core then raise exception 'Cache class mismatch'; end if;
    if c.quota_until > t or c.attempts >= 1000 or (not p_core and c.optional_attempts >= 150) or e.lease_until > t then
      return jsonb_build_object('acquired', false, 'payload', stale, 'stale_remaining_ms', lifetime_ms, 'retry', greatest(1,
        ceil(extract(epoch from ((case when c.attempts >= 1000 or (not p_core and c.optional_attempts >= 150) then reset_at
          else greatest(c.quota_until, e.lease_until) end) - t)))));
    end if;
    -- Dedicated capacity: optional variants cannot occupy core slots. Core key
    -- classification comes only from the server's finite audited query inventory.
    if e.cache_key is null and (select count(*) from public.youtube_catalog_cache where is_core = p_core) >= (case when p_core then 26 else 6 end) then
      return jsonb_build_object('acquired', false, 'retry', 60);
    end if;
    insert into public.youtube_catalog_cache(cache_key, request, is_core, lease_owner, lease_until)
      values(p_key, p_query, p_core, p_owner, t + interval '20 seconds')
      on conflict(cache_key) do update set lease_owner = p_owner, lease_until = t + interval '20 seconds';
    update public.youtube_catalog_control set attempts = attempts + 1,
      optional_attempts = optional_attempts + case when p_core then 0 else 1 end where id = 1;
    return jsonb_build_object('acquired', true, 'payload', stale, 'stale_remaining_ms', lifetime_ms);
  elsif p_action = 'finish' then
    if e.lease_owner is distinct from p_owner or e.lease_until <= t or p_owner is null then return 'false'::jsonb; end if;
    if p_ttl not in (1800, 86400) or p_payload is null or p_payload ? 'error'
      or jsonb_typeof(p_payload->'items') is distinct from 'array' then raise exception 'Invalid catalog'; end if;
    update public.youtube_catalog_cache set payload = p_payload, last_success = t,
      fresh_until = t + make_interval(secs => p_ttl),
      stale_until = t + make_interval(secs => p_ttl) + interval '24 hours',
      lease_owner = null, lease_until = null where cache_key = p_key;
    return 'true'::jsonb;
  elsif p_action = 'fail' then
    if e.lease_owner is distinct from p_owner or e.lease_until <= t or p_owner is null then return 'false'::jsonb; end if;
    if p_quota then
      update public.youtube_catalog_control set quota_until = greatest(quota_until, reset_at) where id = 1;
    end if;
    update public.youtube_catalog_cache set lease_owner = null,
      lease_until = case when p_quota then reset_at else least(greatest(p_until,t + interval '1 second'),t + interval '5 minutes') end
      where cache_key = p_key;
    return 'true'::jsonb;
  end if;
  raise exception 'Unsupported cache operation';
end;
$$;
revoke all on function public.youtube_catalog_cache_v1(text,text,jsonb,uuid,jsonb,integer,timestamptz,boolean,text[],boolean) from public, anon, authenticated;
grant execute on function public.youtube_catalog_cache_v1(text,text,jsonb,uuid,jsonb,integer,timestamptz,boolean,text[],boolean) to service_role;
commit;
