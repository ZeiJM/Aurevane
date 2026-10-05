import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  executePv1fAction,
  evaluatePv1fMovement,
  PV1F_RECOVER_ACTION_ID,
  spendPv1fActionEconomy,
} from './pv1f-action-economy'
import {
  chooseRecruitAiDecision,
  createRecruitAiKnowledge,
  RECRUIT_WEAK_PROFILE,
  type RecruitAiProfile,
} from './recruit-ai'
import {
  createStatDrivenCombatEncounterState,
  createStatBalancedCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'

function profile(
  combatantId: string,
  kind: 'character-derived' | 'scenario',
): StatDrivenCombatProfile {
  return {
    combatantId,
    provenance: {
      kind,
      sourceId: kind === 'character-derived' ? 'character:test-player' : 'scenario:test-recruit',
      sourceRulesVersion: 1,
    },
    accuracy: combatantId === 'recruit' ? 6_500 : 7_400,
    evasion: combatantId === 'recruit' ? 700 : 1_100,
    armor: 20,
    ward: 20,
    jump: 1,
  }
}

function encounter(
  input: {
    width?: number
    height?: number
    allyPosition?: { x: number; y: number }
    recruitPosition?: { x: number; y: number }
    playerPosition?: { x: number; y: number }
    recruitHp?: number
    movement?: number
  } = {},
): StatDrivenCombatEncounterState {
  const width = input.width ?? 5
  const height = input.height ?? 1
  const recruitPosition = input.recruitPosition ?? { x: 0, y: 0 }
  const playerPosition = input.playerPosition ?? { x: width - 1, y: 0 }
  const recruitProfile = profile('recruit', 'scenario')
  const playerProfile = profile('player', 'character-derived')
  const pending = createPendingBattle({
    battleId: 'battle:recruit-ai-test',
    rulesVersion: 1,
    contentVersion: 1,
    rngSeed: 987_654_321,
    combatants: [
      {
        id: 'recruit',
        teamId: 'opponents',
        initiative: 20,
        baseMovementBudget: input.movement ?? 4,
        hp: input.recruitHp ?? 50,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
      },
      {
        id: 'player',
        teamId: 'players',
        initiative: 10,
        baseMovementBudget: 4,
        hp: 50,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
      },
      ...(input.allyPosition
        ? [
            {
              id: 'ally',
              teamId: 'opponents',
              initiative: 5,
              baseMovementBudget: 4,
              hp: 50,
              maxHp: 50,
              mp: 20,
              maxMp: 20,
            },
          ]
        : []),
    ],
  })
  const active = startBattle(pending).state
  const tiles = Array.from({ length: width * height }, (_, index) => ({
    position: { x: index % width, y: Math.floor(index / width) },
    elevation: index % width === 2 && width > 3 ? 1 : 0,
    terrainId: index % width === 1 && width > 3 ? 'rough-ground' : 'open-ground',
  }))
  const tactical = createTacticalBattleState({
    battle: active,
    width,
    height,
    terrains: [
      { id: 'open-ground', traversalCost: 1 },
      { id: 'rough-ground', traversalCost: 2 },
    ],
    tiles,
    movementProfiles: [
      { id: 'recruit-ground', maxElevationStep: recruitProfile.jump, terrainCostOverrides: [] },
      { id: 'player-ground', maxElevationStep: playerProfile.jump, terrainCostOverrides: [] },
    ],
    placements: [
      {
        combatantId: 'recruit',
        position: recruitPosition,
        facing: 'east',
        movementProfileId: 'recruit-ground',
      },
      {
        combatantId: 'player',
        position: playerPosition,
        facing: 'west',
        movementProfileId: 'player-ground',
      },
      ...(input.allyPosition
        ? [
            {
              combatantId: 'ally',
              position: input.allyPosition,
              facing: 'east' as const,
              movementProfileId: 'recruit-ground',
            },
          ]
        : []),
    ],
  })

  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    recruitProfile,
    playerProfile,
    ...(input.allyPosition ? [profile('ally', 'scenario')] : []),
  ])
}

