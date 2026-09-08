-- feed_items: one row shape for all four Spiritual Scrolling card types,
-- differentiated by item_type. See the locked mockup for what each type
-- renders and which fields feed it.
create table if not exists feed_items (
  id                  uuid primary key default gen_random_uuid(),
  item_type           text not null check (item_type in ('reel', 'snip', 'verse', 'meme')),
  status              text not null default 'needs_review'
                        check (status in ('needs_review', 'auto_active', 'active', 'inactive')),

  -- shared across all types
  title               text,
  description         text,
  source_show         text,
  speaker             text,
  sort_weight         integer,
  published_at        timestamptz not null default now(),

  -- reel / snip -- youtube-backed
  youtube_id          text,
  source_channel_id   text,
  clip_start_seconds  integer,
  clip_end_seconds    integer,
  duration_seconds    integer,

  -- verse
  verse_text          text,
  verse_ref           text,
  bg_template_id      text,

  -- meme, and the rendered verse graphic once it's been generated
  image_url           text,
  caption             text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists feed_items_status_published_idx
  on feed_items (status, published_at desc);

alter table feed_items enable row level security;

-- Visitors only ever see what's actually live.
create policy "Public can read live feed items" on feed_items
  for select using (status in ('auto_active', 'active'));

-- Admins (present in admin_users) can review, edit, reorder, and publish.
-- The auto-ingest job runs on the service-role key, which bypasses RLS
-- entirely, so it needs no policy of its own here.
create policy "Admins manage feed items" on feed_items
  using (exists (select 1 from admin_users where email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from admin_users where email = auth.jwt() ->> 'email'));


-- feed_reactions: the single heart on the rail, one per user per item.
-- Requires sign-in to read and to react, matching chime_messages.
create table if not exists feed_reactions (
  id            uuid primary key default gen_random_uuid(),
  feed_item_id  uuid not null references feed_items(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (feed_item_id, user_id)
);

create index if not exists feed_reactions_feed_item_idx on feed_reactions (feed_item_id);

alter table feed_reactions enable row level security;

create policy "Signed-in users can read reactions" on feed_reactions
  for select using (auth.uid() is not null);

create policy "Users react as themselves" on feed_reactions
  for insert with check (auth.uid() = user_id);

create policy "Users remove their own reaction" on feed_reactions
  for delete using (auth.uid() = user_id);
