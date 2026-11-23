begin;

-- Delegated account rows are retained for explicit binding, never inherited.
-- The existing single Game Owner remains the account-root/bootstrap exception.
create table app_private.master_panel_character_access (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  roles text[] not null check (cardinality(roles) > 0 and roles <@ array['moderator','content-staff','event-staff']::text[]),
  special_capabilities text[] not null default '{}'
    check (special_capabilities <@ array['moderation.permanent_ban','content.story_copy','content.production_publish','events.production_publish','events.global_scope','events.reward_titles','events.emergency_stop','balance.edit_selected','support.issue_compensation']::text[]),
  enabled boolean not null default true,
  expires_at timestamptz,
  access_version bigint not null default 1 check (access_version > 0),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default clock_timestamp()
);
alter table app_private.master_panel_character_access enable row level security;
revoke all on table app_private.master_panel_character_access from public, anon, authenticated, service_role;
create index master_panel_character_access_identity_idx on app_private.master_panel_character_access(user_id);
alter table app_private.master_panel_access_audit add column target_character_id uuid;

create function public.read_master_panel_access_v1(p_user_id uuid, p_actor_character_id uuid)
returns table(user_id uuid, access_version bigint, roles text[], special_capabilities text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists(select 1 from app_private.master_panel_role_assignments a where a.user_id=p_user_id and a.role='game-owner' and a.enabled) then
    return query select p_user_id,coalesce((select v.access_version from app_private.master_panel_access_versions v where v.user_id=p_user_id),1::bigint),array['game-owner']::text[],array[]::text[];
    return;
  end if;
  return query select g.user_id,g.access_version,g.roles,g.special_capabilities
    from app_private.master_panel_character_access g join public.characters c on c.id=g.character_id and c.user_id=g.user_id
    where g.user_id=p_user_id and g.character_id=p_actor_character_id and g.enabled
      and (g.expires_at is null or g.expires_at > statement_timestamp())
      and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id);
end; $$;
create or replace function public.read_master_panel_access_v1(p_user_id uuid)
returns table(user_id uuid, access_version bigint, roles text[], special_capabilities text[])
language sql stable security definer set search_path = '' as $$
  select * from public.read_master_panel_access_v1(p_user_id,null::uuid);
$$;

create function app_private.has_master_capability_v2(p_user_id uuid,p_character_id uuid,p_capability text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.read_master_panel_access_v1(p_user_id,p_character_id) a
    where 'game-owner'=any(a.roles)
      or (p_capability='master.access' and cardinality(a.roles)>0)
      or (p_capability='content.combat.author' and 'content-staff'=any(a.roles))
      or (p_capability in ('events.author','events.operate') and 'event-staff'=any(a.roles))
      or p_capability=any(a.special_capabilities));
$$;
create function app_private.assert_master_panel_operator_v1(p_actor_user_id uuid,p_actor_character_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'content.combat.author') then
    raise exception using errcode='42501', message='MASTER_PANEL_OPERATOR_REQUIRED';
  end if;
  if app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'staff.manage') then return 'owner'; end if;
  return 'content-staff';
end; $$;
create or replace function app_private.assert_master_panel_operator_v1(p_actor_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select app_private.assert_master_panel_operator_v1(p_actor_user_id,null::uuid);
$$;
create function public.read_master_panel_operator_v1(p_user_id uuid,p_actor_character_id uuid)
returns table(user_id uuid,role text,enabled boolean)
language sql stable security definer set search_path = '' as $$
  select p_user_id,case when 'game-owner'=any(a.roles) then 'owner' else 'content-staff' end,true
  from public.read_master_panel_access_v1(p_user_id,p_actor_character_id) a
  where 'game-owner'=any(a.roles) or 'content-staff'=any(a.roles);
$$;
create or replace function public.read_master_panel_operator_v1(p_user_id uuid)
returns table(user_id uuid,role text,enabled boolean)
language sql stable security definer set search_path = '' as $$
  select * from public.read_master_panel_operator_v1(p_user_id,null::uuid);
$$;

create function app_private.assert_event_staff_author_v1(p_actor_user_id uuid,p_actor_character_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'events.author') then
    raise exception using errcode='42501',message='EVENT_STAFF_REQUIRED';
  end if;
  if app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'staff.manage') then return 'game-owner'; end if;
  return 'event-staff';
