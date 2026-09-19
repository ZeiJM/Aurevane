#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P4-Rebalance-Publication-2026!'
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

email="p4-rebalance-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
signup="$(signup_test_user "$email" "$password")"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
test -n "$user_id"
test "$user_id" != 'null'
confirm_test_user "$user_id"

for caller in anon authenticated; do
  if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c     "set role $caller; select public.activate_phase4_discipline_rebalance_v1();"     >/tmp/p4-rebalance-denial.log 2>&1; then
    echo 'Browser rebalance publication unexpectedly succeeded.' >&2
    exit 1
  fi
  grep -Fq 'permission denied for function activate_phase4_discipline_rebalance_v1'     /tmp/p4-rebalance-denial.log
done

docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -v user_id="$user_id" -U postgres -d postgres <<'SQL'
begin;
select set_config('p4.rebalance_user', :'user_id', true);

do $$
declare
  u uuid := current_setting('p4.rebalance_user')::uuid;
  c uuid;
  future_character uuid;
  b uuid := gen_random_uuid();
  v_before bigint;
  v_after bigint;
  prerequisite_message text;
  receipt jsonb;
  repeated jsonb;
  frozen jsonb;
  saved jsonb;
  snapshot jsonb;
  audit_count integer;
  old_skills jsonb :=
    '[{"skillId":"shadehand.smoke-vial","contentVersion":1,"sourceDisciplineId":"shadehand"},{"skillId":"shadehand.backstab","contentVersion":1,"sourceDisciplineId":"shadehand"}]';
