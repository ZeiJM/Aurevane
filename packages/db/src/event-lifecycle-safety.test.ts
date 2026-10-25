import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, beforeEach, afterAll, afterEach, expect, it } from 'vitest'

const sql = (name: string) =>
  readFileSync(resolve(process.cwd(), '../../supabase/migrations', name), 'utf8')
const actor = '11111111-1111-4111-8111-111111111111'
const run = '22222222-2222-4222-8222-222222222222'
const version = '33333333-3333-4333-8333-333333333333'
let db: PGlite
async function database() {
  db = await PGlite.create()
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema app_private;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table public.player_profiles(user_id uuid primary key);
    create table public.characters(id uuid primary key,user_id uuid,name text);
    create table app_private.character_deletion_requests(character_id uuid primary key);
    create table app_private.character_xp_grants(id uuid primary key);
    create table app_private.idempotency_records(actor_key text,command_name text,idempotency_key uuid,request_fingerprint text,result jsonb,primary key(actor_key,command_name,idempotency_key));
    insert into auth.users values('${actor}','owner@example.com',now());
    insert into public.player_profiles values('${actor}');
    insert into public.characters values('${actor}','${actor}','Owner');
    `)
  for (const name of [
    '20260917213000_combat_content_authoring.sql',
    '20260917214500_combat_content_resolver.sql',
    '20260917220000_master_panel_combat_authoring.sql',
  ])
    await db.exec(sql(name))
  await db.exec(
    `insert into app_private.master_panel_operators(user_id,role) values('${actor}','owner')`,
  )
  for (const name of [
    '20260918193000_phase5_staff_authority_foundation.sql',
    '20260918200927_phase5_staff_management_and_capabilities.sql',
    '20260928042812_combat_content_essence_resonance_kinds.sql',
    '20261015095150_typed_combat_authoring_kinds.sql',
    '20261003040911_combat_effect_timing_policy.sql',
    '20261015073458_remove_combat_timing_reason.sql',
    '20261015100834_combat_content_catalogue_snapshot.sql',
    '20261015103321_combat_catalogue_publication_guard.sql',
    '20261015191634_combat_content_version_floor.sql',
  ])
    await db.exec(sql(name))
  for (const name of [
    '20260918233000_phase5_persistent_event_kernel.sql',
    '20260919043000_phase5_event_participation_ledger.sql',
    '20260919050000_phase4_event_reward_execution.sql',
    '20260919050500_phase4_event_reward_budget_hardening.sql',
    '20260919051500_phase4_event_terminal_cleanup.sql',
    '20260919053000_phase4_event_builder_mvp.sql',
    '20260919053500_phase4_event_builder_authority_hardening.sql',
    '20260919053700_phase4_event_authoring_audit.sql',
    '20260919054500_phase4_live_event_operations.sql',
    '20260919055000_phase4_event_recovery_cron.sql',
    '20260919055500_phase4_live_event_operations_audit.sql',
    '20261019003429_selected_character_staff_access.sql',
    '20261025064638_event_workspace_lifecycle_safety.sql',
  ])
    await db.exec(
      sql(name).replace('create extension if not exists pg_cron with schema pg_catalog;', ''),
    )
  await db.exec(`insert into app_private.event_reward_budget_policies values('budget.safety','character-xp',100,'${actor}',now());
    insert into app_private.event_reward_packages(reward_package_ref,package_version,reward_kind,amount,published_by,budget_ref) values('reward.safety',1,'character-xp',25,'${actor}','budget.safety');
    insert into app_private.event_templates values('event.safety','regional-event','${actor}',now());
    insert into app_private.event_definition_versions(id,event_key,definition_version,definition,published_by)
    values('${version}','event.safety',1,'{"phases":[],"rewardPackageRefs":["reward.safety"],"aftermathRefs":[]}','${actor}');
    insert into app_private.event_runs(id,event_key,definition_version_id,run_mode,lifecycle_status,scope_type,scope_key,current_phase_id,started_at,created_by)
    values('${run}','event.safety','${version}','production','live','region','region.safety','first',now(),'${actor}');
    insert into app_private.event_run_phases(run_id,phase_id,ordinal,phase_status,started_at) values('${run}','first',0,'live',now()-interval '60 seconds');
    insert into app_private.event_run_objectives(run_id,phase_id,objective_id,objective_status,target) values('${run}','first','objective','active',10);`)
  return db
}
beforeAll(database, 30000)
beforeEach(async () => {
  await db.exec('begin')
})
afterEach(async () => {
  await db.exec('rollback')
})
afterAll(async () => {
  await db?.close()
})
const transition = (status: string, state: number) =>
  db.query('select * from public.transition_event_run_v1($1,$2,gen_random_uuid(),$3,null)', [
    run,
    state,
    status,
  ])
it('reason-free lifecycle retains internal state CAS and immutable receipts', async () => {
  await expect(transition('paused', 1)).resolves.toMatchObject({
    rows: [{ lifecycle_status: 'paused', state_version: 2 }],
  })
  await db.exec('savepoint expected_rejection')
  await expect(transition('live', 1)).rejects.toThrow('EVENT_RUN_STATE_VERSION_CONFLICT')
  await db.exec('rollback to savepoint expected_rejection')
  expect((await db.query('select reason from app_private.event_run_transitions')).rows).toEqual([
    { reason: null },
  ])
})
it('reference_capability_reject: missing effect executor blocks production but not draft shape', async () => {
  await db.exec('savepoint expected_rejection')
  await expect(
    db.query('select app_private.assert_event_runtime_supported_v1($1)', [
      {
        phases: [
          {
            effects: [{ type: 'encounter-pool', referenceKey: 'pool.missing', enabled: true }],
            cleanupEffects: [],
            objectives: [],
          },
        ],
        rewardPackageRefs: [],
        aftermathRefs: [],
      },
    ]),
  ).rejects.toThrow('EVENT_EFFECT_EXECUTOR_UNAVAILABLE')
  await db.exec('rollback to savepoint expected_rejection')
})
it('paused_clock_excludes_elapsed: resumption preserves sixty seconds of paused phase time', async () => {
  await transition('paused', 1)
  await db.exec(
    `update app_private.event_runs set paused_at=clock_timestamp()-interval '60 seconds' where id='${run}'`,
  )
  const before = (
    await db.query<{ started_at: Date }>(
      `select started_at from app_private.event_run_phases where run_id='${run}'`,
    )
  ).rows[0]!.started_at
  await transition('live', 2)
  const after = (
    await db.query<{ started_at: Date }>(
      `select started_at from app_private.event_run_phases where run_id='${run}'`,
    )
  ).rows[0]!.started_at
  expect((+after - +before) / 1000).toBeGreaterThanOrEqual(60)
  expect((+after - +before) / 1000).toBeLessThan(61)
})
it('stop_late_job_settlement: stopped then archived never becomes reward-eligible', async () => {
  await db.exec(`insert into app_private.event_participants(run_id,character_id,user_id) values('${run}','${actor}','${actor}');
    insert into app_private.event_reward_claim_reservations(id,run_id,character_id,user_id,reward_package_ref,eligibility_provenance) values('${version}','${run}','${actor}','${actor}','reward.safety','{"source":"fixture"}');`)
  await transition('emergency-stopped', 1)
  await transition('archived', 2)
  await db.exec('savepoint expected_rejection')
  await expect(
    db.query(
      "select * from public.execute_event_reward_claim_v1($1,gen_random_uuid(),'late','system:fixture')",
      [version],
    ),
  ).rejects.toThrow('EVENT_REWARD_EXECUTION_RUN_NOT_TERMINAL')
  await db.exec('rollback to savepoint expected_rejection')
})
it('late contribution cannot pass pause/stop, while the original successful receipt still replays', async () => {
  const key = '44444444-4444-4444-8444-444444444444'
  const contribute = (id: string) =>
    db.query(
      "select * from public.record_event_contribution_v1('system:fixture',$1,'contribution',$2,$3,$3,'first','objective','community',$4,1,'{\"source\":\"trusted-service\"}')",
      [id, run, actor, `source:${id}`],
    )
  await contribute(key)
  await transition('resolving', 1)
  await db.exec('savepoint expected_rejection')
  await expect(contribute('55555555-5555-4555-8555-555555555555')).rejects.toThrow(
    'EVENT_CONTRIBUTION_RUN_NOT_LIVE',
  )
  await db.exec('rollback to savepoint expected_rejection')
  await expect(contribute(key)).resolves.toMatchObject({ rows: [{ replayed: true }] })
  expect(
    (await db.query('select contribution_total from app_private.event_participants')).rows,
  ).toEqual([{ contribution_total: 1 }])
})

it('selected_vs_global_emergency_authority uses the current linked character in the actual audited operation', async () => {
  const staff = '66666666-6666-4666-8666-666666666666',
    chosen = '77777777-7777-4777-8777-777777777777',
    alternate = '88888888-8888-4888-8888-888888888888'
  await db.exec(`insert into auth.users values('${staff}','staff@example.com',now()); insert into public.characters values('${chosen}','${staff}','Chosen'),('${alternate}','${staff}','Alternate');
    insert into app_private.master_panel_character_access(character_id,user_id,roles,special_capabilities,updated_by) values('${chosen}','${staff}',array['event-staff'],array['events.emergency_stop'],'${actor}');`)
  const operate = (character: string) =>
    db.query(
      "select * from public.operate_event_run_v2($1,$2,$3,1,gen_random_uuid(),'emergency-stop',null,true)",
      [staff, character, run],
    )
  await db.exec('savepoint expected_rejection')
  await expect(operate(alternate)).rejects.toThrow('EVENT_STAFF_REQUIRED')
  await db.exec('rollback to savepoint expected_rejection')
  await expect(operate(chosen)).resolves.toMatchObject({
    rows: [{ lifecycle_status: 'emergency-stopped' }],
  })
  expect(
    (await db.query('select actor_user_id,reason from app_private.event_operations_audit')).rows,
  ).toEqual([{ actor_user_id: staff, reason: null }])
})
it('emergency stop closes pending settlement after end, with complete transactional rollback', async () => {
  await transition('resolving', 1)
  await transition('ended', 2)
  await db.exec('savepoint before_stop')
  await expect(transition('emergency-stopped', 3)).resolves.toMatchObject({
    rows: [{ lifecycle_status: 'emergency-stopped' }],
  })
  await db.exec('rollback to savepoint before_stop')
  expect(
    (
      await db.query(
        `select lifecycle_status,state_version from app_private.event_runs where id='${run}'`,
      )
    ).rows,
  ).toEqual([{ lifecycle_status: 'ended', state_version: 3 }])
})