end; $$;
create or replace function app_private.assert_event_staff_author_v1(p_actor_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$ select app_private.assert_event_staff_author_v1(p_actor_user_id,null::uuid); $$;
create function app_private.assert_event_production_publish_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_scope_type text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id,p_actor_character_id);
  if not app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'events.production_publish') then
    raise exception using errcode='42501',message='EVENT_PRODUCTION_PUBLISH_CAPABILITY_REQUIRED';
  end if;
  if p_scope_type='global' and not app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'events.global_scope') then
    raise exception using errcode='42501',message='EVENT_GLOBAL_SCOPE_CAPABILITY_REQUIRED';
  end if;
end; $$;
create or replace function app_private.assert_event_production_publish_v1(p_actor_user_id uuid,p_scope_type text)
returns void language sql stable security definer set search_path = '' as $$ select app_private.assert_event_production_publish_v1(p_actor_user_id,null::uuid,p_scope_type); $$;
create function app_private.assert_event_operational_scope_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_scope_type text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id,p_actor_character_id);
  if p_scope_type='global' and not app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'events.global_scope') then
    raise exception using errcode='42501',message='EVENT_GLOBAL_SCOPE_CAPABILITY_REQUIRED';
  end if;
end; $$;
create or replace function app_private.assert_event_operational_scope_v1(p_actor_user_id uuid,p_scope_type text)
returns void language sql stable security definer set search_path = '' as $$ select app_private.assert_event_operational_scope_v1(p_actor_user_id,null::uuid,p_scope_type); $$;
create function app_private.assert_event_emergency_stop_v1(p_actor_user_id uuid,p_actor_character_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id,p_actor_character_id);
  if not app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'events.emergency_stop') then
    raise exception using errcode='42501',message='EVENT_EMERGENCY_STOP_CAPABILITY_REQUIRED';
  end if;
end; $$;
create or replace function app_private.assert_event_emergency_stop_v1(p_actor_user_id uuid)
returns void language sql stable security definer set search_path = '' as $$ select app_private.assert_event_emergency_stop_v1(p_actor_user_id,null::uuid); $$;

-- Extend the actual current bodies, including prior kind/version-floor patches,
-- rather than copying historical executors or weakening their locks/CAS/ACLs.
-- Actor is inserted after user id in each signature and every nested staff call.
do $migration$
declare
  v_signature text; v_definition text; v_identity text; v_new_identity text;
  v_name text; v_callee text; v_service boolean;
  v_names text[] := array[
    'app_private.assert_master_panel_operator_v1','app_private.assert_event_staff_author_v1',
    'app_private.assert_event_production_publish_v1','app_private.assert_event_operational_scope_v1','app_private.assert_event_emergency_stop_v1',
    'public.read_combat_content_draft_v1','public.list_combat_content_versions_v1','public.save_combat_content_draft_v1',
    'public.publish_combat_content_v1','public.publish_combat_content_v2','public.publish_combat_content_v3',
    'app_private.publish_combat_content_with_floor_v1','public.set_combat_content_publication_v1','public.set_combat_content_publication_v2',
    'public.read_event_definition_draft_v1','public.save_event_definition_draft_v1','public.list_event_definition_versions_v1',
    'public.publish_event_definition_v1','public.publish_event_definition_v2','public.schedule_event_run_v1','public.schedule_event_run_v2',
    'public.cancel_scheduled_event_run_v1','public.cancel_scheduled_event_run_v2',
    'public.list_event_operation_runs_v1','public.read_event_operation_dashboard_v1','public.operate_event_run_v1',
    'public.advance_event_run_phase_v1','public.complete_event_cleanup_requirement_v1',
    'public.operate_event_run_v2','public.advance_event_run_phase_v2','public.complete_event_cleanup_requirement_v2'];
