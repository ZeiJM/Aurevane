import type { MatureSkillDefinition } from './mature-skills'
import type { EssenceDefinition } from './essence'

export const BLINDSIDE_CONTENT_TAG = 'instant-blindside-v1'

/** Append current versions; original positional effects remain available by pinned version. */
export function createBlindsideSkillVersion(
  definition: MatureSkillDefinition,
): MatureSkillDefinition | null {
  if (
    !definition.effects.some(
      (effect) => effect.type === 'damage' && effect.facingModifiersBasisPoints,
    )
  )
    return null
  const effects = definition.effects.map((effect) => {
    if (effect.type !== 'damage' || !effect.facingModifiersBasisPoints) return effect
    const damage = { ...effect }
    delete damage.facingModifiersBasisPoints
    return damage
  })
  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    effects: [
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'blindside',
        stacks: 1,
        durationTurns: 1,
      },
      ...effects,
    ],
    ...(definition.effectDescriptions
      ? {
          effectDescriptions: [
            null,
            ...definition.effectDescriptions.map((description, i) =>
              definition.effects[i]?.type === 'damage' ? null : description,
            ),
          ],
        }
      : {}),
    authoring: {
      ...definition.authoring,
      validationTags: [...definition.authoring.validationTags, BLINDSIDE_CONTENT_TAG],
    },
  }
}
export function createBlindsideEssenceVersion(
  definition: EssenceDefinition,
): EssenceDefinition | null {
  const skill = createBlindsideSkillVersion(definition.skill)
  return skill
    ? {
        ...definition,
        contentVersion: skill.contentVersion,
        skill,
        authoring: {
          ...definition.authoring,
          validationTags: [...definition.authoring.validationTags, BLINDSIDE_CONTENT_TAG],
        },
      }
    : null
}
