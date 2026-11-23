begin;

-- Account entitlements are independent of earned character progression. Revocation
-- affects future selections; immutable encounters keep the admitted power capture.
create table app_private.discipline_player_grants (
 target_user_id uuid not null references auth.users(id) on delete cascade,
 discipline_id text not null,
 granted_by uuid not null,
 granted_at timestamptz not null default now(),
 revoked_by uuid,
 revoked_at timestamptz,
 primary key(target_user_id,discipline_id)
);
create index discipline_player_grants_active_discipline_idx on app_private.discipline_player_grants(discipline_id,target_user_id) where revoked_at is null;
create table app_private.discipline_player_grant_audit (
 id bigint generated always as identity primary key,
 actor_user_id uuid not null,
 actor_character_id uuid,
 target_user_id uuid not null,
 discipline_id text not null,
 action text not null check(action in ('grant','revoke')),
 reason text not null check(length(btrim(reason)) between 1 and 500),
 created_at timestamptz not null default now()
);
alter table app_private.discipline_player_grants enable row level security;
alter table app_private.discipline_player_grant_audit enable row level security;
revoke all on app_private.discipline_player_grants,app_private.discipline_player_grant_audit from public,anon,authenticated,service_role;

create function public.search_discipline_grant_players_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_query text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'content.combat.author') then raise exception using errcode='42501',message='MASTER_FORBIDDEN'; end if;
 if p_query is null or length(btrim(p_query)) not between 2 and 80 then raise exception using errcode='22023',message='PLAYER_QUERY_INVALID'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
 select c.user_id as "accountId",c.id as "characterId",c.name as "name" from public.characters c join auth.users u on u.id=c.user_id
 where not exists(select 1 from app_private.character_deletion_requests deletion where deletion.character_id=c.id) and not exists(select 1 from app_private.account_deletion_requests deletion where deletion.user_id=c.user_id) and u.email_confirmed_at is not null and position(lower(btrim(p_query)) in lower(c.name))>0
 order by lower(c.name),c.id limit 20) t);
end; $$;
create function public.read_discipline_player_grants_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_discipline_id text,p_after uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'content.combat.author') then raise exception using errcode='42501',message='MASTER_FORBIDDEN'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
 select g.target_user_id as "accountId",coalesce((select c.name from public.characters c where c.user_id=g.target_user_id and not exists(select 1 from app_private.character_deletion_requests deletion where deletion.character_id=c.id) and not exists(select 1 from app_private.account_deletion_requests deletion where deletion.user_id=c.user_id) order by c.slot_index,c.id limit 1),'Account without an active character') as name,g.granted_at as "grantedAt"
 from app_private.discipline_player_grants g where g.discipline_id=p_discipline_id and g.revoked_at is null and (p_after is null or g.target_user_id>p_after) order by g.target_user_id limit 100) t);
