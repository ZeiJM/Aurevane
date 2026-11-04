begin;

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

commit;
