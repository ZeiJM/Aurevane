import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatStatusDefinition,
} from './actions'
import { validateCombatStatusDefinition } from './combat-authoring-validation'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'

function absorbMpStatus(
  id: string,
  basisPoints: number,
  overrides: Record<string, unknown> = {},
): CombatStatusDefinition {
  return {
    id,
    version: 1,
    maximumStacks: 1,
    durationOwnerTurnStarts: 2,
    damageTakenMultiplierBasisPoints: 10_000,
    polarity: 'positive',
    reactionClass: 'reactive',
    effectCategories: ['Resource'],
    absorbMpBasisPoints: basisPoints,
    ...overrides,
  } as unknown as CombatStatusDefinition
}

function absorbHpStatus(id: string, basisPoints: number): CombatStatusDefinition {
  return {
    id,
    version: 1,
    maximumStacks: 1,
    durationOwnerTurnStarts: 2,
    damageTakenMultiplierBasisPoints: 10_000,
    polarity: 'positive',
    reactionClass: 'reactive',
    effectCategories: ['Healing'],
    absorbHpBasisPoints: basisPoints,
  } as unknown as CombatStatusDefinition
}

const ABSORB_MP_25 = absorbMpStatus('test.absorb-mp-25', 2_500)
const ABSORB_MP_10 = absorbMpStatus('test.absorb-mp-10', 1_000)
const PERIODIC_DAMAGE: CombatStatusDefinition = {
  id: 'test.periodic-damage',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 10_000,
  endOfTurn: { type: 'damage', amount: 4 },
}

function action(amount: number, teamPolicy: 'enemy' | 'any' = 'enemy'): CombatActionDefinition {
  return {
    id: 'test.absorb-mp-hit',
    version: 1,
    sourceType: 'test',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy,
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 1,
      requiresLineOfSight: false,
      maximumElevationDifference: 1,
      friendlyFire: teamPolicy === 'enemy' ? 'enemies-only' : 'all-units',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount }],
  }
}

function statusInstance(status: CombatStatusDefinition) {
  return {
    statusId: status.id,
    statusVersion: status.version,
    stacks: 1,
    remainingOwnerTurnStarts: status.durationOwnerTurnStarts,
    sourceCombatantId: 'actor',
  }
}

function encounter(options?: {
  targetTeamId?: string
  targetHp?: number
  targetMp?: number
  targetMaxMp?: number
  targetStatuses?: readonly CombatStatusDefinition[]
  targetActsFirst?: boolean
}): CombatEncounterState {
  const targetActsFirst = options?.targetActsFirst ?? false
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:k4-absorb-mp',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 43,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: targetActsFirst ? 10 : 20,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
        },
        {
          id: 'target',
          teamId: options?.targetTeamId ?? 'opponents',
          initiative: targetActsFirst ? 20 : 10,
          baseMovementBudget: 3,
          hp: options?.targetHp ?? 100,
          maxHp: 100,
          mp: options?.targetMp ?? 10,
          maxMp: options?.targetMaxMp ?? 50,
        },
        {
          id: 'witness',
          teamId: 'opponents',
          initiative: 5,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 30,
          maxMp: 30,
        },
      ],
    }),
  ).state

  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 3,
      height: 1,
      terrains: [{ id: 'open', traversalCost: 1 }],
      tiles: [
        { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open' },
        { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open' },
        { position: { x: 2, y: 0 }, elevation: 0, terrainId: 'open' },
      ],
      movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
      placements: [
        {
          combatantId: 'actor',
          position: { x: 0, y: 0 },
          facing: 'east',
          movementProfileId: 'ground',
        },
        {
          combatantId: 'target',
          position: { x: 1, y: 0 },
          facing: 'west',
          movementProfileId: 'ground',
        },
        {
          combatantId: 'witness',
          position: { x: 2, y: 0 },
          facing: 'west',
          movementProfileId: 'ground',
        },
      ],
    }),
    [
      { combatantId: 'actor', statuses: [] },
      {
        combatantId: 'target',
        statuses: (options?.targetStatuses ?? []).map(statusInstance),
      },
      { combatantId: 'witness', statuses: [] },
    ],
  )
}

function target(state: CombatEncounterState) {
  return state.tactical.battle.combatants.find((combatant) => combatant.id === 'target')!
}

function execute(
  state: CombatEncounterState,
  damage: number,
  statuses: readonly CombatStatusDefinition[],
  teamPolicy: 'enemy' | 'any' = 'enemy',
) {
  const content: CombatContentCatalog = { statuses }
  return executeCombatAction(
    state,
    action(damage, teamPolicy),
    { kind: 'unit', combatantId: 'target' },
    content,
  )
}

