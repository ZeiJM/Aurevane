begin;

create or replace function public.commit_world_state_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_expected_version bigint,
  p_command_id uuid,
  p_kind text,
  p_next_state jsonb,
  p_request_fingerprint text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,app_private,public
as $$
declare
  v_world app_private.character_world_state%rowtype;
  v_block text;
  v_fingerprint text;
  v_now bigint;
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
  if p_next_state->'position' is distinct from v_world.state->'position' and p_kind<>'cross' then
    if p_kind<>'tick' or v_world.state->'route'->0->'position' is distinct from p_next_state->'position' then
      raise exception 'WORLD_INVALID_STEP' using errcode='22023';
    end if;
    if v_world.state->>'nextStepAt' is null or (v_world.state->>'nextStepAt')::bigint>v_now then
      raise exception 'WORLD_STEP_NOT_DUE' using errcode='22023';
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
  elsif p_kind in ('walk','autopath') or p_next_state->'position' is distinct from v_world.state->'position' then
    p_next_state:=jsonb_set(
      p_next_state,
      '{nextStepAt}',
      to_jsonb(v_now+greatest(1100,(p_next_state#>>'{route,0,durationMs}')::bigint))
    );
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

commit;
