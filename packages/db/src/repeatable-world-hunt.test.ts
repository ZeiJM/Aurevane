import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
} from '../../game-core/src/combat/actions'
import {
  createPendingBattle,
  selectFinalFacing,
  startBattle,
} from '../../game-core/src/combat/battle-state'
import { createTacticalBattleState } from '../../game-core/src/combat/board'
import { applyCurrentPoisonState } from '../../game-core/src/combat/combat-dots'
import {
  createPv1fTemporaryResources,
  PV1F_COMBAT_CONTENT,
} from '../../game-core/src/combat/pv1f-action-economy'
import { surrenderPvpCombatant } from '../../game-core/src/combat/pvp-quality'
import {
  createStatDrivenCombatEncounterState,
  reattachStatDrivenCombatBridge,
} from '../../game-core/src/combat/stat-driven-combat'

const actor = '11111111-1111-4111-8111-111111111111'
const other = '99999999-9999-4999-8999-999999999999'
const eventKey = 'event.fixture-venn-wolf-hunt'
const giver = '77777777-7777-4777-8777-777777777771'
const wolf = '77777777-7777-4777-8777-777777777772'
const boar = '77777777-7777-4777-8777-777777777773'
const position = (x: number) => ({ sectorId: 'verdant-expanse', x, y: 4 })
const initial = { version: 1, position: position(2), route: [], nextStepAt: null }
const definition = (recurrence: object) => ({
  schemaVersion: 1,
  eventKey,
  templateKey: 'template.wolf-hunt',
  contentVersion: 1,
  title: 'Alder Venn’s Wolf Hunt',
  summary: 'Disposable repeatable hunt fixture.',
  internalNotes: '',
  family: 'regional-event',
  category: 'repeatable-activities',
  scope: { type: 'global' },
  repeatableTravel: {
    journey: {
      type: 'defeat-and-report',
      giverId: giver,
      npcTag: 'wolf',
      requiredDefeats: 5,
      rewardPackageRef: 'reward.venn-fixture',
      offer: 'Thin the pack stalking the sheepfold.',
      active: 'Defeat wolves on patrol.',
      ready: 'Return to Alder Venn.',
      completed: 'The sheepfold is safe for now.',
    },
    recurrence,
  },
  phases: [
    {
      id: 'trail',
      name: 'Trail',
      objectives: [],
      effects: [],
      cleanupEffects: [],
      transition: { type: 'manual' },
    },
  ],
  rewardPackageRefs: [],
  aftermathRefs: [],
})

