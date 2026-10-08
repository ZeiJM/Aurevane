-- Extend the existing exclusive timing enum; retain every immutable policy version.
begin;
create or replace function public.publish_combat_effect_timing_policy_v1(p_actor_user_id uuid,p_expected_version integer,p_modes jsonb,p_reason text)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare v_version integer;
begin
 perform app_private.assert_game_owner_v1(p_actor_user_id);
 if p_modes is null or jsonb_typeof(p_modes) <> 'object' or p_reason is null or char_length(btrim(p_reason)) not between 1 and 240 then
  raise exception 'INVALID_TIMING_POLICY';
 end if;
 if exists(select 1 from jsonb_each_text(p_modes) entry where entry.key not in ('damage', 'healing', 'mp-recovery', 'mp-drain', 'create-terrain', 'ground-area', 'displace', 'poison', 'burn', 'bleed', 'barrier-change', 'return-to-turn-start', 'remove-status', 'copy-statuses', 'copy', 'sensory', 'summon', 'guarded', 'lowered-guard', 'exposed', 'covert', 'revealed', 'wet', 'frozen', 'conductive', 'inspired', 'hexed', 'invisible', 'summoned', 'airborne', 'displaced', 'haste', 'hastened', 'delayed', 'borrowed-hour', 'regeneration', 'slow', 'root', 'reckless', 'fortified', 'challenged', 'marked', 'mark', 'warded') or entry.value is null or entry.value not in ('instant','next-round','delayed')) then
  raise exception 'INVALID_TIMING_POLICY';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('combat-effect-timing-policy',0));
 select max(version) into v_version from app_private.combat_effect_timing_policy_versions;
 if p_expected_version is null or v_version <> p_expected_version then raise exception 'TIMING_POLICY_VERSION_CONFLICT'; end if;
 insert into app_private.combat_effect_timing_policy_versions(version,modes,published_by,reason) values (v_version+1,p_modes,p_actor_user_id,btrim(p_reason));
 return jsonb_build_object('version',v_version+1,'modes',p_modes);
end;
$$;

revoke all on function public.publish_combat_effect_timing_policy_v1(uuid,integer,jsonb,text) from public, anon, authenticated;
grant execute on function public.publish_combat_effect_timing_policy_v1(uuid,integer,jsonb,text) to service_role;
-- Preserve hosted overrides and append only the approved Rewind default. No historical row is rewritten.
select pg_advisory_xact_lock(hashtextextended('combat-effect-timing-policy',0));
insert into app_private.combat_effect_timing_policy_versions(version,modes,reason)
select version+1,modes || '{"return-to-turn-start":"delayed"}'::jsonb,
 'Owner-approved October 8 Delayed Rewind; retain all prior timing overrides.'
from app_private.combat_effect_timing_policy_versions order by version desc limit 1;
commit;
