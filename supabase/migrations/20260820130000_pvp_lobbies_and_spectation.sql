begin;

create table app_private.pvp_lobbies (
  id uuid primary key default gen_random_uuid(),
  lobby_key text not null unique check (lobby_key ~ '^AVL-[A-F0-9]{4}-[A-F0-9]{4}$'),
  mode text not null check (mode in ('1v1', '2v2', '3v3', '1v1v1', 'flex-teams')),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  team_a_size smallint not null check (team_a_size between 1 and 3),
  team_b_size smallint not null check (team_b_size between 1 and 3),
  team_c_size smallint not null default 0 check (team_c_size between 0 and 1),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'completed', 'cancelled')),
  battle_session_id uuid unique references app_private.battle_sessions(id) on delete set null,
  battle_key text unique check (battle_key is null or battle_key ~ '^AVB-[A-F0-9]{4}-[A-F0-9]{4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_private.pvp_lobby_members (
  lobby_id uuid not null references app_private.pvp_lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  team_index smallint not null check (team_index between 0 and 2),
  seat_index smallint not null check (seat_index between 0 and 2),
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (lobby_id, user_id),
  unique (lobby_id, character_id),
  unique (lobby_id, team_index, seat_index)
);

create index pvp_lobbies_owner_status_idx
  on app_private.pvp_lobbies (owner_user_id, status, updated_at desc);
create index pvp_lobby_members_character_idx
  on app_private.pvp_lobby_members (character_id, lobby_id);

comment on table app_private.pvp_lobbies is
  'Server-authoritative Battle Hall PvP staging rooms and spectator-key linkage.';
comment on table app_private.pvp_lobby_members is
  'Authoritative PvP lobby seats, teams, selected characters, and readiness.';

revoke all on table app_private.pvp_lobbies from public, anon, authenticated;
revoke all on table app_private.pvp_lobby_members from public, anon, authenticated;

create or replace function app_private.pvp_key(p_prefix text)
returns text
language sql
volatile
set search_path = pg_catalog
as $$
  select p_prefix || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' ||
    upper(substr(md5(gen_random_uuid()::text), 1, 4));
$$;

revoke all on function app_private.pvp_key(text) from public, anon, authenticated;

create or replace function public.create_pvp_lobby_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_mode text,
  p_team_a_size integer default null,
  p_team_b_size integer default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
as $$
declare
  v_lobby_id uuid := gen_random_uuid();
  v_lobby_key text;
  v_a integer;
  v_b integer;
  v_c integer := 0;
  v_attempt integer := 0;
begin
  if not exists (
    select 1 from public.characters c
    where c.id = p_character_id and c.user_id = p_user_id
  ) then
    raise exception using errcode = '42501', message = 'PVP_CHARACTER_NOT_OWNED';
  end if;

  case p_mode
    when '1v1' then v_a := 1; v_b := 1;
    when '2v2' then v_a := 2; v_b := 2;
    when '3v3' then v_a := 3; v_b := 3;
    when '1v1v1' then v_a := 1; v_b := 1; v_c := 1;
    when 'flex-teams' then
      if p_team_a_size not between 1 and 3 or p_team_b_size not between 1 and 3 then
        raise exception using errcode = '22023', message = 'PVP_INVALID_FLEX_TEAM_SIZE';
      end if;
      v_a := p_team_a_size;
      v_b := p_team_b_size;
    else
      raise exception using errcode = '22023', message = 'PVP_INVALID_MODE';
  end case;

  loop
    v_attempt := v_attempt + 1;
    v_lobby_key := app_private.pvp_key('AVL');
    begin
      insert into app_private.pvp_lobbies (
        id, lobby_key, mode, owner_user_id, team_a_size, team_b_size, team_c_size
      ) values (
        v_lobby_id, v_lobby_key, p_mode, p_user_id, v_a, v_b, v_c
      );
      exit;
    exception when unique_violation then
      if v_attempt >= 8 then raise; end if;
    end;
  end loop;

  insert into app_private.pvp_lobby_members (
    lobby_id, user_id, character_id, team_index, seat_index, ready
  ) values (v_lobby_id, p_user_id, p_character_id, 0, 0, false);

  return v_lobby_id;
end;
$$;

create or replace function public.join_pvp_lobby_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_lobby_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
as $$
declare
  v_lobby app_private.pvp_lobbies%rowtype;
  v_existing app_private.pvp_lobby_members%rowtype;
  v_team integer;
  v_seat integer;
  v_capacity integer;
