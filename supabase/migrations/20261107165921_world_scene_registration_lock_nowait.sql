begin;

-- If a writer holds the character, the World view can read its scene without
-- registering for live presence. Keep the lock order for actual registration.
do $migration$
declare
  definition text := pg_get_functiondef('public.read_world_scene_players_v2(uuid,uuid,bigint,text[],jsonb)'::regprocedure);
  blocking_lock constant text := E'  for key share;\n';
begin
  if length(definition) - length(replace(definition, blocking_lock, '')) <> length(blocking_lock) then
    raise exception 'WORLD_SCENE_REGISTRATION_CHARACTER_LOCK_PREDECESSOR_MISSING';
  end if;
  execute replace(definition, blocking_lock, E'  for key share nowait;\n');
end;
$migration$;

commit;
