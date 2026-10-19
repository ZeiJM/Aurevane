import { createCombatTriggerGuard } from './combat-kernel-types'
import {
  commitCombatAbilityCommand,
  prepareCombatAbilityCommand,
  activateCombatAbilitySources,
} from './combat-ability-command'
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
it.each([2, 3, undefined] as const)(
  'activates supported owner-triggered Circle/All with canonical geometry %s and pays once',
  (geometryVersion) => {
    for (const shape of [{ kind: 'circle', radius: 1 }, { kind: 'all' }] as const) {
      const captured = captureCombatAbilitySource(
        source({
          activation: 'automatic',
          classification: 'recovery',
          attackFamily: undefined,
          activationLimits: ['once-per-battle'],
          costs: [{ resource: 'mp', amount: 1 }],
          requirements: { kind: 'event', eventType: 'healing_applied', phase: 'after' },
          targeting: {
            kind: 'unit',
            teamPolicy: 'ally',
            friendlyFire: 'allies-only',
            ...(geometryVersion !== undefined ? { geometryVersion } : {}),
            ...(geometryVersion === 3 ? { categories: ['self' as const, 'ally' as const] } : {}),
            shape,
            minimumRange: 0,
            maximumRange: shape.kind === 'circle' ? 1 : 0,
            requiresLineOfSight: false,
            maximumElevationDifference: null,
            maximumSelections: 1,
          },
          effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 5 } }],
        }),
      )
      const state = reconcileCombatAbilitySources(hp(percentageDotEncounter(), 500), [captured])
      const context = combatAbilityCommandContext(state, captured)
      const session = createCombatAbilityEventSession(context.triggerGuard)
      const mutation = captureCombatAbilityMutation(state, state, 'heal-area', session, {
        events: [{ type: 'healing_applied', phase: 'after' }],
        affectedCombatantIds: ['actor'],
        resourceMutations: [],
      })
      expect(
        resolveAutomaticAbilitySelection(
          mutation.state,
          captured,
          captured.definition.behaviors[0]!,
          mutation.frame,
        ),
      ).toEqual({ selection: { kind: 'activate' } })
      const first = processCombatAbilityEvent(
        mutation.state,
        mutation.frame,
        PV1F_COMBAT_CONTENT,
        context,
        session,
        0,
        commitCombatAbilityCommand,
      )
      expect(
        first.events.filter((e) => e.event === 'healing_applied').map((e) => e.targetCombatantId),
      ).toEqual(['actor'])
      const owner = first.state.tactical.battle.combatants.find((u) => u.id === 'actor')!
      expect(owner.hp).toBeGreaterThan(500)
      expect(owner.mp).toBe(19)
      expect(
        processCombatAbilityEvent(
          first.state,
          mutation.frame,
          PV1F_COMBAT_CONTENT,
          context,
          session,
          0,
          commitCombatAbilityCommand,
        ).events,
      ).toEqual([])
      const second = captureCombatAbilityMutation(
        first.state,
        first.state,
        'heal-area-again',
        session,
        {
          events: [{ type: 'healing_applied', phase: 'after' }],
          affectedCombatantIds: ['actor'],
          resourceMutations: [],
        },
      )
      const again = processCombatAbilityEvent(
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
      expect(again.events).toEqual([])
      expect(again.state.tactical.battle.combatants.find((u) => u.id === 'actor')!.mp).toBe(19)
    }
  },
)
describe('Automatic event capability and causal binding', () => {
  it('resolves the entire causal plural set and aligned Line or Ground without a guessed subject', () => {
    const base = source({
      activation: 'automatic',
      automaticTarget: { subject: 'affected' },
      targeting: {
        ...source().definition.behaviors[0]!.targeting!,
        geometryVersion: 3,
        categories: ['enemy'],
        maximumSelections: 3,
      },
    })
    const behavior = base.definition.behaviors[0]!
    expect(
      resolveAutomaticAbilitySelection(percentageDotEncounter(), base, behavior, {
        ...frame,
        affectedCombatantIds: ['enemy', 'other'],
      }),
    ).toEqual({
      selection: {
        kind: 'selections',
        selections: [
          { kind: 'unit', combatantId: 'enemy' },
          { kind: 'unit', combatantId: 'other' },
        ],
      },
    })
    expect(
      resolveAutomaticAbilitySelection(percentageDotEncounter(), base, behavior, {
        ...frame,
        affectedCombatantIds: ['enemy', 'other', 'ally', 'actor'],
      }),
    ).toEqual({ suppression: 'automatic-target-role-unavailable' })
    const line = {
      ...behavior,
      targeting: {
        ...behavior.targeting!,
        maximumSelections: 1,
        shape: { kind: 'line' as const, length: 3 },
        maximumRange: 3,
      },
    }
    expect(
      resolveAutomaticAbilitySelection(percentageDotEncounter(), base, line, {
        ...frame,
        affectedCombatantIds: ['other'],
      }),
    ).toEqual({ selection: { kind: 'direction', direction: 'east' } })
    expect(
      resolveAutomaticAbilitySelection(percentageDotEncounter(), base, line, {
        ...frame,
        affectedCombatantIds: ['enemy', 'other'],
      }),
    ).toEqual({ suppression: 'automatic-target-role-unavailable' })
    const ground = {
      ...behavior,
      targeting: {
        ...behavior.targeting!,
        kind: 'ground-tile' as const,
        categories: ['ground' as const],
      },
    }
    expect(
      resolveAutomaticAbilitySelection(percentageDotEncounter(), base, ground, {
        ...frame,
        affectedCombatantIds: ['other'],
      }),
    ).toEqual({ selection: { kind: 'tile', position: { x: 3, y: 1 } } })
    for (const kind of ['circle', 'all'] as const)
      expect(
        resolveAutomaticAbilitySelection(
          percentageDotEncounter(),
          base,
          {
            ...behavior,
            automaticTarget: undefined,
            targeting: {
              ...behavior.targeting!,
              maximumSelections: 1,
              shape: kind === 'circle' ? { kind, radius: 2 } : { kind },
              maximumRange: kind === 'circle' ? 2 : 0,
            },
          },
          frame,
        ),
      ).toEqual({ selection: { kind: 'activate' } })
  })
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

it('keeps parent selected trigger Requirements separate from child Self effect gates', () => {
  const { captured: original } = stateAuto({
    kind: 'all',
    children: [
      { kind: 'event', eventType: 'healing_applied', phase: 'after' },
      {
        kind: 'resource-state',
        subject: 'selected',
        resource: 'hp',
        comparison: 'at-most',
        amount: 500,
      },
    ],
  })
  const captured = captureCombatAbilitySource({
    ...original,
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          ...original.definition.behaviors[0]!,
          costs: [{ resource: 'mp', amount: 1 }],
          effects: [
            {
              id: 'heal',
              requirements: {
                kind: 'resource-state',
                subject: 'selected',
                resource: 'hp',
                comparison: 'at-least',
                amount: 800,
              },
              payload: { type: 'healing', recipient: 'actor', amount: 1 },
            },
          ],
        },
      ],
    },
  })
  const base = hp(percentageDotEncounter(), 800)
  const state = reconcileCombatAbilitySources(
    {
      ...base,
      tactical: {
        ...base.tactical,
        battle: {
          ...base.tactical.battle,
          combatants: base.tactical.battle.combatants.map((unit) =>
            unit.id === 'enemy' ? { ...unit, hp: 400 } : unit,
          ),
        },
      },
    },
    [captured],
  )
  const context = combatAbilityCommandContext(state, captured)
  const session = createCombatAbilityEventSession(context.triggerGuard)
  const mutation = captureCombatAbilityMutation(state, state, 'parent-heal-selected', session, {
    events: [{ type: 'healing_applied', phase: 'after' }],
    selectedCombatantId: 'enemy',
    affectedCombatantIds: ['enemy'],
    resourceMutations: [],
  })
  const child = processCombatAbilityEvent(
    mutation.state,
    mutation.frame,
    PV1F_COMBAT_CONTENT,
    context,
    session,
    0,
    commitCombatAbilityCommand,
  )
  expect(child.events).toContainEqual(
    expect.objectContaining({ event: 'healing_applied', targetCombatantId: 'actor', amount: 1 }),
  )
  const actor = child.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!
  expect(actor.hp).toBe(801)
  expect(actor.mp).toBe(19)
  expect(child.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(400)
})

