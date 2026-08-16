import type { PlayerProfileRepository } from '@aurevane/db/player-profile'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { isAurevaneError } from '@aurevane/game-core/errors'
import type { PlayerProfile } from '@aurevane/game-core/player-profile'

import { serverLogger, type ServerLogger } from '../logging'
import { loadPlayerProfile } from './player-profile-service'

export type GameEntryProfileState =
  { kind: 'ready'; profile: PlayerProfile } | { kind: 'persistence-unavailable' }

export async function loadGameEntryProfileState(
  actor: AuthenticatedActor,
  repository: PlayerProfileRepository,
  logger: ServerLogger = serverLogger,
): Promise<GameEntryProfileState> {
  try {
    return {
      kind: 'ready',
      profile: await loadPlayerProfile(actor, repository),
    }
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE') {
      logger.error('player_profile.persistence_unavailable')
      return { kind: 'persistence-unavailable' }
    }

    throw error
  }
}
