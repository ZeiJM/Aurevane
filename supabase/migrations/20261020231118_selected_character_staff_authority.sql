begin;

-- Preserve predecessor account grants as unbound history. Only the protected
-- Owner remains an account identity; every delegated grant needs a character.
alter table app_private.master_panel_role_assignments
  add column id bigint generated always as identity,
  add column character_id uuid references public.characters(id) on delete cascade,
  add column expires_at timestamptz,
  drop constraint master_panel_role_assignments_pkey,
  add primary key (id),
  add unique (user_id, role, character_id),
  add constraint master_panel_owner_identity_protected
    check (role <> 'game-owner' or (character_id is null and expires_at is null));
alter table app_private.master_panel_capability_grants
  add column id bigint generated always as identity,
  add column character_id uuid references public.characters(id) on delete cascade,
  add column expires_at timestamptz,
  alter column note drop not null,
  drop constraint master_panel_capability_grants_pkey,
  add primary key (id),
  add unique (user_id, capability, character_id);
alter table app_private.master_panel_access_audit
  add column actor_character_id uuid,
  add column target_character_id uuid;
create unique index master_panel_legacy_role_identity_uq
  on app_private.master_panel_role_assignments(user_id,role) where character_id is null;
create unique index master_panel_legacy_capability_identity_uq
  on app_private.master_panel_capability_grants(user_id,capability) where character_id is null;

create or replace function app_private.assert_staff_character_v2(p_character_id uuid, p_user_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.characters c where c.id = p_character_id and c.user_id = p_user_id
      and not exists (select 1 from app_private.character_deletion_requests d where d.character_id = c.id)
  ) then
    raise exception using errcode = '42501', message = 'MASTER_PANEL_CHARACTER_REQUIRED';
  end if;
end;
$$;
revoke all on function app_private.assert_staff_character_v2(uuid,uuid) from public,anon,authenticated,service_role;

-- Evolve the *installed* definitions, including guarded body amendments and the
-- private complete-Essence/version-floor publisher. Never reconstruct them from
-- an older migration. The recursive inventory also covers nested authoring RPCs.
do $migration$
declare
  v_row record;
  v_dependency record;
  v_definition text;
  v_signature text;
  v_new_signature text;
  v_added integer;
