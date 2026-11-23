begin;

create function app_private.valid_npc_world_encounter_v1(value jsonb) returns boolean
language sql immutable set search_path='' as $$
  select case when jsonb_typeof(value)='object' and jsonb_typeof(value->'tags')='array' then coalesce(
    value - array['arenaId','aiDifficulty','tags']='{}'::jsonb
    and value->>'arenaId' in ('duel-yard','crossroads-court','terraced-yard')
    and value->>'aiDifficulty' in ('easy','standard','high')
    and jsonb_array_length(value->'tags')<=8
    and jsonb_array_length(value->'tags')=(select count(distinct tag) from jsonb_array_elements(value->'tags') tag
      where jsonb_typeof(tag)='string' and (tag#>>'{}') ~ '^[a-z][a-z0-9-]{1,31}$'),
    false) else false end;
$$;

create or replace function app_private.valid_npc_world_settings_v1(value jsonb) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(
    jsonb_typeof(value)='object'
    and value - array['sectorId','x','y','radius','greeting','encounter'] = '{}'::jsonb
    and jsonb_typeof(value->'sectorId')='string' and (value->>'sectorId') ~ '^[a-z0-9:-]{1,100}$'
    and jsonb_typeof(value->'x')='number' and (value->>'x') ~ '^(0|[1-9]|1[0-2])$'
    and jsonb_typeof(value->'y')='number' and (value->>'y') ~ '^[0-8]$'
    and jsonb_typeof(value->'radius')='number' and (value->>'radius') ~ '^[1-3]$'
    and jsonb_typeof(value->'greeting')='string' and char_length(value->>'greeting')<=900
    and (value->'encounter' is null or value->'encounter'='null'::jsonb
      or app_private.valid_npc_world_encounter_v1(value->'encounter')),
    false
  );
$$;

alter table app_private.npc_designs drop constraint npc_designs_world_valid,
  add constraint npc_designs_world_valid check (
    world is null or (
      app_private.valid_published_npc_identity_v1(world - array['sectorId','x','y','radius','greeting','encounter'],id,revision)
      and app_private.valid_npc_world_settings_v1(world - array['id','name','portraitRef','imageUrl','revision'])
      and char_length(btrim(world->>'greeting'))>0
    )
  );

create table app_private.world_npc_battles (
  battle_session_id uuid primary key references app_private.battle_sessions(id) on delete cascade,
  character_id uuid not null,
  command_id uuid not null,
  world_fingerprint text not null,
  npc_id uuid not null,
  npc_revision bigint not null check (npc_revision>0),
  opponent_combatant_id text not null,
  placement jsonb not null,
  tags jsonb not null,
  template jsonb not null,
  admitted_at timestamptz not null,
  unique(character_id,command_id)
);
alter table app_private.world_npc_battles enable row level security;
revoke all on app_private.world_npc_battles from public,anon,authenticated,service_role;

create function app_private.world_npc_battle_publication_v1(p_npc_id uuid,p_state jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare publication jsonb;
begin
  select d.world into publication from app_private.npc_designs d where d.id=p_npc_id;
  if not app_private.valid_npc_world_encounter_v1(publication->'encounter') then
    raise exception using errcode='22023', message='WORLD_NPC_CHALLENGE_UNAVAILABLE';
  end if;
  if p_state is null or p_state->'route' is distinct from '[]'::jsonb
    or p_state->'ferry' is not null and p_state->'ferry'<>'null'::jsonb
    or p_state#>>'{position,sectorId}' is distinct from publication->>'sectorId'
    or coalesce(abs((p_state#>>'{position,x}')::integer-(publication->>'x')::integer)
      +abs((p_state#>>'{position,y}')::integer-(publication->>'y')::integer),99)>(publication->>'radius')::integer then
    raise exception using errcode='22023', message='WORLD_NPC_CHALLENGE_OUT_OF_RANGE';
  end if;
  return publication;
end; $$;

create function public.read_world_npc_battle_v1(
  p_user_id uuid,p_character_id uuid,p_npc_id uuid,p_expected_version bigint
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare state jsonb;
declare publication jsonb;
begin
  select w.state into state from app_private.character_world_state w join public.characters c
    on c.id=w.character_id and c.user_id=p_user_id
    where w.character_id=p_character_id and not exists(
      select 1 from app_private.character_deletion_requests d where d.character_id=c.id);
  if state is null then raise exception using errcode='42501', message='WORLD_NOT_OWNED'; end if;
  if (state->>'version')::bigint is distinct from p_expected_version then
    raise exception using errcode='PT409', message='WORLD_STALE_VERSION';
  end if;
  publication := app_private.world_npc_battle_publication_v1(p_npc_id,state);
  return publication - array['sectorId','x','y','radius','greeting','encounter']
    || ((publication->'encounter') - 'tags'::text) || jsonb_build_object('lore','',
      'placement',jsonb_build_object('sectorId',publication->'sectorId','x',publication->'x','y',publication->'y'));
end; $$;

create function public.read_world_npc_battle_replay_v1(
  p_user_id uuid,p_character_id uuid,p_npc_id uuid,p_command_id uuid,p_world_fingerprint text
) returns uuid language plpgsql stable security definer set search_path='' as $$
declare receipt app_private.world_npc_battles%rowtype;
begin
  if not exists(select 1 from public.characters c where c.id=p_character_id and c.user_id=p_user_id
    and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id)) then
    raise exception using errcode='42501', message='WORLD_NOT_OWNED';
  end if;
  select * into receipt from app_private.world_npc_battles b
    where b.character_id=p_character_id and b.command_id=p_command_id;
  if not found then return null; end if;
  if receipt.npc_id is distinct from p_npc_id or receipt.world_fingerprint is distinct from p_world_fingerprint then
    raise exception using errcode='22023', message='WORLD_COMMAND_CONFLICT';
  end if;
  return receipt.battle_session_id;
end; $$;

create function public.start_world_npc_battle_v1(
  p_user_id uuid,p_character_id uuid,p_expected_version bigint,p_command_id uuid,p_npc_id uuid,
  p_world_fingerprint text,p_request_fingerprint text,p_battle_id text,p_rules_version integer,
  p_content_version integer,p_initial_snapshot jsonb,p_participants jsonb,p_start_snapshot jsonb,
  p_initial_events jsonb,p_privacy_journal jsonb
) returns table(battle_session_id uuid,battle_version bigint,snapshot jsonb,created_at timestamptz,replayed boolean)
language plpgsql security definer set search_path='' as $$
declare world app_private.character_world_state%rowtype;
declare publication jsonb;
declare created record;
declare block text;
declare replay_id uuid;
declare opponent_id text;
begin
  -- World and canonical battle writers share this admission lock order.
  if not pg_try_advisory_xact_lock_shared(hashtextextended('combat-catalogue-publication',0))
    or not pg_try_advisory_xact_lock(hashtextextended(p_user_id::text,0)) then
    raise exception using errcode='PT409', message='WORLD_STALE_BATTLE_ADMISSION';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
  perform 1 from public.characters c where c.id=p_character_id and c.user_id=p_user_id
    and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id) for update;
  if not found then raise exception using errcode='42501', message='WORLD_NOT_OWNED'; end if;
  select * into world from app_private.character_world_state where character_id=p_character_id for update;
  replay_id := public.read_world_npc_battle_replay_v1(p_user_id,p_character_id,p_npc_id,p_command_id,p_world_fingerprint);
  if replay_id is not null then
    return query select replay.* from public.get_battle_creation_replay_v1(p_user_id,p_command_id,p_request_fingerprint) replay
      where replay.battle_session_id=replay_id;
    if not found then raise exception using errcode='22023', message='WORLD_COMMAND_CONFLICT'; end if;
    return;
  end if;
  if world.last_command_id=p_command_id then raise exception using errcode='22023', message='WORLD_COMMAND_CONFLICT'; end if;
  if (world.state->>'version')::bigint is distinct from p_expected_version then
    raise exception using errcode='PT409', message='WORLD_STALE_VERSION';
  end if;
  perform 1 from app_private.npc_designs d where d.id=p_npc_id for share;
  publication := app_private.world_npc_battle_publication_v1(p_npc_id,world.state);
  block := app_private.world_block_reason_v1(p_user_id,p_character_id);
  if block is not null then raise exception using errcode='22023', message=block; end if;
  if p_initial_snapshot->'arenaNpc' is distinct from (publication - array['sectorId','x','y','radius','greeting','encounter'])
    or p_initial_snapshot->>'worldBattleOrigin' is distinct from 'npc'
    or (p_start_snapshot is null and p_initial_snapshot#>>'{tactical,battle,lifecycle}' is distinct from 'active')
    or (p_start_snapshot is not null and (p_start_snapshot->'arenaNpc' is distinct from p_initial_snapshot->'arenaNpc'
      or p_start_snapshot->>'worldBattleOrigin' is distinct from 'npc'))
    or coalesce(jsonb_array_length(p_participants),0)<>2
    or not p_participants @> jsonb_build_array(jsonb_build_object(
      'character_id',p_character_id,'combatant_id','character:'||p_character_id::text,'participant_role','player'))
    or not p_participants @> '[{"character_id":null,"participant_role":"opponent"}]'::jsonb then
    raise exception using errcode='22023', message='WORLD_NPC_CHALLENGE_UNAVAILABLE';
  end if;
  select p->>'combatant_id' into strict opponent_id from jsonb_array_elements(p_participants) p
    where p->>'participant_role'='opponent';
  select * into strict created from public.create_battle_session_v1(
    p_user_id::text,p_command_id,p_request_fingerprint,p_user_id,p_battle_id,
    p_rules_version,p_content_version,coalesce(p_start_snapshot,p_initial_snapshot),p_participants
  );
  if created.replayed then raise exception using errcode='22023', message='WORLD_COMMAND_CONFLICT'; end if;
  insert into app_private.world_npc_battles(battle_session_id,character_id,command_id,world_fingerprint,
    npc_id,npc_revision,opponent_combatant_id,placement,tags,template,admitted_at)
  values(created.battle_session_id,p_character_id,p_command_id,p_world_fingerprint,p_npc_id,
    (publication->>'revision')::bigint,opponent_id,jsonb_build_object(
      'sectorId',publication->'sectorId','x',publication->'x','y',publication->'y'),
    publication#>'{encounter,tags}',(publication->'encounter') - 'tags'::text,created.created_at);
  if p_start_snapshot is not null then
    perform app_private.append_battle_startup_events_v1(
      created.battle_session_id,p_start_snapshot,p_initial_snapshot,p_initial_events,p_privacy_journal,created.created_at);
  end if;
  update app_private.character_world_state set last_command_id=p_command_id,last_command_fingerprint=p_world_fingerprint
    where character_id=p_character_id;
  return query select created.battle_session_id,created.battle_version,p_initial_snapshot,created.created_at,false;
end; $$;

revoke all on function app_private.valid_npc_world_encounter_v1(jsonb),
  app_private.world_npc_battle_publication_v1(uuid,jsonb),
  public.read_world_npc_battle_v1(uuid,uuid,uuid,bigint),
  public.read_world_npc_battle_replay_v1(uuid,uuid,uuid,uuid,text),
  public.start_world_npc_battle_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.read_world_npc_battle_v1(uuid,uuid,uuid,bigint),
  public.read_world_npc_battle_replay_v1(uuid,uuid,uuid,uuid,text),
  public.start_world_npc_battle_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb)
  to service_role;
commit;
