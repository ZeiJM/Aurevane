import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatEncounterState,
} from './actions'
import { commitCombatAbilityCommand } from './combat-ability-command'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { source } from './combat-behavior.test-utils'
import {
  applyCurrentBleedState,
  applyCurrentBurnState,
  applyCurrentPoisonState,
} from './combat-dots'
import { createCombatActionProvenance, createCombatTriggerGuard } from './combat-kernel-types'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { preparePv1fTurnEconomy } from './pv1f-action-economy'
import { PV1F_COMBAT_CONTENT as content } from './pv1f-combat-content'
import { prepareCombatRuinCommand } from './combat-ruin'

type Dot = 'poison' | 'burn' | 'bleed'
const target = { kind: 'unit', combatantId: 'enemy' } as const
const damage = { type: 'damage', recipient: 'primary-unit', amount: 20 } as const
const ruin = { type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 5000 } as const
function dotEffect(kind: Dot): Extract<CombatEffectDefinition, { type: Dot }> {
  return kind === 'bleed'
    ? { type: kind, recipient: 'primary-unit', damagePerTick: 2, ticks: 6 }
    : { type: kind, recipient: 'primary-unit', power: 2, durationTurns: 6 }
}
function encounter(kind: Dot, seeded = true, current = true): CombatEncounterState {
  const initial = {
    ...percentageDotEncounter(),
    ...(current ? { ruinPolicyVersion: 1 as const } : {}),
    effectTimingPolicy: { version: 1 as const, modes: { [kind]: 'instant' as const } },
  }
  if (!seeded) return initial
  if (kind === 'bleed') return applyCurrentBleedState(initial, 'actor', 'enemy', 'old.dot', 2, 6)
  return (kind === 'burn' ? applyCurrentBurnState : applyCurrentPoisonState)(
    initial,
    'actor',
    'enemy',
    'old.dot',
    true,
    2,
    6,
  )
}
function nativeAction(effects: readonly CombatEffectDefinition[]): CombatActionDefinition {
  return {
    id: 'test.ruin-provenance',
    version: 1,
    sourceType: 'test',
    tags: ['attack', 'physical'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      friendlyFire: 'enemies-only',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    accuracyRule: { kind: 'fixed', chanceBasisPoints: 10000 },
    effectTimingModes: effects.map(() => 'instant'),
    effects,
  }
}
function cast(state: CombatEncounterState, kind: Dot, canonical: boolean, withRuin = true) {
  const effects = [damage, dotEffect(kind), ...(withRuin ? [ruin] : [])]
  if (canonical) {
    const captured = captureCombatAbilitySource(
      source({
        effects: effects.map((payload, ordinal) => ({
          id: `packet-${ordinal}`,
          timing: 'instant',
          payload,
        })),
      }),
    )
    const bytes = JSON.stringify(captured)
    const hash = createHash('sha256').update(bytes).digest('hex')
    const ready = reconcileCombatAbilitySources(
      preparePv1fTurnEconomy(state as ReturnType<typeof percentageDotEncounter>),
      [captured],
    )
    const context = combatAbilityCommandContext(ready, captured)
    const result = commitCombatAbilityCommand({
      state: ready,
      actorId: 'actor',
      root: { kind: 'canonical', source: captured },
      selection: target,
      content,
      context,
    })
    expect(JSON.stringify(captured)).toBe(bytes)
    expect(JSON.stringify(result.state.capturedAbilitySources![0])).toBe(bytes)
    expect(
      createHash('sha256')
        .update(JSON.stringify(result.state.capturedAbilitySources![0]))
        .digest('hex'),
    ).toBe(hash)
    return { ...result, chain: context.provenance.triggerChainId, actionId: 'test.ability' }
  }
  const action = nativeAction(effects)
  const chain = `ruin-dot-suffix:${state.ruinState?.nextCommandId ?? 1}:${state.effectState?.[kind].length ?? 0}`
  const context = {
    provenance: createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'test',
      actionDefinitionId: action.id,
      actionVersion: 1,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId: chain,
    }),
    triggerGuard: createCombatTriggerGuard({ triggerChainId: chain }),
  }
  const bytes = JSON.stringify(action)
  const result = executeCombatAction(state, action, target, content, context)
  expect(JSON.stringify(action)).toBe(bytes)
  return { ...result, chain, actionId: action.id }
}

