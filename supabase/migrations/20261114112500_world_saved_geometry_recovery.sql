begin;

-- Release-specific account-locked repair of saved public positions caught
-- inside newly solid megastructure walls. Normal movement never uses this RPC.
-- Trusted server geometry chooses the nearest cell in the connected mainland.
create function public.recover_world_saved_geometry_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_expected_version bigint,
  p_from_sector_id text,
  p_from_x integer,
  p_from_y integer,
  p_to_sector_id text,
  p_to_x integer,
  p_to_y integer,
  p_to_safe boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_world app_private.character_world_state%rowtype;
  v_position jsonb;
  v_next jsonb;
  v_version bigint;
begin
  if p_character_id is null or p_expected_version is null or p_expected_version < 1
    or p_from_sector_id is null or p_to_sector_id is null
    or p_to_sector_id like 'void:%' or p_to_sector_id like 'uncharted-%'
    or p_to_sector_id like 'ferry:%'
    or p_to_safe is null
    or p_from_x not between 0 and 12 or p_from_y not between 0 and 8
    or p_to_x not between 0 and 12 or p_to_y not between 0 and 8
    or (p_from_sector_id = p_to_sector_id and p_from_x = p_to_x and p_from_y = p_to_y)
  then
    raise exception 'WORLD_GEOMETRY_RECOVERY_INVALID' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));
  perform 1 from public.characters c
    where c.id = p_character_id and c.user_id = p_user_id for update;
  if not found or exists (
    select 1 from app_private.character_deletion_requests d where d.character_id = p_character_id
  ) then
    raise exception 'WORLD_NOT_OWNED' using errcode = '42501';
  end if;
  select * into v_world from app_private.character_world_state w
    where w.character_id = p_character_id for update;
  if not found then raise exception 'WORLD_STATE_UNAVAILABLE'; end if;
  v_position := v_world.state->'position';
  v_version := (v_world.state->>'version')::bigint;
  if v_version is distinct from p_expected_version
    or v_position is distinct from jsonb_build_object(
      'sectorId', p_from_sector_id, 'x', p_from_x, 'y', p_from_y
    ) then
    raise exception 'WORLD_STALE_VERSION' using errcode = 'PT409';
  end if;
  if app_private.world_block_reason_v1(p_user_id, p_character_id) is not null
    or (v_world.state->'ferry' is not null and v_world.state->'ferry' <> 'null'::jsonb)
  then
    raise exception 'WORLD_RECOVERY_BUSY' using errcode = 'PT409';
  end if;
  v_next := v_world.state || jsonb_build_object(
    'position', jsonb_build_object(
      'sectorId', p_to_sector_id, 'x', p_to_x, 'y', p_to_y
    ),
    'version', v_version + 1,
    'route', '[]'::jsonb,
    'routeDestination', null,
    'routeObjectiveId', null,
    'nextStepAt', null,
    'safe', p_to_safe
  );
  update app_private.character_world_state w
    set state = v_next, last_command_id = null,
      last_command_fingerprint = null, last_seen_at = clock_timestamp()
    where w.character_id = p_character_id;
  return v_next;
end;
$$;

revoke all on function public.recover_world_saved_geometry_v1(
  uuid,uuid,bigint,text,integer,integer,text,integer,integer,boolean
) from public, anon, authenticated;
grant execute on function public.recover_world_saved_geometry_v1(
  uuid,uuid,bigint,text,integer,integer,text,integer,integer,boolean
) to service_role;

commit;
