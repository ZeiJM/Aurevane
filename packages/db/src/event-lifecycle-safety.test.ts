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
    create table public.characters(id uuid primary key,user_id uuid,name text,xp bigint not null default 0,level smallint not null default 1,progression_cycle integer not null default 1,cycle_started_at timestamptz not null default now());
    create table app_private.character_deletion_requests(character_id uuid primary key);
    alter table public.characters add column portrait_ref text;
    create table app_private.character_world_state (
      character_id uuid primary key, state jsonb not null, last_command_id uuid,
      last_command_fingerprint text, last_seen_at timestamptz not null default now()
    );
    create table app_private.battle_sessions(id uuid primary key,lifecycle text);
    create table app_private.battle_participants(battle_session_id uuid,user_id uuid,participant_role text);
    create table app_private.wayfarers_practice_state(character_id uuid,planned_window text,plan_set_at timestamptz,planned_window_seconds bigint);
    create table app_private.training_reports(character_id uuid,status text);
    create function app_private.world_block_reason_v1(uuid,uuid) returns text language sql as 'select null::text';
    create table app_private.idempotency_records(actor_key text,command_name text,idempotency_key uuid,request_fingerprint text,result jsonb,primary key(actor_key,command_name,idempotency_key));
    insert into auth.users values('${actor}','owner@example.com',now());
    insert into public.player_profiles values('${actor}');
    insert into public.characters(id,user_id,name) values('${actor}','${actor}','Owner');
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
    '20260816190000_character_progression.sql',
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
    '20261107114816_unified_event_categories.sql',
    '20261011115701_world_open_ground_idle_timeout.sql',
    '20261011161830_world_multistep_pacing.sql',
    '20261107115437_authoritative_world_event_arrival.sql',
    '20261107120135_personal_event_travel_quest.sql',
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
  await db.exec(`insert into auth.users values('${staff}','staff@example.com',now()); insert into public.characters(id,user_id,name) values('${chosen}','${staff}','Chosen'),('${alternate}','${staff}','Alternate');
    insert into app_private.master_panel_character_access(character_id,user_id,roles,special_capabilities,updated_by) values('${chosen}','${staff}',array['event-staff'],array['events.emergency_stop'],'${actor}');`)
  const operate = (character: string) =>
    db.query(
      "select * from public.operate_event_run_v2($1,$2,$3,1,gen_random_uuid(),'emergency-stop',null,true)",
      [staff, character, run],
    )
  await db.exec('savepoint expected_rejection')
  await expect(operate(alternate)).rejects.toThrow('EVENT_STAFF_REQUIRED')
  await db.exec('rollback to savepoint expected_rejection')
  await db.exec(
    `update app_private.event_runs set scope_type='global',scope_key=null where id='${run}'`,
  )
  await db.exec('savepoint global_denied')
  await expect(operate(chosen)).rejects.toThrow('EVENT_GLOBAL_SCOPE_CAPABILITY_REQUIRED')
  await db.exec('rollback to savepoint global_denied')
  await db.exec(
    `update app_private.master_panel_character_access set special_capabilities=array['events.global_scope'] where character_id='${chosen}'`,
  )
  await db.exec('savepoint emergency_denied')
  await expect(operate(chosen)).rejects.toThrow('EVENT_EMERGENCY_STOP_CAPABILITY_REQUIRED')
  await db.exec('rollback to savepoint emergency_denied')
  await db.exec(
    `update app_private.master_panel_character_access set special_capabilities=array['events.global_scope','events.emergency_stop'] where character_id='${chosen}'`,
  )
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

