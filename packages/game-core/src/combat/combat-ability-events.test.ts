import { createCombatTriggerGuard } from './combat-kernel-types'
import { commitCombatAbilityCommand, prepareCombatAbilityCommand } from './combat-ability-command'
import type { AbilityBehavior } from './combat-definition'
import type { CombatEncounterState } from './actions'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { describe, expect, it } from 'vitest'
import {
  automaticAbilityEventSupported,
  createCombatAbilityEventSession,
  captureCombatAbilityEventFrame,
  captureCombatAbilityMutation,
  combatAbilityFrameRequirements,
  processCombatAbilityEvent,
  resolveAutomaticAbilitySelection,
  type CombatAbilityEventFrame,
} from './combat-ability-events'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'

const frame: CombatAbilityEventFrame = {
  id: 'frame-1',
  mutationOrdinal: 1,
  events: [{ type: 'damage_applied', phase: 'after' }],
  subjects: [],
  resourceMutations: [],
  placements: [],
  triggeringCombatantId: 'enemy',
  selectedCombatantId: 'other',
  affectedCombatantIds: ['ally'],
}
describe('Automatic event capability and causal binding', () => {
  it('admits only actual supported event phases', () => {
    expect(automaticAbilityEventSupported('combat_action_used', 'before')).toBe(true)
    expect(automaticAbilityEventSupported('damage_applied', 'after')).toBe(true)
    expect(automaticAbilityEventSupported('damage_applied', 'before')).toBe(false)
    expect(automaticAbilityEventSupported('combat_accuracy_resolved', 'after')).toBe(false)
    expect(automaticAbilityEventSupported('invented', 'after')).toBe(false)
  })
  it.each([
    ['owner', 'actor'],
    ['triggering', 'enemy'],
    ['selected', 'other'],
    ['affected', 'ally'],
  ] as const)('binds %s to the immutable causal identity', (subject, id) => {
    const captured = source({ activation: 'automatic', automaticTarget: { subject } })
    expect(
      resolveAutomaticAbilitySelection(
        percentageDotEncounter(),
        captured,
        captured.definition.behaviors[0]!,
        frame,
      ),
    ).toEqual({ selection: { kind: 'unit', combatantId: id } })
  })
  it('missing and plural affected roles never select a fallback', () => {
    const captured = source({ activation: 'automatic', automaticTarget: { subject: 'affected' } })
    for (const affectedCombatantIds of [[], ['enemy', 'other']])
      expect(
        resolveAutomaticAbilitySelection(
          percentageDotEncounter(),
          captured,
          captured.definition.behaviors[0]!,
          { ...frame, affectedCombatantIds },
        ),
      ).toEqual({ suppression: 'automatic-target-role-unavailable' })
    expect(
      resolveAutomaticAbilitySelection(
        percentageDotEncounter(),
        captured,
        captured.definition.behaviors[0]!,
        { ...frame, affectedCombatantIds: ['absent'] },
      ),
    ).toEqual({ suppression: 'automatic-target-unit-unavailable' })
  })
})

it('detaches exact changed resources and rejects fabricated/foreign session frames', () => {
  const before = percentageDotEncounter(),
    context = combatAbilityCommandContext(before, source())
  const session = createCombatAbilityEventSession(context.triggerGuard)
  const after = {
    ...before,
    tactical: {
      ...before.tactical,
      battle: {
        ...before.tactical.battle,
        combatants: before.tactical.battle.combatants.map((u) =>
          u.id === 'actor' ? { ...u, hp: u.hp - 10 } : u,
        ),
      },
    },
  }
  const captured = captureCombatAbilityEventFrame(before, after, 'payment', session, {
    events: [{ type: 'hp_spent', phase: 'after' }],
    triggeringCombatantId: 'actor',
    selectedCombatantId: 'enemy',
    affectedCombatantIds: ['actor'],
    resourceMutations: [{ combatantId: 'actor', resources: ['hp'] }],
  })
  const requirements = combatAbilityFrameRequirements(captured, 'actor', captured.events[0])
  expect(requirements.owner!.previousResources).toEqual({ hp: 1000 })
  expect(requirements.owner!.resources!.hp).toBe(990)
  expect(requirements.selected!.previousResources).toBeUndefined()
  expect(Object.isFrozen(captured.subjects[0]!.after.resources)).toBe(true)
  expect(() =>
    processCombatAbilityEvent(
      after,
      { ...captured },
      PV1F_COMBAT_CONTENT,
      context,
      session,
      0,
      () => {
        throw new Error('must not execute')
      },
    ),
  ).toThrow('invalid-automatic-event-frame')
  const foreign = createCombatAbilityEventSession(context.triggerGuard)
  expect(() =>
    processCombatAbilityEvent(after, captured, PV1F_COMBAT_CONTENT, context, foreign, 0, () => {
      throw new Error('must not execute')
    }),
  ).toThrow('invalid-automatic-event-frame')
  expect(() =>
    processCombatAbilityEvent(
      after,
      captured,
      PV1F_COMBAT_CONTENT,
      context,
      { ...session },
      0,
      () => {
        throw new Error('must not execute')
      },
    ),
  ).toThrow('invalid-automatic-event-session')
})

