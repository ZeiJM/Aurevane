begin;

-- A second public ferry service uses its own fixed docks, distinct trip IDs,
-- and the existing authority lock, boarding window and idempotent receipts.
alter table app_private.world_ferry_trips drop constraint world_ferry_trips_direction_check;
alter table app_private.world_ferry_trips add constraint world_ferry_trips_direction_check
  check (direction in ('outbound', 'return', 'asterwake-outbound', 'asterwake-return'));

create or replace function app_private.world_ferry_dock_v1(p_port text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'sectorId', case p_port
      when 'mainland' then 'atlas:126:33'
      when 'north-shore' then 'atlas:126:30'
      when 'asterwake' then 'atlas:4:15'
      else 'uncharted-landing' end,
    'x', 6, 'y', case p_port when 'mainland' then 8 when 'north-shore' then 0 when 'asterwake' then 8 else 4 end
  );
$$;

do $migration$
declare
  boarding text := pg_get_functiondef('public.commit_world_ferry_v1(uuid,uuid,bigint,uuid,text,text)'::regprocedure);
  settlement text := pg_get_functiondef('app_private.settle_world_ferry_v1(uuid,uuid)'::regprocedure);
  old_docks constant text := $old$      when 'uncharted-landing' then app_private.world_ferry_dock_v1('uncharted')$old$;
  new_docks constant text := $new$      when app_private.world_ferry_dock_v1('north-shore')->>'sectorId'
        then app_private.world_ferry_dock_v1('north-shore')
      when app_private.world_ferry_dock_v1('asterwake')->>'sectorId'
        then app_private.world_ferry_dock_v1('asterwake')
      when 'uncharted-landing' then app_private.world_ferry_dock_v1('uncharted')$new$;
  old_departure constant text := $old$    elsif v_position->>'sectorId' = 'uncharted-landing'$old$;
  new_departure constant text := $new$    elsif v_position->>'sectorId' = app_private.world_ferry_dock_v1('north-shore')->>'sectorId' then
      v_direction := 'asterwake-outbound';
      v_offset := 900000;
    elsif v_position->>'sectorId' = app_private.world_ferry_dock_v1('asterwake')->>'sectorId' then
      v_direction := 'asterwake-return';
      v_offset := 2700000;
    elsif v_position->>'sectorId' = 'uncharted-landing'$new$;
  old_arrival constant text := $old$case v_trip->>'direction' when 'outbound' then 'uncharted' else 'mainland' end$old$;
  new_arrival constant text := $new$case v_trip->>'direction'
      when 'outbound' then 'uncharted'
      when 'asterwake-outbound' then 'asterwake'
      when 'asterwake-return' then 'north-shore'
      else 'mainland' end$new$;
begin
  if length(boarding) - length(replace(boarding, old_docks, '')) <> length(old_docks)
    or length(boarding) - length(replace(boarding, old_departure, '')) <> length(old_departure)
    or length(settlement) - length(replace(settlement, old_arrival, '')) <> length(old_arrival) then
    raise exception 'WORLD_ASTERWAKE_FERRY_PREDECESSOR';
  end if;
  execute replace(replace(boarding, old_docks, new_docks), old_departure, new_departure);
  execute replace(settlement, old_arrival, new_arrival);
end;
$migration$;

commit;