begin
  create temporary table staff_authority_functions on commit drop as
    select p.oid, n.nspname || '.' || p.proname as name,
      pg_get_function_identity_arguments(p.oid) as arguments,
      pg_get_functiondef(p.oid) as definition,
      has_function_privilege('service_role',p.oid,'execute') as service_allowed
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','app_private') and p.prokind='f'
      and (p.prosrc ~ 'master_panel_(role_assignments|capability_grants|operators)'
        or p.proname in ('assert_game_owner_v1','assert_master_panel_operator_v1','assert_event_staff_author_v1'));
  loop
    insert into staff_authority_functions
      select distinct p.oid,n.nspname || '.' || p.proname,pg_get_function_identity_arguments(p.oid),
        pg_get_functiondef(p.oid),has_function_privilege('service_role',p.oid,'execute')
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','app_private') and p.prokind='f'
        and not exists(select 1 from staff_authority_functions x where x.oid=p.oid)
        and exists(select 1 from staff_authority_functions x where strpos(p.prosrc,x.name || '(')>0);
    get diagnostics v_added = row_count;
    exit when v_added=0;
  end loop;
  -- Staff management gets a selected-character, reason-free atomic contract below.
  for v_row in select * from staff_authority_functions loop
    v_signature := v_row.name || '(' || v_row.arguments || ')';
    execute 'revoke all on function ' || v_signature || ' from public,anon,authenticated,service_role';
  end loop;
  delete from staff_authority_functions where name in (
    'public.read_master_panel_access_v1','public.read_master_panel_operator_v1',
    'public.list_master_panel_staff_v1','public.resolve_master_panel_account_v1',
    'public.grant_master_panel_role_v1','public.revoke_master_panel_role_v1',
    'public.grant_master_panel_capability_v1','public.revoke_master_panel_capability_v1'
  );
  for v_row in select * from staff_authority_functions loop
    if v_row.arguments not like '%p_actor_user_id uuid%' and v_row.arguments not like '%p_actor uuid%' then
      raise exception 'STAFF_AUTHORITY_PREDECESSOR_CONFLICT: %',v_row.name;
    end if;
    v_definition := replace(v_row.definition, 'FUNCTION ' || v_row.name || '(',
      'FUNCTION ' || v_row.name || '(p_actor_character_id uuid, ');
    for v_dependency in select * from staff_authority_functions loop
      -- Skip the declaration itself, which already has the new parameter.
      v_definition := replace(v_definition, v_dependency.name || '(p_actor_user_id',
        v_dependency.name || '(p_actor_character_id, p_actor_user_id');
      v_definition := regexp_replace(v_definition, v_dependency.name || '\([[:space:]]*\n[[:space:]]*p_actor_user_id',
        v_dependency.name || '(p_actor_character_id, p_actor_user_id','g');
      v_definition := replace(v_definition, v_dependency.name || '(p_actor)',
        v_dependency.name || '(p_actor_character_id, p_actor)');
    end loop;
    v_definition := replace(v_definition, 'and assignment.enabled = true',
      'and assignment.enabled = true and (assignment.role = ''game-owner'' or assignment.character_id = p_actor_character_id) and (assignment.expires_at is null or assignment.expires_at > statement_timestamp())');
    v_definition := replace(v_definition, 'and grant_row.enabled = true',
      'and grant_row.enabled = true and grant_row.character_id = p_actor_character_id and (grant_row.expires_at is null or grant_row.expires_at > statement_timestamp())');
    if v_row.name in ('app_private.assert_game_owner_v1','app_private.assert_master_panel_operator_v1','app_private.assert_event_staff_author_v1') then
      v_definition := regexp_replace(v_definition,'begin',
        'begin perform app_private.assert_staff_character_v2(p_actor_character_id,p_actor_user_id);','i');
    end if;
    if v_definition = v_row.definition or strpos(v_definition,'p_actor_character_id uuid')=0 then
      raise exception 'STAFF_AUTHORITY_PREDECESSOR_CONFLICT: %',v_row.name;
    end if;
    execute v_definition;
    v_new_signature := v_row.name || '(uuid,' || v_row.arguments || ')';
    execute 'revoke all on function ' || v_new_signature || ' from public,anon,authenticated,service_role';
    if v_row.service_allowed and v_row.name like 'public.%' then
      execute 'grant execute on function ' || v_new_signature || ' to service_role';
    end if;
  end loop;
end;
$migration$;

create function public.read_master_panel_access_v1(p_actor_character_id uuid,p_user_id uuid)
returns table(user_id uuid,character_id uuid,access_version bigint,roles text[],special_capabilities text[])
language plpgsql stable security definer set search_path = '' as $$
declare v_roles text[];
begin
  perform app_private.assert_staff_character_v2(p_actor_character_id,p_user_id);
  select array_agg(distinct a.role order by a.role) into v_roles
    from app_private.master_panel_role_assignments a where a.user_id=p_user_id and a.enabled
      and (a.role='game-owner' or a.character_id=p_actor_character_id)
      and (a.expires_at is null or a.expires_at>statement_timestamp());
  if coalesce(cardinality(v_roles),0)=0 then return; end if;
  return query select p_user_id,p_actor_character_id,
    coalesce((select v.access_version from app_private.master_panel_access_versions v where v.user_id=p_user_id),1),
    v_roles,coalesce((select array_agg(distinct g.capability order by g.capability)
      from app_private.master_panel_capability_grants g where g.user_id=p_user_id and g.character_id=p_actor_character_id
        and g.enabled and (g.expires_at is null or g.expires_at>statement_timestamp())),array[]::text[]);
