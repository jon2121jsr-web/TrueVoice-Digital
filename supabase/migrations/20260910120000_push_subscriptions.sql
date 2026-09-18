-- Push notification device registry.
--
-- One row per installed native app (iOS/Android via Capacitor's
-- PushNotifications plugin — see src/lib/pushNotifications.js). The web
-- build never writes here; it's a no-op there. api/push/register.js
-- upserts on device_token so a reinstalled/reissued token just refreshes
-- last_seen_at instead of creating a duplicate row.
create table if not exists push_subscriptions (
  id            bigserial primary key,
  device_token  text not null unique,
  platform      text not null check (platform in ('ios', 'android')),
  created_at    timestamptz default now(),
  last_seen_at  timestamptz default now()
);

create index if not exists push_subscriptions_platform_idx on push_subscriptions (platform);

alter table push_subscriptions enable row level security;

-- Same convention as analytics_events / admin_users: only the service
-- role (api/push/register.js and api/push/send.js, both running with
-- SUPABASE_SERVICE_KEY) may read or write. No client ever queries this
-- table directly — a leaked device token list would be a spam vector.
create policy "Service role only" on push_subscriptions
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
