import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEncounterState,
} from './actions'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { combatActionPresentationTags } from './gameplay-tags'

const CONTENT: CombatContentCatalog = { statuses: [] }

function encounter(): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:k4-barrier',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 31,
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

  return createCombatEncounterState(
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
  )
}

function enemyAction(id: string, effects: readonly unknown[]): CombatActionDefinition {
  return {
    id,
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
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects,
  } as unknown as CombatActionDefinition
}

function barrierAction(amount: unknown): CombatActionDefinition {
  return enemyAction('test.k4-barrier', [
    { type: 'barrier-change', recipient: 'primary-unit', amount },
  ])
}

function damageAction(piercing = false): CombatActionDefinition {
  return enemyAction('test.k4-barrier-damage', [
    {
      type: 'damage',
      recipient: 'primary-unit',
      amount: 20,
      ...(piercing ? { piercing: true } : {}),
    },
  ])
}

function castAtRecruit(state: CombatEncounterState, action: CombatActionDefinition) {
  return executeCombatAction(
    state,
    action,
    { kind: 'unit', combatantId: 'recruit' },
    CONTENT,
  )
}

function recruitHp(state: CombatEncounterState): number {
  const recruit = state.tactical.battle.combatants.find((combatant) => combatant.id === 'recruit')
  if (!recruit) throw new Error('Expected recruit combatant.')
  return recruit.hp
}

function recruitBarrier(state: CombatEncounterState): number {
  const effectState = state.effectState as unknown as
    | {
        barriers?: readonly { targetCombatantId: string; amount: number }[]
      }
    | undefined
  return (
    effectState?.barriers
      ?.filter((barrier) => barrier.targetCombatantId === 'recruit')
      .reduce((total, barrier) => total + barrier.amount, 0) ?? 0
  )
}

function committedDamage(events: readonly { event: string }[]): number {
  const damage = events.find((event) => event.event === 'damage_applied') as
    | { event: 'damage_applied'; amount: number }
    | undefined
  if (!damage) throw new Error('Expected damage event.')
  return damage.amount
}

describe('P4.K4 direct Barrier primitive', () => {
  it('preserves direct damage when no Barrier exists', () => {
    const hit = castAtRecruit(encounter(), damageAction())

    expect(recruitHp(hit.state)).toBe(80)
    expect(committedDamage(hit.events)).toBe(20)
  })

  it('absorbs resolved direct damage before committed HP loss', () => {
    const granted = castAtRecruit(encounter(), barrierAction(8))
    const hit = castAtRecruit(granted.state, damageAction())

    expect(recruitHp(hit.state)).toBe(88)
    expect(committedDamage(hit.events)).toBe(12)
    expect(recruitBarrier(hit.state)).toBe(0)
  })

  it('caps aggregate Barrier at the recipient maximum HP', () => {
    const first = castAtRecruit(encounter(), barrierAction(75))
    const second = castAtRecruit(first.state, barrierAction(75))

    expect(recruitBarrier(second.state)).toBe(100)
  })

  it('does not let Pierce bypass Barrier', () => {
    const granted = castAtRecruit(encounter(), barrierAction(8))
    const hit = castAtRecruit(granted.state, damageAction(true))

    expect(recruitHp(hit.state)).toBe(88)
    expect(committedDamage(hit.events)).toBe(12)
    expect(recruitBarrier(hit.state)).toBe(0)
  })

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid Barrier authoring amount %s',
    (amount) => {
      expect(() => validateCombatActionDefinition(barrierAction(amount), CONTENT)).toThrow(/barrier/i)
    },
  )

  it('derives the compact Barrier presentation tag from authoritative effect metadata', () => {
    expect(combatActionPresentationTags(barrierAction(8))).toContain('Barrier')
  })
})
