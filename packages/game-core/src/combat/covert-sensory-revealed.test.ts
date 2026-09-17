import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  endCombatTurn,
  evaluateCombatAction,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatStatusInstance,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  createCovertStatusDefinition,
  createRevealedStatusDefinition,
} from './covert-sensory-revealed'

const covert = createCovertStatusDefinition(3)
const revealed = createRevealedStatusDefinition(2)
const guarded = {
  id: 'guarded',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 10_000,
  polarity: 'positive' as const,
  amplifyCopyable: true,
  reactionClass: 'ordinary' as const,
}
const inspired = {
  id: 'inspired',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 10_000,
  polarity: 'positive' as const,
  amplifyCopyable: true,
  reactionClass: 'ordinary' as const,
}
const exposed = {
  id: 'exposed',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 10_000,
  polarity: 'negative' as const,
  curseCopyable: true,
  reactionClass: 'ordinary' as const,
}

const content: CombatContentCatalog = {
  statuses: [covert, revealed, guarded, inspired, exposed],
}

function status(
  statusId: string,
  sourceCombatantId: string,
  remainingOwnerTurnStarts: number,
): CombatStatusInstance {
  const definition = content.statuses.find((candidate) => candidate.id === statusId)
  if (!definition) throw new Error(`Missing test status ${statusId}.`)
  return {
    statusId,
    statusVersion: definition.version,
    stacks: 1,
    remainingOwnerTurnStarts,
    sourceCombatantId,
  }
}

function encounter(
  recruitStatuses: readonly CombatStatusInstance[] = [],
  wayfarerStatuses: readonly CombatStatusInstance[] = [],
): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'csr1-engine-test',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 0x12345678,
      combatants: [
        {
          id: 'wayfarer',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 20,
        },
      ],
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 2,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: [
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open' },
    ],
    movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
    placements: [
      {
        combatantId: 'wayfarer',
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'ground',
      },
      {
        combatantId: 'recruit',
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'ground',
      },
    ],
  })
  return createCombatEncounterState(tactical, [
    { combatantId: 'wayfarer', statuses: wayfarerStatuses },
    { combatantId: 'recruit', statuses: recruitStatuses },
  ])
}

function covertAction(): CombatActionDefinition {
  return {
    id: 'test.covert',
    version: 1,
    sourceType: 'test',
    tags: ['test'],
    target: {
      kind: 'self',
      teamPolicy: 'self',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'allies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [{ type: 'apply-status', recipient: 'actor', statusId: 'covert', stacks: 1 }],
  }
}

function directDamageAction(): CombatActionDefinition {
  return {
    id: 'test.direct-damage',
    version: 1,
    sourceType: 'test',
    tags: ['test'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 1,
      requiresLineOfSight: false,
      maximumElevationDifference: 1,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 5 }],
  }
}

function sensoryAction(
  accuracyMode: 'automatic' | 'per-target' = 'automatic',
): CombatActionDefinition {
  return {
    id: 'test.sensory',
    version: 1,
    sourceType: 'test',
    tags: ['test', 'sensory'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 1,
      requiresLineOfSight: false,
      maximumElevationDifference: 1,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    accuracyMode,
    effects: [
      { type: 'sensory', recipient: 'primary-unit', revealedDurationOwnerTurnStarts: 2 },
      { type: 'damage', recipient: 'primary-unit', amount: 5 },
    ],
  }
}

function statuses(
  state: CombatEncounterState,
  combatantId: string,
): readonly CombatStatusInstance[] {
  return state.statusState.find((row) => row.combatantId === combatantId)?.statuses ?? []
}

describe('CSR-1 Covert and Revealed definitions', () => {
  it('pins positive/negative taxonomy, copy exclusions and authored duration bounds', () => {
    expect(covert).toMatchObject({
      id: 'covert',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 3,
      polarity: 'positive',
      amplifyCopyable: false,
      reactionClass: 'ordinary',
    })
    expect(revealed).toMatchObject({
      id: 'revealed',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 2,
      polarity: 'negative',
      curseCopyable: false,
      reactionClass: 'ordinary',
    })
    expect(() => createCovertStatusDefinition(0)).toThrow()
    expect(() => createCovertStatusDefinition(5)).toThrow()
    expect(() => createRevealedStatusDefinition(0)).toThrow()
    expect(() => createRevealedStatusDefinition(5)).toThrow()
  })

  it('keeps Covert single-stack and refreshes its pinned duration on reapplication', () => {
    const once = executeCombatAction(encounter(), covertAction(), { kind: 'self' }, content)
    const twice = executeCombatAction(once.state, covertAction(), { kind: 'self' }, content)
    const active = statuses(twice.state, 'wayfarer').filter((entry) => entry.statusId === 'covert')

    expect(active).toHaveLength(1)
    expect(active[0]).toMatchObject({ stacks: 1, remainingOwnerTurnStarts: 3 })
  })

  it('blocks a new Covert application while Revealed is active', () => {
    const state = encounter([], [status('revealed', 'recruit', 2)])
    const transition = executeCombatAction(state, covertAction(), { kind: 'self' }, content)

    expect(statuses(transition.state, 'wayfarer').map((entry) => entry.statusId)).toEqual([
      'revealed',
    ])
    expect(transition.events).not.toContainEqual(
      expect.objectContaining({ event: 'status_applied', statusId: 'covert' }),
    )
  })

  it('keeps Covert targetable by ordinary hostile direct-unit actions', () => {
    const state = encounter([status('covert', 'recruit', 3)])
    const evaluation = evaluateCombatAction(
      state,
      directDamageAction(),
      { kind: 'unit', combatantId: 'recruit' },
      content,
    )
    const transition = executeCombatAction(
      state,
      directDamageAction(),
      { kind: 'unit', combatantId: 'recruit' },
      content,
    )

    expect(evaluation.legal).toBe(true)
    expect(evaluation.issues).toEqual([])
    expect(
      transition.state.tactical.battle.combatants.find((unit) => unit.id === 'recruit')?.hp,
    ).toBe(95)
    expect(statuses(transition.state, 'recruit').map((entry) => entry.statusId)).toContain('covert')
  })

  it('uses the existing owner-turn-start lifecycle for Covert and Revealed expiry', () => {
    const state = encounter(
      [status('covert', 'wayfarer', 1)],
      [status('revealed', 'recruit', 1)],
    )
    const recruitTurn = endCombatTurn(state, content)
    const wayfarerTurn = endCombatTurn(recruitTurn.state, content)

    expect(statuses(recruitTurn.state, 'recruit').map((entry) => entry.statusId)).not.toContain(
      'covert',
    )
    expect(statuses(wayfarerTurn.state, 'wayfarer').map((entry) => entry.statusId)).not.toContain(
      'revealed',
    )
    expect([...recruitTurn.events, ...wayfarerTurn.events]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'status_expired', combatantId: 'recruit', statusId: 'covert' }),
        expect.objectContaining({
          event: 'status_expired',
          combatantId: 'wayfarer',
          statusId: 'revealed',
        }),
      ]),
    )
  })
})