begin
  foreach v_signature in array array[
    'public.read_combat_content_draft_v1(uuid,text)','public.list_combat_content_versions_v1(uuid,text)',
    'public.save_combat_content_draft_v1(uuid,text,text,jsonb,integer,bigint)',
    'public.publish_combat_content_v1(uuid,text,text,jsonb,integer)',
    'public.publish_combat_content_v2(uuid,text,text,jsonb,integer,text)',
    'public.publish_combat_content_v3(uuid,text,text,jsonb,integer,text,integer)',
    'app_private.publish_combat_content_with_floor_v1(uuid,text,text,jsonb,integer,integer)',
    'public.set_combat_content_publication_v1(uuid,text,text,integer)','public.set_combat_content_publication_v2(uuid,text,text,integer,text)',
    'public.read_event_definition_draft_v1(uuid,text)','public.save_event_definition_draft_v1(uuid,text,jsonb,integer,bigint)',
    'public.list_event_definition_versions_v1(uuid,text)','public.publish_event_definition_v1(uuid,text,jsonb,integer)',
    'public.publish_event_definition_v2(uuid,text,jsonb,integer,uuid,text,boolean)',
    'public.schedule_event_run_v1(uuid,text,uuid,text,timestamptz,timestamptz)',
    'public.schedule_event_run_v2(uuid,text,uuid,text,timestamptz,timestamptz,text,boolean)',
    'public.cancel_scheduled_event_run_v1(uuid,uuid,bigint,uuid,text)','public.cancel_scheduled_event_run_v2(uuid,uuid,bigint,uuid,text,boolean)',
    'public.list_event_operation_runs_v1(uuid)','public.read_event_operation_dashboard_v1(uuid,uuid)',
    'public.operate_event_run_v1(uuid,uuid,bigint,uuid,text,text)','public.advance_event_run_phase_v1(uuid,uuid,bigint,uuid,text)',
    'public.complete_event_cleanup_requirement_v1(uuid,uuid,text,integer,uuid,text)',
    'public.operate_event_run_v2(uuid,uuid,bigint,uuid,text,text,boolean)',
    'public.advance_event_run_phase_v2(uuid,uuid,bigint,uuid,text,boolean)',
    'public.complete_event_cleanup_requirement_v2(uuid,uuid,text,integer,uuid,text,boolean)'
  ] loop
    if to_regprocedure(v_signature) is null then raise exception 'STAFF_ACTOR_PREDECESSOR_MISSING: %',v_signature; end if;
    v_service := has_function_privilege('service_role',v_signature,'execute');
    v_definition := pg_get_functiondef(v_signature::regprocedure);
    v_name := split_part(v_signature,'(',1);
    v_identity := pg_get_function_identity_arguments(v_signature::regprocedure);
    if strpos(v_definition,'p_actor_user_id uuid')=0 then raise exception 'STAFF_ACTOR_PREDECESSOR_CONFLICT: %',v_signature; end if;
    v_definition := replace(v_definition,'p_actor_user_id uuid','p_actor_user_id uuid, p_actor_character_id uuid');
    foreach v_callee in array v_names loop
      v_definition := regexp_replace(v_definition,replace(v_callee,'.','\.') || '\(\s*p_actor_user_id\s*([,)])',v_callee || '(p_actor_user_id, p_actor_character_id\1','g');
    end loop;
    if v_name='public.list_event_operation_runs_v1' then
      if strpos(v_definition,'master_panel_capability_grants')=0 then raise exception 'STAFF_EVENT_SCOPE_PREDECESSOR_CONFLICT'; end if;
      v_definition := regexp_replace(v_definition,'v_global_allowed :=.*?;','v_global_allowed := app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,''events.global_scope'');','s');
    end if;
    execute v_definition;
    v_new_identity := replace(v_identity,'p_actor_user_id uuid','p_actor_user_id uuid, p_actor_character_id uuid');
    execute 'revoke all on function '||v_name||'('||v_new_identity||') from public, anon, authenticated, service_role';
    if v_service then execute 'grant execute on function '||v_name||'('||v_new_identity||') to service_role'; end if;
  end loop;
