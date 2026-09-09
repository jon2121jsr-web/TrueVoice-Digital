-- Scroll funnel, Phase 1 (Funnel MVP). Purely additive -- no existing
-- column changes shape, no data migration needed for rows already live.
--
-- cta_type's check list includes the full vocabulary from the GTM funnel
-- plan (listen_live / follow_show / visit_site / donate) even though
-- Phase 1's UI only ever writes 'listen_live' -- so Phase 2 can turn on
-- the next CTA type without another migration.
alter table feed_items
  add column if not exists category   text,
  add column if not exists depth_rank smallint,
  add column if not exists cta_type   text
    check (cta_type is null or cta_type in ('listen_live', 'follow_show', 'visit_site', 'donate')),
  add column if not exists cta_target text,
  add column if not exists expires_at timestamptz;

comment on column feed_items.category    is 'Editorial category, e.g. sermon_clip / testimony / worship / news / promo. Free text for Phase 1; not yet constrained.';
comment on column feed_items.depth_rank  is 'Manual position on the Depth Ladder. Null = default ordering by item_type/published_at.';
comment on column feed_items.cta_type    is 'Which call-to-action, if any, renders on this card. Phase 1 only ever sets listen_live.';
comment on column feed_items.cta_target  is 'Optional target for the CTA -- a show slug (see src/showSchedule.js ids) or an outbound URL. Unused while cta_type is listen_live only.';
comment on column feed_items.expires_at  is 'Optional expiry for time-boxed promo content. Null = evergreen. Not yet enforced by any query -- enforcement is Phase 2.';
