import { describe, expect, it } from 'vitest'
import {
  automaticAbilityEventSupported,
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
