-- Apple Guideline 1.2 (User Generated Content) requires apps with chat-like
-- features to give users a way to report objectionable content and block
-- abusive users, on top of any backend moderation. Chime In had backend
-- moderation (see 20260925180000_chime_messages_moderation.sql) but no
-- user-facing report mechanism at all. Blocking is handled client-side
-- (see ChimeIn.jsx) and needs no schema change; this migration adds the
-- report side.
--
-- Any signed-in user can report a message (once per message — the unique
-- constraint stops repeat-reporting the same message from inflating counts).
-- Reports are readable only by admins, via the existing admin_users
-- convention. Reporting does NOT auto-hide a message; an admin reviews and
-- flags it through the existing Chime In moderation tab if warranted, which
-- avoids a single bad-faith report silencing someone.
--
-- Run this once against production (SQL Editor, or `supabase db push`).

create table if not exists chime_message_reports (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references chime_messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (message_id, reporter_id)
);

alter table chime_message_reports enable row level security;

create policy "Users can report a message once" on chime_message_reports
  for insert
  with check (auth.uid() = reporter_id);

create policy "Admins can read reports" on chime_message_reports
  for select
  using (exists (select 1 from admin_users where email = auth.jwt() ->> 'email'));