it('draft_live_concurrency: stale draft/publication writes reject without changing pinned runs', async () => {
  const eventKey = 'event.authoring'
  const definition = {
    schemaVersion: 1,
    eventKey,
    templateKey: 'template.navigation',
    contentVersion: 1,
    title: 'Watchtower gathering',
    summary: 'A guided World meeting.',
    internalNotes: '',
    family: 'regional-event',
    scope: { type: 'region', key: 'verdant-expanse' },
    phases: [
      {
        id: 'watch',
        name: 'Watch',
        objectives: [
          {
            id: 'visit',
            type: 'discover',
            referenceKey: 'objective.watchtower',
            target: 1,
            worldNavigation: {
              sectorId: 'verdant-expanse',
              x: 12,
              y: 4,
              autoPath: true,
              guidance: 'exact',
            },
          },
        ],
        effects: [],
        cleanupEffects: [],
        transition: { type: 'elapsed', afterSeconds: 600 },
      },
    ],
    rewardPackageRefs: [],
    aftermathRefs: [],
  }
  await db.query(
    'select * from public.save_event_definition_draft_v1($1,null::uuid,$2,$3::jsonb,null,null)',
    [actor, eventKey, definition],
  )
  const publish = (base: number | null, title: string, category = 'repeatable-activities') =>
    db.query(
      'select * from public.publish_event_definition_v2($1,null::uuid,$2,$3::jsonb,$4,gen_random_uuid(),null,true)',
      [actor, eventKey, { ...definition, title, category }, base],
    )
  await publish(null, 'First title')
  const scheduled = await db.query<{ run_id: string }>(
    "select * from public.schedule_event_run_v2($1,null::uuid,$2,gen_random_uuid(),'schedule:fixture',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '2 hours',null,true)",
    [actor, eventKey],
  )
  await publish(1, 'Second title', 'story-campaigns')
  await db.exec('savepoint stale')
  await expect(publish(1, 'Stale title')).rejects.toThrow('EVENT_PUBLISH_BASE_VERSION_CONFLICT')
  await db.exec('rollback to savepoint stale')
  const pinned = await db.query<{ title: string }>(
    "select d.definition->>'title' title from app_private.event_runs r join app_private.event_definition_versions d on d.id=r.definition_version_id where r.id=$1",
    [scheduled.rows[0]!.run_id],
  )
  expect(pinned.rows).toEqual([{ title: 'First title' }])
  const summaries = await db.query<{
    runs: Array<{ run_id: string; title: string; participant_count: number }>
  }>('select public.list_event_workspace_runs_v1($1,null::uuid) runs', [actor])
  expect(
    summaries.rows[0]!.runs.find((entry) => entry.run_id === scheduled.rows[0]!.run_id),
  ).toMatchObject({ title: 'First title', category: 'repeatable-activities', participant_count: 0 })
  const catalogue = await db.query<{
    catalogue: {
      events: Array<{ eventKey: string; publishedVersion: number }>
      rewards: Array<{ key: string; label: string }>
    }
  }>('select public.read_event_workspace_catalogue_v1($1,null::uuid) catalogue', [actor])
  expect(catalogue.rows[0]!.catalogue.events).toContainEqual(
    expect.objectContaining({ eventKey, publishedVersion: 2, category: 'story-campaigns' }),
  )
  expect(catalogue.rows[0]!.catalogue.rewards).toContainEqual(
    expect.objectContaining({ key: 'reward.safety', label: '25 Character XP · v1' }),
  )

  await db.exec('savepoint invalid_category')
  await expect(publish(2, 'Invalid category', 'paused')).rejects.toThrow(
    'event_version_category_valid',
  )
  await db.exec('rollback to savepoint invalid_category')

  await db.exec('savepoint hidden_category')
  await expect(publish(2, 'Hidden navigation', 'hidden-discoveries')).rejects.toThrow(
    'EVENT_HIDDEN_NAVIGATION_UNAVAILABLE',
  )
  await db.exec('rollback to savepoint hidden_category')

  await db.exec('savepoint stale_draft')
  await expect(
    db.query(
      'select * from public.save_event_definition_draft_v1($1,null::uuid,$2,$3::jsonb,2,1)',
      [actor, eventKey, definition],
    ),
  ).rejects.toThrow('EVENT_DRAFT_VERSION_CONFLICT')
  await db.exec('rollback to savepoint stale_draft')
  expect(
    (
      await db.query(
        'select count(*) n from app_private.event_authoring_audit where event_key=$1',
        [eventKey],
      )
    ).rows,
  ).toEqual([{ n: 3 }])
})
it('specific missing-producer blockers preserve clock/navigation and supported historical reward definitions', async () => {
  const check = (definition: unknown) =>
    db.query('select app_private.assert_event_runtime_supported_v1($1::jsonb)', [definition])
  await expect(
    check({
      phases: [
        {
          objectives: [],
          effects: [],
          cleanupEffects: [],
          transition: { type: 'elapsed', afterSeconds: 60 },
        },
      ],
      rewardPackageRefs: [],
      aftermathRefs: [],
    }),
  ).resolves.toBeDefined()
  for (const [definition, message] of [
    [
      { phases: [{ objectives: [{ id: 'community', type: 'community-threshold' }] }] },
      'EVENT_OBJECTIVE_EXECUTOR_UNAVAILABLE',
    ],
    [{ phases: [], rewardPackageRefs: ['reward.safety'] }, 'EVENT_REWARD_PRODUCER_UNAVAILABLE'],
    [{ phases: [], aftermathRefs: ['aftermath.unknown'] }, 'EVENT_AFTERMATH_EXECUTOR_UNAVAILABLE'],
  ] as const) {
    await db.exec('savepoint rejected_recipe')
    await expect(check(definition)).rejects.toThrow(message)
    await db.exec('rollback to savepoint rejected_recipe')
  }
  expect(
    (
      await db.query(
        "select amount from app_private.event_reward_packages where reward_package_ref='reward.safety'",
      )
    ).rows,
  ).toEqual([{ amount: 25 }])
})

