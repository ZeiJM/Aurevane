-- Prepared Owner release control; not a migration or execution receipt.
-- Verify compatible application READY and exact source FIRST: __DEPLOYED_SHA__.
-- Strict HP/MP percentages and finite simple execution presets require the compatible reader.
-- Pointer rollback retains all history; captured new definitions still need that reader.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
select app_private.lock_combat_content_catalogue_v1('__EXPECTED_CATALOGUE_TOKEN__');
lock table app_private.combat_content_drafts in share row exclusive mode;
select pg_advisory_xact_lock(hashtextextended('combat-effect-timing-policy',0));
do $simple_requirements_release$
declare
  actor uuid := '__OWNER_ACTOR_UUID__';
  cohort jsonb := $simple_requirements_cohort$__COHORT_JSON__$simple_requirements_cohort$::jsonb;
  baseline jsonb := $simple_requirements_baseline$__BASELINE_JSON__$simple_requirements_baseline$::jsonb;
  expected_policy jsonb := '{"version":8,"tagAuthority":"global","modes":{"summon":"instant","displace":"instant","mp-drain":"instant","remove-status":"instant","return-to-turn-start":"controlled","barrier-change":"instant","blindside":"instant"}}'::jsonb;
  history_snapshot jsonb;
  row jsonb;
  expected_definition jsonb;
  current_definition jsonb;
  current_version integer;
  receipt record;
