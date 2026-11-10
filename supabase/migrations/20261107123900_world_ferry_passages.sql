begin;

create table app_private.world_ferry_trips (
  direction text not null check (direction in ('outbound', 'return')),
  departure_at bigint not null,
  warped_phase bigint,
  primary key (direction, departure_at)
);
alter table app_private.world_ferry_trips enable row level security;
revoke all on app_private.world_ferry_trips from public, anon, authenticated, service_role;

create table app_private.world_ferry_receipts (
  character_id uuid not null references public.characters(id) on delete cascade,
  command_id uuid not null,
  request_fingerprint text not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (character_id, command_id)
);
alter table app_private.world_ferry_receipts enable row level security;
revoke all on app_private.world_ferry_receipts from public, anon, authenticated, service_role;

create function app_private.world_ferry_now_v1() returns bigint
language sql volatile
set search_path = ''
as $$
  select floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

create function app_private.world_warped_phase_v1(p_at_ms bigint) returns bigint
language sql stable
set search_path = ''
as $$
  select p_at_ms / (
    coalesce(
      (select (to_jsonb(s)->>'warped_shift_minutes')::integer
       from app_private.world_environment_settings s),
      1440
    )::bigint * 60000
  );
$$;

create function app_private.world_ferry_dock_v1(p_port text) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'sectorId', case p_port when 'mainland' then 'atlas:126:32' else 'uncharted-landing' end,
    'x', 6, 'y', 4
  );
$$;

create function app_private.world_ferry_relocate_v1(
  p_state jsonb, p_position jsonb, p_version bigint
) returns jsonb
language sql immutable
set search_path = ''
as $$
  select (p_state - 'ferry') || jsonb_build_object(
    'position', p_position, 'version', p_version + 1, 'safe', true,
    'route', '[]'::jsonb, 'routeDestination', null, 'routeObjectiveId', null,
    'nextStepAt', null
  );
$$;

-- The service enters the same lock order used by walking and battle admission.
-- The clock, station, direction, destination and fare are never client parameters.
create function public.commit_world_ferry_v1(
  p_user_id uuid, p_character_id uuid, p_expected_version bigint, p_command_id uuid,
  p_kind text, p_request_fingerprint text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_world app_private.character_world_state%rowtype;
  v_state jsonb;
  v_position jsonb;
  v_trip jsonb;
  v_receipt text;
  v_block text;
  v_now bigint;
  v_direction text;
  v_offset bigint;
  v_departure bigint;
  v_warped_phase bigint;
begin
  if p_command_id is null or p_request_fingerprint is null or
     p_kind is null or p_kind not in ('board-ferry', 'leave-ferry') then
    raise exception 'WORLD_INVALID_COMMAND' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));
  perform 1 from public.characters c where c.user_id = p_user_id and c.id = p_character_id
    for update;
  if not found or exists (
    select 1 from app_private.character_deletion_requests d where d.character_id = p_character_id
  ) then
    raise exception 'WORLD_NOT_OWNED' using errcode = '42501';
  end if;

  select * into v_world from app_private.character_world_state w
    where w.character_id = p_character_id for update;
  if not found then raise exception 'WORLD_STATE_UNAVAILABLE'; end if;

  select r.request_fingerprint into v_receipt from app_private.world_ferry_receipts r
    where r.character_id = p_character_id and r.command_id = p_command_id;
  if found then
    if v_receipt is distinct from p_request_fingerprint then
      raise exception 'WORLD_COMMAND_CONFLICT' using errcode = '22023';
    end if;
    return v_world.state;
  end if;
  if v_world.last_command_id = p_command_id then
    raise exception 'WORLD_COMMAND_CONFLICT' using errcode = '22023';
  end if;
  if (v_world.state->>'version')::bigint is distinct from p_expected_version then
    raise exception 'WORLD_STALE_VERSION' using errcode = 'PT409';
  end if;
  v_block := app_private.world_block_reason_v1(p_user_id, p_character_id);
  if v_block is not null then raise exception '%', v_block using errcode = '22023'; end if;

  v_now := app_private.world_ferry_now_v1();
  v_trip := v_world.state->'ferry';
  if p_kind = 'leave-ferry' then
    if v_trip is null or v_now >= (v_trip->>'departureAt')::bigint then
      raise exception 'WORLD_FERRY_UNDERWAY' using errcode = '22023';
    end if;
    v_state := app_private.world_ferry_relocate_v1(
      v_world.state, v_trip->'origin', p_expected_version
    );
  else
    v_position := v_world.state->'position';
    if v_trip is not null or jsonb_array_length(coalesce(v_world.state->'route', '[]'::jsonb)) <> 0
      or abs((v_position->>'x')::integer - 6) + abs((v_position->>'y')::integer - 4) > 1 then
      raise exception 'WORLD_FERRY_PORT' using errcode = '22023';
    end if;
    if v_position->>'sectorId' = 'atlas:126:32' then
      v_direction := 'outbound';
      v_offset := 0;
    elsif v_position->>'sectorId' = 'uncharted-landing' then
      v_direction := 'return';
      v_offset := 1800000;
    else
      raise exception 'WORLD_FERRY_PORT' using errcode = '22023';
    end if;

    v_departure := ((v_now - v_offset) / 3600000 + 1) * 3600000 + v_offset;
    if v_now < v_departure - 300000 then
      raise exception 'WORLD_FERRY_WINDOW' using errcode = '22023';
    end if;
    if v_direction = 'outbound' then
      v_warped_phase := app_private.world_warped_phase_v1(v_departure + 300000);
    end if;
    delete from app_private.world_ferry_trips t where t.departure_at < v_now - 604800000;
    insert into app_private.world_ferry_trips(direction, departure_at, warped_phase)
      values (v_direction, v_departure, v_warped_phase) on conflict do nothing;
    select t.warped_phase into v_warped_phase from app_private.world_ferry_trips t
      where t.direction = v_direction and t.departure_at = v_departure;
    v_state := app_private.world_ferry_relocate_v1(
      v_world.state, jsonb_build_object(
        'sectorId', 'ferry:' || v_direction || ':' || v_departure,
        'x', 6, 'y', 4
      ), p_expected_version
    ) || jsonb_build_object('ferry', jsonb_build_object(
      'direction', v_direction, 'departureAt', v_departure, 'arrivalAt', v_departure + 300000,
      'origin', v_position, 'warpedPhase', v_warped_phase
    ));
  end if;

  update app_private.character_world_state w
    set state = v_state, last_command_id = p_command_id,
      last_command_fingerprint = p_request_fingerprint, last_seen_at = clock_timestamp()
    where w.character_id = p_character_id;
  delete from app_private.world_ferry_receipts r
    where r.character_id = p_character_id and r.created_at < clock_timestamp() - interval '7 days';
  insert into app_private.world_ferry_receipts(character_id, command_id, request_fingerprint)
    values (p_character_id, p_command_id, p_request_fingerprint);
  return v_state;
