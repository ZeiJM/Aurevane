begin;

-- Provenance for encounters whose opponent must not disappear when another battle starts.
create table app_private.world_encounters (
  battle_session_id uuid primary key references app_private.battle_sessions(id) on delete cascade
);
alter table app_private.world_encounters enable row level security;
revoke all on app_private.world_encounters from public,anon,authenticated;

create table app_private.character_world_state (
  character_id uuid primary key references public.characters(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  sector_id text generated always as (state #>> '{position,sectorId}') stored,
  x integer generated always as ((state #>> '{position,x}')::integer) stored,
  y integer generated always as ((state #>> '{position,y}')::integer) stored,
  last_command_id uuid,
  last_command_fingerprint text,
  last_seen_at timestamptz not null default clock_timestamp(),
  check (x between 0 and 12 and y between 0 and 8),
  check ((state->>'version')::bigint > 0),
  check (jsonb_typeof(state->'route') = 'array' and jsonb_array_length(state->'route') <= 256),
  check (jsonb_typeof(state->'discoveries') = 'object')
);
create index character_world_sector_presence_idx on app_private.character_world_state(sector_id,last_seen_at desc);
alter table app_private.character_world_state enable row level security;
revoke all on app_private.character_world_state from public,anon,authenticated;

create function app_private.world_block_reason_v1(p_user_id uuid,p_character_id uuid)
returns text language plpgsql security definer set search_path = pg_catalog,app_private as $$
begin
 if exists(select 1 from app_private.battle_participants p join app_private.battle_sessions b on b.id=p.battle_session_id where p.user_id=p_user_id and p.participant_role='player' and b.lifecycle='active') then return 'WORLD_ACTIVE_BATTLE'; end if;
 if exists(select 1 from app_private.pvp_active_spectating p join app_private.battle_sessions b on b.id=p.battle_session_id where p.user_id=p_user_id and b.lifecycle='active') then return 'WORLD_SPECTATING'; end if;
 if exists(select 1 from app_private.wayfarers_practice_state t where t.character_id=p_character_id and t.planned_window is not null and (t.plan_set_at is null or t.planned_window_seconds is null or t.plan_set_at + make_interval(secs => t.planned_window_seconds) > clock_timestamp())) then return 'WORLD_TRAINING_ACTIVE'; end if;
 return null;
end;
$$;
revoke all on function app_private.world_block_reason_v1(uuid,uuid) from public,anon,authenticated;

create function public.read_world_state_v1(p_user_id uuid,p_character_id uuid,p_initial_state jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog,app_private,public as $$
declare v_state jsonb; v_players jsonb; v_battle uuid; v_block text; v_events jsonb; v_receipt app_private.character_world_state%rowtype;
begin
 if not exists(select 1 from public.characters c where c.id=p_character_id and c.user_id=p_user_id and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id)) then raise exception 'WORLD_NOT_OWNED' using errcode='42501'; end if;
 insert into app_private.character_world_state(character_id,state) values(p_character_id,p_initial_state) on conflict(character_id) do nothing;
 update app_private.character_world_state set last_seen_at=clock_timestamp() where character_id=p_character_id returning state into v_state;
 select b.id into v_battle from app_private.battle_participants p join app_private.battle_sessions b on b.id=p.battle_session_id where p.user_id=p_user_id and p.participant_role='player' and b.lifecycle='active' limit 1;
 v_block:=app_private.world_block_reason_v1(p_user_id,p_character_id);
 select coalesce(jsonb_agg(q.payload),'[]'::jsonb) into v_players from (
   select jsonb_build_object('characterId',c.id,'name',c.name,'level',c.level,'portraitRef',c.portrait_ref,'imageUrl',null,'position',w.state->'position','attackable',app_private.world_block_reason_v1(c.user_id,c.id) is null) as payload
   from app_private.character_world_state w join public.characters c on c.id=w.character_id
   where w.sector_id=v_state #>> '{position,sectorId}' and c.user_id<>p_user_id and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id) and w.last_seen_at>clock_timestamp()-interval '40 seconds'
   order by w.last_seen_at desc,c.id limit 64
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
revoke all on function public.read_world_state_v1(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.read_world_state_v1(uuid,uuid,jsonb) to service_role;

create function public.commit_world_state_v1(p_user_id uuid,p_character_id uuid,p_expected_version bigint,p_command_id uuid,p_kind text,p_next_state jsonb,p_request_fingerprint text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,app_private,public as $$
declare v_world app_private.character_world_state%rowtype; v_block text; v_fingerprint text; v_now bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
 perform 1 from public.characters c where c.id=p_character_id and c.user_id=p_user_id for update;
 if not found or exists(select 1 from app_private.character_deletion_requests d where d.character_id=p_character_id) then raise exception 'WORLD_NOT_OWNED' using errcode='42501'; end if;
 select * into v_world from app_private.character_world_state w where w.character_id=p_character_id for update;
 if not found then raise exception 'WORLD_STATE_UNAVAILABLE'; end if;
 v_fingerprint:=coalesce(p_request_fingerprint,md5(p_expected_version::text||p_kind||p_next_state::text));
 if v_world.last_command_id=p_command_id then
   if v_world.last_command_fingerprint<>v_fingerprint then raise exception 'WORLD_COMMAND_CONFLICT' using errcode='22023'; end if;
   return v_world.state;
 end if;
 if (v_world.state->>'version')::bigint<>p_expected_version then raise exception 'WORLD_STALE_VERSION' using errcode='40001'; end if;
 v_block:=app_private.world_block_reason_v1(p_user_id,p_character_id);
 if v_block is not null and p_kind<>'stop' then raise exception '%',v_block using errcode='22023'; end if;
 if p_kind not in ('walk','autopath','tick','stop','cross') or p_command_id is null then raise exception 'WORLD_INVALID_COMMAND' using errcode='22023'; end if;
 v_now:=floor(extract(epoch from clock_timestamp())*1000);
 if p_next_state->'position' is distinct from v_world.state->'position' and p_kind<>'cross' then
   if p_kind<>'tick' or v_world.state->'route'->0->'position' is distinct from p_next_state->'position' then raise exception 'WORLD_INVALID_STEP' using errcode='22023'; end if;
   if v_world.state->>'nextStepAt' is null or (v_world.state->>'nextStepAt')::bigint>v_now then raise exception 'WORLD_STEP_NOT_DUE' using errcode='22023'; end if;
 end if;
 if p_kind='stop' and (p_next_state->'position' is distinct from v_world.state->'position' or jsonb_array_length(p_next_state->'route')<>0) then raise exception 'WORLD_INVALID_STOP' using errcode='22023'; end if;
 -- Schedule from the commit clock after lock waits, not from the earlier application read.
 if jsonb_array_length(p_next_state->'route')=0 then
   p_next_state:=jsonb_set(p_next_state,'{nextStepAt}','null'::jsonb);
 elsif p_kind in ('walk','autopath') or p_next_state->'position' is distinct from v_world.state->'position' then
   p_next_state:=jsonb_set(p_next_state,'{nextStepAt}',to_jsonb(v_now+greatest(1100,(p_next_state#>>'{route,0,durationMs}')::bigint)));
 end if;
 -- Definition/route validation lives in the authenticated TypeScript authority. The database
 -- independently serializes movement and enforces elapsed time and active-session exclusion.
 p_next_state:=jsonb_set(p_next_state,'{version}',to_jsonb(p_expected_version+1));
 update app_private.character_world_state set state=p_next_state,last_command_id=p_command_id,last_command_fingerprint=v_fingerprint,last_seen_at=clock_timestamp() where character_id=p_character_id;
 return p_next_state;
end;
$$;
revoke all on function public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text) to service_role;

-- Every existing combat entry point interrupts world routes, including Battle Hall fights.
create function app_private.interrupt_world_route_for_battle_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog,app_private as $$
begin
 if new.participant_role='player' and new.user_id is not null then
   perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,1));
   if exists(select 1 from app_private.battle_participants p join app_private.battle_sessions b on b.id=p.battle_session_id where p.user_id=new.user_id and p.battle_session_id<>new.battle_session_id and p.participant_role='player' and b.lifecycle='active') then raise exception 'WORLD_ACTIVE_BATTLE' using errcode='22023'; end if;
   update app_private.character_world_state set state=jsonb_set(jsonb_set(jsonb_set(state,'{route}','[]'::jsonb),'{nextStepAt}','null'::jsonb),'{version}',to_jsonb((state->>'version')::bigint+1)) where character_id=new.character_id;
 end if;
 return new;
end;
$$;
revoke all on function app_private.interrupt_world_route_for_battle_v1() from public,anon,authenticated;
create trigger interrupt_world_route_for_battle_v1 before insert on app_private.battle_participants for each row execute function app_private.interrupt_world_route_for_battle_v1();

create function public.start_world_encounter_v1(p_user_id uuid,p_character_id uuid,p_target_id uuid,p_expected_version bigint,p_target_version bigint,p_snapshot jsonb,p_build_versions jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,app_private,public as $$
declare v_target_user uuid; v_user uuid; v_attacker app_private.character_world_state%rowtype; v_target app_private.character_world_state%rowtype; v_lobby uuid:=gen_random_uuid(); v_result record; v_block text; v_participants jsonb;
begin
 select c.user_id into v_target_user from public.characters c where c.id=p_target_id and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id);
 if v_target_user is null or v_target_user=p_user_id then raise exception 'WORLD_TARGET_UNAVAILABLE' using errcode='22023'; end if;
 -- Consistent account, character and world-row lock order prevents move/attack races.
 for v_user in select u from unnest(array[p_user_id,v_target_user]) u order by u loop perform pg_advisory_xact_lock(hashtextextended(v_user::text,1)); end loop;
 perform 1 from public.characters c where c.id in(p_character_id,p_target_id) order by c.id for update;
 if not exists(select 1 from public.characters c where c.id=p_character_id and c.user_id=p_user_id and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id)) then raise exception 'WORLD_NOT_OWNED' using errcode='42501'; end if;
 if exists(select 1 from app_private.character_deletion_requests d where d.character_id=p_target_id) then raise exception 'WORLD_TARGET_UNAVAILABLE' using errcode='22023'; end if;
 perform 1 from app_private.character_world_state w where w.character_id in(p_character_id,p_target_id) order by w.character_id for update;
 select * into v_attacker from app_private.character_world_state where character_id=p_character_id;
 select * into v_target from app_private.character_world_state where character_id=p_target_id;
 if v_attacker.character_id is null or v_target.character_id is null or (v_attacker.state->>'version')::bigint<>p_expected_version or (v_target.state->>'version')::bigint<>p_target_version then raise exception 'WORLD_STALE_VERSION' using errcode='40001'; end if;
 if v_attacker.sector_id<>v_target.sector_id or abs(v_attacker.x-v_target.x)+abs(v_attacker.y-v_target.y)>1 or coalesce((v_attacker.state->>'safe')::boolean,true) or coalesce((v_target.state->>'safe')::boolean,true) or v_target.last_seen_at<clock_timestamp()-interval '40 seconds' then raise exception 'WORLD_TARGET_UNAVAILABLE' using errcode='22023'; end if;
 v_block:=coalesce(app_private.world_block_reason_v1(p_user_id,p_character_id),app_private.world_block_reason_v1(v_target_user,p_target_id));
 if v_block is not null then raise exception '%',v_block using errcode='22023'; end if;
 perform 1 from app_private.character_active_builds b where b.character_id in(p_character_id,p_target_id) order by b.character_id for update;
 if (select count(*) from app_private.character_active_builds b where b.character_id in(p_character_id,p_target_id))<>2 or exists(select 1 from app_private.character_active_builds b where b.character_id in(p_character_id,p_target_id) and b.build_version is distinct from (p_build_versions->>b.character_id::text)::bigint) then raise exception 'WORLD_STALE_BUILD' using errcode='40001'; end if;
 insert into app_private.pvp_lobbies(id,lobby_key,mode,owner_user_id,team_a_size,team_b_size,team_c_size) values(v_lobby,app_private.pvp_key('AVL'),'1v1',p_user_id,1,1,0);
 insert into app_private.pvp_lobby_members(lobby_id,user_id,character_id,team_index,seat_index,ready) values(v_lobby,p_user_id,p_character_id,0,0,true),(v_lobby,v_target_user,p_target_id,1,0,true);
 v_participants:=jsonb_build_array(jsonb_build_object('combatant_id','character:'||p_character_id::text,'user_id',p_user_id,'character_id',p_character_id,'team_index',0),jsonb_build_object('combatant_id','character:'||p_target_id::text,'user_id',v_target_user,'character_id',p_target_id,'team_index',1));
 select * into v_result from public.create_pvp_battle_session_v1(p_user_id,v_lobby,p_snapshot#>>'{tactical,battle,battleId}',(p_snapshot#>>'{tactical,battle,rulesVersion}')::integer,(p_snapshot#>>'{tactical,battle,contentVersion}')::integer,p_snapshot,v_participants);
 insert into app_private.world_encounters(battle_session_id) values(v_result.battle_session_id);
 return jsonb_build_object('battleSessionId',v_result.battle_session_id);
end;
$$;
revoke all on function public.start_world_encounter_v1(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.start_world_encounter_v1(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb) to service_role;

-- Private pair read is used only after the server has checked that the target is visible.
create function public.read_world_encounter_pair_v1(p_user_id uuid,p_character_id uuid,p_target_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,app_private,public as $$
declare v_self jsonb; v_target jsonb; v_target_user uuid;
begin
 if not exists(select 1 from public.characters c where c.id=p_character_id and c.user_id=p_user_id and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id)) then raise exception 'WORLD_NOT_OWNED' using errcode='42501'; end if;
 select state into v_self from app_private.character_world_state where character_id=p_character_id;
 select w.state,c.user_id into v_target,v_target_user from app_private.character_world_state w join public.characters c on c.id=w.character_id where w.character_id=p_target_id and w.last_seen_at>clock_timestamp()-interval '40 seconds' and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id);
 if v_target is null or v_self#>>'{position,sectorId}' is distinct from v_target#>>'{position,sectorId}' then raise exception 'WORLD_TARGET_UNAVAILABLE' using errcode='22023'; end if;
 return jsonb_build_object('attacker',v_self,'target',v_target,'targetUserId',v_target_user);
end;
$$;
revoke all on function public.read_world_encounter_pair_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_world_encounter_pair_v1(uuid,uuid,uuid) to service_role;
-- This trigger sorts before battle_sessions_single_active_v1. Guard before that legacy
-- trigger can abandon a world opponent's active encounter after a stale application precheck.
create function app_private.guard_world_encounter_replacement_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog,app_private as $$
begin
 if new.lifecycle<>'active' then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.owner_user_id::text,1));
 if exists(select 1 from app_private.battle_participants p
   join app_private.battle_sessions b on b.id=p.battle_session_id
   join app_private.world_encounters w on w.battle_session_id=b.id
   where p.user_id=new.owner_user_id and p.participant_role='player' and b.lifecycle='active' and b.id<>new.id)
 then raise exception 'WORLD_ACTIVE_BATTLE' using errcode='22023'; end if;
 return new;
end;
$$;
revoke all on function app_private.guard_world_encounter_replacement_v1() from public,anon,authenticated;
create trigger atlas_guard_world_encounter_replacement_v1 before insert or update of lifecycle on app_private.battle_sessions for each row execute function app_private.guard_world_encounter_replacement_v1();

-- A spectator insert must serialize with encounter creation even when its earlier read
-- saw no battle. This closes the gap without replacing the established spectator RPC.
create function app_private.guard_world_spectator_entry_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog,app_private as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,1));
 if exists(select 1 from app_private.battle_participants p join app_private.battle_sessions b on b.id=p.battle_session_id where p.user_id=new.user_id and p.participant_role='player' and b.lifecycle='active')
 then raise exception 'PVP_SPECTATE_CONFLICT' using errcode='42501'; end if;
 return new;
end;
$$;
revoke all on function app_private.guard_world_spectator_entry_v1() from public,anon,authenticated;
create trigger guard_world_spectator_entry_v1 before insert or update on app_private.pvp_active_spectating for each row execute function app_private.guard_world_spectator_entry_v1();

-- The existing training setter already locks the character before updating its plan.
-- Recheck at that write boundary, after a competing encounter's character lock releases.
-- Do not acquire the account lock here: that would invert the existing training lock order.
create function app_private.guard_world_training_entry_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog,app_private,public as $$
declare v_user uuid;
begin
 if new.planned_window is null then return new; end if;
 select user_id into v_user from public.characters where id=new.character_id for update;
 if exists(select 1 from app_private.battle_participants p join app_private.battle_sessions b on b.id=p.battle_session_id where p.user_id=v_user and p.participant_role='player' and b.lifecycle='active')
 then raise exception 'WORLD_ACTIVE_BATTLE' using errcode='22023'; end if;
 return new;
end;
$$;
revoke all on function app_private.guard_world_training_entry_v1() from public,anon,authenticated;
create trigger guard_world_training_entry_v1 before insert or update of planned_window on app_private.wayfarers_practice_state for each row execute function app_private.guard_world_training_entry_v1();

commit;
