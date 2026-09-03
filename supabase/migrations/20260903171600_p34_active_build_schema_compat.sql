begin;

alter table app_private.character_active_builds
  alter column schema_version set default 2;

update app_private.character_active_builds
set schema_version = 2
where schema_version = 3;

comment on column app_private.character_active_builds.schema_version is
  'Committed build schema. P3.2 Discipline-only state remains v2; the P3.4 Skill-loadout save upgrades an individual build to v3 when Discipline Skills are committed.';

commit;
