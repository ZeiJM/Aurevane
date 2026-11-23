begin;

-- Complete-record state extends the existing immutable store. The revision also
-- covers lifecycle transitions; a restored-from attribution is never permission.
create table app_private.combat_content_records (
  content_key text primary key,
  content_kind text not null check(content_kind in ('skill','essence','resonance','status','effect-profile','discipline','tag','item','ascension','severence')),
  lifecycle text not null check(lifecycle in ('draft','active','archived')),
  revision bigint not null default 1 check(revision>0),
  draft_sequence bigint not null default 0 check(draft_sequence>=0),
  version_floor integer not null default 0 check(version_floor>=0),
  created_by uuid references auth.users(id),
  created_at timestamptz,
  restored_from integer,
  restored_by uuid references auth.users(id),
  restore_pending boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default clock_timestamp()
);
create table app_private.combat_content_record_requests (
  actor_user_id uuid not null references auth.users(id),
  request_id uuid not null,
  fingerprint text not null,
  result jsonb not null,
  primary key(actor_user_id,request_id)
);
create table app_private.combat_content_attribution (
  version_id uuid primary key references app_private.combat_content_versions(id),
  authored_by uuid references auth.users(id),
  authored_at timestamptz,
  restored_from integer,
  restored_by uuid references auth.users(id)
);
create table app_private.combat_content_links (
  parent_key text not null references app_private.combat_content_records(content_key),
  child_key text not null references app_private.combat_content_records(content_key),
  primary key(parent_key,child_key),
  check(parent_key<>child_key)
);
create index combat_content_links_child_idx on app_private.combat_content_links(child_key);
create index combat_content_records_list_idx on app_private.combat_content_records(content_kind,lifecycle,content_key);

-- Existing attribution is unknown, not inferred from publisher identity.
insert into app_private.combat_content_records(content_key,content_kind,lifecycle,draft_sequence,version_floor)
select keys.content_key,keys.content_kind,
  case when p.content_key is not null then 'active' else 'draft' end,
  coalesce(d.draft_version,0),coalesce(h.floor,0)
from (select content_key,content_kind from app_private.combat_content_versions
  union select content_key,content_kind from app_private.combat_content_drafts) keys
left join app_private.combat_content_publications p using(content_key,content_kind)
left join app_private.combat_content_drafts d using(content_key,content_kind)
left join (select content_key,max(content_version) floor from app_private.combat_content_versions group by content_key) h using(content_key);

alter table app_private.combat_content_records enable row level security;
alter table app_private.combat_content_record_requests enable row level security;
alter table app_private.combat_content_attribution enable row level security;
alter table app_private.combat_content_links enable row level security;
revoke all on app_private.combat_content_records,app_private.combat_content_record_requests,
 app_private.combat_content_attribution,app_private.combat_content_links from public,anon,authenticated,service_role;

-- New finite noncombat envelopes share the physical history without becoming
-- battle definitions. Their strict semantic validation is a separate boundary.
alter table app_private.combat_content_drafts drop constraint combat_content_drafts_content_kind_check;
alter table app_private.combat_content_versions drop constraint combat_content_versions_content_kind_check;
alter table app_private.combat_content_publications drop constraint combat_content_publications_content_kind_check;
alter table app_private.combat_content_drafts add constraint combat_content_drafts_content_kind_check check(content_kind in ('skill','essence','resonance','status','effect-profile','discipline','tag','item','ascension','severence'));
alter table app_private.combat_content_versions add constraint combat_content_versions_content_kind_check check(content_kind in ('skill','essence','resonance','status','effect-profile','discipline','tag','item','ascension','severence'));
alter table app_private.combat_content_publications add constraint combat_content_publications_content_kind_check check(content_kind in ('skill','essence','resonance','status','effect-profile','discipline','tag','item','ascension','severence'));

create function app_private.combat_content_used_by_v1(p_key text)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]') from (
  select 'content-link' as kind,parent_key as key from app_private.combat_content_links where child_key=p_key
  union all select 'phase4-catalogue',skill_id from app_private.phase4_skill_catalog where skill_id=p_key or discipline_id=p_key
  union all select 'earned-skill',character_id::text from app_private.character_skill_unlocks where skill_id=p_key or source_discipline_id=p_key
  union all select 'equipped-skill',character_id::text from app_private.character_build_discipline_skills where skill_id=p_key or source_discipline_id=p_key
  union all select 'saved-loadout',character_id::text||':'||slot_index from app_private.character_saved_build_loadouts l
   where primary_discipline_id=p_key or secondary_discipline_id=p_key or exists(select 1 from jsonb_array_elements(l.discipline_skills) s where s->>'skillId'=p_key or s->>'sourceDisciplineId'=p_key)
 ) x;
