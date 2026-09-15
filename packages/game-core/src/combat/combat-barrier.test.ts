import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatResolutionContext,
} from './actions'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { combatActionPresentationTags } from './gameplay-tags'
import {
  createCombatActionProvenance,
  createCombatTriggerGuard,
  type CombatEffectInstanceProvenance,
} from './combat-kernel-types'

const CONTENT: CombatContentCatalog = { statuses: [] }
const BARRIER_ACTION_ID = 'test.k4-barrier'

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
  return enemyAction(BARRIER_ACTION_ID, [
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

function barrierContext(triggerChainId: string): CombatResolutionContext {
  return {
    provenance: createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'test',
      actionDefinitionId: BARRIER_ACTION_ID,
      actionVersion: 1,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId,
    }),
    triggerGuard: createCombatTriggerGuard({ triggerChainId }),
  }
}

function castAtRecruit(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  context?: CombatResolutionContext,
) {
  return executeCombatAction(
    state,
    action,
    { kind: 'unit', combatantId: 'recruit' },
    CONTENT,
    context,
  )
}

function recruitHp(state: CombatEncounterState): number {
  const recruit = state.tactical.battle.combatants.find((combatant) => combatant.id === 'recruit')
  if (!recruit) throw new Error('Expected recruit combatant.')
  return recruit.hp
}

type BarrierRow = {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  amount: number
  provenance?: CombatEffectInstanceProvenance
}

function recruitBarrierRows(state: CombatEncounterState): readonly BarrierRow[] {
  const effectState = state.effectState as unknown as { barriers?: readonly BarrierRow[] } | undefined
  return effectState?.barriers?.filter((barrier) => barrier.targetCombatantId === 'recruit') ?? []
}

function recruitBarrier(state: CombatEncounterState): number {
  return recruitBarrierRows(state).reduce((total, barrier) => total + barrier.amount, 0)
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

  it('accepts historical effect state that predates the Barrier collection', () => {
    const historical: CombatEncounterState = {
      ...encounter(),
      effectState: {
        ongoingRecovery: [],
        poison: [],
        bleed: [],
        burn: [],
        temporarySkills: [],
        damageHistory: [],
      },
    }

    const hit = castAtRecruit(historical, damageAction())

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
      expect(() => validateCombatActionDefinition(barrierAction(amount), CONTENT)).toThrow(
        /barrier/i,
      )
    },
  )

  it('derives the compact Barrier presentation tag from authoritative effect metadata', () => {
    expect(combatActionPresentationTags(barrierAction(8))).toContain('Barrier')
  })

  it('keeps legacy four-argument Barrier grants provenance-free', () => {
    const granted = castAtRecruit(encounter(), barrierAction(8))
    const row = recruitBarrierRows(granted.state)[0]

    expect(row?.amount).toBe(8)
    expect(row?.provenance).toBeUndefined()
  })

  it('threads deterministic K3 effect provenance into contextual Barrier grants', () => {
    const granted = castAtRecruit(encounter(), barrierAction(8), barrierContext('chain:k4:barrier'))
    const row = recruitBarrierRows(granted.state)[0]

    expect(row?.provenance).toMatchObject({
      instanceId: `effect:chain:k4:barrier:${BARRIER_ACTION_ID}:0:recruit`,
      targetCombatantId: 'recruit',
      effectOrdinal: 0,
      createdRound: 1,
      createdTurn: 1,
      action: {
        rulesetVersion: 2,
        sourceKind: 'test',
        actionDefinitionId: BARRIER_ACTION_ID,
        actionVersion: 1,
        sourceCombatantId: 'actor',
        controllerCombatantId: 'actor',
        triggerChainId: 'chain:k4:barrier',
      },
    })
  })

  it('refreshes causal provenance when the same Barrier source/action is granted again', () => {
    const first = castAtRecruit(encounter(), barrierAction(8), barrierContext('chain:k4:first'))
    const firstRow = recruitBarrierRows(first.state)[0]
    const second = castAtRecruit(
      first.state,
      barrierAction(8),
      barrierContext('chain:k4:second'),
    )
    const secondRow = recruitBarrierRows(second.state)[0]

    expect(firstRow?.amount).toBe(8)
    expect(firstRow?.provenance?.instanceId).toBe(
      `effect:chain:k4:first:${BARRIER_ACTION_ID}:0:recruit`,
    )
    expect(secondRow?.amount).toBe(16)
    expect(secondRow?.provenance?.instanceId).toBe(
      `effect:chain:k4:second:${BARRIER_ACTION_ID}:0:recruit`,
    )
    expect(firstRow?.provenance?.instanceId).toBe(
      `effect:chain:k4:first:${BARRIER_ACTION_ID}:0:recruit`,
    )
  })
})