function stateAuto(
  requirements: AbilityBehavior['requirements'] = {
    kind: 'resource-state',
    subject: 'owner',
    resource: 'hp',
    comparison: 'at-most',
    amount: 500,
  },
) {
  const captured = captureCombatAbilitySource(
    source({
      id: 'react',
      activation: 'automatic',
      classification: 'recovery',
      attackFamily: undefined,
      costs: [],
      requirements,
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
      effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
    }),
  )
  return { captured, state: reconcileCombatAbilitySources(percentageDotEncounter(), [captured]) }
}
function hp(state: CombatEncounterState, amount: number): CombatEncounterState {
  return {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor' ? { ...unit, hp: amount } : unit,
        ),
      },
    },
  }
}
it('captures down/up/down state impulses once and never rolls truth back on queued dispatch', () => {
  const { captured, state } = stateAuto(),
    context = combatAbilityCommandContext(state, captured),
    session = createCombatAbilityEventSession(context.triggerGuard)
  const frames: CombatAbilityEventFrame[] = []
  let next = state
  for (const amount of [400, 600, 400]) {
    const mutation = captureCombatAbilityMutation(next, hp(next, amount), 'hp', session, {
      events: [],
      affectedCombatantIds: ['actor'],
      resourceMutations: [{ combatantId: 'actor', resources: ['hp'] }],
    })
    next = mutation.state
    frames.push(mutation.frame)
  }
  expect(next.abilityRuntime!.conditionTruth).toEqual([
    { sourceInstanceId: captured.sourceInstanceId, behaviorId: 'react', holds: true },
  ])
  const calls: string[] = []
  for (const frame of frames) {
    const out = processCombatAbilityEvent(
      next,
      frame,
      PV1F_COMBAT_CONTENT,
      context,
      session,
      0,
      (input) => {
        calls.push(input.trigger!.id)
        return { state: input.state, events: [] }
      },
    )
    next = out.state
  }
  expect(calls).toEqual([frames[0]!.id, frames[2]!.id])
  expect(next.abilityRuntime!.conditionTruth![0]!.holds).toBe(true)
  processCombatAbilityEvent(next, frames[0]!, PV1F_COMBAT_CONTENT, context, session, 0, () => {
    throw Error('duplicate must not execute')
  })
})
it('missing restored truth seeds silently while explicit real source activation may initially pulse', () => {
  const { captured, state } = stateAuto(null),
    context = combatAbilityCommandContext(state, captured)
  const restored = JSON.parse(JSON.stringify(state)) as CombatEncounterState
  delete (restored.abilityRuntime as { conditionTruth?: unknown }).conditionTruth
  const session = createCombatAbilityEventSession(context.triggerGuard)
  const seeded = captureCombatAbilityMutation(restored, restored, 'restore', session, {
    events: [],
    affectedCombatantIds: [],
    resourceMutations: [],
  })
  let count = 0
  processCombatAbilityEvent(
    seeded.state,
    seeded.frame,
    PV1F_COMBAT_CONTENT,
    context,
    session,
    0,
    (input) => {
      count++
      return { state: input.state, events: [] }
    },
  )
  expect(count).toBe(0)
  const activated = captureCombatAbilityMutation(
    percentageDotEncounter(),
    seeded.state,
    'activate',
    session,
    { events: [], affectedCombatantIds: [], resourceMutations: [] },
    { newlyActivatedSourceIds: [captured.sourceInstanceId] },
  )
  processCombatAbilityEvent(
    activated.state,
    activated.frame,
    PV1F_COMBAT_CONTENT,
    context,
    session,
    0,
    (input) => {
      count++
      return { state: input.state, events: [] }
    },
  )
  expect(count).toBe(1)
  const kept = reconcileCombatAbilitySources(reconcileCombatAbilitySources(activated.state, []), [
    captured,
  ])
  expect(kept.abilityRuntime!.conditionTruth).toEqual(
    activated.state.abilityRuntime!.conditionTruth,
  )
})
it('a held Any state branch still allows a genuine matching event but no unrelated pulse', () => {
  const { captured, state } = stateAuto({
      kind: 'any',
      children: [
        {
          kind: 'resource-state',
          subject: 'owner',
          resource: 'hp',
          comparison: 'at-most',
          amount: 1000,
        },
        { kind: 'event', eventType: 'healing_applied', phase: 'after' },
      ],
    }),
    context = combatAbilityCommandContext(state, captured),
    session = createCombatAbilityEventSession(context.triggerGuard)
  let next = state,
    count = 0
  for (const type of ['damage_applied', 'healing_applied'] as const) {
    const mutation = captureCombatAbilityMutation(next, next, type, session, {
      events: [{ type, phase: 'after' }],
      affectedCombatantIds: ['actor'],
      resourceMutations: [],
    })
    next = mutation.state
    processCombatAbilityEvent(
      next,
      mutation.frame,
      PV1F_COMBAT_CONTENT,
      context,
      session,
      0,
      (input) => {
        count++
        return { state: input.state, events: [] }
      },
    )
  }
  expect(count).toBe(1)
})

