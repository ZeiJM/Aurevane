import { describe, expect, it } from 'vitest'
import {
  P2_3_UNARMED_ATTACK_PROFILE,
  createBasicAttackDefinition,
  createCombatEncounterState,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatEncounterState,
  type CombatResolutionEvent,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  createStatDrivenCombatEncounterState,
  executeStatDrivenAttack,
  type StatDrivenCombatProfile,
  type StatDrivenCombatResolutionEvent,
} from './stat-driven-combat'
import { PHASE4_STATUSES } from './status-content'

const CONTENT = { statuses: PHASE4_STATUSES }

function encounter({
  actorHp = 30,
  targetHp = 30,
}: { actorHp?: number; targetHp?: number } = {}): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'current-burn-backlash-contract',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 97,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 4,
          hp: actorHp,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'target',
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 4,
          hp: targetHp,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
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
          combatantId: 'target',
          position: { x: 1, y: 0 },
          facing: 'west',
          movementProfileId: 'ground',
        },
      ],
    }),
  )
}

function actorHp(state: CombatEncounterState): number {
  return state.tactical.battle.combatants.find((combatant) => combatant.id === 'actor')!.hp
}

function targetHp(state: CombatEncounterState): number {
  return state.tactical.battle.combatants.find((combatant) => combatant.id === 'target')!.hp
}

function burnActor(state: CombatEncounterState): CombatEncounterState {
  const burnSelf: CombatActionDefinition = {
    id: 'test.burn-self',
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
    effects: [{ type: 'burn', recipient: 'actor' }],
  }

  return executeCombatAction(state, burnSelf, { kind: 'self' }, CONTENT).state
}

function damagingAction(
  effects: readonly CombatEffectDefinition[] = [
    { type: 'damage', recipient: 'primary-unit', amount: 3 },
  ],
  id = 'test.damaging-command',
): CombatActionDefinition {
  return {
    id,
    version: 1,
    sourceType: 'discipline-skill',
    tags: ['attack'],
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
    effects,
  }
}

function supportAction(): CombatActionDefinition {
  return {
    id: 'test.support-command',
    version: 1,
    sourceType: 'discipline-skill',
    tags: ['support'],
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
    cost: { spendsAction: true, mp: 0 },
    requirements: [],
    effects: [{ type: 'healing', recipient: 'actor', amount: 3 }],
  }
}

function selfDamageEvents(
  events: readonly (CombatResolutionEvent | StatDrivenCombatResolutionEvent)[],
) {
  return events.filter(
    (event) =>
      event.event === 'damage_applied' &&
      event.sourceCombatantId === 'actor' &&
      event.targetCombatantId === 'actor',
  )
}

function statProfiles(): readonly StatDrivenCombatProfile[] {
  return [
    {
      combatantId: 'actor',
      provenance: { kind: 'scenario', sourceId: 'scenario:actor', sourceRulesVersion: 1 },
      accuracy: 0,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
    },
    {
      combatantId: 'target',
      provenance: { kind: 'scenario', sourceId: 'scenario:target', sourceRulesVersion: 1 },
      accuracy: 10_000,
      evasion: 10_000,
      armor: 0,
      ward: 0,
      jump: 0,
    },
  ]
}

describe('current Burn damaging-command backlash', () => {
  it('deals one 2 HP self-damage backlash after a damaging command resolves', () => {
    const burned = burnActor(encounter())
    const result = executeCombatAction(
      burned,
      damagingAction(),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(targetHp(result.state)).toBe(27)
    expect(actorHp(result.state)).toBe(28)
    expect(selfDamageEvents(result.events)).toEqual([
      expect.objectContaining({ amount: 2, hpBefore: 30, hpAfter: 28 }),
    ])
  })

  it('triggers only once for a multi-hit damaging command', () => {
    const burned = burnActor(encounter())
    const result = executeCombatAction(
      burned,
      damagingAction([
        { type: 'damage', recipient: 'primary-unit', amount: 3 },
        { type: 'damage', recipient: 'primary-unit', amount: 4 },
      ]),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(targetHp(result.state)).toBe(23)
    expect(actorHp(result.state)).toBe(28)
    expect(selfDamageEvents(result.events)).toHaveLength(1)
  })

  it('does not trigger for a non-damaging support command', () => {
    const burned = burnActor(encounter())
    const result = executeCombatAction(burned, supportAction(), { kind: 'self' }, CONTENT)

    expect(actorHp(result.state)).toBe(30)
    expect(selfDamageEvents(result.events)).toEqual([])
  })

  it('still triggers when a stat-driven Basic Attack misses', () => {
    const burned = createStatDrivenCombatEncounterState(burnActor(encounter()), statProfiles())
    const attack = createBasicAttackDefinition(P2_3_UNARMED_ATTACK_PROFILE)
    const result = executeStatDrivenAttack(
      burned,
      attack,
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(result.events.find((event) => event.event === 'stat_driven_attack_resolved')).toEqual(
      expect.objectContaining({ hit: false }),
    )
    expect(targetHp(result.state)).toBe(30)
    expect(actorHp(result.state)).toBe(28)
    expect(selfDamageEvents(result.events)).toHaveLength(1)
  })

  it('can defeat the burned current actor and award the surviving enemy team', () => {
    const burned = burnActor(encounter({ actorHp: 2 }))
    const result = executeCombatAction(
      burned,
      damagingAction(),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(actorHp(result.state)).toBe(0)
    expect(result.state.tactical.battle.lifecycle).toBe('completed')
    expect(result.events).toContainEqual({ event: 'battle_completed', winningTeamId: 'enemies' })
  })

  it('uses the no-winner draw when the command defeats the target and backlash defeats the actor', () => {
    const burned = burnActor(encounter({ actorHp: 2, targetHp: 3 }))
    const result = executeCombatAction(
      burned,
      damagingAction(),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(targetHp(result.state)).toBe(0)
    expect(actorHp(result.state)).toBe(0)
    expect(result.state.tactical.battle.lifecycle).toBe('completed')
    expect(result.events).toContainEqual({ event: 'battle_completed', winningTeamId: null })
  })
})
