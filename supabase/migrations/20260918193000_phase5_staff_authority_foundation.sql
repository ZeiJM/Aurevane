begin;

create table app_private.master_panel_role_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('game-owner','moderator','content-staff','event-staff')),
  enabled boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  note text check (note is null or char_length(note) between 1 and 240),
  primary key (user_id, role)
);

create table app_private.master_panel_access_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_version bigint not null default 1 check (access_version >= 1),
  updated_at timestamptz not null default clock_timestamp()
);

create table app_private.master_panel_access_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  target_user_id uuid,
  action text not null check (action in ('role.migrated','role.granted','role.revoked')),
  subject text not null,
  before_state jsonb,
  after_state jsonb,
  note text check (note is null or char_length(note) between 1 and 240),
  created_at timestamptz not null default clock_timestamp()
);

alter table app_private.master_panel_role_assignments enable row level security;
alter table app_private.master_panel_access_versions enable row level security;
alter table app_private.master_panel_access_audit enable row level security;

revoke all on table app_private.master_panel_role_assignments
  from public, anon, authenticated, service_role;
revoke all on table app_private.master_panel_access_versions
  from public, anon, authenticated, service_role;
revoke all on table app_private.master_panel_access_audit
  from public, anon, authenticated, service_role;

comment on table app_private.master_panel_role_assignments is
  'Canonical fixed Master Panel role assignments. Multiple delegated roles may coexist per account.';
comment on table app_private.master_panel_access_versions is
  'Monotonic staff-access version bumped on every effective delegated role change.';
comment on table app_private.master_panel_access_audit is
  'Durable server-only audit history for Master Panel role migration, grant and revocation. Principal UUIDs intentionally survive account deletion.';

insert into app_private.master_panel_role_assignments (
  user_id,
  role,
  enabled,
  granted_by,
  granted_at,
  updated_at,
  note
)
select
  legacy.user_id,
  case legacy.role
    when 'owner' then 'game-owner'
    else 'content-staff'
  end,
  legacy.enabled,
  legacy.granted_by,
  legacy.granted_at,
  legacy.granted_at,
  legacy.note
from app_private.master_panel_operators as legacy
on conflict (user_id, role) do update
set
  enabled = excluded.enabled,
  granted_by = excluded.granted_by,
  granted_at = excluded.granted_at,
  updated_at = excluded.updated_at,
  note = excluded.note;

create unique index master_panel_single_enabled_game_owner_uq
  on app_private.master_panel_role_assignments (role)
  where role = 'game-owner' and enabled = true;

comment on index app_private.master_panel_single_enabled_game_owner_uq is
  'Enforces at most one enabled Game Owner while allowing historical disabled Owner assignments.';

insert into app_private.master_panel_access_versions (user_id, access_version)
select distinct assignment.user_id, 1
from app_private.master_panel_role_assignments as assignment
on conflict (user_id) do nothing;

insert into app_private.master_panel_access_audit (
  actor_user_id,
  target_user_id,
  action,
  subject,
  before_state,
  after_state,
  note
)
select
  assignment.granted_by,
  assignment.user_id,
  'role.migrated',
  assignment.role,
  jsonb_build_object('legacy', true),
  jsonb_build_object('enabled', assignment.enabled),
  'Migrated from legacy Master Panel operator authorization.'
from app_private.master_panel_role_assignments as assignment;

