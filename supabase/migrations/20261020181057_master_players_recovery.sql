begin;

-- The admission proof is private, stable across presence updates, and reproducible by
-- the server from the exact CharacterRecord used for combat derivation.
create function app_private.player_source_hash_v1(p_character_id uuid)
returns text language sql stable set search_path='' as $$
 select encode(sha256(convert_to(concat_ws(':',c.level,c.xp,c.progression_cycle,c.might,c.finesse,c.vitality,c.agility,c.intellect,c.resolve),'UTF8')),'hex')
 from public.characters c where c.id=p_character_id;
$$;
create table app_private.player_support_revisions (
 character_id uuid primary key references public.characters(id) on delete cascade,
 revision bigint not null check(revision>0)
);
create table app_private.player_support_audit (
 id uuid primary key default gen_random_uuid(),
 actor_user_id uuid references auth.users(id) on delete cascade,
 actor_character_id uuid,
 character_id uuid not null references public.characters(id) on delete cascade,
 action text not null check(action in ('player.edit','battle.no-contest')),
 request_key uuid not null,
 request_hash text not null,
 before_facts jsonb not null,
 after_facts jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(actor_user_id,request_key)
);
-- Retain only one-way battle identity hashes after deletion. No raw capture,
-- character identity or account linkage belongs in the durable anti-reopen marker.
create table app_private.battle_no_contest_markers (
 battle_hash text primary key,
 created_at timestamptz not null default clock_timestamp()
);
create table app_private.battle_no_contests (
 battle_session_id uuid primary key references app_private.battle_sessions(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete cascade,
 actor_character_id uuid,
 participant_ids uuid[] not null,
 original_version bigint not null,
 terminal_version bigint not null,
 request_key uuid not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table app_private.player_support_revisions enable row level security;
alter table app_private.player_support_audit enable row level security;
alter table app_private.battle_no_contest_markers enable row level security;
alter table app_private.battle_no_contests enable row level security;
revoke all on app_private.player_support_revisions,app_private.player_support_audit,app_private.battle_no_contest_markers,app_private.battle_no_contests from public,anon,authenticated,service_role;

create function app_private.prevent_player_support_update_v1() returns trigger
language plpgsql set search_path='' as $$ begin raise exception using errcode='42501',message='SUPPORT_AUDIT_IMMUTABLE'; end; $$;
create trigger player_support_audit_immutable before update on app_private.player_support_audit for each row execute function app_private.prevent_player_support_update_v1();
create trigger battle_no_contests_immutable before update on app_private.battle_no_contests for each row execute function app_private.prevent_player_support_update_v1();
create trigger battle_no_contest_markers_immutable before update or delete on app_private.battle_no_contest_markers for each row execute function app_private.prevent_player_support_update_v1();

-- Enrich the real committed producer in the same SQL statement as its build read.
do $$ declare v_definition text; begin
 select pg_get_functiondef('public.get_character_committed_build_snapshot_v2(uuid,uuid)'::regprocedure) into v_definition;
 if position('''buildVersion'', build.build_version,' in v_definition)=0 then raise exception 'PLAYER_SNAPSHOT_PREDECESSOR_MISMATCH'; end if;
 execute replace(v_definition,'''buildVersion'', build.build_version,','''buildVersion'', build.build_version, ''sourceHash'', app_private.player_source_hash_v1(build.character_id),');
end; $$;

create function app_private.guard_player_battle_admission_v1() returns trigger
language plpgsql security definer set search_path=pg_catalog,app_private,public as $$
declare v_source text; v_version bigint; v_capture jsonb; v_snapshot jsonb;
begin
 if new.character_id is null then return new; end if;
 -- Use the existing account admission lock. NOWAIT on secondary rows prevents
 -- inversion with ordinary build mutation and session-first reward settlement.
 if not pg_try_advisory_xact_lock(hashtextextended(new.user_id::text,1)) then raise exception using errcode='40001',message='PLAYER_ADMISSION_RETRY'; end if;
 perform 1 from public.characters where id=new.character_id and user_id=new.user_id for update nowait;
 if not found then raise exception using errcode='42501',message='PLAYER_NOT_FOUND'; end if;
 select build_version into v_version from app_private.character_active_builds where character_id=new.character_id for update nowait;
 if exists(select 1 from app_private.character_deletion_requests where character_id=new.character_id)
 or exists(select 1 from app_private.account_deletion_requests where user_id=new.user_id) then raise exception using errcode='42501',message='PLAYER_DELETION_PENDING'; end if;
 if not exists(select 1 from app_private.player_support_revisions where character_id=new.character_id) then return new; end if;
 select current_snapshot into v_snapshot from app_private.battle_sessions where id=new.battle_session_id;
 select unit into v_capture from jsonb_array_elements(v_snapshot #> '{buildAuthority,combatants}') unit where unit->>'combatantId'=new.combatant_id and unit->>'characterId'=new.character_id::text;
 v_source:=app_private.player_source_hash_v1(new.character_id);
 if v_capture is null or jsonb_typeof(v_capture->'sourceHash') is distinct from 'string' or v_capture->>'sourceHash' is distinct from v_source
 or jsonb_typeof(v_capture->'buildVersion') is distinct from 'number' or (v_capture->>'buildVersion') !~ '^[1-9][0-9]*$'
 or (v_capture->>'buildVersion')::numeric is distinct from v_version::numeric then
   raise exception using errcode='40001',message='PLAYER_PREPARATION_STALE';
 end if;
 return new;
end; $$;
create trigger guard_player_battle_admission before insert on app_private.battle_participants for each row execute function app_private.guard_player_battle_admission_v1();

create function app_private.guard_no_contest_head_v1() returns trigger
language plpgsql security definer set search_path=pg_catalog,app_private as $$
begin
 if exists(select 1 from app_private.battle_no_contest_markers where battle_hash=encode(sha256(convert_to(new.battle_id,'UTF8')),'hex')) then
   if tg_op='INSERT' or old.lifecycle='abandoned' or new.lifecycle<>'abandoned'
     or new.current_snapshot->>'administrativeOutcome' is distinct from 'NoContest' then
     raise exception using errcode='40001',message='BATTLE_NO_CONTEST';
   end if;
 end if;
 return new;
end; $$;
create trigger aaa_guard_no_contest_head before insert or update on app_private.battle_sessions for each row execute function app_private.guard_no_contest_head_v1();

create function app_private.player_support_facts_v1(p_character_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('level',c.level,'xp',c.xp,'cycle',c.progression_cycle,
 'attributes',jsonb_build_object('might',c.might,'finesse',c.finesse,'vitality',c.vitality,'agility',c.agility,'intellect',c.intellect,'resolve',c.resolve),
 'build',public.get_character_committed_build_snapshot_v2(c.user_id,c.id)-'sourceHash',
 'personal',to_jsonb(p)-'user_id'-'character_id'-'updated_at')
 from public.characters c left join app_private.character_attribute_personal_allocations p on p.character_id=c.id where c.id=p_character_id;
$$;
create function app_private.player_support_fingerprint_v1(p_character_id uuid) returns text
language sql stable set search_path='' as $$
 select encode(sha256(convert_to(app_private.player_support_facts_v1(p_character_id)::text,'UTF8')),'hex');
$$;
create function public.search_master_players_v1(p_actor_user_id uuid,p_query text,p_actor_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform app_private.assert_game_owner_v1(p_actor_user_id);
 if p_query is null or length(trim(p_query)) not between 2 and 48 then raise exception using errcode='22023',message='PLAYER_SEARCH_INVALID'; end if;
 return coalesce((select jsonb_agg(row) from (select c.id as "characterId",c.name,c.level,c.slot_index as "slotIndex",
 case when u.email_confirmed_at is not null then u.email end as "verifiedEmail",
 exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id) as "deletionPending"
 from public.characters c join auth.users u on u.id=c.user_id
 where position(lower(trim(p_query)) in lower(c.name))>0 order by lower(c.name),c.id limit 20) row),'[]'::jsonb);
end; $$;
create function public.read_master_player_v1(p_actor_user_id uuid,p_character_id uuid,p_actor_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_character public.characters%rowtype; v_battle jsonb;
begin
 perform app_private.assert_game_owner_v1(p_actor_user_id);
 select * into v_character from public.characters where id=p_character_id;
 if not found then raise exception using errcode='22023',message='PLAYER_NOT_FOUND'; end if;
 select jsonb_build_object('battleSessionId',b.id,'version',b.current_version,'lifecycle',b.lifecycle,
 'participants',(select jsonb_agg(jsonb_build_object('characterId',p.character_id,'name',c.name) order by p.character_id) from app_private.battle_participants p join public.characters c on c.id=p.character_id where p.battle_session_id=b.id),
 'snapshot',b.current_snapshot,
 'recentActions',(select coalesce(jsonb_agg(e.event order by e.battle_version,e.event_index),'[]'::jsonb) from (select event,battle_version,event_index from app_private.battle_events where battle_session_id=b.id order by battle_version desc,event_index desc limit 20) e))
 into v_battle from app_private.battle_sessions b join app_private.battle_participants selected on selected.battle_session_id=b.id
 where selected.character_id=p_character_id and b.lifecycle in ('pending','active') order by b.updated_at desc limit 1;
 return jsonb_build_object('characterId',v_character.id,'name',v_character.name,'portraitRef',v_character.portrait_ref,
 'verifiedEmail',(select case when email_confirmed_at is not null then email end from auth.users where id=v_character.user_id),
 'facts',app_private.player_support_facts_v1(p_character_id),'fingerprint',app_private.player_support_fingerprint_v1(p_character_id),
 'deletionPending',exists(select 1 from app_private.character_deletion_requests where character_id=p_character_id) or exists(select 1 from app_private.account_deletion_requests where user_id=v_character.user_id),
 'world',(select state from app_private.character_world_state where character_id=p_character_id),
 'training',(select jsonb_build_object('plannedWindow',planned_window,'plannedAt',plan_set_at,'lastActiveAt',last_active_at) from app_private.wayfarers_practice_state where character_id=p_character_id),
 'disciplines',(select coalesce(jsonb_agg(jsonb_build_object('id',discipline_id,'name',name,'primary',enabled_for_primary,'secondary',enabled_for_secondary and mastered_at is not null)),'[]'::jsonb) from public.get_character_discipline_catalog_v2(v_character.user_id,p_character_id)),
 'learnedSkills',(select coalesce(jsonb_agg(jsonb_build_object('skillId',skill_id,'contentVersion',skill_content_version,'sourceDisciplineId',source_discipline_id) order by skill_id),'[]'::jsonb) from app_private.character_skill_unlocks where character_id=p_character_id),
 'savedLoadouts',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'slotIndex',slot_index,'primary',primary_discipline_id,'secondary',secondary_discipline_id) order by slot_index),'[]'::jsonb) from app_private.character_saved_build_loadouts where character_id=p_character_id),
 'battle',v_battle);
end; $$;

create function public.edit_master_player_v1(p_actor_user_id uuid,p_character_id uuid,p_expected_fingerprint text,p_request_key uuid,p_command jsonb,p_confirmed boolean,p_actor_character_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,app_private as $$
declare v_character public.characters%rowtype; v_build app_private.character_active_builds%rowtype;
 v_before jsonb; v_after jsonb; v_hash text; v_old app_private.player_support_audit%rowtype;
 v_profile app_private.discipline_primary_profiles%rowtype; v_level integer; v_xp bigint; v_curve record; v_attributes jsonb; v_kind text;
begin
 perform app_private.assert_game_owner_v1(p_actor_user_id);
 if p_confirmed is distinct from true or p_request_key is null or jsonb_typeof(p_command) is distinct from 'object' then raise exception using errcode='22023',message='PLAYER_CONFIRMATION_REQUIRED'; end if;
 v_kind:=p_command->>'kind';
 if v_kind is null or v_kind not in ('source','disciplines','skills','support')
 or exists(select 1 from jsonb_object_keys(p_command) k where k<>all(case v_kind when 'source' then array['kind','xp','attributes'] when 'disciplines' then array['kind','primary','secondary'] when 'skills' then array['kind','skills'] else array['kind','supportActionId'] end)) then raise exception using errcode='22023',message='PLAYER_EDIT_FIELDS_INVALID'; end if;
 select * into v_character from public.characters where id=p_character_id;
 if not found then raise exception using errcode='22023',message='PLAYER_NOT_FOUND'; end if;
 if not pg_try_advisory_xact_lock(hashtextextended(v_character.user_id::text,1)) then raise exception using errcode='40001',message='PLAYER_EDIT_RETRY'; end if;
 select * into v_character from public.characters where id=p_character_id for update nowait;
 select * into v_build from app_private.character_active_builds where character_id=p_character_id for update nowait;
 if not found then raise exception using errcode='22023',message='PLAYER_BUILD_UNAVAILABLE'; end if;
 perform 1 from app_private.character_attribute_personal_allocations where character_id=p_character_id for update nowait;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('target',p_character_id,'expected',p_expected_fingerprint,'command',p_command)::text,'UTF8')),'hex');
 select * into v_old from app_private.player_support_audit where actor_user_id=p_actor_user_id and request_key=p_request_key;
 if found then
   if v_old.request_hash<>v_hash or v_old.character_id<>p_character_id then raise exception using errcode='22023',message='PLAYER_IDEMPOTENCY_CONFLICT'; end if;
   return jsonb_build_object('replayed',true,'facts',v_old.after_facts);
 end if;
 if exists(select 1 from app_private.character_deletion_requests where character_id=p_character_id) or exists(select 1 from app_private.account_deletion_requests where user_id=v_character.user_id) then raise exception using errcode='22023',message='PLAYER_DELETION_PENDING'; end if;
 if exists(select 1 from app_private.battle_participants p join app_private.battle_sessions b on b.id=p.battle_session_id where p.character_id=p_character_id and b.lifecycle in ('pending','active')) then raise exception using errcode='22023',message='PLAYER_BATTLE_ACTIVE'; end if;
 if p_expected_fingerprint is distinct from app_private.player_support_fingerprint_v1(p_character_id) then raise exception using errcode='40001',message='PLAYER_VERSION_STALE'; end if;
 v_before:=app_private.player_support_facts_v1(p_character_id);
 if v_kind='source' then
   v_attributes:=p_command->'attributes';
   if jsonb_typeof(v_attributes) is distinct from 'object' or (select count(*) from jsonb_object_keys(v_attributes))<>6
   or exists(select 1 from jsonb_each(v_attributes) e where e.key<>all(array['might','finesse','vitality','agility','intellect','resolve']) or jsonb_typeof(e.value)<>'number' or e.value::text!~'^[0-9]+$')
   or jsonb_typeof(p_command->'xp') is distinct from 'number' or (p_command->>'xp')!~'^[0-9]+$' then raise exception using errcode='22023',message='PLAYER_SOURCE_INVALID'; end if;
   v_xp:=(p_command->>'xp')::bigint;
   select curve.* into v_curve from app_private.level_progression_curves curve join app_private.progression_cycle_level_curves mapping on mapping.curve_version=curve.version where mapping.progression_cycle=v_character.progression_cycle;
   if not found then raise exception using errcode='22023',message='PLAYER_CURVE_UNAVAILABLE'; end if;
   if v_xp>v_curve.cumulative_xp_by_level[v_curve.max_level] then raise exception using errcode='22023',message='PLAYER_XP_RANGE_INVALID'; end if;
   v_level:=app_private.resolve_level_from_curve(v_xp,v_curve.cumulative_xp_by_level,v_curve.max_level);
   select * into v_profile from app_private.discipline_primary_profiles where discipline_id=v_build.primary_discipline_id and profile_version=v_build.primary_profile_version;
   perform app_private.validate_character_core_allocation_v1((v_attributes->>'might')::int,(v_attributes->>'finesse')::int,(v_attributes->>'vitality')::int,(v_attributes->>'agility')::int,(v_attributes->>'intellect')::int,(v_attributes->>'resolve')::int,v_level,v_profile.core_base_attributes,v_profile.focus_attributes,v_profile.off_focus_cap,false);
   update public.characters set xp=v_xp,level=v_level,might=(v_attributes->>'might')::int,finesse=(v_attributes->>'finesse')::int,vitality=(v_attributes->>'vitality')::int,agility=(v_attributes->>'agility')::int,intellect=(v_attributes->>'intellect')::int,resolve=(v_attributes->>'resolve')::int where id=p_character_id;
   update app_private.character_attribute_personal_allocations set might=(v_attributes->>'might')::int-(v_profile.core_base_attributes->>'might')::int,finesse=(v_attributes->>'finesse')::int-(v_profile.core_base_attributes->>'finesse')::int,vitality=(v_attributes->>'vitality')::int-(v_profile.core_base_attributes->>'vitality')::int,agility=(v_attributes->>'agility')::int-(v_profile.core_base_attributes->>'agility')::int,intellect=(v_attributes->>'intellect')::int-(v_profile.core_base_attributes->>'intellect')::int,resolve=(v_attributes->>'resolve')::int-(v_profile.core_base_attributes->>'resolve')::int,conversion_required=false,updated_at=clock_timestamp() where character_id=p_character_id;
 elsif v_kind='disciplines' then
   perform public.change_character_disciplines_v3(v_character.user_id,p_character_id,v_build.build_version,p_command ? 'primary',p_command->>'primary',p_command ? 'secondary',p_command->>'secondary',p_request_key,v_hash);
 elsif v_kind='skills' then
   perform public.save_character_discipline_skill_loadout_v1(v_character.user_id,p_character_id,v_build.build_version,p_command->'skills',p_request_key,v_hash);
 else
   perform public.save_character_support_action_v1(v_character.user_id,p_character_id,v_build.build_version,p_command->>'supportActionId',p_request_key,v_hash);
 end if;
 -- Every support correction advances the same generation, including source-only
 -- corrections and harmless same-value saves. Existing domain saves may advance it.
 update app_private.character_active_builds set build_version=greatest(build_version,v_build.build_version+1),updated_at=clock_timestamp() where character_id=p_character_id;
 insert into app_private.player_support_revisions values(p_character_id,1) on conflict(character_id) do update set revision=app_private.player_support_revisions.revision+1;
 v_after:=app_private.player_support_facts_v1(p_character_id);
 insert into app_private.player_support_audit(actor_user_id,actor_character_id,character_id,action,request_key,request_hash,before_facts,after_facts) values(p_actor_user_id,p_actor_character_id,p_character_id,'player.edit',p_request_key,v_hash,v_before,v_after);
 return jsonb_build_object('replayed',false,'facts',v_after);
