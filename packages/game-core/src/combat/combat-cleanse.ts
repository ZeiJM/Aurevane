import type { CombatEffectDefinition } from './actions'
import { combatEffectPresentationTags } from './gameplay-tags'
import type { MatureSkillDefinition, MatureSkillEffectDefinition } from './mature-skills'

export const CLEANSE_STATUS_IDS = [
  'burn',
  'bleed',
  'poison',
  'slow',
  'root',
  'exposed',
  'mark',
  'challenged',
] as const

export function isCleanseEffect(
  effect: MatureSkillEffectDefinition,
): effect is Extract<CombatEffectDefinition, { type: 'remove-status' }> {
  return effect.type === 'remove-status' && combatEffectPresentationTags(effect).includes('Cleanse')
}

export function hasCanonicalCleanseStatuses(statusIds: readonly string[]): boolean {
  return (
    statusIds.length === CLEANSE_STATUS_IDS.length &&
    CLEANSE_STATUS_IDS.every((id) => statusIds.includes(id))
  )
}

/** Append only changed versions; never mutate a historical definition or its other effects. */
export function createCanonicalCleanseSkillVersion(
  definition: MatureSkillDefinition,
): MatureSkillDefinition | null {
  if (
    !definition.effects.some(
      (effect) => isCleanseEffect(effect) && !hasCanonicalCleanseStatuses(effect.statusIds),
    )
  )
    return null
  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    effects: definition.effects.map((effect) =>
      isCleanseEffect(effect) ? { ...effect, statusIds: [...CLEANSE_STATUS_IDS] } : effect,
    ),
    ...(definition.effectDescriptions
      ? {
          effectDescriptions: definition.effectDescriptions.map((description, index) =>
            isCleanseEffect(definition.effects[index]!) ? null : description,
          ),
        }
      : {}),
    authoring: {
      ...definition.authoring,
      validationTags: [...new Set([...definition.authoring.validationTags, 'canonical-cleanse'])],
    },
  }
}
