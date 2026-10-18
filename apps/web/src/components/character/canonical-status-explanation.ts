import { mechanicText, mechanicTag, type MechanicTextPart } from './mechanic-text'
import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import { previewEffect } from './skill-effect-preview'
import { canonicalSecondaryStatusExplanation } from './canonical-secondary-status-explanation'
import {
  canonicalElementalStatusClock,
  type CanonicalStatusExplanationOptions,
} from './canonical-status-clock'
import type { CompactSkillEffectSummaryParts } from './skill-detail-presentation'
export type { CanonicalStatusExplanationOptions } from './canonical-status-clock'

/** Canonical status facts share exact values with native rules; historical fallbacks stay intact. */
export function canonicalStatusExplanation(
  effect: Extract<MatureSkillEffectDefinition, { type: 'apply-status' }>,
  options: CanonicalStatusExplanationOptions,
): {
  description: string
  descriptionParts?: readonly MechanicTextPart[]
  parts: Partial<CompactSkillEffectSummaryParts>
  structuredTiming?: boolean
} | null {
  const secondary = canonicalSecondaryStatusExplanation(effect, options)
  if (secondary) return secondary
  const descriptions: Readonly<Record<string, string | ReturnType<typeof mechanicText>>> = {
    guarded: 'Take less damage per application. Reapplying refreshes the duration.',
    inspired: 'Deal more damage per application.',
    hexed: options.legacyHealingDown ? 'Receive less healing.' : 'Receive less HP and MP recovery.',
    exposed: 'Take more damage per application. Reapplying refreshes the duration.',
    suppress: mechanicText`Deal less direct damage. Reapplying keeps the stronger, longer effect. Existing ${mechanicTag('burn')}, ${mechanicTag('poison')} and ${mechanicTag('bleed')} damage is unchanged. Cleanse removes it; Dispel does not.`,
    slow: 'Movement costs more AP per tile. Movement allowance is unchanged.',
    mark: 'Only the source gains Accuracy against this target; other attackers gain no benefit.',
    covert: 'Conceal beneficial effects from opposing viewers until revealed.',
    invisible:
      'The recipient cannot be selected by hostile direct unit actions. Ground effects can hit. A damaging action or taking damage breaks Invisible.',
    root: 'Cannot move. Attacks, Skills and facing remain available.',
    challenged: 'Deal less damage to anyone except the unit that applied Taunt.',
    fortified: 'Reduce incoming and outgoing damage. Both effects expire or are removed together.',
    reckless: 'Increase outgoing and incoming damage. Both effects expire or are removed together.',
    warded: mechanicText`Take less damage from opponents affected by ${mechanicTag('burn')}.`,
    frozen:
      'Cannot change final facing. Movement still turns the bearer. Cleanse Chilled removes it.',
    conductive:
      'Take more Storm damage. Storm damage consumes the old charge; this Skill can apply a fresh charge afterward.',
  }
  const entry = Object.hasOwn(descriptions, effect.statusId)
    ? descriptions[effect.statusId]
    : undefined
  if (!entry) return null
  const explanation = typeof entry === 'string' ? { description: entry } : entry
  let description = explanation.description
  const elemental = effect.statusId === 'frozen' || effect.statusId === 'conductive'
  if (elemental && (options.legacyElemental || options.explicitElemental === false)) return null
  const preview = previewEffect(effect, options)
  const details = [{ label: 'Stacks', value: String(effect.stacks) }]
  const parts: Partial<CompactSkillEffectSummaryParts> = {
    ...(preview.magnitude ? { magnitude: preview.magnitude } : {}),
    details,
  }
  if (elemental) {
    const clock = canonicalElementalStatusClock(effect, options)
    parts.duration = clock.duration
    details.push(clock.activation)
    description += clock.condition
  }
  return { ...explanation, description, parts, ...(elemental ? { structuredTiming: true } : {}) }
}
