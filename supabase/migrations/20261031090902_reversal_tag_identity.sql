begin;

-- Identity only: preserve all authored drafts, publications and immutable definitions.
insert into app_private.combat_content_records(
  content_key, content_kind, lifecycle, version_floor, builtin_version, builtin_name,
  builtin_source_discipline_id
)
values ('tag.reversal', 'tag', 'active', 1, 1, 'Reversal', null)
on conflict (content_key) do update set
  builtin_version = excluded.builtin_version,
  builtin_name = excluded.builtin_name,
  version_floor = greatest(app_private.combat_content_records.version_floor, excluded.version_floor)
where app_private.combat_content_records.content_kind = 'tag';

-- Capture the current finite identity set so concurrent additive tags survive this migration.
-- The effect identity adapter already falls back to payload.type for dedicated handlers.
do $migration$
declare ids text[];
begin
  ids := app_private.content_presentation_tag_ids_v1();
  if not ('reversal' = any(ids)) then
    execute format(
      'create or replace function app_private.content_presentation_tag_ids_v1() returns text[] language sql immutable set search_path='''' as %L',
      'select ' || quote_literal(array_append(ids, 'reversal')) || '::text[];'
    );
  end if;
end;
$migration$;

revoke all on function app_private.content_presentation_tag_ids_v1() from public, anon, authenticated, service_role;

commit;
