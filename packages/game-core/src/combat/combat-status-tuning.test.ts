import { applyCombatStatusCopies } from './combat-status-copy'
import { pendingCombatStatusRows } from './combat-effect-timing'
import { selectCurrentFinalFacing } from './board'
import { endCombatTurn } from './actions'
import { revealedSkillApCost } from './covert-sensory-revealed'
import { describe, expect, it } from 'vitest'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  createCombatEncounterState,
  evaluateCombatAction,
  executeCombatAction,
  synchronizeCombatInitiative,
  validateCombatEncounterState,
  type CombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
} from './actions'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { createPv1fTemporaryResources, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { conditionalDamageMultiplier } from './damage-modifiers'
import { terrainAdjustedDefense } from './combat-stat-balance'
import { combatWalkingModifiers } from './combat-walking'
import { forecastCombatSkillAccuracyForTarget } from './combat-skill-accuracy'
import { createAuthorableEffectPayload } from './combat-effect-authoring'
import { validateCombatTagPayload } from './combat-tag-registry'
function encounter(): StatDrivenCombatEncounterState {
  const ids = ['actor', 'enemy', 'other', 'ally']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'phase4-effects',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'actor' || id === 'ally' ? 'players' : 'enemies',
        initiative: 40 - index * 10,
        baseMovementBudget: 4,
        hp: 25,
        maxHp: 50,
        mp: 10,
        maxMp: 20,
        temporaryResources: createPv1fTemporaryResources(10),
      })),
    }),
  ).state
  const positions = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 2 },
  ]
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 5,
        height: 4,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: Array.from({ length: 20 }, (_, i) => ({
          position: { x: i % 5, y: Math.floor(i / 5) },
          elevation: 0,
          terrainId: 'open',
        })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
        placements: ids.map((combatantId, i) => ({
          combatantId,
          position: positions[i]!,
          facing: 'west' as const,
          movementProfileId: 'ground',
        })),
      }),
    ),
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario' as const, sourceId: 'scenario:phase4', sourceRulesVersion: 1 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
    })),
  )
}
function withStatus<T extends CombatEncounterState>(
  state: T,
  owner: string,
  statusId: string,
  source = 'actor',
): T {
  const definition = PV1F_COMBAT_CONTENT.statuses.find((status) => status.id === statusId)!
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === owner
        ? {
            ...row,
            statuses: [
              ...row.statuses.filter((status) => status.statusId !== statusId),
              {
                ...(definition.markAccuracyBonusBasisPoints !== undefined
                  ? { sourceScopedMark: true as const }
                  : {}),
                statusId,
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: definition.durationOwnerTurnStarts,
                sourceCombatantId: source,
              },
            ].sort((a, b) => a.statusId.localeCompare(b.statusId)),
          }
        : row,
    ),
  }
}
function action(effects: readonly CombatEffectDefinition[]): CombatActionDefinition {
  return {
    id: 'test.effects',
    version: 1,
    sourceType: 'test',
    tags: ['test'],
    cost: { mp: 0, spendsAction: false },
    requirements: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'circle', radius: 1 },
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    effects,
  }
}
const target = { kind: 'unit' as const, combatantId: 'enemy' }
const multiplier = (state: CombatEncounterState, from: string, to: string) =>
  conditionalDamageMultiplier(state, from, to, PV1F_COMBAT_CONTENT)

function tuned(
  state: StatDrivenCombatEncounterState,
  owner: string,
  statusId: string,
  fields: Record<string, number>,
) {
  const next = withStatus(state, owner, statusId)
  return {
    ...next,
    statusState: next.statusState.map((row) => ({
      ...row,
      statuses: row.statuses.map((status) =>
        status.statusId === statusId ? { ...status, ...fields } : status,
      ),
    })),
  }
}

