import { expect, it } from 'vitest'
import {
  executeCombatAction,
  type CombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { resolveMatureSkillVersion, toMaterializedCombatActionDefinition } from './mature-skills'
import {
  createCurrentStatDrivenCombatEncounterState,
  createStatDrivenCombatEncounterState,
  reattachStatDrivenCombatBridge,
} from './stat-driven-combat'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  activateCombatAbility,
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'

const selection = { kind: 'unit' as const, combatantId: 'enemy' }
const flat: CombatEffectDefinition = { type: 'healing', recipient: 'actor', amount: 17 }
const percentage: CombatEffectDefinition = {
  type: 'percentage-recovery',
  recipient: 'actor',
  resource: 'hp',
  percent: 10,
  ticks: 1,
}
function encounter() {
  const state = preparePv1fTurnEconomy(percentageDotEncounter())
  return reattachStatDrivenCombatBridge(
    {
      ...state,
      effectTimingPolicy: { version: 1, modes: {} },
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) =>
            unit.id === 'actor' ? { ...unit, hp: 500 } : unit,
          ),
        },
      },
    },
    state.statBridge,
  )
}
function action(chance = 0, heal: CombatEffectDefinition = flat): CombatActionDefinition {
  return {
    ...toMaterializedCombatActionDefinition(
      resolveMatureSkillVersion('vanguard.forceful-strike')!,
      'pve',
    ),
    id: 'test.secondary-healing',
    cost: { spendsAction: false, mp: 3 },
    cooldown: undefined,
    requirements: [],
    accuracyMode: undefined,
    accuracyModifierBasisPoints: undefined,
    accuracyRule: { kind: 'fixed', chanceBasisPoints: chance },
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 10 }, heal],
  }
}
const actor = (state: Pick<CombatEncounterState, 'tactical'>) =>
  state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!