async function readyClaim() {
  await db.query(
    "select * from public.record_event_contribution_v1('system:fixture',gen_random_uuid(),'contribution',$1,$2,$2,'first','objective','test','source:claim',1,'{\"fixture\":true}')",
    [run, actor],
  )
  await transition('resolving', 1)
  await transition('ended', 2)
  return (
    await db.query<{ reservation_id: string }>(
      "select * from public.reserve_event_reward_claim_v1('system:fixture',gen_random_uuid(),'reserve',$1,$2,$2,'reward.safety','{\"fixture\":true}')",
      [run, actor],
    )
  ).rows[0]!.reservation_id
}
const executeClaim = (claim: string, key = '99999999-9999-4999-8999-999999999999') =>
  db.query("select * from public.execute_event_reward_claim_v1($1,$2,'claim','system:fixture')", [
    claim,
    key,
  ])
it('repeat_receipt_no_reward_replay: claim-first keeps real awarded XP after emergency stop and archive', async () => {
  await db.query(
    "select * from public.grant_character_xp_v1($1,gen_random_uuid(),'unrelated','system:other','gameplay','other:progress','other.progress',7)",
    [actor],
  )
  const unrelated = (await db.query('select * from app_private.character_xp_grants')).rows
  const claim = await readyClaim()
  await expect(executeClaim(claim)).resolves.toMatchObject({
    rows: [{ applied_amount: 25, replayed: false }],
  })
  const ended = (await db.query('select ended_at from app_private.event_runs where id=$1', [run]))
    .rows
  await transition('emergency-stopped', 3)
  await transition('archived', 4)
  await expect(executeClaim(claim)).resolves.toMatchObject({
    rows: [{ applied_amount: 25, replayed: true }],
  })
  await expect(executeClaim(claim, '99999999-9999-4999-8999-999999999998')).resolves.toMatchObject({
    rows: [{ applied_amount: 25, claim_deduplicated: true }],
  })
  expect(
    (await db.query('select xp,name from public.characters where id=$1', [actor])).rows,
  ).toEqual([{ xp: 32, name: 'Owner' }])
  expect(
    (
      await db.query(
        "select * from app_private.character_xp_grants where reason_tag='other.progress'",
      )
    ).rows,
  ).toEqual(unrelated)
  expect(
    (await db.query('select ended_at from app_private.event_runs where id=$1', [run])).rows,
  ).toEqual(ended)
  expect(
    (await db.query('select count(*) n from app_private.event_reward_claim_executions')).rows,
  ).toEqual([{ n: 1 }])
})
it('emergency-first cancels a genuine reserved claim, including after archive, without deleting its reservation', async () => {
  const claim = await readyClaim()
  await transition('emergency-stopped', 3)
  await transition('archived', 4)
  await db.exec('savepoint late_claim')
  await expect(executeClaim(claim)).rejects.toThrow('EVENT_REWARD_EXECUTION_RUN_NOT_TERMINAL')
  await db.exec('rollback to savepoint late_claim')
  expect((await db.query('select xp from public.characters where id=$1', [actor])).rows).toEqual([
    { xp: 0 },
  ])
  expect(
    (await db.query('select count(*) n from app_private.event_reward_claim_reservations')).rows,
  ).toEqual([{ n: 1 }])
  expect(
    (await db.query('select count(*) n from app_private.event_reward_claim_executions')).rows,
  ).toEqual([{ n: 0 }])
})
it('unrelated_progress_preserved: whole real grant + cancellation rollback leaves every affected ledger exact', async () => {
  const claim = await readyClaim()
  const snapshot = async () => {
    const result = []
    for (const table of [
      'public.characters',
      'app_private.event_runs',
      'app_private.event_run_transitions',
      'app_private.event_reward_claim_reservations',
      'app_private.event_reward_claim_executions',
      'app_private.character_xp_grants',
      'app_private.idempotency_records',
    ])
      result.push(
        (await db.query(`select to_jsonb(t) row from ${table} t order by to_jsonb(t)::text`)).rows,
      )
    return result
  }
  const before = await snapshot()
  await db.exec('savepoint atomic_grant_stop')
  await executeClaim(claim)
  await transition('emergency-stopped', 3)
  await db.exec('rollback to savepoint atomic_grant_stop')
  expect(await snapshot()).toEqual(before)
})

