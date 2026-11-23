-- Keep the compatible application deployed: corrected captured battles require its parsers.
-- Restore future captures to the previous catalogue/policy, retaining all immutable history.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
select app_private.lock_combat_content_catalogue_v1('__EXPECTED_CATALOGUE_TOKEN__');
lock table app_private.combat_content_drafts in share row exclusive mode;
select pg_advisory_xact_lock(hashtextextended('combat-effect-timing-policy',0));
do $modular_rollback$
declare
  actor uuid := '__OWNER_ACTOR_UUID__';
  cohort jsonb := $modular_cohort$__COHORT_JSON__$modular_cohort$::jsonb;
  old_modes jsonb := '{"summon":"instant","displace":"instant","mp-drain":"instant","remove-status":"instant","return-to-turn-start":"delayed"}'::jsonb;
  expected_policy jsonb;
  row jsonb;
  current_definition jsonb;
begin
  perform app_private.assert_game_owner_v1(actor);
  expected_policy := jsonb_build_object('version',8,'tagAuthority','global','modes',
    old_modes || '{"barrier-change":"instant","blindside":"instant","return-to-turn-start":"controlled"}'::jsonb);
  if public.read_combat_effect_timing_policy_v1() is distinct from expected_policy then raise exception 'MODULAR_ROLLBACK_POLICY_CHANGED'; end if;
  if jsonb_array_length(cohort) <> 294
    or (select count(distinct r->>'id') from jsonb_array_elements(cohort) r) <> 294
    or (select count(*) from app_private.combat_content_versions) <> 583
    or (select count(*) from app_private.combat_content_publications) <> 294
    or exists(select 1 from app_private.combat_content_drafts) then raise exception 'MODULAR_ROLLBACK_INVENTORY_CHANGED'; end if;
  for row in select value from jsonb_array_elements(cohort) loop
    select definition into strict current_definition from public.read_current_combat_content_v1(row->>'id',row->>'kind');
    if current_definition is distinct from row->'after' then raise exception 'MODULAR_ROLLBACK_DEFINITION_CHANGED: %',row->>'id'; end if;
    perform public.set_combat_content_publication_v2(actor,row->>'id',row->>'kind',
      case when row->'before' = 'null'::jsonb then null else (row->>'beforeVersion')::integer end,
      public.read_combat_content_catalogue_v1()->>'token');
  end loop;
  insert into app_private.combat_effect_timing_policy_versions(version,modes,published_by,tag_authority)
    values(9,old_modes,actor,null);
  if (select count(*) from app_private.combat_content_versions) <> 583
    or (select count(*) from app_private.combat_content_publications) <> 289 then raise exception 'MODULAR_ROLLBACK_INCOMPLETE'; end if;
end;
$modular_rollback$;
commit;
