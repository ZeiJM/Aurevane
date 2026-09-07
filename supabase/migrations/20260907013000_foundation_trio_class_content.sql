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
) values
  (
    'essence.aetherist.aether-nova',
    1,
    'aetherist',
    'essence.aetherist.aether-nova',
    1,
    'Aether Nova',
    'A pure Aetherist Essence Skill: collapse a dense knot of aether into a wide destructive nova.',
    true
  ),
  (
    'essence.farstrider.deadeye-barrage',
    1,
    'farstrider',
    'essence.farstrider.deadeye-barrage',
    1,
    'Deadeye Barrage',
    'A pure Farstrider Essence Skill: thread a lethal barrage through a distant firing lane.',
    true
  ),
  (
    'essence.shadehand.perfect-opening',
    1,
    'shadehand',
    'essence.shadehand.perfect-opening',
    1,
    'Perfect Opening',
    'A pure Shadehand Essence Skill: convert angle and timing into a single devastating opening.',
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

insert into app_private.resonance_definitions (
  resonance_id,
  content_version,
  discipline_a_id,
  discipline_b_id,
  name,
  description,
  enabled
) values
  (
    'resonance.aetherist-farstrider.arcane-hunt', 1, 'aetherist', 'farstrider',
    'Arcane Hunt',
    'Farstrider mark setup into an Aetherist mystic attack for bounded bonus damage.',
    true
  ),
  (
    'resonance.aetherist-lifebinder.vital-circuit', 1, 'aetherist', 'lifebinder',
    'Vital Circuit',
    'Lifebinder healing setup into an Aetherist mystic attack for bounded bonus damage.',
    true
  ),
  (
    'resonance.aetherist-shadehand.veiled-conduit', 1, 'aetherist', 'shadehand',
    'Veiled Conduit',
    'Aetherist exposure setup into a Shadehand melee attack for bounded bonus damage.',
    true
  ),
  (
    'resonance.aetherist-vanguard.spellsteel-rhythm', 1, 'aetherist', 'vanguard',
    'Spellsteel Rhythm',
    'Vanguard melee setup into an Aetherist mystic attack for bounded bonus damage.',
    true
  ),
  (
    'resonance.farstrider-lifebinder.guided-renewal', 1, 'farstrider', 'lifebinder',
    'Guided Renewal',
    'Lifebinder healing setup into a Farstrider ranged attack for bounded bonus damage.',
    true
  ),
  (
    'resonance.farstrider-shadehand.marked-opening', 1, 'farstrider', 'shadehand',
    'Marked Opening',
    'Farstrider mark setup into a Shadehand melee attack for bounded bonus damage.',
    true
  ),
  (
    'resonance.farstrider-vanguard.covering-break', 1, 'farstrider', 'vanguard',
    'Covering Break',
    'Farstrider ranged setup into a Vanguard melee attack for bounded bonus damage.',
    true
  ),
  (
    'resonance.lifebinder-shadehand.mercy-in-shadow', 1, 'lifebinder', 'shadehand',
    'Mercy in Shadow',
    'Lifebinder healing setup into a Shadehand melee attack for bounded bonus damage.',
    true
  ),
  (
    'resonance.shadehand-vanguard.broken-line', 1, 'shadehand', 'vanguard',
    'Broken Line',
    'Shadehand exposure setup into a Vanguard melee attack for bounded bonus damage.',
    true
  )
on conflict (resonance_id, content_version) do update
set
  discipline_a_id = excluded.discipline_a_id,
  discipline_b_id = excluded.discipline_b_id,
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
      ('shadehand', 'shadehand.execution-cut', 1)
  ) as catalog(source_discipline_id, skill_id, skill_content_version)
  where catalog.source_discipline_id = new.primary_discipline_id
     or catalog.source_discipline_id = new.secondary_discipline_id
  on conflict (character_id, skill_id) do nothing;

  return new;
end;
$$;

comment on function app_private.provision_active_discipline_skills_v1() is
  'Server-owned provisioning for authored Foundation Discipline Techniques. Active Aetherist, Farstrider, Lifebinder, Shadehand, and Vanguard Disciplines receive their full eight-Technique catalog; learned facts remain durable.';

revoke all on function app_private.provision_active_discipline_skills_v1() from public, anon, authenticated;

with catalog(source_discipline_id, skill_id, skill_content_version) as (
  values
    ('aetherist'::text, 'aetherist.arc-bolt'::text, 1::integer),
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
    ('shadehand', 'shadehand.execution-cut', 1)
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
  'foundation-trio-class-content:v1-backfill'
from app_private.character_active_builds build
join catalog
  on catalog.source_discipline_id = build.primary_discipline_id
  or catalog.source_discipline_id = build.secondary_discipline_id
on conflict (character_id, skill_id) do nothing;

commit;
