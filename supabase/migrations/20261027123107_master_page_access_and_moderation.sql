begin;

-- Page defaults are the single delegated authority. Historic granular exceptions are
-- retained as audit facts, but cannot defeat a page revocation.
create function app_private.master_page_capabilities_v1(p_pages text[]) returns text[]
language sql immutable set search_path='' as $$
 select coalesce(array_agg(distinct capability order by capability),'{}'::text[]) from (
 select 'master.access' capability where cardinality(p_pages)>0
 union all select unnest(case page
 when 'combat' then array['content.combat.author','content.story_copy','content.production_publish']
 when 'combat-timing' then array['combat.rules','balance.edit_selected']
 when 'events' then array['events.author','events.operate','events.production_publish','events.global_scope','events.reward_titles','events.emergency_stop']
 when 'players' then array['players.manage','support.issue_compensation']
 when 'moderation' then array['moderation.manage','moderation.permanent_ban']
 when 'music' then array['music.manage']
 when 'world-environment' then array['world.manage']
 when 'activity' then array['activity.read'] else '{}'::text[] end)
 from unnest(p_pages) page) capabilities;
$$;

update app_private.master_panel_role_defaults d set roles=(
 select jsonb_object_agg(role,pages) from (
 select role,coalesce((select jsonb_agg(distinct page) from (
 select case when cap like 'content.%' then 'combat' when cap like 'events.%' then 'events'
 when cap like 'moderation.%' then 'moderation' when cap='balance.edit_selected' then 'combat-timing'
 when cap='support.issue_compensation' then 'players' end page from jsonb_array_elements_text(d.roles->role) cap
 union all select 'moderation' where role='moderator' and d.roles->role='["master.access"]'::jsonb
 ) mapped where page is not null),'[]'::jsonb) pages
 from unnest(array['moderator','content-staff','event-staff']) role) converted
), revision=revision+1,updated_by=null,updated_at=clock_timestamp();