begin
  if not exists (
    select 1 from public.characters c
    where c.id = p_character_id and c.user_id = p_user_id
  ) then
    raise exception using errcode = '42501', message = 'PVP_CHARACTER_NOT_OWNED';
  end if;

  select * into v_lobby
  from app_private.pvp_lobbies
  where lobby_key = upper(trim(p_lobby_key))
  for update;

  if not found or v_lobby.status <> 'waiting' then
    raise exception using errcode = '22023', message = 'PVP_LOBBY_NOT_AVAILABLE';
  end if;

  select * into v_existing
  from app_private.pvp_lobby_members
  where lobby_id = v_lobby.id and user_id = p_user_id;

  if found then
    if v_existing.character_id <> p_character_id then
      raise exception using errcode = '22023', message = 'PVP_ALREADY_IN_LOBBY';
    end if;
    return v_lobby.id;
  end if;

  select candidate.team_index into v_team
  from (
    select
      teams.team_index,
      teams.capacity,
      count(m.user_id)::integer as occupied
    from (
      values
        (0, v_lobby.team_a_size::integer),
        (1, v_lobby.team_b_size::integer),
        (2, v_lobby.team_c_size::integer)
    ) as teams(team_index, capacity)
    left join app_private.pvp_lobby_members m
      on m.lobby_id = v_lobby.id and m.team_index = teams.team_index
    where teams.capacity > 0
    group by teams.team_index, teams.capacity
  ) candidate
  where candidate.occupied < candidate.capacity
  order by candidate.occupied::numeric / candidate.capacity, candidate.team_index
  limit 1;

  if v_team is null then
    raise exception using errcode = '22023', message = 'PVP_LOBBY_FULL';
  end if;

  v_capacity := case v_team
    when 0 then v_lobby.team_a_size
    when 1 then v_lobby.team_b_size
    else v_lobby.team_c_size
  end;

  select seat into v_seat
  from generate_series(0, v_capacity - 1) as seat
  where not exists (
    select 1 from app_private.pvp_lobby_members m
    where m.lobby_id = v_lobby.id and m.team_index = v_team and m.seat_index = seat
  )
  order by seat
  limit 1;

  if v_seat is null then
    raise exception using errcode = '22023', message = 'PVP_LOBBY_FULL';
  end if;

  insert into app_private.pvp_lobby_members (
    lobby_id, user_id, character_id, team_index, seat_index, ready
  ) values (v_lobby.id, p_user_id, p_character_id, v_team, v_seat, false);

  update app_private.pvp_lobby_members set ready = false where lobby_id = v_lobby.id;
  update app_private.pvp_lobbies set updated_at = clock_timestamp() where id = v_lobby.id;
  return v_lobby.id;
end;
$$;

create or replace function public.set_pvp_lobby_ready_v1(
  p_user_id uuid,
  p_lobby_id uuid,
  p_ready boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
begin
  if not exists (
    select 1 from app_private.pvp_lobbies l
    join app_private.pvp_lobby_members m on m.lobby_id = l.id
    where l.id = p_lobby_id and l.status = 'waiting' and m.user_id = p_user_id
  ) then
    raise exception using errcode = '42501', message = 'PVP_LOBBY_NOT_AVAILABLE';
  end if;

  update app_private.pvp_lobby_members
  set ready = p_ready
  where lobby_id = p_lobby_id and user_id = p_user_id;
  update app_private.pvp_lobbies set updated_at = clock_timestamp() where id = p_lobby_id;
end;
$$;

create or replace function public.leave_pvp_lobby_v1(
  p_user_id uuid,
  p_lobby_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_lobby app_private.pvp_lobbies%rowtype;
begin
  select * into v_lobby from app_private.pvp_lobbies where id = p_lobby_id for update;
  if not found or v_lobby.status <> 'waiting' or not exists (
    select 1 from app_private.pvp_lobby_members
    where lobby_id = p_lobby_id and user_id = p_user_id
  ) then
    raise exception using errcode = '42501', message = 'PVP_LOBBY_NOT_AVAILABLE';
  end if;

  if v_lobby.owner_user_id = p_user_id then
    update app_private.pvp_lobbies
    set status = 'cancelled', updated_at = clock_timestamp()
    where id = p_lobby_id;
  else
    delete from app_private.pvp_lobby_members
    where lobby_id = p_lobby_id and user_id = p_user_id;
    update app_private.pvp_lobby_members set ready = false where lobby_id = p_lobby_id;
    update app_private.pvp_lobbies set updated_at = clock_timestamp() where id = p_lobby_id;
  end if;
end;
$$;

create or replace function public.get_pvp_lobby_v1(
  p_user_id uuid,
  p_lobby_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
stable
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from app_private.pvp_lobby_members
    where lobby_id = p_lobby_id and user_id = p_user_id
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'lobby_id', l.id,
    'lobby_key', l.lobby_key,
    'mode', l.mode,
    'owner_user_id', l.owner_user_id,
    'team_a_size', l.team_a_size,
    'team_b_size', l.team_b_size,
    'team_c_size', l.team_c_size,
    'status', l.status,
    'battle_session_id', l.battle_session_id,
    'battle_key', l.battle_key,
    'ready_to_start', (
      l.status = 'waiting'
      and (select count(*) from app_private.pvp_lobby_members m where m.lobby_id = l.id)
        = l.team_a_size + l.team_b_size + l.team_c_size
      and not exists (
        select 1 from app_private.pvp_lobby_members m
        where m.lobby_id = l.id and not m.ready
      )
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'character_id', m.character_id,
        'character_name', c.name,
        'character_level', c.level,
        'portrait_ref', c.portrait_ref,
        'team_index', m.team_index,
        'seat_index', m.seat_index,
        'ready', m.ready,
        'is_host', m.user_id = l.owner_user_id
      ) order by m.team_index, m.seat_index)
      from app_private.pvp_lobby_members m
      join public.characters c on c.id = m.character_id
      where m.lobby_id = l.id
    ), '[]'::jsonb)
  ) into v_result
  from app_private.pvp_lobbies l
  where l.id = p_lobby_id;

  return v_result;
