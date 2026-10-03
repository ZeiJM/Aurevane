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

export function resonanceMatcher(value: {
  sourceDisciplineId: string
  requiredTags: readonly string[]
}): string {
  return `${disciplineName(value.sourceDisciplineId)} · ${value.requiredTags.join(' + ')}`
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
  const recipients = [...new Set(mechanics.resultEffects.map(resonanceResultRecipient))]
  return skillInformationRows<string | readonly string[]>({
    'Skill Type': 'Passive · Resonance',
    Cost: 'N/A',
    Cooldown: 'N/A',
    Requirements: mechanics.setup ? resonanceMatcher(mechanics.setup) : 'N/A',
    Effects: skillEffectSummaries({ effects: mechanics.resultEffects }).map(
      (summary, index) =>
        `${resonanceMatcher(mechanics.trigger)}: ${summary}${mechanics.resultEffects[index]!.recipient === 'actor' ? '' : ` → ${resonanceResultRecipient(mechanics.resultEffects[index]!)}`}`,
    ),
    Range: 'N/A',
    Target: recipients.join('; ') || 'N/A',
    'Target Method': 'N/A',
    'Target Elevation': 'N/A',
    'Line of Sight': 'N/A',
  })
}

/** Effect explanations follow the shared ten-field report. */
export function resonanceSupplementalRows(
  definition: AnyResonanceDefinition | null | undefined,
): readonly SkillCharacteristic[] {
  if (!definition) return []
  const mechanics = normalizedResonanceMechanics(definition)
  return [
    ['Result details', mechanics.resultEffects.map((effect) => previewEffect(effect).explanation)],
  ]
}