describe.each([false, true])('Ruin suffix DoT provenance (canonical=%s)', (canonical) => {
  it.each(['poison', 'burn', 'bleed'] as const)(
    'attributes the new %s when consuming the last old application reuses its native order',
    (kind) => {
      const initial = encounter(kind)
      const bytes = JSON.stringify(initial)
      const result = cast(initial, kind, canonical)
      expect(JSON.stringify(initial)).toBe(bytes)
      expect(result.state.effectState![kind]).toHaveLength(1)
      expect(result.state.effectState![kind][0]).toMatchObject({
        sourceActionId: result.actionId,
        applicationOrder: 1,
        remainingTicks: 6,
        provenance: {
          instanceId: `effect:${result.chain}:${result.actionId}:1:enemy`,
          effectOrdinal: 1,
          targetCombatantId: 'enemy',
          action: { actionDefinitionId: result.actionId, sourceCombatantId: 'actor' },
        },
      })
      expect(result.state.effectState![kind][0]!.ruinApplicationId).toBeUndefined()
      expect(result.events).toContainEqual(
        expect.objectContaining({ event: 'status_removed', statusId: kind, removalReason: 'ruin' }),
      )
      expect(result.events).toContainEqual(
        expect.objectContaining({ event: 'damage_applied', ruinBonusBasisPoints: 5000 }),
      )
      expect(result.state.ruinState!.spentTargets).toHaveLength(1)
      expect(validateCombatEncounterState(JSON.parse(JSON.stringify(result.state)))).toEqual([])
    },
  )
  it.each(['poison', 'burn', 'bleed'] as const)(
    'attributes %s without a consumed predecessor',
    (kind) => {
      const result = cast(encounter(kind, false), kind, canonical)
      expect(result.state.effectState![kind][0]!.provenance).toMatchObject({
        instanceId: `effect:${result.chain}:${result.actionId}:1:enemy`,
        effectOrdinal: 1,
      })
      expect(result.state.ruinState!.spentTargets).toEqual([])
    },
  )
  it.each(['poison', 'burn', 'bleed'] as const)(
    'preserves legacy %s without consuming its predecessor',
    (kind) => {
      const result = cast(encounter(kind, true, false), kind, canonical)
      const old = result.state.effectState![kind].find((row) => row.sourceActionId === 'old.dot')
      if (kind === 'bleed') expect(old).toBeDefined()
      expect(old?.provenance).toBeUndefined()
      expect(
        result.state.effectState![kind].find((row) => row.sourceActionId === result.actionId)!
          .provenance?.effectOrdinal,
      ).toBe(1)
      expect(result.state).not.toHaveProperty('ruinState')
    },
  )
  it.each(['poison', 'burn', 'bleed'] as const)(
    'preserves the captured %s survivor when a later plain command adds another',
    (kind) => {
      const first = cast(
        { ...encounter(kind, false), percentageDotPolicyVersion: undefined },
        kind,
        canonical,
        false,
      )
      const prepared = prepareCombatRuinCommand(first.state, nativeAction([ruin]), content).state
      const prior = prepared.effectState![kind][0]!
      expect(prior.ruinApplicationId).toBeDefined()
      const result = cast(prepared, kind, canonical, false)
      expect(result.state.effectState![kind]).toHaveLength(2)
      expect(result.state.effectState![kind][0]).toEqual(prior)
      expect(result.state.effectState![kind][1]!.provenance).toMatchObject({
        instanceId: `effect:${result.chain}:${result.actionId}:1:enemy`,
        effectOrdinal: 1,
      })
      expect(result.state.effectState![kind][1]!.ruinApplicationId).toBeUndefined()
      expect(validateCombatEncounterState(JSON.parse(JSON.stringify(result.state)))).toEqual([])
      const repeated = cast(result.state, kind, canonical, false)
      expect(repeated.state.effectState![kind]).toHaveLength(3)
      expect(repeated.state.effectState![kind].slice(0, 2)).toEqual(result.state.effectState![kind])
      expect(repeated.state.effectState![kind][2]!.provenance).toMatchObject({
        instanceId: `effect:${repeated.chain}:${repeated.actionId}:1:enemy`,
        effectOrdinal: 1,
      })
    },
  )
})
