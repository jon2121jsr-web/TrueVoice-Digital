-- Chime In shipped with a `flagged` column and a read policy that already
-- hides flagged=true rows (see 20260904090100_require_auth_to_read_chime_messages.sql),
-- but nothing was ever granted permission to SET flagged=true, and no UI
-- exposed it -- so in practice Chime In was a fully open, unmoderated live
-- chat with no way for anyone (including admins) to remove a message.
--
-- This closes that gap the same way admin_users already gates the Team
-- tab and feed_items moderation: an admin (an email present in
-- admin_users) can read every message regardless of flagged state, and
-- can flip `flagged` to hide/restore one. Everyone else keeps reading
-- only unflagged messages, unchanged.
--
-- Run this once against production (SQL Editor, or `supabase db push`).

create policy "Admins can read all messages" on chime_messages
  for select
  using (exists (select 1 from admin_users where email = auth.jwt() ->> 'email'));

create policy "Admins can moderate messages" on chime_messages
  for update
  using (exists (select 1 from admin_users where email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from admin_users where email = auth.jwt() ->> 'email'));
