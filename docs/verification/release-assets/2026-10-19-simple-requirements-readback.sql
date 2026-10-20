-- Server-private read-only exact comparison; emits small metadata, never definitions.
with cohort as materialized (
  select value r from jsonb_array_elements($simple_requirements_cohort$__COHORT_JSON__$simple_requirements_cohort$::jsonb)
), baseline as materialized (
  select value r from jsonb_array_elements($simple_requirements_baseline$__BASELINE_JSON__$simple_requirements_baseline$::jsonb)
), expected as materialized (
  select b.r->>'id' id,case when b.r->>'kind'='basic' then 'skill' else b.r->>'kind' end kind,
    case when '__READBACK_STATE__'='published' then coalesce(c.r->'after',b.r->'after') else b.r->'after' end definition
  from baseline b left join cohort c on c.r->>'id'=b.r->>'id'
), actual as materialized (
  select v.content_key id,v.content_kind kind,v.content_version version,v.definition
  from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id
), compared as (
  select coalesce(e.id,a.id) id,e.definition is not distinct from a.definition
    and a.version is not distinct from (e.definition->>'contentVersion')::integer
    and a.kind is not distinct from e.kind exact_current
  from expected e full join actual a on a.id=e.id
), old_history as (
  select b.r->>'id' id,exists(select 1 from app_private.combat_content_versions v where v.content_key=b.r->>'id'
    and v.content_kind=case when b.r->>'kind'='basic' then 'skill' else b.r->>'kind' end
    and v.content_version=(b.r->'after'->>'contentVersion')::integer and v.definition=b.r->'after') retained
  from baseline b
), new_history as (
  select c.r->>'id' id,exists(select 1 from app_private.combat_content_versions v where v.content_key=c.r->>'id'
    and v.content_kind=case when c.r->>'kind'='basic' then 'skill' else c.r->>'kind' end and v.content_version=(c.r->'after'->>'contentVersion')::integer
    and v.definition=c.r->'after') retained from cohort c
)
select jsonb_build_object(
  'state','__READBACK_STATE__','expected_current',294,'expected_history',953,'expected_changed',166,'expected_untouched',128,
  'current_mismatch_count',(select count(*) from compared where not exact_current),
  'old_history_mismatch_count',(select count(*) from old_history where not retained),
  'new_history_mismatch_count',(select count(*) from new_history where not retained),
  'exact_current',(select count(*) from compared where exact_current),
  'exact_untouched',(select count(*) from compared p where exact_current and not exists(select 1 from cohort c where c.r->>'id'=p.id)),
  'mismatches',(select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from (
    select id from compared where not exact_current union select id from old_history where not retained
    union select id from new_history where not retained) m),
  'expected_current_hash',(select md5(coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,
    'version',(definition->>'contentVersion')::integer,'definition',definition) order by id collate "C"),'[]'::jsonb)::text) from expected),
  'actual_current_hash',(select md5(coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,
    'version',version,'definition',definition) order by id collate "C"),'[]'::jsonb)::text) from actual),
  'history_hash',(select md5(coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]'::jsonb)::text) from app_private.combat_content_versions v),
  'hashFormat','md5-postgresql-jsonb-text; exact JSONB equality is authoritative',
  'history',(select count(*) from app_private.combat_content_versions),
  'current',(select count(*) from app_private.combat_content_publications),
  'drafts',(select count(*) from app_private.combat_content_drafts),
  'policy',public.read_combat_effect_timing_policy_v1(),'policy_matches',public.read_combat_effect_timing_policy_v1()='__POLICY_JSON__'::jsonb,
  'token',public.read_combat_content_catalogue_v1()->>'token',
  'candidateSha256','__CANDIDATE_SHA256__','designSha256','__DESIGN_SHA256__',
  'effectiveBaselineSha256','__EFFECTIVE_BASELINE_SHA256__','compatibleSourceSha',nullif('__DEPLOYED_SHA__','')
) as resonance_simple_requirements_readback;