end; $$;
create function public.write_discipline_player_grants_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_discipline_id text,p_account_ids uuid[],p_action text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; previous app_private.discipline_player_grants; changed integer:=0;
begin
 if not app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'content.combat.author') then raise exception using errcode='42501',message='MASTER_FORBIDDEN'; end if;
 if p_account_ids is null or cardinality(p_account_ids) not between 1 and 50 or array_position(p_account_ids,null) is not null or p_action not in ('grant','revoke') or p_action is null or p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception using errcode='22023',message='DISCIPLINE_GRANT_INVALID'; end if;
 perform app_private.lock_current_discipline_selection_v1();
 if p_action='grant' and not exists(select 1 from app_private.current_discipline_definitions_v1() d where d.discipline_id=p_discipline_id and (d.enabled_for_primary or d.enabled_for_secondary)) then raise exception using errcode='22023',message='DISCIPLINE_GRANT_UNAVAILABLE'; end if;
 for target in select distinct unnest(p_account_ids) order by 1 loop
  -- Lock stable identity to serialize simultaneous grant/revoke and account removal.
  perform 1 from auth.users u where u.id=target and (p_action='revoke' or (u.email_confirmed_at is not null and exists(select 1 from public.characters c where c.user_id=u.id and not exists(select 1 from app_private.character_deletion_requests deletion where deletion.character_id=c.id) and not exists(select 1 from app_private.account_deletion_requests deletion where deletion.user_id=c.user_id)))) for update;
  if not found then raise exception using errcode='22023',message='DISCIPLINE_GRANT_RECIPIENT_UNAVAILABLE'; end if;
  select * into previous from app_private.discipline_player_grants where target_user_id=target and discipline_id=p_discipline_id;
  if p_action='grant' and (previous.target_user_id is null or previous.revoked_at is not null) then
   insert into app_private.discipline_player_grants(target_user_id,discipline_id,granted_by) values(target,p_discipline_id,p_actor_user_id)
   on conflict(target_user_id,discipline_id) do update set granted_by=excluded.granted_by,granted_at=now(),revoked_at=null,revoked_by=null;
  elsif p_action='revoke' and previous.target_user_id is not null and previous.revoked_at is null then
   update app_private.discipline_player_grants set revoked_by=p_actor_user_id,revoked_at=now() where target_user_id=target and discipline_id=p_discipline_id;
  else continue;
  end if;
  changed:=changed+1;
  insert into app_private.discipline_player_grant_audit(actor_user_id,actor_character_id,target_user_id,discipline_id,action,reason) values(p_actor_user_id,p_actor_character_id,target,p_discipline_id,p_action,btrim(p_reason));
  insert into app_private.master_panel_activity(actor,action,subject,detail)
  values(app_private.master_activity_actor_v1(p_actor_user_id,p_actor_character_id),case p_action when 'grant' then 'Granted Discipline' else 'Revoked Discipline grant' end,
   coalesce((select d.name from app_private.current_discipline_definitions_v1() d where d.discipline_id=p_discipline_id),p_discipline_id),
   left(coalesce((select c.name from public.characters c where c.user_id=target order by c.slot_index,c.id limit 1),'Player')||': '||btrim(p_reason),400));
 end loop;
 return jsonb_build_object('changed',changed);
end; $$;
revoke all on function public.search_discipline_grant_players_v1(uuid,uuid,text),public.read_discipline_player_grants_v1(uuid,uuid,text,uuid),public.write_discipline_player_grants_v1(uuid,uuid,text,uuid[],text,text) from public,anon,authenticated;
grant execute on function public.search_discipline_grant_players_v1(uuid,uuid,text),public.read_discipline_player_grants_v1(uuid,uuid,text,uuid),public.write_discipline_player_grants_v1(uuid,uuid,text,uuid[],text,text) to service_role;