it('dispatches Simple after-action on its actual owner frame while retaining a null stored Requirement', () => {
  const base = stateAuto(null).captured
  const captured = captureCombatAbilitySource({
    ...base,
    definition: {
      ...base.definition,
      behaviors: [
        {
          ...base.definition.behaviors[0]!,
          requirementMode: 'simple',
          automaticTrigger: 'after-action',
        },
      ],
    },
  })
  const state = reconcileCombatAbilitySources(percentageDotEncounter(), [captured])
  const context = combatAbilityCommandContext(state, captured)
  const session = createCombatAbilityEventSession(context.triggerGuard)
  const calls: string[] = []
  for (const triggeringCombatantId of ['enemy', 'actor', 'actor']) {
    const mutation = captureCombatAbilityMutation(state, state, 'action', session, {
      events: [{ type: 'combat_action_used', phase: 'after' }],
      triggeringCombatantId,
      selectedCombatantId: 'enemy',
      affectedCombatantIds: [],
      resourceMutations: [],
    })
    processCombatAbilityEvent(
      mutation.state,
      mutation.frame,
      PV1F_COMBAT_CONTENT,
      context,
      session,
      0,
      (input) => {
        calls.push(input.trigger!.triggeringCombatantId!)
        expect(
          input.root.kind === 'canonical' &&
            input.root.source.definition.behaviors[0]!.requirements,
        ).toBeNull()
        return { state: input.state, events: [] }
      },
    )
  }
  expect(calls).toEqual(['actor', 'actor'])
})