end; $$;

-- Every retained commit path resynchronizes exact old replays to the durable head.
create function app_private.lock_no_contest_head_v1(p_user_id uuid,p_session_id uuid)
returns setof app_private.battle_sessions language plpgsql security definer set search_path='' as $$
declare v_session app_private.battle_sessions%rowtype;
begin
 select * into v_session from app_private.battle_sessions b where b.id=p_session_id for update;
 if found and exists(select 1 from app_private.battle_no_contest_markers where battle_hash=encode(sha256(convert_to(v_session.battle_id,'UTF8')),'hex')) then
   if v_session.owner_user_id<>p_user_id and not exists(select 1 from app_private.battle_participants where battle_session_id=p_session_id and user_id=p_user_id) then raise exception using errcode='42501',message='BATTLE_NOT_FOUND'; end if;
   return next v_session;
 end if;
end; $$;
do $$ declare v_name text; v_definition text; v_guard text := $guard$
begin
 return query select h.id,h.current_version,h.current_snapshot,h.updated_at,true from app_private.lock_no_contest_head_v1(p_user_id,p_battle_session_id) h;
 if found then return; end if;
$guard$;
begin
 foreach v_name in array array['public.commit_battle_intent_v1(text,uuid,text,uuid,uuid,bigint,jsonb,jsonb)','public.commit_battle_intent_v2_inner(text,uuid,text,uuid,uuid,bigint,jsonb,jsonb)','public.commit_battle_intent_v2(text,uuid,text,uuid,uuid,bigint,jsonb,jsonb)','public.commit_battle_intent_v3(text,uuid,text,uuid,uuid,bigint,jsonb,jsonb,jsonb)'] loop
   select pg_get_functiondef(v_name::regprocedure) into v_definition;
   if position(E'\nbegin\n' in v_definition)=0 then raise exception 'PLAYER_COMMIT_PREDECESSOR_MISMATCH:%',v_name; end if;
   execute regexp_replace(v_definition,E'\nbegin\n',v_guard);
 end loop;
 select pg_get_functiondef('public.claim_discipline_trial_v1(uuid,uuid)'::regprocedure) into v_definition;
 execute regexp_replace(v_definition,E'\nbegin\n',E'\nbegin\n if exists(select 1 from app_private.lock_no_contest_head_v1(p_user_id,p_battle_session_id)) then raise exception using errcode=\'22023\',message=\'BATTLE_NO_REWARDS\'; end if;\n');
 select pg_get_functiondef('app_private.capture_battle_validation_terminal_v1()'::regprocedure) into v_definition;
 execute regexp_replace(v_definition,E'\nbegin\n',E'\nbegin\n if exists(select 1 from app_private.battle_no_contest_markers where battle_hash=encode(sha256(convert_to(new.battle_id,\'UTF8\')),\'hex\')) then return new; end if;\n');
