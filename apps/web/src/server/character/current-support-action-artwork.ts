import 'server-only'

import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { contentArtworkKey } from '@aurevane/game-core/combat/content-media'
import {
  SUPPORT_ACTION_IDS,
  type SupportActionId,
} from '@aurevane/game-core/combat/support-actions'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'

/** Keep only public artwork identities from the validated current Basic Skill publications. */
export async function resolveCurrentSupportActionArtwork(
  resolver: CombatContentResolver,
): Promise<Readonly<Partial<Record<SupportActionId, string | null>>>> {
  const definitions = resolver.resolveCurrentBasicSkillDefinitions
    ? await resolver.resolveCurrentBasicSkillDefinitions(SUPPORT_ACTION_IDS)
    : new Map(defaultBasicSkills().map((definition) => [definition.id, definition]))
  return Object.fromEntries(
    SUPPORT_ACTION_IDS.map((id) => {
      const definition = definitions.get(id)
      if (!definition || definition.id !== id) {
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          `Support Action ${id} has no current combat definition.`,
        )
      }
      return [id, contentArtworkKey(definition.media)]
    }),
  )
}
