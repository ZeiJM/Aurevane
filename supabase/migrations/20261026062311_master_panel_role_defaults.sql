begin;

create table app_private.master_panel_role_defaults (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 1 check (revision > 0),
  roles jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default clock_timestamp()
);
alter table app_private.master_panel_role_defaults enable row level security;
revoke all on table app_private.master_panel_role_defaults from public, anon, authenticated, service_role;
insert into app_private.master_panel_role_defaults(roles) values (
  '{"moderator":["master.access"],"content-staff":["master.access","content.combat.author"],"event-staff":["master.access","events.author","events.operate"]}'::jsonb
);

create function public.read_master_panel_role_defaults_v1(p_actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);
  return (select jsonb_build_object('revision',d.revision,'roles',d.roles) from app_private.master_panel_role_defaults d where singleton);
end; $$;

create function public.save_master_panel_role_defaults_v1(p_actor_user_id uuid,p_expected_revision bigint,p_roles jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_caps jsonb; v_revision bigint; v_current_roles jsonb; v_unchanged boolean := true;
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);
  if p_expected_revision is null or p_expected_revision < 1 or p_roles is null or jsonb_typeof(p_roles)<>'object' then
    raise exception using errcode='22023',message='MASTER_PANEL_ROLE_DEFAULTS_INVALID';
  end if;
  if (select count(*) from jsonb_object_keys(p_roles))<>3 or not p_roles ?& array['moderator','content-staff','event-staff'] then
    raise exception using errcode='22023',message='MASTER_PANEL_ROLE_DEFAULTS_INVALID';
  end if;
  foreach v_role in array array['moderator','content-staff','event-staff'] loop
    v_caps := p_roles->v_role;
    if jsonb_typeof(v_caps)<>'array' then raise exception using errcode='22023',message='MASTER_PANEL_ROLE_DEFAULTS_INVALID'; end if;
    if exists(select 1 from jsonb_array_elements(v_caps) c where jsonb_typeof(c)<>'string' or c #>> '{}' not in (
      'master.access','content.combat.author','events.author','events.operate',
      'moderation.permanent_ban','content.story_copy','content.production_publish','events.production_publish',
      'events.global_scope','events.reward_titles','events.emergency_stop','balance.edit_selected','support.issue_compensation'
    )) or jsonb_array_length(v_caps)<>(select count(distinct c) from jsonb_array_elements(v_caps) c) then
      raise exception using errcode='22023',message='MASTER_PANEL_ROLE_DEFAULTS_INVALID';
    end if;
  end loop;
  select revision,roles into v_revision,v_current_roles from app_private.master_panel_role_defaults where singleton for update;
  if v_revision<>p_expected_revision then raise exception using errcode='40001',message='MASTER_PANEL_ROLE_DEFAULTS_VERSION_CONFLICT'; end if;
  foreach v_role in array array['moderator','content-staff','event-staff'] loop
    if not ((v_current_roles->v_role) @> (p_roles->v_role) and (p_roles->v_role) @> (v_current_roles->v_role)) then
      v_unchanged := false;
    end if;
  end loop;
  if v_unchanged then return public.read_master_panel_role_defaults_v1(p_actor_user_id); end if;
  update app_private.master_panel_role_defaults set roles=p_roles,revision=revision+1,updated_by=p_actor_user_id,updated_at=clock_timestamp() where singleton;
  return public.read_master_panel_role_defaults_v1(p_actor_user_id);
end; $$;

-- One live authorization snapshot: selected linked character, expiry and revocation
-- remain governed by the existing reader. Explicit grants remain additive.
create function public.read_master_panel_access_v2(p_user_id uuid,p_actor_character_id uuid)
returns table(user_id uuid,access_version bigint,roles text[],special_capabilities text[],effective_capabilities text[])
language sql stable security definer set search_path = '' as $$
  select a.user_id,a.access_version,a.roles,a.special_capabilities,
    case when 'game-owner'=any(a.roles) then array[
      'master.access','staff.manage','content.combat.author','events.author','events.operate',
      'moderation.permanent_ban','content.story_copy','content.production_publish','events.production_publish',
      'events.global_scope','events.reward_titles','events.emergency_stop','balance.edit_selected','support.issue_compensation'
    ]::text[] else array(
      select distinct x.capability from (
        select jsonb_array_elements_text(d.roles->r.role) capability
        from app_private.master_panel_role_defaults d cross join unnest(a.roles) r(role) where d.singleton
        union all select unnest(a.special_capabilities)
      ) x where x.capability<>'staff.manage' order by x.capability
    ) end
  from public.read_master_panel_access_v1(p_user_id,p_actor_character_id) a;
