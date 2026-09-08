-- Closes the anonymous-read gap: previously anyone could read unflagged
-- messages without an account, only posting required sign-in. This makes
-- reading require a session too, matching feed_reactions.
--
-- This is a real change -- run it once against production (SQL Editor,
-- or `supabase db push` once the CLI is linked).
drop policy "Public can read messages" on chime_messages;

create policy "Signed-in users can read unflagged messages" on chime_messages
  for select using (auth.uid() is not null and flagged = false);
