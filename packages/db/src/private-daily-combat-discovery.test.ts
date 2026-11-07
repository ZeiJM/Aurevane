import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import { createCombatEncounterState, executeCombatAction } from '../../game-core/src/combat/actions'
import { createPendingBattle, startBattle } from '../../game-core/src/combat/battle-state'
import { createTacticalBattleState } from '../../game-core/src/combat/board'
import {
  createPv1fTemporaryResources,
  PV1F_COMBAT_CONTENT,
} from '../../game-core/src/combat/pv1f-action-economy'
import { surrenderPvpCombatant } from '../../game-core/src/combat/pvp-quality'
import { createStatDrivenCombatEncounterState } from '../../game-core/src/combat/stat-driven-combat'

const actor = '11111111-1111-4111-8111-111111111111'
const other = '99999999-9999-4999-8999-999999999999'
const eventKey = 'event.fixture-ashen-sentinel'
const raider = '77777777-7777-4777-8777-777777777772'
const boar = '77777777-7777-4777-8777-777777777773'
const avenger = '77777777-7777-4777-8777-777777777774'
const position = (x: number) => ({ sectorId: 'verdant-expanse', x, y: 4 })
const initial = { version: 1, position: position(2), route: [], nextStepAt: null }
const definition = (patch: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  eventKey,
  templateKey: 'template.ashen-sentinel',
  contentVersion: 1,
  title: 'The Ashen Sentinel',
  summary: 'Disposable daily combat discovery.',
  internalNotes: '',
  family: 'lore-revelation',
  category: 'hidden-discoveries',
  scope: { type: 'global' },
  combatDiscovery: {
    npcTag: 'ashbound-raider',
    requiredDefeats: 14,
    timeZone: 'UTC',
    resetMinute: 0,
    opponentNpcId: avenger,
    mode: 'evergreen',
    ready: 'The Sentinel waits at the old watchtower.',
    completed: 'The ashbound oath has been broken.',
    firstRewardPackageRef: 'reward.avenger-first',
    repeatRewardPackageRef: 'reward.avenger-repeat',
    ...patch,
  },
  phases: [
    {
      id: 'challenge',
      name: 'Challenge',
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
  // Test-only civil clock for canonical terminal inserts. The actual World
  // reads and ticket procedures still run at their normal server time.
  await db.exec(`
    create function app_private.shift_discovery_fixture_terminal() returns trigger language plpgsql as $$
    begin
      new.occurred_at := new.occurred_at - interval '1 day' *
        coalesce(nullif(current_setting('aurevane.fixture_days_ago',true),'')::integer,0);
      return new;
    end;
    $$;
    create trigger shift_discovery_fixture_terminal before insert on app_private.world_npc_terminal_receipts
    for each row execute function app_private.shift_discovery_fixture_terminal();
  `)
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
    "insert into app_private.event_reward_budget_policies values('budget.avenger-fixture','character-xp',100,$1,now())",
    [actor],
  )
  await db.query(
    `insert into app_private.event_reward_packages(reward_package_ref,package_version,reward_kind,amount,published_by,budget_ref)
    values('reward.avenger-first',1,'character-xp',25,$1,'budget.avenger-fixture'),
      ('reward.avenger-repeat',1,'character-xp',5,$1,'budget.avenger-fixture')`,
    [actor],
  )
  for (const [npc, name, tags, x] of [
    [raider, 'Ashbound Raider', ['ashbound-raider'], 3],
    [boar, 'World boar', ['boar'], 4],
    [avenger, 'Ashen Sentinel', [], 2],
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
          greeting: 'A World encounter.',
          encounter: { arenaId: 'duel-yard', aiDifficulty: 'standard', tags },
        },
      },
    ])
    await db.query("select public.write_master_npc_design_v1($1,null,$2,1,'commit-world',null)", [
      actor,
      npc,
    ])
  }
}, 60_000)
beforeEach(async () => db.exec('begin'))
afterEach(async () => db.exec('rollback'))
afterAll(async () => db?.close())

const publish = (body: object) =>
  db.query(
    'select * from public.publish_event_definition_v2($1,null::uuid,$2,$3::jsonb,null,gen_random_uuid(),null,true)',
    [actor, eventKey, body],
  )