describe('CSR-1 Sensory', () => {
  it('has identical legality whether the primary target is Covert or not', () => {
    const plain = evaluateCombatAction(
      encounter(),
      sensoryAction(),
      { kind: 'unit', combatantId: 'recruit' },
      content,
    )
    const hidden = evaluateCombatAction(
      encounter([status('covert', 'recruit', 3)]),
      sensoryAction(),
      { kind: 'unit', combatantId: 'recruit' },
      content,
    )

    expect(plain.legal).toBe(true)
    expect(hidden.legal).toBe(true)
    expect(plain.issues).toEqual(hidden.issues)
    expect(plain.projectedEffects).toEqual(hidden.projectedEffects)
  })

  it('no-ops the Sensory block on a non-Covert target while later authored effects continue', () => {
    const transition = executeCombatAction(
      encounter(),
      sensoryAction(),
      { kind: 'unit', combatantId: 'recruit' },
      content,
    )
    const recruit = transition.state.tactical.battle.combatants.find(
      (unit) => unit.id === 'recruit',
    )

    expect(recruit?.hp).toBe(95)
    expect(statuses(transition.state, 'recruit')).toEqual([])
    expect(transition.events).not.toContainEqual(
      expect.objectContaining({ event: 'status_applied', statusId: 'revealed' }),
    )
  })

  it('purges definition-classified positive statuses, removes Covert, preserves negatives and applies Revealed', () => {
    const transition = executeCombatAction(
      encounter([
        status('covert', 'recruit', 3),
        status('guarded', 'recruit', 2),
        status('inspired', 'recruit', 2),
        status('exposed', 'wayfarer', 2),
      ]),
      sensoryAction(),
      { kind: 'unit', combatantId: 'recruit' },
      content,
    )

    expect(statuses(transition.state, 'recruit').map((entry) => entry.statusId)).toEqual([
      'exposed',
      'revealed',
    ])
    expect(transition.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'status_removed', statusId: 'covert' }),
        expect.objectContaining({ event: 'status_removed', statusId: 'guarded' }),
        expect.objectContaining({ event: 'status_removed', statusId: 'inspired' }),
        expect.objectContaining({ event: 'status_applied', statusId: 'revealed' }),
        expect.objectContaining({ event: 'damage_applied', amount: 5 }),
      ]),
    )
  })

  it('does not reveal or purge on a miss', () => {
    const state = encounter([status('covert', 'recruit', 3), status('guarded', 'recruit', 2)])
    const withRatings: CombatEncounterState = {
      ...state,
      statBridge: {
        combatants: [
          { combatantId: 'wayfarer', armor: 0, ward: 0, accuracy: 0, evasion: 0 },
          {
            combatantId: 'recruit',
            armor: 0,
            ward: 0,
            accuracy: 0,
            evasion: 10_000,
          },
        ],
      },
    }
    const transition = executeCombatAction(
      withRatings,
      sensoryAction('per-target'),
      { kind: 'unit', combatantId: 'recruit' },
      content,
    )

    expect(statuses(transition.state, 'recruit').map((entry) => entry.statusId)).toEqual([
      'covert',
      'guarded',
    ])
    expect(
      transition.state.tactical.battle.combatants.find((unit) => unit.id === 'recruit')?.hp,
    ).toBe(100)
    expect(transition.events).toContainEqual(
      expect.objectContaining({ event: 'combat_accuracy_resolved', hit: false }),
    )
    expect(transition.events).not.toContainEqual(
      expect.objectContaining({ event: 'status_applied', statusId: 'revealed' }),
    )
  })
})
