import { isResonanceDefinitionV2 } from './resonance-v2'
import type { MatureSkillDefinition, MatureSkillEffectDefinition } from './mature-skills'
import type { EssenceDefinition } from './essence'
import type { AnyResonanceDefinition } from './resonance'
import type { CombatEffectDefinition } from './actions'

export const PERCENTAGE_RECOVERY_CONTENT_TAG = 'captured-percentage-recovery'

/** Replacement mapping: existing positive recovery Power becomes the same percent per application.
 * This is a new, reviewable mapping; it is not the missing historical approval table.
 */
export function percentageRecoveryEffect(effect: CombatEffectDefinition): CombatEffectDefinition {
  if (effect.type !== 'healing' && !(effect.type === 'resource-change' && effect.delta > 0))
    return effect
  const percent = effect.type === 'healing' ? effect.amount : effect.delta
  if (!Number.isSafeInteger(percent) || percent < 1 || percent > 100)
    throw new RangeError('Current recovery conversion requires positive Power between 1 and 100.')
  return {
    type: 'percentage-recovery',
    recipient: effect.recipient,
    resource: effect.type === 'healing' ? 'hp' : 'mp',
    percent,
    ticks: effect.ticks ?? 1,
    durationTurns: Math.max(0, (effect.ticks ?? 1) - 1),
  }
}

export function createPercentageRecoverySkillVersion(
  definition: MatureSkillDefinition,
): MatureSkillDefinition | null {
  let changed = false
  const effects = definition.effects.map((effect): MatureSkillEffectDefinition => {
    if (effect.type === 'summon') return effect
    if (effect.type === 'return-to-turn-start' && effect.anchorMode !== 'cast-position') {
      changed = true
      return { ...effect, anchorMode: 'cast-position' }
    }
    const next = percentageRecoveryEffect(effect)
    changed ||= next !== effect
    return next
  })
  const summonProfile = definition.summonProfile
    ? {
        ...definition.summonProfile,
        abilities: definition.summonProfile.abilities.map((ability) => {
          const next = ability.effects.map(percentageRecoveryEffect)
          if (next.every((e, i) => e === ability.effects[i])) return ability
          changed = true
          return {
            ...ability,
            effects: next,
            description: 'Restores a captured percentage of each recipient’s maximum resource.',
          }
        }),
      }
    : undefined
  if (!changed) return null
  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    effects,
    ...(summonProfile ? { summonProfile } : {}),
    ...(definition.effectDescriptions
      ? {
          effectDescriptions: definition.effectDescriptions.map((d, i) =>
            effects[i] === definition.effects[i] ? d : null,
          ),
        }
      : {}),
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([...definition.authoring.validationTags, PERCENTAGE_RECOVERY_CONTENT_TAG]),
      ],
    },
  }
}

export function createPercentageRecoveryEssenceVersion(
  definition: EssenceDefinition,
): EssenceDefinition | null {
  const skill = createPercentageRecoverySkillVersion(definition.skill)
  return skill
    ? {
        ...definition,
        contentVersion: skill.contentVersion,
        skill,
        authoring: {
          ...definition.authoring,
          validationTags: [
            ...new Set([...definition.authoring.validationTags, PERCENTAGE_RECOVERY_CONTENT_TAG]),
          ],
        },
      }
    : null
}

export function createPercentageRecoveryResonanceVersion(
  definition: AnyResonanceDefinition,
): AnyResonanceDefinition | null {
  const original = isResonanceDefinitionV2(definition)
    ? definition.trigger.resultEffects
    : definition.trigger.payoffEffects
  const effects = original.map(percentageRecoveryEffect)
  if (effects.every((e, i) => e === original[i])) return null
  if (isResonanceDefinitionV2(definition))
    return {
      ...definition,
      contentVersion: definition.contentVersion + 1,
      authoring: {
        ...definition.authoring,
        validationTags: [
          ...new Set([...definition.authoring.validationTags, PERCENTAGE_RECOVERY_CONTENT_TAG]),
        ],
      },
      trigger: { ...definition.trigger, resultEffects: effects },
    }
  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([...definition.authoring.validationTags, PERCENTAGE_RECOVERY_CONTENT_TAG]),
      ],
    },
    trigger: { ...definition.trigger, payoffEffects: effects },
  }
}
