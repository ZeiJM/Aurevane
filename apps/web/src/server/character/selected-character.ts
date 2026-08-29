import 'server-only'

import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { cookies } from 'next/headers'
import { cache } from 'react'

import { findPlayableOwnedCharacterById } from './character-slot-service'

export const SELECTED_CHARACTER_COOKIE = 'aurevane_selected_character'

/**
 * Selected-character reads are stable for the lifetime of one Server Component render. React's
 * cache is request-scoped here, so a later navigation still observes cookie/roster changes.
 */
export const loadSelectedCharacter = cache(
  async (actor: AuthenticatedActor): Promise<PersistedCharacter | null> => {
    const characterId = (await cookies()).get(SELECTED_CHARACTER_COOKIE)?.value
    if (!characterId) return null
    return findPlayableOwnedCharacterById(actor.userId, characterId)
  },
)
