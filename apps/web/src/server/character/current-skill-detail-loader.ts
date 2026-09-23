import 'server-only'

import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { AurevaneError } from '@aurevane/game-core/errors'

import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'

import type { CharacterDisciplineSkillLoadoutView } from './character-build-service'

interface SkillSourceReference {
  readonly skillId: string
  readonly sourceDisciplineId: string
}

function unavailable(message: string): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

function collectReferences(
  loadout: CharacterDisciplineSkillLoadoutView,
): readonly SkillSourceReference[] {
  const sourceBySkill = new Map<string, string>()

  for (const entry of [...loadout.learnedSkills, ...loadout.equippedSkills]) {
    const skillId = entry.definition.id
    const sourceDisciplineId = entry.definition.sourceDisciplineId
    const priorSource = sourceBySkill.get(skillId)
    if (priorSource && priorSource !== sourceDisciplineId) {
      throw unavailable(`Skill ${skillId} has conflicting source Discipline provenance.`)
    }
    sourceBySkill.set(skillId, sourceDisciplineId)
  }

  return [...sourceBySkill.entries()].map(([skillId, sourceDisciplineId]) => ({
    skillId,
    sourceDisciplineId,
  }))
}

async function resolveCurrentDefinitions(
  loadout: CharacterDisciplineSkillLoadoutView,
  resolver: CombatContentResolver,
): Promise<ReadonlyMap<string, MatureSkillDefinition>> {
  const references = collectReferences(loadout)
  const skillIds = references.map((reference) => reference.skillId)
  const batchedDefinitions = resolver.resolveCurrentSkillDefinitions
    ? await resolver.resolveCurrentSkillDefinitions(skillIds)
    : new Map(
        await Promise.all(
          skillIds.map(async (skillId) => [
            skillId,
            await resolver.resolveCurrentSkillDefinition(skillId),
          ] as const),
        ),
      )

  const resolved = new Map<string, MatureSkillDefinition>()
  for (const { skillId, sourceDisciplineId } of references) {
    const definition = batchedDefinitions.get(skillId)
    if (!definition || !definition.enabled) {
      throw unavailable(`Skill ${skillId} has no enabled current combat definition.`)
    }
    if (definition.sourceDisciplineId !== sourceDisciplineId) {
      throw unavailable(
        `Skill ${skillId} changed source Discipline from ${sourceDisciplineId} to ${definition.sourceDisciplineId}.`,
      )
    }
    resolved.set(skillId, structuredClone(definition))
  }
  return resolved
}

export async function resolveCurrentCharacterSkillDetails(
  loadout: CharacterDisciplineSkillLoadoutView,
  resolver: CombatContentResolver,
): Promise<CharacterDisciplineSkillLoadoutView> {
  const definitions = await resolveCurrentDefinitions(loadout, resolver)

  return {
    ...loadout,
    learnedSkills: loadout.learnedSkills.map((entry) => ({
      ...entry,
      definition: structuredClone(definitions.get(entry.definition.id) ?? entry.definition),
    })),
    equippedSkills: loadout.equippedSkills.map((entry) => ({
      ...entry,
      definition: structuredClone(definitions.get(entry.definition.id) ?? entry.definition),
    })),
    extensions: {
      ...loadout.extensions,
    },
  }
}
