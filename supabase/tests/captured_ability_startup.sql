-- Run on the disposable, fully migrated Supabase stack; all fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select no_plan();
select ok(has_function_privilege('service_role','public.create_battle_session_v2(text,uuid,text,uuid,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb)','execute'), 'service may create captured AI battles');
select ok(has_function_privilege('service_role','public.create_pvp_battle_session_v2(uuid,uuid,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb)','execute'), 'service may create captured PvP battles');
select ok(has_function_privilege('service_role','public.start_world_encounter_v2(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb)','execute'), 'service may create captured world battles');
select ok(not has_function_privilege('anon','public.start_world_encounter_v2(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb)','execute'), 'anonymous world startup denied');
select ok(not has_function_privilege('authenticated','public.start_world_encounter_v2(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb)','execute'), 'browser world startup denied');
select ok(not has_function_privilege('service_role','app_private.append_battle_startup_events_v1(uuid,jsonb,jsonb,jsonb,jsonb,timestamptz)','execute'), 'service cannot bypass creation authority to append startup');
insert into auth.users(id) values('82000000-0000-4000-8000-000000000001'),('82000000-0000-4000-8000-000000000002');
insert into public.player_profiles(user_id) values('82000000-0000-4000-8000-000000000001'),('82000000-0000-4000-8000-000000000002') on conflict do nothing;
-- Use a current enabled primary profile so the real character provisioning triggers run.
insert into public.characters(
  id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,
  portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,
  level,xp,progression_cycle,created_at,cycle_started_at,last_active_at
)
select actor.character_id,actor.user_id,0,1,actor.label,lower(actor.label),'presentation.world-test','pronoun.they',
  'portrait.world-test','appearance.world-test',definition.discipline_id,
  (profile.core_base_attributes->>'might')::integer+1,
  (profile.core_base_attributes->>'finesse')::integer+1,
  (profile.core_base_attributes->>'vitality')::integer+1,
  (profile.core_base_attributes->>'agility')::integer+1,
  (profile.core_base_attributes->>'intellect')::integer+1,
  (profile.core_base_attributes->>'resolve')::integer,
  1,0,1,clock_timestamp(),clock_timestamp(),clock_timestamp()
from (values
  ('82000000-0000-4000-8000-000000000011'::uuid,'82000000-0000-4000-8000-000000000001'::uuid,'Ability Startup Owner'),
  ('82000000-0000-4000-8000-000000000012'::uuid,'82000000-0000-4000-8000-000000000002'::uuid,'Ability Startup Peer')
) actor(character_id,user_id,label)
cross join lateral (
  select distinct on (d.discipline_id) d.discipline_id,d.primary_profile_version
  from app_private.discipline_definitions d where d.enabled_for_primary
  order by d.discipline_id,d.definition_version desc limit 1
) definition
join app_private.discipline_primary_profiles profile on profile.discipline_id=definition.discipline_id and profile.profile_version=definition.primary_profile_version;

insert into app_private.character_world_state(character_id,state)
select id,jsonb_build_object('version',1,'position',jsonb_build_object('sectorId','verdant-expanse','x',case when id='82000000-0000-4000-8000-000000000011' then 5 else 6 end,'y',4),'safe',false,'route',jsonb_build_array(jsonb_build_object('position',jsonb_build_object('sectorId','verdant-expanse','x',7,'y',4),'durationMs',1100)),'nextStepAt',floor(extract(epoch from clock_timestamp())*1000)+60000,'discoveries','{}'::jsonb,'completedObjectives','[]'::jsonb)
from public.characters where id in ('82000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000012');
create temporary table startup_input as select
'{"tactical":{"battle":{"battleId":"world:captured-startup-test","rulesVersion":1,"contentVersion":1,"lifecycle":"active","rng":{"algorithm":"xorshift32-v1","seed":7,"state":7,"draws":0},"currentTurn":{"combatantId":"character:82000000-0000-4000-8000-000000000011"},"combatants":[{"id":"character:82000000-0000-4000-8000-000000000011","teamId":"team:0","hp":10,"mp":10},{"id":"character:82000000-0000-4000-8000-000000000012","teamId":"team:1","hp":10,"mp":10}]}}}'::jsonb start,
'[{"event":"mp_spent","combatantId":"character:82000000-0000-4000-8000-000000000011","amount":1}]'::jsonb events,
'{"schemaVersion":1,"commandVisibility":{"kind":"public"},"eventVisibilityOverrides":[]}'::jsonb journal,
(select jsonb_object_agg(character_id::text,build_version) from app_private.character_active_builds where character_id in ('82000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000012')) builds;
-- Build the same committed authority snapshot used by live preparation. Keep both
-- startup identity/privacy controls below and let the genuine admission guard run.
update startup_input set start = start || jsonb_build_object('buildAuthority',jsonb_build_object('combatants',(
  select jsonb_agg(public.get_character_committed_build_snapshot_v2(c.user_id,c.id) ||
    jsonb_build_object('combatantId','character:'||c.id::text,'characterId',c.id::text) order by c.id)
  from public.characters c where c.id in ('82000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000012')
)));
alter table startup_input add column final jsonb;
update startup_input set final=jsonb_set(jsonb_set(start,'{tactical,battle,combatants,0,mp}','9'::jsonb),'{capturedAbilitySources}','[]'::jsonb);

