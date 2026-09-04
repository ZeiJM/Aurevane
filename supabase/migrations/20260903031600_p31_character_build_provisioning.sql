begin;

create or replace function app_private.provision_character_active_build_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_definition app_private.discipline_definitions%rowtype;
begin
  select * into v_definition
  from app_private.discipline_definitions definition
  where definition.discipline_id = new.foundation_discipline_id
    and definition.enabled_for_primary
  order by definition.definition_version desc
  limit 1;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'FOUNDATION_PRIMARY_DISCIPLINE_UNAVAILABLE';
  end if;

  insert into app_private.character_active_builds (
    character_id,
    user_id,
    primary_discipline_id,
    primary_definition_version,
    primary_profile_version
  ) values (
    new.id,
    new.user_id,
    v_definition.discipline_id,
    v_definition.definition_version,
    v_definition.primary_profile_version
  );

  return new;
end;
$$;

revoke all on function app_private.provision_character_active_build_v1() from public, anon, authenticated;

create trigger character_active_build_provision_v1
  after insert on public.characters
  for each row execute function app_private.provision_character_active_build_v1();

commit;