it.each([
  { name: 'flat miss', chance: 0, heal: flat, hp: 500 },
  { name: 'flat hit', chance: 10000, heal: flat, hp: 517 },
  { name: 'percentage miss', chance: 0, heal: percentage, hp: 500 },
  { name: 'percentage hit', chance: 10000, heal: percentage, hp: 600 },
])('uses confirmed hostile hits for native secondary HP healing: $name', ({ chance, heal, hp }) => {
  const initial = encounter()
  const result = executeCombatAction(initial, action(chance, heal), selection, PV1F_COMBAT_CONTENT)
  expect(actor(result.state).hp).toBe(hp)
  expect(actor(result.state).mp).toBe(17)
  expect(result.events).toContainEqual(
    expect.objectContaining({ event: 'combat_accuracy_resolved', hit: chance > 0 }),
  )
  expect(result.events.some((event) => event.event === 'healing_applied')).toBe(chance > 0)
  expect(actor(initial).hp).toBe(500)
})
it('does not queue delayed secondary healing after a miss', () => {
  const initial = {
    ...encounter(),
    effectTimingPolicy: { version: 2, modes: { healing: 'delayed' as const } },
  }
  const result = executeCombatAction(initial, action(), selection, PV1F_COMBAT_CONTENT)
  expect(result.state.pendingEffects ?? []).toEqual([])
  expect(result.state.effectState?.ongoingRecovery ?? []).toEqual([])
  expect(actor(result.state).hp).toBe(500)
})
it.each([false, true])(
  'heals once for a multi-target attack only if a hostile target is hit: %s',
  (oneHit) => {
    const initial = encounter()
    const state = createStatDrivenCombatEncounterState(
      initial,
      initial.statBridge.combatants.map((profile) => ({
        ...profile,
        evasion: profile.combatantId === 'enemy' && oneHit ? 0 : 10000,
      })),
    )
    const root = action()
    const area: CombatActionDefinition = {
      ...root,
      accuracyRule: undefined,
      accuracyMode: 'per-target',
      target: {
        ...root.target,
        kind: 'ground-tile',
        shape: { kind: 'circle', radius: 1 },
        maximumRange: 4,
      },
      effects: [{ type: 'damage', recipient: 'affected-units', amount: 10 }, flat],
    }
    const result = executeCombatAction(
      state,
      area,
      { kind: 'tile', position: { x: 2, y: 1 } },
      PV1F_COMBAT_CONTENT,
    )
    expect(actor(result.state).hp).toBe(oneHit ? 517 : 500)
    expect(result.events.filter((event) => event.event === 'healing_applied')).toHaveLength(
      oneHit ? 1 : 0,
    )
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'other')!.hp).toBe(
      1000,
    )
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'combat_accuracy_resolved',
        targetCombatantId: 'other',
        hit: false,
      }),
    )
  },
)
it('a confirmed hit still heals when Barrier absorbs all HP damage', () => {
  const initial = encounter()
  const state = {
    ...initial,
    effectState: {
      poison: [],
      burn: [],
      bleed: [],
      ongoingRecovery: [],
      damageHistory: [],
      barriers: [
        {
          targetCombatantId: 'enemy',
          sourceCombatantId: 'enemy',
          sourceActionId: 'test.barrier',
          amount: 1000,
          applicationOrder: 1,
        },
      ],
    },
  }
  const result = executeCombatAction(state, action(10000), selection, PV1F_COMBAT_CONTENT)
  expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(1000)
  expect(actor(result.state).hp).toBe(517)
})
it('a killing hit can heal its still-living caster', () => {
  const initial = encounter()
  const state = {
    ...initial,
    tactical: {
      ...initial.tactical,
      battle: {
        ...initial.tactical.battle,
        combatants: initial.tactical.battle.combatants.map((unit) =>
          unit.id === 'enemy' ? { ...unit, hp: 1 } : unit,
        ),
      },
    },
  }
  const result = executeCombatAction(state, action(10000), selection, PV1F_COMBAT_CONTENT)
  expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(0)
  expect(actor(result.state).hp).toBe(517)
})
it('preserves standalone self recovery without requiring an attack', () => {
  const initial = encounter()
  const root = action()
  const heal: CombatActionDefinition = {
    ...root,
    accuracyRule: undefined,
    tags: ['recovery'],
    target: {
      ...root.target,
      kind: 'self',
      teamPolicy: 'self',
      friendlyFire: 'allies-only',
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
    },
    effects: [flat],
  }
  const result = executeCombatAction(initial, heal, { kind: 'self' }, PV1F_COMBAT_CONTENT)
  expect(actor(result.state).hp).toBe(517)
})
it.each([0, 10000])(
  'uses the same hit dependency for captured Manual actions and preserves one AP/MP/HP payment: %s',
  (chance) => {
    const initial = encounter()
    const captured = captureCombatAbilitySource(
      source({
        accuracy: { kind: 'fixed', chanceBasisPoints: chance },
        effects: [
          { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 10 } },
          { id: 'heal', payload: flat },
        ],
      }),
    )
    const state = reconcileCombatAbilitySources(initial, [captured])
    const result = activateCombatAbility({
      state,
      actorId: 'actor',
      source: captured,
      selection,
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, captured),
    })
    const unit = result.state.tactical.battle.combatants.find((row) => row.id === 'actor')!
    expect(unit.hp).toBe(chance > 0 ? 516 : 499)
    expect(unit.mp).toBe(18)
    expect(unit.temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current).toBe(
      89,
    )
    expect(result.events.some((event) => event.event === 'healing_applied')).toBe(chance > 0)
    expect(result.state.tactical.battle.rng.draws - initial.tactical.battle.rng.draws).toBe(1)
  },
)
it('retains the independent Fire caster cleanse when a missed attack cannot heal', () => {
  const initial = encounter()
  const root = action()
  const state = {
    ...initial,
    effectTimingPolicy: { version: 1, modes: { 'remove-status': 'instant' as const } },
    elementalDamagePolicyVersion: 2 as const,
    statusState: initial.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'frozen',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'enemy',
              },
            ],
          }
        : row,
    ),
  }
  const fire = {
    ...root,
    effects: [
      {
        type: 'damage' as const,
        recipient: 'primary-unit' as const,
        amount: 10,
        element: 'fire' as const,
      },
      flat,
      { type: 'remove-status' as const, recipient: 'actor' as const, statusIds: ['frozen'] },
    ],
  }
  const result = executeCombatAction(state, fire, selection, PV1F_COMBAT_CONTENT)
  expect(
    result.state.statusState.find((row) => row.combatantId === 'actor')?.statuses ?? [],
  ).toEqual([])
  expect(actor(result.state).hp).toBe(500)
})
it.each([0, 10000])(
  'keeps repeated native damage packets dependent on real hits without multiplying caster healing: %s',
  (chance) => {
    const base = encounter()
    const current = createCurrentStatDrivenCombatEncounterState(
      base,
      base.statBridge.combatants.map((profile) => ({
        ...profile,
        physicalPower: 20,
        mysticPower: 20,
        level: 1,
        criticalChance: 0,
        statusResistance: 0,
      })),
    )
    const initial = { ...current, skillPacketPolicyVersion: 1 as const }
    const root = action(chance)
    const result = executeCombatAction(
      initial,
      { ...root, effects: [root.effects[0]!, root.effects[0]!, flat] },
      selection,
      PV1F_COMBAT_CONTENT,
    )
    expect(actor(result.state).hp).toBe(chance ? 517 : 500)
    expect(result.events.filter((event) => event.event === 'healing_applied')).toHaveLength(
      chance ? 1 : 0,
    )
  },
)
it('does not treat an ineligible conditional damage packet as a hit authorizing secondary healing', () => {
  const initial = encounter()
  const captured = captureCombatAbilitySource(
    source({
      accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
      effects: [
        {
          id: 'hit',
          requirements: {
            kind: 'resource-state',
            subject: 'owner',
            resource: 'mp',
            comparison: 'at-least',
            amount: 999,
          },
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
        { id: 'heal', payload: flat },
      ],
    }),
  )
  const state = reconcileCombatAbilitySources(initial, [captured])
  const result = activateCombatAbility({
    state,
    actorId: 'actor',
    source: captured,
    selection,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  })
  expect(result.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp).toBe(499)
  expect(
    result.events.some(
      (event) => event.event === 'damage_applied' || event.event === 'healing_applied',
    ),
  ).toBe(false)
})
it('suppresses secondary healing after a paid attack loses its target to a before-use reaction', () => {
  const initial = encounter()
  const captured = captureCombatAbilitySource(
    source({
      effects: [
        { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 10 } },
        { id: 'heal', payload: flat },
      ],
    }),
  )
  const hide = captureCombatAbilitySource({
    ...source(
      {
        id: 'hide',
        activation: 'automatic',
        classification: 'utility',
        attackFamily: undefined,
        costs: [{ resource: 'mp', amount: 1 }],
        activationLimits: ['once-per-action'],
        requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
        automaticTarget: { subject: 'owner' },
        targeting: {
          kind: 'self',
          teamPolicy: 'self',
          friendlyFire: 'allies-only',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 0,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          maximumSelections: 1,
        },
        effects: [
          {
            id: 'hide',
            timing: 'instant',
            payload: { type: 'apply-status', recipient: 'actor', statusId: 'invisible', stacks: 1 },
          },
        ],
      },
      'enemy-hide',
    ),
    abilityId: 'enemy.hide',
    ownerCombatantId: 'enemy',
  })
  const state = reconcileCombatAbilitySources(initial, [captured, hide])
  const result = activateCombatAbility({
    state,
    actorId: 'actor',
    source: captured,
    selection,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  })
  const unit = result.state.tactical.battle.combatants.find((row) => row.id === 'actor')!
  expect(result.events).toContainEqual(
    expect.objectContaining({ event: 'combat_action_interrupted', reason: 'selection-invalid' }),
  )
  expect(unit.hp).toBe(499)
  expect(unit.mp).toBe(18)
  expect(unit.temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current).toBe(89)
  expect(result.events.some((event) => event.event === 'healing_applied')).toBe(false)
})
