import 'server-only'

import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface CharacterPortraitChoiceState {
  available: boolean
  portraitRef: string | null
  changedAt: string | null
}

function state(data: unknown): CharacterPortraitChoiceState | null {
  const row = Array.isArray(data) && data.length === 1 ? data[0] : null
  if (
    !row ||
    typeof row.portrait_ref !== 'string' ||
    !isStarterCharacterPortraitRef(row.portrait_ref)
  )
    return null
  return {
    available: true,
    portraitRef: row.portrait_ref,
    changedAt: typeof row.changed_at === 'string' ? row.changed_at : null,
  }
}

export async function loadCharacterPortraitChoice(
  userId: string,
  characterId: string,
): Promise<CharacterPortraitChoiceState> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    'get_character_portrait_choice_v1',
    { p_user_id: userId, p_character_id: characterId },
  )
  // A not-yet-released migration disables this control without taking other settings offline.
  if (error) return { available: false, portraitRef: null, changedAt: null }
  return state(data) ?? { available: false, portraitRef: null, changedAt: null }
}

export async function setCharacterDefaultPortrait(input: {
  userId: string
  characterId: string
  portraitRef: unknown
}): Promise<CharacterPortraitChoiceState> {
  if (typeof input.portraitRef !== 'string' || !isStarterCharacterPortraitRef(input.portraitRef))
    throw new AurevaneError('INVALID_REQUEST', 'Choose a default portrait from the gallery.')
  const { data, error } = await createSupabaseAdminClient().rpc(
    'set_character_default_portrait_v1',
    {
      p_user_id: input.userId,
      p_character_id: input.characterId,
      p_portrait_ref: input.portraitRef,
    },
  )
  if (error) {
    if (error.message.includes('CHARACTER_NOT_PLAYABLE'))
      throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
    if (error.message.includes('PORTRAIT_CHOICE_USED'))
      throw new AurevaneError(
        'INVALID_REQUEST',
        'This character has already used its one default portrait change.',
      )
    if (error.message.includes('PORTRAIT_INVALID'))
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Choose a different default portrait from the gallery.',
      )
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Default portrait choices are unavailable right now.',
    )
  }
  const result = state(data)
  if (!result?.changedAt || result.portraitRef !== input.portraitRef)
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The default portrait change could not be confirmed.',
    )
  return result
}
