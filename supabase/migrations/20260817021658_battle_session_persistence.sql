begin;

create table app_private.battle_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  battle_id text not null unique check (char_length(battle_id) between 1 and 160),
  rules_version integer not null check (rules_version > 0),
  content_version integer not null check (content_version > 0),
  current_version bigint not null default 1 check (current_version > 0),
  lifecycle text not null check (lifecycle in ('pending', 'active', 'completed', 'abandoned')),
  current_snapshot jsonb not null check (jsonb_typeof(current_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app_private.battle_sessions is
  'Private authoritative battle-session heads. Browser roles have no direct access.';

create index battle_sessions_owner_updated_idx
  on app_private.battle_sessions (owner_user_id, updated_at desc);

create table app_private.battle_participants (
  battle_session_id uuid not null references app_private.battle_sessions(id) on delete cascade,
  combatant_id text not null check (char_length(combatant_id) between 1 and 160),
  participant_role text not null check (participant_role in ('player', 'opponent')),
  user_id uuid references auth.users(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (battle_session_id, combatant_id),
  check (
    (participant_role = 'player' and user_id is not null and character_id is not null)
    or (participant_role = 'opponent' and user_id is null and character_id is null)
  )
);

comment on table app_private.battle_participants is
  'Private participant/ownership mapping for the controlled P2.4 PvE battle slice.';

create index battle_participants_user_session_idx
  on app_private.battle_participants (user_id, battle_session_id)
  where user_id is not null;

create unique index battle_participants_character_session_idx
  on app_private.battle_participants (battle_session_id, character_id)
  where character_id is not null;

create table app_private.battle_snapshots (
  battle_session_id uuid not null references app_private.battle_sessions(id) on delete cascade,
  battle_version bigint not null check (battle_version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  primary key (battle_session_id, battle_version)
);

comment on table app_private.battle_snapshots is
  'Immutable versioned authoritative combat snapshots for reconnect/replay diagnostics.';

create table app_private.battle_events (
  event_id uuid not null default gen_random_uuid(),
  battle_session_id uuid not null references app_private.battle_sessions(id) on delete cascade,
  battle_version bigint not null check (battle_version > 1),
  event_index integer not null check (event_index >= 0),
  event jsonb not null check (jsonb_typeof(event) = 'object'),
  created_at timestamptz not null default now(),
  primary key (battle_session_id, battle_version, event_index),
  unique (event_id),
  foreign key (battle_session_id, battle_version)
    references app_private.battle_snapshots(battle_session_id, battle_version)
    on delete cascade
);

comment on table app_private.battle_events is
  'Append-only durable combat events ordered within each committed battle version.';

revoke all on table app_private.battle_sessions from public, anon, authenticated;
revoke all on table app_private.battle_participants from public, anon, authenticated;
revoke all on table app_private.battle_snapshots from public, anon, authenticated;
revoke all on table app_private.battle_events from public, anon, authenticated;

create or replace function public.create_battle_session_v1(
  p_actor_key text,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_user_id uuid,
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
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
as $$
declare
  v_command_name constant text := 'battle.create.v1';
  v_session_id uuid := gen_random_uuid();
  v_created_at timestamptz := clock_timestamp();
  v_existing app_private.idempotency_records%rowtype;
  v_rows_inserted integer;
  v_participant record;
  v_participant_count integer := 0;
  v_player_count integer := 0;
  v_combatant_count integer;
  v_lifecycle text;
begin
  if p_actor_key is null or char_length(p_actor_key) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_ACTOR_KEY';
  end if;
  if p_request_fingerprint is null or char_length(p_request_fingerprint) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_REQUEST_FINGERPRINT';
  end if;
  if p_battle_id is null or char_length(p_battle_id) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_ID';
  end if;
  if p_rules_version is null or p_rules_version <= 0 or p_content_version is null or p_content_version <= 0 then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_VERSION_IDENTITY';
  end if;
  if jsonb_typeof(p_initial_snapshot) <> 'object' then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_INITIAL_SNAPSHOT';
  end if;
  if jsonb_typeof(p_participants) <> 'array' then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_PARTICIPANTS';
  end if;

  if p_initial_snapshot #>> '{tactical,battle,battleId}' <> p_battle_id
    or (p_initial_snapshot #>> '{tactical,battle,rulesVersion}')::integer <> p_rules_version
    or (p_initial_snapshot #>> '{tactical,battle,contentVersion}')::integer <> p_content_version then
    raise exception using errcode = '22023', message = 'BATTLE_SNAPSHOT_IDENTITY_MISMATCH';
  end if;

  v_lifecycle := p_initial_snapshot #>> '{tactical,battle,lifecycle}';
  if v_lifecycle not in ('pending', 'active', 'completed', 'abandoned') then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_LIFECYCLE';
  end if;

  if jsonb_typeof(p_initial_snapshot #> '{tactical,battle,combatants}') <> 'array' then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_COMBATANTS';
  end if;
  v_combatant_count := jsonb_array_length(p_initial_snapshot #> '{tactical,battle,combatants}');

  insert into app_private.idempotency_records (
    actor_key,
    command_name,
    idempotency_key,
    request_fingerprint,
    result
  )
  values (
    p_actor_key,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object(
      'battle_session_id', v_session_id,
      'battle_version', 1,
      'created_at', v_created_at
    )
  )
  on conflict (actor_key, command_name, idempotency_key) do nothing;

  get diagnostics v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select * into v_existing
    from app_private.idempotency_records
    where actor_key = p_actor_key
      and command_name = v_command_name
      and idempotency_key = p_idempotency_key;

    if not found then
      raise exception using errcode = '40001', message = 'BATTLE_IDEMPOTENCY_RECORD_UNAVAILABLE';
    end if;
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '22023', message = 'BATTLE_IDEMPOTENCY_CONFLICT';
    end if;

    v_session_id := (v_existing.result ->> 'battle_session_id')::uuid;
    return query
    select
      s.id,
      1::bigint,
      snap.snapshot,
      (v_existing.result ->> 'created_at')::timestamptz,
      true
    from app_private.battle_sessions s
    join app_private.battle_snapshots snap
      on snap.battle_session_id = s.id and snap.battle_version = 1
    where s.id = v_session_id and s.owner_user_id = p_user_id;

    if not found then
      raise exception using errcode = '42501', message = 'BATTLE_NOT_AVAILABLE';
    end if;
    return;
  end if;

  insert into app_private.battle_sessions (
    id,
    owner_user_id,
    battle_id,
    rules_version,
    content_version,
    current_version,
    lifecycle,
    current_snapshot,
    created_at,
    updated_at
  )
  values (
    v_session_id,
    p_user_id,
    p_battle_id,
    p_rules_version,
    p_content_version,
    1,
    v_lifecycle,
    p_initial_snapshot,
    v_created_at,
    v_created_at
  );

  for v_participant in
    select *
    from jsonb_to_recordset(p_participants) as p(
      combatant_id text,
      participant_role text,
      character_id uuid
    )
  loop
    v_participant_count := v_participant_count + 1;

    if v_participant.combatant_id is null
      or char_length(v_participant.combatant_id) not between 1 and 160
      or v_participant.participant_role not in ('player', 'opponent') then
      raise exception using errcode = '22023', message = 'BATTLE_INVALID_PARTICIPANT';
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(p_initial_snapshot #> '{tactical,battle,combatants}') as combatant
      where combatant ->> 'id' = v_participant.combatant_id
    ) then
      raise exception using errcode = '22023', message = 'BATTLE_PARTICIPANT_NOT_IN_SNAPSHOT';
    end if;

    if v_participant.participant_role = 'player' then
      v_player_count := v_player_count + 1;
      if v_participant.character_id is null or not exists (
        select 1 from public.characters c
        where c.id = v_participant.character_id and c.user_id = p_user_id
      ) then
        raise exception using errcode = '42501', message = 'BATTLE_CHARACTER_NOT_OWNED';
      end if;

      insert into app_private.battle_participants (
        battle_session_id,
        combatant_id,
        participant_role,
        user_id,
        character_id
      ) values (
        v_session_id,
        v_participant.combatant_id,
        'player',
        p_user_id,
        v_participant.character_id
      );
    else
      if v_participant.character_id is not null then
        raise exception using errcode = '22023', message = 'BATTLE_OPPONENT_CHARACTER_NOT_ALLOWED';
      end if;

      insert into app_private.battle_participants (
        battle_session_id,
        combatant_id,
        participant_role,
        user_id,
        character_id
      ) values (
        v_session_id,
        v_participant.combatant_id,
        'opponent',
        null,
        null
      );
    end if;
  end loop;

  if v_participant_count <> v_combatant_count or v_player_count < 1 then
    raise exception using errcode = '22023', message = 'BATTLE_PARTICIPANT_COVERAGE_INVALID';
  end if;

  insert into app_private.battle_snapshots (
    battle_session_id,
    battle_version,
    snapshot,
    created_at
  ) values (
    v_session_id,
    1,
    p_initial_snapshot,
    v_created_at
  );

  return query select v_session_id, 1::bigint, p_initial_snapshot, v_created_at, false;
end;
$$;

create or replace function public.get_battle_session_v1(
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
    s.updated_at
  from app_private.battle_sessions s
  where s.id = p_battle_session_id
    and s.owner_user_id = p_user_id
    and exists (
      select 1
      from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
    );
$$;

create or replace function public.commit_battle_intent_v1(
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
  v_command_name constant text := 'battle.intent.v1';
  v_existing app_private.idempotency_records%rowtype;
  v_session app_private.battle_sessions%rowtype;
  v_next_version bigint;
  v_committed_at timestamptz := clock_timestamp();
  v_rows_inserted integer;
  v_lifecycle text;
begin
  if p_actor_key is null or char_length(p_actor_key) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_ACTOR_KEY';
  end if;
  if p_request_fingerprint is null or char_length(p_request_fingerprint) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_REQUEST_FINGERPRINT';
  end if;
  if p_expected_battle_version is null or p_expected_battle_version < 1
    or p_expected_battle_version = 9223372036854775807 then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_EXPECTED_VERSION';
  end if;
  if jsonb_typeof(p_next_snapshot) <> 'object' then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_NEXT_SNAPSHOT';
  end if;
  if jsonb_typeof(p_events) <> 'array' then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_EVENTS';
  end if;

  v_next_version := p_expected_battle_version + 1;

  insert into app_private.idempotency_records (
    actor_key,
    command_name,
    idempotency_key,
    request_fingerprint,
    result
  ) values (
    p_actor_key,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object(
      'battle_session_id', p_battle_session_id,
      'battle_version', v_next_version,
      'committed_at', v_committed_at
    )
  )
  on conflict (actor_key, command_name, idempotency_key) do nothing;

  get diagnostics v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select * into v_existing
    from app_private.idempotency_records
    where actor_key = p_actor_key
      and command_name = v_command_name
      and idempotency_key = p_idempotency_key;

    if not found then
      raise exception using errcode = '40001', message = 'BATTLE_IDEMPOTENCY_RECORD_UNAVAILABLE';
    end if;
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '22023', message = 'BATTLE_IDEMPOTENCY_CONFLICT';
    end if;
    if (v_existing.result ->> 'battle_session_id')::uuid <> p_battle_session_id then
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
    join app_private.battle_sessions s on s.id = snap.battle_session_id
    where snap.battle_session_id = p_battle_session_id
      and snap.battle_version = (v_existing.result ->> 'battle_version')::bigint
      and s.owner_user_id = p_user_id;

    if not found then
      raise exception using errcode = '42501', message = 'BATTLE_NOT_AVAILABLE';
    end if;
    return;
  end if;

  select s.* into v_session
  from app_private.battle_sessions s
  where s.id = p_battle_session_id
    and s.owner_user_id = p_user_id
    and exists (
      select 1
      from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
    )
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'BATTLE_NOT_AVAILABLE';
  end if;

  if v_session.current_version <> p_expected_battle_version then
    raise exception using
      errcode = '40001',
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
    battle_session_id,
    battle_version,
    snapshot,
    created_at
  ) values (
    p_battle_session_id,
    v_next_version,
    p_next_snapshot,
    v_committed_at
  );

  insert into app_private.battle_events (
    battle_session_id,
    battle_version,
    event_index,
    event,
    created_at
  )
  select
    p_battle_session_id,
    v_next_version,
    (event_row.ordinality - 1)::integer,
    event_row.value,
    v_committed_at
  from jsonb_array_elements(p_events) with ordinality as event_row(value, ordinality);

  return query
  select p_battle_session_id, v_next_version, p_next_snapshot, v_committed_at, false;
end;
$$;

comment on function public.create_battle_session_v1(text, uuid, text, uuid, text, integer, integer, jsonb, jsonb) is
  'Creates the initial private P2.4 authoritative battle session with durable retry protection.';
comment on function public.get_battle_session_v1(uuid, uuid) is
  'Returns the latest reconnect-safe battle snapshot only to the server authority boundary.';
comment on function public.commit_battle_intent_v1(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb) is
  'Atomically commits one server-resolved battle intent using expected-version and idempotency guards.';

revoke all on function public.create_battle_session_v1(text, uuid, text, uuid, text, integer, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.get_battle_session_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.commit_battle_intent_v1(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb) from public, anon, authenticated;

grant execute on function public.create_battle_session_v1(text, uuid, text, uuid, text, integer, integer, jsonb, jsonb) to service_role;
grant execute on function public.get_battle_session_v1(uuid, uuid) to service_role;
grant execute on function public.commit_battle_intent_v1(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb) to service_role;

commit;
