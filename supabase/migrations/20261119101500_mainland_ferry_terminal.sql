begin;

-- New mainland departures and arrivals use the dry south shore. Existing
-- passenger origins, the timetable and saved World positions are left intact.
create or replace function app_private.world_ferry_dock_v1(p_port text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'sectorId', case p_port when 'mainland' then 'atlas:126:33' else 'uncharted-landing' end,
    'x', 6, 'y', case p_port when 'mainland' then 8 else 4 end
  );
$$;

do $migration$
declare
  definition text := pg_get_functiondef('public.commit_world_ferry_v1(uuid,uuid,bigint,uuid,text,text)'::regprocedure);
  predecessor constant text := $before$      or abs((v_position->>'x')::integer - 6) + abs((v_position->>'y')::integer - 4) > 1 then
      raise exception 'WORLD_FERRY_PORT' using errcode = '22023';
    end if;
    if v_position->>'sectorId' = 'atlas:126:32' then$before$;
  replacement constant text := $after$      then
      raise exception 'WORLD_FERRY_PORT' using errcode = '22023';
    end if;
    if abs((v_position->>'x')::integer - 6) + abs((v_position->>'y')::integer -
      case when v_position->>'sectorId' = app_private.world_ferry_dock_v1('mainland')->>'sectorId'
        then (app_private.world_ferry_dock_v1('mainland')->>'y')::integer else 4 end
    ) > 1 then
      raise exception 'WORLD_FERRY_PORT' using errcode = '22023';
    end if;
    if v_position->>'sectorId' = app_private.world_ferry_dock_v1('mainland')->>'sectorId' then$after$;
begin
  if length(definition) - length(replace(definition, predecessor, '')) <> length(predecessor) then
    raise exception 'WORLD_FERRY_TERMINAL_PREDECESSOR';
  end if;
  execute replace(definition, predecessor, replacement);
end;
$migration$;

commit;