create or replace function app_private.bump_master_panel_access_version_v1(
  p_user_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_version bigint;
begin
  insert into app_private.master_panel_access_versions (
    user_id,
    access_version,
    updated_at
  ) values (
    p_user_id,
    1,
    clock_timestamp()
  )
  on conflict (user_id) do update
  set
    access_version = app_private.master_panel_access_versions.access_version + 1,
    updated_at = clock_timestamp()
  returning access_version into v_version;

  return v_version;
end;
$$;

create or replace function app_private.assert_game_owner_v1(
  p_actor_user_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if not exists (
    select 1
    from app_private.master_panel_role_assignments as assignment
    where assignment.user_id = p_actor_user_id
      and assignment.role = 'game-owner'
      and assignment.enabled = true
  ) then
    raise exception using
      errcode = '42501',
      message = 'MASTER_PANEL_OWNER_REQUIRED';
  end if;
end;
$$;

create or replace function app_private.assert_master_panel_operator_v1(
  p_actor_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if exists (
    select 1
    from app_private.master_panel_role_assignments as assignment
    where assignment.user_id = p_actor_user_id
      and assignment.role = 'game-owner'
      and assignment.enabled = true
  ) then
    return 'owner';
  end if;

  if exists (
    select 1
    from app_private.master_panel_role_assignments as assignment
    where assignment.user_id = p_actor_user_id
      and assignment.role = 'content-staff'
      and assignment.enabled = true
  ) then
    return 'content-staff';
  end if;

  raise exception using
    errcode = '42501',
    message = 'MASTER_PANEL_OPERATOR_REQUIRED';
end;
$$;

revoke all on function app_private.bump_master_panel_access_version_v1(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app_private.assert_game_owner_v1(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app_private.assert_master_panel_operator_v1(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.read_master_panel_access_v1(
  p_user_id uuid
)
returns table (
  user_id uuid,
  access_version bigint,
  roles text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_roles text[];
  v_access_version bigint;
begin
  select array_agg(
    assignment.role
    order by case assignment.role
      when 'game-owner' then 1
      when 'moderator' then 2
      when 'content-staff' then 3
      when 'event-staff' then 4
      else 5
    end
  )
  into v_roles
  from app_private.master_panel_role_assignments as assignment
  where assignment.user_id = p_user_id
    and assignment.enabled = true;

  if v_roles is null or cardinality(v_roles) = 0 then
    return;
  end if;

  select version.access_version
  into v_access_version
  from app_private.master_panel_access_versions as version
  where version.user_id = p_user_id;

  return query
  select p_user_id, coalesce(v_access_version, 1), v_roles;
end;
$$;

create or replace function public.read_master_panel_operator_v1(
  p_user_id uuid
)
returns table (
  user_id uuid,
  role text,
  enabled boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_role text;
begin
  if exists (
    select 1
    from app_private.master_panel_role_assignments as assignment
    where assignment.user_id = p_user_id
      and assignment.role = 'game-owner'
      and assignment.enabled = true
  ) then
    v_role := 'owner';
  elsif exists (
    select 1
    from app_private.master_panel_role_assignments as assignment
    where assignment.user_id = p_user_id
      and assignment.role = 'content-staff'
      and assignment.enabled = true
  ) then
    v_role := 'content-staff';
  else
    return;
  end if;

  return query select p_user_id, v_role, true;
end;
$$;

create or replace function public.grant_master_panel_role_v1(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_role text,
  p_note text
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_version bigint;
  v_was_enabled boolean;
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);

  if p_actor_user_id = p_target_user_id then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_SELF_GRANT_FORBIDDEN';
  end if;
  if p_role = 'game-owner' then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_OWNER_ROLE_PROTECTED';
  end if;
  if p_role not in ('moderator','content-staff','event-staff') then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_ROLE_INVALID';
  end if;
  if not exists (select 1 from auth.users as account where account.id = p_target_user_id) then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_TARGET_NOT_FOUND';
  end if;
  if p_note is not null and (
    char_length(p_note) < 1
    or char_length(p_note) > 240
    or btrim(p_note) <> p_note
  ) then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_NOTE_INVALID';
  end if;

  select assignment.enabled
  into v_was_enabled
  from app_private.master_panel_role_assignments as assignment
  where assignment.user_id = p_target_user_id
    and assignment.role = p_role;

  if v_was_enabled is true then
    select version.access_version
    into v_version
    from app_private.master_panel_access_versions as version
    where version.user_id = p_target_user_id;
    return coalesce(v_version, 1);
  end if;

  insert into app_private.master_panel_role_assignments (
    user_id,
    role,
    enabled,
    granted_by,
    granted_at,
    updated_at,
    note
  ) values (
    p_target_user_id,
    p_role,
    true,
    p_actor_user_id,
    clock_timestamp(),
    clock_timestamp(),
    p_note
  )
  on conflict (user_id, role) do update
  set
    enabled = true,
    granted_by = excluded.granted_by,
    granted_at = excluded.granted_at,
    updated_at = excluded.updated_at,
    note = excluded.note;

  v_version := app_private.bump_master_panel_access_version_v1(p_target_user_id);

  insert into app_private.master_panel_access_audit (
    actor_user_id,
    target_user_id,
    action,
    subject,
    before_state,
    after_state,
    note
  ) values (
    p_actor_user_id,
    p_target_user_id,
    'role.granted',
    p_role,
    jsonb_build_object('enabled', coalesce(v_was_enabled, false)),
    jsonb_build_object('enabled', true, 'accessVersion', v_version),
    p_note
  );

  return v_version;
end;
$$;

create or replace function public.revoke_master_panel_role_v1(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_role text,
  p_note text
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_version bigint;
  v_changed integer;
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);

  if p_role = 'game-owner' then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_OWNER_ROLE_PROTECTED';
  end if;
  if p_role not in ('moderator','content-staff','event-staff') then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_ROLE_INVALID';
  end if;
  if not exists (select 1 from auth.users as account where account.id = p_target_user_id) then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_TARGET_NOT_FOUND';
  end if;
  if p_note is not null and (
    char_length(p_note) < 1
    or char_length(p_note) > 240
    or btrim(p_note) <> p_note
  ) then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_NOTE_INVALID';
  end if;

  update app_private.master_panel_role_assignments as assignment
  set
    enabled = false,
    updated_at = clock_timestamp(),
    note = coalesce(p_note, assignment.note)
  where assignment.user_id = p_target_user_id
    and assignment.role = p_role
    and assignment.enabled = true;

  get diagnostics v_changed = row_count;

  if v_changed = 0 then
    select version.access_version
    into v_version
    from app_private.master_panel_access_versions as version
    where version.user_id = p_target_user_id;
    return coalesce(v_version, 1);
  end if;

  v_version := app_private.bump_master_panel_access_version_v1(p_target_user_id);

  insert into app_private.master_panel_access_audit (
    actor_user_id,
    target_user_id,
    action,
    subject,
    before_state,
    after_state,
    note
  ) values (
    p_actor_user_id,
    p_target_user_id,
    'role.revoked',
    p_role,
    jsonb_build_object('enabled', true),
    jsonb_build_object('enabled', false, 'accessVersion', v_version),
    p_note
  );

  return v_version;
end;
$$;

revoke all on function public.read_master_panel_access_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.read_master_panel_operator_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.grant_master_panel_role_v1(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.revoke_master_panel_role_v1(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.read_master_panel_access_v1(uuid) to service_role;
grant execute on function public.read_master_panel_operator_v1(uuid) to service_role;
grant execute on function public.grant_master_panel_role_v1(uuid, uuid, text, text) to service_role;
grant execute on function public.revoke_master_panel_role_v1(uuid, uuid, text, text) to service_role;

comment on function public.read_master_panel_access_v1(uuid) is
  'Service-only canonical multi-role Master Panel access read model with monotonic access version.';
comment on function public.grant_master_panel_role_v1(uuid, uuid, text, text) is
  'Game Owner-only delegated role grant. Game Owner identity cannot be created through this routine.';
comment on function public.revoke_master_panel_role_v1(uuid, uuid, text, text) is
  'Game Owner-only delegated role revocation with access-version bump and durable audit entry.';

comment on table app_private.master_panel_operators is
  'Legacy Master Panel authorization source retained for migration history. Runtime authorization is derived from master_panel_role_assignments.';

commit;