$$;
create function app_private.combat_content_record_json_v1(p_key text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('contentKey',r.content_key,'contentKind',r.content_kind,'lifecycle',r.lifecycle,
  'revision',r.revision,'versionFloor',r.version_floor,'createdBy',r.created_by,'createdAt',r.created_at,
  'draft',(select jsonb_build_object('definition',d.definition,'draftVersion',d.draft_version,'baseVersion',d.base_version,'updatedBy',d.updated_by,'updatedAt',d.updated_at,'restoredFrom',r.restored_from,'restoredBy',r.restored_by) from app_private.combat_content_drafts d where d.content_key=r.content_key),
  'current',(select jsonb_build_object('contentVersion',v.content_version,'definition',v.definition,'publishedBy',v.published_by,'publishedAt',v.published_at,'authoredBy',a.authored_by,'authoredAt',a.authored_at,'restoredFrom',a.restored_from,'restoredBy',a.restored_by) from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id left join app_private.combat_content_attribution a on a.version_id=v.id where p.content_key=r.content_key),
  'history',coalesce((select jsonb_agg(h order by h."contentVersion" desc) from (select v.content_version as "contentVersion",v.definition,v.published_by as "publishedBy",v.published_at as "publishedAt",a.authored_by as "authoredBy",a.authored_at as "authoredAt",a.restored_from as "restoredFrom",a.restored_by as "restoredBy" from app_private.combat_content_versions v left join app_private.combat_content_attribution a on a.version_id=v.id where v.content_key=r.content_key order by v.content_version desc limit 3) h),'[]'),
  'usedBy',app_private.combat_content_used_by_v1(r.content_key),
  'links',coalesce((select jsonb_agg(child_key order by child_key) from app_private.combat_content_links where parent_key=r.content_key),'[]'))
 from app_private.combat_content_records r where r.content_key=p_key;
$$;
create function public.read_combat_content_record_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_content_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id);
 return app_private.combat_content_record_json_v1(p_content_key);
end; $$;
create function public.list_combat_content_records_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_kind text,p_lifecycle text,p_search text,p_after text,p_limit integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id);
 if p_limit is null or p_limit not between 1 and 100 or length(coalesce(p_search,''))>160
  or (p_kind is not null and p_kind not in ('skill','essence','resonance','status','effect-profile','discipline','tag','item','ascension','severence'))
  or (p_lifecycle is not null and p_lifecycle not in ('draft','active','archived')) then
  raise exception using errcode='22023',message='COMBAT_CONTENT_LIST_INVALID'; end if;
 select coalesce(jsonb_agg(x order by x."contentKey"),'[]') into v_result from (
  select r.content_key as "contentKey",r.content_kind as "contentKind",r.lifecycle,r.revision,
   coalesce(d.definition->>'name',v.definition->>'name',r.content_key) as name
  from app_private.combat_content_records r left join app_private.combat_content_drafts d using(content_key)
  left join app_private.combat_content_publications p using(content_key)
  left join app_private.combat_content_versions v on v.id=p.version_id
  where (p_kind is null or r.content_kind=p_kind) and (p_lifecycle is null or r.lifecycle=p_lifecycle)
   and (p_after is null or r.content_key collate "C">p_after collate "C")
   and (p_search is null or position(lower(p_search) in lower(r.content_key||' '||coalesce(d.definition->>'name',v.definition->>'name','')))>0)
  order by r.content_key collate "C" limit p_limit
 ) x;
 return jsonb_build_object('records',v_result,'nextCursor',case when jsonb_array_length(v_result)=p_limit then v_result->-1->>'contentKey' else null end);
end; $$;

