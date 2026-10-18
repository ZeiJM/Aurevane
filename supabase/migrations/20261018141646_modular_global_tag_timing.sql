-- Add explicit authority metadata without rewriting or activating a historical policy.
-- The reviewed release transaction selects the first global policy together with its new roster.
begin;
alter table app_private.combat_effect_timing_policy_versions
  add column tag_authority text check (tag_authority is null or tag_authority = 'global');

create or replace function public.read_combat_effect_timing_policy_v1()
returns jsonb language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('version',version,'modes',modes)
    || case when tag_authority='global' then jsonb_build_object('tagAuthority','global') else '{}'::jsonb end
  from app_private.combat_effect_timing_policy_versions order by version desc limit 1;
$$;

create or replace function public.publish_combat_effect_timing_policy_v1(p_actor_user_id uuid,p_expected_version integer,p_modes jsonb,p_reason text default null)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare v_version integer; v_tag_authority text;
begin
 perform app_private.assert_game_owner_v1(p_actor_user_id);
 if p_modes is null or jsonb_typeof(p_modes) <> 'object' then
  raise exception 'INVALID_TIMING_POLICY';
 end if;
 if exists(select 1 from jsonb_each_text(p_modes) entry where entry.key not in ('damage', 'healing', 'mp-recovery', 'mp-drain', 'create-terrain', 'ground-area', 'displace', 'push', 'pull', 'poison', 'burn', 'bleed', 'barrier-change', 'return-to-turn-start', 'remove-status', 'copy-statuses', 'copy', 'sensory', 'summon', 'guarded', 'lowered-guard', 'exposed', 'covert', 'revealed', 'wet', 'frozen', 'conductive', 'inspired', 'hexed', 'invisible', 'summoned', 'airborne', 'blindside', 'displaced', 'haste', 'hastened', 'delayed', 'borrowed-hour', 'regeneration', 'slow', 'root', 'reckless', 'fortified', 'challenged', 'marked', 'mark', 'warded', 'suppress') or entry.value is null or entry.value not in ('instant','next-round','delayed','controlled') or (entry.value = 'controlled' and entry.key in ('summon','ground-area','copy','regeneration','hastened','delayed','borrowed-hour','summoned','marked'))) then
  raise exception 'INVALID_TIMING_POLICY';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('combat-effect-timing-policy',0));
 select version,tag_authority into v_version,v_tag_authority from app_private.combat_effect_timing_policy_versions order by version desc limit 1;
 if p_expected_version is null or v_version <> p_expected_version then raise exception 'TIMING_POLICY_VERSION_CONFLICT'; end if;
 insert into app_private.combat_effect_timing_policy_versions(version,modes,published_by,reason,tag_authority) values (v_version+1,p_modes,p_actor_user_id,null,v_tag_authority);
 return jsonb_build_object('version',v_version+1,'modes',p_modes) || case when v_tag_authority='global' then jsonb_build_object('tagAuthority','global') else '{}'::jsonb end;
end;
$$;


create or replace function public.read_combat_content_catalogue_v1()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  with current_records as (
    select version.id, version.content_key, version.content_kind,
      version.content_version, version.definition, version.published_by,
      version.published_at, publication.updated_at as publication_updated_at
    from app_private.combat_content_publications publication
    join app_private.combat_content_versions version
      on version.id = publication.version_id
      and version.content_key = publication.content_key
      and version.content_kind = publication.content_kind
  ), records as (
    select
      coalesce(jsonb_agg(to_jsonb(record) - 'publication_updated_at' order by record.content_key collate "C"), '[]'::jsonb) as publications,
      coalesce(jsonb_agg(to_jsonb(record) order by record.content_key collate "C"), '[]'::jsonb) as token_records
    from current_records record
  ), policy as (
    select public.read_combat_effect_timing_policy_v1() as definition
  )
  select jsonb_build_object(
    'token', md5(jsonb_build_object('policy', policy.definition, 'publications', records.token_records)::text),
    'policy', policy.definition,
    'publications', records.publications
  ) from records cross join policy;
$$;

-- Retain the token-guarded v2 entry point as the only service writer.
revoke all on function public.publish_combat_effect_timing_policy_v1(uuid,integer,jsonb,text)
  from public,anon,authenticated,service_role;
revoke all on function public.read_combat_effect_timing_policy_v1()
  from public,anon,authenticated;
grant execute on function public.read_combat_effect_timing_policy_v1() to service_role;
revoke all on function public.read_combat_content_catalogue_v1()
  from public,anon,authenticated;
grant execute on function public.read_combat_content_catalogue_v1() to service_role;
commit;