it.each([
  { maxDepth: 8, depth: 8, reactionBudget: 32 },
  { maxDepth: 8, depth: 0, reactionBudget: 0 },
])(
  'shared depth/budget suppresses before child executor and payment: %j',
  ({ maxDepth, depth, reactionBudget }) => {
    const { captured, state } = stateAuto({
      kind: 'event',
      eventType: 'healing_applied',
      phase: 'after',
    })
    const base = combatAbilityCommandContext(state, captured),
      context = {
        ...base,
        triggerGuard: createCombatTriggerGuard({
          triggerChainId: base.provenance.triggerChainId,
          maxDepth,
          reactionBudget,
        }),
      },
      session = createCombatAbilityEventSession(context.triggerGuard)
    const mutation = captureCombatAbilityMutation(state, state, 'heal', session, {
      events: [{ type: 'healing_applied', phase: 'after' }],
      affectedCombatantIds: ['actor'],
      resourceMutations: [],
    })
    expect(
      processCombatAbilityEvent(
        mutation.state,
        mutation.frame,
        PV1F_COMBAT_CONTENT,
        context,
        session,
        depth,
        () => {
          throw Error('exhausted guard must not execute')
        },
      ).state,
    ).toEqual(mutation.state)
  },
)
it('archived truth and usage survive JSON removal/readd without resetting once-per-battle', () => {
  const { captured, state } = stateAuto({
    kind: 'event',
    eventType: 'healing_applied',
    phase: 'after',
  })
  const context = combatAbilityCommandContext(state, captured),
    session = createCombatAbilityEventSession(context.triggerGuard)
  const limited = captureCombatAbilitySource({
    ...captured,
    definition: {
      ...captured.definition,
      behaviors: captured.definition.behaviors.map((row) => ({
        ...row,
        activationLimits: ['once-per-battle'] as const,
        costs: [{ resource: 'mp' as const, amount: 1 }],
      })),
    },
  })
  const active = reconcileCombatAbilitySources(percentageDotEncounter(), [limited])
  const mutation = captureCombatAbilityMutation(active, active, 'heal', session, {
    events: [{ type: 'healing_applied', phase: 'after' }],
    affectedCombatantIds: ['actor'],
    resourceMutations: [],
  })
  const first = processCombatAbilityEvent(
    mutation.state,
    mutation.frame,
    PV1F_COMBAT_CONTENT,
    context,
    session,
    0,
    commitCombatAbilityCommand,
  )
  expect(first.state.abilityRuntime!.usage).toHaveLength(1)
  const archived = reconcileCombatAbilitySources(first.state, [])
  const restored = reconcileCombatAbilitySources(JSON.parse(JSON.stringify(archived)), [limited])
  expect(restored.abilityRuntime!.usage).toEqual(first.state.abilityRuntime!.usage)
  expect(restored.abilityRuntime!.conditionTruth).toEqual(
    first.state.abilityRuntime!.conditionTruth,
  )
  const second = captureCombatAbilityMutation(restored, restored, 'heal2', session, {
    events: [{ type: 'healing_applied', phase: 'after' }],
    affectedCombatantIds: ['actor'],
    resourceMutations: [],
  })
  const out = processCombatAbilityEvent(
    second.state,
    second.frame,
    PV1F_COMBAT_CONTENT,
    context,
    session,
    0,
    (input) =>
      prepareCombatAbilityCommand(input).evaluation.legal
        ? commitCombatAbilityCommand(input)
        : { state: input.state, events: [] },
  )
  expect(out.events).toEqual([])
  expect(out.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.mp).toBe(
    first.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.mp,
  )
})
