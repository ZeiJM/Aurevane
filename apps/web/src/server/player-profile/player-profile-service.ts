import type { PlayerProfileRepository } from '@aurevane/db/player-profile'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { PlayerProfile } from '@aurevane/game-core/player-profile'

export async function loadPlayerProfile(
  actor: AuthenticatedActor,
  repository: PlayerProfileRepository,
): Promise<PlayerProfile> {
  const profile = await repository.findByUserId(actor.userId)

  if (!profile || profile.userId !== actor.userId) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Player profile is unavailable.')
  }

  return profile
}
