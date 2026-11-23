begin;

-- Extend the existing committed authority. The private Players sourceHash formula
-- remains unchanged; numeric buildVersion, exact Core pins and selected grants are
-- verified under the same admission transaction rather than folded into a new hash.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.get_character_committed_build_snapshot_v2(uuid,uuid)'::regprocedure);
 old:=$before$'schemaVersion', build.schema_version,$before$;
 if strpos(d,old)=0 then raise exception 'SELECTED_CAPTURE_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,old||$after$ 'skillEligibilityPolicyVersion',1,'catalogueToken',public.read_combat_content_catalogue_v1()->>'token',$after$);
 old:=$before$'eligibilityDisciplineId',equipped.eligibility_discipline_id$before$;
 if strpos(d,old)=0 then raise exception 'SELECTED_CAPTURE_GRANT_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,old||$after$,'earnedEligibility',exists(select 1 from app_private.character_discipline_skill_grants g where g.character_id=equipped.character_id and g.skill_id=equipped.skill_id and g.eligibility_discipline_id=equipped.eligibility_discipline_id and g.earned_at is not null)$after$);
 execute d;
end; $migration$;

create or replace function app_private.guard_player_battle_admission_v1() returns trigger
language plpgsql security definer set search_path=pg_catalog,app_private,public as $$
declare v_source text; v_version bigint; v_capture jsonb; v_snapshot jsonb; v_expected jsonb; v_actual_skills jsonb; v_expected_skills jsonb;
begin
 if new.character_id is null then return new; end if;
 if not pg_try_advisory_xact_lock(hashtextextended(new.user_id::text,1)) then raise exception using errcode='40001',message='PLAYER_ADMISSION_RETRY'; end if;
 perform app_private.lock_current_discipline_selection_v1();
 perform 1 from public.characters where id=new.character_id and user_id=new.user_id for update nowait;
 if not found then raise exception using errcode='42501',message='PLAYER_NOT_FOUND'; end if;
 select build_version into v_version from app_private.character_active_builds where character_id=new.character_id for update nowait;
 if exists(select 1 from app_private.character_deletion_requests where character_id=new.character_id)
 or exists(select 1 from app_private.account_deletion_requests where user_id=new.user_id) then raise exception using errcode='42501',message='PLAYER_DELETION_PENDING'; end if;
 -- The grant upgrade producer can run independently of build mutation. Hold the
 -- selected rows through insert, without waiting after account/character locks.
 perform 1 from app_private.character_discipline_skill_grants g join app_private.character_build_discipline_skills e
 on e.character_id=g.character_id and e.skill_id=g.skill_id and e.eligibility_discipline_id=g.eligibility_discipline_id
 where g.character_id=new.character_id for share of g nowait;
 select current_snapshot into v_snapshot from app_private.battle_sessions where id=new.battle_session_id;
 select unit into v_capture from jsonb_array_elements(v_snapshot #> '{buildAuthority,combatants}') unit where unit->>'combatantId'=new.combatant_id and unit->>'characterId'=new.character_id::text;
 v_source:=app_private.player_source_hash_v1(new.character_id);
 v_expected:=public.get_character_committed_build_snapshot_v2(new.user_id,new.character_id);
 if v_capture is null or jsonb_typeof(v_capture->'sourceHash') is distinct from 'string' or v_capture->>'sourceHash' is distinct from v_source
 or jsonb_typeof(v_capture->'buildVersion') is distinct from 'number' or (v_capture->>'buildVersion') !~ '^[1-9][0-9]*$'
 or (v_capture->>'buildVersion')::numeric is distinct from v_version::numeric
 or v_capture->'skillEligibilityPolicyVersion' is distinct from '1'::jsonb
 or v_capture->'primary' is distinct from v_expected->'primary'
 or v_capture->'secondary' is distinct from v_expected->'secondary'
 or v_capture->'catalogueToken' is distinct from v_expected->'catalogueToken'
 or jsonb_typeof(v_capture->'disciplineSkills') is distinct from 'array'
 then raise exception using errcode='40001',message='PLAYER_PREPARATION_STALE'; end if;
 -- Current Skill bodies may advance from their durable learned version. The
 -- catalogue token protects that resolution; intrinsic and eligibility facts do not change.
 select coalesce(jsonb_agg(s-'contentVersion' order by (s->>'slotIndex')::integer),'[]'::jsonb) into v_actual_skills from jsonb_array_elements(v_capture->'disciplineSkills') s;
 select coalesce(jsonb_agg(s-'contentVersion' order by (s->>'slotIndex')::integer),'[]'::jsonb) into v_expected_skills from jsonb_array_elements(v_expected->'disciplineSkills') s;
 if v_actual_skills is distinct from v_expected_skills then raise exception using errcode='40001',message='PLAYER_PREPARATION_STALE'; end if;
 return new;
exception when lock_not_available then raise exception using errcode='40001',message='PLAYER_ADMISSION_RETRY';
end; $$;

-- Historical omitted-policy encounters retain their original native-catalogue
-- interpretation and exact receipts/XP. New trials consume only immutable selected
-- earned facts; EXISTS avoids multiplying uses when grants overlap.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.claim_discipline_trial_v1(uuid,uuid)'::regprocedure);
 old:=$before$ select array_agg(distinct catalog.skill_id),count(*)::integer into v_demonstrated,v_uses
 from app_private.battle_events history join app_private.phase4_skill_catalog catalog on catalog.skill_id=history.event->>'actionId' and catalog.discipline_id=v_primary
 where history.battle_session_id=p_battle_session_id and history.event->>'event'='combat_action_used' and history.event->>'actorId'=v_participant.combatant_id;$before$;
 if strpos(d,old)=0 then raise exception 'SELECTED_TRIAL_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,$after$ if exists(select 1 from jsonb_array_elements(v_initial #> '{buildAuthority,combatants}') c where c->>'combatantId'=v_participant.combatant_id and c ? 'skillEligibilityPolicyVersion') then
   if not exists(select 1 from jsonb_array_elements(v_initial #> '{buildAuthority,combatants}') c where c->>'combatantId'=v_participant.combatant_id and c->'skillEligibilityPolicyVersion'='1'::jsonb) then raise exception using errcode='22023',message='TRIAL_COMMITTED_BUILD_REQUIRED'; end if;
   select array_agg(distinct history.event->>'actionId'),count(*)::integer into v_demonstrated,v_uses
   from app_private.battle_events history where history.battle_session_id=p_battle_session_id and history.event->>'event'='combat_action_used' and history.event->>'actorId'=v_participant.combatant_id
   and exists(select 1 from jsonb_array_elements(v_initial #> '{buildAuthority,combatants}') c cross join lateral jsonb_array_elements(c->'disciplineSkills') s
    where c->>'combatantId'=v_participant.combatant_id and s->>'skillId'=history.event->>'actionId' and s->>'eligibilityDisciplineId'=v_primary and s->'earnedEligibility'='true'::jsonb);
 else
$after$||old||E'\n end if;');
 execute d;
end; $migration$;
revoke all on function app_private.guard_player_battle_admission_v1() from public,anon,authenticated,service_role;

-- Exact Core data accompanies the existing active and current catalogue projections.
create or replace function public.get_character_active_build_v4(p_user_id uuid,p_character_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(active)||jsonb_build_object('support_action_id',build.support_action_id,'core_base_attributes',p.core_base_attributes,'focus_attributes',p.focus_attributes,'off_focus_cap',p.off_focus_cap)
 from public.get_character_active_build_v2(p_user_id,p_character_id) active
 join app_private.character_active_builds build on build.character_id=active.character_id
 join app_private.discipline_primary_profiles p on p.discipline_id=build.primary_discipline_id and p.profile_version=build.primary_profile_version
 where build.user_id=p_user_id;
$$;
create function public.get_character_discipline_catalog_v3(p_user_id uuid,p_character_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('core_base_attributes',p.core_base_attributes,'focus_attributes',p.focus_attributes,'off_focus_cap',p.off_focus_cap) order by c.name,c.discipline_id),'[]'::jsonb)
 from public.get_character_discipline_catalog_v2(p_user_id,p_character_id) c
 join app_private.discipline_primary_profiles p on p.discipline_id=c.discipline_id and p.profile_version=c.profile_version;
$$;
revoke all on function public.get_character_discipline_catalog_v3(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_character_discipline_catalog_v3(uuid,uuid) to service_role;

do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.change_character_disciplines_v2(uuid,uuid,bigint,boolean,text,boolean,text,uuid,text)'::regprocedure);
 old:='if v_build.primary_discipline_id = v_primary_definition.discipline_id then';
 if strpos(d,old)=0 then raise exception 'CORE_REFRESH_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,'if v_build.primary_discipline_id = v_primary_definition.discipline_id and v_build.primary_definition_version=v_primary_definition.definition_version and v_build.primary_profile_version=v_primary_definition.primary_profile_version then');
 d:=replace(d,'if v_build.primary_attunement_locked_until is not null','if v_build.primary_discipline_id is distinct from p_primary_discipline_id and v_build.primary_attunement_locked_until is not null');
 d:=replace(d,'when p_change_primary then v_now','when p_change_primary and v_build.primary_discipline_id is distinct from p_primary_discipline_id then v_now');
 execute d;
 d:=pg_get_functiondef('public.activate_character_build_loadout_v1(uuid,uuid,smallint,bigint,uuid,text)'::regprocedure);
 old:='from public.change_character_disciplines_v2(';
 if strpos(d,old)=0 then raise exception 'NAMED_CORE_V3_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,'from public.change_character_disciplines_v3(');
 old:='v_build.primary_discipline_id is distinct from v_loadout.primary_discipline_id;';
 if strpos(d,old)=0 then raise exception 'NAMED_CORE_REFRESH_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,'v_build.primary_discipline_id is distinct from v_loadout.primary_discipline_id or exists(select 1 from app_private.current_discipline_definitions_v1() d where d.discipline_id=v_loadout.primary_discipline_id and (d.definition_version<>v_build.primary_definition_version or d.primary_profile_version<>v_build.primary_profile_version));');
 execute d;
end; $migration$;

-- Creation accepts the five personal choices, never caller-computed static totals.
-- Its receipt precedes current-pointer validation, preserving successful replay
-- across later publication. New writes pin the displayed Core under shared lock.
do $migration$
declare d text; old text; attr text;
begin
 d:=pg_get_functiondef('public.create_character_v3(uuid,smallint,uuid,text,integer,text,text,text,text,text,text,text,integer,integer,integer,integer,integer,integer)'::regprocedure);
 d:=replace(d,'public.create_character_v3(', 'public.create_character_v4(');
 d:=replace(d,'character.create.v3','character.create.v4');
 d:=replace(d,'p_resolve integer)','p_resolve integer, p_expected_profile_version integer)');
 d:=replace(d,'v_constraint_name text;', 'v_constraint_name text; v_core jsonb; v_profile_version integer;');
 old:='if least(p_might, p_finesse, p_vitality, p_agility, p_intellect, p_resolve) < 1 then';
 if strpos(d,old)=0 then raise exception 'PERSONAL_CREATION_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,'if p_might is null or p_finesse is null or p_vitality is null or p_agility is null or p_intellect is null or p_resolve is null or least(p_might,p_finesse,p_vitality,p_agility,p_intellect,p_resolve)<0 or p_might+p_finesse+p_vitality+p_agility+p_intellect+p_resolve<>5 then');
 old:='  insert into public.characters (';
 if strpos(d,old)=0 then raise exception 'PERSONAL_CREATION_INSERT_CONFLICT'; end if;
 d:=replace(d,old,$core$
  perform app_private.lock_current_discipline_selection_v1();
  select p.core_base_attributes,p.profile_version into v_core,v_profile_version
  from app_private.current_discipline_definitions_v1() definition join app_private.discipline_primary_profiles p on p.discipline_id=definition.discipline_id and p.profile_version=definition.primary_profile_version
  where definition.discipline_id=p_foundation_discipline_id and definition.enabled_for_primary;
  if not found then raise exception using errcode='22023',message='FOUNDATION_PRIMARY_DISCIPLINE_UNAVAILABLE'; end if;
  if p_expected_profile_version is not null and p_expected_profile_version is distinct from v_profile_version then raise exception using errcode='40001',message='CHARACTER_CORE_STALE'; end if;
$core$||old);
 foreach attr in array array['might','finesse','vitality','agility','intellect','resolve'] loop
  d:=replace(d,'p_'||attr, 'p_bonus_'||attr);
 end loop;
 old:='p_foundation_discipline_id, p_bonus_might, p_bonus_finesse, p_bonus_vitality, p_bonus_agility, p_bonus_intellect, p_bonus_resolve,';
 if strpos(d,old)=0 then raise exception 'PERSONAL_CREATION_TOTALS_CONFLICT'; end if;
 d:=replace(d,old,$totals$p_foundation_discipline_id,
 (v_core->>'might')::integer+p_bonus_might,(v_core->>'finesse')::integer+p_bonus_finesse,
 (v_core->>'vitality')::integer+p_bonus_vitality,(v_core->>'agility')::integer+p_bonus_agility,
 (v_core->>'intellect')::integer+p_bonus_intellect,(v_core->>'resolve')::integer+p_bonus_resolve,$totals$);
 execute d;
end; $migration$;
revoke all on function public.create_character_v4(uuid,smallint,uuid,text,integer,text,text,text,text,text,text,text,integer,integer,integer,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.create_character_v4(uuid,smallint,uuid,text,integer,text,text,text,text,text,text,text,integer,integer,integer,integer,integer,integer,integer) to service_role;

create function public.get_primary_discipline_catalog_v2()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('core_base_attributes',p.core_base_attributes,'focus_attributes',p.focus_attributes,'off_focus_cap',p.off_focus_cap) order by c.name,c.discipline_id),'[]'::jsonb)
 from public.get_primary_discipline_catalog_v1() c
 join app_private.discipline_primary_profiles p on p.discipline_id=c.discipline_id and p.profile_version=c.profile_version;
$$;
revoke all on function public.get_primary_discipline_catalog_v2() from public,anon,authenticated;
grant execute on function public.get_primary_discipline_catalog_v2() to service_role;

-- Native Discipline first-edit metadata uses the same selected Core, actual
-- progression prerequisites, stage map and E/R selectors as the live producers.
insert into app_private.combat_content_records(content_key,content_kind,lifecycle,version_floor,builtin_version,builtin_name)
select d.discipline_id,'discipline','active',greatest(d.definition_version,d.primary_profile_version),d.definition_version,d.name
from app_private.current_discipline_definitions_v1() d
where not exists(select 1 from app_private.combat_content_publications p where p.content_key=d.discipline_id)
on conflict(content_key) do nothing;
create function public.get_builtin_discipline_definition_v1(p_discipline_id text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schemaVersion',1,'id',d.discipline_id,'contentVersion',d.definition_version,'name',d.name,'description',d.summary,'sortOrder',0,'enabled',true,'media','{}'::jsonb,
 'core',p.core_base_attributes,'focus',p.focus_attributes,'enabledForPrimary',d.enabled_for_primary,'enabledForSecondary',d.enabled_for_secondary,
 'linkedSkills',(select coalesce(jsonb_agg(skill_id order by skill_id),'[]') from app_private.current_discipline_skill_catalog_v1(d.discipline_id)),
 'skillStages',(select coalesce(jsonb_agg(jsonb_build_object('skillId',skill_id,'minimumStage',minimum_stage) order by skill_id),'[]') from app_private.current_discipline_skill_catalog_v1(d.discipline_id)),
 'unlock',case when jsonb_array_length(r.rules)=0 then '{"kind":"always"}'::jsonb else jsonb_build_object('kind','all','rules',r.rules) end,
 'essenceId',app_private.current_essence_selection_key_v1(d.discipline_id,null),
 'resonanceSelections',(select coalesce(jsonb_agg(jsonb_build_object('withDisciplineId',other.discipline_id,'resonanceId',app_private.current_resonance_selection_key_v1(d.discipline_id,other.discipline_id)) order by other.discipline_id),'[]') from app_private.current_discipline_definitions_v1() other where other.discipline_id<>d.discipline_id and app_private.current_resonance_selection_key_v1(d.discipline_id,other.discipline_id) is not null))
 from app_private.current_discipline_definitions_v1() d join app_private.discipline_primary_profiles p on p.discipline_id=d.discipline_id and p.profile_version=d.primary_profile_version
 cross join lateral (select coalesce(jsonb_agg(rule order by rule::text),'[]'::jsonb) rules from (
 select jsonb_build_object('kind','mastery','disciplineId',required_discipline_id,'minimumStage',minimum_stage) rule from app_private.discipline_mastery_prerequisites where discipline_id=d.discipline_id
 union all select jsonb_build_object('kind','rekindling','minimumCount',minimum_rekindling_count) from app_private.discipline_rekindling_prerequisites where discipline_id=d.discipline_id) all_rules) r
 where d.discipline_id=p_discipline_id and not exists(select 1 from app_private.combat_content_publications c where c.content_key=d.discipline_id);
$$;
revoke all on function public.get_builtin_discipline_definition_v1(text) from public,anon,authenticated;
grant execute on function public.get_builtin_discipline_definition_v1(text) to service_role;

-- Add authored public metadata in the same query as current Core. No character
-- grants or support source proof are exposed in this public projection.
create or replace function public.get_primary_discipline_catalog_v2()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('core_base_attributes',p.core_base_attributes,'focus_attributes',p.focus_attributes,'off_focus_cap',p.off_focus_cap,'authored_definition',v.definition,'native_unlock',public.get_builtin_discipline_definition_v1(c.discipline_id)->'unlock') order by c.name,c.discipline_id),'[]'::jsonb)
 from public.get_primary_discipline_catalog_v1() c
 join app_private.discipline_primary_profiles p on p.discipline_id=c.discipline_id and p.profile_version=c.profile_version
 left join app_private.combat_content_publications pub on pub.content_key=c.discipline_id and pub.content_kind='discipline'
 left join app_private.combat_content_versions v on v.id=pub.version_id;
$$;
create function public.get_character_discipline_atlas_progress_v2(p_user_id uuid,p_character_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('earned_skill_count',(select count(*) from app_private.character_discipline_skill_grants g where g.character_id=p_character_id and g.eligibility_discipline_id=c.discipline_id and g.earned_at is not null),'unearned_skill_count',(select count(*) from app_private.character_discipline_skill_grants g where g.character_id=p_character_id and g.eligibility_discipline_id=c.discipline_id and g.earned_at is null)) order by c.discipline_id),'[]'::jsonb)
 from public.get_character_discipline_atlas_progress_v1(p_user_id,p_character_id) c;
$$;
revoke all on function public.get_character_discipline_atlas_progress_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_character_discipline_atlas_progress_v2(uuid,uuid) to service_role;

do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.read_master_player_v1(uuid,uuid,uuid)'::regprocedure);
 old:=$before$'learnedSkills',(select coalesce(jsonb_agg(jsonb_build_object('skillId',skill_id,'contentVersion',skill_content_version,'sourceDisciplineId',source_discipline_id) order by skill_id),'[]'::jsonb) from app_private.character_skill_unlocks where character_id=p_character_id),$before$;
 if strpos(d,old)=0 then raise exception 'PLAYERS_ELIGIBILITY_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,$after$'learnedSkills',(select coalesce(jsonb_agg(jsonb_build_object('skillId',skill_id,'contentVersion',skill_content_version,'sourceDisciplineId',source_discipline_id,'eligibilityDisciplineId',eligibility_discipline_id,'earnedEligibility',earned_at is not null) order by skill_id,eligibility_discipline_id),'[]'::jsonb) from app_private.character_discipline_skill_availability_v1(p_character_id)),$after$);
 execute d;
end; $migration$;

-- Public Atlas also includes currently published Secondary-only/disabled
-- identities. Creation separately filters the explicit Primary enable flag.
create function public.get_current_discipline_catalog_v1()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('discipline_id',d.discipline_id,'definition_version',d.definition_version,'name',d.name,'summary',d.summary,'enabled_for_primary',d.enabled_for_primary,'enabled_for_secondary',d.enabled_for_secondary,'profile_version',p.profile_version,'core_base_attributes',p.core_base_attributes,'focus_attributes',p.focus_attributes,'off_focus_cap',p.off_focus_cap,'authored_definition',v.definition,'native_unlock',public.get_builtin_discipline_definition_v1(d.discipline_id)->'unlock') order by d.name,d.discipline_id),'[]'::jsonb)
 from app_private.current_discipline_definitions_v1() d
 join app_private.discipline_primary_profiles p on p.discipline_id=d.discipline_id and p.profile_version=d.primary_profile_version
 left join app_private.combat_content_publications pub on pub.content_key=d.discipline_id and pub.content_kind='discipline'
 left join app_private.combat_content_versions v on v.id=pub.version_id;
$$;
revoke all on function public.get_current_discipline_catalog_v1() from public,anon,authenticated;
grant execute on function public.get_current_discipline_catalog_v1() to service_role;

commit;
