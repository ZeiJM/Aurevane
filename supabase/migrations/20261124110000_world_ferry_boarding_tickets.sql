begin;

-- Keep the canonical terminal, trip, rotation and settlement logic. Add reservations
-- under the same character lock as boarding, using an absolute sailing time.
do $migration$
declare
  command_sql text := pg_get_functiondef('public.commit_world_ferry_v1(uuid,uuid,bigint,uuid,text,text)'::regprocedure);
  settlement_sql text := pg_get_functiondef('app_private.settle_world_ferry_v1(uuid,uuid)'::regprocedure);
  old_header constant text := 'public.commit_world_ferry_v1(p_user_id uuid, p_character_id uuid, p_expected_version bigint, p_command_id uuid, p_kind text, p_request_fingerprint text)';
  new_header constant text := 'public.commit_world_ferry_v2(p_user_id uuid, p_character_id uuid, p_expected_version bigint, p_command_id uuid, p_kind text, p_request_fingerprint text, p_departure_at bigint)';
  old_kind constant text := 'p_kind not in (''board-ferry'', ''leave-ferry'')';
  new_kind constant text := 'p_kind not in (''buy-ferry-boarding'', ''board-ferry'', ''leave-ferry'')';
  old_window constant text := $old$    if v_now < v_departure - 300000 then
      raise exception 'WORLD_FERRY_WINDOW' using errcode = '22023';
    end if;$old$;
  new_window constant text := $new$    if p_departure_at is distinct from v_departure then
      raise exception 'WORLD_FERRY_WINDOW' using errcode = '22023';
    end if;
    v_ticket := v_world.state->'ferryTicket';
    if p_kind = 'buy-ferry-boarding' then
      if (v_ticket->>'departureAt')::bigint > v_now then
        if (v_ticket->>'departureAt')::bigint is distinct from v_departure
          or v_ticket->>'direction' is distinct from v_direction
          or v_ticket->>'sectorId' is distinct from v_position->>'sectorId' then
          raise exception 'WORLD_FERRY_TICKET_ACTIVE' using errcode = '22023';
        end if;
        v_state := v_world.state;
      else
        v_state := v_world.state || jsonb_build_object(
          'version', p_expected_version + 1,
          'ferryTicket', jsonb_build_object(
            'direction', v_direction, 'departureAt', v_departure,
            'sectorId', v_position->>'sectorId'
          )
        );
      end if;
    elsif (v_ticket->>'departureAt')::bigint is distinct from v_departure
      or v_ticket->>'direction' is distinct from v_direction
      or v_ticket->>'sectorId' is distinct from v_position->>'sectorId' then
      raise exception 'WORLD_FERRY_TICKET_REQUIRED' using errcode = '22023';
    else$new$;
  command_end constant text := $old$    ));
  end if;

  update app_private.character_world_state w$old$;
  wrapped_end constant text := $new$    ));
    end if;
  end if;

  update app_private.character_world_state w$new$;
  settlement_arrival constant text := 'world_ferry_relocate_v1(v_state - ''warpedPhase'', v_dock,';
begin
  if strpos(command_sql, old_header) = 0 or strpos(command_sql, old_kind) = 0
    or strpos(command_sql, '  v_trip jsonb;') = 0 or strpos(command_sql, old_window) = 0
    or strpos(command_sql, command_end) = 0 or strpos(settlement_sql, settlement_arrival) = 0 then
    raise exception 'WORLD_FERRY_BOARDING_PREDECESSOR';
  end if;
  command_sql := replace(command_sql, old_header, new_header);
  command_sql := replace(command_sql, old_kind, new_kind);
  command_sql := replace(command_sql, '  v_trip jsonb;', E'  v_trip jsonb;\n  v_ticket jsonb;');
  command_sql := replace(command_sql, old_window, new_window);
  command_sql := replace(command_sql, command_end, wrapped_end);
  execute command_sql;
  execute replace(settlement_sql, settlement_arrival,
    'world_ferry_relocate_v1(v_state - ''warpedPhase'' - ''ferryTicket'', v_dock,');
end;
$migration$;

revoke all on function public.commit_world_ferry_v1(uuid,uuid,bigint,uuid,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.commit_world_ferry_v2(uuid,uuid,bigint,uuid,text,text,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.commit_world_ferry_v2(uuid,uuid,bigint,uuid,text,text,bigint)
  to service_role;

commit;