end;
$$;
create function public.read_master_panel_operator_v1(p_actor_character_id uuid,p_user_id uuid)
returns table(user_id uuid,role text,enabled boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query select p_user_id,app_private.assert_master_panel_operator_v1(p_actor_character_id,p_user_id),true;
end;
$$;

create function public.list_master_panel_staff_v1(p_actor_character_id uuid,p_actor_user_id uuid)
returns table(user_id uuid,character_id uuid,character_name text,email text,access_version bigint,roles text[],special_capabilities text[],status text,expires_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.assert_game_owner_v1(p_actor_character_id,p_actor_user_id);
  return query
  select a.user_id,a.character_id,c.name::text,u.email::text,coalesce(v.access_version,1),
    coalesce(array_agg(distinct a.role order by a.role) filter(where a.enabled),array[]::text[]),
    coalesce((select array_agg(distinct g.capability order by g.capability) from app_private.master_panel_capability_grants g
      where g.user_id=a.user_id and g.character_id is not distinct from a.character_id and g.enabled
        and (g.expires_at is null or g.expires_at>statement_timestamp())),array[]::text[]),
    case when bool_or(a.role='game-owner' and a.enabled) then 'owner'
      when not bool_or(a.enabled) then 'revoked'
      when a.character_id is null then 'needs-binding'
      when not bool_or(a.enabled and (a.expires_at is null or a.expires_at>statement_timestamp())) then 'expired'
      else 'active' end,
    case when not bool_or(a.enabled) then max(a.expires_at)
      when bool_or(a.enabled and a.expires_at is null) then null
      else max(a.expires_at) filter(where a.enabled) end
  from app_private.master_panel_role_assignments a join auth.users u on u.id=a.user_id
    left join public.characters c on c.id=a.character_id
    left join app_private.master_panel_access_versions v on v.user_id=a.user_id
  group by a.user_id,a.character_id,c.name,u.email,v.access_version
  order by lower(coalesce(c.name,u.email,'')),a.user_id;
end;
$$;

create function public.resolve_master_panel_accounts_v2(p_actor_character_id uuid,p_actor_user_id uuid,p_query text)
returns table(user_id uuid,email text,characters jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.assert_game_owner_v1(p_actor_character_id,p_actor_user_id);
  if p_query is null or length(p_query) not between 1 and 320 or btrim(p_query)<>p_query then
    raise exception using errcode='22023',message='MASTER_PANEL_LOOKUP_INVALID';
  end if;
  return query select u.id,u.email::text,coalesce((
    select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'playable',not exists(
      select 1 from app_private.character_deletion_requests d where d.character_id=c.id)) order by c.name,c.id)
    from public.characters c where c.user_id=u.id),'[]'::jsonb)
  from auth.users u where u.email_confirmed_at is not null and (
    lower(u.email)=lower(p_query) or exists(select 1 from public.characters c where c.user_id=u.id and lower(c.name)=lower(p_query)))
  order by lower(u.email),u.id limit 20;
end;
$$;

create function public.set_master_panel_character_access_v2(
  p_actor_character_id uuid,p_actor_user_id uuid,p_target_character_id uuid,
  p_roles text[],p_capabilities text[],p_days integer,p_bind_legacy boolean,p_expected_access_version bigint
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_target uuid; v_before jsonb; v_after jsonb; v_version bigint;
  v_now timestamptz := clock_timestamp(); v_expiry timestamptz;
begin
  perform app_private.assert_game_owner_v1(p_actor_character_id,p_actor_user_id);
  select c.user_id into v_target from public.characters c where c.id=p_target_character_id for update;
  perform app_private.assert_staff_character_v2(p_target_character_id,v_target);
  if not exists(select 1 from auth.users u where u.id=v_target and u.email_confirmed_at is not null) then
    raise exception using errcode='22023',message='MASTER_PANEL_TARGET_NOT_FOUND';
  end if;
  if v_target=p_actor_user_id or exists(select 1 from app_private.master_panel_role_assignments a where a.user_id=v_target and a.role='game-owner') then
    raise exception using errcode='22023',message='MASTER_PANEL_SELF_GRANT_FORBIDDEN';
  end if;
  if p_roles is null or cardinality(p_roles)=0 or not p_roles <@ array['moderator','content-staff','event-staff']::text[]
    or array_position(p_roles,null) is not null then
    raise exception using errcode='22023',message='MASTER_PANEL_ROLE_INVALID';
  end if;
  if p_capabilities is null or not p_capabilities <@ array['moderation.permanent_ban','content.story_copy','content.production_publish',
    'events.production_publish','events.global_scope','events.reward_titles','events.emergency_stop','balance.edit_selected','support.issue_compensation']::text[]
    or array_position(p_capabilities,null) is not null then
    raise exception using errcode='22023',message='MASTER_PANEL_CAPABILITY_INVALID';
  end if;
  if p_days is not null and p_days<=0 then raise exception using errcode='22023',message='MASTER_PANEL_EXPIRY_INVALID'; end if;
  -- Hours are elapsed UTC time even when the database timezone observes DST.
  v_expiry := case when p_days is null then null else v_now+p_days*interval '24 hours' end;
  perform pg_advisory_xact_lock(hashtextextended('staff-access:'||v_target::text,0));
  select coalesce(v.access_version,1) into v_version from app_private.master_panel_access_versions v where v.user_id=v_target;
  if (p_expected_access_version is null and exists(
      select 1 from app_private.master_panel_role_assignments a where a.user_id=v_target
        and (a.character_id=p_target_character_id or (p_bind_legacy and a.character_id is null and a.enabled))))
    or (p_expected_access_version is not null and coalesce(v_version,1)<>p_expected_access_version) then
    raise exception using errcode='40001',message='MASTER_PANEL_ACCESS_VERSION_CONFLICT';
  end if;
  if exists(select 1 from app_private.master_panel_role_assignments a where a.user_id=v_target and a.character_id is null and a.enabled)
    and p_bind_legacy is distinct from true then
    raise exception using errcode='22023',message='MASTER_PANEL_LEGACY_BINDING_REQUIRED';
  end if;
  select jsonb_build_object(
    'roles',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from app_private.master_panel_role_assignments a where a.user_id=v_target),
    'capabilities',(select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) from app_private.master_panel_capability_grants g where g.user_id=v_target)
  ) into v_before;
  update app_private.master_panel_role_assignments set enabled=false,updated_at=v_now
    where user_id=v_target and (character_id=p_target_character_id or (p_bind_legacy and character_id is null and role<>'game-owner'));
  update app_private.master_panel_capability_grants set enabled=false,updated_at=v_now
    where user_id=v_target and (character_id=p_target_character_id or (p_bind_legacy and character_id is null));
  insert into app_private.master_panel_role_assignments(user_id,character_id,role,enabled,granted_by,granted_at,updated_at,expires_at)
    select v_target,p_target_character_id,r,true,p_actor_user_id,v_now,v_now,v_expiry from (select distinct unnest(p_roles) r) x
    on conflict(user_id,role,character_id) do update set enabled=true,granted_by=excluded.granted_by,granted_at=v_now,updated_at=v_now,expires_at=v_expiry;
  insert into app_private.master_panel_capability_grants(user_id,character_id,capability,enabled,granted_by,granted_at,updated_at,expires_at,note)
    select v_target,p_target_character_id,c,true,p_actor_user_id,v_now,v_now,v_expiry,null from (select distinct unnest(p_capabilities) c) x
    on conflict(user_id,capability,character_id) do update set enabled=true,granted_by=excluded.granted_by,granted_at=v_now,updated_at=v_now,expires_at=v_expiry,note=null;
  v_version := app_private.bump_master_panel_access_version_v1(v_target);
  select jsonb_build_object('roles',p_roles,'capabilities',p_capabilities,'expiresAt',v_expiry,'boundLegacy',p_bind_legacy) into v_after;
  insert into app_private.master_panel_access_audit(actor_user_id,actor_character_id,target_user_id,target_character_id,action,subject,before_state,after_state)
    values(p_actor_user_id,p_actor_character_id,v_target,p_target_character_id,'role.granted','character-access',v_before,v_after);
  return v_version;
