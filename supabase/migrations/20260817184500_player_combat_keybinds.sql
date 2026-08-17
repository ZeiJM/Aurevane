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

commit;
