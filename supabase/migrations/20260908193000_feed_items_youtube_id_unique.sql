-- The daily ingest cron (api/ingest-feed.js) upserts on youtube_id to avoid
-- re-inserting a video it already pulled on a previous run. Requires a
-- unique constraint to upsert against. Multiple NULLs remain allowed --
-- Postgres does not treat NULLs as equal under UNIQUE -- so verse/meme rows
-- (which have no youtube_id) are unaffected.
alter table feed_items
  add constraint feed_items_youtube_id_unique unique (youtube_id);
