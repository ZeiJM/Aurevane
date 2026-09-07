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

create or replace function app_private.provision_active_discipline_skills_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
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
    new.character_id,
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
  where catalog.source_discipline_id = new.primary_discipline_id
     or catalog.source_discipline_id = new.secondary_discipline_id
  on conflict (character_id, skill_id) do nothing;

  return new;
end;
$$;

comment on function app_private.provision_active_discipline_skills_v1() is
  'Server-owned provisioning for authored Discipline Techniques. Newly active Vanguard/Lifebinder Disciplines receive their full eight-Technique catalog; learned facts remain durable while picker visibility stays active-source-only.';

revoke all on function app_private.provision_active_discipline_skills_v1() from public, anon, authenticated;

drop trigger if exists character_active_discipline_skill_provision_v1
  on app_private.character_active_builds;

create trigger character_active_discipline_skill_provision_v1
  after insert or update of primary_discipline_id, secondary_discipline_id
  on app_private.character_active_builds
  for each row execute function app_private.provision_active_discipline_skills_v1();

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
