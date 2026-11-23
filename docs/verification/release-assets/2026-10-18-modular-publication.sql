-- Prepared privileged release control; not a migration or execution receipt.
-- Bind the exact Owner, fresh catalogue token and reviewed cohort before execution.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
select app_private.lock_combat_content_catalogue_v1('__EXPECTED_CATALOGUE_TOKEN__');
lock table app_private.combat_content_drafts in share row exclusive mode;
select pg_advisory_xact_lock(hashtextextended('combat-effect-timing-policy',0));
do $modular_release$
declare
  actor uuid := '__OWNER_ACTOR_UUID__';
  cohort jsonb := $modular_cohort$__COHORT_JSON__$modular_cohort$::jsonb;
  expected_policy jsonb := '{"version":7,"modes":{"summon":"instant","displace":"instant","mp-drain":"instant","remove-status":"instant","return-to-turn-start":"delayed"}}'::jsonb;
  row jsonb;
  current_definition jsonb;
  receipt record;
  count_published integer := 0;
begin
  perform app_private.assert_game_owner_v1(actor);
  if public.read_combat_effect_timing_policy_v1() is distinct from expected_policy then raise exception 'MODULAR_RELEASE_POLICY_CHANGED'; end if;
  if jsonb_array_length(cohort) <> 294
    or (select count(distinct r->>'id') from jsonb_array_elements(cohort) r) <> 294
    or (select count(*) from app_private.combat_content_versions) <> 289
    or (select count(*) from app_private.combat_content_publications) <> 289
    or exists(select 1 from app_private.combat_content_drafts) then raise exception 'MODULAR_RELEASE_INVENTORY_CHANGED'; end if;
  for row in select value from jsonb_array_elements(cohort) loop
    select definition into current_definition from public.read_current_combat_content_v1(row->>'id',row->>'kind');
    if current_definition is distinct from nullif(row->'before','null'::jsonb) then raise exception 'MODULAR_RELEASE_DEFINITION_CHANGED: %',row->>'id'; end if;
    if (row->'after'->>'contentVersion')::integer <> (row->>'beforeVersion')::integer+1 then raise exception 'MODULAR_RELEASE_VERSION_MISMATCH'; end if;
    select * into strict receipt from public.publish_combat_content_v3(
      actor,row->>'id',row->>'kind',row->'after',
      case when row->'before' = 'null'::jsonb then null else (row->>'beforeVersion')::integer end,
      public.read_combat_content_catalogue_v1()->>'token',(row->>'beforeVersion')::integer
    );
    if receipt.content_version is distinct from (row->'after'->>'contentVersion')::integer
      or receipt.definition is distinct from row->'after' then raise exception 'MODULAR_RELEASE_PUBLICATION_MISMATCH: %',row->>'id'; end if;
    count_published := count_published+1;
  end loop;
  -- No public writer can select the first global authority; subsequent Owner saves inherit it.
  insert into app_private.combat_effect_timing_policy_versions(version,modes,published_by,tag_authority)
  values(8,expected_policy->'modes' || '{"barrier-change":"instant","blindside":"instant","return-to-turn-start":"controlled"}'::jsonb,actor,'global');
  if count_published <> 294
    or (select count(*) from app_private.combat_content_versions) <> 583
    or (select count(*) from app_private.combat_content_publications) <> 294
    or exists(select 1 from app_private.combat_content_drafts) then raise exception 'MODULAR_RELEASE_COHORT_INCOMPLETE'; end if;
end;
$modular_release$;
commit;
select jsonb_build_object('history',(select count(*) from app_private.combat_content_versions),
  'current',(select count(*) from app_private.combat_content_publications),
  'drafts',(select count(*) from app_private.combat_content_drafts),
  'policy',public.read_combat_effect_timing_policy_v1(),
  'token',public.read_combat_content_catalogue_v1()->>'token') as modular_release_receipt;
