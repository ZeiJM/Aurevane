import 'server-only'

import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { cookies } from 'next/headers'

import { findPlayableOwnedCharacterById } from './character-slot-service'

export const SELECTED_CHARACTER_COOKIE = 'aurevane_selected_character'
export const CREATION_SLOT_COOKIE = 'aurevane_creation_slot'

export async function loadSelectedCharacter(
  actor: AuthenticatedActor,
): Promise<PersistedCharacter | null> {
  const characterId = (await cookies()).get(SELECTED_CHARACTER_COOKIE)?.value
  if (!characterId) return null
  return findPlayableOwnedCharacterById(actor.userId, characterId)
}

export async function readCreationSlot(): Promise<number | null> {
  const value = (await cookies()).get(CREATION_SLOT_COOKIE)?.value
  if (!value) return null
  const slotIndex = Number(value)
  return Number.isSafeInteger(slotIndex) && slotIndex >= 0 && slotIndex <= 2 ? slotIndex : null
}