end; $migration$;

create function public.resolve_master_panel_account_v2(p_actor_user_id uuid,p_query text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid; v_count integer;
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);
  if p_query is null or char_length(btrim(p_query)) not between 1 and 320 then raise exception using errcode='22023',message='MASTER_PANEL_LOOKUP_INVALID'; end if;
  select count(distinct u.id),min(u.id::text)::uuid into v_count,v_user from auth.users u
    where u.email_confirmed_at is not null and (lower(u.email)=lower(p_query) or exists(select 1 from public.characters c where c.user_id=u.id and lower(c.name)=lower(p_query)));
  if v_count=0 then return null; end if;
  if v_count<>1 then raise exception using errcode='22023',message='MASTER_PANEL_LOOKUP_AMBIGUOUS'; end if;
  return (select jsonb_build_object('userId',u.id,'email',u.email,'characters',coalesce((select jsonb_agg(jsonb_build_object('characterId',c.id,'name',c.name,'playable',not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id)) order by c.name,c.id) from public.characters c where c.user_id=u.id),'[]'::jsonb)) from auth.users u where u.id=v_user);
end; $$;
create function public.list_master_panel_staff_v2(p_actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);
  return (select coalesce(jsonb_agg(x.row order by x.row->>'characterName',x.row->>'email'),'[]'::jsonb) from (
    select jsonb_build_object('userId',g.user_id,'email',u.email,'characterId',g.character_id,'characterName',c.name,'accessVersion',g.access_version,'roles',g.roles,'specialCapabilities',g.special_capabilities,'expiresAt',g.expires_at,'status',case when not g.enabled then 'revoked' when g.expires_at<=statement_timestamp() then 'expired' when c.user_id<>g.user_id or exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id) then 'unavailable' else 'active' end) row
    from app_private.master_panel_character_access g join auth.users u on u.id=g.user_id join public.characters c on c.id=g.character_id
    union all
    select jsonb_build_object('userId',u.id,'email',u.email,'characterId',null,'characterName',null,'accessVersion',coalesce(v.access_version,1),'roles',array_agg(a.role order by a.role),'specialCapabilities',coalesce((select jsonb_agg(k.capability order by k.capability) from app_private.master_panel_capability_grants k where k.user_id=u.id and k.enabled),'[]'::jsonb),'expiresAt',null,'status',case when bool_or(a.role='game-owner') then 'owner' else 'needs-binding' end)
    from app_private.master_panel_role_assignments a join auth.users u on u.id=a.user_id left join app_private.master_panel_access_versions v on v.user_id=u.id
    where a.enabled and (a.role='game-owner' or not exists(select 1 from app_private.master_panel_character_access g where g.user_id=a.user_id)) group by u.id,u.email,v.access_version
  ) x);
