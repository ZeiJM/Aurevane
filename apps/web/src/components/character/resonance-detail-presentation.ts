import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import { normalizedResonanceMechanics } from '@aurevane/game-core/combat/resonance-v2'
import { previewEffect } from './skill-effect-preview'
import { skillEffectSummaries } from './skill-detail-presentation'
import { skillInformationRows, type SkillCharacteristic } from './skill-information-contract'

function disciplineName(id: string): string {
  return id.replace(/[._-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function resonanceResultRecipient(effect: CombatEffectDefinition): string {
  switch (effect.recipient) {
    case 'actor':
      return 'Self'
    case 'primary-unit':
      return 'Trigger Skill selected unit'
    case 'affected-units':
      return 'Trigger Skill affected units'
    case 'affected-tiles':
      return 'Trigger Skill affected tiles'
  }
}

/** Resonance adds effects to its Trigger Skill; it has no independent action or Target Spec. */
export function resonanceCharacteristicRows(
  definition: AnyResonanceDefinition | null | undefined,
): readonly SkillCharacteristic[] {
  if (!definition) {
    return skillInformationRows({
      'Skill Type': 'Unavailable',
      Cost: 'Unavailable',
      Cooldown: 'Unavailable',
      Requirements: 'Unavailable',
      Effects: 'Unavailable',
      Range: 'Unavailable',
      Target: 'Unavailable',
      'Target Method': 'Unavailable',
      'Target Elevation': 'Unavailable',
      'Line of Sight': 'Unavailable',
    })
  }
  const mechanics = normalizedResonanceMechanics(definition)
  const setup = mechanics.setup
  const matcher = (value: typeof mechanics.trigger) =>
    `${disciplineName(value.sourceDisciplineId)} Skill with ${value.requiredTags.join(' + ')}`
  const requirements = [
    `Equipped Primary + Secondary pair: ${definition.disciplinePair.map(disciplineName).join(' + ')}`,
    ...(setup
      ? [
          `Use ${matcher(setup)} as Setup, then ${matcher(mechanics.trigger)} as the next Discipline Skill. Another Discipline Skill expires the armed Setup.`,
        ]
      : [`Use ${matcher(mechanics.trigger)}; no Setup required.`]),
    ...(mechanics.resultEffects.some((effect) => effect.recipient === 'primary-unit')
      ? [
          'A unit selection is required for the selected-unit Result.' +
            (setup ? ' Ground selection preserves the armed Setup.' : ''),
        ]
      : []),
  ]
  const recipients = [...new Set(mechanics.resultEffects.map(resonanceResultRecipient))]
  return skillInformationRows<string | readonly string[]>({
    'Skill Type': 'Passive · Resonance',
    Cost: 'N/A',
    Cooldown: 'N/A',
    Requirements: requirements,
    Effects: skillEffectSummaries({ effects: mechanics.resultEffects }).map(
      (summary, index) =>
        `${summary} → ${resonanceResultRecipient(mechanics.resultEffects[index]!)}`,
    ),
    Range: 'N/A',
    Target: recipients.join('; ') || 'N/A',
    'Target Method': 'N/A',
    'Target Elevation': 'N/A',
    'Line of Sight': 'N/A',
  })
}

/** Additional trigger and effect explanations follow the minimum ten-field report everywhere. */
export function resonanceSupplementalRows(
  definition: AnyResonanceDefinition | null | undefined,
): readonly SkillCharacteristic[] {
  if (!definition) return []
  const mechanics = normalizedResonanceMechanics(definition)
  const matcher = (value: typeof mechanics.trigger) =>
    `${disciplineName(value.sourceDisciplineId)} · ${value.requiredTags.join(' + ')}`
  const requiresUnit = mechanics.resultEffects.some((effect) => effect.recipient === 'primary-unit')
  return [
    ['Mode', mechanics.mode === 'immediate' ? 'Immediate Resonance' : 'Sequence Resonance'],
    ['Setup', mechanics.setup ? matcher(mechanics.setup) : 'N/A'],
    ['Trigger', matcher(mechanics.trigger)],
    [
      'Trigger targeting',
      'Uses the Trigger Skill’s range, target selection, elevation and line of sight rules. No separate selection, resource cost or cooldown.' +
        (requiresUnit ? ' Selected-unit Results require a unit selection.' : '') +
        ' Attack Results require an eligible affected unit.' +
        (mechanics.setup
          ? ' Ground selection for selected-unit Results and empty-ground attacks preserve the armed Setup.'
          : ''),
    ],
    ['Result details', mechanics.resultEffects.map((effect) => previewEffect(effect).explanation)],
  ]
}