describe('authored status tuning', () => {
  it('uses total Defenseless damage taken instead of adding another 100 percent', () => {
    const state = tuned(encounter(), 'enemy', 'lowered-guard', {
      damageTakenMultiplierBasisPoints: 15000,
    })
    const cast = action([{ type: 'damage', recipient: 'primary-unit', amount: 10 }])
    const result = executeCombatAction(state, cast, target, PV1F_COMBAT_CONTENT)
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(10)
  })
  it('Fortified increases actual defenses and reduces only outgoing damage by the same percentage', () => {
    const state = tuned(encounter(), 'actor', 'fortified', { defenseIncreaseBasisPoints: 5000 })
    expect(terrainAdjustedDefense(state, 'actor', 100)).toBe(150)
    expect(multiplier(state, 'actor', 'enemy')).toBe(5000)
    expect(multiplier(state, 'enemy', 'actor')).toBe(10000)
    expect(multiplier(withStatus(encounter(), 'actor', 'fortified'), 'enemy', 'actor')).toBe(7000)
  })
  it('uses captured movement adjustments and ignores pending applications', () => {
    const state = tuned(encounter(), 'actor', 'slow', { movementApAdjustment: 25 })
    expect(combatWalkingModifiers(state, PV1F_COMBAT_CONTENT).additionalApAt({ x: 0, y: 0 })).toBe(
      25,
    )
    const haste = tuned(encounter(), 'actor', 'haste', { movementApAdjustment: 15 })
    expect(combatWalkingModifiers(haste, PV1F_COMBAT_CONTENT).additionalApAt({ x: 0, y: 0 })).toBe(
      -15,
    )
  })
  it('separates captured Drenched initiative reduction from its Storm damage bonus', () => {
    const state = {
      ...tuned(encounter(), 'enemy', 'wet', {
        initiativeReductionBasisPoints: 5000,
        potencyBasisPoints: 2000,
      }),
      dynamicInitiativePolicyVersion: 1 as const,
      elementalDamagePolicyVersion: 2 as const,
    }
    const next = synchronizeCombatInitiative(state)
    expect(
      next.tactical.battle.activeInitiativeModifiers?.find((row) => row.combatantId === 'enemy')
        ?.amount,
    ).toBe(-15)
  })
  it('captures tuning into application records, validates it and restores it', () => {
    const cast = action([
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'slow',
        stacks: 1,
        movementApAdjustment: 27,
      } as CombatEffectDefinition,
    ])
    const state = { ...encounter(), effectStackingPolicyVersion: 1 as const }
    const result = executeCombatAction(state, cast, target, PV1F_COMBAT_CONTENT)
    const status = result.state.statusState.find((row) => row.combatantId === 'actor')!.statuses[0]!
    expect(status).toMatchObject({
      movementApAdjustment: 27,
      applicationModifiers: [{ movementApAdjustment: 27 }],
    })
    expect(validateCombatEncounterState(JSON.parse(JSON.stringify(result.state)))).toEqual([])
    const invalid = structuredClone(result.state)
    Object.assign(invalid.statusState[0]!.statuses[0]!, { movementApAdjustment: -1 })
    expect(validateCombatEncounterState(invalid)).not.toEqual([])
  })
  it('new authoring captures explicit defaults and rejects misplaced or invalid tuning', () => {
    expect(createAuthorableEffectPayload('status:fortified')).toMatchObject({
      defenseIncreaseBasisPoints: 1500,
    })
    expect(createAuthorableEffectPayload('reveal')).toMatchObject({
      increasedDamageTakenBasisPoints: 1500,
    })
    expect(
      validateCombatTagPayload({
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'slow',
        stacks: 1,
        movementApAdjustment: 27,
      }),
    ).toEqual([])
    expect(
      validateCombatTagPayload({
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'slow',
        stacks: 1,
        movementApAdjustment: -1,
      }),
    ).not.toEqual([])
    expect(
      validateCombatTagPayload({
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'inspired',
        stacks: 1,
        initiativeReductionBasisPoints: 1500,
      }),
    ).not.toEqual([])
  })
})

