begin;

-- Coordinates mirror voidRealmFerryDock. Existing refuge terrain and saved positions stay intact.
create or replace function app_private.world_void_ferry_dock_v1(p_realm text) returns jsonb
language sql immutable strict set search_path = '' as $$
  select jsonb_build_object('sectorId', 'void:' || p_realm || ':' || location, 'x', dock_x, 'y', dock_y)
  from (values
    ('ivory-veil', '1:12', 1, 4),
    ('amber-drowned', '1:11', 8, 4),
    ('cinder-choir', '6:12', 4, 6),
    ('glass-tides', '1:11', 1, 4),
    ('hollow-orchard', '1:12', 3, 6),
    ('starfall-basin', '1:12', 4, 4),
    ('violet-estuary', '1:13', 6, 2),
    ('clockwound-waste', '1:12', 4, 4)
  ) as docks(realm, location, dock_x, dock_y)
  where realm = p_realm;
$$;

do $migration$
declare
  boarding text := pg_get_functiondef('public.commit_world_ferry_v1(uuid,uuid,bigint,uuid,text,text)'::regprocedure);
  settlement text := pg_get_functiondef('app_private.settle_world_ferry_v1(uuid,uuid)'::regprocedure);
  old_declaration constant text := '  v_position jsonb;';
  new_declaration constant text := E'  v_position jsonb;\n  v_boarding_dock jsonb;';
  old_radius constant text := $old$      then
      raise exception 'WORLD_FERRY_PORT' using errcode = '22023';
    end if;
    if abs((v_position->>'x')::integer - 6) + abs((v_position->>'y')::integer -
      case when v_position->>'sectorId' = app_private.world_ferry_dock_v1('mainland')->>'sectorId'
        then (app_private.world_ferry_dock_v1('mainland')->>'y')::integer else 4 end
    ) > 1 then
      raise exception 'WORLD_FERRY_PORT' using errcode = '22023';
    end if;
$old$;
  new_radius constant text := $new$      then
      raise exception 'WORLD_FERRY_PORT' using errcode = '22023';
    end if;
    v_boarding_dock := case v_position->>'sectorId'
      when app_private.world_ferry_dock_v1('mainland')->>'sectorId'
        then app_private.world_ferry_dock_v1('mainland')
      when 'uncharted-landing' then app_private.world_ferry_dock_v1('uncharted')
      else app_private.world_void_ferry_dock_v1(split_part(v_position->>'sectorId', ':', 2))
    end;
    if v_boarding_dock is null
      or v_position->>'sectorId' is distinct from v_boarding_dock->>'sectorId'
      or abs((v_position->>'x')::integer - (v_boarding_dock->>'x')::integer)
       + abs((v_position->>'y')::integer - (v_boarding_dock->>'y')::integer) > 1 then
      raise exception 'WORLD_FERRY_PORT' using errcode = '22023';
    end if;
$new$;
  old_discovery constant text := $old$        select y * 13 + x from generate_series(2, 6) y cross join generate_series(4, 8) x$old$;
  new_discovery constant text := $new$        select y * 13 + x
        from generate_series(
          greatest(0, (v_dock->>'y')::integer - 2), least(8, (v_dock->>'y')::integer + 2)
        ) y cross join generate_series(
          greatest(0, (v_dock->>'x')::integer - 2), least(12, (v_dock->>'x')::integer + 2)
        ) x$new$;
begin
  if length(boarding) - length(replace(boarding, old_declaration, '')) <> length(old_declaration)
    or length(boarding) - length(replace(boarding, old_radius, '')) <> length(old_radius)
    or length(settlement) - length(replace(settlement, old_discovery, '')) <> length(old_discovery) then
    raise exception 'WORLD_COASTAL_TERMINAL_PREDECESSOR';
  end if;
  execute replace(replace(boarding, old_declaration, new_declaration), old_radius, new_radius);
  execute replace(settlement, old_discovery, new_discovery);
end;
$migration$;

commit;
