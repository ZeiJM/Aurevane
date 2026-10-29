import { skillHasDifferentContextRules, upgradeSkillFormat } from './skill-format-upgrade'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'

/** A template supplies editable content, never the identity of another Skill. */
export function createDisciplineSkillDraft(
  source: MatureSkillDefinition,
  disciplineId: string,
  skillId: string,
): MatureSkillDefinition {
  const draft =
    source.ability || skillHasDifferentContextRules(source)
      ? structuredClone(source)
      : upgradeSkillFormat(source)
  const cooldownKeys = new Map<string, string>()
  const cooldownKey = (key: string) => {
    if (!cooldownKeys.has(key))
      cooldownKeys.set(
        key,
        cooldownKeys.size ? `${skillId}.cooldown-${cooldownKeys.size + 1}` : skillId,
      )
    return cooldownKeys.get(key)!
  }
  return {
    ...draft,
    id: skillId,
    contentVersion: 1,
    sourceDisciplineId: disciplineId,
    name: 'New Skill',
    nameRef: `${skillId}.name`,
    descriptionRef: `${skillId}.description`,
    tags: draft.tags.map((tag) => (tag === source.sourceDisciplineId ? disciplineId : tag)),
    ...(draft.cooldown
      ? { cooldown: { ...draft.cooldown, key: cooldownKey(draft.cooldown.key) } }
      : {}),
    ...(draft.ability
      ? {
          ability: {
            ...draft.ability,
            behaviors: draft.ability.behaviors.map((row) => ({
              ...row,
              cooldown: row.cooldown
                ? { ...row.cooldown, key: cooldownKey(row.cooldown.key) }
                : null,
            })),
          },
        }
      : {}),
  }
}
