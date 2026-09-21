begin;

-- Restore the original full 100-level progression shape as a new active curve version.
-- Existing XP is preserved exactly; only the Level resolved from that XP is recalculated.
do $$
declare
  v_thresholds bigint[];
  v_resolved_level smallint;
  v_character record;
begin
  select curve.cumulative_xp_by_level
  into v_thresholds
  from app_private.level_progression_curves curve
  where curve.version = 1;

  if v_thresholds is null or array_length(v_thresholds, 1) <> 100 then
    raise exception using
      errcode = 'P0001',
      message = 'LEVEL_100_SOURCE_CURVE_UNAVAILABLE';
  end if;

  insert into app_private.level_progression_curves (
    version,
    label,
    max_level,
    cumulative_xp_by_level
  ) values (
    3,
    'Level 100 approved progression curve',
    100,
    v_thresholds
  );

  update app_private.progression_cycle_level_curves mapping
  set curve_version = 3
  where mapping.curve_version = 2;

  for v_character in
    select character.id, character.xp, character.level
    from public.characters character
    where character.progression_cycle in (
      select mapping.progression_cycle
      from app_private.progression_cycle_level_curves mapping
      where mapping.curve_version = 3
    )
    for update
  loop
    v_resolved_level := app_private.resolve_level_from_curve(v_character.xp, v_thresholds, 100);
    if v_character.level <> v_resolved_level then
      update public.characters
      set level = v_resolved_level
      where id = v_character.id;
    end if;
  end loop;
end;
$$;

-- Primary identity still owns focus vs non-focus limits, but non-focus investment now reaches 40.
alter table app_private.discipline_primary_profiles
  alter column off_focus_cap set default 40;

update app_private.discipline_primary_profiles
set off_focus_cap = 40
where off_focus_cap = 30;

comment on column app_private.discipline_primary_profiles.off_focus_cap is
  'Maximum effective Core Stat value for attributes outside this Primary focus. Current approved ceiling: 40.';

alter table app_private.character_attribute_change_audit
  drop constraint character_attribute_change_level_range,
  add constraint character_attribute_change_level_range
    check (level_at_change between 1 and 100);

-- The v2 allocation boundary calls this private validator, so widen its authoritative Level range.
create or replace function app_private.validate_character_core_allocation_v1(
  p_might integer,
  p_finesse integer,
  p_vitality integer,
  p_agility integer,
  p_intellect integer,
  p_resolve integer,
  p_level integer,
  p_base jsonb,
  p_focus text[],
  p_off_focus_cap integer,
  p_require_full boolean
)
returns void
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
declare
  v_personal_pool integer;
  v_personal_spent integer;
begin
  if p_level is null or p_level not between 1 and 100 then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_LEVEL_INVALID';
  end if;
  if p_base is null or p_focus is null or p_off_focus_cap is null then
    raise exception using errcode = 'P0001', message = 'CHARACTER_ATTRIBUTE_PRIMARY_PROFILE_UNAVAILABLE';
  end if;
  if p_might is null or p_finesse is null or p_vitality is null
    or p_agility is null or p_intellect is null or p_resolve is null then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_VALUE_INVALID';
  end if;

  if p_might < (p_base ->> 'might')::integer
    or p_finesse < (p_base ->> 'finesse')::integer
    or p_vitality < (p_base ->> 'vitality')::integer
    or p_agility < (p_base ->> 'agility')::integer
    or p_intellect < (p_base ->> 'intellect')::integer
    or p_resolve < (p_base ->> 'resolve')::integer then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_BELOW_PRIMARY_BASE';
  end if;

  v_personal_pool := 5 + p_level - 1;
  v_personal_spent :=
    p_might - (p_base ->> 'might')::integer +
    p_finesse - (p_base ->> 'finesse')::integer +
    p_vitality - (p_base ->> 'vitality')::integer +
    p_agility - (p_base ->> 'agility')::integer +
    p_intellect - (p_base ->> 'intellect')::integer +
    p_resolve - (p_base ->> 'resolve')::integer;

  if v_personal_spent > v_personal_pool then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_POINT_POOL_EXCEEDED';
  end if;
  if p_require_full and v_personal_spent <> v_personal_pool then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_RESET_MUST_SPEND_FULL_POOL';
  end if;

  if ('might' <> all(p_focus) and p_might > p_off_focus_cap)
    or ('finesse' <> all(p_focus) and p_finesse > p_off_focus_cap)
    or ('vitality' <> all(p_focus) and p_vitality > p_off_focus_cap)
    or ('agility' <> all(p_focus) and p_agility > p_off_focus_cap)
    or ('intellect' <> all(p_focus) and p_intellect > p_off_focus_cap)
    or ('resolve' <> all(p_focus) and p_resolve > p_off_focus_cap) then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_DISCIPLINE_CAP_EXCEEDED';
  end if;
end;
$$;

-- The v2 spend/reset path delegates to the v1 transactional command. Keep its exact authority,
-- idempotency, reset-window and audit semantics while widening only the accepted Level range.
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
  level integer,
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
  if p_user_id is null or p_character_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_IDENTITY_INVALID';
  end if;

  if p_mode not in ('spend', 'reset') then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_MODE_INVALID';
  end if;

  if p_might is null
    or p_finesse is null
    or p_vitality is null
    or p_agility is null
    or p_intellect is null
    or p_resolve is null
    or least(p_might, p_finesse, p_vitality, p_agility, p_intellect, p_resolve) < 1 then
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
      audit.level_at_change::integer,
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

  if v_character.level < 1 or v_character.level > 100 then
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
    on conflict on constraint character_attribute_reset_windows_pkey do update
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

commit;
