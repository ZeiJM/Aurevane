-- Server-private exact readback, including untouched Skills and all five Basics.
with cohort as materialized (
  select value r from jsonb_array_elements($identity_cohort$__COHORT_JSON__$identity_cohort$::jsonb)
), baseline as materialized (
  select value r from jsonb_array_elements($identity_baseline$__BASELINE_JSON__$identity_baseline$::jsonb)
), compared as (
  select r->>'id' id, v.definition is not distinct from r->'after' exact_current,
    exists(select 1 from app_private.combat_content_versions h where h.content_key=r->>'id'
      and h.content_kind=r->>'kind' and h.content_version=(r->>'beforeVersion')::integer
      and h.definition=r->'before') old_history_retained
  from cohort left join app_private.combat_content_publications p on p.content_key=r->>'id' and p.content_kind=r->>'kind'
  left join app_private.combat_content_versions v on v.id=p.version_id
), untouched as (
  select b.r->>'id' id, v.definition is not distinct from b.r->'after' exact_current
  from baseline b left join app_private.combat_content_publications p on p.content_key=b.r->>'id'
    and p.content_kind=case when b.r->>'kind'='basic' then 'skill' else b.r->>'kind' end
  left join app_private.combat_content_versions v on v.id=p.version_id
  where not exists(select 1 from cohort c where c.r->>'id'=b.r->>'id')
)
select jsonb_build_object(
  'expected',(select count(*) from cohort),'exact_current',(select count(*) from compared where exact_current),
  'old_history_retained',(select count(*) from compared where old_history_retained),
  'untouched',(select count(*) from untouched),'exact_untouched',(select count(*) from untouched where exact_current),
  'mismatches',(select coalesce(jsonb_agg(id order by id),'[]') from (
    select id from compared where not exact_current or not old_history_retained
    union all select id from untouched where not exact_current) m),
  'history',(select count(*) from app_private.combat_content_versions),
  'current',(select count(*) from app_private.combat_content_publications),
  'drafts',(select count(*) from app_private.combat_content_drafts),
  'policy',public.read_combat_effect_timing_policy_v1(),
  'token',public.read_combat_content_catalogue_v1()->>'token'
) as essence_resonance_readback;