describe('P4.K4 Absorb MP', () => {
  it('restores an authored percentage of actual hostile direct HP damage as MP', () => {
    const result = execute(encounter({ targetStatuses: [ABSORB_MP_25] }), 20, [ABSORB_MP_25])

    expect(target(result.state).mp).toBe(15)
    expect(result.events).toContainEqual({
      event: 'resource_changed',
      actionId: 'status.absorb-mp.current.v1',
      sourceCombatantId: 'target',
      targetCombatantId: 'target',
      resource: 'mp',
      delta: 5,
      before: 10,
      after: 15,
    })
  })

  it('uses the minimum-1 MP recovery rule when a positive percentage rounds below one', () => {
    const result = execute(encounter({ targetStatuses: [ABSORB_MP_10] }), 1, [ABSORB_MP_10])

    expect(target(result.state).mp).toBe(11)
  })

  it('caps recovery at max MP', () => {
    const result = execute(encounter({ targetMp: 49, targetStatuses: [ABSORB_MP_25] }), 20, [
      ABSORB_MP_25,
    ])

    expect(target(result.state).mp).toBe(50)
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'resource_changed',
        actionId: 'status.absorb-mp.current.v1',
        delta: 1,
        before: 49,
        after: 50,
      }),
    )
  })

  it('cannot restore MP after lethal damage', () => {
    const result = execute(encounter({ targetHp: 4, targetStatuses: [ABSORB_MP_25] }), 20, [
      ABSORB_MP_25,
    ])

    expect(target(result.state).hp).toBe(0)
    expect(target(result.state).mp).toBe(10)
    expect(
      result.events.filter(
        (event) =>
          event.event === 'resource_changed' && event.actionId === 'status.absorb-mp.current.v1',
      ),
    ).toEqual([])
  })

  it('does not trigger from non-hostile direct damage', () => {
    const result = execute(
      encounter({ targetTeamId: 'players', targetStatuses: [ABSORB_MP_25] }),
      20,
      [ABSORB_MP_25],
      'any',
    )

    expect(target(result.state).mp).toBe(10)
  })

  it('does not trigger from periodic damage', () => {
    const content: CombatContentCatalog = { statuses: [ABSORB_MP_25, PERIODIC_DAMAGE] }
    const state = encounter({
      targetStatuses: [ABSORB_MP_25, PERIODIC_DAMAGE],
      targetActsFirst: true,
    })
    const faced = selectCurrentFinalFacing(state.tactical, 'west')
    const ended = endCombatTurn({ ...state, tactical: faced.state }, content)

    expect(target(ended.state).hp).toBe(96)
    expect(target(ended.state).mp).toBe(10)
  })

  it('caps combined active Absorb MP recovery at 100% of qualifying damage', () => {
    const absorb60A = absorbMpStatus('test.absorb-mp-60-a', 6_000)
    const absorb60B = absorbMpStatus('test.absorb-mp-60-b', 6_000)
    const result = execute(encounter({ targetMp: 0, targetStatuses: [absorb60A, absorb60B] }), 20, [
      absorb60A,
      absorb60B,
    ])

    expect(target(result.state).mp).toBe(20)
  })

  it('coexists with Absorb HP from the same qualifying damage summary', () => {
    const hp25 = absorbHpStatus('test.absorb-hp-25', 2_500)
    const result = execute(encounter({ targetStatuses: [hp25, ABSORB_MP_25] }), 20, [
      hp25,
      ABSORB_MP_25,
    ])

    expect(target(result.state).hp).toBe(85)
    expect(target(result.state).mp).toBe(15)
    expect(result.events.map((event) => ('actionId' in event ? event.actionId : null))).toEqual(
      expect.arrayContaining(['status.absorb-hp.current.v1', 'status.absorb-mp.current.v1']),
    )
  })

  it('validates Absorb MP as bounded positive reactive status metadata', () => {
    expect(() => validateCombatStatusDefinition(ABSORB_MP_25)).not.toThrow()
    expect(() =>
      validateCombatStatusDefinition(absorbMpStatus('test.absorb-mp-too-high', 10_001)),
    ).toThrow(/Absorb MP/i)
    expect(() =>
      validateCombatStatusDefinition(
        absorbMpStatus('test.absorb-mp-wrong-polarity', 2_500, { polarity: 'negative' }),
      ),
    ).toThrow(/Absorb MP/i)
    expect(() =>
      validateCombatStatusDefinition(
        absorbMpStatus('test.absorb-mp-not-reactive', 2_500, { reactionClass: 'ordinary' }),
      ),
    ).toThrow(/Absorb MP/i)
  })
})
