begin;

-- Server-projected subscriptions only. Browsers cannot register scenes or read this table.
create table app_private.world_scene_subscriptions (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  registered_version bigint not null check (registered_version > 0),
  scene_sector_ids text[] not null check (
    cardinality(scene_sector_ids) between 1 and 25
    and array_ndims(scene_sector_ids) = 1
    and array_position(scene_sector_ids, null) is null
  ),
  initial_position jsonb not null check (jsonb_typeof(initial_position) = 'object'),
  expires_at timestamptz not null
);
create index world_scene_subscriptions_owner_expiry_idx
  on app_private.world_scene_subscriptions(user_id, expires_at);
alter table app_private.world_scene_subscriptions enable row level security;
revoke all on app_private.world_scene_subscriptions from public, anon, authenticated, service_role;

create function public.read_world_scene_players_v2(
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
  v_ids text[];
  v_now timestamptz;
  v_clock bigint;
begin
  -- Preserve character -> world lock order; hold the matching state through registration.
  perform 1 from public.characters c
  where c.id = p_character_id and c.user_id = p_user_id
    and not exists (select 1 from app_private.character_deletion_requests d where d.character_id = c.id)
  for key share;
  if not found then raise exception 'WORLD_NOT_OWNED' using errcode = '42501'; end if;
  select w.state into v_state from app_private.character_world_state w
  where w.character_id = p_character_id for share;
  if v_state is null then raise exception 'WORLD_NOT_OWNED' using errcode = '42501'; end if;
  if p_scene_sector_ids is null or cardinality(p_scene_sector_ids) not between 1 and 25
    or array_ndims(p_scene_sector_ids) <> 1
    or exists (select 1 from unnest(p_scene_sector_ids) s(id) where id is null or length(id) not between 1 and 200)
    or p_initial_position is null or jsonb_typeof(p_initial_position) <> 'object' then
    raise exception 'WORLD_INVALID_SCENE' using errcode = '22023';
  end if;
  v_now := clock_timestamp();
  v_clock := floor(extract(epoch from v_now) * 1000);
  if p_expected_version is null or (v_state->>'version')::bigint <> p_expected_version then
    return jsonb_build_object('version', (v_state->>'version')::bigint, 'serverNow', v_clock, 'players', '[]'::jsonb);
  end if;
  select array_agg(id order by id) into v_ids from (select distinct id from unnest(p_scene_sector_ids) s(id)) q;
  insert into app_private.world_scene_subscriptions as registration(character_id, user_id, registered_version, scene_sector_ids, initial_position, expires_at)
  values(p_character_id, p_user_id, p_expected_version, v_ids, p_initial_position, v_now + interval '2 minutes')
  on conflict(character_id) do update
    set user_id = excluded.user_id, registered_version = excluded.registered_version,
        scene_sector_ids = excluded.scene_sector_ids,
        initial_position = excluded.initial_position, expires_at = excluded.expires_at
    where registration.user_id is distinct from excluded.user_id
      or registration.registered_version is distinct from excluded.registered_version
      or registration.scene_sector_ids is distinct from excluded.scene_sector_ids
      or registration.initial_position is distinct from excluded.initial_position
      or registration.expires_at < v_now + interval '80 seconds';

  -- This service-only result is filtered against the owner's known, supplied terrain by
  -- the server before serialization. Never include destinations, discoveries or route tails.
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
      ) || case when w.character_id is null then '{}'::jsonb else jsonb_build_object(
        'movement', jsonb_build_object(
          'version', (w.state->>'version')::bigint, 'serverNow', v_clock,
          'nextStepAt', w.state->'nextStepAt',
          'route', (select coalesce(jsonb_agg(step order by ord), '[]'::jsonb)
            from jsonb_array_elements(w.state->'route') with ordinality as r(step, ord) where ord <= 12)
        )
      ) end as payload
    from public.characters c
    left join app_private.character_world_state w on w.character_id = c.id
    where coalesce(w.sector_id, p_initial_position->>'sectorId') = any(v_ids)
      and (coalesce((w.state->>'safe')::boolean, true)
        or (w.character_id is not null and w.last_seen_at > v_now - interval '10 minutes'))
      and c.user_id <> p_user_id
      and not exists (select 1 from app_private.character_deletion_requests d where d.character_id = c.id)
    order by online desc, c.level desc, c.name, c.id
    limit 200
  ) q;
  return jsonb_build_object('version', p_expected_version, 'serverNow', v_clock, 'players', v_players);