begin
  assert (
    select activated_at is null
    from app_private.phase4_discipline_rebalance_publication
  ), 'Rebalance migration must only prepare';
  assert (
    select count(*) = 0
    from app_private.phase4_discipline_rebalance_skill_versions
  ), 'Rebalance manifest is captured only at activation';
  assert (
    select count(*) = 17
      and count(distinct source_discipline_id) = 17
    from app_private.essence_definitions
    where content_version = 2
      and skill_content_version = 2
      and enabled = false
  ), 'Seventeen audited Essence v2 versions are staged disabled';
  assert (
    app_private.resolve_essence_reference_v1('chronist', null) ->> 'contentVersion'
  ) = '1', 'Staged Chronist Essence does not become current early';

  begin
    set local role service_role;
    perform public.activate_phase4_discipline_rebalance_v1();
    raise exception 'Rebalance activation must require the prior Phase-4 release';
  exception
    when sqlstate '22023' then
      get stacked diagnostics prerequisite_message = message_text;
      assert prerequisite_message = 'PHASE4_DISCIPLINE_REBALANCE_PREREQUISITE_NOT_ACTIVATED',
        'Specific prior-release prerequisite error';
  end;
  reset role;

  assert (
    select activated_at is null
    from app_private.phase4_discipline_rebalance_publication
  ), 'Prerequisite refusal leaves release untouched';
  assert (
    select count(*) = 0
    from app_private.phase4_discipline_rebalance_skill_versions
  ), 'Prerequisite refusal leaves manifest empty';

  select id into c
  from public.create_character_v3(
    u,
    0::smallint,
    gen_random_uuid(),
    'p4:rebalance:character',
    1,
    'P4 Rebalance',
    'p4rebalance',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'shadehand',
    3, 12, 3, 8, 6, 4
  );

  assert (
    select skill_content_version = 1
    from app_private.character_skill_unlocks
    where character_id = c and skill_id = 'shadehand.smoke-vial'
  ), 'Pre-publication Smoke Vial begins at v1';

  select build_version into v_before
  from app_private.character_active_builds
  where character_id = c;

  perform public.save_character_discipline_skill_loadout_v1(
    u,
    c,
    v_before,
    old_skills,
    gen_random_uuid(),
    'p4:rebalance:old-selection'
  );

  select build_version into v_before
  from app_private.character_active_builds
  where character_id = c;

  perform public.save_character_build_loadout_v1(
    u,
    c,
    1::smallint,
    'Historical Shadehand',
    v_before,
    gen_random_uuid(),
    'p4:rebalance:saved'
  );

  select to_jsonb(loadout) into saved
  from app_private.character_saved_build_loadouts loadout
  where character_id = c and slot_index = 1;

  snapshot := public.get_character_committed_build_snapshot_v2(u, c);
  frozen := jsonb_build_object(
    'tactical',
    jsonb_build_object(
      'battle',
      jsonb_build_object(
        'battleId', 'test:p4-rebalance:' || b,
        'rulesVersion', 1,
        'contentVersion', 1,
        'lifecycle', 'active',
        'rng', jsonb_build_object('seed', 42, 'cursor', 0),
        'combatants', jsonb_build_array(
          jsonb_build_object('id', 'character:' || c, 'teamId', 'players', 'hp', 100),
          jsonb_build_object('id', 'recruit:rebalance', 'teamId', 'opponents', 'hp', 100)
        )
      )
    ),
    'committedBuild',
    snapshot
  );

  insert into app_private.battle_sessions(
    id,
    owner_user_id,
    battle_id,
    rules_version,
    content_version,
    current_version,
    lifecycle,
    current_snapshot
  ) values (
    b,
    u,
    'test:p4-rebalance:' || b,
    1,
    1,
    1,
    'active',
    frozen
  );

  insert into app_private.battle_snapshots(
    battle_session_id,
    battle_version,
    snapshot
  ) values (b, 1, frozen);

  set local role service_role;
  perform public.activate_phase4_combat_interactions_v2();
  reset role;

  assert (
    select count(*) = 136
      and count(*) filter (where content_version = 1) = 115
      and count(*) filter (where content_version = 2) = 21
    from app_private.phase4_skill_catalog
  ), 'Prior release establishes exact Task 10 catalog base';

  assert (
    select skill_content_version = 2
    from app_private.character_build_discipline_skills
    where character_id = c and skill_id = 'shadehand.smoke-vial'
  ), 'Prior release upgrades Smoke Vial to v2';
  assert (
    select skill_content_version = 1
    from app_private.character_build_discipline_skills
    where character_id = c and skill_id = 'shadehand.backstab'
  ), 'Prior release leaves Backstab v1';

  select build_version into v_before
  from app_private.character_active_builds
  where character_id = c;

  set local role service_role;
  receipt := public.activate_phase4_discipline_rebalance_v1();
  repeated := public.activate_phase4_discipline_rebalance_v1();
  reset role;

  assert receipt ->> 'replayed' = 'false'
    and repeated ->> 'replayed' = 'true',
    'Rebalance activation is idempotent';
  assert (receipt - 'replayed') = (repeated - 'replayed'),
    'Rebalance replay preserves original receipt';
  assert receipt ->> 'updatedCatalogSkills' = '136'
    and receipt ->> 'enabledEssences' = '17',
    'Receipt records exact rebalance release size';

  assert (
    select count(*) = 136
    from app_private.phase4_discipline_rebalance_skill_versions
  ), 'Exact 136-Skill rebalance manifest';
  assert (
    select previous_version = 2 and content_version = 3
    from app_private.phase4_discipline_rebalance_skill_versions
    where skill_id = 'shadehand.smoke-vial'
  ), 'Previously published Skill advances v2 to v3';
  assert (
    select previous_version = 1 and content_version = 2
    from app_private.phase4_discipline_rebalance_skill_versions
    where skill_id = 'shadehand.backstab'
  ), 'Previously unchanged Skill advances v1 to v2';
  assert (
    select previous_version = 2 and content_version = 3
    from app_private.phase4_discipline_rebalance_skill_versions
    where skill_id = 'vanguard.forceful-strike'
  ), 'Existing Foundation v2 advances to v3';

  assert (
    select count(*) = 136
      and count(*) filter (where content_version = 2) = 115
      and count(*) filter (where content_version = 3) = 21
    from app_private.phase4_skill_catalog
  ), 'Current catalog advances exactly one immutable version per Skill';

  assert (
    select skill_content_version = 3
    from app_private.character_skill_unlocks
    where character_id = c and skill_id = 'shadehand.smoke-vial'
  ), 'Learned Smoke Vial advances to v3';
  assert (
    select skill_content_version = 2
    from app_private.character_skill_unlocks
    where character_id = c and skill_id = 'shadehand.backstab'
  ), 'Learned Backstab advances to v2';
  assert (
    select skill_content_version = 3
    from app_private.character_build_discipline_skills
    where character_id = c and skill_id = 'shadehand.smoke-vial'
  ), 'Selected Smoke Vial advances to v3';
  assert (
    select skill_content_version = 2
    from app_private.character_build_discipline_skills
    where character_id = c and skill_id = 'shadehand.backstab'
  ), 'Selected Backstab advances to v2';

  select build_version into v_after
  from app_private.character_active_builds
  where character_id = c;

  assert v_after = v_before + 1,
    'Task 10 publication advances affected build exactly once';

  select count(*) into audit_count
  from app_private.character_skill_loadout_change_audit
  where character_id = c
    and request_fingerprint = 'publication:phase4-discipline-rebalance-v1'
    and build_version_before = v_before
    and build_version_after = v_after
    and before_skills #>> '{0,contentVersion}' = '2'
    and after_skills #>> '{0,contentVersion}' = '3'
    and before_skills #>> '{1,contentVersion}' = '1'
    and after_skills #>> '{1,contentVersion}' = '2';

  assert audit_count = 1, 'Exactly one complete Task 10 loadout audit';

  assert (
    select count(*) = 17
      and count(distinct source_discipline_id) = 17
    from app_private.essence_definitions
    where content_version = 2
      and skill_content_version = 2
      and enabled
  ), 'Seventeen audited Essence v2 rows become enabled atomically';

  assert (
    app_private.resolve_essence_reference_v1('chronist', null) ->> 'contentVersion'
  ) = '2', 'Chronist current Essence advances to v2';
  assert (
    app_private.resolve_essence_reference_v1('tidecaller', null) ->> 'contentVersion'
  ) = '2', 'Tidecaller current Essence advances to v2';

  assert (
    select current_snapshot = frozen
    from app_private.battle_sessions
    where id = b
  ), 'Active frozen battle remains byte-for-byte unchanged';
  assert (
    select historical.snapshot = frozen
    from app_private.battle_snapshots historical
    where battle_session_id = b and battle_version = 1
  ), 'Historical battle snapshot remains byte-for-byte unchanged';
  assert (
    select to_jsonb(loadout) = saved
    from app_private.character_saved_build_loadouts loadout
    where character_id = c and slot_index = 1
  ), 'Saved loadout source JSON remains immutable';

  snapshot := public.get_character_committed_build_snapshot_v2(u, c);
  assert snapshot #>> '{disciplineSkills,0,contentVersion}' = '3'
    and snapshot #>> '{disciplineSkills,1,contentVersion}' = '2',
    'Future committed build uses Task 10 versions';

  perform public.save_character_discipline_skill_loadout_v1(
    u,
    c,
    v_after,
    '[]'::jsonb,
    gen_random_uuid(),
    'p4:rebalance:clear'
  );

  select build_version into v_after
  from app_private.character_active_builds
  where character_id = c;

  perform public.activate_character_build_loadout_v1(
    u,
    c,
    1::smallint,
    v_after,
    gen_random_uuid(),
    'p4:rebalance:restore'
  );

  assert (
    select skill_content_version = 3
    from app_private.character_build_discipline_skills
    where character_id = c and skill_id = 'shadehand.smoke-vial'
  ), 'Historical saved Smoke Vial resolves directly to current v3';
  assert (
    select skill_content_version = 2
    from app_private.character_build_discipline_skills
    where character_id = c and skill_id = 'shadehand.backstab'
  ), 'Historical saved Backstab resolves directly to current v2';
  assert (
    select to_jsonb(loadout) = saved
    from app_private.character_saved_build_loadouts loadout
    where character_id = c and slot_index = 1
  ), 'Saved loadout source remains immutable after restoration';

  select id into future_character
  from public.create_character_v3(
    u,
    1::smallint,
    gen_random_uuid(),
    'p4:rebalance:future',
    1,
    'P4 Rebalance Future',
    'p4rebalancefuture',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'ironfist',
    13, 4, 5, 8, 2, 4
  );

  assert (
    select skill_content_version = 3
    from app_private.character_skill_unlocks
    where character_id = future_character and skill_id = 'ironfist.breakfall'
  ), 'Future provisioning uses rebalance v3 for earlier-published Skill';
  assert (
    select skill_content_version = 2
    from app_private.character_skill_unlocks
    where character_id = future_character and skill_id = 'ironfist.rising-fist'
  ), 'Future provisioning uses rebalance v2 for previously-v1 Skill';
end;
$$;

rollback;
SQL

echo 'Phase 4 Discipline rebalance staging, prerequisite, activation, history, loadout normalization, Essences and future provisioning PASS.'
