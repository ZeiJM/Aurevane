begin;

create table app_private.character_attribute_reset_windows (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  resets_used smallint not null,
  updated_at timestamptz not null default clock_timestamp(),
  constraint character_attribute_reset_windows_used_range check (resets_used between 0 and 5)
);

create index character_attribute_reset_windows_user_idx
  on app_private.character_attribute_reset_windows (user_id, character_id);

create table app_private.character_attribute_change_audit (
  id uuid primary key,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  command_name text not null,
  change_mode text not null,
  before_attributes jsonb not null,
  after_attributes jsonb not null,
  level_at_change smallint not null,
  point_pool smallint not null,
  reset_window_started_at_after timestamptz,
  reset_used_after smallint not null,
  request_fingerprint text not null,
  changed_at timestamptz not null default clock_timestamp(),
  constraint character_attribute_change_mode check (change_mode in ('spend', 'reset')),
  constraint character_attribute_change_level_range check (level_at_change between 1 and 50),
  constraint character_attribute_change_pool_positive check (point_pool >= 36),
  constraint character_attribute_change_reset_used_range check (reset_used_after between 0 and 5),
  constraint character_attribute_change_before_object check (jsonb_typeof(before_attributes) = 'object'),
  constraint character_attribute_change_after_object check (jsonb_typeof(after_attributes) = 'object')
);

create index character_attribute_change_audit_character_idx
  on app_private.character_attribute_change_audit (character_id, changed_at desc);

comment on table app_private.character_attribute_reset_windows is
  'Server-authoritative five-use attribute reset allowance. A 30-day window begins when the first reset in that window is committed.';
comment on table app_private.character_attribute_change_audit is
  'Append-only provenance for core-attribute point spending and full attribute resets.';

revoke all on table app_private.character_attribute_reset_windows from public, anon, authenticated;
revoke all on table app_private.character_attribute_change_audit from public, anon, authenticated;
grant select on table app_private.character_attribute_reset_windows to service_role;
grant select on table app_private.character_attribute_change_audit to service_role;

create or replace function public.get_character_attribute_allocation_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  character_id uuid,
  might integer,
  finesse integer,
  vitality integer,
  agility integer,
  intellect integer,
  resolve integer,
  level smallint,
  point_pool integer,
  spent_points integer,
  unspent_points integer,
  reset_window_started_at timestamptz,
  reset_used integer,
  reset_remaining integer,
  reset_renews_at timestamptz,
  server_now timestamptz
)
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  with server_clock as (
    select clock_timestamp() as now_value
  ), owned as (
    select character.*
    from public.characters character
    where character.id = p_character_id
      and character.user_id = p_user_id
  ), reset_state as (
    select
      case
        when reset.window_started_at is not null
          and reset.window_started_at + interval '30 days' > clock.now_value
        then reset.window_started_at
        else null
      end as active_started_at,
      case
        when reset.window_started_at is not null
          and reset.window_started_at + interval '30 days' > clock.now_value
        then reset.resets_used::integer
        else 0
      end as active_used,
      clock.now_value
    from server_clock clock
    left join app_private.character_attribute_reset_windows reset
      on reset.character_id = p_character_id
     and reset.user_id = p_user_id
  )
  select
    character.id,
    character.might,
    character.finesse,
    character.vitality,
    character.agility,
    character.intellect,
    character.resolve,
    character.level,
    (36 + character.level - 1)::integer,
    (
      character.might + character.finesse + character.vitality +
      character.agility + character.intellect + character.resolve
    )::integer,
    greatest(
      0,
      (36 + character.level - 1) - (
        character.might + character.finesse + character.vitality +
        character.agility + character.intellect + character.resolve
      )
    )::integer,
    reset.active_started_at,
    reset.active_used,
    greatest(0, 5 - reset.active_used)::integer,
    case
      when reset.active_started_at is null then null
      else reset.active_started_at + interval '30 days'
    end,
    reset.now_value
  from owned character
  cross join reset_state reset;
$$;

revoke all on function public.get_character_attribute_allocation_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_character_attribute_allocation_v1(uuid, uuid)
  to service_role;