let db: PGlite
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  for (const [id, index, name] of [
    [actor, 0, 'First player'],
    [other, 1, 'Second player'],
  ] as const) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      id,
      `fixture-${index}@example.test`,
    ])
    await db.query(
      `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,
        presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,
        might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
        values($1,$1,0,1,$2,$3,'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
      [id, name, `fixture-player-${index}`],
    )
  }
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [actor],
  )
  await db.query(
    "insert into app_private.event_reward_budget_policies values('budget.venn-fixture','character-xp',100,$1,now())",
    [actor],
  )
  await db.query(
    `insert into app_private.event_reward_packages(reward_package_ref,package_version,reward_kind,amount,published_by,budget_ref)
    values('reward.venn-fixture',1,'character-xp',25,$1,'budget.venn-fixture')`,
    [actor],
  )
  await db.query("select public.write_master_npc_design_v1($1,null,$2,0,'save',$3)", [
    actor,
    giver,
    {
      name: 'Alder Venn',
      portraitRef: null,
      uses: ['story', 'world'],
      arena: null,
      world: { ...position(2), radius: 1, greeting: 'The sheepfold is under watch.' },
    },
  ])
  await db.query("select public.write_master_npc_design_v1($1,null,$2,1,'commit-world',null)", [
    actor,
    giver,
  ])
  await db.query("select public.write_master_npc_design_v1($1,null,$2,2,'commit-story',null)", [
    actor,
    giver,
  ])
  for (const [npc, name, tag, x] of [
    [wolf, 'Ridge wolf', 'wolf', 3],
    [boar, 'Ridge boar', 'boar', 4],
  ] as const) {
    await db.query("select public.write_master_npc_design_v1($1,null,$2,0,'save',$3)", [
      actor,
      npc,
      {
        name,
        portraitRef: null,
        uses: ['world'],
        arena: null,
        world: {
          ...position(x),
          radius: 2,
          greeting: 'A wild encounter.',
          encounter: { arenaId: 'duel-yard', aiDifficulty: 'standard', tags: [tag] },
        },
      },
    ])
    await db.query("select public.write_master_npc_design_v1($1,null,$2,1,'commit-world',null)", [
      actor,
      npc,
    ])
  }
  await db.exec(`create table app_private.repeatable_clock_fixture(at timestamptz);
    insert into app_private.repeatable_clock_fixture values(null);
    create or replace function app_private.repeatable_travel_now_v1()
    returns timestamptz language sql volatile set search_path = '' as $$
      select coalesce(at,clock_timestamp()) from app_private.repeatable_clock_fixture
    $$;`)
}, 60_000)
beforeEach(async () => db.exec('begin'))
afterEach(async () => db.exec('rollback'))
afterAll(async () => db?.close())

const publish = (body: object, expectedVersion: number | null = null) =>
  db.query(
    'select * from public.publish_event_definition_v2($1,null::uuid,$2,$3::jsonb,$4,gen_random_uuid(),null,true)',
    [actor, eventKey, body, expectedVersion],
  )

const schedule = async () => {
  const { rows } = await db.query<{ run_id: string }>(
    `select * from public.schedule_event_run_v2($1,null::uuid,$2,gen_random_uuid(),'schedule:travel',
      clock_timestamp()+interval '1 minute',clock_timestamp()+interval '7 days',null,true)`,
    [actor, eventKey],
  )
  const runId = rows[0]!.run_id
  await db.query(
    "update app_private.event_runs set scheduled_start_at=clock_timestamp()-interval '1 second' where id=$1",
    [runId],
  )
  await db.query(
    "select * from public.operate_event_run_v2($1,null::uuid,$2,1,gen_random_uuid(),'start',null,true)",
    [actor, runId],
  )
  return runId
}

const read = async (character = actor) =>
  (
    await db.query<{ view: { repeatableActivities: unknown[] } }>(
      'select public.read_world_state_v1($1,$1,$2) view',
      [character, initial],
    )
  ).rows[0]!.view.repeatableActivities

const interact = (
  version: number,
  ref: string,
  action: string,
  command: string | null = null,
  character = actor,
) =>
  db.query(
    'select public.commit_world_repeatable_travel_v1($1,$1,$2,coalesce($3,gen_random_uuid()),$4,$5,$6)',
    [character, version, command, ref, action, `repeat:${ref}:${action}`],
  )
const clock = (value: Date) =>
  db.query('update app_private.repeatable_clock_fixture set at=$1', [value.toISOString()])

const reject = async (action: () => Promise<unknown>, code: string) => {
  await db.exec('savepoint expected_denial')
  await expect(action()).rejects.toThrow(code)
  await db.exec('rollback to savepoint expected_denial')
}

it('publishes a Hunt and offers it only at its published Story giver', async () => {
  await publish(definition({ mode: 'rolling-24h' }))
  const run = await schedule()
  expect(await read()).toEqual([
    expect.objectContaining({ runId: run, action: 'accept', speaker: 'Alder Venn' }),
  ])
  await interact(1, run, 'accept')
  expect(await read()).toEqual([
    expect.objectContaining({
      progress: 'active',
      defeats: 0,
      requiredDefeats: 5,
      destination: null,
    }),
  ])
})

const currentVersion = async (character = actor) =>
  Number(
    (
      await db.query<{ version: string }>(
        "select state->>'version' version from app_private.character_world_state where character_id=$1",
        [character],
      )
    ).rows[0]!.version,
  )

async function challenge({
  npc = wolf,
  character = actor,
  practice = false,
  playerActs = true,
}: { npc?: string; character?: string; practice?: boolean; playerActs?: boolean } = {}) {
  const user = character
  const version = await currentVersion(character)
  const battleId = `hunt-fixture-${crypto.randomUUID()}`
  const player = `character:${character}`
  const opponent = 'recruit:fixture'
  const combatants = [player, opponent].map((id, index) => ({
    id,
    teamId: index === 0 ? 'players' : 'opponents',
    initiative: (index === 0) === playerActs ? 2 : 1,
    baseMovementBudget: 2,
    hp: 10,
    maxHp: 10,
    mp: 0,
    maxMp: 0,
    temporaryResources: createPv1fTemporaryResources(15),
  }))
  const battle = startBattle(
    createPendingBattle({ battleId, rulesVersion: 1, contentVersion: 1, rngSeed: 100, combatants }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 2,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: [0, 1].map((x) => ({ position: { x, y: 0 }, elevation: 0, terrainId: 'open' })),
    movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
    placements: combatants.map((unit, x) => ({
      combatantId: unit.id,
      position: { x, y: 0 },
      facing: x === 0 ? 'east' : 'west',
      movementProfileId: 'ground',
    })),
  })
  const state = createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical),
    combatants.map((unit) => ({
      combatantId: unit.id,
      provenance: { kind: 'scenario', sourceId: 'scenario:hunt-test', sourceRulesVersion: 1 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 1,
    })),
  )
  const capture = (
    await db.query<{ capture: object }>(
      `select public.get_character_committed_build_snapshot_v2($1,$2) || jsonb_build_object('sourceHash',app_private.player_source_hash_v1($2)) capture`,
      [user, character],
    )
  ).rows[0]!.capture
  const arenaNpc = (
    await db.query<{ value: object }>(
      "select world - array['sectorId','x','y','radius','greeting','encounter'] value from app_private.npc_designs where id=$1",
      [npc],
    )
  ).rows[0]!.value
  const authority = {
    ...(!practice && { worldBattleOrigin: 'npc', arenaNpc }),
    buildAuthority: { combatants: [{ ...capture, characterId: character, combatantId: player }] },
  }
  const victory = executeCombatAction(
    state,
    {
      id: 'world-fixture.strike',
      version: 1,
      sourceType: 'scenario',
      tags: [],
      target: {
        kind: 'unit',
        teamPolicy: 'enemy',
        shape: { kind: 'single' },
        minimumRange: 1,
        maximumRange: 1,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        friendlyFire: 'enemies-only',
      },
      cost: { spendsAction: true, mp: 0 },
      requirements: [],
      effects: [{ type: 'damage', recipient: 'primary-unit', amount: 15 }],
    },
    { kind: 'unit', combatantId: playerActs ? opponent : player },
    PV1F_COMBAT_CONTENT,
  )
  const snapshot = { ...state, ...authority }
  const participants = [
    { combatant_id: player, participant_role: 'player', character_id: character },
    { combatant_id: opponent, participant_role: 'opponent', character_id: null },
  ]
  const response = practice
    ? await db.query<{ battle_session_id: string }>(
        'select * from public.create_battle_session_v1($1::text,gen_random_uuid(),$2,$1::uuid,$3,1,1,$4,$5)',
        [user, `canonical:${battleId}`, battleId, snapshot, participants],
      )
    : await db.query<{ battle_session_id: string }>(
        'select * from public.start_world_npc_battle_v1($1,$1,$2,gen_random_uuid(),$3,$4,$5,$4,1,1,$6,$7,null,null,null)',
        [user, version, npc, battleId, `canonical:${battleId}`, snapshot, participants],
      )
  const session = response.rows[0]!.battle_session_id
  const terminalCommand = crypto.randomUUID()
  const commitBattle = (
    result: { state: object; events: readonly unknown[] },
    version: number,
    command: string,
  ) =>
    db.query(
      "select * from public.commit_battle_intent_v3($1::text,$2,'fixture:hunt-terminal',$1::uuid,$3,$4,$5,$6,null)",
      [user, command, session, version, { ...result.state, ...authority }, result.events],
    )
  return {
    session,
    finish: (surrender = false) =>
      commitBattle(
        surrender ? surrenderPvpCombatant(state, opponent) : victory,
        1,
        terminalCommand,
      ),
    finishPoison: async () => {
      const poisoned = reattachStatDrivenCombatBridge(
        applyCurrentPoisonState(state, player, opponent, 'world-fixture.poison', undefined, 15, 1),
        state.statBridge,
      )
      await commitBattle({ state: poisoned, events: [] }, 1, crypto.randomUUID())
      const faced = selectFinalFacing(poisoned.tactical.battle, 'west').state
      const tick = endCombatTurn(
        { ...poisoned, tactical: { ...poisoned.tactical, battle: faced } },
        PV1F_COMBAT_CONTENT,
      )
      await commitBattle(tick, 2, terminalCommand)
    },
  }
}

it('counts a canonical Poison victory without requiring direct-strike defeat evidence', async () => {
  await publish(definition({ mode: 'rolling-24h' }))
  const run = await schedule()
  await read()
  await interact(1, run, 'accept')
  const fight = await challenge({ playerActs: false })
  await fight.finishPoison()
  expect(
    (
      await db.query(
        `select outcome,exists(select from app_private.world_npc_defeat_evidence evidence
      where evidence.battle_session_id=terminal.battle_session_id) direct_strike
      from app_private.world_npc_terminal_receipts terminal where battle_session_id=$1`,
        [fight.session],
      )
    ).rows,
  ).toEqual([{ outcome: 'victory', direct_strike: false }])
  expect(await read()).toEqual([expect.objectContaining({ defeats: 1, requiredDefeats: 5 })])
})

it('counts only unique qualified World wins in the character and live admission windows', async () => {
  await publish(definition({ mode: 'rolling-24h' }))
  const run = await schedule()
  await read()
  await read(other)

  const prior = await challenge()
  await prior.finish()
  await interact(await currentVersion(), run, 'accept')
  const attempt = (
    await db.query<{ id: string }>('select id from app_private.event_repeatable_travel_attempts')
  ).rows[0]!.id
  const otherPlayerFight = await challenge({ character: other })
  await otherPlayerFight.finish()
  const wrongTag = await challenge({ npc: boar })
  await wrongTag.finish()
  const practice = await challenge({ practice: true })
  await practice.finish()
  const surrendered = await challenge()
  await surrendered.finish(true)

  const operate = (version: number, operation: string) =>
    db.query(
      "select * from public.operate_event_run_v2($1,null::uuid,$2,$3,gen_random_uuid(),$4,'Hunt fixture',true)",
      [actor, run, version, operation],
    )
  const admittedBeforePause = await challenge()
  await operate(2, 'pause')
  await admittedBeforePause.finish()
  const admittedDuringPause = await challenge()
  await admittedDuringPause.finish()
  await operate(3, 'resume')
  expect(await read()).toEqual([
    expect.objectContaining({ runId: attempt, action: null, defeats: 1, requiredDefeats: 5 }),
  ])
  const version = await currentVersion()
  await reject(() => interact(version, attempt, 'report'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  await reject(
    () => interact(version, attempt, 'claim-hunt-reward'),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  for (let i = 2; i <= 5; i++) {
    const fight = await challenge()
    await fight.finish()
    await fight.finish()
    expect(await read()).toEqual([
      expect.objectContaining({
        defeats: i,
        requiredDefeats: 5,
        action: i === 5 ? 'report' : null,
      }),
    ])
  }
  expect(await read(other)).toEqual([expect.objectContaining({ runId: run, action: 'accept' })])
  expect(
    (
      await db.query(
        'select outcome from app_private.world_npc_terminal_receipts where battle_session_id=$1',
        [surrendered.session],
      )
    ).rows,
  ).toEqual([{ outcome: 'surrender' }])
})

it.each([
  ['exact 24 hours', { mode: 'rolling-24h' }, 24 * 60],
  [
    'calendar reset',
    { mode: 'calendar-day', timeZone: 'America/Port_of_Spain', resetMinute: 375 },
    5,
  ],
] as const)(
  'anchors %s to turn-in even if reward collection is delayed',
  async (_, recurrence, minutes) => {
    await publish(definition(recurrence))
    const run = await schedule()
    await read()
    await read(other)
    await interact(1, run, 'accept')
    const attempt = (
      await db.query<{ id: string }>('select id from app_private.event_repeatable_travel_attempts')
    ).rows[0]!.id
    for (let i = 0; i < 5; i++) await (await challenge()).finish()

    if (recurrence.mode === 'calendar-day') {
      // A projection processed for an earlier authoritative instant cannot
      // borrow a later terminal receipt, even though the receipt already exists.
      await db.exec(`update app_private.repeatable_clock_fixture set at=(
        select max(occurred_at)-interval '1 microsecond' from app_private.world_npc_terminal_receipts
      )`)
      expect(await read()).toEqual([expect.objectContaining({ defeats: 4, action: null })])
      const version = await currentVersion()
      await reject(() => interact(version, attempt, 'report'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
    }

    const completion = (
      await db.query<{ at: Date }>(
        `select ((date_trunc('day',clock_timestamp() at time zone 'America/Port_of_Spain') +
        interval '1 day 6 hours 10 minutes') at time zone 'America/Port_of_Spain') as at`,
      )
    ).rows[0]!.at
    const available = new Date(+completion + minutes * 60_000)
    await clock(completion)
    const reportVersion = await currentVersion()
    const reportCommand = crypto.randomUUID()
    await interact(reportVersion, attempt, 'report', reportCommand)
    await interact(reportVersion, attempt, 'report', reportCommand)
    expect(await read()).toEqual([
      expect.objectContaining({
        runId: attempt,
        progress: 'completed',
        rewardPending: true,
        action: 'claim-hunt-reward',
      }),
    ])
    expect((await db.query('select xp from public.characters where id=$1', [actor])).rows).toEqual([
      { xp: 0 },
    ])
    const afterReport = await currentVersion()
    await reject(() => interact(reportVersion, attempt, 'report'), 'WORLD_STALE_VERSION')
    await reject(() => interact(afterReport, attempt, 'report'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
    await reject(
      () => interact(1, attempt, 'claim-hunt-reward', null, other),
      'WORLD_QUEST_ACTION_UNAVAILABLE',
    )
    await clock(new Date(+available - 1))
    await reject(() => interact(afterReport, run, 'accept'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
    await clock(available)
    expect(await read()).toEqual([
      expect.objectContaining({ runId: attempt, rewardPending: true, action: 'claim-hunt-reward' }),
      expect.objectContaining({ runId: run, action: 'accept' }),
    ])
    await interact(afterReport, run, 'accept')

    // The completed attempt's claim remains available independently of a new
    // accepted attempt, after the event's schedule and giver publication end.
    await db.query("select public.write_master_npc_design_v1($1,null,$2,3,'retire-world',null)", [
      actor,
      giver,
    ])
    const delayed = new Date(+completion + 8 * 24 * 60 * 60_000)
    await clock(delayed)
    expect(
      (
        await db.query<{ view: unknown[] }>(
          'select app_private.read_world_repeatable_travel_v1($1,$1,$2,$3) view',
          [actor, position(3), delayed.toISOString()],
        )
      ).rows[0]?.view,
    ).toEqual([
      expect.objectContaining({
        runId: attempt,
        speaker: 'Alder Venn',
        rewardPending: true,
        destination: position(2),
        local: false,
        action: null,
      }),
    ])
    const claimVersion = await currentVersion()
    const claimCommand = crypto.randomUUID()
    await interact(claimVersion, attempt, 'claim-hunt-reward', claimCommand)
    await interact(claimVersion, attempt, 'claim-hunt-reward', claimCommand)
    await reject(() => interact(claimVersion, attempt, 'claim-hunt-reward'), 'WORLD_STALE_VERSION')
    await reject(
      () => interact(claimVersion + 1, attempt, 'claim-hunt-reward'),
      'WORLD_QUEST_ACTION_UNAVAILABLE',
    )
    expect(
      (
        await db.query(
          'select completed_at,next_available_at,awarded_xp from app_private.event_repeatable_travel_attempts where id=$1',
          [attempt],
        )
      ).rows,
    ).toEqual([{ completed_at: completion, next_available_at: available, awarded_xp: 25 }])
    expect(
      (
        await db.query(
          'select applied_amount from app_private.character_xp_grants where character_id=$1',
          [actor],
        )
      ).rows,
    ).toEqual([{ applied_amount: 25 }])
  },
)

it('rejects unapproved Hunt rewards, unknown givers and out-of-range defeat counts at publication', async () => {
  const draft = definition({ mode: 'rolling-24h' })
  await reject(
    () =>
      publish({
        ...draft,
        repeatableTravel: {
          ...draft.repeatableTravel,
          journey: {
            ...draft.repeatableTravel.journey,
            rewardPackageRef: 'reward.missing',
          },
        },
      }),
    'EVENT_REPEATABLE_HUNT_REWARD_UNAVAILABLE',
  )
  await reject(
    () =>
      publish({
        ...draft,
        repeatableTravel: {
          ...draft.repeatableTravel,
          journey: {
            ...draft.repeatableTravel.journey,
            giverId: wolf,
          },
        },
      }),
    'EVENT_REPEATABLE_HUNT_GIVER_UNAVAILABLE',
  )
  await reject(
    () =>
      publish({
        ...draft,
        repeatableTravel: {
          ...draft.repeatableTravel,
          journey: {
            ...draft.repeatableTravel.journey,
            requiredDefeats: 26,
          },
        },
      }),
    'EVENT_REPEATABLE_HUNT_INVALID',
  )
  expect(
    (
      await db.query(`select
    has_function_privilege('authenticated','public.commit_world_repeatable_travel_v1(uuid,uuid,bigint,uuid,uuid,text,text)','execute') as browser_commit,
    has_function_privilege('service_role','app_private.repeatable_hunt_progress_v1(app_private.event_repeatable_travel_attempts,app_private.event_run_repeatable_travel,app_private.event_runs,timestamptz)','execute') as service_progress
  `)
    ).rows,
  ).toEqual([{ browser_commit: false, service_progress: false }])
})

it('uses the receipt time for a calendar turn-in queued before a reset and pause', async () => {
  await publish(
    definition({ mode: 'calendar-day', timeZone: 'America/Port_of_Spain', resetMinute: 375 }),
  )
  const run = await schedule()
  await read()
  await interact(1, run, 'accept')
  const attempt = (
    await db.query<{ id: string }>('select id from app_private.event_repeatable_travel_attempts')
  ).rows[0]!.id
  for (let i = 0; i < 5; i++) await (await challenge()).finish()
  const received = (
    await db.query<{ at: Date }>(
      `select ((date_trunc('day',clock_timestamp() at time zone 'America/Port_of_Spain') +
        interval '1 day 6 hours 14 minutes 59 seconds') at time zone 'America/Port_of_Spain') as at`,
    )
  ).rows[0]!.at
  const reset = new Date(+received + 1000)
  const processed = new Date(+received + 2000)
  await db.query(
    "select * from public.operate_event_run_v2($1,null::uuid,$2,2,gen_random_uuid(),'pause','Hunt fixture',true)",
    [actor, run],
  )
  await db.query(
    "update app_private.event_run_transitions set occurred_at=$2 where run_id=$1 and to_status='paused'",
    [run, processed.toISOString()],
  )
  await db.exec(`
    create temporary table delayed_hunt_clock(received_at timestamptz,processed_at timestamptz);
    create temporary sequence delayed_hunt_clock_read;
    create or replace function app_private.repeatable_travel_now_v1()
    returns timestamptz language sql volatile set search_path = '' as $$
      select case when nextval('pg_temp.delayed_hunt_clock_read') = 1 then received_at else processed_at end
      from pg_temp.delayed_hunt_clock
    $$;`)
  await db.query('insert into pg_temp.delayed_hunt_clock values($1,$2)', [
    received.toISOString(),
    processed.toISOString(),
  ])

  await interact(await currentVersion(), attempt, 'report')
  expect(
    (
      await db.query(
        'select completed_at,next_available_at from app_private.event_repeatable_travel_attempts where id=$1',
        [attempt],
      )
    ).rows,
  ).toEqual([{ completed_at: received, next_available_at: reset }])
  expect(await read()).toEqual([
    expect.objectContaining({ runId: attempt, rewardPending: true, action: 'claim-hunt-reward' }),
  ])
})

it('samples the authoritative Hunt request clock before acquiring the character lock', async () => {
  const { rows } = await db.query<{ clock_before_lock: boolean }>(`select
    strpos(prosrc,'app_private.repeatable_travel_now_v1()') > 0
      and strpos(prosrc,'app_private.repeatable_travel_now_v1()') < strpos(prosrc,'pg_advisory_xact_lock') clock_before_lock
    from pg_proc where oid='public.commit_world_repeatable_activity_v2(uuid,uuid,bigint,uuid,uuid,text,text,timestamptz)'::regprocedure`)
  expect(rows).toEqual([{ clock_before_lock: true }])
})

it('requires a published Hunt encounter and keeps Hunt scope global', async () => {
  const distant = '77777777-7777-4777-8777-777777777774'
  await db.query("select public.write_master_npc_design_v1($1,null,$2,0,'save',$3)", [
    actor,
    distant,
    {
      name: 'Crown wolf',
      portraitRef: null,
      uses: ['world'],
      arena: null,
      world: {
        sectorId: 'aureth-crown',
        x: 3,
        y: 4,
        radius: 2,
        greeting: 'A wild encounter.',
        encounter: { arenaId: 'duel-yard', aiDifficulty: 'standard', tags: ['crown-wolf'] },
      },
    },
  ])
  const draft = definition({ mode: 'rolling-24h' })
  const tag = (npcTag: string) => ({
    ...draft,
    repeatableTravel: {
      ...draft.repeatableTravel,
      journey: { ...draft.repeatableTravel.journey, npcTag },
    },
  })
  const global = tag('crown-wolf')
  await reject(() => publish(global), 'EVENT_REPEATABLE_HUNT_TARGET_UNAVAILABLE')
  await db.query("select public.write_master_npc_design_v1($1,null,$2,1,'commit-world',null)", [
    actor,
    distant,
  ])
  await reject(
    () => publish({ ...global, scope: { type: 'region', key: 'aureth-crown' } }),
    'EVENT_REPEATABLE_HUNT_INVALID',
  )
  await publish(global)
  await db.query("select public.write_master_npc_design_v1($1,null,$2,2,'retire-world',null)", [
    actor,
    distant,
  ])
  await reject(() => schedule(), 'EVENT_REPEATABLE_HUNT_TARGET_UNAVAILABLE')
})

it.each([true, false])(
  'protects an admission across expiry and rolls over only when its outcome permits it (victory %s)',
  async (wins) => {
    const draft = definition({ mode: 'rolling-24h' })
    draft.repeatableTravel.journey.requiredDefeats = 1
    await publish(draft)
    const run = await schedule()
    await read()
    await interact(1, run, 'accept')
    const attempt = (
      await db.query<{ id: string }>('select id from app_private.event_repeatable_travel_attempts')
    ).rows[0]!.id
    const admittedBeforeExpiry = await challenge()
    await db.query(
      'update app_private.event_runs set scheduled_end_at=clock_timestamp() where id=$1',
      [run],
    )
    const successor = await schedule()
    const version = await currentVersion()
    await reject(() => interact(version, successor, 'accept'), 'WORLD_ACTIVE_BATTLE')

    await admittedBeforeExpiry.finish(!wins)
    if (wins) {
      expect(await read()).toEqual([
        expect.objectContaining({
          runId: attempt,
          defeats: 1,
          progress: 'ready',
          action: 'report',
        }),
      ])
      await reject(() => interact(version, successor, 'accept'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
      await interact(version, attempt, 'report')
      expect(await read()).toEqual([
        expect.objectContaining({
          runId: attempt,
          rewardPending: true,
          action: 'claim-hunt-reward',
        }),
      ])
      await reject(
        () => interact(version + 1, successor, 'accept'),
        'WORLD_QUEST_ACTION_UNAVAILABLE',
      )
      await interact(version + 1, attempt, 'claim-hunt-reward')
      expect(await read()).toEqual([
        expect.objectContaining({ runId: attempt, awardedXp: 25, action: null }),
      ])
    } else {
      expect(await read()).toEqual([
        expect.objectContaining({ runId: successor, action: 'accept' }),
      ])
      await interact(version, successor, 'accept')
      expect(await read()).toEqual([expect.objectContaining({ defeats: 0, action: null })])
    }
  },
)

it('uses the trusted World receipt when the database processes a Hunt after reset', async () => {
  const draft = definition({
    mode: 'calendar-day',
    timeZone: 'America/Port_of_Spain',
    resetMinute: 375,
  })
  draft.repeatableTravel.journey.requiredDefeats = 1
  await publish(draft)
  const run = await schedule()
  await read()
  await interact(1, run, 'accept')
  const attempt = (
    await db.query<{ id: string }>('select id from app_private.event_repeatable_travel_attempts')
  ).rows[0]!.id
  await (await challenge()).finish()
  const received = (
    await db.query<{ at: Date }>(
      `select ((date_trunc('day',clock_timestamp() at time zone 'America/Port_of_Spain') +
        interval '1 day 6 hours 14 minutes 59 seconds') at time zone 'America/Port_of_Spain') as at`,
    )
  ).rows[0]!.at
  const reset = new Date(+received + 1000)
  await clock(new Date(+received + 2000))

  await db.query(
    "select public.commit_world_repeatable_activity_v2($1,$1,$2,gen_random_uuid(),$3,'report',$4,$5)",
    [actor, await currentVersion(), attempt, `repeat:${attempt}:report`, received.toISOString()],
  )
  expect(
    (
      await db.query(
        'select completed_at,next_available_at from app_private.event_repeatable_travel_attempts where id=$1',
        [attempt],
      )
    ).rows,
  ).toEqual([{ completed_at: received, next_available_at: reset }])
  expect(
    (
      await db.query(
        `select role,has_function_privilege(role,
      'public.commit_world_repeatable_activity_v2(uuid,uuid,bigint,uuid,uuid,text,text,timestamptz)','execute') can_execute
      from unnest(array['anon','authenticated','service_role']) role`,
      )
    ).rows,
  ).toEqual([
    { role: 'anon', can_execute: false },
    { role: 'authenticated', can_execute: false },
    { role: 'service_role', can_execute: true },
  ])
})