describe('P2.6 Recruit AI', () => {
  it('plans through a defeated ally when it is the only ground approach to the enemy', () => {
    const original = encounter({ allyPosition: { x: 1, y: 0 } })
    const state = {
      ...original,
      tactical: {
        ...original.tactical,
        battle: {
          ...original.tactical.battle,
          combatants: original.tactical.battle.combatants.map((combatant) =>
            combatant.id === 'ally' ? { ...combatant, hp: 0 } : combatant,
          ),
        },
      },
    }
    const decision = chooseRecruitAiDecision({ state, tieBreakSeed: 42 })
    expect(decision.intent).toEqual({
      kind: 'move',
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    })
    if (decision.intent.kind !== 'move') throw new Error('Expected movement through the corpse.')
    expect(evaluatePv1fMovement(state, decision.intent.path).movement.legal).toBe(true)
  })

  it('takes a legal detour around an ally when every closer tile is occupied', () => {
    const state = encounter({
      height: 3,
      recruitPosition: { x: 0, y: 1 },
      allyPosition: { x: 1, y: 1 },
      playerPosition: { x: 4, y: 1 },
    })
    const before = JSON.stringify(state)
    const decision = chooseRecruitAiDecision({ state, tieBreakSeed: 42 })
    expect(decision.intent.kind).toBe('move')
    if (decision.intent.kind !== 'move') throw new Error('Expected a route around the ally.')
    expect(decision.intent.path[1]?.x).toBe(0)
    expect(evaluatePv1fMovement(state, decision.intent.path).movement.legal).toBe(true)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('ends its turn when allied blockers leave no reachable attack position', () => {
    const state = encounter({ allyPosition: { x: 1, y: 0 } })
    const decision = chooseRecruitAiDecision({ state, tieBreakSeed: 42 })
    expect(decision.reason).toBe('face-threat')
    expect(decision.intent.kind).toBe('face')
  })

  it.each(['ap', 'movement'] as const)(
    'does not bypass exhausted %s while taking a detour',
    (limit) => {
      const initial = encounter({
        height: 3,
        recruitPosition: { x: 0, y: 1 },
        allyPosition: { x: 1, y: 1 },
        playerPosition: { x: 4, y: 1 },
        movement: limit === 'movement' ? 0 : 4,
      })
      const state = limit === 'ap' ? spendPv1fActionEconomy(initial, 90) : initial
      expect(chooseRecruitAiDecision({ state, tieBreakSeed: 42 }).intent.kind).toBe('face')
    },
  )

  it('still chooses legal survival recovery when allied blockers prevent movement', () => {
    const state = encounter({ allyPosition: { x: 1, y: 0 }, recruitHp: 20 })
    expect(chooseRecruitAiDecision({ state, tieBreakSeed: 42 }).intent).toMatchObject({
      kind: 'action',
      actionId: PV1F_RECOVER_ACTION_ID,
      target: { kind: 'self' },
    })
  })
  it('filters committed knowledge and does not expose RNG, future outcomes, or browser planning state', () => {
    const knowledge = createRecruitAiKnowledge(encounter())
    const serialized = JSON.stringify(knowledge)

    expect(knowledge.activeCombatantId).toBe('recruit')
    expect(knowledge.combatants).toHaveLength(2)
    expect(serialized).not.toContain('rng')
    expect(serialized).not.toContain('statBridge')
    expect(serialized).not.toContain('projectedEffects')
    expect(serialized).not.toContain('pendingIntent')
    expect(serialized).not.toContain('idempotencyKey')
  })

  it('moves toward the player when no legal attack exists', () => {
    const decision = chooseRecruitAiDecision({ state: encounter(), tieBreakSeed: 42 })

    expect(decision).toMatchObject({
      reason: 'close-distance',
      intent: {
        kind: 'move',
        path: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      },
    })
    expect(decision.candidateCount).toBeLessThanOrEqual(RECRUIT_WEAK_PROFILE.maxCandidates)
  })

  it('chooses a legal basic attack when the player is in range', () => {
    const state = encounter({
      width: 2,
      recruitPosition: { x: 1, y: 0 },
      playerPosition: { x: 0, y: 0 },
    })
    const decision = chooseRecruitAiDecision({ state, tieBreakSeed: 7 })

    expect(decision).toMatchObject({
      reason: 'legal-damage',
      intent: {
        kind: 'action',
        actionId: 'basic.attack.unarmed.basic',
        target: { kind: 'unit', combatantId: 'player' },
      },
    })
  })

  it('is deterministic for identical committed state, profile, and tie-break seed', () => {
    const state = encounter()

    const first = chooseRecruitAiDecision({ state, tieBreakSeed: 1234 })
    const second = chooseRecruitAiDecision({ state, tieBreakSeed: 1234 })

    expect(second).toEqual(first)
  })

  it('honors a bounded candidate budget', () => {
    const bounded: RecruitAiProfile = {
      ...RECRUIT_WEAK_PROFILE,
      maxCandidates: 1,
    }
    const decision = chooseRecruitAiDecision({
      state: encounter({ width: 2 }),
      profile: bounded,
      tieBreakSeed: 1,
    })

    expect(decision.candidateCount).toBe(1)
  })

  it('falls back to final facing when no Action Economy remains', () => {
    const state = encounter({
      width: 2,
      recruitPosition: { x: 1, y: 0 },
      playerPosition: { x: 0, y: 0 },
    })
    const economySpent = spendPv1fActionEconomy(state, 100)

    const decision = chooseRecruitAiDecision({ state: economySpent, tieBreakSeed: 9 })
    expect(decision).toMatchObject({
      reason: 'face-threat',
      intent: { kind: 'face', facing: 'west' },
    })
  })

  it('continues acting when legacy Action State says spent but PV-1F economy remains', () => {
    const state = encounter({
      width: 2,
      recruitPosition: { x: 1, y: 0 },
      playerPosition: { x: 0, y: 0 },
    })
    const legacySpent = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          currentTurn: {
            ...state.tactical.battle.currentTurn!,
            actionState: 'spent' as const,
            movementRemaining: 0,
            movementSpent: state.tactical.battle.currentTurn!.movementMaximum,
          },
        },
      },
    }

    const decision = chooseRecruitAiDecision({ state: legacySpent, tieBreakSeed: 9 })
    expect(decision).toMatchObject({
      reason: 'legal-damage',
      intent: { kind: 'action', actionId: 'basic.attack.unarmed.basic' },
    })
  })

  it('rejects unbounded or malformed profile budgets', () => {
    expect(() =>
      chooseRecruitAiDecision({
        state: encounter(),
        tieBreakSeed: 1,
        profile: { ...RECRUIT_WEAK_PROFILE, maxCandidates: 10_000 },
      }),
    ).toThrow(/maxCandidates/)
  })
})