describe('configured Reveal', () => {
  const reveal = () =>
    action([
      {
        type: 'sensory',
        recipient: 'primary-unit',
        revealedDurationOwnerTurnStarts: 3,
        increasedDamageTakenBasisPoints: 5000,
      } as CombatEffectDefinition,
    ])
  it.each(['invisible', 'covert'])(
    'targets %s and strips both concealments while preserving unrelated buffs',
    (statusId) => {
      const state = withStatus(withStatus(encounter(), 'enemy', statusId), 'enemy', 'guarded')
      expect(evaluateCombatAction(state, reveal(), target, PV1F_COMBAT_CONTENT).legal).toBe(true)
      const result = executeCombatAction(state, reveal(), target, PV1F_COMBAT_CONTENT)
      const statuses = result.state.statusState.find((row) => row.combatantId === 'enemy')!.statuses
      expect(statuses.map((status) => status.statusId)).toEqual(['guarded', 'revealed'])
      expect(statuses.find((status) => status.statusId === 'revealed')).toMatchObject({
        increasedDamageTakenBasisPoints: 5000,
      })
      const attack = {
        ...action([{ type: 'damage', recipient: 'primary-unit', amount: 10 }]),
        accuracyRule: { kind: 'fixed' as const, chanceBasisPoints: 0 },
      }
      expect(
        forecastCombatSkillAccuracyForTarget(
          result.state,
          attack,
          'actor',
          'enemy',
          PV1F_COMBAT_CONTENT,
        )?.hitChanceBasisPoints,
      ).toBe(10000)
      expect(multiplier(result.state, 'actor', 'enemy')).toBe(15000)
      expect(revealedSkillApCost(result.state, 'enemy', 20)).toBe(20)
    },
  )
})

it('copies the saved movement adjustment and application records without restarting duration', () => {
  const cast = action([
    {
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'slow',
      stacks: 1,
      movementApAdjustment: 27,
    },
  ])
  const state = executeCombatAction(
    { ...encounter(), effectStackingPolicyVersion: 1 },
    cast,
    target,
    PV1F_COMBAT_CONTENT,
  ).state
  const copied = applyCombatStatusCopies(
    state,
    'actor',
    'enemy',
    'test.copy',
    { type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' },
    PV1F_COMBAT_CONTENT,
  ).state
  expect(copied.statusState.find((row) => row.combatantId === 'enemy')!.statuses[0]).toMatchObject({
    movementApAdjustment: 27,
    applicationModifiers: [{ movementApAdjustment: 27 }],
  })
  expect(validateCombatEncounterState(JSON.parse(JSON.stringify(copied)))).toEqual([])
})
it('keeps tuning through pending serialization and activation', () => {
  const cast = {
    ...action([
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'slow',
        stacks: 1,
        movementApAdjustment: 27,
        durationTurns: 2,
      },
    ]),
    effectTimingModes: ['next-round' as const],
  }
  let state = executeCombatAction(
    {
      ...encounter(),
      effectStackingPolicyVersion: 1,
      effectTimingPolicy: { version: 1, modes: {} },
    },
    cast,
    target,
    PV1F_COMBAT_CONTENT,
  ).state
  expect(state.pendingEffects![0]!.effect).toMatchObject({ movementApAdjustment: 27 })
  expect(pendingCombatStatusRows(state)[0]!.status).toMatchObject({ movementApAdjustment: 27 })
  expect(
    combatWalkingModifiers(
      state as StatDrivenCombatEncounterState,
      PV1F_COMBAT_CONTENT,
    ).additionalApAt({ x: 0, y: 0 }),
  ).toBe(0)
  state = JSON.parse(JSON.stringify(state))
  for (let turn = 0; turn < 4; turn++)
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    ).state
  const status = state.statusState
    .find((row) => row.combatantId === 'actor')!
    .statuses.find((row) => row.statusId === 'slow')
  expect(status).toMatchObject({
    movementApAdjustment: 27,
    applicationModifiers: [{ movementApAdjustment: 27 }],
  })
})
it('a missed configured Reveal preserves concealments and buffs', () => {
  const state = withStatus(withStatus(encounter(), 'enemy', 'invisible'), 'enemy', 'guarded')
  const cast = {
    ...action([
      {
        type: 'sensory',
        recipient: 'primary-unit',
        revealedDurationOwnerTurnStarts: 3,
        increasedDamageTakenBasisPoints: 5000,
      },
    ]),
    accuracyRule: { kind: 'fixed' as const, chanceBasisPoints: 0 },
  }
  const result = executeCombatAction(state, cast, target, PV1F_COMBAT_CONTENT)
  expect(
    result.state.statusState
      .find((row) => row.combatantId === 'enemy')!
      .statuses.map((row) => row.statusId),
  ).toEqual(['guarded', 'invisible'])
})
it('configured Reveal strips both concealments together', () => {
  const state = withStatus(withStatus(encounter(), 'enemy', 'covert'), 'enemy', 'invisible')
  const result = executeCombatAction(
    state,
    action([
      {
        type: 'sensory',
        recipient: 'primary-unit',
        revealedDurationOwnerTurnStarts: 3,
        increasedDamageTakenBasisPoints: 5000,
      },
    ]),
    target,
    PV1F_COMBAT_CONTENT,
  )
  expect(
    result.state.statusState
      .find((row) => row.combatantId === 'enemy')!
      .statuses.map((row) => row.statusId),
  ).toEqual(['revealed'])
})

