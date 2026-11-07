import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
} from '../../game-core/src/combat/actions'
import { createTacticalBattleState } from '../../game-core/src/combat/board'
import { applyCurrentPoisonState } from '../../game-core/src/combat/combat-dots'
import { spawnCombatSummon } from '../../game-core/src/combat/combat-summons'
import {
  PV1F_COMBAT_CONTENT,
  createPv1fTemporaryResources,
  finishPv1fTurn,
} from '../../game-core/src/combat/pv1f-action-economy'
import {
  createCurrentStatDrivenCombatEncounterState,
  createStatDrivenCombatEncounterState,
  reattachStatDrivenCombatBridge,
} from '../../game-core/src/combat/stat-driven-combat'
import { VESPER_SUMMON_PROFILE } from '../../game-core/src/combat/universal-support'
import {
  prepareAiQualityCombatant,
  surrenderPvpCombatant,
  timeoutAiTurn,
} from '../../game-core/src/combat/pvp-quality'
import {
  createPendingBattle,
  defeatCurrentCombatant,
  endTurn,
  selectFinalFacing,
  startBattle,
} from '../../game-core/src/combat/battle-state'

const owner = '11111111-1111-4111-8111-111111111111'
const other = '99999999-9999-4999-8999-999999999999'
const npc = '77777777-7777-4777-8777-777777777777'
const command = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const position = { sectorId: 'verdant-expanse', x: 2, y: 4 }
const world = { ...position, radius: 2, greeting: 'The challenger is waiting.' }
const encounter = { arenaId: 'duel-yard', aiDifficulty: 'standard', tags: ['wolf'] }
let db: PGlite
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  for (const [id, name] of [
    [owner, 'World player'],
    [other, 'Other player'],
  ]) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      id,
      `${id}@example.test`,
    ])
    await db.query(
      `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,
      presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,
      might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
      values($1,$1,0,1,$2,$2,'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
      [id, name],
    )
  }
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [owner],
  )
  for (const [id, spawn] of [
    [owner, position],
    [other, { ...position, x: 11 }],
  ]) {
    await db.query('select public.read_world_state_v1($1,$1,$2)', [
      id,
      { version: 1, position: spawn, route: [], nextStepAt: null, discoveries: {} },
    ])
  }
}, 60_000)
beforeEach(async () => db.exec('begin'))
afterEach(async () => db.exec('rollback'))
afterAll(async () => db.close())

async function rejected(run: () => Promise<unknown>, message: string) {
  await db.exec('savepoint expected_world_rejection')
  try {
    await expect(run()).rejects.toThrow(message)
  } finally {
    await db.exec(
      'rollback to savepoint expected_world_rejection; release savepoint expected_world_rejection',
    )
  }
}

it('admits one World-only published NPC and captures provenance for the exact replay', async () => {
  const save = (revision: number, placement: unknown) =>
    db.query("select public.write_master_npc_design_v1($1,null,$2,$3,'save',$4)", [
      owner,
      npc,
      revision,
      { name: 'Field opponent', portraitRef: null, uses: ['world'], arena: null, world: placement },
    ])
  const publish = (revision: number, kind = 'commit-world') =>
    db.query('select public.write_master_npc_design_v1($1,null,$2,$3,$4,null)', [
      owner,
      npc,
      revision,
      kind,
    ])
  const prepare = (actor: string, character = actor, version = 1) =>
    db.query<{ opponent: object }>('select public.read_world_npc_battle_v1($1,$2,$3,$4) opponent', [
      actor,
      character,
      npc,
      version,
    ])
  expect(
    (
      await db.query(`select
    has_function_privilege('authenticated','public.read_world_npc_battle_v1(uuid,uuid,uuid,bigint)','execute') as browser,
    has_table_privilege('service_role','app_private.world_npc_battles','insert,update,delete') as writes`)
    ).rows,
  ).toEqual([{ browser: false, writes: false }])
  await save(0, world)
  await publish(1)
  await rejected(() => prepare(owner), 'WORLD_NPC_CHALLENGE_UNAVAILABLE')
  await rejected(
    () => save(2, { ...world, encounter: { ...encounter, tags: ['wolf', 'wolf'] } }),
    'NPC_DESIGN_INVALID',
  )
  await save(2, { ...world, encounter })
  await rejected(() => prepare(owner), 'WORLD_NPC_CHALLENGE_UNAVAILABLE')
  await publish(3)
  await rejected(() => prepare(other), 'WORLD_NPC_CHALLENGE_OUT_OF_RANGE')
  await rejected(() => prepare(other, owner), 'WORLD_NOT_OWNED')
  await rejected(() => prepare(owner, owner, 2), 'WORLD_STALE_VERSION')
  const { rows } = await prepare(owner)
  expect(rows[0]?.opponent).toMatchObject({
    id: npc,
    revision: 4,
    arenaId: 'duel-yard',
    aiDifficulty: 'standard',
  })
  expect(rows[0]?.opponent).not.toHaveProperty('tags')
  const player = {
    id: `character:${owner}`,
    teamId: 'players',
    initiative: 2,
    baseMovementBudget: 2,
    hp: 10,
    maxHp: 10,
    mp: 0,
    maxMp: 0,
  }
  const opponent = { ...player, id: 'recruit:fixture', teamId: 'opponents', initiative: 1 }
  const battle = startBattle(
    createPendingBattle({
      battleId: 'fixture-world-npc',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 100,
      combatants: [player, opponent],
    }),
  ).state
  const capture = (
    await db.query<{ capture: object }>(
      `select public.get_character_committed_build_snapshot_v2($1,$1) || jsonb_build_object('sourceHash',app_private.player_source_hash_v1($1)) capture`,
      [owner],
    )
  ).rows[0]!.capture
  const snapshot = {
    tactical: { battle },
    arenaNpc: { id: npc, revision: 4, name: 'Field opponent', portraitRef: null },
    worldBattleOrigin: 'npc',
    buildAuthority: { combatants: [{ ...capture, characterId: owner, combatantId: player.id }] },
  }
  const participants = [
    { combatant_id: player.id, participant_role: 'player', character_id: owner },
    { combatant_id: opponent.id, participant_role: 'opponent', character_id: null },
  ]
  const admit = (fingerprint = 'fixture:world') =>
    db.query<{ battle_session_id: string; replayed: boolean }>(
      "select * from public.start_world_npc_battle_v1($1,$1,1,$2,$3,$4,$5,'fixture-world-npc',1,1,$6,$7,null,null,null)",
      [owner, command, npc, fingerprint, 'fixture:canonical-battle', snapshot, participants],
    )
  const created = (await admit()).rows[0]!
  expect(created.replayed).toBe(false)
  const actual = await db.query(
    'select character_id,npc_id,npc_revision,opponent_combatant_id,placement,tags,template from app_private.world_npc_battles where battle_session_id=$1',
    [created.battle_session_id],
  )
  expect(actual.rows).toEqual([
    {
      character_id: owner,
      npc_id: npc,
      npc_revision: 4,
      opponent_combatant_id: opponent.id,
      placement: position,
      tags: ['wolf'],
      template: { arenaId: 'duel-yard', aiDifficulty: 'standard' },
    },
  ])
  await rejected(() => admit('fixture:forged'), 'WORLD_COMMAND_CONFLICT')
  await publish(4, 'retire-world')
  expect((await admit()).rows[0]).toEqual(
    expect.objectContaining({ battle_session_id: created.battle_session_id, replayed: true }),
  )
  const enemyTurn = endTurn(selectFinalFacing(battle, 'east').state).state
  const victory = defeatCurrentCombatant(enemyTurn, opponent.id)
  const result = await db.query<{ battle_version: number }>(
    'select * from public.commit_battle_intent_v3($1::text,gen_random_uuid(),$2,$1::uuid,$3,1,$4,$5,null)',
    [
      owner,
      'fixture:world-victory',
      created.battle_session_id,
      { ...snapshot, tactical: { battle: victory.state } },
      victory.events,
    ],
  )
  expect(result.rows[0]?.battle_version).toBe(2)
  expect(
    (
      await db.query('select event from app_private.battle_events where battle_session_id=$1', [
        created.battle_session_id,
      ])
    ).rows,
  ).toContainEqual({ event: { event: 'battle_completed', winningTeamId: 'players' } })
  expect(
    (await db.query('select count(*)::integer total from app_private.event_contributions')).rows,
  ).toEqual([{ total: 0 }])
  await rejected(
    () =>
      db.query('select * from public.claim_discipline_trial_v1($1,$2)', [
        owner,
        created.battle_session_id,
      ]),
    'MASTERY_TRIAL_REQUIRED',
  )
  const current = await db.query<{ version: number }>(
    "select (state->>'version')::integer version from app_private.character_world_state where character_id=$1",
    [owner],
  )
  await rejected(
    () => prepare(owner, owner, current.rows[0]!.version),
    'WORLD_NPC_CHALLENGE_UNAVAILABLE',
  )
})

const combatant = { player: `character:${owner}`, opponent: 'world:fixture' }
async function admitEvidenceFixture(linked = true, playerActs = true, atStartup = false) {
  const id = linked ? 'fixture-world-evidence' : 'fixture-practice-evidence'
  if (linked) {
    await db.query("select public.write_master_npc_design_v1($1,null,$2,0,'save',$3)", [
      owner,
      npc,
      {
        name: 'Field opponent',
        portraitRef: null,
        uses: ['world'],
        arena: null,
        world: { ...world, encounter },
      },
    ])
    await db.query("select public.write_master_npc_design_v1($1,null,$2,1,'commit-world',null)", [
      owner,
      npc,
    ])
  }
  const combatants = [combatant.player, combatant.opponent].map((id, index) => ({
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
    createPendingBattle({
      battleId: id,
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 100,
      combatants,
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 3,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: [0, 1, 2].map((x) => ({ position: { x, y: 0 }, elevation: 0, terrainId: 'open' })),
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
      provenance: { kind: 'scenario', sourceId: 'scenario:world-test', sourceRulesVersion: 1 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 1,
    })),
  )
  const capture = (
    await db.query<{ capture: object }>(
      `select public.get_character_committed_build_snapshot_v2($1,$1) || jsonb_build_object('sourceHash',app_private.player_source_hash_v1($1)) capture`,
      [owner],
    )
  ).rows[0]!.capture
  const authority = {
    ...(linked
      ? {
          worldBattleOrigin: 'npc',
          arenaNpc: { id: npc, revision: 2, name: 'Field opponent', portraitRef: null },
        }
      : {}),
    buildAuthority: {
      combatants: [{ ...capture, characterId: owner, combatantId: combatant.player }],
    },
  }
  const snapshot = { ...state, ...authority }
  const startup = atStartup ? lethalStrike(state, combatant.opponent) : null
  const participants = [
    { combatant_id: combatant.player, participant_role: 'player', character_id: owner },
    { combatant_id: combatant.opponent, participant_role: 'opponent', character_id: null },
  ]
  const response = linked
    ? await db.query<{ battle_session_id: string }>(
        'select * from public.start_world_npc_battle_v1($1,$1,1,$2,$3,$4,$5,$6,1,1,$7,$8,$9,$10,$11)',
        [
          owner,
          command,
          npc,
          'world:fingerprint',
          'battle:fingerprint',
          id,
          startup ? { ...startup.state, ...authority } : snapshot,
          participants,
          startup ? snapshot : null,
          startup?.events ?? null,
          startup
            ? {
                schemaVersion: 1,
                commandVisibility: { kind: 'public' },
                eventVisibilityOverrides: [],
              }
            : null,
        ],
      )
    : await db.query<{ battle_session_id: string }>(
        'select * from public.create_battle_session_v1($1::text,$2,$3,$1::uuid,$4,1,1,$5,$6)',
        [owner, command, 'practice:fingerprint', id, snapshot, participants],
      )
  const session = response.rows[0]!.battle_session_id
  return {
    session,
    state,
    snapshot,
    commit: (
      result: { state: object; events: readonly unknown[] },
      actor = owner,
      expectedVersion = 1,
      requestKey = other,
    ) =>
      db.query<{ battle_version: number; replayed: boolean }>(
        'select * from public.commit_battle_intent_v3($1::text,$2,$3,$1::uuid,$4,$5,$6,$7,null)',
        [
          actor,
          requestKey,
          'evidence:terminal',
          session,
          expectedVersion,
          { ...result.state, ...authority },
          result.events,
        ],
      ),
  }
}

function lethalStrike(
  state: ReturnType<typeof createStatDrivenCombatEncounterState>,
  target: string,
  all = false,
) {
  return executeCombatAction(
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
      effects: all
        ? [{ type: 'damage', recipient: 'affected-units', target: 'all', amount: 15 }]
        : [{ type: 'damage', recipient: 'primary-unit', amount: 15 }],
    },
    { kind: 'unit', combatantId: target },
    PV1F_COMBAT_CONTENT,
  )
}

async function terminal(session: string) {
  return (
    await db.query(
      'select outcome,battle_version from app_private.world_npc_terminal_receipts where battle_session_id=$1',
      [session],
    )
  ).rows
}

async function defeats(session: string) {
  return (
    await db.query(
      `select evidence.opponent_combatant_id,damage.event->>'event' as event,
        damage.battle_version,damage.created_at=evidence.occurred_at as committed_at
      from app_private.world_npc_defeat_evidence evidence
      join app_private.battle_events damage on damage.event_id=evidence.damage_event_id
      where evidence.battle_session_id=$1 and damage.battle_session_id=$1`,
      [session],
    )
  ).rows
}

it('records one exact knockout receipt from a real bound World victory and its exact replay', async () => {
  const fight = await admitEvidenceFixture()
  const transition = lethalStrike(fight.state, combatant.opponent)
  expect(transition.events).toContainEqual(
    expect.objectContaining({ event: 'damage_applied', hpBefore: 10, hpAfter: 0 }),
  )
  await rejected(() => fight.commit(transition, other), 'BATTLE_NOT_AVAILABLE')
  expect(await terminal(fight.session)).toEqual([])
  await db.query("select public.write_master_npc_design_v1($1,null,$2,2,'retire-world',null)", [
    owner,
    npc,
  ])
  await db.exec('set local role service_role')
  const first = await fight.commit(transition)
  const retry = await fight.commit(transition)
  await db.exec('reset role')
  expect(first.rows[0]).toMatchObject({ battle_version: 2, replayed: false })
  expect(retry.rows[0]).toMatchObject({ battle_version: 2, replayed: true })
  expect(await terminal(fight.session)).toEqual([{ outcome: 'victory', battle_version: 2 }])
  expect(await defeats(fight.session)).toEqual([
    {
      opponent_combatant_id: combatant.opponent,
      event: 'damage_applied',
      battle_version: 2,
      committed_at: true,
    },
  ])
})

it('records genuine player defeat separately from qualifying opponent defeat', async () => {
  const fight = await admitEvidenceFixture(true, false)
  await fight.commit(lethalStrike(fight.state, combatant.player))
  expect(await terminal(fight.session)).toEqual([{ outcome: 'defeat', battle_version: 2 }])
  expect(await defeats(fight.session)).toEqual([])
})

it('records a draw when one action defeats both admitted sides', async () => {
  const fight = await admitEvidenceFixture()
  const transition = lethalStrike(fight.state, combatant.opponent, true)
  expect(transition.events).toContainEqual({ event: 'battle_completed', winningTeamId: null })
  await fight.commit(transition)
  expect(await terminal(fight.session)).toEqual([{ outcome: 'draw', battle_version: 2 }])
  expect(await defeats(fight.session)).toEqual([])
})

it('records a scheduled Poison victory without direct strike evidence', async () => {
  const fight = await admitEvidenceFixture(true, false)
  const poisoned = reattachStatDrivenCombatBridge(
    applyCurrentPoisonState(
      fight.state,
      combatant.player,
      combatant.opponent,
      'world-fixture.poison',
      undefined,
      15,
      1,
    ),
    fight.state.statBridge,
  )
  await fight.commit({ state: poisoned, events: [] }, owner, 1, command)
  const faced = selectFinalFacing(poisoned.tactical.battle, 'west').state
  const tick = endCombatTurn(
    { ...poisoned, tactical: { ...poisoned.tactical, battle: faced } },
    PV1F_COMBAT_CONTENT,
  )
  expect(tick.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        event: 'damage_applied',
        sourceCombatantId: combatant.player,
        targetCombatantId: combatant.opponent,
        hpAfter: 0,
      }),
      expect.objectContaining({ event: 'battle_completed', winningTeamId: 'players' }),
    ]),
  )
  await fight.commit(tick, owner, 2)
  expect(await terminal(fight.session)).toEqual([{ outcome: 'victory', battle_version: 3 }])
  expect(await defeats(fight.session)).toEqual([])
})

it('rejects terminal credit if the result changes the teams of the admitted combatants', async () => {
  const fight = await admitEvidenceFixture()
  const transition = lethalStrike(fight.state, combatant.opponent)
  const battle = transition.state.tactical.battle
  await fight.commit({
    state: {
      ...transition.state,
      tactical: {
        ...transition.state.tactical,
        battle: {
          ...battle,
          combatants: battle.combatants.map((unit) => ({
            ...unit,
            teamId: `different:${unit.teamId}`,
          })),
        },
      },
    },
    events: transition.events.map((event) =>
      event.event === 'battle_completed' ? { ...event, winningTeamId: 'different:players' } : event,
    ),
  })
  expect(await terminal(fight.session)).toEqual([{ outcome: 'unresolved', battle_version: 2 }])
  expect(await defeats(fight.session)).toEqual([])
})

it.each(['conflicting completion markers', 'duplicate combatants', 'nonnumeric HP'] as const)(
  'records an unresolved terminal result with %s',
  async (kind) => {
    const fight = await admitEvidenceFixture()
    const transition = lethalStrike(fight.state, combatant.opponent)
    const battle = transition.state.tactical.battle
    const opponent = battle.combatants.find((unit) => unit.id === combatant.opponent)!
    const combatants =
      kind === 'duplicate combatants'
        ? [...battle.combatants, { ...opponent, hp: 10 }]
        : kind === 'nonnumeric HP'
          ? [...battle.combatants, { ...opponent, id: 'world:malformed-summon', hp: '10' }]
          : battle.combatants
    const events =
      kind === 'conflicting completion markers'
        ? [...transition.events, { event: 'battle_completed', winningTeamId: 'opponents' }]
        : transition.events
    await fight.commit({
      state: {
        ...transition.state,
        tactical: { ...transition.state.tactical, battle: { ...battle, combatants } },
      },
      events,
    })
    expect(await terminal(fight.session)).toEqual([{ outcome: 'unresolved', battle_version: 2 }])
    expect(await defeats(fight.session)).toEqual([])
  },
)

it('records startup victory and its knockout at the admitted first version', async () => {
  const fight = await admitEvidenceFixture(true, true, true)
  expect(await terminal(fight.session)).toEqual([{ outcome: 'victory', battle_version: 1 }])
  expect(await defeats(fight.session)).toEqual([
    {
      opponent_combatant_id: combatant.opponent,
      event: 'damage_applied',
      battle_version: 1,
      committed_at: true,
    },
  ])
})

function noContestSnapshot(fight: Awaited<ReturnType<typeof admitEvidenceFixture>>) {
  return {
    ...fight.snapshot,
    administrativeOutcome: 'NoContest',
    rewardOutcome: 'NoRewards',
    tactical: {
      ...fight.state.tactical,
      battle: { ...fight.state.tactical.battle, lifecycle: 'abandoned', currentTurn: null },
    },
  }
}

it('uses the authoritative No Contest receipt instead of trusting snapshot labels', async () => {
  const fight = await admitEvidenceFixture()
  await fight.commit({
    state: noContestSnapshot(fight),
    events: [{ event: 'administrative_no_contest', outcome: 'NoContest', rewards: 'NoRewards' }],
  })
  expect(await terminal(fight.session)).toEqual([{ outcome: 'abandoned', battle_version: 2 }])
  expect(await defeats(fight.session)).toEqual([])
})

it('records the Owner’s No Contest without credit and leaves its replay unchanged', async () => {
  const fight = await admitEvidenceFixture()
  const recover = () =>
    db.query<{ result: { replayed: boolean } }>(
      'select public.recover_master_player_battle_v1($1,$1,$2,1,array[$1::uuid],$3,$4,true,null) result',
      [owner, fight.session, other, noContestSnapshot(fight)],
    )
  expect((await recover()).rows[0]?.result.replayed).toBe(false)
  expect((await recover()).rows[0]?.result.replayed).toBe(true)
  expect(await terminal(fight.session)).toEqual([{ outcome: 'no-contest', battle_version: 2 }])
  expect(await defeats(fight.session)).toEqual([])
})

it('does not classify a nonterminal timeout or disconnect, and records later abandonment', async () => {
  const fight = await admitEvidenceFixture()
  const tick = timeoutAiTurn(prepareAiQualityCombatant(fight.state, combatant.player))
  await fight.commit(tick)
  expect(await terminal(fight.session)).toEqual([])
  await db.query('select app_private.abandon_active_battles_for_user_v1($1)', [owner])
  expect(await terminal(fight.session)).toEqual([{ outcome: 'abandoned', battle_version: 2 }])
  expect(await defeats(fight.session)).toEqual([])
})

it('does not classify a knockout on the timed-out turn as a legitimate loss', async () => {
  const fight = await admitEvidenceFixture()
  const poisoned = reattachStatDrivenCombatBridge(
    applyCurrentPoisonState(
      fight.state,
      combatant.opponent,
      combatant.player,
      'world-fixture.poison',
      undefined,
      15,
      1,
    ),
    fight.state.statBridge,
  )
  await fight.commit({ state: poisoned, events: [] }, owner, 1, command)
  const tick = timeoutAiTurn(prepareAiQualityCombatant(poisoned, combatant.player))
  expect(tick.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ event: 'ai_turn_timed_out', combatantId: combatant.player }),
      expect.objectContaining({ event: 'battle_completed', winningTeamId: 'opponents' }),
    ]),
  )
  await fight.commit(tick, owner, 2)
  expect(await terminal(fight.session)).toEqual([{ outcome: 'timeout', battle_version: 3 }])
  expect(await defeats(fight.session)).toEqual([])
})

it('keeps receipt reads, writes, and trigger execution private', async () => {
  const { rows } = await db.query(`select r.rolname,
    has_table_privilege(r.oid,'app_private.world_npc_terminal_receipts','select,insert,update,delete') terminal,
    has_table_privilege(r.oid,'app_private.world_npc_defeat_evidence','select,insert,update,delete') defeat,
    has_function_privilege(r.oid,'app_private.record_world_npc_battle_evidence_v1()','execute') event_trigger,
    has_function_privilege(r.oid,'app_private.record_world_npc_battle_abandoned_v1()','execute') abandonment_trigger
    from pg_roles r where r.rolname in ('anon','authenticated','service_role') order by r.rolname`)
  expect(rows).toEqual(
    ['anon', 'authenticated', 'service_role'].map((rolname) => ({
      rolname,
      terminal: false,
      defeat: false,
      event_trigger: false,
      abandonment_trigger: false,
    })),
  )
})

it('ignores an unlinked practice battle even when its engine records a genuine knockout', async () => {
  const fight = await admitEvidenceFixture(false)
  await fight.commit(lethalStrike(fight.state, combatant.opponent))
  expect(await terminal(fight.session)).toEqual([])
  expect(await defeats(fight.session)).toEqual([])
})

it.each(['player', 'opponent'] as const)(
  'classifies %s surrender without defeat evidence',
  async (side) => {
    const fight = await admitEvidenceFixture()
    const outcome = surrenderPvpCombatant(fight.state, combatant[side])
    await fight.commit({
      ...outcome,
      events: outcome.events.map((event) => {
        const row = event as Record<string, unknown>
        return row.event === 'pvp_combatant_surrendered' && side === 'player'
          ? { ...row, event: 'ai_combatant_surrendered' }
          : row
      }),
    })
    expect(await terminal(fight.session)).toEqual([{ outcome: 'surrender', battle_version: 2 }])
    expect(await defeats(fight.session)).toEqual([])
  },
)

it.each([
  ['owned summon', 'surrender'],
  ['unrecognized actor', 'unresolved'],
] as const)('checks the downed player’s AI surrender cause from an %s', async (actor, outcome) => {
  const fight = await admitEvidenceFixture()
  const current = createCurrentStatDrivenCombatEncounterState(
    fight.state,
    fight.state.statBridge.combatants.map((profile) => ({
      ...profile,
      physicalPower: 10,
      mysticPower: 10,
      level: 1,
      criticalChance: 0,
    })),
  )
  const summoned = spawnCombatSummon(current, {
    ownerCombatantId: combatant.player,
    sourceSkillId: 'basic.invocation',
    sourceSkillVersion: 1,
    profile: VESPER_SUMMON_PROFILE,
    position: { x: 2, y: 0 },
    facing: 'west',
  })
  const summonId = summoned.state.effectState!.summons![0]!.combatantId
  const facing = selectFinalFacing(summoned.state.tactical.battle, 'east').state
  const handedOff = endCombatTurn(
    { ...summoned.state, tactical: { ...summoned.state.tactical, battle: facing } },
    PV1F_COMBAT_CONTENT,
  )
  const downed = lethalStrike(
    reattachStatDrivenCombatBridge(handedOff.state, summoned.state.statBridge),
    combatant.player,
  )
  expect(downed.state.tactical.battle.lifecycle).toBe('active')
  expect(downed.state.tactical.battle.combatants).toContainEqual(
    expect.objectContaining({ id: combatant.player, hp: 0 }),
  )
  const enemyFacing = selectFinalFacing(downed.state.tactical.battle, 'west').state
  const nextRound = endCombatTurn(
    { ...downed.state, tactical: { ...downed.state.tactical, battle: enemyFacing } },
    PV1F_COMBAT_CONTENT,
  )
  const prior = finishPv1fTurn(
    reattachStatDrivenCombatBridge(nextRound.state, summoned.state.statBridge),
    'west',
  )
  await fight.commit(
    {
      state: prior.state,
      events: [
        ...summoned.events,
        ...handedOff.events,
        ...downed.events,
        ...nextRound.events,
        ...prior.events,
      ],
    },
    owner,
    1,
    command,
  )
  const conceded = surrenderPvpCombatant(prior.state, summonId)
  await fight.commit(
    {
      state: conceded.state,
      events: conceded.events.map((event) => {
        const row = event as Record<string, unknown>
        return row.event === 'pvp_combatant_surrendered'
          ? {
              ...row,
              event: 'ai_combatant_surrendered',
              combatantId: actor === 'owned summon' ? row.combatantId : 'unrecognized-combatant',
            }
          : row
      }),
    },
    owner,
    2,
  )
  expect(await terminal(fight.session)).toEqual([{ outcome, battle_version: 3 }])
  expect(await defeats(fight.session)).toEqual([])
})
