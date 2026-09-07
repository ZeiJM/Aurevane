begin;

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
  'essence.lifebinder.verdant-rupture',
  1,
  'lifebinder',
  'essence.lifebinder.verdant-rupture',
  1,
  'Verdant Rupture',
  'A pure Lifebinder Essence Skill: condense restorative force into a violent bloom that tears through a distant enemy.',
  true
)
on conflict (essence_id, content_version) do update
set
  source_discipline_id = excluded.source_discipline_id,
  skill_id = excluded.skill_id,
  skill_content_version = excluded.skill_content_version,
  name = excluded.name,
  description = excluded.description,
  enabled = excluded.enabled;

create or replace function public.ensure_character_active_discipline_skills_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_primary_discipline_id text;
  v_secondary_discipline_id text;
  v_rows_inserted integer := 0;
begin
  select
    build.primary_discipline_id,
    build.secondary_discipline_id
  into
    v_primary_discipline_id,
    v_secondary_discipline_id
  from app_private.character_active_builds build
  where build.user_id = p_user_id
    and build.character_id = p_character_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_NOT_FOUND';
  end if;

  insert into app_private.character_skill_unlocks (
    character_id,
    skill_id,
    skill_content_version,
    source_discipline_id,
    learned_at,
    source_kind,
    source_id
  )
  select
    p_character_id,
    catalog.skill_id,
    catalog.skill_content_version,
    catalog.source_discipline_id,
    statement_timestamp(),
    'system',
    'active-discipline-provisioning:v1'
  from (
    values
      ('vanguard'::text, 'vanguard.forceful-strike'::text, 2::integer),
      ('vanguard'::text, 'vanguard.cleave'::text, 1::integer),
      ('vanguard'::text, 'vanguard.guard-break'::text, 1::integer),
      ('vanguard'::text, 'vanguard.brace'::text, 1::integer),
      ('vanguard'::text, 'vanguard.rally'::text, 1::integer),
      ('vanguard'::text, 'vanguard.shield-bash'::text, 1::integer),
      ('vanguard'::text, 'vanguard.second-wind'::text, 1::integer),
      ('vanguard'::text, 'vanguard.sweeping-strike'::text, 1::integer),
      ('lifebinder'::text, 'lifebinder.mending-light'::text, 1::integer),
      ('lifebinder'::text, 'lifebinder.mend'::text, 1::integer),
      ('lifebinder'::text, 'lifebinder.barrier'::text, 1::integer),
      ('lifebinder'::text, 'lifebinder.renew'::text, 1::integer),
      ('lifebinder'::text, 'lifebinder.sanctuary'::text, 1::integer),
      ('lifebinder'::text, 'lifebinder.fortifying-light'::text, 1::integer),
      ('lifebinder'::text, 'lifebinder.vital-sever'::text, 1::integer),
      ('lifebinder'::text, 'lifebinder.searing-bloom'::text, 1::integer)
  ) as catalog(source_discipline_id, skill_id, skill_content_version)
  where catalog.source_discipline_id = v_primary_discipline_id
     or catalog.source_discipline_id = v_secondary_discipline_id
  on conflict (character_id, skill_id) do nothing;

  get diagnostics v_rows_inserted = row_count;
  return v_rows_inserted;
end;
$$;

comment on function public.ensure_character_active_discipline_skills_v1(uuid, uuid) is
  'Server-only idempotent provisioning for authored active-Discipline Techniques. Vanguard and Lifebinder each receive their full eight-Technique catalog when that Discipline is active.';

revoke all on function public.ensure_character_active_discipline_skills_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_character_active_discipline_skills_v1(uuid, uuid)
  to service_role;

with catalog(source_discipline_id, skill_id, skill_content_version) as (
  values
    ('vanguard'::text, 'vanguard.forceful-strike'::text, 2::integer),
    ('vanguard'::text, 'vanguard.cleave'::text, 1::integer),
    ('vanguard'::text, 'vanguard.guard-break'::text, 1::integer),
    ('vanguard'::text, 'vanguard.brace'::text, 1::integer),
    ('vanguard'::text, 'vanguard.rally'::text, 1::integer),
    ('vanguard'::text, 'vanguard.shield-bash'::text, 1::integer),
    ('vanguard'::text, 'vanguard.second-wind'::text, 1::integer),
    ('vanguard'::text, 'vanguard.sweeping-strike'::text, 1::integer),
    ('lifebinder'::text, 'lifebinder.mending-light'::text, 1::integer),
    ('lifebinder'::text, 'lifebinder.mend'::text, 1::integer),
    ('lifebinder'::text, 'lifebinder.barrier'::text, 1::integer),
    ('lifebinder'::text, 'lifebinder.renew'::text, 1::integer),
    ('lifebinder'::text, 'lifebinder.sanctuary'::text, 1::integer),
    ('lifebinder'::text, 'lifebinder.fortifying-light'::text, 1::integer),
    ('lifebinder'::text, 'lifebinder.vital-sever'::text, 1::integer),
    ('lifebinder'::text, 'lifebinder.searing-bloom'::text, 1::integer)
)
insert into app_private.character_skill_unlocks (
  character_id,
  skill_id,
  skill_content_version,
  source_discipline_id,
  learned_at,
  source_kind,
  source_id
)
select
  build.character_id,
  catalog.skill_id,
  catalog.skill_content_version,
  catalog.source_discipline_id,
  statement_timestamp(),
  'migration',
  'active-discipline-provisioning:v1-backfill'
from app_private.character_active_builds build
join catalog
  on catalog.source_discipline_id = build.primary_discipline_id
  or catalog.source_discipline_id = build.secondary_discipline_id
on conflict (character_id, skill_id) do nothing;

commit;