it('credits a confirmed intermediate arrival once per player and only projects their own credit', async () => {
  const eventKey = 'event.reach-watch'
  const position = (x: number) => ({ sectorId: 'verdant-expanse', x, y: 4 })
  const definition = {
    schemaVersion: 1,
    eventKey,
    templateKey: 'template.navigation',
    contentVersion: 1,
    title: 'Reach the watch',
    summary: 'Public arrival verification fixture.',
    internalNotes: 'Private authoring notes.',
    category: 'world-events',
    family: 'regional-event',
    scope: { type: 'region', key: 'verdant-expanse' },
    phases: [
      {
        id: 'watch',
        name: 'Watch',
        objectives: [
          {
            id: 'visit',
            type: 'discover',
            completion: 'world-arrival',
            referenceKey: 'objective.watchtower',
            target: 3,
            worldNavigation: { ...position(6), autoPath: true, guidance: 'exact' },
          },
        ],
        effects: [],
        cleanupEffects: [],
        transition: { type: 'objective-threshold', objectiveId: 'visit' },
      },
    ],
    rewardPackageRefs: [],
    aftermathRefs: [],
  }
  await db.query(
    'select * from public.publish_event_definition_v2($1,null::uuid,$2,$3::jsonb,null,gen_random_uuid(),null,true)',
    [actor, eventKey, definition],
  )
  const scheduled = await db.query<{ run_id: string }>(
    `select * from public.schedule_event_run_v2($1,null::uuid,$2,gen_random_uuid(),'schedule:arrival',
      clock_timestamp()+interval '1 minute',clock_timestamp()+interval '1 hour',null,true)`,
    [actor, eventKey],
  )
  const runId = scheduled.rows[0]!.run_id
  await db.query(
    "update app_private.event_runs set scheduled_start_at=clock_timestamp()-interval '1 second' where id=$1",
    [runId],
  )
  await db.query(
    "select * from public.operate_event_run_v2($1,null::uuid,$2,1,gen_random_uuid(),'start',null,true)",
    [actor, runId],
  )
  await db.query(
    "update app_private.event_runs set started_at=clock_timestamp()-interval '2 seconds' where id=$1",
    [runId],
  )
  const nextCharacter = '99999999-9999-4999-8999-999999999999'
  await db.query('insert into public.characters(id,user_id,name) values($1,$2,$3)', [
    nextCharacter,
    actor,
    'Another character',
  ])
  const initial = { version: 1, position: position(5), route: [], nextStepAt: null }
  const read = (characterId: string) =>
    db.query<{ world: { eventObjectives: unknown[] } }>(
      'select public.read_world_state_v1($1,$2,$3) world',
      [actor, characterId, initial],
    )
  await read(actor)
  await read(nextCharacter)
  // The route comes from the ordinary trusted command, and SQL decides when
  // the committed prefix is due. Use the database clock to make both steps due.
  const time = (
    await db.query<{ ms: number }>(
      'select floor(extract(epoch from clock_timestamp())*1000)::bigint ms',
    )
  ).rows[0]!.ms
  const move = (version: number, kind: string, state: unknown, command: string | null = null) =>
    db.query('select public.commit_world_state_v1($1,$1,$2,coalesce($3,gen_random_uuid()),$4,$5)', [
      actor,
      version,
      command,
      kind,
      state,
    ])
  await move(1, 'walk', {
    ...initial,
    nextStepAt: time - 300,
    route: [6, 7].map((x) => ({ position: position(x), durationMs: 275 })),
  })
  const landed = { ...initial, position: position(7) }
  const command = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  await move(2, 'tick', landed, command)
  await move(2, 'tick', landed, command)
  await move(3, 'walk', {
    ...landed,
    nextStepAt: time - 300,
    route: [{ position: position(6), durationMs: 275 }],
  })
  await move(4, 'tick', { ...initial, position: position(6) })

  expect(
    (
      await db.query('select progress from app_private.event_run_objectives where run_id=$1', [
        runId,
      ])
    ).rows,
  ).toEqual([{ progress: 1 }])
  expect((await read(actor)).rows[0]!.world.eventObjectives).toEqual([
    expect.objectContaining({ objectiveId: 'visit', completed: true }),
  ])
  expect((await read(nextCharacter)).rows[0]!.world.eventObjectives).toEqual([
    expect.objectContaining({ objectiveId: 'visit', completed: false }),
  ])
})

