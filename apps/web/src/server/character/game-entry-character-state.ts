import type { CharacterRepository } from '@aurevane/db/character'
import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { isAurevaneError } from '@aurevane/game-core/errors'

import { serverLogger, type ServerLogger } from '../logging'
import { loadBaseCharacter } from './character-service'

export type GameEntryCharacterState =
  { kind: 'ready'; character: PersistedCharacter | null } | { kind: 'persistence-unavailable' }

export async function loadGameEntryCharacterState(
  actor: AuthenticatedActor,
  repository: CharacterRepository,
  logger: ServerLogger = serverLogger,
): Promise<GameEntryCharacterState> {
  try {
    return {
      kind: 'ready',
      character: await loadBaseCharacter(actor, repository),
    }
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE') {
      logger.error('character.persistence_unavailable')
      return { kind: 'persistence-unavailable' }
    }
    throw error
  }
}
