import 'server-only'

import type { AuthenticatedActor } from '@aurevane/game-core/command'
import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import { buildCharacterProfileReadModel } from '@aurevane/game-core/character/profile'
import { isAurevaneError } from '@aurevane/game-core/errors'

import type { CharacterIdentityCardProps } from '@/components/character/character-identity-card'
import { loadCharacterBuildContext } from '@/server/character/character-build-service'
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
  const [levelCurve, disciplineBuild] = await Promise.all([
    loadLevelProgressionCurve(
      character.progressionCycle.number,
      createSupabaseProgressionRepository(),
    ),
    loadCharacterBuildContext(actor.userId, character, createSupabaseCharacterBuildRepository()),
  ])

  const [titleStateResult, displayStateResult] = await Promise.allSettled([
    loadCharacterTitleState(actor.userId, character.id),
    loadCharacterProfileDisplay(actor.userId, character.id),
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

  const primary = disciplineBuild.current.definition
  const secondary = disciplineBuild.currentSecondary

  return {
    profile: buildCharacterProfileReadModel(character, levelCurve),
    primary,
    secondary,
    personalTitle:
      titleStateResult.status === 'fulfilled' ? titleStateResult.value.personalTitle : null,
    imageUrl: displayStateResult.status === 'fulfilled' ? displayStateResult.value.imageUrl : null,
    disciplineSummary: secondary
      ? `${primary.name} and ${secondary.name} techniques woven into one committed build.`
      : primary.summary,
    maxHp: disciplineBuild.current.derived.stats.maxHp.value,
    maxMp: disciplineBuild.current.derived.stats.maxMp.value,
  }
}