end; $$;

create function public.recover_master_player_battle_v1(p_actor_user_id uuid,p_character_id uuid,p_battle_session_id uuid,p_expected_version bigint,p_participant_ids uuid[],p_request_key uuid,p_terminal_snapshot jsonb,p_confirmed boolean,p_actor_character_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,app_private as $$
declare v_session app_private.battle_sessions%rowtype; v_people uuid[]; v_user uuid; v_receipt app_private.battle_no_contests%rowtype; v_now timestamptz:=clock_timestamp(); v_before jsonb; v_hash text; v_lobby uuid; v_old jsonb; v_units jsonb; v_bridge jsonb; v_runtime jsonb;
begin
 perform app_private.assert_game_owner_v1(p_actor_user_id);
 perform set_config('lock_timeout','2s',true);
 if p_confirmed is distinct from true or p_request_key is null then raise exception using errcode='22023',message='PLAYER_CONFIRMATION_REQUIRED'; end if;
 select * into v_session from app_private.battle_sessions where id=p_battle_session_id for update;
 if not found then raise exception using errcode='22023',message='BATTLE_NOT_FOUND'; end if;
 select array_agg(character_id order by character_id) into v_people from app_private.battle_participants where battle_session_id=p_battle_session_id and character_id is not null;
 if not(p_character_id=any(v_people)) or v_people is distinct from (select array_agg(id order by id) from unnest(p_participant_ids) id) then raise exception using errcode='40001',message='BATTLE_PARTICIPANTS_CHANGED'; end if;
 select * into v_receipt from app_private.battle_no_contests where battle_session_id=p_battle_session_id;
 if found then return jsonb_build_object('outcome','NoContest','rewards','NoRewards','version',v_receipt.terminal_version,'replayed',true); end if;
 if v_session.lifecycle not in ('pending','active') then return jsonb_build_object('outcome','AlreadyTerminal','version',v_session.current_version,'replayed',false); end if;
 if p_expected_version is distinct from v_session.current_version then raise exception using errcode='40001',message='BATTLE_VERSION_STALE'; end if;
 for v_user in select distinct user_id from app_private.battle_participants where battle_session_id=p_battle_session_id and user_id is not null order by user_id loop
   if not pg_try_advisory_xact_lock(hashtextextended(v_user::text,1)) then raise exception using errcode='40001',message='BATTLE_RECOVERY_RETRY'; end if;
 end loop;
 perform 1 from public.characters where id=any(v_people) order by id for update nowait;
 perform 1 from app_private.character_active_builds where character_id=any(v_people) order by character_id for update nowait;
 for v_lobby in select id from app_private.pvp_lobbies where battle_session_id=p_battle_session_id order by id for update nowait loop null; end loop;
 v_old:=v_session.current_snapshot;
 select coalesce(jsonb_agg(unit),'[]'::jsonb) into v_units from jsonb_array_elements(v_old #> '{tactical,battle,combatants}') unit where unit->>'kind' is distinct from 'summon';
 v_bridge:=v_old->'statBridge';
 if v_bridge is not null then
   v_bridge:=jsonb_set(v_bridge,'{combatants}',(select coalesce(jsonb_agg(row),'[]'::jsonb) from jsonb_array_elements(v_bridge->'combatants') row where exists(select 1 from jsonb_array_elements(v_units) unit where unit->>'id'=row->>'combatantId')));
 end if;
 v_runtime:=v_old->'abilityRuntime';
 if v_runtime is not null then
   v_runtime:=v_runtime||jsonb_build_object('activeSourceIds','[]'::jsonb,'maintained','[]'::jsonb,'usage',(select coalesce(jsonb_agg(row-'pendingRootActionIds'),'[]'::jsonb) from jsonb_array_elements(v_runtime->'usage') row));
   if v_runtime ? 'controlled' then v_runtime:=jsonb_set(v_runtime,'{controlled,primes}','[]'::jsonb); end if;
 end if;
 if p_terminal_snapshot #>> '{tactical,battle,lifecycle}' is distinct from 'abandoned'
 or p_terminal_snapshot->>'administrativeOutcome' is distinct from 'NoContest'
 or p_terminal_snapshot->>'rewardOutcome' is distinct from 'NoRewards'
 or p_terminal_snapshot #> '{tactical,battle,currentTurn}' is distinct from 'null'::jsonb
 or p_terminal_snapshot ?| array['pendingSummons','pendingEffects','groundAreas','terrainOverlays','turnOrigin','turnTriggerState','percentageDotCommands','effectState']
 or (p_terminal_snapshot-array['tactical','statBridge','statusState','abilityRuntime','administrativeOutcome','rewardOutcome']) is distinct from (v_old-array['tactical','statBridge','statusState','abilityRuntime','pendingSummons','pendingEffects','groundAreas','terrainOverlays','turnOrigin','turnTriggerState','percentageDotCommands','effectState'])
 or p_terminal_snapshot->'statBridge' is distinct from v_bridge
 or p_terminal_snapshot->'abilityRuntime' is distinct from v_runtime
 or p_terminal_snapshot #> '{tactical,battle,combatants}' is distinct from v_units
 or ((p_terminal_snapshot->'tactical')-array['battle','placements']) is distinct from ((v_old->'tactical')-array['battle','placements'])
 or ((p_terminal_snapshot #> '{tactical,battle}')-array['lifecycle','currentTurn','combatants','initiativeOrder','initiativeTieOrder','actedCombatantIds','deferredInitiativeCombatantIds','activeInitiativeModifiers','roundInitiativeModifiers']) is distinct from ((v_old #> '{tactical,battle}')-array['lifecycle','currentTurn','combatants','initiativeOrder','initiativeTieOrder','actedCombatantIds','deferredInitiativeCombatantIds','activeInitiativeModifiers','roundInitiativeModifiers'])
 or exists(select 1 from unnest(array['actedCombatantIds','deferredInitiativeCombatantIds','activeInitiativeModifiers','roundInitiativeModifiers']) key where coalesce(p_terminal_snapshot #> array['tactical','battle',key],'[]'::jsonb)<>'[]'::jsonb)
 or (v_old #> '{tactical,placements}' is not null and p_terminal_snapshot #> '{tactical,placements}' is distinct from (select coalesce(jsonb_agg(row),'[]'::jsonb) from jsonb_array_elements(v_old #> '{tactical,placements}') row where exists(select 1 from jsonb_array_elements(v_units) unit where unit->>'id'=row->>'combatantId')))
 or (v_old->'statusState' is not null and p_terminal_snapshot->'statusState' is distinct from (select coalesce(jsonb_agg(row||jsonb_build_object('statuses','[]'::jsonb)),'[]'::jsonb) from jsonb_array_elements(v_old->'statusState') row where exists(select 1 from jsonb_array_elements(v_units) unit where unit->>'id'=row->>'combatantId')))
 then raise exception using errcode='22023',message='BATTLE_RECOVERY_SNAPSHOT_INVALID'; end if;
 v_before:=jsonb_build_object('battleSessionId',p_battle_session_id,'version',v_session.current_version,'participants',v_people);
 v_hash:=encode(sha256(convert_to(v_before::text,'UTF8')),'hex');
 insert into app_private.battle_no_contest_markers(battle_hash) values(encode(sha256(convert_to(v_session.battle_id,'UTF8')),'hex'));
 insert into app_private.battle_no_contests(battle_session_id,actor_user_id,actor_character_id,participant_ids,original_version,terminal_version,request_key) values(p_battle_session_id,p_actor_user_id,p_actor_character_id,v_people,v_session.current_version,v_session.current_version+1,p_request_key);
 update app_private.battle_sessions set lifecycle='abandoned',current_version=current_version+1,current_snapshot=p_terminal_snapshot,updated_at=v_now where id=p_battle_session_id;
 insert into app_private.battle_snapshots(battle_session_id,battle_version,snapshot,created_at) values(p_battle_session_id,v_session.current_version+1,p_terminal_snapshot,v_now);
 insert into app_private.battle_events(battle_session_id,battle_version,event_index,event,created_at) values(p_battle_session_id,v_session.current_version+1,0,jsonb_build_object('event','administrative_no_contest','outcome','NoContest','rewards','NoRewards'),v_now);
 insert into app_private.player_support_audit(actor_user_id,actor_character_id,character_id,action,request_key,request_hash,before_facts,after_facts) values(p_actor_user_id,p_actor_character_id,p_character_id,'battle.no-contest',p_request_key,v_hash,v_before,v_before||jsonb_build_object('version',v_session.current_version+1,'outcome','NoContest','rewards','NoRewards'));
 -- No resource refund, training mutation, XP-grant deletion or World progress rewrite.
 delete from app_private.ai_turn_clocks where battle_session_id=p_battle_session_id;
 delete from app_private.pvp_turn_clocks where battle_session_id=p_battle_session_id;
 delete from app_private.pvp_active_spectating where battle_session_id=p_battle_session_id;
 delete from app_private.pvp_battle_spectator_presence where battle_session_id=p_battle_session_id;
 delete from app_private.pvp_lobby_members where lobby_id in(select id from app_private.pvp_lobbies where battle_session_id=p_battle_session_id);
 update app_private.pvp_lobbies set status='cancelled',updated_at=v_now where battle_session_id=p_battle_session_id;
 return jsonb_build_object('outcome','NoContest','rewards','NoRewards','version',v_session.current_version+1,'replayed',false);
end; $$;

revoke all on function public.search_master_players_v1(uuid,text,uuid),public.read_master_player_v1(uuid,uuid,uuid),public.edit_master_player_v1(uuid,uuid,text,uuid,jsonb,boolean,uuid),public.recover_master_player_battle_v1(uuid,uuid,uuid,bigint,uuid[],uuid,jsonb,boolean,uuid) from public,anon,authenticated;
grant execute on function public.search_master_players_v1(uuid,text,uuid),public.read_master_player_v1(uuid,uuid,uuid),public.edit_master_player_v1(uuid,uuid,text,uuid,jsonb,boolean,uuid),public.recover_master_player_battle_v1(uuid,uuid,uuid,bigint,uuid[],uuid,jsonb,boolean,uuid) to service_role;
revoke all on function app_private.player_source_hash_v1(uuid),app_private.player_support_facts_v1(uuid),app_private.player_support_fingerprint_v1(uuid),app_private.guard_player_battle_admission_v1(),app_private.guard_no_contest_head_v1(),app_private.lock_no_contest_head_v1(uuid,uuid),app_private.prevent_player_support_update_v1() from public,anon,authenticated,service_role;
-- Read-only exact replay is also called directly by the service before commit.
-- Preserve its STABLE/read-only contract while preferring current terminal truth.
do $$ declare v_definition text; v_guard text := $guard$
begin
 return query select b.id,b.current_version,b.current_snapshot,b.updated_at,true
 from app_private.battle_sessions b
 where b.id=p_battle_session_id
 and exists(select 1 from app_private.battle_no_contest_markers m where m.battle_hash=encode(sha256(convert_to(b.battle_id,'UTF8')),'hex'))
 and exists(select 1 from app_private.battle_participants p where p.battle_session_id=b.id and p.user_id=p_user_id and p.participant_role='player');
 if found then return; end if;
$guard$;
begin
 select pg_get_functiondef('public.get_battle_intent_replay_v1(text,uuid,text,uuid,uuid)'::regprocedure) into v_definition;
 execute regexp_replace(v_definition,E'\nbegin\n',v_guard);
 select pg_get_functiondef('public.create_battle_session_v1(text,uuid,text,uuid,text,integer,integer,jsonb,jsonb)'::regprocedure) into v_definition;
 if position(E'1::bigint,\n      snap.snapshot,' in v_definition)=0 then raise exception 'PLAYER_CREATE_REPLAY_PREDECESSOR_MISMATCH'; end if;
 execute replace(v_definition,E'1::bigint,\n      snap.snapshot,',E'case when s.current_snapshot->>\'administrativeOutcome\'=\'NoContest\' then s.current_version else 1::bigint end,\n      case when s.current_snapshot->>\'administrativeOutcome\'=\'NoContest\' then s.current_snapshot else snap.snapshot end,');
end; $$;

commit;
