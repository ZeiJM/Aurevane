begin;

create table app_private.resonance_definitions (
  resonance_id text not null,
  content_version integer not null,
  discipline_a_id text not null,
  discipline_b_id text not null,
  name text not null,
  description text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  primary key (resonance_id, content_version),
  unique (discipline_a_id, discipline_b_id, content_version),
  constraint resonance_definitions_id_format check (
    resonance_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint resonance_definitions_version_positive check (content_version > 0),
  constraint resonance_definitions_pair_a_format check (
    discipline_a_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint resonance_definitions_pair_b_format check (
    discipline_b_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint resonance_definitions_pair_canonical check (
    discipline_a_id < discipline_b_id
  ),
  constraint resonance_definitions_name_length check (char_length(name) between 1 and 80),
  constraint resonance_definitions_description_length check (
    char_length(description) between 1 and 480
  )
);

comment on table app_private.resonance_definitions is
  'Server-only versioned Resonance identities keyed by canonical unordered Discipline pairs. Combat trigger behavior is validated against the typed game-core Resonance catalog.';

revoke all on table app_private.resonance_definitions from public, anon, authenticated;
grant select on table app_private.resonance_definitions to service_role;

insert into app_private.resonance_definitions (
  resonance_id,
  content_version,
  discipline_a_id,
  discipline_b_id,
  name,
  description,
  enabled
) values (
  'resonance.lifebinder-vanguard.mercys-edge',
  1,
  'lifebinder',
  'vanguard',
  'Mercy''s Edge',
  'Restore HP with a Lifebinder Discipline Skill to arm the Resonance. If the next Discipline Skill is a Vanguard melee attack, it gains the bounded payoff.',
  true
);

alter table app_private.character_active_builds
  alter column schema_version set default 4;

update app_private.character_active_builds
set schema_version = 4
where schema_version < 4;

create or replace function app_private.enforce_character_active_build_schema_v4()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  new.schema_version := greatest(new.schema_version, 4);
  return new;
end;
$$;

revoke all on function app_private.enforce_character_active_build_schema_v4()
  from public, anon, authenticated;

create trigger character_active_builds_minimum_schema_v4
  before insert or update of schema_version
  on app_private.character_active_builds
  for each row
  execute function app_private.enforce_character_active_build_schema_v4();

create or replace function app_private.resolve_resonance_reference_v1(
  p_primary_discipline_id text,
  p_secondary_discipline_id text
)
returns jsonb
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  select case
    when p_secondary_discipline_id is null
      or p_primary_discipline_id = p_secondary_discipline_id then null
    else (
      select jsonb_build_object(
        'resonanceId', definition.resonance_id,
        'contentVersion', definition.content_version,
        'disciplinePair', jsonb_build_array(
          definition.discipline_a_id,
          definition.discipline_b_id
        )
      )
      from app_private.resonance_definitions definition
      where definition.enabled
        and definition.discipline_a_id = least(
          p_primary_discipline_id,
          p_secondary_discipline_id
        )
        and definition.discipline_b_id = greatest(
          p_primary_discipline_id,
          p_secondary_discipline_id
        )
      order by definition.content_version desc
      limit 1
    )
  end;
$$;

revoke all on function app_private.resolve_resonance_reference_v1(text, text)
  from public, anon, authenticated;
grant execute on function app_private.resolve_resonance_reference_v1(text, text)
  to service_role;

create or replace function public.get_character_committed_build_snapshot_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns jsonb
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  select jsonb_build_object(
    'schemaVersion', build.schema_version,
    'buildVersion', build.build_version,
    'primary', jsonb_build_object(
      'disciplineId', build.primary_discipline_id,
      'definitionVersion', build.primary_definition_version,
      'profileVersion', build.primary_profile_version
    ),
    'secondary', case
      when build.secondary_discipline_id is null then null
      else jsonb_build_object(
        'disciplineId', build.secondary_discipline_id,
        'definitionVersion', build.secondary_definition_version
      )
    end,
    'disciplineSkills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slotIndex', equipped.slot_index,
        'skillId', equipped.skill_id,
        'contentVersion', equipped.skill_content_version,
        'sourceDisciplineId', equipped.source_discipline_id
      ) order by equipped.slot_index)
      from app_private.character_build_discipline_skills equipped
      where equipped.character_id = build.character_id
    ), '[]'::jsonb),
    'extensions', jsonb_build_object(
      'resonance', app_private.resolve_resonance_reference_v1(
        build.primary_discipline_id,
        build.secondary_discipline_id
      ),
      'essence', null,
      'equipmentSkills', '[]'::jsonb,
      'supernatural', null,
      'prestige', null
    )
  )
  from app_private.character_active_builds build
  where build.user_id = p_user_id
    and build.character_id = p_character_id;
$$;

revoke all on function public.get_character_committed_build_snapshot_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_character_committed_build_snapshot_v1(uuid, uuid)
  to service_role;

commit;
