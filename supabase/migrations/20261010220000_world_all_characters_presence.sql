-- Every character appears in the World at its saved position (the starting town by default),
-- online or not. Only recently seen characters (40s) are attackable, as before.
create or replace function public.read_world_state_v1(p_user_id uuid,p_character_id uuid,p_initial_state jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog,app_private,public as $$
declare v_state jsonb; v_players jsonb; v_battle uuid; v_block text; v_events jsonb; v_receipt app_private.character_world_state%rowtype;
begin
 if not exists(select 1 from public.characters c where c.id=p_character_id and c.user_id=p_user_id and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id)) then raise exception 'WORLD_NOT_OWNED' using errcode='42501'; end if;
 insert into app_private.character_world_state(character_id,state) values(p_character_id,p_initial_state) on conflict(character_id) do nothing;
 update app_private.character_world_state set last_seen_at=clock_timestamp() where character_id=p_character_id returning state into v_state;
 select b.id into v_battle from app_private.battle_participants p join app_private.battle_sessions b on b.id=p.battle_session_id where p.user_id=p_user_id and p.participant_role='player' and b.lifecycle='active' limit 1;
 v_block:=app_private.world_block_reason_v1(p_user_id,p_character_id);
 select coalesce(jsonb_agg(q.payload order by q.online desc,q.lvl desc,q.nm,q.cid),'[]'::jsonb) into v_players from (
   select c.id as cid,c.name as nm,c.level as lvl,
     (w.character_id is not null and w.last_seen_at>clock_timestamp()-interval '40 seconds') as online,
     jsonb_build_object('characterId',c.id,'name',c.name,'level',c.level,'portraitRef',c.portrait_ref,'imageUrl',null,'position',coalesce(w.state->'position',p_initial_state->'position'),'online',(w.character_id is not null and w.last_seen_at>clock_timestamp()-interval '40 seconds'),'attackable',(w.character_id is not null and w.last_seen_at>clock_timestamp()-interval '40 seconds' and app_private.world_block_reason_v1(c.user_id,c.id) is null)) as payload
   from public.characters c left join app_private.character_world_state w on w.character_id=c.id
   where coalesce(w.state #>> '{position,sectorId}',p_initial_state #>> '{position,sectorId}')=v_state #>> '{position,sectorId}' and c.user_id<>p_user_id and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id)
   order by 4 desc,c.level desc,c.name,c.id limit 200
 ) q;
 select coalesce(jsonb_agg(q.payload),'[]'::jsonb) into v_events from (
   select jsonb_build_object('runId',r.id,'title',d.definition->>'title','phaseName',phase->>'name','objectiveId',objective->>'id','navigation',objective->'worldNavigation') payload
   from app_private.event_runs r join app_private.event_definition_versions d on d.id=r.definition_version_id
   cross join lateral jsonb_array_elements(d.definition->'phases') phase
   cross join lateral jsonb_array_elements(phase->'objectives') objective
   where r.run_mode='production' and r.lifecycle_status='live' and phase->>'id'=r.current_phase_id
     and (r.scheduled_end_at is null or r.scheduled_end_at>clock_timestamp())
     and (r.scope_type='global' or (r.scope_type='region' and r.scope_key in(v_state#>>'{position,sectorId}','region.'||(v_state#>>'{position,sectorId}'))))
     and jsonb_typeof(objective->'worldNavigation')='object'
   order by r.id,objective->>'id' limit 48
 ) q;
 select * into v_receipt from app_private.character_world_state where character_id=p_character_id;
 return jsonb_build_object('lastCommandId',v_receipt.last_command_id,'lastCommandFingerprint',v_receipt.last_command_fingerprint,'trainingExpired',exists(select 1 from app_private.wayfarers_practice_state t where t.character_id=p_character_id and t.planned_window is not null and t.plan_set_at + make_interval(secs => t.planned_window_seconds) <= clock_timestamp()) and not exists(select 1 from app_private.training_reports r where r.character_id=p_character_id and r.status='pending'),'eventObjectives',v_events,'state',v_state,'players',v_players,'battleSessionId',v_battle,'blocked',v_block,'serverNow',floor(extract(epoch from clock_timestamp())*1000));
end;
$$;