describe('P3.3 Recruit AI cooldown parity', () => {
  it('removes Recovery from AI candidates while the same server cooldown is active', () => {
    const state = encounter({
      width: 2,
      recruitPosition: { x: 1, y: 0 },
      playerPosition: { x: 0, y: 0 },
      recruitHp: 20,
    })
    const recoveryBiased: RecruitAiProfile = {
      ...RECRUIT_WEAK_PROFILE,
      attackUtility: 0,
      movementUtility: 0,
      guardUtility: 0,
      recoverUtility: 1_000,
    }
    const before = chooseRecruitAiDecision({ state, profile: recoveryBiased, tieBreakSeed: 55 })
    expect(before.intent).toMatchObject({ kind: 'action', actionId: PV1F_RECOVER_ACTION_ID })

    const used = executePv1fAction(state, PV1F_RECOVER_ACTION_ID, { kind: 'self' })
    const during = chooseRecruitAiDecision({
      state: used.state,
      profile: recoveryBiased,
      tieBreakSeed: 55,
    })
    expect(during.intent).not.toMatchObject({ kind: 'action', actionId: PV1F_RECOVER_ACTION_ID })
  })
})

it('plans a current-policy descent from height three with Jump zero', () => {
  const initial = encounter()
  const balanced = createStatBalancedCombatEncounterState(
    initial,
    initial.statBridge.combatants.map((row) => ({
      ...row,
      jump: 0,
      physicalPower: 0,
      mysticPower: 0,
      level: 1,
      criticalChance: 0,
      statusResistance: 0,
    })),
  )
  const state = {
    ...balanced,
    tactical: {
      ...balanced.tactical,
      tiles: balanced.tactical.tiles.map((tile) => ({
        ...tile,
        elevation: tile.position.x === 0 ? 3 : 0,
      })),
    },
  }
  const before = JSON.stringify(state)
  const decision = chooseRecruitAiDecision({ state, tieBreakSeed: 42 })
  expect(decision.intent).toEqual({
    kind: 'move',
    path: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  })
  if (decision.intent.kind !== 'move') throw new Error('Expected a legal descent route.')
  expect(evaluatePv1fMovement(state, decision.intent.path).movement.legal).toBe(true)
  expect(JSON.stringify(state)).toBe(before)
})
