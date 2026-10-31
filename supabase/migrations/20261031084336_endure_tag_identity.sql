begin;

-- Register metadata only: no drafts, publications, immutable content or timing rows change.
insert into app_private.combat_content_records(
  content_key, content_kind, lifecycle, version_floor, builtin_version, builtin_name,
  builtin_source_discipline_id
)
values ('tag.endure', 'tag', 'active', 1, 1, 'Endure', null)
on conflict (content_key) do update set
  builtin_version = greatest(app_private.combat_content_records.builtin_version, excluded.builtin_version),
  builtin_name = excluded.builtin_name,
  version_floor = greatest(app_private.combat_content_records.version_floor, excluded.version_floor)
where app_private.combat_content_records.content_kind = 'tag';

-- Extend the installed vocabulary rather than replacing Counter or later identities.
do $migration$
declare ids text[];
begin
 ids := app_private.content_presentation_tag_ids_v1();
 if not ('endure' = any(ids)) then
  ids := ids || array['endure'];
  execute format(
   'create or replace function app_private.content_presentation_tag_ids_v1() returns text[] language sql immutable set search_path='''' as %L',
   'select ' || quote_literal(ids) || '::text[]'
  );
 end if;
end;
$migration$;

-- The native opcode already maps to Endure through the classifier's type fallback.
-- Endure is an ordinary removable Buff; preserve all other installed classifications.
do $migration$
declare definition text; updated text;
begin
 definition := pg_get_functiondef('app_private.content_effect_presentation_id_v1(jsonb)'::regprocedure);
 if app_private.content_effect_presentation_id_v1('{"type":"remove-status","statusIds":["endure"],"removalMode":"specified"}'::jsonb) <> 'dispel' then
  updated := replace(definition, 'positive||array[', 'positive||array[''endure'',');
  if updated = definition then raise exception 'Expected positive status vocabulary missing'; end if;
  execute updated;
 end if;
end;
$migration$;

-- Update only finite timing vocabularies in the installed Owner/selected-character
-- writers, preserving newer IDs, authorization, locks, CAS, audits and existing ACLs.
do $migration$
declare fn record; definition text; updated text; found_writer boolean := false;
begin
 for fn in
  select p.oid, p.oid::regprocedure identity
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'publish_combat_effect_timing_policy_v1'
 loop
  found_writer := true;
  definition := pg_get_functiondef(fn.oid);
  if strpos(definition, '''endure''') = 0 then
   updated := replace(definition, 'entry.key not in (', 'entry.key not in (''endure'',');
   if updated = definition then
    raise exception 'Expected finite timing vocabulary missing from %', fn.identity;
   end if;
   execute updated;
  end if;
 end loop;
 if not found_writer then raise exception 'Expected combat timing writer missing'; end if;
end;
$migration$;

revoke all on function app_private.content_presentation_tag_ids_v1(), app_private.content_effect_presentation_id_v1(jsonb) from public, anon, authenticated, service_role;

commit;
