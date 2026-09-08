begin;

create or replace function app_private.grant_pv2_tester_secondary_access_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if not exists (
    select 1
    from app_private.pv2_buildcraft_testers tester
    where tester.user_id = p_user_id
      and tester.enabled
  ) then
    return;
  end if;

  insert into app_private.character_discipline_masteries (
    character_id,
    discipline_id,
    mastered_definition_version,
    source_kind,
    source_id
  )
  select
    p_character_id,
    latest.discipline_id,
    latest.definition_version,
    'owner',
    'pv2-test-all-secondaries'
  from (
    select distinct on (definition.discipline_id)
      definition.discipline_id,
      definition.definition_version,
      definition.enabled_for_secondary
    from app_private.discipline_definitions definition
    order by definition.discipline_id, definition.definition_version desc
  ) latest
  where latest.enabled_for_secondary
  on conflict (character_id, discipline_id) do nothing;
end;
$$;

comment on function app_private.grant_pv2_tester_secondary_access_v1(uuid, uuid) is
  'Grants enabled PV-2 buildcraft testers temporary owner testing access to every currently Secondary-enabled Discipline. These rows are access fixtures only and must not be interpreted as future Discipline Level 8 progression.';

revoke all on function app_private.grant_pv2_tester_secondary_access_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function app_private.grant_pv2_tester_secondary_access_v1(uuid, uuid)
  to service_role;

create or replace function app_private.grant_pv2_tester_secondary_access_on_character_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.grant_pv2_tester_secondary_access_v1(new.user_id, new.id);
  return new;
end;
$$;

revoke all on function app_private.grant_pv2_tester_secondary_access_on_character_v1()
  from public, anon, authenticated;

drop trigger if exists characters_grant_pv2_tester_secondary_access_v1 on public.characters;
create trigger characters_grant_pv2_tester_secondary_access_v1
after insert on public.characters
for each row
execute function app_private.grant_pv2_tester_secondary_access_on_character_v1();

create or replace function app_private.grant_pv2_tester_secondary_access_on_tester_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_character record;
begin
  if new.enabled then
    for v_character in
      select character.id
      from public.characters character
      where character.user_id = new.user_id
    loop
      perform app_private.grant_pv2_tester_secondary_access_v1(new.user_id, v_character.id);
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function app_private.grant_pv2_tester_secondary_access_on_tester_v1()
  from public, anon, authenticated;

drop trigger if exists pv2_buildcraft_testers_grant_secondary_access_v1
  on app_private.pv2_buildcraft_testers;
create trigger pv2_buildcraft_testers_grant_secondary_access_v1
after insert or update of enabled on app_private.pv2_buildcraft_testers
for each row
when (new.enabled)
execute function app_private.grant_pv2_tester_secondary_access_on_tester_v1();

select app_private.grant_pv2_tester_secondary_access_v1(character.user_id, character.id)
from public.characters character
join app_private.pv2_buildcraft_testers tester
  on tester.user_id = character.user_id
 and tester.enabled;

commit;
