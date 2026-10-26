begin;

-- Immutable version IDs identify their complete retained rows. Keep every record
-- field (including draft/lifecycle revisions) and the complete small policy in CAS.
-- Token-only gameplay reads must never materialize the full definition catalogue.
create function public.read_combat_content_catalogue_token_v1()
returns text language sql stable security definer set search_path='' as $$
 with pointers as (
  select coalesce(jsonb_agg(jsonb_build_array(p.content_key,p.content_kind,p.version_id) order by p.content_key),'[]'::jsonb) value
  from app_private.combat_content_publications p
 ), states as (
  select coalesce(jsonb_agg(to_jsonb(r) order by r.content_key),'[]'::jsonb) value
  from app_private.combat_content_records r
 )
 select md5(jsonb_build_object('publications',pointers.value,'records',states.value,
  'policy',public.read_combat_effect_timing_policy_v1())::text) from pointers cross join states;
$$;
revoke all on function public.read_combat_content_catalogue_token_v1() from public,anon,authenticated;
grant execute on function public.read_combat_content_catalogue_token_v1() to service_role;

create or replace function public.read_combat_content_catalogue_v1()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('token',public.read_combat_content_catalogue_token_v1(),
  'publications',(select coalesce(jsonb_agg(to_jsonb(v) order by v.content_key),'[]'::jsonb)
    from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id),
  'archivedKeys',(select coalesce(jsonb_agg(content_key order by content_key),'[]'::jsonb)
    from app_private.combat_content_records where lifecycle='archived'),
  'policy',public.read_combat_effect_timing_policy_v1());
$$;

-- Replace token-only callers, preserving their existing auth, locks and payloads.
do $migration$
declare signature text; d text; old text;
begin
 foreach signature in array array[
  'app_private.lock_combat_content_catalogue_v1(text)',
  'public.read_current_discipline_selection_v1(text,text)',
  'public.get_character_committed_build_snapshot_v2(uuid,uuid)'
 ] loop
  d:=pg_get_functiondef(signature::regprocedure);
  old:='public.read_combat_content_catalogue_v1()';
  if strpos(d,old)=0 then raise exception 'CATALOGUE_TOKEN_PREDECESSOR_CONFLICT: %',signature; end if;
  d:=regexp_replace(d,'public\.read_combat_content_catalogue_v1\(\)\s*->>\s*''token''','public.read_combat_content_catalogue_token_v1()','g');
  if strpos(d,old)>0 then raise exception 'CATALOGUE_TOKEN_REPLACEMENT_CONFLICT: %',signature; end if;
  execute d;
 end loop;
end; $migration$;

-- Current display copy follows the authored pointer. Mechanical versions, Core,
-- availability and stat offsets remain the exact committed historical authority.
-- Current catalogue availability still controls all new Discipline selections.
create or replace function public.get_character_active_build_v4(p_user_id uuid,p_character_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(active)||jsonb_build_object(
  'primary_media',coalesce((select v.definition->'media' from app_private.combat_content_publications pub join app_private.combat_content_versions v on v.id=pub.version_id where pub.content_key=build.primary_discipline_id and pub.content_kind='discipline'),'{}'::jsonb),
  'secondary_media',coalesce((select v.definition->'media' from app_private.combat_content_publications pub join app_private.combat_content_versions v on v.id=pub.version_id where pub.content_key=build.secondary_discipline_id and pub.content_kind='discipline'),'{}'::jsonb),
  'primary_name',coalesce(current_primary.name,active.primary_name),
  'primary_summary',coalesce(current_primary.summary,active.primary_summary),
  'secondary_name',coalesce(current_secondary.name,active.secondary_name),
  'secondary_summary',coalesce(current_secondary.summary,active.secondary_summary),
  'support_action_id',build.support_action_id,'core_base_attributes',p.core_base_attributes,
  'focus_attributes',p.focus_attributes,'off_focus_cap',p.off_focus_cap)
 from public.get_character_active_build_v2(p_user_id,p_character_id) active
 join app_private.character_active_builds build on build.character_id=active.character_id
 join app_private.discipline_primary_profiles p on p.discipline_id=build.primary_discipline_id and p.profile_version=build.primary_profile_version
 left join app_private.current_discipline_definitions_v1() current_primary on current_primary.discipline_id=build.primary_discipline_id
 left join app_private.current_discipline_definitions_v1() current_secondary on current_secondary.discipline_id=build.secondary_discipline_id
 where build.user_id=p_user_id;
$$;
-- Current selection DTOs carry the same authored image descriptor without an
-- additional browser metadata request or any rewrite of historical captures.
create or replace function public.get_character_discipline_catalog_v3(p_user_id uuid,p_character_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('core_base_attributes',p.core_base_attributes,
  'focus_attributes',p.focus_attributes,'off_focus_cap',p.off_focus_cap,'media',coalesce(v.definition->'media','{}'::jsonb))
  order by c.name,c.discipline_id),'[]'::jsonb)
 from public.get_character_discipline_catalog_v2(p_user_id,p_character_id) c
 join app_private.discipline_primary_profiles p on p.discipline_id=c.discipline_id and p.profile_version=c.profile_version
 left join app_private.combat_content_publications pub on pub.content_key=c.discipline_id and pub.content_kind='discipline'
 left join app_private.combat_content_versions v on v.id=pub.version_id;
$$;
commit;