create or replace function public.commit_character_attribute_allocation_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_mode text,
  p_might integer,
  p_finesse integer,
  p_vitality integer,
  p_agility integer,
  p_intellect integer,
  p_resolve integer,
  p_idempotency_key uuid,
  p_request_fingerprint text
)
returns table (
  character_id uuid,
  might integer,
  finesse integer,
  vitality integer,
  agility integer,
  intellect integer,
  resolve integer,
  level smallint,
  point_pool integer,
  spent_points integer,
  unspent_points integer,
  reset_window_started_at timestamptz,
  reset_used integer,
  reset_remaining integer,
  reset_renews_at timestamptz,
  server_now timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_command_name constant text := 'character.attributes.allocate.v1';
  v_actor_key text := 'user:' || p_user_id::text;
  v_change_id uuid := gen_random_uuid();
  v_existing app_private.idempotency_records%rowtype;
  v_rows_inserted integer;
  v_character public.characters%rowtype;
  v_now timestamptz := clock_timestamp();
  v_pool integer;
  v_spent integer;
  v_before_spent integer;
  v_reset app_private.character_attribute_reset_windows%rowtype;
  v_reset_started timestamptz;
  v_reset_used integer := 0;
begin
  if p_mode not in ('spend', 'reset') then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_MODE_INVALID';
  end if;

  if least(p_might, p_finesse, p_vitality, p_agility, p_intellect, p_resolve) < 1 then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_VALUE_INVALID';
  end if;

  if p_request_fingerprint is null or btrim(p_request_fingerprint) = '' then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_FINGERPRINT_INVALID';
  end if;

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
    jsonb_build_object('change_id', v_change_id)
  )
  on conflict (actor_key, command_name, idempotency_key) do nothing;

  get diagnostics v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select * into v_existing
    from app_private.idempotency_records record
    where record.actor_key = v_actor_key
      and record.command_name = v_command_name
      and record.idempotency_key = p_idempotency_key;

    if not found then
      raise exception using errcode = '40001', message = 'CHARACTER_ATTRIBUTE_IDEMPOTENCY_UNAVAILABLE';
    end if;
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      audit.character_id,
      (audit.after_attributes ->> 'might')::integer,
      (audit.after_attributes ->> 'finesse')::integer,
      (audit.after_attributes ->> 'vitality')::integer,
      (audit.after_attributes ->> 'agility')::integer,
      (audit.after_attributes ->> 'intellect')::integer,
      (audit.after_attributes ->> 'resolve')::integer,
      audit.level_at_change,
      audit.point_pool::integer,
      (
        (audit.after_attributes ->> 'might')::integer +
        (audit.after_attributes ->> 'finesse')::integer +
        (audit.after_attributes ->> 'vitality')::integer +
        (audit.after_attributes ->> 'agility')::integer +
        (audit.after_attributes ->> 'intellect')::integer +
        (audit.after_attributes ->> 'resolve')::integer
      )::integer,
      greatest(
        0,
        audit.point_pool::integer - (
          (audit.after_attributes ->> 'might')::integer +
          (audit.after_attributes ->> 'finesse')::integer +
          (audit.after_attributes ->> 'vitality')::integer +
          (audit.after_attributes ->> 'agility')::integer +
          (audit.after_attributes ->> 'intellect')::integer +
          (audit.after_attributes ->> 'resolve')::integer
        )
      )::integer,
      audit.reset_window_started_at_after,
      audit.reset_used_after::integer,
      greatest(0, 5 - audit.reset_used_after)::integer,
      case
        when audit.reset_window_started_at_after is null then null
        else audit.reset_window_started_at_after + interval '30 days'
      end,
      clock_timestamp(),
      true
    from app_private.character_attribute_change_audit audit
    where audit.id = (v_existing.result ->> 'change_id')::uuid;

    if not found then
      raise exception using errcode = '40001', message = 'CHARACTER_ATTRIBUTE_IDEMPOTENT_RESULT_UNAVAILABLE';
    end if;
    return;
  end if;

  select * into v_character
  from public.characters character
  where character.id = p_character_id
    and character.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_ATTRIBUTE_CHARACTER_NOT_FOUND';
  end if;

  if v_character.level < 1 or v_character.level > 50 then
    raise exception using errcode = 'P0001', message = 'CHARACTER_ATTRIBUTE_LEVEL_INVALID';
  end if;

  v_pool := 36 + v_character.level - 1;
  v_spent := p_might + p_finesse + p_vitality + p_agility + p_intellect + p_resolve;
  v_before_spent :=
    v_character.might + v_character.finesse + v_character.vitality +
    v_character.agility + v_character.intellect + v_character.resolve;

  if v_spent > v_pool then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_POINT_POOL_EXCEEDED';
  end if;

  if p_might = v_character.might
    and p_finesse = v_character.finesse
    and p_vitality = v_character.vitality
    and p_agility = v_character.agility
    and p_intellect = v_character.intellect
    and p_resolve = v_character.resolve then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_NO_CHANGE';
  end if;

  select * into v_reset
  from app_private.character_attribute_reset_windows reset
  where reset.character_id = p_character_id
    and reset.user_id = p_user_id
  for update;

  if found and v_reset.window_started_at + interval '30 days' > v_now then
    v_reset_started := v_reset.window_started_at;
    v_reset_used := v_reset.resets_used;
  else
    v_reset_started := null;
    v_reset_used := 0;
  end if;

  if p_mode = 'spend' then
    if p_might < v_character.might
      or p_finesse < v_character.finesse
      or p_vitality < v_character.vitality
      or p_agility < v_character.agility
      or p_intellect < v_character.intellect
      or p_resolve < v_character.resolve then
      raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_SPEND_CANNOT_REDUCE';
    end if;

    if v_spent <= v_before_spent then
      raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_SPEND_REQUIRES_POINT';
    end if;
  else
    if v_spent <> v_pool then
      raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_RESET_MUST_SPEND_FULL_POOL';
    end if;

    if v_reset_started is null then
      v_reset_started := v_now;
      v_reset_used := 0;
    end if;

    if v_reset_used >= 5 then
      raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_RESET_LIMIT_REACHED';
    end if;

    v_reset_used := v_reset_used + 1;

    insert into app_private.character_attribute_reset_windows (
      character_id,
      user_id,
      window_started_at,
      resets_used,
      updated_at
    ) values (
      p_character_id,
      p_user_id,
      v_reset_started,
      v_reset_used,
      v_now
    )
    on conflict (character_id) do update
    set
      user_id = excluded.user_id,
      window_started_at = excluded.window_started_at,
      resets_used = excluded.resets_used,
      updated_at = excluded.updated_at;
  end if;

  update public.characters character
  set
    might = p_might,
    finesse = p_finesse,
    vitality = p_vitality,
    agility = p_agility,
    intellect = p_intellect,
    resolve = p_resolve
  where character.id = p_character_id
    and character.user_id = p_user_id;

  insert into app_private.character_attribute_change_audit (
    id,
    character_id,
    user_id,
    command_name,
    change_mode,
    before_attributes,
    after_attributes,
    level_at_change,
    point_pool,
    reset_window_started_at_after,
    reset_used_after,
    request_fingerprint,
    changed_at
  ) values (
    v_change_id,
    p_character_id,
    p_user_id,
    v_command_name,
    p_mode,
    jsonb_build_object(
      'might', v_character.might,
      'finesse', v_character.finesse,
      'vitality', v_character.vitality,
      'agility', v_character.agility,
      'intellect', v_character.intellect,
      'resolve', v_character.resolve
    ),
    jsonb_build_object(
      'might', p_might,
      'finesse', p_finesse,
      'vitality', p_vitality,
      'agility', p_agility,
      'intellect', p_intellect,
      'resolve', p_resolve
    ),
    v_character.level,
    v_pool,
    v_reset_started,
    v_reset_used,
    p_request_fingerprint,
    v_now
  );

  return query
  select
    p_character_id,
    p_might,
    p_finesse,
    p_vitality,
    p_agility,
    p_intellect,
    p_resolve,
    v_character.level,
    v_pool,
    v_spent,
    greatest(0, v_pool - v_spent),
    v_reset_started,
    v_reset_used,
    greatest(0, 5 - v_reset_used),
    case when v_reset_started is null then null else v_reset_started + interval '30 days' end,
    v_now,
    false;
end;
$$;

revoke all on function public.commit_character_attribute_allocation_v1(
  uuid, uuid, text, integer, integer, integer, integer, integer, integer, uuid, text
) from public, anon, authenticated;
grant execute on function public.commit_character_attribute_allocation_v1(
  uuid, uuid, text, integer, integer, integer, integer, integer, integer, uuid, text
) to service_role;

commit;
