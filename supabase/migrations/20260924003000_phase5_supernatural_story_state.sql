begin;

create table app_private.character_supernatural_story_state (
  character_id uuid primary key references public.characters(id) on delete cascade,
  schema_version integer not null default 1,
  state_version integer not null default 1,
  story_id text not null,
  story_version integer not null,
  node_id text not null,
  path text not null default 'unawakened',
  ascension_id text,
  ascension_content_version integer,
  severence_id text,
  severence_content_version integer,
  chosen_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  constraint character_supernatural_schema_v1 check (schema_version = 1),
  constraint character_supernatural_state_version_positive check (state_version > 0),
  constraint character_supernatural_story_version_positive check (story_version > 0),
  constraint character_supernatural_story_id_format check (
    story_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint character_supernatural_node_id_format check (
    node_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint character_supernatural_path check (
    path in ('unawakened', 'ascended', 'severed')
  ),
  constraint character_supernatural_ascension_version_positive check (
    ascension_content_version is null or ascension_content_version > 0
  ),
  constraint character_supernatural_severence_version_positive check (
    severence_content_version is null or severence_content_version > 0
  ),
  constraint character_supernatural_identity_shape check (
    (
      path = 'unawakened'
      and ascension_id is null
      and ascension_content_version is null
      and severence_id is null
      and severence_content_version is null
      and chosen_at is null
    )
    or (
      path = 'ascended'
      and ascension_id is not null
      and ascension_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
      and ascension_content_version is not null
      and severence_id is null
      and severence_content_version is null
      and chosen_at is not null
    )
    or (
      path = 'severed'
      and severence_id is not null
      and severence_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
      and severence_content_version is not null
      and ascension_id is null
      and ascension_content_version is null
      and chosen_at is not null
    )
  )
);

comment on table app_private.character_supernatural_story_state is
  'Private server-authoritative, versioned Phase-5 supernatural story/path state. Browser roles have no direct access.';

revoke all on table app_private.character_supernatural_story_state
  from public, anon, authenticated;
grant select, insert, update on table app_private.character_supernatural_story_state
  to service_role;

create or replace function public.get_character_supernatural_story_state_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  character_id uuid,
  schema_version integer,
  state_version integer,
  story_id text,
  story_version integer,
  node_id text,
  path text,
  ascension_id text,
  ascension_content_version integer,
  severence_id text,
  severence_content_version integer,
  chosen_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if not exists (
    select 1
    from public.characters character
    where character.id = p_character_id
      and character.user_id = p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  return query
  select
    state.character_id,
    state.schema_version,
    state.state_version,
    state.story_id,
    state.story_version,
    state.node_id,
    state.path,
    state.ascension_id,
    state.ascension_content_version,
    state.severence_id,
    state.severence_content_version,
    state.chosen_at,
    state.updated_at
  from app_private.character_supernatural_story_state state
  where state.character_id = p_character_id;
end;
$$;

revoke all on function public.get_character_supernatural_story_state_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_character_supernatural_story_state_v1(uuid, uuid)
  to service_role;

create or replace function public.initialize_character_supernatural_story_state_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_story_id text,
  p_story_version integer,
  p_initial_node_id text
)
returns table (
  character_id uuid,
  schema_version integer,
  state_version integer,
  story_id text,
  story_version integer,
  node_id text,
  path text,
  ascension_id text,
  ascension_content_version integer,
  severence_id text,
  severence_content_version integer,
  chosen_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_existing app_private.character_supernatural_story_state%rowtype;
begin
  if p_story_version is null or p_story_version <= 0 then
    raise exception using errcode = '22023', message = 'SUPERNATURAL_STORY_VERSION_INVALID';
  end if;
  if p_story_id is null or p_story_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'SUPERNATURAL_STORY_ID_INVALID';
  end if;
  if p_initial_node_id is null or p_initial_node_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'SUPERNATURAL_STORY_NODE_INVALID';
  end if;

  perform 1
  from public.characters character
  where character.id = p_character_id
    and character.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  select *
  into v_existing
  from app_private.character_supernatural_story_state state
  where state.character_id = p_character_id
  for update;

  if found then
    if v_existing.story_id <> p_story_id
      or v_existing.story_version <> p_story_version
      or v_existing.node_id <> p_initial_node_id
      or v_existing.state_version <> 1
      or v_existing.path <> 'unawakened'
    then
      raise exception using
        errcode = '22023',
        message = 'SUPERNATURAL_STORY_ALREADY_INITIALIZED_DIFFERENTLY';
    end if;
  else
    insert into app_private.character_supernatural_story_state (
      character_id,
      schema_version,
      state_version,
      story_id,
      story_version,
      node_id,
      path,
      updated_at
    ) values (
      p_character_id,
      1,
      1,
      p_story_id,
      p_story_version,
      p_initial_node_id,
      'unawakened',
      v_now
    );
  end if;

  return query
  select
    state.character_id,
    state.schema_version,
    state.state_version,
    state.story_id,
    state.story_version,
    state.node_id,
    state.path,
    state.ascension_id,
    state.ascension_content_version,
    state.severence_id,
    state.severence_content_version,
    state.chosen_at,
    state.updated_at
  from app_private.character_supernatural_story_state state
  where state.character_id = p_character_id;
end;
$$;

revoke all on function public.initialize_character_supernatural_story_state_v1(
  uuid, uuid, text, integer, text
) from public, anon, authenticated;
grant execute on function public.initialize_character_supernatural_story_state_v1(
  uuid, uuid, text, integer, text
) to service_role;

create or replace function public.commit_character_supernatural_story_transition_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_expected_state_version integer,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_transition_id text,
  p_transition_content_version integer,
  p_story_id text,
  p_story_version integer,
  p_from_node_id text,
  p_to_node_id text,
  p_next_path text,
  p_ascension_id text default null,
  p_ascension_content_version integer default null,
  p_severence_id text default null,
  p_severence_content_version integer default null
)
returns table (
  character_id uuid,
  schema_version integer,
  state_version integer,
  story_id text,
  story_version integer,
  node_id text,
  path text,
  ascension_id text,
  ascension_content_version integer,
  severence_id text,
  severence_content_version integer,
  chosen_at timestamptz,
  updated_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor_key text := 'user:' || p_user_id::text;
  v_command_name constant text := 'character.supernatural-story.transition.v1';
  v_receipt app_private.idempotency_records%rowtype;
  v_state app_private.character_supernatural_story_state%rowtype;
  v_now timestamptz := clock_timestamp();
  v_chosen_at timestamptz;
  v_next_state_version integer;
begin
  if p_expected_state_version is null or p_expected_state_version <= 0 then
    raise exception using errcode = '22023', message = 'SUPERNATURAL_STATE_VERSION_INVALID';
  end if;
  if p_transition_content_version is null or p_transition_content_version <= 0 then
    raise exception using errcode = '22023', message = 'SUPERNATURAL_TRANSITION_VERSION_INVALID';
  end if;
  if p_story_version is null or p_story_version <= 0 then
    raise exception using errcode = '22023', message = 'SUPERNATURAL_STORY_VERSION_INVALID';
  end if;
  if p_transition_id is null or p_transition_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    or p_story_id is null or p_story_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    or p_from_node_id is null or p_from_node_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    or p_to_node_id is null or p_to_node_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  then
    raise exception using errcode = '22023', message = 'SUPERNATURAL_TRANSITION_ID_INVALID';
  end if;
  if p_next_path not in ('unawakened', 'ascended', 'severed') then
    raise exception using errcode = '22023', message = 'SUPERNATURAL_PATH_INVALID';
  end if;

  select *
  into v_receipt
  from app_private.idempotency_records receipt
  where receipt.actor_key = v_actor_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_receipt.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '22023', message = 'SUPERNATURAL_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_receipt.result ->> 'character_id')::uuid,
      (v_receipt.result ->> 'schema_version')::integer,
      (v_receipt.result ->> 'state_version')::integer,
      v_receipt.result ->> 'story_id',
      (v_receipt.result ->> 'story_version')::integer,
      v_receipt.result ->> 'node_id',
      v_receipt.result ->> 'path',
      nullif(v_receipt.result ->> 'ascension_id', ''),
      nullif(v_receipt.result ->> 'ascension_content_version', '')::integer,
      nullif(v_receipt.result ->> 'severence_id', ''),
      nullif(v_receipt.result ->> 'severence_content_version', '')::integer,
      nullif(v_receipt.result ->> 'chosen_at', '')::timestamptz,
      (v_receipt.result ->> 'updated_at')::timestamptz,
      true;
    return;
  end if;

  perform 1
  from public.characters character
  where character.id = p_character_id
    and character.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  select *
  into v_state
  from app_private.character_supernatural_story_state state
  where state.character_id = p_character_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'SUPERNATURAL_STORY_NOT_INITIALIZED';
  end if;

  select *
  into v_receipt
  from app_private.idempotency_records receipt
  where receipt.actor_key = v_actor_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_receipt.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '22023', message = 'SUPERNATURAL_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_receipt.result ->> 'character_id')::uuid,
      (v_receipt.result ->> 'schema_version')::integer,
      (v_receipt.result ->> 'state_version')::integer,
      v_receipt.result ->> 'story_id',
      (v_receipt.result ->> 'story_version')::integer,
      v_receipt.result ->> 'node_id',
      v_receipt.result ->> 'path',
      nullif(v_receipt.result ->> 'ascension_id', ''),
      nullif(v_receipt.result ->> 'ascension_content_version', '')::integer,
      nullif(v_receipt.result ->> 'severence_id', ''),
      nullif(v_receipt.result ->> 'severence_content_version', '')::integer,
      nullif(v_receipt.result ->> 'chosen_at', '')::timestamptz,
      (v_receipt.result ->> 'updated_at')::timestamptz,
      true;
    return;
  end if;

  if v_state.state_version <> p_expected_state_version then
    raise exception using errcode = '40001', message = 'SUPERNATURAL_STATE_VERSION_CONFLICT';
  end if;
  if v_state.story_id <> p_story_id
    or v_state.story_version <> p_story_version
    or v_state.node_id <> p_from_node_id
  then
    raise exception using errcode = '22023', message = 'SUPERNATURAL_TRANSITION_STALE';
  end if;
  if v_state.path <> 'unawakened' and p_next_path <> v_state.path then
    raise exception using errcode = '22023', message = 'SUPERNATURAL_PATH_PERMANENT';
  end if;

  if p_next_path = 'unawakened' then
    if p_ascension_id is not null or p_ascension_content_version is not null
      or p_severence_id is not null or p_severence_content_version is not null
    then
      raise exception using errcode = '22023', message = 'SUPERNATURAL_UNAWAKENED_IDENTITY_INVALID';
    end if;
    v_chosen_at := null;
  elsif p_next_path = 'ascended' then
    if p_ascension_id is null
      or p_ascension_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
      or p_ascension_content_version is null
      or p_ascension_content_version <= 0
      or p_severence_id is not null
      or p_severence_content_version is not null
    then
      raise exception using errcode = '22023', message = 'SUPERNATURAL_ASCENSION_IDENTITY_INVALID';
    end if;
    v_chosen_at := coalesce(v_state.chosen_at, v_now);
  else
    if p_severence_id is null
      or p_severence_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
      or p_severence_content_version is null
      or p_severence_content_version <= 0
      or p_ascension_id is not null
      or p_ascension_content_version is not null
    then
      raise exception using errcode = '22023', message = 'SUPERNATURAL_SEVERENCE_IDENTITY_INVALID';
    end if;
    v_chosen_at := coalesce(v_state.chosen_at, v_now);
  end if;

  v_next_state_version := v_state.state_version + 1;

  insert into app_private.idempotency_records (
    actor_key,
    command_name,
    idempotency_key,
    request_fingerprint,
    result
  ) values (
    v_actor_key,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object(
      'character_id', p_character_id,
      'schema_version', 1,
      'state_version', v_next_state_version,
      'story_id', p_story_id,
      'story_version', p_story_version,
      'node_id', p_to_node_id,
      'path', p_next_path,
      'ascension_id', p_ascension_id,
      'ascension_content_version', p_ascension_content_version,
      'severence_id', p_severence_id,
      'severence_content_version', p_severence_content_version,
      'chosen_at', v_chosen_at,
      'updated_at', v_now,
      'transition_id', p_transition_id,
      'transition_content_version', p_transition_content_version
    )
  );

  update app_private.character_supernatural_story_state state
  set
    state_version = v_next_state_version,
    node_id = p_to_node_id,
    path = p_next_path,
    ascension_id = p_ascension_id,
    ascension_content_version = p_ascension_content_version,
    severence_id = p_severence_id,
    severence_content_version = p_severence_content_version,
    chosen_at = v_chosen_at,
    updated_at = v_now
  where state.character_id = p_character_id;

  return query
  select
    state.character_id,
    state.schema_version,
    state.state_version,
    state.story_id,
    state.story_version,
    state.node_id,
    state.path,
    state.ascension_id,
    state.ascension_content_version,
    state.severence_id,
    state.severence_content_version,
    state.chosen_at,
    state.updated_at,
    false
  from app_private.character_supernatural_story_state state
  where state.character_id = p_character_id;
end;
$$;

revoke all on function public.commit_character_supernatural_story_transition_v1(
  uuid, uuid, integer, uuid, text, text, integer, text, integer, text, text, text,
  text, integer, text, integer
) from public, anon, authenticated;
grant execute on function public.commit_character_supernatural_story_transition_v1(
  uuid, uuid, integer, uuid, text, text, integer, text, integer, text, text, text,
  text, integer, text, integer
) to service_role;

commit;
