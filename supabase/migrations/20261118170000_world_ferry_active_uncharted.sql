begin;

-- Existing shared passages retain their destination mode, including passengers
-- joining the same sailing after the migration.
alter table app_private.world_ferry_trips add column active_void boolean not null default false;

-- These are the authored refuge centers returned by server-side voidRealmLanding.
create function app_private.world_void_ferry_dock_v1(p_realm text) returns jsonb
language sql immutable strict set search_path = '' as $$
  select jsonb_build_object('sectorId', 'void:' || p_realm || ':' || location, 'x', 6, 'y', 4)
  from (values
    ('ivory-veil', '3:12'),
    ('amber-drowned', '4:11'),
    ('cinder-choir', '4:13'),
    ('glass-tides', '3:11'),
    ('hollow-orchard', '3:12'),
    ('starfall-basin', '3:12'),
    ('violet-estuary', '3:13'),
    ('clockwound-waste', '3:12')
  ) as docks(realm, location)
  where realm = p_realm;
$$;

create function app_private.world_void_ferry_fallback_v1() returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('sectorId', 'umbral-march', 'x', 6, 'y', 4);
$$;

revoke all on function app_private.world_void_ferry_dock_v1(text),
  app_private.world_void_ferry_fallback_v1() from public, anon, authenticated, service_role;

-- Cancelling a return passage restores the origin's pinned evacuation deadline.
do $migration$
declare
  definition text := pg_get_functiondef('app_private.world_void_mark_state_v1()'::regprocedure);
  predecessor text := 'v_return_at := v_cutoff;';
begin
  if strpos(definition, predecessor) = 0 then raise exception 'WORLD_VOID_FERRY_PREDECESSOR'; end if;
  execute replace(definition, predecessor, $replacement$v_return_at := least(
      v_cutoff,
      case when tg_op = 'UPDATE' and old.state#>'{ferry,origin}' = new.state->'position'
        then (old.state#>>'{ferry,originVoidReturnAt}')::bigint end
    );$replacement$);
end;
$migration$;

create or replace function public.commit_world_ferry_v1(
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
  v_active_void boolean;
  v_origin jsonb;
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

  v_trip := v_world.state->'ferry';
  v_position := v_world.state->'position';
  if app_private.world_void_private_sector_v1(
    coalesce(v_trip#>>'{origin,sectorId}', v_position->>'sectorId')
  ) then
    perform pg_advisory_xact_lock_shared(hashtextextended('world-environment', 0));
  end if;
  v_now := app_private.world_ferry_now_v1();
  if p_kind = 'leave-ferry' then
    if v_trip is null or v_now >= (v_trip->>'departureAt')::bigint then
      raise exception 'WORLD_FERRY_UNDERWAY' using errcode = '22023';
    end if;
    v_origin := v_trip->'origin';
    if app_private.world_void_return_due_v1(
      v_world.state || jsonb_build_object(
        'position', v_origin, 'voidReturnAt', v_trip->'originVoidReturnAt',
        'voidEntryRealm', v_trip->'originVoidEntryRealm'
      ), v_now
    ) then
      v_origin := app_private.world_void_ferry_fallback_v1();
      v_world.state := v_world.state - 'warpedPhase';
    end if;
    v_state := app_private.world_ferry_relocate_v1(v_world.state, v_origin, p_expected_version);
  else
    if v_trip is not null or jsonb_array_length(coalesce(v_world.state->'route', '[]'::jsonb)) <> 0
      or abs((v_position->>'x')::integer - 6) + abs((v_position->>'y')::integer - 4) > 1 then
      raise exception 'WORLD_FERRY_PORT' using errcode = '22023';
    end if;
    if v_position->>'sectorId' = 'atlas:126:32' then
      v_direction := 'outbound';
      v_offset := 0;
    elsif v_position->>'sectorId' = 'uncharted-landing'
      or v_position->>'sectorId' = app_private.world_void_ferry_dock_v1(
        split_part(v_position->>'sectorId', ':', 2)
      )->>'sectorId' then
      if app_private.world_void_return_due_v1(v_world.state, v_now) then
        raise exception 'WORLD_VOID_RETURN_DUE' using errcode = 'PT409';
      end if;
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
    insert into app_private.world_ferry_trips(direction, departure_at, warped_phase, active_void)
      values (v_direction, v_departure, v_warped_phase, v_direction = 'outbound')
      on conflict do nothing;
    select t.warped_phase, t.active_void into v_warped_phase, v_active_void
      from app_private.world_ferry_trips t
      where t.direction = v_direction and t.departure_at = v_departure;
    v_state := app_private.world_ferry_relocate_v1(
      v_world.state, jsonb_build_object(
        'sectorId', 'ferry:' || v_direction || ':' || v_departure,
        'x', 6, 'y', 4
      ), p_expected_version
    ) || jsonb_build_object('ferry', jsonb_build_object(
      'direction', v_direction, 'departureAt', v_departure, 'arrivalAt', v_departure + 300000,
      'origin', v_position, 'warpedPhase', v_warped_phase, 'activeVoid', v_active_void,
      'originVoidReturnAt', v_world.state->'voidReturnAt',
      'originVoidEntryRealm', v_world.state->'voidEntryRealm'
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

create or replace function app_private.settle_world_ferry_v1(p_user_id uuid, p_character_id uuid) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_state jsonb;
  v_trip jsonb;
  v_dock jsonb;
  v_phase bigint;
  v_rotation jsonb;
  v_discoveries jsonb;
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
  perform pg_advisory_xact_lock_shared(hashtextextended('world-environment', 0));
  v_now := app_private.world_ferry_now_v1();
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
  if v_trip->>'direction' = 'outbound' and coalesce((v_trip->>'activeVoid')::boolean, false) then
    v_rotation := app_private.world_void_rotation_v1(v_now);
    v_dock := app_private.world_void_ferry_dock_v1(v_rotation->>'realmId');

    -- A passenger reconnecting after the scheduled arrival's rotation has
    -- passed must not start a new expedition by reopening an expired trip.
    if v_dock is null
      or v_now >= (v_rotation->>'nextRollAt')::bigint - 60000
      or (app_private.world_void_rotation_v1((v_trip->>'arrivalAt')::bigint)->>'nextRollAt')
         is distinct from v_rotation->>'nextRollAt' then
      v_state := jsonb_set(v_state, '{position}', app_private.world_void_ferry_fallback_v1());
    else
      v_state := jsonb_set(v_state, '{position}', v_dock);
      -- Same radius-two discovery as ordinary arrival, scoped to this refuge.
      select jsonb_agg(cell order by cell) into v_discoveries
      from (
        select value::integer cell from jsonb_array_elements_text(
          coalesce(v_state#>array['discoveries', v_dock->>'sectorId'], '[]'::jsonb)
        )
        union
        select y * 13 + x from generate_series(2, 6) y cross join generate_series(4, 8) x
      ) known;
      v_state := v_state || jsonb_build_object('discoveries',
        coalesce(v_state->'discoveries', '{}'::jsonb)
        || jsonb_build_object(v_dock->>'sectorId', v_discoveries)
      );
    end if;
  elsif v_trip->>'direction' = 'outbound' then
    v_state := v_state || jsonb_build_object('warpedPhase', v_trip->'warpedPhase');
  end if;
  update app_private.character_world_state w set state = v_state, last_seen_at = clock_timestamp()
    where w.character_id = p_character_id;
end;
$$;

commit;
