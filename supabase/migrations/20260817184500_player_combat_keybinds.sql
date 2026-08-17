begin;

alter table public.player_profiles
add column if not exists combat_keybinds jsonb not null default
'{"inspect":{"code":"Digit1","shift":false},"move":{"code":"Digit2","shift":false},"basicAttack":{"code":"Digit3","shift":false},"guard":{"code":"Digit4","shift":false},"endTurn":{"code":"Space","shift":false},"confirm":{"code":"Enter","shift":false},"cancel":{"code":"Escape","shift":false},"faceNorth":{"code":"KeyW","shift":false},"faceWest":{"code":"KeyA","shift":false},"faceSouth":{"code":"KeyS","shift":false},"faceEast":{"code":"KeyD","shift":false},"nextTarget":{"code":"Tab","shift":false},"previousTarget":{"code":"Tab","shift":true},"combatLog":{"code":"KeyL","shift":false}}'::jsonb;

alter table public.player_profiles
drop constraint if exists player_profiles_combat_keybinds_object;

alter table public.player_profiles
add constraint player_profiles_combat_keybinds_object
check (jsonb_typeof(combat_keybinds) = 'object');

comment on column public.player_profiles.combat_keybinds is
  'Validated account-level combat control preferences. They affect client input mapping only and never grant combat authority.';

revoke update (combat_keybinds) on public.player_profiles from public;
revoke update (combat_keybinds) on public.player_profiles from anon;
revoke update (combat_keybinds) on public.player_profiles from authenticated;

create or replace function public.save_player_combat_controls_v1(
  p_user_id uuid,
  p_combat_keybinds jsonb
)
returns table (
  user_id uuid,
  created_at timestamptz,
  combat_keybinds jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'player user id is required';
  end if;

  if p_combat_keybinds is null or jsonb_typeof(p_combat_keybinds) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'combat keybinds must be a JSON object';
  end if;

  update public.player_profiles as profile
  set combat_keybinds = p_combat_keybinds
  where profile.user_id = p_user_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PLAYER_PROFILE_UNAVAILABLE';
  end if;

  return query
  select
    profile.user_id,
    profile.created_at,
    profile.combat_keybinds
  from public.player_profiles as profile
  where profile.user_id = p_user_id;
end;
$$;

comment on function public.save_player_combat_controls_v1(uuid, jsonb) is
  'Persists server-validated account combat controls without exposing direct player_profiles mutation to browser roles.';

revoke all on function public.save_player_combat_controls_v1(uuid, jsonb) from public;
revoke all on function public.save_player_combat_controls_v1(uuid, jsonb) from anon;
revoke all on function public.save_player_combat_controls_v1(uuid, jsonb) from authenticated;
grant execute on function public.save_player_combat_controls_v1(uuid, jsonb) to service_role;

commit;
