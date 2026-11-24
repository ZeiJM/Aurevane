import 'server-only'

import { cache } from 'react'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import { buildCharacterProfileReadModel } from '@aurevane/game-core/character/profile'
import { isAurevaneError } from '@aurevane/game-core/errors'

import type { CharacterIdentityCardProps } from '@/components/character/character-identity-card'
import { loadCharacterIdentityBuild } from '@/server/character/character-build-service'
import { loadCharacterProfileDisplay } from '@/server/character/character-profile-display-service'
import { loadCharacterTitleState } from '@/server/character/character-title-service'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { loadLevelProgressionCurve } from '@/server/progression/progression-service'
import { createSupabaseProgressionRepository } from '@/server/progression/supabase-progression-repository'

function isPersistenceUnavailable(error: unknown): boolean {
  return isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE'
}

export async function loadCharacterIdentityRailContext(
  actor: AuthenticatedActor,
  character: PersistedCharacter,
): Promise<CharacterIdentityCardProps> {
  return readIdentityRail(actor.userId, character)
}

// The layout and destination page share the selected-character snapshot within one render.
const readIdentityRail = cache(
  async (userId: string, character: PersistedCharacter): Promise<CharacterIdentityCardProps> => {
    const [levelCurve, build, [titleStateResult, displayStateResult]] = await Promise.all([
      loadLevelProgressionCurve(
        character.progressionCycle.number,
        createSupabaseProgressionRepository(),
      ),
      loadCharacterIdentityBuild(userId, character, createSupabaseCharacterBuildRepository()),
      Promise.allSettled([
        loadCharacterTitleState(userId, character.id),
        loadCharacterProfileDisplay(userId, character.id),
      ]),
    ])
    if (
      titleStateResult.status === 'rejected' &&
      !isPersistenceUnavailable(titleStateResult.reason)
    ) {
      throw titleStateResult.reason
    }
    if (
      displayStateResult.status === 'rejected' &&
      !isPersistenceUnavailable(displayStateResult.reason)
    ) {
      throw displayStateResult.reason
    }

    const { definition: primary, derived } = build.current
    const secondary = build.currentSecondary
    return {
      profile: buildCharacterProfileReadModel(character, levelCurve),
      primary,
      secondary,
      personalTitle:
        titleStateResult.status === 'fulfilled' ? titleStateResult.value.personalTitle : null,
      imageUrl:
        displayStateResult.status === 'fulfilled' ? displayStateResult.value.imageUrl : null,
      disciplineSummary: secondary
        ? `${primary.name} and ${secondary.name} techniques woven into one committed build.`
        : primary.summary,
      maxHp: derived.stats.maxHp.value,
      maxMp: derived.stats.maxMp.value,
    }
  },
)