it('Simple None fires only on genuine fresh-source activation and Simple owner state fires on entry', () => {
  for (const requirements of [
    null,
    {
      kind: 'resource-state',
      subject: 'owner',
      resource: 'hp',
      comparison: 'less-than',
      basisPoints: 5000,
    },
  ] as const) {
    const base = stateAuto(null).captured
    const captured = captureCombatAbilitySource({
      ...base,
      definition: {
        ...base.definition,
        behaviors: [{ ...base.definition.behaviors[0]!, requirementMode: 'simple', requirements }],
      },
    })
    let state = reconcileCombatAbilitySources(percentageDotEncounter(), [captured])
    const context = combatAbilityCommandContext(state, captured)
    const session = createCombatAbilityEventSession(context.triggerGuard)
    let count = 0
    const apply = (mutation: ReturnType<typeof captureCombatAbilityMutation>) => {
      const result = processCombatAbilityEvent(
        mutation.state,
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
      state = result.state
    }
    const facts = { events: [], affectedCombatantIds: [], resourceMutations: [] }
    apply(captureCombatAbilityMutation(state, state, 'read', session, facts))
    expect(count).toBe(0)
    if (requirements === null) {
      apply(
        captureCombatAbilityMutation(percentageDotEncounter(), state, 'fresh', session, facts, {
          newlyActivatedSourceIds: [captured.sourceInstanceId],
        }),
      )
      expect(count).toBe(1)
      apply(captureCombatAbilityMutation(state, state, 'held', session, facts))
      expect(count).toBe(1)
    } else {
      for (const amount of [500, 400, 400, 600, 400])
        apply(captureCombatAbilityMutation(state, hp(state, amount), 'state', session, facts))
      expect(count).toBe(2)
    }
    const restored = JSON.parse(JSON.stringify(state)) as CombatEncounterState
    apply(captureCombatAbilityMutation(restored, restored, 'restore', session, facts))
    expect(count).toBe(requirements === null ? 1 : 2)
  }
})

it('Simple execution metadata retains parent condition snapshots while child effect gates use child geometry', () => {
  const original = stateAuto(null).captured
  const captured = captureCombatAbilitySource({
    ...original,
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          ...original.definition.behaviors[0]!,
          requirementMode: 'simple',
          automaticTrigger: 'after-action',
          costs: [{ resource: 'mp', amount: 1 }],
          requirements: {
            kind: 'resource-state',
            subject: 'selected',
            resource: 'hp',
            comparison: 'less-than',
            basisPoints: 5000,
          },
          effects: [
            {
              id: 'heal',
              requirements: {
                kind: 'resource-state',
                subject: 'selected',
                resource: 'hp',
                comparison: 'more-than',
                basisPoints: 7000,
              },
              payload: { type: 'healing', recipient: 'actor', amount: 1 },
            },
          ],
        },
      ],
    },
  })
  const changeEnemyHp = (state: CombatEncounterState, amount: number): CombatEncounterState => ({
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((unit) =>
          unit.id === 'enemy' ? { ...unit, hp: amount } : unit,
        ),
      },
    },
  })
  const state = reconcileCombatAbilitySources(
    changeEnemyHp(hp(percentageDotEncounter(), 800), 400),
    [captured],
  )
  const context = combatAbilityCommandContext(state, captured)
  const session = createCombatAbilityEventSession(context.triggerGuard)
  const mutation = captureCombatAbilityMutation(state, state, 'simple-parent', session, {
    events: [{ type: 'combat_action_used', phase: 'after' }],
    triggeringCombatantId: 'actor',
    selectedCombatantId: 'enemy',
    affectedCombatantIds: [],
    resourceMutations: [],
  })
  const child = processCombatAbilityEvent(
    changeEnemyHp(mutation.state, 900),
    mutation.frame,
    PV1F_COMBAT_CONTENT,
    context,
    session,
    0,
    commitCombatAbilityCommand,
  )
  expect(child.events).toContainEqual(
    expect.objectContaining({ event: 'healing_applied', targetCombatantId: 'actor', amount: 1 }),
  )
  expect(child.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')).toMatchObject({
    hp: 801,
    mp: 19,
  })
})

