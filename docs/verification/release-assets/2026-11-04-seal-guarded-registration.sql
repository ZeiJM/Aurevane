begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $pre$ begin
 if now()<timestamptz '2026-11-04T22:49:11.294834Z' then raise exception 'SEAL_DRAIN_INCOMPLETE';end if;
 if exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and backend_type='client backend' and xact_start<timestamptz '2026-11-04T22:16:41.294834Z') then raise exception 'SEAL_OLD_TRANSACTION';end if;
 if exists(select 1 from (values ('public.publish_combat_effect_timing_policy_v1(uuid,integer,jsonb,text)','5c46cdd60491fc3d23eb29780a13c583'),('public.publish_combat_effect_timing_policy_v1(uuid,integer,jsonb,text,uuid)','4857b44a2d869157c40dc38ff1b56db8'),('app_private.content_presentation_tag_ids_v1()','c16b840682be6d56c991bddc5b40d392')) x(identity,hash) where md5(pg_get_functiondef(x.identity::regprocedure))<>x.hash) then raise exception 'SEAL_PREDECESSOR_CHANGED';end if;
end;$pre$;
lock table app_private.combat_content_records, app_private.combat_content_versions, app_private.combat_content_publications, app_private.combat_content_drafts, app_private.combat_effect_timing_policy_versions, app_private.runtime_item_source_definitions, app_private.character_item_inventory, app_private.character_item_stacks, app_private.character_item_grants in share row exclusive mode;
create temporary table seal_rows_before on commit drop as select 'combat_content_records' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_records t where content_key<>'tag.seal') v
union all
select 'combat_content_versions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_versions t) v
union all
select 'combat_content_publications' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_publications t) v
union all
select 'combat_content_drafts' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_drafts t) v
union all
select 'combat_effect_timing_policy_versions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_effect_timing_policy_versions t) v
union all
select 'runtime_item_source_definitions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.runtime_item_source_definitions t) v
union all
select 'character_item_inventory' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_inventory t) v
union all
select 'character_item_stacks' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_stacks t) v
union all
select 'character_item_grants' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_grants t) v;
create temporary table seal_functions_before on commit drop as select p.oid,pg_get_functiondef(p.oid) definition,p.proowner,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prokind='f';
create temporary table seal_ids_before on commit drop as select app_private.content_presentation_tag_ids_v1() ids;


-- Add the implemented identity only; retained metadata and authored content remain immutable.
insert into app_private.combat_content_records (
  content_key, content_kind, lifecycle, version_floor, builtin_version, builtin_name,
  builtin_source_discipline_id
)
values ('tag.seal', 'tag', 'active', 1, 1, 'Seal', null)
on conflict (content_key) do nothing;

-- Extend the installed list without replacing later additions or changing function privileges.
do $seal_tag_identity$
declare ids text[];
begin
  ids := app_private.content_presentation_tag_ids_v1();
  if not ('seal' = any(ids)) then
    execute format(
      'create or replace function app_private.content_presentation_tag_ids_v1() returns text[] language sql immutable set search_path='''' as %L',
      'select ' || quote_literal(array_append(ids, 'seal')) || '::text[]'
    );
  end if;
end;
$seal_tag_identity$;

-- Patch only the installed Owner and delegated timing vocabularies. Preserve each
-- current writer's authorization, locks, version checks, unchanged-save rule and ACL.
do $seal_timing_identity$
declare
  fn record;
  definition text;
  vocabulary text;
  anchor constant text := 'entry.key not in (';
  found_writer boolean := false;
begin
  for fn in
    select p.oid, p.oid::regprocedure identity
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'publish_combat_effect_timing_policy_v1'
  loop
    found_writer := true;
    definition := pg_get_functiondef(fn.oid);
    if (length(definition) - length(replace(definition, anchor, ''))) <> length(anchor) then
      raise exception 'Expected one finite timing vocabulary in %', fn.identity;
    end if;
    vocabulary := substring(definition from 'entry\.key not in \(([^)]*)\)');
    if vocabulary is null then
      raise exception 'Expected finite timing vocabulary in %', fn.identity;
    end if;
    if strpos(vocabulary, '''seal''') = 0 then
      execute replace(definition, anchor, anchor || '''seal'',');
    end if;
  end loop;
  if not found_writer then raise exception 'Expected combat timing writer missing'; end if;
end;
$seal_timing_identity$;

revoke all on function app_private.content_presentation_tag_ids_v1() from public, anon, authenticated, service_role;


create temporary table seal_rows_after on commit drop as select 'combat_content_records' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_records t where content_key<>'tag.seal') v
union all
select 'combat_content_versions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_versions t) v
union all
select 'combat_content_publications' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_publications t) v
union all
select 'combat_content_drafts' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_drafts t) v
union all
select 'combat_effect_timing_policy_versions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_effect_timing_policy_versions t) v
union all
select 'runtime_item_source_definitions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.runtime_item_source_definitions t) v
union all
select 'character_item_inventory' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_inventory t) v
union all
select 'character_item_stacks' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_stacks t) v
union all
select 'character_item_grants' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_grants t) v;
do $guard$ begin
 if exists((table seal_rows_before except table seal_rows_after) union all (table seal_rows_after except table seal_rows_before)) then raise exception 'SEAL_DURABLE_PRESERVATION_FAILED';end if;
 if exists(select 1 from seal_functions_before b left join pg_proc p on p.oid=b.oid where p.oid is null or p.proowner is distinct from b.proowner or p.proacl is distinct from b.proacl or (p.proname not in ('content_presentation_tag_ids_v1','publish_combat_effect_timing_policy_v1') and pg_get_functiondef(p.oid) is distinct from b.definition)) then raise exception 'SEAL_FUNCTION_PRESERVATION_FAILED';end if;
 if (select count(*) from app_private.combat_content_records where content_key='tag.seal' and content_kind='tag' and lifecycle='active' and builtin_version=1)<>1 then raise exception 'SEAL_IDENTITY_FAILED';end if;
 if app_private.content_presentation_tag_ids_v1() is distinct from (select array_append(ids,'seal') from seal_ids_before) then raise exception 'SEAL_PRESENTATION_FAILED';end if;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='publish_combat_effect_timing_policy_v1' and strpos(pg_get_functiondef(p.oid),quote_literal('seal'))>0)<>2 then raise exception 'SEAL_TIMING_FAILED';end if;
end;$guard$;
commit;