begin
  perform app_private.assert_game_owner_v1(actor);
  if public.read_combat_effect_timing_policy_v1() is distinct from expected_policy then raise exception 'SIMPLE_REQUIREMENTS_RELEASE_POLICY_CHANGED'; end if;
  if jsonb_array_length(cohort) <> 166
    or (select count(distinct r->>'id') from jsonb_array_elements(cohort) r) <> 166
    or (select count(*) from jsonb_array_elements(cohort) r where r->>'kind'='skill') <> 24
    or (select count(*) from jsonb_array_elements(cohort) r where r->>'kind'='basic') <> 2
    or (select count(*) from jsonb_array_elements(cohort) r where r->>'kind'='essence') <> 4
    or (select count(*) from jsonb_array_elements(cohort) r where r->>'kind'='resonance') <> 136
    or jsonb_array_length(baseline) <> 294
    or (select count(distinct r->>'id') from jsonb_array_elements(baseline) r) <> 294
    or (select count(*) from app_private.combat_content_versions) <> 953
    or (select count(*) from app_private.combat_content_publications) <> 294
    or exists(select 1 from app_private.combat_content_drafts) then raise exception 'SIMPLE_REQUIREMENTS_RELEASE_INVENTORY_CHANGED'; end if;
  select jsonb_agg(to_jsonb(v) order by v.id) into history_snapshot from app_private.combat_content_versions v;
  -- Verify every current pointer/version/definition, including all128 untouched definitions.
  for row in select value from jsonb_array_elements(baseline) loop
    expected_definition := coalesce((select c->'after' from jsonb_array_elements(cohort) c where c->>'id'=row->>'id'),row->'after');
    select v.definition,v.content_version into current_definition,current_version
      from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id
      where p.content_key=row->>'id' and p.content_kind=case when row->>'kind'='basic' then 'skill' else row->>'kind' end;
    if current_definition is distinct from expected_definition
      or current_version is distinct from (expected_definition->>'contentVersion')::integer then
      raise exception 'SIMPLE_REQUIREMENTS_RELEASE_PRECHECK_CURRENT_MISMATCH: %',row->>'id';
    end if;
    if not exists(select 1 from app_private.combat_content_versions v where v.content_key=row->>'id'
      and v.content_kind=case when row->>'kind'='basic' then 'skill' else row->>'kind' end
      and v.content_version=(row->'after'->>'contentVersion')::integer and v.definition=row->'after') then
      raise exception 'SIMPLE_REQUIREMENTS_RELEASE_BASELINE_HISTORY_MISMATCH: %',row->>'id';
    end if;
  end loop;
  -- Python binder validates canonical SHA256 beforeDigest; SQL checks the exact same before JSONB.
  for row in select value from jsonb_array_elements(cohort) loop
    if not exists(select 1 from jsonb_array_elements(baseline) b where b->>'id'=row->>'id'
      and b->>'kind'=row->>'kind' and b->'after'=row->'before') then
      raise exception 'SIMPLE_REQUIREMENTS_RELEASE_BEFORE_MISMATCH: %',row->>'id';
    end if;
    if (row->'before'->>'contentVersion')::integer <> (row->>'beforeVersion')::integer
      or (row->'after'->>'contentVersion')::integer <> (row->>'beforeVersion')::integer+1
      or row->>'beforeDigest' !~ '^[a-f0-9]{64}$' then raise exception 'SIMPLE_REQUIREMENTS_RELEASE_VERSION_MISMATCH'; end if;
    if not exists(select 1 from app_private.combat_content_versions v where v.content_key=row->>'id'
      and v.content_kind=case when row->>'kind'='basic' then 'skill' else row->>'kind' end and v.content_version=(row->>'beforeVersion')::integer
      and v.definition=row->'before') then raise exception 'SIMPLE_REQUIREMENTS_RELEASE_OLD_HISTORY_MISMATCH: %',row->>'id'; end if;
    if not exists(select 1 from app_private.combat_content_versions v where v.content_key=row->>'id'
      and v.content_kind=case when row->>'kind'='basic' then 'skill' else row->>'kind' end and v.content_version=(row->'after'->>'contentVersion')::integer
      and v.definition=row->'after') then raise exception 'SIMPLE_REQUIREMENTS_RELEASE_NEW_HISTORY_MISMATCH: %',row->>'id'; end if;
  end loop;
  for row in select value from jsonb_array_elements(cohort) loop
    perform public.set_combat_content_publication_v2(actor,row->>'id',case when row->>'kind'='basic' then 'skill' else row->>'kind' end,
      (row->>'beforeVersion')::integer,public.read_combat_content_catalogue_v1()->>'token');
  end loop;
  -- Recheck every294 current pointer, not only the166 narrow mutation receipts.
  for row in select value from jsonb_array_elements(baseline) loop
    expected_definition := row->'after';
    select v.definition,v.content_version into current_definition,current_version
      from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id
      where p.content_key=row->>'id' and p.content_kind=case when row->>'kind'='basic' then 'skill' else row->>'kind' end;
    if current_definition is distinct from expected_definition
      or current_version is distinct from (expected_definition->>'contentVersion')::integer then
      raise exception 'SIMPLE_REQUIREMENTS_RELEASE_POSTCHECK_CURRENT_MISMATCH: %',row->>'id';
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(history_snapshot) h
    left join app_private.combat_content_versions v on v.id::text=h->>'id'
    where to_jsonb(v) is distinct from h) then raise exception 'SIMPLE_REQUIREMENTS_RELEASE_HISTORY_RETENTION_MISMATCH'; end if;
  if (select count(*) from app_private.combat_content_versions) <> 953
    or (select count(*) from app_private.combat_content_publications) <> 294
    or exists(select 1 from app_private.combat_content_drafts)
    or public.read_combat_effect_timing_policy_v1() is distinct from expected_policy then raise exception 'SIMPLE_REQUIREMENTS_RELEASE_INCOMPLETE'; end if;
end;
$simple_requirements_release$;
commit;
select jsonb_build_object(
  'mode','rollback','history',(select count(*) from app_private.combat_content_versions),
  'current',(select count(*) from app_private.combat_content_publications),
  'drafts',(select count(*) from app_private.combat_content_drafts),
  'policy',public.read_combat_effect_timing_policy_v1(),
  'token',public.read_combat_content_catalogue_v1()->>'token',
  'currentHash',(select md5(coalesce(jsonb_agg(jsonb_build_object('id',v.content_key,'kind',v.content_kind,
    'version',v.content_version,'definition',v.definition) order by v.content_key collate "C"),'[]'::jsonb)::text)
    from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id),
  'historyHash',(select md5(coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]'::jsonb)::text) from app_private.combat_content_versions v),
  'hashFormat','md5-postgresql-jsonb-text; exact JSONB equality is authoritative',
  'candidateSha256','__CANDIDATE_SHA256__','designSha256','__DESIGN_SHA256__',
  'effectiveBaselineSha256','__EFFECTIVE_BASELINE_SHA256__','compatibleSourceSha','__DEPLOYED_SHA__'
) as resonance_simple_requirements_release_receipt;
