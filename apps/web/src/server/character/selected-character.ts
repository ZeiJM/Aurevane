import 'server-only'

import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { cookies } from 'next/headers'

import { findPlayableOwnedCharacterById } from './character-slot-service'

export const SELECTED_CHARACTER_COOKIE = 'aurevane_selected_character'

export async function loadSelectedCharacter(
  actor: AuthenticatedActor,
): Promise<PersistedCharacter | null> {
  const characterId = (await cookies()).get(SELECTED_CHARACTER_COOKIE)?.value
  if (!characterId) return null
  return findPlayableOwnedCharacterById(actor.userId, characterId)
}
