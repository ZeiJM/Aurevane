begin;

-- Add identities only. Never rewrite retained definitions, publications or drafts.
insert into app_private.combat_content_records (
  content_key, content_kind, lifecycle, version_floor, builtin_version, builtin_name,
  builtin_source_discipline_id
)
values
  ('tag.range-up', 'tag', 'active', 1, 1, 'Range Up', null),
  ('tag.range-down', 'tag', 'active', 1, 1, 'Range Down', null)
on conflict (content_key) do nothing;

do $range_tag_identities$
declare ids text[]; tag text;
begin
  ids := app_private.content_presentation_tag_ids_v1();
  foreach tag in array array['range-up', 'range-down'] loop
    if not (tag = any(ids)) then ids := array_append(ids, tag); end if;
  end loop;
  execute format(
    'create or replace function app_private.content_presentation_tag_ids_v1() returns text[] language sql immutable set search_path='''' as %L',
    'select ' || quote_literal(ids) || '::text[]'
  );
end;
$range_tag_identities$;

-- Extend each installed Owner/delegated writer; preserve authorization, stale
-- guards, same-value behavior, privileges and immutable timing history.
do $range_timing_identities$
declare
  fn record; definition text; vocabulary text; tag text;
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
    if vocabulary is null then raise exception 'Expected finite timing vocabulary in %', fn.identity; end if;
    foreach tag in array array['range-up', 'range-down'] loop
      if strpos(vocabulary, quote_literal(tag)) = 0 then
        definition := replace(definition, anchor, anchor || quote_literal(tag) || ',');
      end if;
    end loop;
    execute definition;
  end loop;
  if not found_writer then raise exception 'Expected combat timing writer missing'; end if;
end;
$range_timing_identities$;

revoke all on function app_private.content_presentation_tag_ids_v1() from public, anon, authenticated, service_role;

commit;
