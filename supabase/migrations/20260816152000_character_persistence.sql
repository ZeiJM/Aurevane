begin;

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  slot_index smallint not null,
  rules_version integer not null,
  name text not null,
  name_key text not null,
  presentation_id text not null,
  pronoun_preset_id text not null,
  portrait_ref text not null,
  starter_appearance_ref text not null,
  foundation_discipline_id text not null,
  might integer not null,
  finesse integer not null,
  intellect integer not null,
  resolve integer not null,
  level integer not null,
  xp bigint not null,
  progression_cycle integer not null,
  created_at timestamptz not null,
  cycle_started_at timestamptz not null,
  last_active_at timestamptz not null,
  constraint characters_slot_index_nonnegative check (slot_index >= 0),
  constraint characters_rules_version_positive check (rules_version > 0),
  constraint characters_name_length check (char_length(name) between 1 and 80),
  constraint characters_name_key_length check (char_length(name_key) between 1 and 80),
  constraint characters_presentation_length check (char_length(presentation_id) between 1 and 80),
  constraint characters_pronoun_length check (char_length(pronoun_preset_id) between 1 and 80),
  constraint characters_portrait_length check (char_length(portrait_ref) between 1 and 160),
  constraint characters_appearance_length check (char_length(starter_appearance_ref) between 1 and 160),
  constraint characters_foundation_discipline_length check (
    char_length(foundation_discipline_id) between 1 and 80
  ),
  constraint characters_attributes_positive check (
    might > 0 and finesse > 0 and intellect > 0 and resolve > 0
  ),
  constraint characters_level_range check (level between 1 and 100),
  constraint characters_xp_nonnegative check (xp >= 0),
  constraint characters_progression_cycle_positive check (progression_cycle > 0),
  constraint characters_user_slot_unique unique (user_id, slot_index),
  constraint characters_name_key_unique unique (name_key)
);

comment on table public.characters is
  'Private server-authoritative AUREVANE character state. Browser roles may read only their own rows.';

create index characters_user_id_idx on public.characters (user_id);

alter table public.characters enable row level security;

revoke all on table public.characters from public;
revoke all on table public.characters from anon;
revoke all on table public.characters from authenticated;
grant select on table public.characters to authenticated;

create policy characters_select_own
on public.characters
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.create_base_character_v1(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_rules_version integer,
  p_name text,
  p_name_key text,
  p_presentation_id text,
  p_pronoun_preset_id text,
  p_portrait_ref text,
  p_starter_appearance_ref text,
  p_foundation_discipline_id text,
  p_might integer,
  p_finesse integer,
  p_intellect integer,
  p_resolve integer
)
returns table (
  id uuid,
  user_id uuid,
  slot_index smallint,
  rules_version integer,
  name text,
  name_key text,
  presentation_id text,
  pronoun_preset_id text,
  portrait_ref text,
  starter_appearance_ref text,
  foundation_discipline_id text,
  might integer,
  finesse integer,
  intellect integer,
  resolve integer,
  level integer,
  xp bigint,
  progression_cycle integer,
  created_at timestamptz,
  cycle_started_at timestamptz,
  last_active_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_command_name constant text := 'character.create.v1';
  v_slot_index constant smallint := 0;
  v_character_id uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
  v_existing app_private.idempotency_records%rowtype;
  v_rows_inserted integer;
  v_constraint_name text;
begin
  if not exists (
    select 1
    from public.player_profiles
    where player_profiles.user_id = p_user_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'PLAYER_PROFILE_UNAVAILABLE';
  end if;

  insert into app_private.idempotency_records (
    actor_key,
    command_name,
    idempotency_key,
    request_fingerprint,
    result
  )
  values (
    'user:' || p_user_id::text,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object('character_id', v_character_id)
  )
  on conflict (actor_key, command_name, idempotency_key) do nothing;

  get diagnostics v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select *
    into v_existing
    from app_private.idempotency_records
    where actor_key = 'user:' || p_user_id::text
      and command_name = v_command_name
      and idempotency_key = p_idempotency_key;

    if not found then
      raise exception using
        errcode = '40001',
        message = 'idempotency record unavailable after conflict';
    end if;

    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using
        errcode = '22023',
        message = 'idempotency key reused with a different request fingerprint';
    end if;

    return query
    select
      c.id,
      c.user_id,
      c.slot_index,
      c.rules_version,
      c.name,
      c.name_key,
      c.presentation_id,
      c.pronoun_preset_id,
      c.portrait_ref,
      c.starter_appearance_ref,
      c.foundation_discipline_id,
      c.might,
      c.finesse,
      c.intellect,
      c.resolve,
      c.level,
      c.xp,
      c.progression_cycle,
      c.created_at,
      c.cycle_started_at,
      c.last_active_at,
      true
    from public.characters c
    where c.id = (v_existing.result ->> 'character_id')::uuid
      and c.user_id = p_user_id;

    if not found then
      raise exception using
        errcode = '40001',
        message = 'idempotent character result unavailable';
    end if;

    return;
  end if;

  insert into public.characters (
    id,
    user_id,
    slot_index,
    rules_version,
    name,
    name_key,
    presentation_id,
    pronoun_preset_id,
    portrait_ref,
    starter_appearance_ref,
    foundation_discipline_id,
    might,
    finesse,
    intellect,
    resolve,
    level,
    xp,
    progression_cycle,
    created_at,
    cycle_started_at,
    last_active_at
  )
  values (
    v_character_id,
    p_user_id,
    v_slot_index,
    p_rules_version,
    p_name,
    p_name_key,
    p_presentation_id,
    p_pronoun_preset_id,
    p_portrait_ref,
    p_starter_appearance_ref,
    p_foundation_discipline_id,
    p_might,
    p_finesse,
    p_intellect,
    p_resolve,
    1,
    0,
    1,
    v_now,
    v_now,
    v_now
  );

  return query
  select
    c.id,
    c.user_id,
    c.slot_index,
    c.rules_version,
    c.name,
    c.name_key,
    c.presentation_id,
    c.pronoun_preset_id,
    c.portrait_ref,
    c.starter_appearance_ref,
    c.foundation_discipline_id,
    c.might,
    c.finesse,
    c.intellect,
    c.resolve,
    c.level,
    c.xp,
    c.progression_cycle,
    c.created_at,
    c.cycle_started_at,
    c.last_active_at,
    false
  from public.characters c
  where c.id = v_character_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint_name = constraint_name;

    if v_constraint_name = 'characters_name_key_unique' then
      raise exception using
        errcode = 'P0001',
        message = 'CHARACTER_NAME_UNAVAILABLE';
    end if;

    if v_constraint_name = 'characters_user_slot_unique' then
      raise exception using
        errcode = 'P0001',
        message = 'CHARACTER_SLOT_OCCUPIED';
    end if;

    raise;
end;
$$;

comment on function public.create_base_character_v1(
  uuid,
  uuid,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer
) is
  'Atomically creates the one enabled base character slot from server-validated canonical creation state with durable retry protection.';

revoke all on function public.create_base_character_v1(
  uuid,
  uuid,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer
) from public;
revoke all on function public.create_base_character_v1(
  uuid,
  uuid,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer
) from anon;
revoke all on function public.create_base_character_v1(
  uuid,
  uuid,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer
) from authenticated;
grant execute on function public.create_base_character_v1(
  uuid,
  uuid,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer
) to service_role;

commit;