create function app_private.validate_content_record_identity_v1(p_key text,p_kind text,p_definition jsonb)
returns void language plpgsql immutable set search_path='' as $$
begin
 if p_key is null or length(p_key) not between 3 and 160 or p_key !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  or p_kind is null or p_kind not in ('skill','essence','resonance','status','effect-profile','discipline','tag','item','ascension','severence')
  or jsonb_typeof(p_definition) is distinct from 'object' or octet_length(p_definition::text)>262144 then
  raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 if p_kind='essence' then
  if p_definition->>'essenceId' is distinct from p_key or p_definition->'skill'->>'id' is distinct from p_key then
   raise exception using errcode='22023',message='COMBAT_CONTENT_IDENTITY_MISMATCH'; end if;
 elsif p_definition->>'id' is distinct from p_key then
  raise exception using errcode='22023',message='COMBAT_CONTENT_IDENTITY_MISMATCH'; end if;
 if p_key in ('basic.move','unarmed.basic','basic.guard','basic.recover','basic.recover.mp') and p_kind<>'skill' then
  raise exception using errcode='22023',message='COMBAT_CONTENT_BASIC_KIND_INVALID'; end if;
end; $$;

create function public.write_combat_content_record_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_content_key text,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r app_private.combat_content_records; source app_private.combat_content_records;
 v_action text:=p_command->>'action'; v_definition jsonb; v_kind text; v_base integer;
 v_request uuid; v_fingerprint text; v_existing app_private.combat_content_record_requests;
 v_result jsonb; v_version app_private.combat_content_versions; v_original app_private.combat_content_attribution;