it.each(['armor', 'ward'] as const)(
  'Fortified changes the actual %s mitigation used by direct damage',
  (defenseKind) => {
    const state = tuned(encounter(), 'enemy', 'fortified', { defenseIncreaseBasisPoints: 5000 })
    const withDefense = {
      ...state,
      statBridge: {
        ...state.statBridge,
        combatants: state.statBridge.combatants.map((row) =>
          row.combatantId === 'enemy' ? { ...row, [defenseKind]: 100 } : row,
        ),
      },
    }
    const cast = action([{ type: 'damage', recipient: 'primary-unit', amount: 40, defenseKind }])
    const evaluation = evaluateCombatAction(withDefense, cast, target, PV1F_COMBAT_CONTENT)
    const result = executeCombatAction(withDefense, cast, target, PV1F_COMBAT_CONTENT)
    expect(evaluation.projectedEffects.find((row) => row.effectType === 'damage')?.after).toBe(9)
    expect(result.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(9)
  },
)

it('stores each Defenseless total multiplier independently instead of reusing the latest value', () => {
  let state: CombatEncounterState = { ...encounter(), effectStackingPolicyVersion: 1 }
  for (const damageTakenMultiplierBasisPoints of [15000, 20000])
    state = executeCombatAction(
      state,
      action([
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'lowered-guard',
          stacks: 1,
          damageTakenMultiplierBasisPoints,
        },
      ]),
      target,
      PV1F_COMBAT_CONTENT,
    ).state
  const result = executeCombatAction(
    JSON.parse(JSON.stringify(state)),
    action([{ type: 'damage', recipient: 'primary-unit', amount: 4 }]),
    target,
    PV1F_COMBAT_CONTENT,
  )
  expect(result.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(13)
})

it('ignores pending defense, movement and accuracy tuning', () => {
  const state = tuned(
    tuned(
      tuned(encounter(), 'actor', 'fortified', { defenseIncreaseBasisPoints: 5000 }),
      'actor',
      'slow',
      { movementApAdjustment: 27 },
    ),
    'enemy',
    'revealed',
    { increasedDamageTakenBasisPoints: 5000 },
  )
  const pending = {
    ...state,
    statusState: state.statusState.map((row) => ({
      ...row,
      statuses: row.statuses.map((status) => ({ ...status, timingState: 'pending' as const })),
    })),
  }
  expect(terrainAdjustedDefense(pending, 'actor', 100)).toBe(100)
  expect(combatWalkingModifiers(pending, PV1F_COMBAT_CONTENT).additionalApAt({ x: 0, y: 0 })).toBe(
    0,
  )
  const attack = {
    ...action([{ type: 'damage', recipient: 'primary-unit', amount: 10 }]),
    accuracyRule: { kind: 'fixed' as const, chanceBasisPoints: 0 },
  }
  expect(
    forecastCombatSkillAccuracyForTarget(pending, attack, 'actor', 'enemy', PV1F_COMBAT_CONTENT)
      ?.hitChanceBasisPoints,
  ).toBe(0)
})

it('uses an explicit Drenched reduction even with an older elemental policy', () => {
  const state = {
    ...tuned(encounter(), 'enemy', 'wet', { initiativeReductionBasisPoints: 5000 }),
    dynamicInitiativePolicyVersion: 1 as const,
    elementalDamagePolicyVersion: 1 as const,
  }
  expect(
    synchronizeCombatInitiative(state).tactical.battle.activeInitiativeModifiers?.find(
      (row) => row.combatantId === 'enemy',
    )?.amount,
  ).toBe(-15)
})

it('honors explicit zero outgoing damage and vulnerability above 100 percent', () => {
  const fortified = tuned(encounter(), 'actor', 'fortified', { defenseIncreaseBasisPoints: 10000 })
  expect(multiplier(fortified, 'actor', 'enemy')).toBe(0)
  const revealed = tuned(encounter(), 'enemy', 'revealed', {
    increasedDamageTakenBasisPoints: 25000,
  })
  expect(multiplier(revealed, 'actor', 'enemy')).toBe(35000)
})
