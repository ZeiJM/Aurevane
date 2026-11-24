begin;

-- Two 25-minute crossings and two 10-minute boarding windows form a circuit.
-- Offset each service by a minute from the old grid so new sailings cannot
-- join a legacy trip already recorded with a five-minute arrival.
create function app_private.world_ferry_departure_v2(p_direction text, p_now bigint)
returns bigint
language sql immutable strict set search_path = '' as $$
  select (floor((p_now - offset_ms)::numeric / 4200000)::bigint + 1) * 4200000 + offset_ms
  from (values (case p_direction
    when 'outbound' then 60000
    when 'return' then 2160000
    when 'asterwake-outbound' then 960000
    when 'asterwake-return' then 3060000
    else null
  end)) schedule(offset_ms);
$$;

revoke all on function app_private.world_ferry_departure_v2(text,bigint)
  from public, anon, authenticated, service_role;

do $migration$
declare
  definition text := pg_get_functiondef('public.commit_world_ferry_v2(uuid,uuid,bigint,uuid,text,text,bigint)'::regprocedure);
  old_departure constant text := 'v_departure := ((v_now - v_offset) / 3600000 + 1) * 3600000 + v_offset;';
  old_ticket constant text := 'elsif (v_ticket->>''departureAt'')::bigint is distinct from v_departure';
  new_ticket constant text := 'elsif v_now < v_departure - 600000 then
      raise exception ''WORLD_FERRY_BOARDING_CLOSED'' using errcode = ''22023'';
    elsif (v_ticket->>''departureAt'')::bigint is distinct from v_departure';
begin
  if strpos(definition, old_departure) = 0 or strpos(definition, old_ticket) = 0
    or length(definition) - length(replace(definition, 'v_departure + 300000', ''))
       <> 2 * length('v_departure + 300000') then
    raise exception 'WORLD_FERRY_TIMETABLE_PREDECESSOR';
  end if;
  definition := replace(definition, 'public.commit_world_ferry_v2(', 'public.commit_world_ferry_v3(');
  definition := replace(definition, old_departure,
    'v_departure := app_private.world_ferry_departure_v2(v_direction, v_now);');
  definition := replace(definition, old_ticket, new_ticket);
  definition := replace(definition, 'v_departure + 300000', 'v_departure + 1500000');
  execute definition;
end;
$migration$;

-- Keep existing passages and their arrival clocks. Carry future legacy
-- reservations onto the next sailing from the same port. Expired bookings
-- remain expired, and no other World state or receipt is replaced.
lock table app_private.character_world_state in share row exclusive mode;
with clock as materialized (
  select app_private.world_ferry_now_v1() as now_ms
), pending as materialized (
  select w.character_id,
    app_private.world_ferry_departure_v2(
      w.state#>>'{ferryTicket,direction}', (w.state#>>'{ferryTicket,departureAt}')::bigint - 1
    ) as departure_at
  from app_private.character_world_state w cross join clock
  where (w.state#>>'{ferryTicket,departureAt}')::bigint > clock.now_ms
)
update app_private.character_world_state w
set state = jsonb_set(
  jsonb_set(w.state, '{ferryTicket,departureAt}', to_jsonb(p.departure_at)),
  '{version}', to_jsonb((w.state->>'version')::bigint + 1)
)
from pending p
where w.character_id = p.character_id and p.departure_at is not null
  and p.departure_at <> (w.state#>>'{ferryTicket,departureAt}')::bigint;

revoke all on function public.commit_world_ferry_v2(uuid,uuid,bigint,uuid,text,text,bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.commit_world_ferry_v3(uuid,uuid,bigint,uuid,text,text,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.commit_world_ferry_v3(uuid,uuid,bigint,uuid,text,text,bigint)
  to service_role;

commit;
