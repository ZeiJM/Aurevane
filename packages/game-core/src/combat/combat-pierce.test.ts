import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  executeCombatAction,
  P2_3_GUARDED_STATUS,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatStatusDefinition,
} from './actions'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { combatActionPresentationTags } from './gameplay-tags'

const VULNERABLE_STATUS: CombatStatusDefinition = {
  id: 'test.vulnerable',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 12_000,
}

const INCOMING_PROTECTION_STATUS: CombatStatusDefinition = {
  id: 'test.incoming-protection',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 10_000,
  damageModifiers: [
    { direction: 'incoming', multiplierBasisPoints: 7_000, condition: { kind: 'always' } },
  ],
}

const OUTGOING_PENALTY_STATUS: CombatStatusDefinition = {
  id: 'test.outgoing-penalty',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 10_000,
  damageModifiers: [
    { direction: 'outgoing', multiplierBasisPoints: 8_000, condition: { kind: 'always' } },
  ],
}

const CONTENT: CombatContentCatalog = {
  statuses: [
    P2_3_GUARDED_STATUS,
    INCOMING_PROTECTION_STATUS,
    OUTGOING_PENALTY_STATUS,
    VULNERABLE_STATUS,
  ],
}

function statusInstance(status: CombatStatusDefinition, sourceCombatantId: string) {
  return {
    statusId: status.id,
    statusVersion: status.version,
    stacks: 1,
    remainingOwnerTurnStarts: status.durationOwnerTurnStarts,
    sourceCombatantId,
  }
}

function encounter(options?: {
  actorStatuses?: readonly CombatStatusDefinition[]
  targetStatuses?: readonly CombatStatusDefinition[]
  targetArmor?: number
}): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:k4-pierce',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 29,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 10,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 30,
          maxMp: 30,
        },
      ],
    }),
  ).state

  const base = createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 2,
      height: 1,
      terrains: [{ id: 'open', traversalCost: 1 }],
      tiles: [
        { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open' },
        { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open' },
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
          combatantId: 'recruit',
          position: { x: 1, y: 0 },
          facing: 'west',
          movementProfileId: 'ground',
        },
      ],
    }),
    [
      {
        combatantId: 'actor',
        statuses: (options?.actorStatuses ?? []).map((status) => statusInstance(status, 'actor')),
      },
      {
        combatantId: 'recruit',
        statuses: (options?.targetStatuses ?? []).map((status) => statusInstance(status, 'actor')),
      },
    ],
  )

  return {
    ...base,
    statBridge: {
      combatants: [
        { combatantId: 'actor', armor: 0, ward: 0 },
        { combatantId: 'recruit', armor: options?.targetArmor ?? 100, ward: 100 },
      ],
    },
  }
}

function damageAction(piercing?: unknown): CombatActionDefinition {
  const effect = {
    type: 'damage',
    recipient: 'primary-unit',
    amount: 20,
    defenseKind: 'armor',
    ...(piercing === undefined ? {} : { piercing }),
  }

  return {
    id: 'test.k4-pierce',
    version: 1,
    sourceType: 'test',
    tags: [],
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
    cost: { spendsAction: true, mp: 0 },
    requirements: [],
    effects: [effect],
  } as unknown as CombatActionDefinition
}

function damageAmount(state: CombatEncounterState, action: CombatActionDefinition): number {
  const transition = executeCombatAction(
    state,
    action,
    { kind: 'unit', combatantId: 'recruit' },
    CONTENT,
  )
  const damage = transition.events.find((event) => event.event === 'damage_applied')
  if (!damage || damage.event !== 'damage_applied') throw new Error('Expected damage event.')
  return damage.amount
}

describe('P4.K4 Pierce damage', () => {
  it('preserves historical Armor and Guard mitigation when Pierce is omitted', () => {
    expect(
      damageAmount(
        encounter({ targetStatuses: [P2_3_GUARDED_STATUS], targetArmor: 100 }),
        damageAction(),
      ),
    ).toBe(8)
  })

  it('bypasses Armor and Guard-style incoming mitigation', () => {
    expect(
      damageAmount(
        encounter({ targetStatuses: [P2_3_GUARDED_STATUS], targetArmor: 100 }),
        damageAction(true),
      ),
    ).toBe(20)
  })

  it('preserves target vulnerabilities while bypassing defensive mitigation', () => {
    expect(
      damageAmount(
        encounter({ targetStatuses: [VULNERABLE_STATUS], targetArmor: 100 }),
        damageAction(true),
      ),
    ).toBe(24)
  })

  it('preserves attacker outgoing penalties while bypassing target incoming protection', () => {
    expect(
      damageAmount(
        encounter({
          actorStatuses: [OUTGOING_PENALTY_STATUS],
          targetStatuses: [INCOMING_PROTECTION_STATUS, VULNERABLE_STATUS],
          targetArmor: 100,
        }),
        damageAction(true),
      ),
    ).toBe(19)
  })

  it('rejects non-boolean Pierce authoring', () => {
    expect(() => validateCombatActionDefinition(damageAction('yes'), CONTENT)).toThrow(/pierc/i)
  })

  it('derives the compact Pierce presentation tag from authoritative damage metadata', () => {
    expect(combatActionPresentationTags(damageAction(true))).toContain('Pierce')
  })
})
