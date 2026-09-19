begin;

create table app_private.master_panel_capability_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (
    capability in (
      'moderation.permanent_ban',
      'content.story_copy',
      'content.production_publish',
      'events.production_publish',
      'events.global_scope',
      'events.reward_titles',
      'events.emergency_stop',
      'balance.edit_selected',
      'support.issue_compensation'
    )
  ),
  enabled boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  note text not null check (char_length(note) between 3 and 240 and btrim(note) = note),
  primary key (user_id, capability)
);

alter table app_private.master_panel_capability_grants enable row level security;

revoke all on table app_private.master_panel_capability_grants
  from public, anon, authenticated, service_role;

comment on table app_private.master_panel_capability_grants is
  'Explicit Owner-granted account capabilities. These never create another staff role or grant root staff-management authority.';

alter table app_private.master_panel_access_audit
  drop constraint if exists master_panel_access_audit_action_check;

alter table app_private.master_panel_access_audit
  add constraint master_panel_access_audit_action_check
  check (
    action in (
      'role.migrated',
      'role.granted',
      'role.revoked',
      'capability.granted',
      'capability.revoked'
    )
  );

drop function public.read_master_panel_access_v1(uuid);

create or replace function public.read_master_panel_access_v1(
  p_user_id uuid
)
returns table (
  user_id uuid,
  access_version bigint,
  roles text[],
  special_capabilities text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_roles text[];
  v_special_capabilities text[];
  v_access_version bigint;
begin
  select coalesce(
    array_agg(
      assignment.role
      order by case assignment.role
        when 'game-owner' then 1
        when 'moderator' then 2
        when 'content-staff' then 3
        when 'event-staff' then 4
        else 5
      end
    ),
    array[]::text[]
  )
  into v_roles
  from app_private.master_panel_role_assignments as assignment
  where assignment.user_id = p_user_id
    and assignment.enabled = true;

  select coalesce(array_agg(grant_row.capability order by grant_row.capability), array[]::text[])
  into v_special_capabilities
  from app_private.master_panel_capability_grants as grant_row
  where grant_row.user_id = p_user_id
    and grant_row.enabled = true;

  if cardinality(v_roles) = 0 then
    return;
  end if;

  select version.access_version
  into v_access_version
  from app_private.master_panel_access_versions as version
  where version.user_id = p_user_id;

  return query
  select p_user_id, coalesce(v_access_version, 1), v_roles, v_special_capabilities;
end;
$$;

create or replace function public.list_master_panel_staff_v1(
  p_actor_user_id uuid
)
returns table (
  user_id uuid,
  email text,
  access_version bigint,
  roles text[],
  special_capabilities text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);

  return query
  with staff_users as (
    select distinct assignment.user_id
    from app_private.master_panel_role_assignments as assignment
    where assignment.enabled = true
  )
  select
    account.id,
    account.email::text,
    coalesce(version.access_version, 1),
    coalesce(
      (
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
        from app_private.master_panel_role_assignments as assignment
        where assignment.user_id = account.id
          and assignment.enabled = true
      ),
      array[]::text[]
    ),
    coalesce(
      (
        select array_agg(grant_row.capability order by grant_row.capability)
        from app_private.master_panel_capability_grants as grant_row
        where grant_row.user_id = account.id
          and grant_row.enabled = true
      ),
      array[]::text[]
    )
  from staff_users
  join auth.users as account on account.id = staff_users.user_id
  left join app_private.master_panel_access_versions as version on version.user_id = account.id
  order by lower(coalesce(account.email, '')), account.id;
end;
$$;

create or replace function public.resolve_master_panel_account_v1(
  p_actor_user_id uuid,
  p_email text
)
returns table (
  user_id uuid,
  email text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);

  if p_email is null
    or char_length(p_email) < 3
    or char_length(p_email) > 320
    or btrim(p_email) <> p_email
  then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_ACCOUNT_EMAIL_INVALID';
  end if;

  return query
  select account.id, account.email::text
  from auth.users as account
  where lower(account.email) = lower(p_email)
  limit 1;
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
  if p_note is null
    or char_length(p_note) < 3
    or char_length(p_note) > 240
    or btrim(p_note) <> p_note
  then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_REASON_REQUIRED';
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
  if p_note is null
    or char_length(p_note) < 3
    or char_length(p_note) > 240
    or btrim(p_note) <> p_note
  then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_REASON_REQUIRED';
  end if;

  if exists (
    select 1
    from app_private.master_panel_role_assignments as current_assignment
    where current_assignment.user_id = p_target_user_id
      and current_assignment.role = p_role
      and current_assignment.enabled = true
  )
    and exists (
      select 1
      from app_private.master_panel_capability_grants as grant_row
      where grant_row.user_id = p_target_user_id
        and grant_row.enabled = true
    )
    and not exists (
      select 1
      from app_private.master_panel_role_assignments as other_role
      where other_role.user_id = p_target_user_id
        and other_role.role in ('moderator','content-staff','event-staff')
        and other_role.role <> p_role
        and other_role.enabled = true
    )
  then
    raise exception using
      errcode = '22023',
      message = 'MASTER_PANEL_ROLE_REQUIRED_FOR_CAPABILITY';
  end if;

  update app_private.master_panel_role_assignments as assignment
  set
    enabled = false,
    updated_at = clock_timestamp(),
    note = p_note
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

create or replace function public.grant_master_panel_capability_v1(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_capability text,
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
    raise exception using
      errcode = '22023',
      message = 'MASTER_PANEL_SELF_CAPABILITY_GRANT_FORBIDDEN';
  end if;
  if p_capability in ('master.access','staff.manage') then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_ROOT_CAPABILITY_PROTECTED';
  end if;
  if p_capability not in (
    'moderation.permanent_ban',
    'content.story_copy',
    'content.production_publish',
    'events.production_publish',
    'events.global_scope',
    'events.reward_titles',
    'events.emergency_stop',
    'balance.edit_selected',
    'support.issue_compensation'
  ) then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_CAPABILITY_INVALID';
  end if;
  if not exists (select 1 from auth.users as account where account.id = p_target_user_id) then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_TARGET_NOT_FOUND';
  end if;
  if not exists (
    select 1
    from app_private.master_panel_role_assignments as assignment
    where assignment.user_id = p_target_user_id
      and assignment.role in ('moderator','content-staff','event-staff')
      and assignment.enabled = true
  ) then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_STAFF_ROLE_REQUIRED';
  end if;
  if p_note is null
    or char_length(p_note) < 3
    or char_length(p_note) > 240
    or btrim(p_note) <> p_note
  then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_REASON_REQUIRED';
  end if;

  select grant_row.enabled
  into v_was_enabled
  from app_private.master_panel_capability_grants as grant_row
  where grant_row.user_id = p_target_user_id
    and grant_row.capability = p_capability;

  if v_was_enabled is true then
    select version.access_version
    into v_version
    from app_private.master_panel_access_versions as version
    where version.user_id = p_target_user_id;
    return coalesce(v_version, 1);
  end if;

  insert into app_private.master_panel_capability_grants (
    user_id,
    capability,
    enabled,
    granted_by,
    granted_at,
    updated_at,
    note
  ) values (
    p_target_user_id,
    p_capability,
    true,
    p_actor_user_id,
    clock_timestamp(),
    clock_timestamp(),
    p_note
  )
  on conflict (user_id, capability) do update
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
    'capability.granted',
    p_capability,
    jsonb_build_object('enabled', coalesce(v_was_enabled, false)),
    jsonb_build_object('enabled', true, 'accessVersion', v_version),
    p_note
  );

  return v_version;
end;
$$;

create or replace function public.revoke_master_panel_capability_v1(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_capability text,
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

  if p_capability in ('master.access','staff.manage') then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_ROOT_CAPABILITY_PROTECTED';
  end if;
  if p_capability not in (
    'moderation.permanent_ban',
    'content.story_copy',
    'content.production_publish',
    'events.production_publish',
    'events.global_scope',
    'events.reward_titles',
    'events.emergency_stop',
    'balance.edit_selected',
    'support.issue_compensation'
  ) then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_CAPABILITY_INVALID';
  end if;
  if not exists (select 1 from auth.users as account where account.id = p_target_user_id) then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_TARGET_NOT_FOUND';
  end if;
  if p_note is null
    or char_length(p_note) < 3
    or char_length(p_note) > 240
    or btrim(p_note) <> p_note
  then
    raise exception using errcode = '22023', message = 'MASTER_PANEL_REASON_REQUIRED';
  end if;

  update app_private.master_panel_capability_grants as grant_row
  set
    enabled = false,
    updated_at = clock_timestamp(),
    note = p_note
  where grant_row.user_id = p_target_user_id
    and grant_row.capability = p_capability
    and grant_row.enabled = true;

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
    'capability.revoked',
    p_capability,
    jsonb_build_object('enabled', true),
    jsonb_build_object('enabled', false, 'accessVersion', v_version),
    p_note
  );

  return v_version;
end;
$$;

revoke all on function public.read_master_panel_access_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.list_master_panel_staff_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.resolve_master_panel_account_v1(uuid, text)
  from public, anon, authenticated;
revoke all on function public.grant_master_panel_capability_v1(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.revoke_master_panel_capability_v1(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.read_master_panel_access_v1(uuid) to service_role;
grant execute on function public.list_master_panel_staff_v1(uuid) to service_role;
grant execute on function public.resolve_master_panel_account_v1(uuid, text) to service_role;
grant execute on function public.grant_master_panel_capability_v1(uuid, uuid, text, text)
  to service_role;
grant execute on function public.revoke_master_panel_capability_v1(uuid, uuid, text, text)
  to service_role;

comment on function public.list_master_panel_staff_v1(uuid) is
  'Game Owner-only staff authority roster read through the service boundary.';
comment on function public.resolve_master_panel_account_v1(uuid, text) is
  'Game Owner-only exact-email account lookup used by the staff authority panel.';
comment on function public.grant_master_panel_capability_v1(uuid, uuid, text, text) is
  'Game Owner-only explicit special capability grant. Root access and staff management are excluded.';
comment on function public.revoke_master_panel_capability_v1(uuid, uuid, text, text) is
  'Game Owner-only explicit special capability revocation with access-version bump and audit.';

commit;
