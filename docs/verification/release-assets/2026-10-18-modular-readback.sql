with cohort as materialized (
  select value r from jsonb_array_elements($modular_cohort$__COHORT_JSON__$modular_cohort$::jsonb)
), snapshot as materialized (
  select public.read_combat_content_catalogue_v1() value
), compared as (
  select r->>'id' id,
    v.definition is not distinct from r->'after' exact_current,
    case when r->'before' = 'null'::jsonb then true else exists(
      select 1 from app_private.combat_content_versions h where h.content_key=r->>'id'
        and h.content_kind=r->>'kind' and h.definition=r->'before'
    ) end old_history_retained
  from cohort left join app_private.combat_content_publications p on p.content_key=r->>'id' and p.content_kind=r->>'kind'
  left join app_private.combat_content_versions v on v.id=p.version_id
)
select jsonb_build_object(
  'expected', (select count(*) from cohort),
  'exact_current', (select count(*) from compared where exact_current),
  'old_history_retained', (select count(*) from compared where old_history_retained),
  'mismatches', (select coalesce(jsonb_agg(id order by id),'[]') from compared where not exact_current or not old_history_retained),
  'history', (select count(*) from app_private.combat_content_versions),
  'current', (select count(*) from app_private.combat_content_publications),
  'drafts', (select count(*) from app_private.combat_content_drafts),
  'policy', (select value->'policy' from snapshot),
  'token', (select value->>'token' from snapshot)
) as modular_readback;