end;
$$;

create or replace function public.create_pvp_battle_session_v1(
  p_actor_user_id uuid,
  p_lobby_id uuid,
  p_battle_id text,
  p_rules_version integer,
  p_content_version integer,
  p_initial_snapshot jsonb,
  p_participants jsonb
)
returns table (
  battle_session_id uuid,
  battle_version bigint,
  snapshot jsonb,
  created_at timestamptz,
  battle_key text
)
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
as $$
declare
  v_lobby app_private.pvp_lobbies%rowtype;
  v_session_id uuid := gen_random_uuid();
  v_created_at timestamptz := clock_timestamp();
  v_battle_key text;
  v_member_count integer;
  v_participant_count integer := 0;
  v_participant record;
  v_attempt integer := 0;
  v_lifecycle text;
begin
  select * into v_lobby from app_private.pvp_lobbies where id = p_lobby_id for update;
  if not found or not exists (
    select 1 from app_private.pvp_lobby_members
    where lobby_id = p_lobby_id and user_id = p_actor_user_id
  ) then
    raise exception using errcode = '42501', message = 'PVP_LOBBY_NOT_AVAILABLE';
  end if;

  if v_lobby.status = 'active' and v_lobby.battle_session_id is not null then
    return query
    select s.id, s.current_version, s.current_snapshot, s.created_at, v_lobby.battle_key
    from app_private.battle_sessions s
    where s.id = v_lobby.battle_session_id;
    return;
  end if;

  if v_lobby.status <> 'waiting' then
    raise exception using errcode = '22023', message = 'PVP_LOBBY_NOT_WAITING';
  end if;

  select count(*) into v_member_count
  from app_private.pvp_lobby_members where lobby_id = p_lobby_id;
  if v_member_count <> v_lobby.team_a_size + v_lobby.team_b_size + v_lobby.team_c_size
    or exists (
      select 1 from app_private.pvp_lobby_members
      where lobby_id = p_lobby_id and not ready
    ) then
    raise exception using errcode = '22023', message = 'PVP_LOBBY_NOT_READY';
  end if;

  if p_battle_id is null or char_length(p_battle_id) not between 1 and 160
    or p_rules_version is null or p_rules_version <= 0
    or p_content_version is null or p_content_version <= 0
    or jsonb_typeof(p_initial_snapshot) <> 'object'
    or jsonb_typeof(p_participants) <> 'array' then
    raise exception using errcode = '22023', message = 'PVP_INVALID_BATTLE_PAYLOAD';
  end if;

  if p_initial_snapshot #>> '{tactical,battle,battleId}' <> p_battle_id
    or (p_initial_snapshot #>> '{tactical,battle,rulesVersion}')::integer <> p_rules_version
    or (p_initial_snapshot #>> '{tactical,battle,contentVersion}')::integer <> p_content_version then
    raise exception using errcode = '22023', message = 'BATTLE_SNAPSHOT_IDENTITY_MISMATCH';
  end if;

  v_lifecycle := p_initial_snapshot #>> '{tactical,battle,lifecycle}';
  if v_lifecycle <> 'active' then
    raise exception using errcode = '22023', message = 'PVP_BATTLE_MUST_START_ACTIVE';
  end if;

  for v_participant in
    select * from jsonb_to_recordset(p_participants) as p(
      combatant_id text,
      user_id uuid,
      character_id uuid,
      team_index integer
    )
  loop
    v_participant_count := v_participant_count + 1;
    if not exists (
      select 1 from app_private.pvp_lobby_members m
      where m.lobby_id = p_lobby_id
        and m.user_id = v_participant.user_id
        and m.character_id = v_participant.character_id
        and m.team_index = v_participant.team_index
    ) then
      raise exception using errcode = '42501', message = 'PVP_PARTICIPANT_MISMATCH';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(p_initial_snapshot #> '{tactical,battle,combatants}') combatant
      where combatant ->> 'id' = v_participant.combatant_id
        and combatant ->> 'teamId' = 'team:' || v_participant.team_index::text
    ) then
      raise exception using errcode = '22023', message = 'PVP_PARTICIPANT_NOT_IN_SNAPSHOT';
    end if;
  end loop;

  if v_participant_count <> v_member_count then
    raise exception using errcode = '22023', message = 'PVP_PARTICIPANT_COVERAGE_INVALID';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_battle_key := app_private.pvp_key('AVB');
    exit when not exists (
      select 1 from app_private.pvp_lobbies l where l.battle_key = v_battle_key
    );
    if v_attempt >= 8 then
      raise exception using errcode = '23505', message = 'PVP_BATTLE_KEY_COLLISION';
    end if;
  end loop;

  insert into app_private.battle_sessions (
    id, owner_user_id, battle_id, rules_version, content_version,
    current_version, lifecycle, current_snapshot, created_at, updated_at
  ) values (
    v_session_id, v_lobby.owner_user_id, p_battle_id, p_rules_version, p_content_version,
    1, 'active', p_initial_snapshot, v_created_at, v_created_at
  );

  for v_participant in
    select * from jsonb_to_recordset(p_participants) as p(
      combatant_id text,
      user_id uuid,
      character_id uuid,
      team_index integer
    )
  loop
    insert into app_private.battle_participants (
      battle_session_id, combatant_id, participant_role, user_id, character_id
    ) values (
      v_session_id, v_participant.combatant_id, 'player',
      v_participant.user_id, v_participant.character_id
    );
  end loop;

  insert into app_private.battle_snapshots (
    battle_session_id, battle_version, snapshot, created_at
  ) values (v_session_id, 1, p_initial_snapshot, v_created_at);

  update app_private.pvp_lobbies
  set status = 'active', battle_session_id = v_session_id, battle_key = v_battle_key,
      updated_at = v_created_at
  where id = p_lobby_id;

  return query select v_session_id, 1::bigint, p_initial_snapshot, v_created_at, v_battle_key;
end;
$$;

create or replace function public.get_battle_session_v2(
  p_user_id uuid,
  p_battle_session_id uuid
)
returns table (
  battle_session_id uuid,
  battle_id text,
  battle_version bigint,
  rules_version integer,
  content_version integer,
  lifecycle text,
  snapshot jsonb,
  controlled_combatant_ids text[],
  updated_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, app_private
stable
as $$
  select
    s.id,
    s.battle_id,
    s.current_version,
    s.rules_version,
    s.content_version,
    s.lifecycle,
    s.current_snapshot,
    array(
      select p.combatant_id
      from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
      order by p.combatant_id
    ),
    s.updated_at
  from app_private.battle_sessions s
  where s.id = p_battle_session_id
    and exists (
      select 1 from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
    );
$$;

create or replace function public.commit_battle_intent_v2(
  p_actor_key text,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_user_id uuid,
  p_battle_session_id uuid,
  p_expected_battle_version bigint,
  p_next_snapshot jsonb,
  p_events jsonb
)
returns table (
  battle_session_id uuid,
  battle_version bigint,
  snapshot jsonb,
  committed_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_command_name constant text := 'battle.intent.v2';
  v_existing app_private.idempotency_records%rowtype;
  v_session app_private.battle_sessions%rowtype;
  v_next_version bigint;
  v_committed_at timestamptz := clock_timestamp();
  v_rows_inserted integer;
  v_lifecycle text;
begin
  if p_actor_key is null or char_length(p_actor_key) not between 1 and 160
    or p_request_fingerprint is null or char_length(p_request_fingerprint) not between 1 and 160
    or p_expected_battle_version is null or p_expected_battle_version < 1
    or p_expected_battle_version = 9223372036854775807
    or jsonb_typeof(p_next_snapshot) <> 'object'
    or jsonb_typeof(p_events) <> 'array' then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_INTENT_PAYLOAD';
  end if;

  v_next_version := p_expected_battle_version + 1;

  insert into app_private.idempotency_records (
    actor_key, command_name, idempotency_key, request_fingerprint, result
  ) values (
    p_actor_key, v_command_name, p_idempotency_key, p_request_fingerprint,
    jsonb_build_object(
      'battle_session_id', p_battle_session_id,
      'battle_version', v_next_version,
      'committed_at', v_committed_at
    )
  ) on conflict (actor_key, command_name, idempotency_key) do nothing;
  get diagnostics v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select * into v_existing
    from app_private.idempotency_records
    where actor_key = p_actor_key
      and command_name = v_command_name
      and idempotency_key = p_idempotency_key;
    if not found or v_existing.request_fingerprint <> p_request_fingerprint
      or (v_existing.result ->> 'battle_session_id')::uuid <> p_battle_session_id then
      raise exception using errcode = '22023', message = 'BATTLE_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      p_battle_session_id,
      (v_existing.result ->> 'battle_version')::bigint,
      snap.snapshot,
      (v_existing.result ->> 'committed_at')::timestamptz,
      true
    from app_private.battle_snapshots snap
    where snap.battle_session_id = p_battle_session_id
      and snap.battle_version = (v_existing.result ->> 'battle_version')::bigint
      and exists (
        select 1 from app_private.battle_participants p
        where p.battle_session_id = p_battle_session_id
          and p.user_id = p_user_id and p.participant_role = 'player'
      );
    if not found then
      raise exception using errcode = '42501', message = 'BATTLE_NOT_AVAILABLE';
    end if;
    return;
  end if;

  select s.* into v_session
  from app_private.battle_sessions s
  where s.id = p_battle_session_id
    and exists (
      select 1 from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id and p.participant_role = 'player'
    )
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'BATTLE_NOT_AVAILABLE';
  end if;
  if v_session.current_version <> p_expected_battle_version then
    raise exception using errcode = '40001',
      message = 'BATTLE_VERSION_STALE:' || v_session.current_version::text;
  end if;
  if p_next_snapshot #>> '{tactical,battle,battleId}' <> v_session.battle_id
    or (p_next_snapshot #>> '{tactical,battle,rulesVersion}')::integer <> v_session.rules_version
    or (p_next_snapshot #>> '{tactical,battle,contentVersion}')::integer <> v_session.content_version then
    raise exception using errcode = '22023', message = 'BATTLE_SNAPSHOT_IDENTITY_MISMATCH';
  end if;

  v_lifecycle := p_next_snapshot #>> '{tactical,battle,lifecycle}';
  if v_lifecycle not in ('pending', 'active', 'completed', 'abandoned') then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_LIFECYCLE';
  end if;

  update app_private.battle_sessions
  set current_version = v_next_version,
      lifecycle = v_lifecycle,
      current_snapshot = p_next_snapshot,
      updated_at = v_committed_at
  where id = p_battle_session_id;

  insert into app_private.battle_snapshots (
    battle_session_id, battle_version, snapshot, created_at
  ) values (p_battle_session_id, v_next_version, p_next_snapshot, v_committed_at);

  insert into app_private.battle_events (
    battle_session_id, battle_version, event_index, event, created_at
  )
  select p_battle_session_id, v_next_version, (row.ordinality - 1)::integer,
    row.value, v_committed_at
  from jsonb_array_elements(p_events) with ordinality as row(value, ordinality);

  if v_lifecycle = 'completed' then
    update app_private.pvp_lobbies l
    set status = 'completed', updated_at = v_committed_at
    where l.battle_session_id = p_battle_session_id and l.status = 'active';
  end if;

  return query select p_battle_session_id, v_next_version, p_next_snapshot, v_committed_at, false;
end;
$$;

create or replace function public.get_battle_events_v2(
  p_user_id uuid,
  p_battle_session_id uuid,
  p_limit integer
)
returns table (
  battle_version bigint,
  event_index integer,
  event jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, app_private
stable
as $$
  select e.battle_version, e.event_index, e.event, e.created_at
  from app_private.battle_events e
  where e.battle_session_id = p_battle_session_id
    and exists (
      select 1 from app_private.battle_participants p
      where p.battle_session_id = p_battle_session_id
        and p.user_id = p_user_id and p.participant_role = 'player'
    )
  order by e.battle_version desc, e.event_index desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

create or replace function public.get_pvp_battle_metadata_v1(
  p_user_id uuid,
  p_battle_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
stable
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from app_private.battle_participants p
    where p.battle_session_id = p_battle_session_id
      and p.user_id = p_user_id and p.participant_role = 'player'
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'lobby_id', l.id,
    'mode', l.mode,
    'battle_key', l.battle_key,
    'local_character_id', (
      select p.character_id from app_private.battle_participants p
      where p.battle_session_id = p_battle_session_id
        and p.user_id = p_user_id and p.participant_role = 'player'
      limit 1
    ),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'combatant_id', p.combatant_id,
        'character_id', p.character_id,
        'character_name', c.name,
        'character_level', c.level,
        'portrait_ref', c.portrait_ref,
        'team_index', m.team_index,
        'seat_index', m.seat_index
      ) order by m.team_index, m.seat_index)
      from app_private.battle_participants p
      join public.characters c on c.id = p.character_id
      join app_private.pvp_lobby_members m
        on m.lobby_id = l.id and m.character_id = p.character_id
      where p.battle_session_id = p_battle_session_id and p.participant_role = 'player'
    ), '[]'::jsonb)
  ) into v_result
  from app_private.pvp_lobbies l
  where l.battle_session_id = p_battle_session_id;

  return v_result;
end;
$$;

create or replace function public.get_pvp_spectator_view_v1(p_battle_key text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
stable
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'battle_session_id', s.id,
    'battle_version', s.current_version,
    'rules_version', s.rules_version,
    'content_version', s.content_version,
    'lifecycle', s.lifecycle,
    'snapshot', s.current_snapshot,
    'mode', l.mode,
    'battle_key', l.battle_key,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'combatant_id', p.combatant_id,
        'character_id', p.character_id,
        'character_name', c.name,
        'character_level', c.level,
        'portrait_ref', c.portrait_ref,
        'team_index', m.team_index,
        'seat_index', m.seat_index
      ) order by m.team_index, m.seat_index)
      from app_private.battle_participants p
      join public.characters c on c.id = p.character_id
      join app_private.pvp_lobby_members m
        on m.lobby_id = l.id and m.character_id = p.character_id
      where p.battle_session_id = s.id and p.participant_role = 'player'
    ), '[]'::jsonb)
  ) into v_result
  from app_private.pvp_lobbies l
  join app_private.battle_sessions s on s.id = l.battle_session_id
  where l.battle_key = upper(trim(p_battle_key))
    and l.status in ('active', 'completed');

  return v_result;
