begin;

create or replace function app_private.preserve_character_active_build_schema_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if old.schema_version > new.schema_version then
    new.schema_version := old.schema_version;
  end if;

  return new;
end;
$$;

revoke all on function app_private.preserve_character_active_build_schema_v1()
  from public, anon, authenticated;

create trigger character_active_builds_preserve_schema
  before update of schema_version
  on app_private.character_active_builds
  for each row
  execute function app_private.preserve_character_active_build_schema_v1();

comment on function app_private.preserve_character_active_build_schema_v1() is
  'Prevents a committed character build from being downgraded when an older authoritative mutation path writes an earlier schema version. P3.2-only builds remain schema v2 until P3.4 Skill state upgrades them.';

commit;
