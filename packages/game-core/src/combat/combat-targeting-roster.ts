import type { MatureSkillDefinition } from './mature-skills'
import type { EssenceDefinition } from './essence'

/** Append geometry alone. No power, AP, cooldown, recipient or timing recalculation. */
export function createCurrentTargetingSkillVersion(
  definition: MatureSkillDefinition,
): MatureSkillDefinition | null {
  const shape = definition.target.shape
  if (definition.target.geometryVersion === 2 || (shape.kind !== 'line' && shape.kind !== 'circle'))
    return null
  const reach = shape.kind === 'line' ? shape.length : shape.radius
  if (!Number.isSafeInteger(reach) || reach < 1 || reach > 5)
    throw new RangeError('Current area reach must be from one to five.')
  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    target: { ...definition.target, geometryVersion: 2, minimumRange: 0, maximumRange: reach },
    authoring: {
      ...definition.authoring,
      validationTags: [...new Set([...definition.authoring.validationTags, 'targeting-shapes-v2'])],
    },
  }
}

export function createCurrentTargetingEssenceVersion(
  definition: EssenceDefinition,
): EssenceDefinition | null {
  const skill = createCurrentTargetingSkillVersion(definition.skill)
  return skill
    ? {
        ...definition,
        contentVersion: skill.contentVersion,
        skill,
        authoring: {
          ...definition.authoring,
          validationTags: [
            ...new Set([...definition.authoring.validationTags, 'targeting-shapes-v2']),
          ],
        },
      }
    : null
}
