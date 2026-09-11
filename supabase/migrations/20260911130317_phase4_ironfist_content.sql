begin;

-- Additive content only: existing selections, battle snapshots, mastery and attunement stay intact.
insert into app_private.essence_definitions
  (essence_id, content_version, source_discipline_id, skill_id, skill_content_version, name, description, enabled)
values ('essence.ironfist.hundredfold-rush', 1, 'ironfist', 'essence.ironfist.hundredfold-rush', 1,
  'Hundredfold Rush', 'Commit to three close-range strikes. Each hit resolves against defenses; distance and heavy armor blunt the rush.', true)
on conflict (essence_id, content_version) do nothing;

insert into app_private.resonance_definitions
  (resonance_id, content_version, discipline_a_id, discipline_b_id, name, description, enabled)
values
  ('resonance.aetherist-ironfist.conductive-impact', 1, 'aetherist', 'ironfist', 'Conductive Impact', 'Ironfist exposure into an Aetherist mystic attack for 5 additional damage.', true),
  ('resonance.farstrider-ironfist.marked-approach', 1, 'farstrider', 'ironfist', 'Marked Approach', 'Farstrider mark into an Ironfist melee attack for 5 additional damage.', true),
  ('resonance.ironfist-lifebinder.renewed-force', 1, 'ironfist', 'lifebinder', 'Renewed Force', 'Lifebinder healing into an Ironfist melee attack for 5 additional damage.', true),
  ('resonance.ironfist-shadehand.broken-rhythm', 1, 'ironfist', 'shadehand', 'Broken Rhythm', 'Ironfist exposure into a Shadehand melee attack for 5 additional damage.', true),
  ('resonance.ironfist-vanguard.tempered-response', 1, 'ironfist', 'vanguard', 'Tempered Response', 'Ironfist defense into a Vanguard melee attack for 4 additional damage.', true)
on conflict (resonance_id, content_version) do nothing;

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
      ('vanguard', 'vanguard.cleave', 1),
      ('vanguard', 'vanguard.guard-break', 1),
      ('vanguard', 'vanguard.brace', 1),
      ('vanguard', 'vanguard.rally', 1),
      ('vanguard', 'vanguard.shield-bash', 1),
      ('vanguard', 'vanguard.second-wind', 1),
      ('vanguard', 'vanguard.sweeping-strike', 1),
      ('lifebinder', 'lifebinder.mending-light', 1),
      ('lifebinder', 'lifebinder.mend', 1),
      ('lifebinder', 'lifebinder.barrier', 1),
      ('lifebinder', 'lifebinder.renew', 1),
      ('lifebinder', 'lifebinder.sanctuary', 1),
      ('lifebinder', 'lifebinder.fortifying-light', 1),
      ('lifebinder', 'lifebinder.vital-sever', 1),
      ('lifebinder', 'lifebinder.searing-bloom', 1),
      ('aetherist', 'aetherist.arc-bolt', 1),
      ('aetherist', 'aetherist.mana-burst', 1),
      ('aetherist', 'aetherist.ward-pierce', 1),
      ('aetherist', 'aetherist.arcane-field', 1),
      ('aetherist', 'aetherist.channel', 1),
      ('aetherist', 'aetherist.mana-shield', 1),
      ('aetherist', 'aetherist.chain-spark', 1),
      ('aetherist', 'aetherist.overchannel', 1),
      ('farstrider', 'farstrider.aimed-shot', 1),
      ('farstrider', 'farstrider.pinning-shot', 1),
      ('farstrider', 'farstrider.volley', 1),
      ('farstrider', 'farstrider.scouts-mark', 1),
      ('farstrider', 'farstrider.longshot', 1),
      ('farstrider', 'farstrider.piercing-barrage', 1),
      ('farstrider', 'farstrider.fieldcraft', 1),
      ('farstrider', 'farstrider.keen-focus', 1),
      ('shadehand', 'shadehand.backstab', 1),
      ('shadehand', 'shadehand.feint', 1),
      ('shadehand', 'shadehand.smoke-vial', 1),
      ('shadehand', 'shadehand.crippling-cut', 1),
      ('shadehand', 'shadehand.exploit-opening', 1),
      ('shadehand', 'shadehand.fan-of-knives', 1),
      ('shadehand', 'shadehand.quick-hands', 1),
      ('shadehand', 'shadehand.execution-cut', 1),
      ('ironfist', 'ironfist.rising-fist', 1),
      ('ironfist', 'ironfist.sweep', 1),
      ('ironfist', 'ironfist.focus-breath', 1),
      ('ironfist', 'ironfist.counter-palm', 1),
      ('ironfist', 'ironfist.breakfall', 1),
      ('ironfist', 'ironfist.hammer-knuckle', 1),
      ('ironfist', 'ironfist.pressure-palm', 1),
      ('ironfist', 'ironfist.last-stand', 1)
  ) as catalog(source_discipline_id, skill_id, skill_content_version)
  where catalog.source_discipline_id = new.primary_discipline_id
     or catalog.source_discipline_id = new.secondary_discipline_id
  on conflict (character_id, skill_id) do nothing;

  return new;
end;
$$;

comment on function app_private.provision_active_discipline_skills_v1() is
  'Server-owned provisioning for authored Foundation Discipline Techniques. All six Foundation Disciplines receive their full eight-Technique catalog; learned facts remain durable.';

revoke all on function app_private.provision_active_discipline_skills_v1() from public, anon, authenticated;

with catalog(source_discipline_id, skill_id, skill_content_version) as (
  values
      ('ironfist', 'ironfist.rising-fist', 1),
      ('ironfist', 'ironfist.sweep', 1),
      ('ironfist', 'ironfist.focus-breath', 1),
      ('ironfist', 'ironfist.counter-palm', 1),
      ('ironfist', 'ironfist.breakfall', 1),
      ('ironfist', 'ironfist.hammer-knuckle', 1),
      ('ironfist', 'ironfist.pressure-palm', 1),
      ('ironfist', 'ironfist.last-stand', 1)
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
  'phase4-ironfist-content:v1-backfill'
from app_private.character_active_builds build
join catalog
  on catalog.source_discipline_id = build.primary_discipline_id
  or catalog.source_discipline_id = build.secondary_discipline_id
on conflict (character_id, skill_id) do nothing;

commit;
