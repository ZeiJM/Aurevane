-- Owner-approved October12 scene-presence read. Existing travel/encounter authority is unchanged.
create function public.read_world_scene_players_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_expected_version bigint,
  p_scene_sector_ids text[],
  p_initial_position jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
as $$
declare
  v_state jsonb;
  v_players jsonb;
  v_now timestamptz := clock_timestamp();
begin
  -- This is the existing service-only authority channel, never a browser RPC.
  select w.state into v_state
  from app_private.character_world_state w
  join public.characters c on c.id = w.character_id
  where c.id = p_character_id and c.user_id = p_user_id
    and not exists (select 1 from app_private.character_deletion_requests d where d.character_id = c.id);
  if v_state is null then
    raise exception 'WORLD_NOT_OWNED' using errcode = '42501';
  end if;
  if p_scene_sector_ids is null or cardinality(p_scene_sector_ids) not between 1 and 25
    or exists (select 1 from unnest(p_scene_sector_ids) s(id) where id is null or length(id) not between 1 and 200)
    or p_initial_position is null or jsonb_typeof(p_initial_position) <> 'object' then
    raise exception 'WORLD_INVALID_SCENE' using errcode = '22023';
  end if;
  -- A concurrent command must not attach a different scene's presence to an old view.
  if p_expected_version is null or (v_state->>'version')::bigint <> p_expected_version then
    return jsonb_build_object('version', (v_state->>'version')::bigint, 'players', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(q.payload order by q.online desc, q.lvl desc, q.nm, q.cid), '[]'::jsonb)
  into v_players from (
    select c.id as cid, c.name as nm, c.level as lvl,
      (w.character_id is not null and w.last_seen_at > v_now - interval '40 seconds') as online,
      jsonb_build_object(
        'characterId', c.id, 'name', c.name, 'level', c.level,
        'portraitRef', c.portrait_ref, 'imageUrl', null,
        'position', coalesce(w.state->'position', p_initial_position),
        'online', (w.character_id is not null and w.last_seen_at > v_now - interval '40 seconds'),
        'attackable', (w.character_id is not null and w.last_seen_at > v_now - interval '40 seconds'
          and app_private.world_block_reason_v1(c.user_id, c.id) is null)
      ) as payload
    from public.characters c
    left join app_private.character_world_state w on w.character_id = c.id
    where coalesce(w.sector_id, p_initial_position->>'sectorId') = any(p_scene_sector_ids)
      and (coalesce((w.state->>'safe')::boolean, true)
        or (w.character_id is not null and w.last_seen_at > v_now - interval '10 minutes'))
      and c.user_id <> p_user_id
      and not exists (select 1 from app_private.character_deletion_requests d where d.character_id = c.id)
    order by online desc, c.level desc, c.name, c.id
    limit 200
  ) q;
  return jsonb_build_object('version', p_expected_version, 'players', v_players);
end;
$$;
revoke all on function public.read_world_scene_players_v1(uuid, uuid, bigint, text[], jsonb)
  from public, anon, authenticated;
grant execute on function public.read_world_scene_players_v1(uuid, uuid, bigint, text[], jsonb)
  to service_role;
