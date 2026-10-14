begin;

-- Startup Automatic receipts belong to the initial immutable snapshot transaction.
-- Existing v1 calls remain unchanged and do not backfill historical version-one events.
alter table app_private.battle_events drop constraint battle_events_battle_version_check;
alter table app_private.battle_events add constraint battle_events_battle_version_check check (battle_version >= 1);
alter table app_private.battle_privacy_journal drop constraint battle_privacy_journal_battle_version_check;
alter table app_private.battle_privacy_journal add constraint battle_privacy_journal_battle_version_check check (battle_version >= 1);

create function app_private.append_battle_startup_events_v1(
  p_session_id uuid, p_start_snapshot jsonb, p_final_snapshot jsonb,
  p_events jsonb, p_journal jsonb, p_created_at timestamptz
) returns void
language plpgsql
set search_path = pg_catalog, app_private
as $$
declare
  v_actor text := p_start_snapshot #>> '{tactical,battle,currentTurn,combatantId}';
  v_team text;
  v_override jsonb;
  v_visibility jsonb;
  v_index integer;
  v_indexes integer[] := array[]::integer[];
begin
  if not coalesce(
    jsonb_typeof(p_start_snapshot) = 'object' and jsonb_typeof(p_final_snapshot) = 'object'
    and p_start_snapshot #>> '{tactical,battle,lifecycle}' = 'active'
    and p_final_snapshot #>> '{tactical,battle,lifecycle}' in ('active','completed')
    and p_start_snapshot #>> '{tactical,battle,battleId}' = p_final_snapshot #>> '{tactical,battle,battleId}'
    and p_start_snapshot #>> '{tactical,battle,rulesVersion}' = p_final_snapshot #>> '{tactical,battle,rulesVersion}'
    and p_start_snapshot #>> '{tactical,battle,contentVersion}' = p_final_snapshot #>> '{tactical,battle,contentVersion}'
    and jsonb_typeof(p_start_snapshot #> '{tactical,battle,combatants}') = 'array'
    and jsonb_typeof(p_final_snapshot #> '{tactical,battle,combatants}') = 'array'
    and jsonb_typeof(p_events) = 'array'
    and jsonb_typeof(p_journal) = 'object'
    and p_journal -> 'schemaVersion' = '1'::jsonb
    and jsonb_typeof(p_journal -> 'eventVisibilityOverrides') = 'array', false)
  then raise exception using errcode='22023', message='BATTLE_STARTUP_INVALID'; end if;
  if exists(select 1 from jsonb_object_keys(p_journal) k where k not in ('schemaVersion','commandVisibility','eventVisibilityOverrides'))
    or exists(select 1 from jsonb_array_elements(p_events) e where jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'event') <> 'string' or nullif(btrim(e->>'event'),'') is null)
    or (select jsonb_agg(jsonb_build_array(c->>'id',c->>'teamId') order by c->>'id') from jsonb_array_elements(p_start_snapshot #> '{tactical,battle,combatants}') c)
      is distinct from (select jsonb_agg(jsonb_build_array(c->>'id',c->>'teamId') order by c->>'id') from jsonb_array_elements(p_final_snapshot #> '{tactical,battle,combatants}') c)
  then raise exception using errcode='22023', message='BATTLE_STARTUP_INVALID'; end if;
  select c->>'teamId' into v_team from jsonb_array_elements(p_start_snapshot #> '{tactical,battle,combatants}') c where c->>'id'=v_actor;
  if nullif(btrim(v_actor),'') is null or nullif(btrim(v_team),'') is null
  then raise exception using errcode='22023', message='BATTLE_STARTUP_INVALID'; end if;
  for v_override in select e from jsonb_array_elements(p_journal->'eventVisibilityOverrides') e loop
    if not coalesce(jsonb_typeof(v_override)='object' and jsonb_typeof(v_override->'eventIndex')='number' and (v_override->>'eventIndex') ~ '^[0-9]+$',false)
      or exists(select 1 from jsonb_object_keys(v_override) k where k not in ('eventIndex','visibility'))
    then raise exception using errcode='22023', message='BATTLE_STARTUP_INVALID'; end if;
    begin v_index := (v_override->>'eventIndex')::integer;
    exception when numeric_value_out_of_range then raise exception using errcode='22023', message='BATTLE_STARTUP_INVALID'; end;
    if v_index >= jsonb_array_length(p_events) or v_index=any(v_indexes)
    then raise exception using errcode='22023', message='BATTLE_STARTUP_INVALID'; end if;
    v_indexes := array_append(v_indexes,v_index);
  end loop;
  for v_visibility in select p_journal->'commandVisibility' union all select e->'visibility' from jsonb_array_elements(p_journal->'eventVisibilityOverrides') e loop
    if not coalesce(app_private.is_battle_privacy_visibility_v1(v_visibility),false)
      or exists(select 1 from jsonb_object_keys(v_visibility) k where k not in ('kind','teamId','requiredTeamIds'))
      or (v_visibility->>'kind'='public' and v_visibility ? 'requiredTeamIds')
      or (v_visibility->>'kind'='team-only' and not exists(select 1 from jsonb_array_elements(p_start_snapshot #> '{tactical,battle,combatants}') c where c->>'teamId'=v_visibility->>'teamId'))
    then raise exception using errcode='22023', message='BATTLE_STARTUP_INVALID'; end if;
    if v_visibility ? 'requiredTeamIds' then
      if jsonb_typeof(v_visibility->'requiredTeamIds') <> 'array'
      then raise exception using errcode='22023', message='BATTLE_STARTUP_INVALID'; end if;
      if jsonb_array_length(v_visibility->'requiredTeamIds') not between 1 and 6
        or exists(select 1 from jsonb_array_elements(v_visibility->'requiredTeamIds') t where jsonb_typeof(t)<>'string' or t#>>'{}'=v_visibility->>'teamId' or not exists(select 1 from jsonb_array_elements(p_start_snapshot #> '{tactical,battle,combatants}') c where c->>'teamId'=t#>>'{}'))
        or (select count(*) from jsonb_array_elements(v_visibility->'requiredTeamIds')) <> (select count(distinct t) from jsonb_array_elements(v_visibility->'requiredTeamIds') t)
      then raise exception using errcode='22023', message='BATTLE_STARTUP_INVALID'; end if;
    end if;
  end loop;
  update app_private.battle_sessions set current_snapshot=p_final_snapshot, lifecycle=p_final_snapshot#>>'{tactical,battle,lifecycle}' where id=p_session_id;
  update app_private.battle_snapshots set snapshot=p_final_snapshot where battle_session_id=p_session_id and battle_version=1;
  insert into app_private.battle_events(battle_session_id,battle_version,event_index,event,created_at)
    select p_session_id,1,(e.ordinality-1)::integer,e.value,p_created_at from jsonb_array_elements(p_events) with ordinality e(value,ordinality);
  insert into app_private.battle_privacy_journal(battle_session_id,battle_version,journal,created_at)
    values(p_session_id,1,jsonb_build_object('schemaVersion',1,'actorCombatantId',v_actor,'actorTeamId',v_team,'commandVisibility',p_journal->'commandVisibility','eventVisibilityOverrides',p_journal->'eventVisibilityOverrides','eventCount',jsonb_array_length(p_events)),p_created_at);
end;
$$;
revoke all on function app_private.append_battle_startup_events_v1(uuid,jsonb,jsonb,jsonb,jsonb,timestamptz) from public,anon,authenticated,service_role;

create function public.create_battle_session_v2(
  p_actor_key text,p_idempotency_key uuid,p_request_fingerprint text,p_user_id uuid,
  p_battle_id text,p_rules_version integer,p_content_version integer,p_initial_snapshot jsonb,
  p_participants jsonb,p_start_snapshot jsonb,p_initial_events jsonb,p_privacy_journal jsonb
) returns table(battle_session_id uuid,battle_version bigint,snapshot jsonb,created_at timestamptz,replayed boolean)
language plpgsql security definer set search_path=pg_catalog,app_private,public
as $$
declare v_created record;
begin
  select * into v_created from public.create_battle_session_v1(p_actor_key,p_idempotency_key,p_request_fingerprint,p_user_id,p_battle_id,p_rules_version,p_content_version,p_start_snapshot,p_participants);
  if v_created.replayed then
    return query select v_created.battle_session_id,v_created.battle_version,v_created.snapshot,v_created.created_at,true;
    return;
  end if;
  perform app_private.append_battle_startup_events_v1(v_created.battle_session_id,p_start_snapshot,p_initial_snapshot,p_initial_events,p_privacy_journal,v_created.created_at);
  return query select v_created.battle_session_id,v_created.battle_version,p_initial_snapshot,v_created.created_at,false;
end;
$$;
revoke all on function public.create_battle_session_v2(text,uuid,text,uuid,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_battle_session_v2(text,uuid,text,uuid,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;

create function public.create_pvp_battle_session_v2(
  p_actor_user_id uuid,p_lobby_id uuid,p_battle_id text,p_rules_version integer,p_content_version integer,
  p_initial_snapshot jsonb,p_participants jsonb,p_start_snapshot jsonb,p_initial_events jsonb,p_privacy_journal jsonb
) returns table(battle_session_id uuid,battle_version bigint,snapshot jsonb,created_at timestamptz,battle_key text)
language plpgsql security definer set search_path=pg_catalog,app_private,public
as $$
declare v_created record; v_existing uuid;
begin
  -- Share the predecessor's locked lobby authority; a retry never appends startup rows.
  select l.battle_session_id into v_existing from app_private.pvp_lobbies l where l.id=p_lobby_id for update;
  select * into v_created from public.create_pvp_battle_session_v1(p_actor_user_id,p_lobby_id,p_battle_id,p_rules_version,p_content_version,p_start_snapshot,p_participants);
  if v_existing is not null then
    return query select v_created.battle_session_id,v_created.battle_version,v_created.snapshot,v_created.created_at,v_created.battle_key;
    return;
  end if;
  perform app_private.append_battle_startup_events_v1(v_created.battle_session_id,p_start_snapshot,p_initial_snapshot,p_initial_events,p_privacy_journal,v_created.created_at);
  return query select v_created.battle_session_id,v_created.battle_version,p_initial_snapshot,v_created.created_at,v_created.battle_key;
end;
$$;
revoke all on function public.create_pvp_battle_session_v2(uuid,uuid,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_pvp_battle_session_v2(uuid,uuid,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;

commit;