end;
$$;

create function app_private.settle_world_ferry_v1(p_user_id uuid, p_character_id uuid) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_state jsonb;
  v_trip jsonb;
  v_dock jsonb;
  v_phase bigint;
  v_now bigint := app_private.world_ferry_now_v1();
begin
  -- Ordinary reads and unarrived sailings take no ferry mutation lock.
  -- The stable landing can adopt a new phase once the explorer has stopped there.
  if not exists (
    select 1 from app_private.character_world_state w
    join public.characters c on c.id = w.character_id
    where c.id = p_character_id and c.user_id = p_user_id
      and (
        (w.state#>>'{ferry,arrivalAt}')::bigint <= v_now
        or (
          w.state->'position' = app_private.world_ferry_dock_v1('uncharted')
          and jsonb_array_length(coalesce(w.state->'route', '[]'::jsonb)) = 0
          and (w.state->>'warpedPhase')::bigint is distinct from app_private.world_warped_phase_v1(v_now)
        )
      )
  ) then return; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));
  perform 1 from public.characters c where c.user_id = p_user_id and c.id = p_character_id
    for update;
  if not found or exists (
    select 1 from app_private.character_deletion_requests d where d.character_id = p_character_id
  ) then return; end if;
  select w.state into v_state from app_private.character_world_state w
    where w.character_id = p_character_id for update;

  if v_state is null or app_private.world_block_reason_v1(p_user_id, p_character_id) is not null then
    return;
  end if;
  v_trip := v_state->'ferry';
  if v_trip is null then
    if v_state->'position' = app_private.world_ferry_dock_v1('uncharted')
      and jsonb_array_length(coalesce(v_state->'route', '[]'::jsonb)) = 0 then
      v_phase := app_private.world_warped_phase_v1(v_now);
      if (v_state->>'warpedPhase')::bigint is distinct from v_phase then
        update app_private.character_world_state w
          set state = v_state || jsonb_build_object(
            'warpedPhase', v_phase, 'version', (v_state->>'version')::bigint + 1
          )
          where w.character_id = p_character_id;
      end if;
    end if;
    return;
  end if;
  if (v_trip->>'arrivalAt')::bigint > v_now then return; end if;
  v_dock := app_private.world_ferry_dock_v1(
    case v_trip->>'direction' when 'outbound' then 'uncharted' else 'mainland' end
  );
  v_state := app_private.world_ferry_relocate_v1(v_state - 'warpedPhase', v_dock, (v_state->>'version')::bigint);
  if v_trip->>'direction' = 'outbound' then
    v_state := v_state || jsonb_build_object('warpedPhase', v_trip->'warpedPhase');
  end if;
  update app_private.character_world_state w set state = v_state, last_seen_at = clock_timestamp()
    where w.character_id = p_character_id;
end;
$$;

-- Reconnect and the first world action after an arrival use the same recovery path.
alter function public.read_world_state_v1(uuid, uuid, jsonb) rename to read_world_state_before_ferry_v1;
revoke all on function public.read_world_state_before_ferry_v1(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
create function public.read_world_state_v1(p_user_id uuid, p_character_id uuid, p_initial_state jsonb)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
begin
  perform app_private.settle_world_ferry_v1(p_user_id, p_character_id);
  return public.read_world_state_before_ferry_v1(p_user_id, p_character_id, p_initial_state);
end;
$$;

revoke all on function app_private.world_ferry_now_v1() from public, anon, authenticated, service_role;
revoke all on function app_private.world_warped_phase_v1(bigint) from public, anon, authenticated, service_role;
revoke all on function app_private.world_ferry_dock_v1(text) from public, anon, authenticated, service_role;
revoke all on function app_private.world_ferry_relocate_v1(jsonb, jsonb, bigint) from public, anon, authenticated, service_role;
revoke all on function app_private.settle_world_ferry_v1(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.commit_world_ferry_v1(uuid, uuid, bigint, uuid, text, text) from public, anon, authenticated;
grant execute on function public.commit_world_ferry_v1(uuid, uuid, bigint, uuid, text, text) to service_role;
revoke all on function public.read_world_state_v1(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.read_world_state_v1(uuid, uuid, jsonb) to service_role;
commit;