create or replace function public.save_master_panel_role_defaults_v1(p_actor_user_id uuid,p_expected_revision bigint,p_roles jsonb)
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
  if exists(select 1 from jsonb_array_elements(pages) p where jsonb_typeof(p)<>'string' or p #>> '{}' not in ('combat','combat-timing','events','players','moderation','music','world-environment','activity'))
  or jsonb_array_length(pages)<>(select count(distinct p) from jsonb_array_elements(pages) p) then
  raise exception using errcode='22023',message='MASTER_PANEL_PAGE_DEFAULTS_INVALID'; end if;
 end loop;
 select revision,roles into current_revision,current_roles from app_private.master_panel_role_defaults where singleton for update;
 if current_revision<>p_expected_revision then raise exception using errcode='PT409',message='MASTER_PANEL_ROLE_DEFAULTS_VERSION_CONFLICT'; end if;
 if current_roles @> p_roles and p_roles @> current_roles then return public.read_master_panel_role_defaults_v1(p_actor_user_id); end if;
 update app_private.master_panel_role_defaults set roles=p_roles,revision=revision+1,updated_by=p_actor_user_id,updated_at=clock_timestamp() where singleton;
 return public.read_master_panel_role_defaults_v1(p_actor_user_id);
end; $$;

create or replace function public.read_master_panel_access_v2(p_user_id uuid,p_actor_character_id uuid)
returns table(user_id uuid,access_version bigint,roles text[],special_capabilities text[],effective_capabilities text[])
language sql stable security definer set search_path='' as $$
 select a.user_id,a.access_version,a.roles,a.special_capabilities,
 case when 'game-owner'=any(a.roles) then array['staff.manage']||app_private.master_page_capabilities_v1(array['combat','combat-timing','events','players','moderation','music','world-environment','activity'])
 else app_private.master_page_capabilities_v1(array(select distinct page from app_private.master_panel_role_defaults d cross join unnest(a.roles) r(role) cross join lateral jsonb_array_elements_text(d.roles->r.role) page where d.singleton)) end
 from public.read_master_panel_access_v1(p_user_id,p_actor_character_id) a
 where not exists(select 1 from auth.users u where u.id=p_user_id and u.banned_until>statement_timestamp());
$$;

create function app_private.assert_master_page_v1(p_user_id uuid,p_character_id uuid,p_capability text)
returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not app_private.has_master_capability_v2(p_user_id,p_character_id,p_capability) then
 raise exception using errcode='42501',message='MASTER_PANEL_PAGE_ACCESS_REQUIRED'; end if;
end; $$;

-- Replace only the authorization assertion, preserving existing validations, locking,
-- CAS and audits. Old account-only settings signatures remain Owner-only; selected
-- character overloads authorize the configured page at the actual write boundary.
do $migration$
declare fn record; definition text; assertion text; capability text; actor text; signature text;
begin
 for fn in select p.oid,p.oid::regprocedure identity,p.proname,p.proargnames
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (
 'search_master_players_v1','read_master_player_v1','edit_master_player_v1','recover_master_player_battle_v1',
 'read_master_panel_activity_v1','set_world_environment_v2','publish_battlefield_elevation_policy_v2','publish_battlefield_elevation_policy_v3','publish_combat_effect_timing_policy_v1','publish_combat_effect_timing_policy_v2') loop
 definition:=pg_get_functiondef(fn.oid);
 capability:=case when fn.proname like '%master_player%' then 'players.manage' when fn.proname='read_master_panel_activity_v1' then 'activity.read' when fn.proname='set_world_environment_v2' then 'world.manage' else 'combat.rules' end;
 actor:=case when fn.proname='set_world_environment_v2' then 'p_actor' else 'p_actor_user_id' end;
 assertion:='app_private.assert_game_owner_v1('||actor||')';
 if strpos(definition,assertion)=0 then raise exception 'Expected Owner assertion missing from %',fn.identity; end if;
 if not ('p_actor_character_id'=any(fn.proargnames)) then
 definition:=regexp_replace(definition,'\)\n RETURNS',', p_actor_character_id uuid DEFAULT NULL::uuid)'||chr(10)||' RETURNS');
 -- Remove defaults on original arguments to avoid ambiguous PostgREST dispatch; the
 -- selected overload requires its extra actor argument and original entry remains.
 definition:=replace(definition,'p_actor_character_id uuid DEFAULT NULL::uuid','p_actor_character_id uuid');
 definition:=regexp_replace(definition,' DEFAULT [^,)]*','','g');
 end if;
 if fn.proname='publish_combat_effect_timing_policy_v2' then definition:=replace(definition,'p_actor_user_id, p_expected_version, p_modes, null','p_actor_user_id, p_expected_version, p_modes, null, p_actor_character_id'); end if;
 definition:=replace(definition,assertion,'app_private.assert_master_page_v1('||actor||',p_actor_character_id,'||quote_literal(capability)||')');
 execute definition;
 end loop;
 -- Harden both active-session paths against previously-issued JWTs. The indexed
 -- auth user lookup adds no roster/history scan and leaves lease semantics intact.
 for fn in select p.oid,p.oid::regprocedure identity,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('claim_active_game_session_v1','ensure_active_game_session_v1') loop
 definition:=pg_get_functiondef(fn.oid);
 definition:=regexp_replace(definition,'begin', 'begin'||chr(10)||'  if exists(select 1 from auth.users u where u.id=p_user_id and u.banned_until>statement_timestamp()) then raise exception using errcode=''42501'',message=''ACCOUNT_BANNED''; end if;', 'i');
 execute definition;
 end loop;
end; $migration$;

-- Canonical account authority is Supabase Auth's banned_until, not a second ban flag.
-- A finite year-9999 timestamp represents permanent bans and remains Auth-compatible. Every command updates it and its audit in one transaction.
create table app_private.master_moderation_audit (
 id bigint generated always as identity primary key,
 actor_user_id uuid not null,
 actor_character_id uuid,
 target_user_id uuid not null,
 action text not null check(action in ('ban','edit','lift')),
 reason text not null check(char_length(reason) between 1 and 1000),
 before_until timestamptz,
 after_until timestamptz,
 occurred_at timestamptz not null default clock_timestamp()
);
alter table app_private.master_moderation_audit enable row level security;
revoke all on app_private.master_moderation_audit from public,anon,authenticated,service_role;
revoke all on sequence app_private.master_moderation_audit_id_seq from public,anon,authenticated,service_role;
create index master_moderation_target_history on app_private.master_moderation_audit(target_user_id,id desc);
create function app_private.prevent_moderation_history_change_v1() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'MODERATION_HISTORY_IMMUTABLE'; end; $$;
create trigger moderation_history_immutable before update or delete on app_private.master_moderation_audit for each row execute function app_private.prevent_moderation_history_change_v1();

create function public.search_master_moderation_players_v1(p_actor_user_id uuid,p_query text,p_actor_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'moderation.manage');
 if p_query is null or char_length(trim(p_query)) not between 2 and 80 then raise exception using errcode='22023',message='INVALID_MODERATION_QUERY'; end if;
 return coalesce((select jsonb_agg(row_to_json(matches)) from (
 select c.id "characterId",c.user_id "userId",c.name,exists(select 1 from app_private.master_panel_role_assignments a where a.user_id=c.user_id and a.role='game-owner' and a.enabled) protected
 from public.characters c join auth.users u on u.id=c.user_id and u.email_confirmed_at is not null
 where strpos(lower(c.name),lower(trim(p_query)))>0 order by lower(c.name),c.id limit 20) matches),'[]'::jsonb);
end; $$;
create function public.read_master_moderation_v1(p_actor_user_id uuid,p_target_user_id uuid,p_actor_character_id uuid,p_before_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare until_value timestamptz; active boolean; revision text; history_page jsonb; next_cursor text;
begin
 perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'moderation.manage');
 if p_before_id is not null and p_before_id<1 then raise exception using errcode='22023',message='INVALID_MODERATION_CURSOR'; end if;
 select u.banned_until into until_value from auth.users u where u.id=p_target_user_id and u.email_confirmed_at is not null;
 if not found then raise exception using errcode='22023',message='MODERATION_PLAYER_NOT_FOUND'; end if;
 active:=coalesce(until_value>statement_timestamp(),false);
 select md5(coalesce(max(id),0)::text||'|'||coalesce(extract(epoch from until_value)::text,'')) into revision from app_private.master_moderation_audit where target_user_id=p_target_user_id;
 with page as (select * from app_private.master_moderation_audit where target_user_id=p_target_user_id and (p_before_id is null or id<p_before_id) order by id desc limit 101), shown as (select * from page order by id desc limit 100)
 select coalesce(jsonb_agg(jsonb_build_object('id',id::text,'action',action,'reason',reason,'occurredAt',occurred_at,
 'actor',coalesce((select c.name from public.characters c where c.id=actor_character_id and c.user_id=actor_user_id),case when exists(select 1 from app_private.master_panel_role_assignments a where a.user_id=actor_user_id and a.role='game-owner' and a.enabled) then 'Game Owner' else 'Staff member' end),
 'until',case when after_until='9999-12-31T23:59:59Z'::timestamptz then 'Permanent' when after_until is null then 'Lifted' else after_until::text end) order by id desc),'[]'::jsonb),
 case when (select count(*) from page)>100 then (select min(id)::text from shown) else null end into history_page,next_cursor from shown;
 return jsonb_build_object('userId',p_target_user_id,'revision',revision,'active',active,'permanent',active and until_value='9999-12-31T23:59:59Z'::timestamptz,
 'expiresAt',case when active and until_value<>'9999-12-31T23:59:59Z'::timestamptz then to_jsonb(until_value) else 'null'::jsonb end,
 'protected',p_target_user_id=p_actor_user_id or exists(select 1 from app_private.master_panel_role_assignments a where a.user_id=p_target_user_id and a.role='game-owner' and a.enabled),
 'history',history_page,'nextCursor',next_cursor);
end; $$;
create function public.write_master_moderation_v1(p_actor_user_id uuid,p_target_user_id uuid,p_expected_revision text,p_action text,p_reason text,p_minutes integer,p_permanent boolean,p_actor_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare before_value timestamptz; after_value timestamptz; revision text; active boolean;
begin
 perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'moderation.manage');
 if p_target_user_id=p_actor_user_id or exists(select 1 from app_private.master_panel_role_assignments a where a.user_id=p_target_user_id and a.role='game-owner' and a.enabled) then raise exception using errcode='42501',message='MODERATION_PROTECTED_IDENTITY'; end if;
 if p_action is null or p_action not in ('ban','edit','lift') or p_reason is null or char_length(trim(p_reason)) not between 1 and 1000 or p_permanent is null
 or (p_action<>'lift' and not p_permanent and (p_minutes is null or p_minutes<1 or p_minutes>52560000)) then raise exception using errcode='22023',message='INVALID_MODERATION_CHANGE'; end if;
 select u.banned_until into before_value from auth.users u where u.id=p_target_user_id and u.email_confirmed_at is not null for update;
 if not found then raise exception using errcode='22023',message='MODERATION_PLAYER_NOT_FOUND'; end if;
 select md5(coalesce(max(id),0)::text||'|'||coalesce(extract(epoch from before_value)::text,'')) into revision from app_private.master_moderation_audit where target_user_id=p_target_user_id;
 if revision is distinct from p_expected_revision then raise exception using errcode='PT409',message='MODERATION_VERSION_CONFLICT'; end if;
 active:=coalesce(before_value>statement_timestamp(),false);
 if (p_action='ban' and active) or (p_action in ('edit','lift') and not active) then raise exception using errcode='PT409',message='MODERATION_STATE_CHANGED'; end if;
 after_value:=case when p_action='lift' then null when p_permanent then '9999-12-31T23:59:59Z'::timestamptz else statement_timestamp()+make_interval(mins=>p_minutes) end;
 update auth.users set banned_until=after_value,updated_at=clock_timestamp() where id=p_target_user_id;
 insert into app_private.master_moderation_audit(actor_user_id,actor_character_id,target_user_id,action,reason,before_until,after_until) values(p_actor_user_id,p_actor_character_id,p_target_user_id,p_action,trim(p_reason),before_value,after_value);
 if to_regclass('app_private.master_panel_activity') is not null then
 insert into app_private.master_panel_activity(actor,action,subject,detail) values(app_private.master_activity_actor_v1(p_actor_user_id,p_actor_character_id),case p_action when 'lift' then 'Lifted ban' when 'edit' then 'Edited ban' else 'Banned player' end,coalesce((select name from public.characters where user_id=p_target_user_id order by id limit 1),'Player'),'See Moderation for the reason and history');
 end if;
 return public.read_master_moderation_v1(p_actor_user_id,p_target_user_id,p_actor_character_id);
end; $$;

create function public.save_site_music_configuration_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_expected_revision bigint,p_config jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.site_music_configuration; result public.site_music_configuration; track jsonb;
begin
 perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'music.manage');
 if p_expected_revision is null or p_expected_revision<1 or jsonb_typeof(p_config) is distinct from 'object'
 or jsonb_typeof(p_config->'enabled') is distinct from 'boolean' or jsonb_typeof(p_config->'defaultTrack') is distinct from 'object'
 or jsonb_typeof(p_config->'routeOverrides') is distinct from 'array' or jsonb_typeof(p_config->'songLibrary') is distinct from 'array'
 or jsonb_array_length(p_config->'routeOverrides')>50 or jsonb_array_length(p_config->'songLibrary')>200 then raise exception using errcode='22023',message='INVALID_SITE_MUSIC'; end if;
 for track in select p_config->'defaultTrack' union all select t from jsonb_array_elements(p_config->'songLibrary') t union all select t->'track' from jsonb_array_elements(p_config->'routeOverrides') t loop
 if jsonb_typeof(track) is distinct from 'object' or jsonb_typeof(track->'url') is distinct from 'string' or jsonb_typeof(track->'label') is distinct from 'string'
 or jsonb_typeof(track->'source') is distinct from 'string' or jsonb_typeof(track->'loop') is distinct from 'boolean' or track->>'source' not in ('bundled','upload','url')
 or char_length(track->>'url') not between 1 and 2048 or char_length(track->>'label') not between 1 and 80
 or not (track->>'url' ~ '^/[^/]' or track->>'url' ~ '^https://')
 or track->>'url' ~* '^https://([^/]*\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)([:/]|$)' then raise exception using errcode='22023',message='INVALID_SITE_MUSIC_SOURCE'; end if;
 end loop;
 select * into current_row from public.site_music_configuration where singleton_id for update;
 if not found or current_row.revision<>p_expected_revision then raise exception using errcode='PT409',message='SITE_MUSIC_VERSION_CONFLICT'; end if;
 if current_row.enabled=(p_config->>'enabled')::boolean and current_row.default_track=p_config->'defaultTrack' and current_row.route_overrides=p_config->'routeOverrides' and current_row.song_library=p_config->'songLibrary' then return to_jsonb(current_row); end if;
 update public.site_music_configuration set enabled=(p_config->>'enabled')::boolean,default_track=p_config->'defaultTrack',route_overrides=p_config->'routeOverrides',song_library=p_config->'songLibrary',revision=revision+1,updated_by=p_actor_user_id,updated_at=clock_timestamp() where singleton_id returning * into result;
 return to_jsonb(result);