end; $$;
create function public.set_master_panel_character_access_v2(p_actor_user_id uuid,p_target_user_id uuid,p_target_character_id uuid,p_roles text[],p_special_capabilities text[],p_days integer,p_expected_version bigint,p_enabled boolean)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_before app_private.master_panel_character_access; v_after app_private.master_panel_character_access; v_expiry timestamptz;
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);
  if p_actor_user_id=p_target_user_id or exists(select 1 from app_private.master_panel_role_assignments a where a.user_id=p_target_user_id and a.role='game-owner' and a.enabled) then raise exception using errcode='42501',message='MASTER_PANEL_SELF_OR_OWNER_PROTECTED'; end if;
  if p_days is not null and (p_days<=0 or p_days>36500) then raise exception using errcode='22023',message='MASTER_PANEL_EXPIRY_INVALID'; end if;
  if p_enabled is null or p_expected_version is null or p_expected_version<0 or p_roles is null or cardinality(p_roles)=0 or not p_roles <@ array['moderator','content-staff','event-staff']::text[] or array_position(p_roles,null) is not null or cardinality(p_roles)<>(select count(distinct x) from unnest(p_roles) x) or p_special_capabilities is null or cardinality(p_special_capabilities)<>(select count(distinct x) from unnest(p_special_capabilities) x) or not p_special_capabilities <@ array['moderation.permanent_ban','content.story_copy','content.production_publish','events.production_publish','events.global_scope','events.reward_titles','events.emergency_stop','balance.edit_selected','support.issue_compensation']::text[] or array_position(p_special_capabilities,null) is not null then raise exception using errcode='22023',message='MASTER_PANEL_ROLE_OR_CAPABILITY_INVALID'; end if;
  if not exists(select 1 from auth.users u join public.characters c on c.user_id=u.id where u.id=p_target_user_id and u.email_confirmed_at is not null and c.id=p_target_character_id and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id)) then raise exception using errcode='42501',message='MASTER_PANEL_CHARACTER_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('staff-character:'||p_target_character_id::text,0));
  select * into v_before from app_private.master_panel_character_access where character_id=p_target_character_id for update;
  if coalesce(v_before.access_version,0)<>p_expected_version then raise exception using errcode='40001',message='MASTER_PANEL_ACCESS_VERSION_CONFLICT'; end if;
  -- UTC days are exact 24-hour periods, independent of database/session timezone.
  v_expiry := case when not p_enabled then v_before.expires_at when p_days is null then null else statement_timestamp()+p_days*interval '24 hours' end;
  insert into app_private.master_panel_character_access(character_id,user_id,roles,special_capabilities,enabled,expires_at,updated_by)
    values(p_target_character_id,p_target_user_id,p_roles,p_special_capabilities,p_enabled,v_expiry,p_actor_user_id)
    on conflict(character_id) do update set roles=excluded.roles,special_capabilities=excluded.special_capabilities,enabled=excluded.enabled,expires_at=excluded.expires_at,access_version=app_private.master_panel_character_access.access_version+1,updated_by=excluded.updated_by,updated_at=clock_timestamp()
    returning * into v_after;
  insert into app_private.master_panel_access_audit(actor_user_id,target_user_id,target_character_id,action,subject,before_state,after_state,note)
    values(p_actor_user_id,p_target_user_id,p_target_character_id,case when p_enabled then 'role.granted' else 'role.revoked' end,'character-access',case when v_before.character_id is null then null else to_jsonb(v_before) end,to_jsonb(v_after),null);
  return v_after.access_version;
end; $$;

-- Retire the old account-grant administration API. Existing rows remain private
-- migration evidence, while all new assignments use verified character binding.
revoke all on function public.grant_master_panel_role_v1(uuid,uuid,text,text),
  public.revoke_master_panel_role_v1(uuid,uuid,text,text),
  public.grant_master_panel_capability_v1(uuid,uuid,text,text),
  public.revoke_master_panel_capability_v1(uuid,uuid,text,text),
  public.list_master_panel_staff_v1(uuid),public.resolve_master_panel_account_v1(uuid,text)
  from public, anon, authenticated, service_role;

-- Every new definer is private to the trusted server; no browser EXECUTE surface.
do $acl$
declare r record;
begin
  for r in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='app_private' and (p.proname='has_master_capability_v2' or (p.proname in ('assert_master_panel_operator_v1','assert_event_staff_author_v1','assert_event_production_publish_v1','assert_event_operational_scope_v1','assert_event_emergency_stop_v1') and 'p_actor_character_id'=any(p.proargnames))))
       or (n.nspname='public' and ((p.proname in ('read_master_panel_access_v1','read_master_panel_operator_v1') and 'p_actor_character_id'=any(p.proargnames)) or p.proname in ('resolve_master_panel_account_v2','list_master_panel_staff_v2','set_master_panel_character_access_v2')))
  loop
    execute 'revoke all on function '||r.signature||' from public, anon, authenticated, service_role';
    if r.nspname='public' then execute 'grant execute on function '||r.signature||' to service_role'; end if;
  end loop;
end; $acl$;
commit;