it.each(['self', 'unit'] as const)(
  'Simple None genuinely activates once with an owner binding on %s Self geometry',
  (kind) => {
    const base = stateAuto(null).captured
    const original = base.definition.behaviors[0]!
    const captured = captureCombatAbilitySource({
      ...base,
      definition: {
        schemaVersion: 1,
        behaviors: [
          {
            ...original,
            requirementMode: 'simple',
            automaticTarget: { subject: 'owner' },
            targeting: { ...original.targeting!, geometryVersion: 3, categories: ['self'], kind },
          },
        ],
      },
    })
    const activated = activateCombatAbilitySources(
      hp(percentageDotEncounter(), 500),
      [captured],
      PV1F_COMBAT_CONTENT,
    )
    expect(activated.events.filter((event) => event.event === 'healing_applied')).toHaveLength(1)
    expect(activated.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp).toBe(
      501,
    )
    const restored = activateCombatAbilitySources(activated.state, [captured], PV1F_COMBAT_CONTENT)
    expect(restored.events.filter((event) => event.event === 'healing_applied')).toHaveLength(0)
    expect(() =>
      captureCombatAbilitySource({
        ...base,
        definition: {
          schemaVersion: 1,
          behaviors: [
            { ...captured.definition.behaviors[0]!, automaticTarget: { subject: 'selected' } },
          ],
        },
      }),
    ).toThrow()
  },
)
