begin;

create table app_private.essence_definitions (
  essence_id text not null,
  content_version integer not null,
  source_discipline_id text not null,
  skill_id text not null,
  skill_content_version integer not null,
  name text not null,
  description text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  primary key (essence_id, content_version),
  unique (source_discipline_id, content_version),
  constraint essence_definitions_id_format check (
    essence_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint essence_definitions_source_format check (
    source_discipline_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint essence_definitions_skill_id_format check (
    skill_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint essence_definitions_version_positive check (content_version > 0),
  constraint essence_definitions_skill_version_positive check (skill_content_version > 0),
  constraint essence_definitions_name_length check (char_length(name) between 1 and 80),
  constraint essence_definitions_description_length check (
    char_length(description) between 1 and 480
  )
);

comment on table app_private.essence_definitions is
  'Server-only versioned pure-build Essence identities. Eligibility is derived from Primary Discipline and the absence of Secondary; Essence is never independently character-selected.';

revoke all on table app_private.essence_definitions from public, anon, authenticated;
grant select on table app_private.essence_definitions to service_role;

insert into app_private.essence_definitions (
  essence_id,
  content_version,
  source_discipline_id,
  skill_id,
  skill_content_version,
  name,
  description,
  enabled
) values (
  'essence.vanguard.unbroken-strike',
  1,
  'vanguard',
  'essence.vanguard.unbroken-strike',
  1,
  'Unbroken Strike',
  'A pure Vanguard Essence Skill: commit heavily to a single adjacent enemy for a stronger decisive strike.',
  true
);

create or replace function app_private.resolve_essence_reference_v1(
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
    when p_secondary_discipline_id is not null then null
    else (
      select jsonb_build_object(
        'essenceId', definition.essence_id,
        'contentVersion', definition.content_version,
        'sourceDisciplineId', definition.source_discipline_id,
        'skillId', definition.skill_id,
        'skillContentVersion', definition.skill_content_version
      )
      from app_private.essence_definitions definition
      where definition.enabled
        and definition.source_discipline_id = p_primary_discipline_id
      order by definition.content_version desc
      limit 1
    )
  end;
$$;

revoke all on function app_private.resolve_essence_reference_v1(text, text)
  from public, anon, authenticated;
grant execute on function app_private.resolve_essence_reference_v1(text, text)
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
      'essence', app_private.resolve_essence_reference_v1(
        build.primary_discipline_id,
        build.secondary_discipline_id
      ),
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
