begin;

create or replace function app_private.master_page_capabilities_v1(p_pages text[]) returns text[]
language sql immutable set search_path='' as $$
 select coalesce(array_agg(distinct capability order by capability),'{}'::text[]) from (
 select 'master.access' capability where cardinality(p_pages)>0
 union all select unnest(case page
 when 'combat' then array['content.combat.author','content.story_copy','content.production_publish']
 when 'combat-timing' then array['combat.rules','balance.edit_selected']
 when 'npc-design' then array['npc.manage']
 when 'events' then array['events.author','events.operate','events.production_publish','events.global_scope','events.reward_titles','events.emergency_stop']
 when 'players' then array['players.manage','support.issue_compensation']
 when 'moderation' then array['moderation.manage','moderation.permanent_ban']
 when 'music' then array['music.manage']
 when 'world-environment' then array['world.manage']
 when 'activity' then array['activity.read'] else '{}'::text[] end)
 from unnest(p_pages) page) capabilities;
$$;

-- Existing app versions still see only the pages they understand during rollout.
create function public.read_master_panel_role_defaults_v2(p_actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);
  return (select jsonb_build_object('revision',revision,'roles',roles) from app_private.master_panel_role_defaults where singleton);
end; $$;

create or replace function public.read_master_panel_role_defaults_v1(p_actor_user_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_set(current_setting,'{roles}',(
    select jsonb_object_agg(key,value - 'npc-design') from jsonb_each(current_setting->'roles')
  ))
  from public.read_master_panel_role_defaults_v2(p_actor_user_id) current_setting;
$$;

create function public.save_master_panel_role_defaults_v2(p_actor_user_id uuid,p_expected_revision bigint,p_roles jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare role text; pages jsonb; current_revision bigint; current_roles jsonb;
begin
 perform app_private.assert_game_owner_v1(p_actor_user_id);
 if p_expected_revision is null or p_expected_revision<1 or jsonb_typeof(p_roles) is distinct from 'object'
 or (select count(*) from jsonb_object_keys(p_roles))<>3 or not p_roles ?& array['moderator','content-staff','event-staff'] then
 raise exception using errcode='22023',message='MASTER_PANEL_PAGE_DEFAULTS_INVALID'; end if;
 foreach role in array array['moderator','content-staff','event-staff'] loop
  pages:=p_roles->role;
  if jsonb_typeof(pages) is distinct from 'array' then raise exception using errcode='22023',message='MASTER_PANEL_PAGE_DEFAULTS_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements(pages) p where jsonb_typeof(p)<>'string' or p #>> '{}' not in ('combat','combat-timing','events','npc-design','players','moderation','music','world-environment','activity'))
  or jsonb_array_length(pages)<>(select count(distinct p) from jsonb_array_elements(pages) p) then
  raise exception using errcode='22023',message='MASTER_PANEL_PAGE_DEFAULTS_INVALID'; end if;
 end loop;
 select revision,roles into current_revision,current_roles from app_private.master_panel_role_defaults where singleton for update;
 if current_revision<>p_expected_revision then raise exception using errcode='PT409',message='MASTER_PANEL_ROLE_DEFAULTS_VERSION_CONFLICT'; end if;
 if current_roles @> p_roles and p_roles @> current_roles then return public.read_master_panel_role_defaults_v2(p_actor_user_id); end if;
 update app_private.master_panel_role_defaults set roles=p_roles,revision=revision+1,updated_by=p_actor_user_id,updated_at=clock_timestamp() where singleton;
 return public.read_master_panel_role_defaults_v2(p_actor_user_id);
end; $$;

create or replace function public.save_master_panel_role_defaults_v1(p_actor_user_id uuid,p_expected_revision bigint,p_roles jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_roles jsonb;
declare role text;
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);
  if jsonb_typeof(p_roles)='object' then
    select roles into current_roles from app_private.master_panel_role_defaults where singleton;
    foreach role in array array['moderator','content-staff','event-staff'] loop
      if (current_roles->role) ? 'npc-design' and jsonb_typeof(p_roles->role)='array' and not ((p_roles->role) ? 'npc-design') then
        p_roles:=jsonb_set(p_roles,array[role],(p_roles->role)||'["npc-design"]'::jsonb);
      end if;
    end loop;
  end if;
  perform public.save_master_panel_role_defaults_v2(p_actor_user_id,p_expected_revision,p_roles);
  return public.read_master_panel_role_defaults_v1(p_actor_user_id);
end; $$;

create function public.read_master_panel_access_v3(p_user_id uuid,p_actor_character_id uuid)
returns table(user_id uuid,access_version bigint,roles text[],special_capabilities text[],effective_capabilities text[])
language sql stable security definer set search_path='' as $$
 select a.user_id,a.access_version,a.roles,a.special_capabilities,
 case when 'game-owner'=any(a.roles) then array['staff.manage']||app_private.master_page_capabilities_v1(array['combat','combat-timing','events','npc-design','players','moderation','music','world-environment','activity'])
 else app_private.master_page_capabilities_v1(array(select distinct page from app_private.master_panel_role_defaults d cross join unnest(a.roles) r(role) cross join lateral jsonb_array_elements_text(d.roles->r.role) page where d.singleton)) end
 from public.read_master_panel_access_v1(p_user_id,p_actor_character_id) a
 where not exists(select 1 from auth.users u where u.id=p_user_id and u.banned_until>statement_timestamp());
$$;

create or replace function public.read_master_panel_access_v2(p_user_id uuid,p_actor_character_id uuid)
returns table(user_id uuid,access_version bigint,roles text[],special_capabilities text[],effective_capabilities text[])
language sql stable security definer set search_path='' as $$
  select a.user_id,a.access_version,a.roles,a.special_capabilities,array_remove(a.effective_capabilities,'npc.manage')
  from public.read_master_panel_access_v3(p_user_id,p_actor_character_id) a;
$$;

create or replace function app_private.has_master_capability_v2(p_user_id uuid,p_character_id uuid,p_capability text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.read_master_panel_access_v3(p_user_id,p_character_id) a where p_capability=any(a.effective_capabilities));
$$;

create or replace function public.read_master_panel_navigation_v1(p_actor_user_id uuid,p_actor_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'master.access');
  return (select jsonb_build_object('revision',revision,'order',tab_order - 'npc-design') from app_private.master_panel_navigation where singleton);
end; $$;

create function public.read_master_panel_navigation_v2(p_actor_user_id uuid,p_actor_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'master.access');
  return (select jsonb_build_object('revision',revision,'order',case when tab_order ? 'npc-design' then tab_order else tab_order || '["npc-design"]'::jsonb end) from app_private.master_panel_navigation where singleton);
end; $$;

create function public.save_master_panel_navigation_v2(p_actor_user_id uuid,p_expected_revision bigint,p_order jsonb,p_actor_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_revision bigint; current_order jsonb;
begin
  perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'staff.manage');
  if p_expected_revision is null or p_expected_revision<1 or jsonb_typeof(p_order) is distinct from 'array' then
    raise exception using errcode='22023',message='MASTER_NAVIGATION_INVALID';
  end if;
  if jsonb_array_length(p_order)<>10 or exists(
    select 1 from jsonb_array_elements(p_order) p where jsonb_typeof(p)<>'string'
      or p #>> '{}' not in ('combat','combat-timing','events','npc-design','moderation','players','staff','music','world-environment','activity')
  ) or (select count(distinct p) from jsonb_array_elements(p_order) p)<>10 then
    raise exception using errcode='22023',message='MASTER_NAVIGATION_INVALID';
  end if;
  select revision,tab_order into current_revision,current_order from app_private.master_panel_navigation where singleton for update;
  if current_revision<>p_expected_revision then raise exception using errcode='PT409',message='MASTER_NAVIGATION_VERSION_CONFLICT'; end if;
  if (case when current_order ? 'npc-design' then current_order else current_order || '["npc-design"]'::jsonb end)<>p_order then
    update app_private.master_panel_navigation set revision=revision+1,tab_order=p_order,updated_by=p_actor_user_id,updated_at=clock_timestamp() where singleton;
    insert into app_private.master_panel_navigation_audit(actor_user_id,actor_character_id,revision,before_order,after_order)
      values(p_actor_user_id,p_actor_character_id,current_revision+1,current_order,p_order);
    insert into app_private.master_panel_activity(actor,action,subject)
      values(app_private.master_activity_actor_v1(p_actor_user_id,p_actor_character_id),'Reordered tabs','Master Panel');
  end if;
  return public.read_master_panel_navigation_v2(p_actor_user_id,p_actor_character_id);
end; $$;

-- Stable identities keep private draft and separately committed Arena data. Arena
-- retirement leaves the identity and draft available for repair or reassignment.
create function app_private.valid_npc_arena_settings_v1(value jsonb) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(
    jsonb_typeof(value)='object'
    and value - array['arenaId','aiDifficulty','lore'] = '{}'::jsonb
    and value->>'arenaId' in ('duel-yard','crossroads-court','terraced-yard')
    and value->>'aiDifficulty' in ('easy','standard','high')
    and jsonb_typeof(value->'lore')='string'
    and char_length(value->>'lore')<=700,
    false
  );
$$;

create function app_private.valid_npc_draft_v1(value jsonb) returns boolean
language sql immutable set search_path='' as $$
  select case when jsonb_typeof(value)='object' and jsonb_typeof(value->'uses')='array' then coalesce(
    value - array['name','portraitRef','uses','arena'] = '{}'::jsonb
    and jsonb_typeof(value->'name')='string'
    and char_length(value->>'name')<=60
    and (value->'portraitRef'='null'::jsonb or value->>'portraitRef' ~ '^portrait\.[a-z0-9.-]{1,90}$')
    and jsonb_array_length(value->'uses') between 1 and 3
    and jsonb_array_length(value->'uses') = (
      select count(distinct use) from jsonb_array_elements_text(value->'uses') use
      where use in ('arena','world','story')
    )
    and (app_private.valid_npc_arena_settings_v1(value->'arena')
        or (not ((value->'uses') ? 'arena') and value->'arena' = 'null'::jsonb)), false)
  else false end;
$$;

create table app_private.npc_designs (
  id uuid primary key,
  revision bigint not null check (revision between 1 and 9007199254740991),
  draft jsonb not null check (app_private.valid_npc_draft_v1(draft)),
  arena jsonb,
  updated_at timestamptz not null default clock_timestamp(),
  check (arena is null or coalesce(
    arena->>'id' = id::text
    and char_length(btrim(arena->>'name')) between 1 and 60
    and jsonb_typeof(arena->'name')='string'
    and (arena->'portraitRef'='null'::jsonb or arena->>'portraitRef' ~ '^portrait\.[a-z0-9.-]{1,90}$')
    and (arena->>'revision')::bigint between 1 and revision
    and app_private.valid_npc_arena_settings_v1(arena - array['id','name','portraitRef','revision']),
    false
  ))
);
alter table app_private.npc_designs enable row level security;
revoke all on table app_private.npc_designs from public, anon, authenticated, service_role;
create index npc_designs_name_idx on app_private.npc_designs (lower(draft->>'name'), id);
create index npc_designs_arena_name_idx on app_private.npc_designs (lower(arena->>'name'), id) where arena is not null;

create function public.read_master_npc_designs_v1(p_actor_user_id uuid,p_actor_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'npc.manage');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',d.id,'revision',d.revision,'draft',d.draft,'arena',d.arena)
      order by lower(d.draft->>'name'),d.id)
    from (
      select id,revision,draft,arena from app_private.npc_designs
      order by lower(draft->>'name'),id limit 200
    ) d
  ), '[]'::jsonb);
