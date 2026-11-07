import 'server-only'

import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { contentArtworkKey } from '@aurevane/game-core/combat/content-media'
import {
  CURRENT_SUPPORT_ACTION_IDS,
  type SupportActionId,
} from '@aurevane/game-core/combat/support-actions'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'

/** Public presentation only from validated current Basic Skill publications. */
export async function resolveCurrentSupportActionPresentation(
  resolver: CombatContentResolver,
): Promise<{
  artworkKeys: Readonly<Partial<Record<SupportActionId, string | null>>>
  descriptions: Readonly<Partial<Record<SupportActionId, string>>>
}> {
  const definitions = resolver.resolveCurrentBasicSkillDefinitions
    ? await resolver.resolveCurrentBasicSkillDefinitions(CURRENT_SUPPORT_ACTION_IDS)
    : new Map(defaultBasicSkills().map((definition) => [definition.id, definition]))
  const entries = CURRENT_SUPPORT_ACTION_IDS.map((id) => {
    const definition = definitions.get(id)
    if (!definition || definition.id !== id) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        `Support Action ${id} has no current combat definition.`,
      )
    }
    return {
      id,
      artworkKey: contentArtworkKey(definition.media),
      description: definition.description,
    }
  })
  return {
    artworkKeys: Object.fromEntries(entries.map(({ id, artworkKey }) => [id, artworkKey])),
    descriptions: Object.fromEntries(entries.map(({ id, description }) => [id, description])),
  }
}

/** Compatibility reader for callers needing only artwork identities. */
export async function resolveCurrentSupportActionArtwork(
  resolver: CombatContentResolver,
): Promise<Readonly<Partial<Record<SupportActionId, string | null>>>> {
  return (await resolveCurrentSupportActionPresentation(resolver)).artworkKeys
}
