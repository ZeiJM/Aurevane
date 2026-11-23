begin;

-- Register the new identity only. No draft, publication or immutable definition is changed.
insert into app_private.combat_content_records(
  content_key, content_kind, lifecycle, version_floor, builtin_version, builtin_name,
  builtin_source_discipline_id
)
values ('tag.counter', 'tag', 'active', 1, 1, 'Counter', null)
on conflict (content_key) do update set
  builtin_version = greatest(app_private.combat_content_records.builtin_version, excluded.builtin_version),
  builtin_name = excluded.builtin_name,
  version_floor = greatest(app_private.combat_content_records.version_floor, excluded.version_floor)
where app_private.combat_content_records.content_kind = 'tag';

-- Extend the installed identities so later tags survive a replay.
do $migration$
declare ids text[];
begin
 ids := app_private.content_presentation_tag_ids_v1();
 if not ('counter' = any(ids)) then
  execute format(
   'create or replace function app_private.content_presentation_tag_ids_v1() returns text[] language sql immutable set search_path='''' as %L',
   'select ' || quote_literal(array_append(ids, 'counter')) || '::text[]'
  );
 end if;
end;
$migration$;

-- Extend only current removal metadata; retain installed classifier branches and vocabulary.
do $migration$
declare definition text; updated text;
begin
 definition := pg_get_functiondef('app_private.content_effect_presentation_id_v1(jsonb)'::regprocedure);
 if strpos(definition, 'p->>''removalMode''=''all-debuffs''') = 0 then
  updated := replace(definition, 'when ''remove-status'' then',
   'when ''remove-status'' then
  if p->>''removalMode''=''all-debuffs'' then return ''cleanse''; end if;');
  if updated = definition then raise exception 'Expected removal classifier missing'; end if;
  definition := updated;
 end if;
 if strpos(definition, 'p->>''selectionKind''=''buffs''') = 0 then
  updated := replace(definition, 'if p->>''removalMode''=''specified'' then',
   'if p->>''removalMode''=''specified'' then
   if p->>''selectionKind''=''buffs'' then return ''dispel''; end if;
   if p->>''selectionKind''=''debuffs'' then return ''conditional-cleanse''; end if;');
  if updated = definition then raise exception 'Expected specified removal classifier missing'; end if;
  definition := updated;
 end if;
 if app_private.content_effect_presentation_id_v1('{"type":"remove-status","statusIds":["counter"],"removalMode":"specified"}'::jsonb) <> 'dispel' then
  updated := replace(definition, 'positive||array[', 'positive||array[''counter'',');
  if updated = definition then raise exception 'Expected positive status vocabulary missing'; end if;
  definition := updated;
 end if;
 execute definition;
end;
$migration$;

revoke all on function app_private.content_presentation_tag_ids_v1(), app_private.content_effect_presentation_id_v1(jsonb) from public, anon, authenticated, service_role;

commit;