const schedule = async (daysAgo = 0) => {
  const { rows } = await db.query<{ run_id: string }>(
    `select * from public.schedule_event_run_v2($1,null::uuid,$2,gen_random_uuid(),'schedule:avenger',
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
  if (daysAgo) {
    await db.query(
      `update app_private.event_runs
        set started_at=started_at-$2::integer*interval '1 day',
        scheduled_start_at=scheduled_start_at-$2::integer*interval '1 day' where id=$1`,
      [runId, daysAgo],
    )
    await db.query(
      "update app_private.event_run_transitions set occurred_at=occurred_at-$2::integer*interval '1 day' where run_id=$1",
      [runId, daysAgo],
    )
  }
  return runId
}

interface TicketProjection {
  runId: string
  action: string | null
  avenger: boolean
  rewardPending?: boolean
}

const read = async (character = actor) =>
  (
    await db.query<{ view: { personalQuests: TicketProjection[] } }>(
      'select public.read_world_state_v1($1,$1,$2) view',
      [character, initial],
    )
  ).rows[0]!.view.personalQuests.filter((row) => row.avenger)

const reject = async (action: () => Promise<unknown>, code: string) => {
  await db.exec('savepoint expected_denial')
  await expect(action()).rejects.toThrow(code)
  await db.exec('rollback to savepoint expected_denial')
}

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
  npc = raider,
  ticket,
  command = crypto.randomUUID(),
  character = actor,
  practice = false,
  playerActs = true,
  daysAgo = 0,
}: {
  npc?: string
  ticket?: string
  command?: string
  character?: string
  practice?: boolean
  playerActs?: boolean
  daysAgo?: number
} = {}) {
  const user = character
  const version = await currentVersion(character)
  const battleId = `avenger-fixture-${crypto.randomUUID()}`
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
      provenance: { kind: 'scenario', sourceId: 'scenario:avenger-test', sourceRulesVersion: 1 },
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
        ticket
          ? 'select * from public.start_world_avenger_battle_v1($1,$1,$2,$8,$3,$4,$5,$4,1,1,$6,$7,null,null,null,$9)'
          : 'select * from public.start_world_npc_battle_v1($1,$1,$2,$8,$3,$4,$5,$4,1,1,$6,$7,null,null,null)',
        [
          user,
          version,
          npc,
          battleId,
          `canonical:${battleId}`,
          snapshot,
          participants,
          command,
          ...(ticket ? [ticket] : []),
        ],
      )
  const session = response.rows[0]!.battle_session_id
  if (daysAgo) {
    await db.query(
      "update app_private.world_npc_battles set admitted_at=admitted_at-$2::integer*interval '1 day' where battle_session_id=$1",
      [session, daysAgo],
    )
  }
  const terminalCommand = crypto.randomUUID()
  const commitBattle = (
    result: { state: object; events: readonly unknown[] },
    version: number,
    command: string,
  ) =>
    db.query(
      "select * from public.commit_battle_intent_v3($1::text,$2,'fixture:avenger-terminal',$1::uuid,$3,$4,$5,$6,null)",
      [user, command, session, version, { ...result.state, ...authority }, result.events],
    )
  return {
    session,
    command,
    fingerprint: battleId,
    finish: async (surrender = false) => {
      if (daysAgo)
        await db.query("select set_config('aurevane.fixture_days_ago',$1,true)", [String(daysAgo)])
      const result = await commitBattle(
        surrender ? surrenderPvpCombatant(state, opponent) : victory,
        1,
        terminalCommand,
      )
      if (daysAgo) await db.query("select set_config('aurevane.fixture_days_ago','0',true)")
      return result
    },
  }
}

it('creates one private ticket at the fourteenth distinct qualified World victory', async () => {
  await publish(definition())
  await schedule()
  expect(await read()).toEqual([])
  await read(other)
  await (await challenge({ character: other })).finish()
  await (await challenge({ npc: boar })).finish()
  await (await challenge({ practice: true })).finish()
  await (await challenge()).finish(true)
  await (await challenge({ playerActs: false })).finish()
  for (let count = 0; count < 13; count++) await (await challenge()).finish()
  expect(await read()).toEqual([])
  const qualifying = await challenge()
  await qualifying.finish()
  await qualifying.finish()
  const ready = await read()
  expect(ready).toEqual([
    expect.objectContaining({
      title: 'The Ashen Sentinel',
      action: 'challenge-avenger',
      giverId: avenger,
      local: true,
    }),
  ])
  await (await challenge()).finish()
  expect(await read()).toEqual(ready)
  expect(await read(other)).toEqual([])
})

const claim = async (
  ticket: string,
  command = crypto.randomUUID(),
  fingerprint = `fixture:claim:${ticket}`,
  version?: number,
  character = actor,
) =>
  db.query('select public.claim_world_avenger_reward_v1($1,$1,$2,$3,$4,$5)', [
    character,
    version ?? (await currentVersion(character)),
    command,
    ticket,
    fingerprint,
  ])

const characterXp = async () =>
  Number(
    (await db.query<{ xp: string }>('select xp from public.characters where id=$1', [actor]))
      .rows[0]!.xp,
  )

const preview = async (ticket: string) =>
  (
    await db.query<{ encounter: object }>(
      'select public.read_world_avenger_battle_v1($1,$1,$2,$3) encounter',
      [actor, await currentVersion(), ticket],
    )
  ).rows[0]!.encounter

const replay = async (ticket: string, fight: { command: string; fingerprint: string }) =>
  (
    await db.query<{ session: string | null }>(
      'select public.read_world_avenger_battle_replay_v1($1,$1,$2,$3,$4) session',
      [actor, ticket, fight.command, fight.fingerprint],
    )
  ).rows[0]!.session

const setPosition = (x: number) =>
  db.query(
    "update app_private.character_world_state set state=jsonb_set(state,'{position}',$2) where character_id=$1",
    [actor, position(x)],
  )

it('keeps the private battle ticket separate from an ordinary fight and claims first and repeat XP once', async () => {
  await publish(definition({ requiredDefeats: 1 }))
  await schedule(3)
  await read()
  await (await challenge({ daysAgo: 2 })).finish()
  const [first] = await read()
  expect(first).toMatchObject({ action: 'challenge-avenger', progress: 'ready' })
  expect(await preview(first!.runId)).toMatchObject({
    id: avenger,
    name: 'Ashen Sentinel',
    placement: position(2),
  })

  const ordinary = await challenge({ npc: avenger })
  await ordinary.finish()
  expect(await read()).toEqual([first])
  await reject(() => replay(first!.runId, ordinary), 'WORLD_COMMAND_CONFLICT')
  await reject(
    () => challenge({ npc: raider, ticket: first!.runId }),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )

  // The previous day's threshold still owns the slot when the next day
  // qualifies. A later resolution must not reinstate the suppressed day.
  await (await challenge({ daysAgo: 1 })).finish()
  expect(await read()).toEqual([first])

  await db.query(
    "update app_private.npc_designs set world=jsonb_set(world,'{greeting}',to_jsonb('A new greeting.'::text)) where id=$1",
    [avenger],
  )
  expect(await read()).toEqual([first])
  const fight = await challenge({ npc: avenger, ticket: first!.runId, daysAgo: 1 })
  expect(await read()).toMatchObject([{ progress: 'active', action: null }])
  await fight.finish()
  expect(await replay(first!.runId, fight)).toEqual(fight.session)
  expect(await read()).toMatchObject([
    { progress: 'completed', action: 'claim-avenger-reward', rewardPending: true },
  ])
  expect(await characterXp()).toEqual(0)
  await read(other)
  await reject(
    () => claim(first!.runId, undefined, undefined, undefined, other),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  await setPosition(7)
  expect(await read()).toMatchObject([
    { local: false, action: null, rewardPending: true, destination: position(2) },
  ])
  await reject(() => claim(first!.runId), 'WORLD_NPC_CHALLENGE_OUT_OF_RANGE')
  await setPosition(2)
  const command = crypto.randomUUID()
  const version = await currentVersion()
  await claim(first!.runId, command)
  await claim(first!.runId, command, undefined, version)
  await reject(() => claim(first!.runId, command, 'altered'), 'WORLD_COMMAND_CONFLICT')
  await reject(() => claim(first!.runId), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  expect(await characterXp()).toEqual(25)
  expect(await read()).toMatchObject([{ awardedXp: 25, rewardPending: false, action: null }])

  await (await challenge({ daysAgo: 1 })).finish()
  expect(await read()).toMatchObject([{ runId: first!.runId, awardedXp: 25 }])

  await (await challenge()).finish()
  const repeat = (await read()).find((row) => row.runId !== first!.runId)!
  expect(repeat).toMatchObject({ progress: 'ready', action: 'challenge-avenger' })
  await (await challenge({ npc: avenger, ticket: repeat.runId })).finish()
  await claim(repeat.runId)
  expect(await characterXp()).toEqual(30)
  await (await challenge()).finish()
  expect(await read()).toMatchObject([{ runId: repeat.runId, awardedXp: 5, rewardPending: false }])
})

const expire = (runId: string) =>
  db.query(
    "update app_private.event_runs set scheduled_end_at=clock_timestamp()-interval '1 microsecond' where id=$1",
    [runId],
  )

it('recovers an evergreen threshold after a reset and closure with no earlier World read', async () => {
  await publish(definition())
  const run = await schedule(3)
  await read()
  for (let count = 0; count < 14; count++) await (await challenge({ daysAgo: 2 })).finish()

  // The threshold itself was private and durable while the player was away.
  // The following day is suppressed even before the first ticket projection.
  for (let count = 0; count < 14; count++) await (await challenge({ daysAgo: 1 })).finish()
  await expire(run)
  const [ticket] = await read()
  expect(ticket).toMatchObject({ progress: 'ready', action: 'challenge-avenger' })
  await (await challenge({ npc: avenger, ticket: ticket!.runId })).finish()
  expect(await read()).toMatchObject([{ runId: ticket!.runId, progress: 'completed' }])
  await claim(ticket!.runId)
  expect(await read()).toMatchObject([{ runId: ticket!.runId, awardedXp: 25 }])
  expect(await characterXp()).toEqual(25)
})

it('expires an unstarted seasonal ticket and preserves an admitted seasonal win through closure and retirement', async () => {
  await publish(definition({ requiredDefeats: 1, mode: 'seasonal' }))
  const run = await schedule()
  await read()
  await read(other)
  await (await challenge()).finish()
  await (await challenge({ character: other })).finish()
  const [owned] = await read()
  const [unstarted] = await read(other)
  const admitted = await challenge({ npc: avenger, ticket: owned!.runId })
  await expire(run)
  expect(await read(other)).toEqual([])
  await reject(
    async () =>
      db.query('select public.read_world_avenger_battle_v1($1,$1,$2,$3)', [
        other,
        await currentVersion(other),
        unstarted!.runId,
      ]),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  await admitted.finish()
  await db.query('update app_private.npc_designs set world=null where id=$1', [avenger])
  expect(await read()).toMatchObject([
    {
      runId: owned!.runId,
      progress: 'completed',
      local: true,
      action: 'claim-avenger-reward',
      rewardPending: true,
      destination: position(2),
    },
  ])
  expect(await replay(owned!.runId, admitted)).toEqual(admitted.session)
  await claim(owned!.runId)
  expect(await characterXp()).toEqual(25)
  // Account and character deletion already remove battle sessions first.
  await db.query('delete from app_private.battle_sessions where id=$1', [admitted.session])
})

it('ignores canonical wins admitted before the occurrence or while paused and closes a lost ticket for the day', async () => {
  await publish(definition({ requiredDefeats: 1 }))
  await read()
  await (await challenge()).finish()
  const run = await schedule()
  expect(await read()).toEqual([])
  const operate = (version: number, command: string) =>
    db.query(
      'select * from public.operate_event_run_v2($1,null::uuid,$2,$3,gen_random_uuid(),$4,$5,true)',
      [actor, run, version, command, 'Fixture occurrence operation'],
    )
  await operate(2, 'pause')
  await (await challenge()).finish()
  await operate(3, 'resume')
  expect(await read()).toEqual([])
  await (await challenge()).finish()
  const [ticket] = await read()
  const lost = await challenge({ npc: avenger, ticket: ticket!.runId, playerActs: false })
  await lost.finish()
  expect(await replay(ticket!.runId, lost)).toEqual(lost.session)
  expect(await read()).toEqual([])
  await reject(() => claim(ticket!.runId), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  await (await challenge()).finish()
  expect(await read()).toEqual([])
  expect(await characterXp()).toEqual(0)
})

it('rejects invalid publication and keeps ticket RPCs service-only', async () => {
  await reject(() => publish(definition({ requiredDefeats: 0 })), 'EVENT_COMBAT_DISCOVERY_INVALID')
  await reject(
    () => publish(definition({ timeZone: 'nonsense/Aurevane' })),
    'EVENT_COMBAT_DISCOVERY_INVALID',
  )
  await reject(
    () => publish(definition({ npcTag: 'missing-tag' })),
    'EVENT_COMBAT_DISCOVERY_TARGET_UNAVAILABLE',
  )
  await reject(
    () => publish(definition({ opponentNpcId: raider })),
    'EVENT_COMBAT_DISCOVERY_OPPONENT_UNAVAILABLE',
  )
  await reject(
    () => publish(definition({ repeatRewardPackageRef: 'reward.unapproved' })),
    'EVENT_COMBAT_DISCOVERY_REWARD_UNAVAILABLE',
  )
  await publish(definition({ mode: 'seasonal' }))
  await reject(
    () =>
      db.query(
        `select * from public.schedule_event_run_v2($1,null::uuid,$2,gen_random_uuid(),'schedule:no-end',
        clock_timestamp()+interval '1 minute',null,null,true)`,
        [actor, eventKey],
      ),
    'EVENT_COMBAT_DISCOVERY_SEASON_END_REQUIRED',
  )
  const { rows } = await db.query<{ service: boolean; authenticated: boolean; anon: boolean }>(
    `select has_function_privilege('service_role',fn.oid,'execute') service,
      has_function_privilege('authenticated',fn.oid,'execute') authenticated,
      has_function_privilege('anon',fn.oid,'execute') anon
    from pg_proc fn join pg_namespace ns on ns.oid=fn.pronamespace
    where ns.nspname='public' and fn.proname in (
      'read_world_avenger_battle_v1','read_world_avenger_battle_replay_v1',
      'start_world_avenger_battle_v1','claim_world_avenger_reward_v1'
    )`,
  )
  expect(rows).toEqual(Array(4).fill({ service: true, authenticated: false, anon: false }))
})