it('pins and completes a personal travel quest through explicit world commands with one XP grant', async () => {
  const eventKey = 'event.personal-watch'
  const position = (x: number) => ({ sectorId: 'verdant-expanse', x, y: 4 })
  const definition = {
    schemaVersion: 1,
    eventKey,
    templateKey: 'template.travel-quest',
    contentVersion: 1,
    title: 'A new Watch report',
    summary: 'Private travel quest verification fixture.',
    internalNotes: 'Do not expose to players.',
    category: 'story-campaigns',
    family: 'narrative-event',
    scope: { type: 'region', key: 'verdant-expanse' },
    personalJourney: {
      type: 'travel-and-report',
      giverId: 'eastern-watch-officer',
      destination: position(3),
      offer: 'Take this route and report to me.',
      active: 'Walk to the marked tile.',
      ready: 'Tell me what you found.',
      completed: 'Your patrol report is recorded.',
    },
    phases: [
      {
        id: 'quest',
        name: 'Quest',
        objectives: [],
        effects: [],
        cleanupEffects: [],
        transition: { type: 'manual' },
      },
    ],
    rewardPackageRefs: ['reward.safety'],
    aftermathRefs: [],
  }
  const publish = (payload: unknown, base: number | null) =>
    db.query(
      'select * from public.publish_event_definition_v2($1,null::uuid,$2,$3::jsonb,$4,gen_random_uuid(),null,true)',
      [actor, eventKey, payload, base],
    )
  await db.exec('savepoint duplicate_quest_rewards')
  await expect(
    publish({ ...definition, rewardPackageRefs: ['reward.safety', 'reward.safety'] }, null),
  ).rejects.toThrow('EVENT_PERSONAL_JOURNEY_INVALID')
  await db.exec('rollback to savepoint duplicate_quest_rewards')
  await db.exec('savepoint same_quest_position')
  await expect(
    publish(
      {
        ...definition,
        personalJourney: {
          ...definition.personalJourney,
          destination: { ...position(2), extra: true },
        },
      },
      null,
    ),
  ).rejects.toThrow('EVENT_PERSONAL_JOURNEY_INVALID')
  await db.exec('rollback to savepoint same_quest_position')
  await publish(definition, null)
  const scheduled = await db.query<{ run_id: string }>(
    `select * from public.schedule_event_run_v2($1,null::uuid,$2,gen_random_uuid(),'schedule:quest',
      clock_timestamp()+interval '1 minute',clock_timestamp()+interval '1 hour',null,true)`,
    [actor, eventKey],
  )
  const runId = scheduled.rows[0]!.run_id
  await db.query(
    "update app_private.event_runs set scheduled_start_at=clock_timestamp()-interval '1 second' where id=$1",
    [runId],
  )
  await db.query(
    "select * from public.operate_event_run_v2($1,null::uuid,$2,1,gen_random_uuid(),'start',null,true)",
    [actor, runId],
  )
  await db.query(
    "update app_private.event_runs set started_at=clock_timestamp()-interval '2 seconds' where id=$1",
    [runId],
  )
  const initial = { version: 1, position: position(2), route: [], nextStepAt: null }
  const read = async (character = actor, user = actor) =>
    (
      await db.query<{ world: { personalQuests: unknown[] } }>(
        'select public.read_world_state_v1($1,$2,$3) world',
        [user, character, initial],
      )
    ).rows[0]!.world.personalQuests
  const interact = (version: number, action: string, command: string | null = null) =>
    db.query(
      'select public.commit_world_personal_quest_v1($1,$1,$2,coalesce($3,gen_random_uuid()),$4,$5,$6)',
      [actor, version, command, runId, action, `quest:${action}`],
    )
  const move = (version: number, kind: string, state: unknown) =>
    db.query('select public.commit_world_state_v1($1,$1,$2,gen_random_uuid(),$3,$4)', [
      actor,
      version,
      kind,
      state,
    ])
  expect(await read()).toEqual([
    expect.objectContaining({ progress: 'available', action: 'accept' }),
  ])
  await db.exec('savepoint report_without_acceptance')
  await expect(interact(1, 'report')).rejects.toThrow('WORLD_QUEST_ACTION_UNAVAILABLE')
  await db.exec('rollback to savepoint report_without_acceptance')
  await interact(1, 'accept')
  await db.exec('savepoint stale_quest_reply')
  await expect(interact(1, 'accept')).rejects.toMatchObject({ code: 'PT409' })
  await db.exec('rollback to savepoint stale_quest_reply')
  await publish({ ...definition, title: 'Updated title', rewardPackageRefs: [] }, 1)
  expect(await read()).toEqual([
    expect.objectContaining({ title: definition.title, progress: 'active' }),
  ])

  const time = (
    await db.query<{ ms: number }>(
      'select floor(extract(epoch from clock_timestamp())*1000)::bigint ms',
    )
  ).rows[0]!.ms
  await move(2, 'walk', {
    ...initial,
    nextStepAt: time,
    route: [{ position: position(3), durationMs: 275 }],
  })
  await move(3, 'tick', { ...initial, position: position(3) })
  expect(await read()).toEqual([expect.objectContaining({ progress: 'ready', action: null })])
  await db.exec('savepoint remote_report')
  await expect(interact(4, 'report')).rejects.toThrow('WORLD_QUEST_OUT_OF_RANGE')
  await db.exec('rollback to savepoint remote_report')
  await move(4, 'walk', {
    ...initial,
    position: position(3),
    nextStepAt: time,
    route: [{ position: position(2), durationMs: 275 }],
  })
  await move(5, 'tick', initial)
  expect(await read()).toEqual([expect.objectContaining({ progress: 'ready', action: 'report' })])
  const command = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  await interact(6, 'report', command)
  await interact(6, 'report', command)
  expect(await read()).toEqual([
    expect.objectContaining({ title: definition.title, progress: 'completed' }),
  ])
  expect((await db.query('select xp from public.characters where id=$1', [actor])).rows).toEqual([
    { xp: 25 },
  ])
  expect(
    (
      await db.query(
        "select count(*) grants from app_private.character_xp_grants where reason_tag='event.quest.reward'",
      )
    ).rows,
  ).toEqual([{ grants: 1 }])
  const other = '99999999-9999-4999-8999-999999999999'
  await db.query('insert into public.characters(id,user_id,name) values($1,$1,$2)', [
    other,
    'Second player',
  ])
  expect(await read(other, other)).toEqual([
    expect.objectContaining({ progress: 'available', action: 'accept' }),
  ])
  const acceptAs = (character: string, version: number, occurrence: string) =>
    db.query(
      `select public.commit_world_personal_quest_v1($1,$1,$2,gen_random_uuid(),$3,'accept','quest:accept')`,
      [character, version, occurrence],
    )
  await acceptAs(other, 1, runId)
  await db.query(
    'update app_private.event_runs set scheduled_end_at=clock_timestamp() where id=$1',
    [runId],
  )
  expect(await read(other, other)).toEqual([])
  const nextOccurrence = (
    await db.query<{ run_id: string }>(
      `select * from public.schedule_event_run_v2($1,null::uuid,$2,gen_random_uuid(),'schedule:quest:again',
        clock_timestamp()+interval '1 minute',clock_timestamp()+interval '1 hour',null,true)`,
      [actor, eventKey],
    )
  ).rows[0]!.run_id
  await db.query(
    "update app_private.event_runs set scheduled_start_at=clock_timestamp()-interval '1 second' where id=$1",
    [nextOccurrence],
  )
  await db.query(
    "select * from public.operate_event_run_v2($1,null::uuid,$2,1,gen_random_uuid(),'start',null,true)",
    [actor, nextOccurrence],
  )
  expect(await read(other, other)).toEqual([
    expect.objectContaining({ runId: nextOccurrence, progress: 'available', action: 'accept' }),
  ])
  await acceptAs(other, 2, nextOccurrence)
  expect(await read(other, other)).toEqual([
    expect.objectContaining({ runId: nextOccurrence, progress: 'active' }),
  ])
  expect(await read()).toEqual([expect.objectContaining({ runId, progress: 'completed' })])
})