end;
$$;

revoke all on function public.create_pvp_lobby_v1(uuid, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.join_pvp_lobby_v1(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.set_pvp_lobby_ready_v1(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.leave_pvp_lobby_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_pvp_lobby_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_pvp_battle_session_v1(uuid, uuid, text, integer, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.get_battle_session_v2(uuid, uuid) from public, anon, authenticated;
revoke all on function public.commit_battle_intent_v2(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.get_battle_events_v2(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.get_pvp_battle_metadata_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_pvp_spectator_view_v1(text) from public, anon, authenticated;

grant execute on function public.create_pvp_lobby_v1(uuid, uuid, text, integer, integer) to service_role;
grant execute on function public.join_pvp_lobby_v1(uuid, uuid, text) to service_role;
grant execute on function public.set_pvp_lobby_ready_v1(uuid, uuid, boolean) to service_role;
grant execute on function public.leave_pvp_lobby_v1(uuid, uuid) to service_role;
grant execute on function public.get_pvp_lobby_v1(uuid, uuid) to service_role;
grant execute on function public.create_pvp_battle_session_v1(uuid, uuid, text, integer, integer, jsonb, jsonb) to service_role;
grant execute on function public.get_battle_session_v2(uuid, uuid) to service_role;
grant execute on function public.commit_battle_intent_v2(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb) to service_role;
grant execute on function public.get_battle_events_v2(uuid, uuid, integer) to service_role;
grant execute on function public.get_pvp_battle_metadata_v1(uuid, uuid) to service_role;
grant execute on function public.get_pvp_spectator_view_v1(text) to service_role;

commit;
