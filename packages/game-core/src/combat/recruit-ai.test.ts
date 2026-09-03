import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  executePv1fAction,
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
    recruitPosition?: { x: number; y: number }
    playerPosition?: { x: number; y: number }
    recruitHp?: number
    movement?: number
  } = {},
): StatDrivenCombatEncounterState {
  const width = input.width ?? 5
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
    ],
  })
  const active = startBattle(pending).state
  const tiles = Array.from({ length: width }, (_, x) => ({
    position: { x, y: 0 },
    elevation: x === 2 && width > 3 ? 1 : 0,
    terrainId: x === 1 && width > 3 ? 'rough-ground' : 'open-ground',
  }))
  const tactical = createTacticalBattleState({
    battle: active,
    width,
    height: 1,
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
    ],
  })

  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    recruitProfile,
    playerProfile,
  ])
}

describe('P2.6 Recruit AI', () => {
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