begin
 perform app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id);
 if jsonb_typeof(p_command) is distinct from 'object' or v_action is null or v_action not in ('create','duplicate','save','restore','archive','link','unlink') then
  raise exception using errcode='22023',message='COMBAT_CONTENT_COMMAND_INVALID'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('combat-catalogue-publication',0));
 if v_action in ('create','duplicate') then
  if p_command->>'requestId' is null then raise exception using errcode='22023',message='COMBAT_CONTENT_REQUEST_REQUIRED'; end if;
  v_request:=(p_command->>'requestId')::uuid; v_fingerprint:=md5(p_content_key||p_command::text);
  select * into v_existing from app_private.combat_content_record_requests where actor_user_id=p_actor_user_id and request_id=v_request;
  if found then
   if v_existing.fingerprint<>v_fingerprint then raise exception using errcode='40001',message='COMBAT_CONTENT_REQUEST_CONFLICT'; end if;
   return v_existing.result;
  end if;
 end if;
 select * into r from app_private.combat_content_records where content_key=p_content_key for update;
 if v_action in ('create','duplicate') then
  if found then raise exception using errcode='40001',message='COMBAT_CONTENT_IDENTITY_CONFLICT'; end if;
  if v_action='duplicate' then
   select * into source from app_private.combat_content_records where content_key=p_command->>'sourceKey';
   if not found or source.revision is distinct from (p_command->>'expectedSourceRevision')::bigint then raise exception using errcode='40001',message='COMBAT_CONTENT_RECORD_CONFLICT'; end if;
   v_kind:=source.content_kind;
   select definition into v_definition from app_private.combat_content_drafts where content_key=source.content_key;
   if not found then select v.definition into v_definition from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id where p.content_key=source.content_key; end if;
   v_definition:=jsonb_set(v_definition,'{id}',to_jsonb(p_content_key));
   if v_kind='essence' then v_definition:=jsonb_set(jsonb_set(v_definition,'{essenceId}',to_jsonb(p_content_key)),'{skill,id}',to_jsonb(p_content_key)); end if;
  else v_kind:=p_command->>'contentKind'; v_definition:=p_command->'definition'; end if;
  perform app_private.validate_content_record_identity_v1(p_content_key,v_kind,v_definition);
  insert into app_private.combat_content_records(content_key,content_kind,lifecycle,created_by,created_at,updated_by)
   values(p_content_key,v_kind,'draft',p_actor_user_id,clock_timestamp(),p_actor_user_id) returning * into r;
 elsif r.content_key is null then raise exception using errcode='22023',message='COMBAT_CONTENT_NOT_FOUND';
 elsif r.revision is distinct from (p_command->>'expectedRevision')::bigint then raise exception using errcode='40001',message='COMBAT_CONTENT_RECORD_CONFLICT';
 else
  v_kind:=r.content_kind;
  update app_private.combat_content_records set revision=revision+1,updated_by=p_actor_user_id,updated_at=clock_timestamp() where content_key=p_content_key returning * into r;
 end if;
 if v_action='archive' then
  if p_content_key in ('basic.move','unarmed.basic','basic.guard','basic.recover','basic.recover.mp') then raise exception using errcode='22023',message='COMBAT_CONTENT_ESSENTIAL'; end if;
  if jsonb_array_length(app_private.combat_content_used_by_v1(p_content_key))>0 then raise exception using errcode='22023',message='COMBAT_CONTENT_DEPENDENCIES'; end if;
  update app_private.combat_content_records set lifecycle='archived',restore_pending=false where content_key=p_content_key;
  delete from app_private.combat_content_publications where content_key=p_content_key;
 elsif v_action in ('link','unlink') then
  select * into source from app_private.combat_content_records where content_key=p_command->>'childKey';
  if r.content_kind<>'discipline' or r.lifecycle='archived' or source.content_kind<>'skill' or source.lifecycle='archived' or source.content_key is null then raise exception using errcode='22023',message='COMBAT_CONTENT_LINK_INVALID'; end if;
  if v_action='link' then insert into app_private.combat_content_links values(p_content_key,source.content_key) on conflict do nothing;
  else delete from app_private.combat_content_links where parent_key=p_content_key and child_key=source.content_key; end if;
 else
  select v.content_version into v_base from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id where p.content_key=p_content_key;
  if v_action='restore' then
   select * into v_version from app_private.combat_content_versions where content_key=p_content_key and content_version=(p_command->>'sourceVersion')::integer;
   if not found then raise exception using errcode='22023',message='COMBAT_CONTENT_VERSION_NOT_FOUND'; end if;
   v_definition:=v_version.definition;
   update app_private.combat_content_records set restored_from=v_version.content_version,restored_by=p_actor_user_id,restore_pending=true where content_key=p_content_key;
  elsif v_action='save' then
   v_definition:=p_command->'definition';
   if r.content_kind='skill' and exists(select 1 from app_private.combat_content_drafts d where d.content_key=p_content_key and d.definition->'sourceDisciplineId' is distinct from v_definition->'sourceDisciplineId') then raise exception using errcode='22023',message='COMBAT_CONTENT_SOURCE_IMMUTABLE'; end if;
  end if;
  perform app_private.validate_content_record_identity_v1(p_content_key,v_kind,v_definition);
  update app_private.combat_content_records set draft_sequence=draft_sequence+1 where content_key=p_content_key returning * into r;
  insert into app_private.combat_content_drafts(content_key,content_kind,definition,base_version,draft_version,updated_by)
   values(p_content_key,v_kind,v_definition,v_base,r.draft_sequence,p_actor_user_id)
   on conflict(content_key) do update set definition=excluded.definition,base_version=excluded.base_version,draft_version=excluded.draft_version,updated_by=excluded.updated_by,updated_at=clock_timestamp();
 end if;
 v_result:=app_private.combat_content_record_json_v1(p_content_key);
 if v_request is not null then insert into app_private.combat_content_record_requests values(p_actor_user_id,v_request,v_fingerprint,v_result); end if;
 return v_result;
end; $$;

create function public.publish_saved_combat_content_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_content_key text,p_expected_draft_version bigint,p_expected_base_version integer,p_expected_catalogue_token text,p_version_floor integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r app_private.combat_content_records; d app_private.combat_content_drafts;
 v_current integer; v_next integer; v_definition jsonb; v_id uuid; v_author uuid; v_authored_at timestamptz;
