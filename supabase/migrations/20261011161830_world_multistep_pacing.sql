-- World movement pacing. The stored schedule used to be rewritten to at least 1.1 s per step and a
-- tick could confirm only one step, while the map plans and previews the authored 275 ms step.
-- The stage therefore ran ahead of the confirmed position, was pulled back, and waited.
-- Authority is unchanged: a position may only move along the saved route, only to tiles whose
-- authored landing time has passed, in at most 40 steps, and the next deadline can never be
-- earlier than the schedule already running nor later than one authored step from now.
-- Walk/auto-path may first confirm due steps and then replan from the tile actually reached.
create or replace function public.commit_world_state_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_expected_version bigint,
  p_command_id uuid,
  p_kind text,
  p_next_state jsonb,
  p_request_fingerprint text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
as $$
declare
  v_world app_private.character_world_state%rowtype;
  v_block text;
  v_fingerprint text;
  v_now bigint;
  v_old_route jsonb;
  v_old_next bigint;
  v_k bigint;
  v_span bigint;
  v_rest jsonb;
  v_next bigint;
  v_dur bigint;
  v_moved boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
  perform 1
  from public.characters c
  where c.id=p_character_id and c.user_id=p_user_id
  for update;
  if not found or exists(
    select 1 from app_private.character_deletion_requests d where d.character_id=p_character_id
  ) then
    raise exception 'WORLD_NOT_OWNED' using errcode='42501';
  end if;

  select *
  into v_world
  from app_private.character_world_state w
  where w.character_id=p_character_id
  for update;
  if not found then raise exception 'WORLD_STATE_UNAVAILABLE'; end if;

  v_fingerprint:=coalesce(
    p_request_fingerprint,
    md5(p_expected_version::text||p_kind||p_next_state::text)
  );
  if v_world.last_command_id=p_command_id then
    if v_world.last_command_fingerprint<>v_fingerprint then
      raise exception 'WORLD_COMMAND_CONFLICT' using errcode='22023';
    end if;
    return v_world.state;
  end if;

  if (v_world.state->>'version')::bigint<>p_expected_version then
    raise exception 'WORLD_STALE_VERSION' using errcode='40001';
  end if;

  v_block:=app_private.world_block_reason_v1(p_user_id,p_character_id);
  if v_block is not null and p_kind<>'stop' then
    raise exception '%',v_block using errcode='22023';
  end if;

  if p_kind not in ('walk','autopath','tick','stop','cross','interact') or p_command_id is null then
    raise exception 'WORLD_INVALID_COMMAND' using errcode='22023';
  end if;

  if p_kind='interact' and (
    p_next_state->'position' is distinct from v_world.state->'position'
    or p_next_state->'route' is distinct from v_world.state->'route'
    or p_next_state->'nextStepAt' is distinct from v_world.state->'nextStepAt'
  ) then
    raise exception 'WORLD_INVALID_INTERACTION' using errcode='22023';
  end if;

  v_now:=floor(extract(epoch from clock_timestamp())*1000);
  v_old_route:=coalesce(v_world.state->'route','[]'::jsonb);
  v_old_next:=nullif(v_world.state->>'nextStepAt','')::bigint;
  v_moved:=p_next_state->'position' is distinct from v_world.state->'position' and p_kind<>'cross';

  if v_moved then
    -- Only a tick or a replan may confirm steps, and only along the saved route.
    if p_kind not in ('tick','walk','autopath') then
      raise exception 'WORLD_INVALID_STEP' using errcode='22023';
    end if;
    select t.ord into v_k
    from jsonb_array_elements(v_old_route) with ordinality as t(e,ord)
    where t.e->'position' = p_next_state->'position'
    order by t.ord
    limit 1;
    if v_k is null or v_k>40 then
      raise exception 'WORLD_INVALID_STEP' using errcode='22023';
    end if;
    if v_old_next is null then
      raise exception 'WORLD_STEP_NOT_DUE' using errcode='22023';
    end if;
    -- Step j lands at nextStepAt plus the authored durations of steps 2..j.
    select coalesce(sum((t.e->>'durationMs')::bigint),0) into v_span
    from jsonb_array_elements(v_old_route) with ordinality as t(e,ord)
    where t.ord>1 and t.ord<=v_k;
    if v_old_next+v_span>v_now then
      raise exception 'WORLD_STEP_NOT_DUE' using errcode='22023';
    end if;
    if p_kind='tick' then
      select coalesce(jsonb_agg(t.e order by t.ord),'[]'::jsonb) into v_rest
      from jsonb_array_elements(v_old_route) with ordinality as t(e,ord)
      where t.ord>v_k;
      if p_next_state->'route' is distinct from v_rest then
        raise exception 'WORLD_INVALID_STEP' using errcode='22023';
      end if;
    end if;
  end if;

  if p_kind='stop' and (
    p_next_state->'position' is distinct from v_world.state->'position'
    or jsonb_array_length(p_next_state->'route')<>0
  ) then
    raise exception 'WORLD_INVALID_STOP' using errcode='22023';
  end if;

  if jsonb_array_length(p_next_state->'route')=0 then
    p_next_state:=jsonb_set(p_next_state,'{nextStepAt}','null'::jsonb);
  elsif p_kind in ('walk','autopath') or v_moved then
    v_dur:=greatest(coalesce((p_next_state#>>'{route,0,durationMs}')::bigint,0),0);
    v_next:=least(coalesce(nullif(p_next_state->>'nextStepAt','')::bigint,v_now+v_dur),v_now+v_dur);
    -- Never earlier than the schedule already running (or, from a standstill, a short grace
    -- for the time spent reading and resolving the command).
    v_next:=greatest(
      v_next,
      case
        when jsonb_array_length(v_old_route)>0 and v_old_next is not null then v_old_next
        else v_now-8000
      end
    );
    p_next_state:=jsonb_set(p_next_state,'{nextStepAt}',to_jsonb(v_next));
  end if;

  p_next_state:=jsonb_set(p_next_state,'{version}',to_jsonb(p_expected_version+1));
  update app_private.character_world_state
  set state=p_next_state,
      last_command_id=p_command_id,
      last_command_fingerprint=v_fingerprint,
      last_seen_at=clock_timestamp()
  where character_id=p_character_id;
  return p_next_state;
end;
$$;

revoke all on function public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)
  to service_role;