end; $$;

create function public.write_master_npc_design_v1(
  p_actor_user_id uuid,p_actor_character_id uuid,p_id uuid,p_expected_revision bigint,p_kind text,p_draft jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row app_private.npc_designs%rowtype;
declare next_arena jsonb;
declare audit_subject text;
begin
  perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'npc.manage');
  if p_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_kind is null or p_kind not in ('save','commit-arena','retire-arena')
    or (p_kind='save' and not app_private.valid_npc_draft_v1(p_draft))
    or (p_kind<>'save' and p_draft is not null) then
    raise exception using errcode='22023', message='NPC_DESIGN_INVALID';
  end if;

  if p_expected_revision=0 and p_kind='save' then
    insert into app_private.npc_designs(id,revision,draft) values(p_id,1,p_draft)
    on conflict (id) do nothing returning * into current_row;
    if not found then raise exception using errcode='PT409', message='NPC_DESIGN_VERSION_CONFLICT'; end if;
  else
    select * into current_row from app_private.npc_designs where id=p_id for update;
    if not found or current_row.revision<>p_expected_revision then
      raise exception using errcode='PT409', message='NPC_DESIGN_VERSION_CONFLICT';
    end if;

    next_arena := current_row.arena;
    audit_subject := coalesce(current_row.arena->>'name',nullif(btrim(current_row.draft->>'name'),''),'Arena fighter');
    if p_kind='commit-arena' then
      if not ((current_row.draft->'uses') ? 'arena')
        or char_length(btrim(current_row.draft->>'name'))=0 then
        raise exception using errcode='22023', message='NPC_ARENA_NOT_READY';
      end if;
      next_arena := current_row.draft->'arena' || jsonb_build_object(
        'id',p_id,'revision',p_expected_revision+1,'name',current_row.draft->>'name',
        'portraitRef',current_row.draft->'portraitRef'
      );
      audit_subject := next_arena->>'name';
    elsif p_kind='retire-arena' then
      next_arena := null;
    end if;

    if (p_kind='save' and current_row.draft is distinct from p_draft)
      or (p_kind='commit-arena' and (next_arena - 'revision') is distinct from (current_row.arena - 'revision'))
      or (p_kind='retire-arena' and current_row.arena is not null) then
      update app_private.npc_designs set
        draft=case when p_kind='save' then p_draft else draft end,
        arena=next_arena, revision=revision+1, updated_at=clock_timestamp()
      where id=p_id returning * into current_row;
      if p_kind <> 'save' then
        insert into app_private.master_panel_activity(actor,action,subject) values(
          app_private.master_activity_actor_v1(p_actor_user_id,p_actor_character_id),
          case when p_kind='commit-arena' then 'Committed Arena NPC' else 'Retired Arena NPC' end,
          audit_subject
        );
      end if;
    end if;
  end if;
  return jsonb_build_object('id',current_row.id,'revision',current_row.revision,'draft',current_row.draft,'arena',current_row.arena);
