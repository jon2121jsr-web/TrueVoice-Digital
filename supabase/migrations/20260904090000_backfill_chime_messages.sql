-- Backfills migration history for chime_messages, which has existed live
-- since Chime In shipped but was never checked in. This is a historical
-- record of the table as it was originally created -- it does not need to
-- be run against production, since the table and its original policy
-- already exist there. It exists so a fresh environment (staging, a local
-- dev database) can be built from migration history alone.
create table if not exists chime_messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null,
  message       text not null,
  flagged       boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table chime_messages enable row level security;

create policy "Public can read messages" on chime_messages
  for select using (flagged = false);

create policy "Auth users can insert" on chime_messages
  for insert with check (auth.uid() = user_id);
