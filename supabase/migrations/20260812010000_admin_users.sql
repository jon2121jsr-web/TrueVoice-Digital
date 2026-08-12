create table if not exists admin_users (
  email      text primary key,
  role       text default 'member',
  invited_by text,
  created_at timestamptz default now()
);

alter table admin_users enable row level security;

-- Only the service role (used by api/admin-invite.js) may write rows.
create policy "Service role full access" on admin_users
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- A signed-in user may read their own row, to check admin status client-side.
create policy "Users can read own admin row" on admin_users
  for select using (auth.jwt() ->> 'email' = email);