begin
 perform app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id);
 perform app_private.lock_combat_content_catalogue_v1(p_expected_catalogue_token);
 select * into r from app_private.combat_content_records where content_key=p_content_key for update;
 if r.content_key is null then raise exception using errcode='22023',message='COMBAT_CONTENT_NOT_FOUND'; end if;
 if r.lifecycle='archived' and not r.restore_pending then raise exception using errcode='22023',message='COMBAT_CONTENT_RESTORE_REQUIRED'; end if;
 select * into d from app_private.combat_content_drafts where content_key=p_content_key;
 if d.content_key is null or d.draft_version is distinct from p_expected_draft_version then raise exception using errcode='40001',message='COMBAT_CONTENT_DRAFT_VERSION_CONFLICT'; end if;
 select v.content_version into v_current from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id where p.content_key=p_content_key;
 if v_current is distinct from p_expected_base_version or d.base_version is distinct from p_expected_base_version then raise exception using errcode='40001',message='COMBAT_CONTENT_BASE_VERSION_CONFLICT'; end if;
 if p_version_floor is not null and p_version_floor<1 then raise exception using errcode='22023',message='COMBAT_CONTENT_VERSION_FLOOR_INVALID'; end if;
 perform app_private.validate_content_record_identity_v1(p_content_key,r.content_kind,d.definition);
 if r.content_kind in ('item','ascension','severence','discipline','tag') then raise exception using errcode='22023',message='COMBAT_CONTENT_'||upper(r.content_kind)||'_RUNTIME_UNSUPPORTED'; end if;
 select greatest(coalesce(max(content_version),0),r.version_floor,coalesce(p_version_floor,0)) into v_next from app_private.combat_content_versions where content_key=p_content_key;
 if v_next=2147483647 then raise exception using errcode='22023',message='COMBAT_CONTENT_VERSION_EXHAUSTED'; end if;
 v_next:=v_next+1; v_definition:=jsonb_set(d.definition,'{contentVersion}',to_jsonb(v_next));
 if r.content_kind='essence' then v_definition:=jsonb_set(v_definition,'{skill,contentVersion}',to_jsonb(v_next)); end if;
 insert into app_private.combat_content_versions(content_key,content_kind,content_version,definition,published_by)
  values(p_content_key,r.content_kind,v_next,v_definition,p_actor_user_id) returning id into v_id;
 v_author:=d.updated_by; v_authored_at:=d.updated_at;
 if r.restored_from is not null then select a.authored_by,a.authored_at into v_author,v_authored_at from app_private.combat_content_attribution a join app_private.combat_content_versions v on v.id=a.version_id where v.content_key=p_content_key and v.content_version=r.restored_from; end if;
 insert into app_private.combat_content_attribution values(v_id,v_author,v_authored_at,r.restored_from,r.restored_by);
 insert into app_private.combat_content_publications(content_key,content_kind,version_id,updated_by)
  values(p_content_key,r.content_kind,v_id,p_actor_user_id)
  on conflict(content_key) do update set version_id=excluded.version_id,updated_by=excluded.updated_by,updated_at=clock_timestamp();
 update app_private.combat_content_records set lifecycle='active',revision=revision+1,version_floor=v_next,restore_pending=false,updated_by=p_actor_user_id,updated_at=clock_timestamp() where content_key=p_content_key;
 delete from app_private.combat_content_drafts where content_key=p_content_key;
 return app_private.combat_content_record_json_v1(p_content_key);
end; $$;

-- Preserve the actual latest policy reader (including global tagAuthority), and
-- add all lifecycle/draft revisions to CAS. Archives remain explicit tombstones.
create or replace function public.read_combat_content_catalogue_v1()
returns jsonb language sql stable security definer set search_path='' as $$
 with records as (
 select coalesce(jsonb_agg(to_jsonb(v) order by v.content_key),'[]') publications
 from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id
 ), states as (
 select coalesce(jsonb_agg(to_jsonb(r) order by content_key),'[]') value,
 coalesce(jsonb_agg(content_key order by content_key) filter(where lifecycle='archived'),'[]') archived
 from app_private.combat_content_records r
 ), policy as (select public.read_combat_effect_timing_policy_v1() value)
 select jsonb_build_object('token',md5(jsonb_build_object('publications',records.publications,'records',states.value,'policy',policy.value)::text),
 'publications',records.publications,'archivedKeys',states.archived,'policy',policy.value) from records cross join states cross join policy;
$$;

revoke all on function app_private.combat_content_used_by_v1(text),app_private.combat_content_record_json_v1(text),app_private.validate_content_record_identity_v1(text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.read_combat_content_record_v1(uuid,uuid,text),public.list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer),public.write_combat_content_record_v1(uuid,uuid,text,jsonb),public.publish_saved_combat_content_v1(uuid,uuid,text,bigint,integer,text,integer) from public,anon,authenticated;
grant execute on function public.read_combat_content_record_v1(uuid,uuid,text),public.list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer),public.write_combat_content_record_v1(uuid,uuid,text,jsonb),public.publish_saved_combat_content_v1(uuid,uuid,text,bigint,integer,text,integer) to service_role;
commit;
