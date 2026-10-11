import type { MatureSkillDefinition } from './mature-skills'
import type { EssenceDefinition } from './essence'
import { isCombatGroundEntryEffect } from './combat-ground-areas'

/** Append only persistent Ground metadata; keep historical costs, targeting and effects pinned. */
export function createCurrentGroundSkillVersion(
  definition: MatureSkillDefinition,
): MatureSkillDefinition | null {
  if (definition.target.kind !== 'ground-tile' || definition.groundArea) return null
  const entryEffectOrdinals = definition.effects.flatMap((effect, index) =>
    isCombatGroundEntryEffect(effect) ? [index] : [],
  )
  if (entryEffectOrdinals.length === 0) return null
  const repeated = entryEffectOrdinals
    .map((index) => definition.effects[index]!)
    .map(
      (effect) =>
        effect.durationTurns ??
        (effect.type === 'bleed' ? effect.ticks : 'ticks' in effect ? effect.ticks : 0) ??
        0,
    )
    .filter((turns) => turns > 0)
  const durationRounds = repeated.length ? Math.max(...repeated) : 2
  const fire = definition.effects.some(
    (effect) => effect.type === 'burn' || (effect.type === 'damage' && effect.element === 'fire'),
  )
  const frost =
    definition.sourceDisciplineId === 'frostweaver' ||
    definition.effects.some(
      (effect) => effect.type === 'create-terrain' && effect.terrain === 'frozen',
    )
  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    groundArea: {
      durationRounds,
      visualPresetId: fire ? 'embers' : frost ? 'frost' : 'arcane-pulse',
      entryEffectOrdinals,
    },
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([...definition.authoring.validationTags, 'persistent-ground-areas']),
      ],
    },
  }
}
export function createCurrentGroundEssenceVersion(
  definition: EssenceDefinition,
): EssenceDefinition | null {
  const skill = createCurrentGroundSkillVersion(definition.skill)
  return skill
    ? {
        ...definition,
        contentVersion: skill.contentVersion,
        skill,
        authoring: {
          ...definition.authoring,
          validationTags: [
            ...new Set([...definition.authoring.validationTags, 'persistent-ground-areas']),
          ],
        },
      }
    : null
}
