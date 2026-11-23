begin;

-- Extend the existing server-only immutable combat-content lineage to the two
-- additional current authoring surfaces. This changes only allowed identities;
-- RLS, grants, immutability triggers, optimistic drafts and publication pointers
-- remain owned by the original combat-content migration.
alter table app_private.combat_content_versions
  drop constraint if exists combat_content_versions_content_kind_check;
alter table app_private.combat_content_versions
  add constraint combat_content_versions_content_kind_check
  check (content_kind in ('skill','essence','resonance','status','effect-profile'));

alter table app_private.combat_content_drafts
  drop constraint if exists combat_content_drafts_content_kind_check;
alter table app_private.combat_content_drafts
  add constraint combat_content_drafts_content_kind_check
  check (content_kind in ('skill','essence','resonance','status','effect-profile'));

alter table app_private.combat_content_publications
  drop constraint if exists combat_content_publications_content_kind_check;
alter table app_private.combat_content_publications
  add constraint combat_content_publications_content_kind_check
  check (content_kind in ('skill','essence','resonance','status','effect-profile'));

commit;