end; $$;

create function public.read_published_arena_npcs_v1(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce((
    select jsonb_agg(d.arena order by lower(d.arena->>'name'),d.id)
    from (
      select id,arena from app_private.npc_designs
      where arena is not null and (p_id is null or id=p_id)
      order by lower(arena->>'name'),id limit 100
    ) d
  ), '[]'::jsonb);
$$;

revoke all on function app_private.valid_npc_arena_settings_v1(jsonb),app_private.valid_npc_draft_v1(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.read_master_panel_access_v3(uuid,uuid),
  public.read_master_panel_role_defaults_v2(uuid),
  public.save_master_panel_role_defaults_v2(uuid,bigint,jsonb),
  public.read_master_panel_navigation_v2(uuid,uuid),
  public.save_master_panel_navigation_v2(uuid,bigint,jsonb,uuid),
  public.read_master_npc_designs_v1(uuid,uuid),
  public.write_master_npc_design_v1(uuid,uuid,uuid,bigint,text,jsonb),
  public.read_published_arena_npcs_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.read_master_panel_access_v3(uuid,uuid),
  public.read_master_panel_role_defaults_v2(uuid),
  public.save_master_panel_role_defaults_v2(uuid,bigint,jsonb),
  public.read_master_panel_navigation_v2(uuid,uuid),
  public.save_master_panel_navigation_v2(uuid,bigint,jsonb,uuid),
  public.read_master_npc_designs_v1(uuid,uuid),
  public.write_master_npc_design_v1(uuid,uuid,uuid,bigint,text,jsonb),
  public.read_published_arena_npcs_v1(uuid) to service_role;

commit;