end;
$$;
revoke all on function public.read_world_scene_players_v2(uuid, uuid, bigint, text[], jsonb)
  from public, anon, authenticated;
grant execute on function public.read_world_scene_players_v2(uuid, uuid, bigint, text[], jsonb)
  to service_role;

create function public.read_world_live_players_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
as $$
declare
  v_state jsonb;
  v_registration app_private.world_scene_subscriptions%rowtype;
  v_scene jsonb;
begin
  perform 1 from public.characters c
  where c.id = p_character_id and c.user_id = p_user_id
    and not exists (select 1 from app_private.character_deletion_requests d where d.character_id = c.id)
  for key share;
  if not found then raise exception 'WORLD_NOT_OWNED' using errcode = '42501'; end if;
  select w.state into v_state from app_private.character_world_state w
  where w.character_id = p_character_id for share;
  if v_state is null then raise exception 'WORLD_NOT_OWNED' using errcode = '42501'; end if;
  select * into v_registration from app_private.world_scene_subscriptions s
  where s.character_id = p_character_id and s.user_id = p_user_id and s.expires_at > clock_timestamp()
    and s.registered_version = (v_state->>'version')::bigint;
  if not found or p_expected_version is null or (v_state->>'version')::bigint <> p_expected_version then
    return jsonb_build_object(
      'version', (v_state->>'version')::bigint, 'serverNow', floor(extract(epoch from clock_timestamp()) * 1000),
      'state', v_state, 'sceneSectorIds', '[]'::jsonb, 'players', '[]'::jsonb, 'registered', false
    );
  end if;
  -- There is deliberately no sector argument. Only the service-registered scene can be read.
  v_scene := public.read_world_scene_players_v2(p_user_id, p_character_id, p_expected_version,
    v_registration.scene_sector_ids, v_registration.initial_position);
  return v_scene || jsonb_build_object(
    'state', v_state, 'sceneSectorIds', to_jsonb(v_registration.scene_sector_ids), 'registered', true
  );
end;
$$;
revoke all on function public.read_world_live_players_v1(uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.read_world_live_players_v1(uuid, uuid, bigint)
  to service_role;

create function public.can_receive_world_scene_v1(p_topic text)
returns boolean
language sql
security definer
set search_path = pg_catalog, app_private, public
as $$
  select exists (
    select 1 from app_private.world_scene_subscriptions s
    join public.characters c on c.id = s.character_id and c.user_id = s.user_id
    join app_private.character_world_state w on w.character_id = s.character_id
      and (w.state->>'version')::bigint = s.registered_version
    where s.user_id = (select auth.uid()) and s.expires_at > clock_timestamp()
      and not exists (select 1 from app_private.character_deletion_requests d where d.character_id = c.id)
      and p_topic = any(array(select 'world-scene:' || id from unnest(s.scene_sector_ids) scene(id)))
  );
$$;
revoke all on function public.can_receive_world_scene_v1(text) from public, anon, authenticated;
grant execute on function public.can_receive_world_scene_v1(text) to authenticated;

-- Supabase caches channel receive authorization at join/JWT refresh. Every live presence
-- read still rechecks current ownership, expiry and version; notifications carry no state.
create policy world_scene_receive_v1 on realtime.messages
for select to authenticated
using (
  extension = 'broadcast' and topic = (select realtime.topic())
  and public.can_receive_world_scene_v1((select realtime.topic()))
);
-- No INSERT policy: authenticated browsers cannot publish World scene invalidations.

create function app_private.broadcast_world_scene_change_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare v_sector text;
begin
  if old.state->'version' is not distinct from new.state->'version' then return null; end if;
  for v_sector in
    select distinct sector_id from (values(old.sector_id), (new.sector_id)) sectors(sector_id)
    where sector_id is not null
  loop
    perform realtime.send('{}'::jsonb, 'changed', 'world-scene:' || v_sector, true);
  end loop;
  return null;
end;
$$;
revoke all on function app_private.broadcast_world_scene_change_v1() from public, anon, authenticated, service_role;
create trigger world_scene_changed_v1
after update of state on app_private.character_world_state
for each row
when (old.state->'version' is distinct from new.state->'version')
execute function app_private.broadcast_world_scene_change_v1();

commit;