create function app_private.discipline_grant_only_v1(p_discipline_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id where p.content_kind='discipline' and p.content_key=p_discipline_id and v.definition->'unlock'='{"kind":"unavailable"}'::jsonb);
$$;
revoke all on function app_private.discipline_grant_only_v1(text) from public,anon,authenticated,service_role;
alter function app_private.discipline_unlocked_v1(uuid,text) rename to discipline_unlocked_before_player_grants_v1;
create function app_private.discipline_unlocked_v1(p_character_id uuid,p_discipline_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select (not app_private.discipline_grant_only_v1(p_discipline_id) and app_private.discipline_unlocked_before_player_grants_v1(p_character_id,p_discipline_id))
 or (exists(select 1 from app_private.current_discipline_definitions_v1() d where d.discipline_id=p_discipline_id and (d.enabled_for_primary or d.enabled_for_secondary)) and exists(select 1 from app_private.discipline_player_grants g join public.characters c on c.user_id=g.target_user_id where c.id=p_character_id and not exists(select 1 from app_private.character_deletion_requests deletion where deletion.character_id=c.id) and not exists(select 1 from app_private.account_deletion_requests deletion where deletion.user_id=c.user_id) and g.discipline_id=p_discipline_id and g.revoked_at is null));
$$;

create function app_private.discipline_account_granted_v1(p_character_id uuid,p_discipline_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.discipline_player_grants g join public.characters c on c.user_id=g.target_user_id where c.id=p_character_id and g.discipline_id=p_discipline_id and g.revoked_at is null);
$$;
revoke all on function app_private.discipline_account_granted_v1(uuid,text) from public,anon,authenticated,service_role;
alter function public.get_character_discipline_catalog_v3(uuid,uuid) rename to discipline_catalog_before_player_grants_v3;
create function public.get_character_discipline_catalog_v3(p_user_id uuid,p_character_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(row||jsonb_build_object('player_granted',app_private.discipline_account_granted_v1(p_character_id,row->>'discipline_id'),'enabled_for_secondary',(row->>'enabled_for_secondary')::boolean and (not app_private.discipline_grant_only_v1(row->>'discipline_id') or app_private.discipline_account_granted_v1(p_character_id,row->>'discipline_id')))),'[]') from jsonb_array_elements(public.discipline_catalog_before_player_grants_v3(p_user_id,p_character_id)) row;
$$;
revoke all on function public.discipline_catalog_before_player_grants_v3(uuid,uuid),public.get_character_discipline_catalog_v3(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_character_discipline_catalog_v3(uuid,uuid) to service_role;
do $migration$
declare d text; signature text; old text;
begin
 foreach signature in array array['public.change_character_disciplines_v2(uuid,uuid,bigint,boolean,text,boolean,text,uuid,text)'] loop
  d:=pg_get_functiondef(signature::regprocedure);
  old:=$before$if not app_private.discipline_testing_open_v1()
        and not exists ($before$;
  if strpos(d,old)=0 then raise exception 'DISCIPLINE_SECONDARY_GRANT_PREDECESSOR_CONFLICT'; end if;
  execute replace(d,old,$after$if app_private.discipline_grant_only_v1(v_secondary_definition.discipline_id) and not app_private.discipline_account_granted_v1(v_build.character_id,v_secondary_definition.discipline_id) then raise exception using errcode='22023',message='SECONDARY_DISCIPLINE_NOT_MASTERED'; end if;
      if not app_private.discipline_testing_open_v1()
        and not app_private.discipline_account_granted_v1(v_build.character_id,v_secondary_definition.discipline_id)
        and not exists ($after$);
 end loop;
end; $migration$;

-- Character creation also passes through the canonical active-build producer;
-- a grant-only authored Foundation cannot bypass entitlement by creating a slot.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('app_private.provision_character_active_build_v1()'::regprocedure);
 old:=E'begin\n';
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_GRANT_CREATION_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,old||$after$  if app_private.discipline_grant_only_v1(new.foundation_discipline_id) and not exists(select 1 from app_private.discipline_player_grants g where g.target_user_id=new.user_id and g.discipline_id=new.foundation_discipline_id and g.revoked_at is null) then raise exception using errcode='22023',message='PRIMARY_DISCIPLINE_MASTERY_REQUIRED'; end if;
$after$);
end; $migration$;

create function public.get_account_discipline_grants_v1(p_user_id uuid)
returns text[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(g.discipline_id order by g.discipline_id),'{}'::text[]) from app_private.discipline_player_grants g join auth.users u on u.id=g.target_user_id where g.target_user_id=p_user_id and g.revoked_at is null and u.email_confirmed_at is not null;
$$;
revoke all on function public.get_account_discipline_grants_v1(uuid) from public,anon,authenticated;
grant execute on function public.get_account_discipline_grants_v1(uuid) to service_role;

-- Optional authoring field selects one existing relationship. Ordinary mappings
-- remain unchanged. Two overriding disciplines choose the lowest stable ID,
-- independent of Primary/Secondary order; never stack two exceptional powers.
alter function app_private.validate_authored_discipline_envelope_v1(jsonb) rename to validate_discipline_envelope_before_override_v1;
create function app_private.validate_authored_discipline_envelope_v1(d jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare o jsonb;
begin
 perform app_private.validate_discipline_envelope_before_override_v1(d);
 o:=d->'relationshipOverride';
 if o is null or o='null'::jsonb then return; end if;
 if jsonb_typeof(o) is distinct from 'object' then raise exception using errcode='22023',message='DISCIPLINE_RELATIONSHIP_OVERRIDE_INVALID'; end if;
 if not o ? 'withDisciplineId' or exists(select 1 from jsonb_object_keys(o) k where k<>'withDisciplineId') then raise exception using errcode='22023',message='DISCIPLINE_RELATIONSHIP_OVERRIDE_INVALID'; end if;
 if o->'withDisciplineId'='null'::jsonb then
  if jsonb_typeof(d->'essenceId') is distinct from 'string' then raise exception using errcode='22023',message='DISCIPLINE_RELATIONSHIP_OVERRIDE_INVALID'; end if;
 elsif jsonb_typeof(o->'withDisciplineId') is distinct from 'string' or not exists(select 1 from jsonb_array_elements(d->'resonanceSelections') s where s->>'withDisciplineId'=o->>'withDisciplineId') then raise exception using errcode='22023',message='DISCIPLINE_RELATIONSHIP_OVERRIDE_INVALID'; end if;
end; $$;
do $migration$
declare d text;
begin
 d:=pg_get_functiondef('app_private.validate_noncombat_content_v1(text,jsonb)'::regprocedure);
 if strpos(d,'d-array[''atlas'',''skillStages'',''essenceId'',''resonanceSelections'']')=0 then raise exception 'DISCIPLINE_OVERRIDE_VALIDATION_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,'if p_kind=''discipline'' and d ?|','if p_kind=''discipline'' and d->''relationshipOverride''=''null''::jsonb then d:=d-''relationshipOverride''; end if; if p_kind=''discipline'' and d ?|');
 execute replace(d,'d-array[''atlas'',''skillStages'',''essenceId'',''resonanceSelections'']','d-array[''atlas'',''skillStages'',''essenceId'',''resonanceSelections'',''relationshipOverride'']');
 d:=pg_get_functiondef('app_private.project_published_discipline_v1(uuid)'::regprocedure);
 if strpos(d,'if d->''unlock''=''{'||'"kind":"unavailable"}''::jsonb then')=0 then raise exception 'DISCIPLINE_GRANT_ONLY_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,'if d->''unlock''=''{'||'"kind":"unavailable"}''::jsonb then raise exception using errcode=''22023'',message=''DISCIPLINE_PUBLICATION_INCOMPLETE''; end if;','');
end; $migration$;
create function app_private.current_discipline_relationship_override_v1(a text,b text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('disciplineId',p.content_key,'withDisciplineId',v.definition->'relationshipOverride'->'withDisciplineId')
 from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id
 where p.content_kind='discipline' and p.content_key in (a,b) and jsonb_typeof(v.definition->'relationshipOverride')='object'
 order by p.content_key collate "C" limit 1;
$$;
alter function app_private.current_essence_selection_key_v1(text,text) rename to essence_selection_key_before_override_v1;
alter function app_private.current_resonance_selection_key_v1(text,text) rename to resonance_selection_key_before_override_v1;
create function app_private.current_essence_selection_key_v1(a text,b text)
returns text language plpgsql stable security definer set search_path='' as $$
declare o jsonb;
begin
 perform app_private.assert_combat_content_current_v1(array_remove(array[a,b],null));
 o:=app_private.current_discipline_relationship_override_v1(a,b);
 if o is null then return app_private.essence_selection_key_before_override_v1(a,b); end if;
 if o->'withDisciplineId'<>'null'::jsonb then return null; end if;
 return app_private.essence_selection_key_before_override_v1(o->>'disciplineId',null);
end; $$;
create function app_private.current_resonance_selection_key_v1(a text,b text)
returns text language plpgsql stable security definer set search_path='' as $$
declare o jsonb;
begin
 perform app_private.assert_combat_content_current_v1(array_remove(array[a,b],null));
 o:=app_private.current_discipline_relationship_override_v1(a,b);
 if o is null then return app_private.resonance_selection_key_before_override_v1(a,b); end if;
 if o->'withDisciplineId'='null'::jsonb then return null; end if;
 return app_private.resonance_selection_key_before_override_v1(o->>'disciplineId',o->>'withDisciplineId');
end; $$;
alter function app_private.resolve_essence_reference_v1(text,text) rename to essence_reference_before_override_v1;
alter function app_private.resolve_resonance_reference_v1(text,text) rename to resonance_reference_before_override_v1;
do $migration$
declare d text;
begin
 d:=pg_get_functiondef('app_private.essence_reference_before_override_v1(text,text)'::regprocedure);
 execute replace(d,'app_private.current_essence_selection_key_v1','app_private.essence_selection_key_before_override_v1');
 d:=pg_get_functiondef('app_private.resonance_reference_before_override_v1(text,text)'::regprocedure);
 execute replace(d,'app_private.current_resonance_selection_key_v1','app_private.resonance_selection_key_before_override_v1');
end; $migration$;
create function app_private.resolve_essence_reference_v1(p_primary_discipline_id text,p_secondary_discipline_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o jsonb; r jsonb;
begin
 perform app_private.assert_combat_content_current_v1(array_remove(array[p_primary_discipline_id,p_secondary_discipline_id],null));
 o:=app_private.current_discipline_relationship_override_v1(p_primary_discipline_id,p_secondary_discipline_id);
 if o is null then return app_private.essence_reference_before_override_v1(p_primary_discipline_id,p_secondary_discipline_id); end if;
 if o->'withDisciplineId'<>'null'::jsonb then return null; end if;
 r:=app_private.essence_reference_before_override_v1(o->>'disciplineId',null);
 return r||jsonb_build_object('relationshipOverrideDisciplineId',o->>'disciplineId');
end; $$;
create function app_private.resolve_resonance_reference_v1(p_primary_discipline_id text,p_secondary_discipline_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o jsonb; r jsonb;
begin
 perform app_private.assert_combat_content_current_v1(array_remove(array[p_primary_discipline_id,p_secondary_discipline_id],null));
 o:=app_private.current_discipline_relationship_override_v1(p_primary_discipline_id,p_secondary_discipline_id);
 if o is null then return app_private.resonance_reference_before_override_v1(p_primary_discipline_id,p_secondary_discipline_id); end if;
 if o->'withDisciplineId'='null'::jsonb then return null; end if;
 r:=app_private.resonance_reference_before_override_v1(o->>'disciplineId',o->>'withDisciplineId');
 return r||jsonb_build_object('relationshipOverrideDisciplineId',o->>'disciplineId');
end; $$;
revoke all on function app_private.discipline_unlocked_v1(uuid,text),app_private.validate_authored_discipline_envelope_v1(jsonb),app_private.current_discipline_relationship_override_v1(text,text),app_private.current_essence_selection_key_v1(text,text),app_private.current_resonance_selection_key_v1(text,text),app_private.resolve_essence_reference_v1(text,text),app_private.resolve_resonance_reference_v1(text,text) from public,anon,authenticated,service_role;
-- Every newly admitted player capture must carry the exact server-selected
-- extension, including override provenance. Old physical captures are untouched.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('app_private.guard_player_battle_admission_v1()'::regprocedure);
 old:=$before$or v_capture->'catalogueToken' is distinct from v_expected->'catalogueToken'$before$;
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_OVERRIDE_ADMISSION_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,old||$after$
 or v_capture#>'{extensions,essence}' is distinct from v_expected#>'{extensions,essence}'
 or v_capture#>'{extensions,resonance}' is distinct from v_expected#>'{extensions,resonance}'$after$);
end; $migration$;
commit;