end;
$$;

create function public.revoke_master_panel_character_access_v2(p_actor_character_id uuid,p_actor_user_id uuid,p_target_character_id uuid,p_expected_access_version bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_target uuid;v_version bigint;v_before jsonb;
begin
  perform app_private.assert_game_owner_v1(p_actor_character_id,p_actor_user_id);
  select c.user_id into v_target from public.characters c where c.id=p_target_character_id for update;
  if v_target is null or v_target=p_actor_user_id or exists(select 1 from app_private.master_panel_role_assignments a where a.user_id=v_target and a.role='game-owner') then
    raise exception using errcode='22023',message='MASTER_PANEL_SELF_GRANT_FORBIDDEN';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('staff-access:'||v_target::text,0));
  select coalesce(v.access_version,1) into v_version from app_private.master_panel_access_versions v where v.user_id=v_target;
  if p_expected_access_version is null or coalesce(v_version,1)<>p_expected_access_version then
    raise exception using errcode='40001',message='MASTER_PANEL_ACCESS_VERSION_CONFLICT';
  end if;
  select jsonb_build_object(
    'roles',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from app_private.master_panel_role_assignments a where a.character_id=p_target_character_id),
    'capabilities',(select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) from app_private.master_panel_capability_grants g where g.character_id=p_target_character_id)
  ) into v_before;
  update app_private.master_panel_role_assignments set enabled=false,updated_at=clock_timestamp() where character_id=p_target_character_id;
  update app_private.master_panel_capability_grants set enabled=false,updated_at=clock_timestamp() where character_id=p_target_character_id;
  v_version:=app_private.bump_master_panel_access_version_v1(v_target);
  insert into app_private.master_panel_access_audit(actor_user_id,actor_character_id,target_user_id,target_character_id,action,subject,before_state,after_state)
    values(p_actor_user_id,p_actor_character_id,v_target,p_target_character_id,'role.revoked','character-access',v_before,jsonb_build_object('enabled',false));
  return v_version;