end; $$;
revoke update on public.site_music_configuration from service_role;
revoke all on function public.save_site_music_configuration_v1(uuid,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_site_music_configuration_v1(uuid,uuid,bigint,jsonb) to service_role;

-- Revoke default PUBLIC execute on every new overload; only the server can supply
-- authenticated actor context. Private helpers/tables are never browser APIs.
do $acl$
declare fn record;
begin
 for fn in select p.oid::regprocedure identity,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
 (n.nspname='public' and p.proname in ('search_master_moderation_players_v1','read_master_moderation_v1','write_master_moderation_v1','search_master_players_v1','read_master_player_v1','edit_master_player_v1','recover_master_player_battle_v1','read_master_panel_activity_v1','set_world_environment_v2','publish_battlefield_elevation_policy_v2','publish_battlefield_elevation_policy_v3','publish_combat_effect_timing_policy_v1','publish_combat_effect_timing_policy_v2'))
 or (n.nspname='app_private' and p.proname in ('master_page_capabilities_v1','assert_master_page_v1','prevent_moderation_history_change_v1')) loop
 execute 'revoke all on function '||fn.identity||' from public,anon,authenticated,service_role';
 if fn.nspname='public' and fn.proname<>'publish_combat_effect_timing_policy_v1' then execute 'grant execute on function '||fn.identity||' to service_role'; end if;
 end loop;
end; $acl$;
commit;
