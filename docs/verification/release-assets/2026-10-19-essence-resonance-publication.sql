-- Prepared Owner release control; not a migration or execution receipt.
-- Deploy the backward-compatible subject-relation reader FIRST; verify READY/source SHA.
-- Bound compatible deployed source: __DEPLOYED_SHA__.
-- Restore compatible current pointers before any older-app promotion. Captured new
-- definitions still require the compatible reader; retain its immutable history reader.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
select app_private.lock_combat_content_catalogue_v1('__EXPECTED_CATALOGUE_TOKEN__');
lock table app_private.combat_content_drafts in share row exclusive mode;
select pg_advisory_xact_lock(hashtextextended('combat-effect-timing-policy',0));
do $identity_release$
declare
  actor uuid := '__OWNER_ACTOR_UUID__';
  cohort jsonb := $identity_cohort$__COHORT_JSON__$identity_cohort$::jsonb;
  baseline jsonb := $identity_baseline$__BASELINE_JSON__$identity_baseline$::jsonb;
  expected_policy jsonb := '{"version":8,"tagAuthority":"global","modes":{"summon":"instant","displace":"instant","mp-drain":"instant","remove-status":"instant","return-to-turn-start":"controlled","barrier-change":"instant","blindside":"instant"}}'::jsonb;
  row jsonb;
  expected_definition jsonb;
  current_definition jsonb;
  receipt record;
begin
  perform app_private.assert_game_owner_v1(actor);
  if public.read_combat_effect_timing_policy_v1() is distinct from expected_policy then raise exception 'IDENTITY_RELEASE_POLICY_CHANGED'; end if;
  if jsonb_array_length(cohort) <> 136
    or (select count(distinct r->>'id') from jsonb_array_elements(cohort) r) <> 136
    or (select count(*) from jsonb_array_elements(cohort) r where r->>'kind'='resonance') <> 131
    or (select count(*) from jsonb_array_elements(cohort) r where r->>'kind'='essence') <> 5
    or jsonb_array_length(baseline) <> 294
    or (select count(distinct r->>'id') from jsonb_array_elements(baseline) r) <> 294
    or (select count(*) from app_private.combat_content_versions) <> 583
    or (select count(*) from app_private.combat_content_publications) <> 294
    or exists(select 1 from app_private.combat_content_drafts) then raise exception 'IDENTITY_RELEASE_INVENTORY_CHANGED'; end if;
  -- Check every current row, including retained Essences/Resonances and all Skills/Basics.
  for row in select value from jsonb_array_elements(baseline) loop
    expected_definition := row->'after';
    select definition into current_definition from public.read_current_combat_content_v1(row->>'id',case when row->>'kind'='basic' then 'skill' else row->>'kind' end);
    if current_definition is distinct from expected_definition then raise exception 'IDENTITY_RELEASE_DEFINITION_CHANGED: %',row->>'id'; end if;
  end loop;
  -- Preflight exact before/after and immutable prior history before changing any pointer.
  for row in select value from jsonb_array_elements(cohort) loop
    if not exists(select 1 from jsonb_array_elements(baseline) b where b->>'id'=row->>'id' and b->>'kind'=row->>'kind' and b->'after'=row->'before') then raise exception 'IDENTITY_RELEASE_DEFINITION_CHANGED: %',row->>'id'; end if;
    if (row->'after'->>'contentVersion')::integer <> (row->>'beforeVersion')::integer+1 then raise exception 'IDENTITY_RELEASE_VERSION_MISMATCH'; end if;
    if not exists(select 1 from app_private.combat_content_versions v where v.content_key=row->>'id' and v.content_kind=row->>'kind' and v.content_version=(row->>'beforeVersion')::integer and v.definition=row->'before') then raise exception 'IDENTITY_RELEASE_HISTORY_CHANGED: %',row->>'id'; end if;
  end loop;
  for row in select value from jsonb_array_elements(cohort) loop
    select * into strict receipt from public.publish_combat_content_v3(
      actor,row->>'id',row->>'kind',row->'after',(row->>'beforeVersion')::integer,
      public.read_combat_content_catalogue_v1()->>'token',(row->>'beforeVersion')::integer);
    if receipt.content_version is distinct from (row->'after'->>'contentVersion')::integer
      or receipt.definition is distinct from row->'after' then raise exception 'IDENTITY_RELEASE_PUBLICATION_MISMATCH: %',row->>'id'; end if;
  end loop;
  if (select count(*) from app_private.combat_content_versions) <> 719
    or (select count(*) from app_private.combat_content_publications) <> 294
    or exists(select 1 from app_private.combat_content_drafts)
    or public.read_combat_effect_timing_policy_v1() is distinct from expected_policy then raise exception 'IDENTITY_RELEASE_INCOMPLETE'; end if;
end;
$identity_release$;
commit;
select jsonb_build_object('history',(select count(*) from app_private.combat_content_versions),
  'current',(select count(*) from app_private.combat_content_publications),
  'drafts',(select count(*) from app_private.combat_content_drafts),
  'policy',public.read_combat_effect_timing_policy_v1(),
  'token',public.read_combat_content_catalogue_v1()->>'token',
  'compatibleSourceSha','__DEPLOYED_SHA__') as essence_resonance_release_receipt;
