import { combatAbilityCommandContext } from './combat-behavior-runtime'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { describe, expect, it } from 'vitest'
import {
  automaticAbilityEventSupported,
  createCombatAbilityEventSession,
  captureCombatAbilityEventFrame,
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