end;
$$;

revoke all on function public.read_master_panel_access_v1(uuid,uuid),public.read_master_panel_operator_v1(uuid,uuid),public.list_master_panel_staff_v1(uuid,uuid),
  public.resolve_master_panel_accounts_v2(uuid,uuid,text),public.set_master_panel_character_access_v2(uuid,uuid,uuid,text[],text[],integer,boolean,bigint),
  public.revoke_master_panel_character_access_v2(uuid,uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.read_master_panel_access_v1(uuid,uuid),public.read_master_panel_operator_v1(uuid,uuid),public.list_master_panel_staff_v1(uuid,uuid),
  public.resolve_master_panel_accounts_v2(uuid,uuid,text),public.set_master_panel_character_access_v2(uuid,uuid,uuid,text[],text[],integer,boolean,bigint),
  public.revoke_master_panel_character_access_v2(uuid,uuid,uuid,bigint) to service_role;

-- Music previously wrote the service table directly after a page-level check.
-- Keep its ordinary reader; put mutations behind the same live SQL boundary.
create function public.save_site_music_configuration_v2(p_actor_character_id uuid,p_actor_user_id uuid,
  p_expected_revision bigint,p_enabled boolean,p_default_track jsonb,p_route_overrides jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform app_private.assert_game_owner_v1(p_actor_character_id,p_actor_user_id);
  if p_expected_revision is null or p_expected_revision<1 or p_enabled is null
    or jsonb_typeof(p_default_track) is distinct from 'object'
    or jsonb_typeof(p_route_overrides) is distinct from 'array' then
    raise exception using errcode='22023',message='SITE_MUSIC_INVALID';
  end if;
  update public.site_music_configuration c set enabled=p_enabled,default_track=p_default_track,
    route_overrides=p_route_overrides,revision=c.revision+1,updated_by=p_actor_user_id,updated_at=clock_timestamp()
    where c.singleton_id=true and c.revision=p_expected_revision returning to_jsonb(c) into v_result;
  if v_result is null then raise exception using errcode='40001',message='SITE_MUSIC_VERSION_CONFLICT'; end if;
  return v_result;
end;
$$;
revoke all on function public.save_site_music_configuration_v2(uuid,uuid,bigint,boolean,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_site_music_configuration_v2(uuid,uuid,bigint,boolean,jsonb,jsonb) to service_role;
revoke insert,update,delete on public.site_music_configuration from public,anon,authenticated,service_role;
grant select on public.site_music_configuration to service_role;

create function public.read_world_environment_history_v1(p_actor_character_id uuid,p_actor_user_id uuid,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.assert_game_owner_v1(p_actor_character_id,p_actor_user_id);
  return public.read_world_environment_history_v1(p_limit);
end;
$$;
revoke all on function public.read_world_environment_history_v1(integer) from public,anon,authenticated,service_role;
revoke all on function public.read_world_environment_history_v1(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.read_world_environment_history_v1(uuid,uuid,integer) to service_role;

create function public.revoke_master_panel_legacy_access_v2(p_actor_character_id uuid,p_actor_user_id uuid,p_target_user_id uuid,p_expected_access_version bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_version bigint;v_before jsonb;
begin
  perform app_private.assert_game_owner_v1(p_actor_character_id,p_actor_user_id);
  if p_target_user_id=p_actor_user_id or exists(select 1 from app_private.master_panel_role_assignments a where a.user_id=p_target_user_id and a.role='game-owner') then
    raise exception using errcode='22023',message='MASTER_PANEL_SELF_GRANT_FORBIDDEN';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('staff-access:'||p_target_user_id::text,0));
  select coalesce(v.access_version,1) into v_version from app_private.master_panel_access_versions v where v.user_id=p_target_user_id;
  if p_expected_access_version is null or coalesce(v_version,1)<>p_expected_access_version then
    raise exception using errcode='40001',message='MASTER_PANEL_ACCESS_VERSION_CONFLICT';
  end if;
  select jsonb_build_object(
    'roles',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from app_private.master_panel_role_assignments a where a.user_id=p_target_user_id and a.character_id is null),
    'capabilities',(select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) from app_private.master_panel_capability_grants g where g.user_id=p_target_user_id and g.character_id is null)
  ) into v_before;
  update app_private.master_panel_role_assignments set enabled=false,updated_at=clock_timestamp() where user_id=p_target_user_id and character_id is null and role<>'game-owner';
  update app_private.master_panel_capability_grants set enabled=false,updated_at=clock_timestamp() where user_id=p_target_user_id and character_id is null;
  v_version:=app_private.bump_master_panel_access_version_v1(p_target_user_id);
  insert into app_private.master_panel_access_audit(actor_user_id,actor_character_id,target_user_id,action,subject,before_state,after_state)
    values(p_actor_user_id,p_actor_character_id,p_target_user_id,'role.revoked','legacy-access',v_before,jsonb_build_object('enabled',false));
  return v_version;
end;
$$;
revoke all on function public.revoke_master_panel_legacy_access_v2(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.revoke_master_panel_legacy_access_v2(uuid,uuid,uuid,bigint) to service_role;

commit;