select throws_ok($$select public.start_world_encounter_v2('82000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000012',1,1,jsonb_set(final,'{tactical,battle,battleId}','"foreign"'::jsonb),builds,start,events,journal) from startup_input$$,'22023','BATTLE_STARTUP_INVALID','identity failure rolls the complete admission back');
select throws_ok($$select public.start_world_encounter_v2('82000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000012',1,1,final,builds,start,events,jsonb_set(journal,'{commandVisibility}','{"kind":"team-only","teamId":"team:foreign"}'::jsonb)) from startup_input$$,'22023','BATTLE_STARTUP_INVALID','invalid privacy rolls the complete admission back');
select is((select count(*)::integer from app_private.pvp_lobbies where owner_user_id='82000000-0000-4000-8000-000000000001'),0,'failed startup leaves no lobby');
select is((select count(*)::integer from app_private.battle_sessions where owner_user_id='82000000-0000-4000-8000-000000000001'),0,'failed startup leaves no battle');
select ok((select bool_and(state->>'version'='1' and jsonb_array_length(state->'route')=1) from app_private.character_world_state where character_id in ('82000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000012')),'failed startup restores both routes and versions');

-- Admission validates the prepared start snapshot before settling startup effects.
-- A stale preparation must carry the same stale authority into both snapshots.
select throws_ok($$select public.start_world_encounter_v2('82000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000012',1,1,jsonb_set(final,'{buildAuthority,combatants,0,sourceHash}','"stale"'),builds,jsonb_set(start,'{buildAuthority,combatants,0,sourceHash}','"stale"'),events,journal) from startup_input$$,'40001','PLAYER_PREPARATION_STALE','stale committed source still rejects the whole admission');
select is((select count(*)::integer from app_private.battle_sessions where owner_user_id='82000000-0000-4000-8000-000000000001'),0,'stale preparation leaves no battle');
select is((select count(*)::integer from app_private.pvp_lobbies where owner_user_id='82000000-0000-4000-8000-000000000001'),0,'stale preparation leaves no lobby');
select ok((select bool_and(state->>'version'='1' and jsonb_array_length(state->'route')=1) from app_private.character_world_state where character_id in ('82000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000012')),'stale preparation restores both routes and versions');

create temporary table startup_result as select
(public.start_world_encounter_v2('82000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000012',1,1,final,builds,start,events,journal)->>'battleSessionId')::uuid id from startup_input;
select ok((select s.current_version=1 and s.current_snapshot=i.final from app_private.battle_sessions s join startup_result r on r.id=s.id cross join startup_input i),'session owns the settled immutable capture at version one');
select ok((select s.snapshot=i.final from app_private.battle_snapshots s join startup_result r on r.id=s.battle_session_id cross join startup_input i where s.battle_version=1),'version-one snapshot agrees with session');
select is((select count(*)::integer from app_private.battle_participants p join startup_result r on r.id=p.battle_session_id),2,'both actual participants are persisted');
select is((select count(*)::integer from app_private.world_encounters w join startup_result r on r.id=w.battle_session_id),1,'world encounter receipt is persisted');
select ok((select e.battle_version=1 and e.event_index=0 and e.event=i.events->0 from app_private.battle_events e join startup_result r on r.id=e.battle_session_id cross join startup_input i),'real startup event is persisted at version one');
select ok((select j.battle_version=1 and j.journal->>'actorCombatantId'='character:82000000-0000-4000-8000-000000000011' and j.journal->>'actorTeamId'='team:0' and j.journal->>'eventCount'='1' from app_private.battle_privacy_journal j join startup_result r on r.id=j.battle_session_id),'private startup provenance is stamped from the start snapshot');
select ok((select bool_and(jsonb_array_length(state->'route')=0 and state->>'version'='2') from app_private.character_world_state where character_id in ('82000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000012')),'successful admission interrupts both routes once');
select throws_ok($$select public.start_world_encounter_v2('82000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000012',1,1,final,builds,start,events,journal) from startup_input$$,'40001','WORLD_STALE_VERSION','repeated world intent cannot create a second battle or pay twice');
select is((select count(*)::integer from app_private.battle_events e join startup_result r on r.id=e.battle_session_id),1,'rejected retry leaves startup receipts single');
select * from finish();
rollback;
