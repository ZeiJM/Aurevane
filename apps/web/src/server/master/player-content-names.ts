import 'server-only'
import type { MasterPlayerView } from '@/master/players'
import type { CombatContentResolver } from '../combat/combat-content-resolver'

/** Resolve current presentation once; never export unrelated definitions or change saved references. */
export async function readPlayerContentNames(
  player: MasterPlayerView,
  resolver: Pick<CombatContentResolver, 'resolveCurrentCatalogue'>,
): Promise<Readonly<Record<string, string>>> {
  const keys = new Set(
    [
      ...player.facts.build.disciplineSkills.map((skill) => skill.skillId),
      ...player.learnedSkills.map((skill) => skill.skillId),
      player.facts.build.extensions.essence?.essenceId,
      player.facts.build.extensions.resonance?.resonanceId,
    ].filter((key): key is string => typeof key === 'string'),
  )
  if (!keys.size) return {}
  const catalogue = await resolver.resolveCurrentCatalogue?.()
  return Object.fromEntries(
    (catalogue?.entries ?? []).flatMap((entry) =>
      keys.has(entry.contentKey) &&
      'name' in entry.definition &&
      typeof entry.definition.name === 'string'
        ? [[entry.contentKey, entry.definition.name]]
        : [],
    ),
  )
}
