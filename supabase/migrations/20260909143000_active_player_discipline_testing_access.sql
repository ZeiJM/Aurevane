begin;

-- During the current owner-approved testing phase, every player character may equip every
-- currently active Secondary Discipline. These are explicit, auditable support masteries rather
-- than a browser bypass, so normal catalog and change RPC authority remains intact.
insert into app_private.character_discipline_masteries (
  character_id,
  discipline_id,
  mastered_definition_version,
  mastered_at,
  source_kind,
  source_id
)
select
  character.id,
  definition.discipline_id,
  definition.definition_version,
  clock_timestamp(),
  'support',
  'active-player-discipline-testing:v1'
from public.characters character
cross join lateral (
  select distinct on (candidate.discipline_id)
    candidate.discipline_id,
    candidate.definition_version
  from app_private.discipline_definitions candidate
  where candidate.enabled_for_secondary
  order by candidate.discipline_id, candidate.definition_version desc
) definition
on conflict (character_id, discipline_id) do nothing;

create or replace function app_private.grant_active_testing_disciplines_to_character_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  insert into app_private.character_discipline_masteries (
    character_id,
    discipline_id,
    mastered_definition_version,
    mastered_at,
    source_kind,
    source_id
  )
  select
    new.id,
    definition.discipline_id,
    definition.definition_version,
    clock_timestamp(),
    'support',
    'active-player-discipline-testing:v1'
  from (
    select distinct on (candidate.discipline_id)
      candidate.discipline_id,
      candidate.definition_version
    from app_private.discipline_definitions candidate
    where candidate.enabled_for_secondary
    order by candidate.discipline_id, candidate.definition_version desc
  ) definition
  on conflict (character_id, discipline_id) do nothing;

  return new;
end;
$$;

revoke all on function app_private.grant_active_testing_disciplines_to_character_v1() from public, anon, authenticated;

drop trigger if exists grant_active_testing_disciplines_to_character_v1 on public.characters;
create trigger grant_active_testing_disciplines_to_character_v1
after insert on public.characters
for each row execute function app_private.grant_active_testing_disciplines_to_character_v1();

create or replace function app_private.grant_active_testing_discipline_definition_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if not new.enabled_for_secondary then
    return new;
  end if;

  insert into app_private.character_discipline_masteries (
    character_id,
    discipline_id,
    mastered_definition_version,
    mastered_at,
    source_kind,
    source_id
  )
  select
    character.id,
    new.discipline_id,
    new.definition_version,
    clock_timestamp(),
    'support',
    'active-player-discipline-testing:v1'
  from public.characters character
  on conflict (character_id, discipline_id) do nothing;

  return new;
end;
$$;

revoke all on function app_private.grant_active_testing_discipline_definition_v1() from public, anon, authenticated;

drop trigger if exists grant_active_testing_discipline_definition_v1 on app_private.discipline_definitions;
create trigger grant_active_testing_discipline_definition_v1
after insert or update of enabled_for_secondary on app_private.discipline_definitions
for each row
when (new.enabled_for_secondary)
execute function app_private.grant_active_testing_discipline_definition_v1();

comment on function app_private.grant_active_testing_disciplines_to_character_v1() is
  'Testing support: grants a newly created player character auditable mastery access to every currently enabled Secondary Discipline.';
comment on function app_private.grant_active_testing_discipline_definition_v1() is
  'Testing support: grants all existing player characters auditable mastery access when a Discipline becomes Secondary-enabled.';

commit;
