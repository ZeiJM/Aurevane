begin;

with eligible_characters as (
  select build.character_id
  from app_private.character_active_builds build
  where build.primary_discipline_id = 'lifebinder'
     or build.secondary_discipline_id = 'lifebinder'
  union
  select mastery.character_id
  from app_private.character_discipline_masteries mastery
  where mastery.discipline_id = 'lifebinder'
),
skills(skill_id, skill_content_version) as (
  values
    ('lifebinder.vital-sever'::text, 1::integer),
    ('lifebinder.searing-bloom'::text, 1::integer)
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
  eligible.character_id,
  skills.skill_id,
  skills.skill_content_version,
  'lifebinder',
  statement_timestamp(),
  'migration',
  'phase3:lifebinder-offense:v1'
from eligible_characters eligible
cross join skills
on conflict (character_id, skill_id) do nothing;

commit;
