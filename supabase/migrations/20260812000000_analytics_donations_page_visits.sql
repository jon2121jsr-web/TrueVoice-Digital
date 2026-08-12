create table if not exists analytics_events (
  id       bigserial primary key,
  site     text,
  event    text not null,
  url      text,
  path     text,
  referrer text,
  session  text,
  show     text,
  video_id text,
  amount   numeric,
  props    jsonb,
  ip       text,
  geo      jsonb,
  ua       text,
  ts       timestamptz default now()
);
create index on analytics_events (ts desc);
create index on analytics_events (event, ts desc);
create index on analytics_events (session);
alter table analytics_events enable row level security;
create policy "Service role only" on analytics_events
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists donations (
  id                       bigserial primary key,
  stripe_payment_intent_id text unique,
  amount_cents             integer not null,
  currency                 text default 'usd',
  donor_name               text,
  donor_email              text,
  type                     text,
  status                   text,
  created_at               timestamptz default now()
);
create index on donations (created_at desc);
alter table donations enable row level security;
-- service role writes via webhook; anon reads only non-PII columns
create policy "Service role full access" on donations
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "Anon read for dashboard" on donations
  for select using (auth.role() = 'anon');

create table if not exists page_visits (
  id         bigserial primary key,
  path       text,
  referrer   text,
  user_agent text,
  visited_at timestamptz default now()
);
create index on page_visits (visited_at desc);
alter table page_visits enable row level security;
create policy "Anon insert" on page_visits for insert with check (auth.role() = 'anon');
create policy "Anon read for dashboard" on page_visits for select using (auth.role() = 'anon');