$$;
create function public.read_master_panel_access_v2(p_user_id uuid)
returns table(user_id uuid,access_version bigint,roles text[],special_capabilities text[],effective_capabilities text[])
language sql stable security definer set search_path = '' as $$ select * from public.read_master_panel_access_v2(p_user_id,null::uuid); $$;

create or replace function app_private.has_master_capability_v2(p_user_id uuid,p_character_id uuid,p_capability text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.read_master_panel_access_v2(p_user_id,p_character_id) a where p_capability=any(a.effective_capabilities));
$$;
create or replace function public.read_master_panel_operator_v1(p_user_id uuid,p_actor_character_id uuid)
returns table(user_id uuid,role text,enabled boolean)
language sql stable security definer set search_path = '' as $$
  select p_user_id,case when 'game-owner'=any(a.roles) then 'owner' else 'content-staff' end,true
  from public.read_master_panel_access_v2(p_user_id,p_actor_character_id) a where 'content.combat.author'=any(a.effective_capabilities);
$$;

-- Event operation authority is independent from authoring authority.
create function app_private.assert_event_staff_operator_v1(p_actor_user_id uuid,p_actor_character_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'events.operate') then
    raise exception using errcode='42501',message='EVENT_STAFF_REQUIRED';
  end if;
  if app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'staff.manage') then return 'game-owner'; end if;
  return 'event-staff';
end; $$;

create function app_private.assert_event_operation_scope_v1(p_user_id uuid,p_character_id uuid,p_scope_type text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.assert_event_staff_operator_v1(p_user_id,p_character_id);
  if p_scope_type='global' and not app_private.has_master_capability_v2(p_user_id,p_character_id,'events.global_scope') then
    raise exception using errcode='42501',message='EVENT_GLOBAL_SCOPE_CAPABILITY_REQUIRED';
  end if;
end; $$;

do $migration$
declare v_function regprocedure; v_definition text;
begin
  for v_function in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where 'p_actor_character_id'=any(p.proargnames) and (
      (n.nspname='app_private' and p.proname in ('assert_event_emergency_stop_v1')) or
      (n.nspname='public' and p.proname in ('list_event_operation_runs_v1','read_event_operation_dashboard_v1','operate_event_run_v1','operate_event_run_v2','advance_event_run_phase_v1','advance_event_run_phase_v2','complete_event_cleanup_requirement_v1','complete_event_cleanup_requirement_v2'))
    )
  loop
    v_definition := pg_get_functiondef(v_function);
    if strpos(v_definition,'app_private.assert_event_staff_author_v1(')>0 then
      v_definition := replace(v_definition,'app_private.assert_event_staff_author_v1(','app_private.assert_event_staff_operator_v1(');
      v_definition := replace(v_definition,'app_private.assert_event_operational_scope_v1(','app_private.assert_event_operation_scope_v1(');
      execute v_definition;
    end if;
  end loop;
end; $migration$;

revoke all on function public.read_master_panel_role_defaults_v1(uuid),public.save_master_panel_role_defaults_v1(uuid,bigint,jsonb),public.read_master_panel_access_v2(uuid,uuid),public.read_master_panel_access_v2(uuid) from public,anon,authenticated,service_role;
grant execute on function public.read_master_panel_role_defaults_v1(uuid),public.save_master_panel_role_defaults_v1(uuid,bigint,jsonb),public.read_master_panel_access_v2(uuid,uuid),public.read_master_panel_access_v2(uuid) to service_role;
revoke all on function app_private.assert_event_operation_scope_v1(uuid,uuid,text),app_private.assert_event_staff_operator_v1(uuid,uuid) from public,anon,authenticated,service_role;

comment on table app_private.master_panel_role_defaults is 'Owner-managed defaults checked live for every selected-character protected operation. Root staff and global settings powers cannot be delegated.';
commit;
