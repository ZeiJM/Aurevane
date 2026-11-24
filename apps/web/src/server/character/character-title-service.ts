import 'server-only'

import { cache } from 'react'
import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { isStarterTitle } from '@/appearance/starter-titles'

export interface CharacterTitleState {
  personalTitle: string | null
  personalTitleSetAt: string | null
}

export const loadCharacterTitleState = cache(
  async (userId: string, characterId: string): Promise<CharacterTitleState> => {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.rpc('get_character_personal_title_v1', {
      p_user_id: userId,
      p_character_id: characterId,
    })

    if (error) {
      if (error.message.includes('CHARACTER_NOT_PLAYABLE')) {
        throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
      }
      throw unavailable()
    }

    const row = Array.isArray(data) && data.length === 1 ? data[0] : null
    if (!row || typeof row !== 'object') throw unavailable()

    return {
      personalTitle: isStarterTitle(row.personal_title) ? row.personal_title : null,
      personalTitleSetAt:
        typeof row.personal_title_set_at === 'string' ? row.personal_title_set_at : null,
    }
  },
)

export async function setCharacterPersonalTitle(input: {
  userId: string
  characterId: string
  title: unknown
}): Promise<CharacterTitleState> {
  if (!isStarterTitle(input.title))
    throw new AurevaneError('INVALID_REQUEST', 'Choose one of the three starter titles.')
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('set_character_personal_title_v1', {
    p_user_id: input.userId,
    p_character_id: input.characterId,
    p_title: input.title,
  })

  if (error) {
    if (error.message.includes('PERSONAL_TITLE_INVALID')) {
      throw new AurevaneError('INVALID_REQUEST', 'Choose one of the three starter titles.')
    }
    if (error.message.includes('CHARACTER_NOT_PLAYABLE')) {
      throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
    }
    throw unavailable()
  }

  const row = Array.isArray(data) && data.length === 1 ? data[0] : null
  if (!row || row.personal_title !== input.title || typeof row.personal_title_set_at !== 'string') {
    throw unavailable()
  }

  return { personalTitle: row.personal_title, personalTitleSetAt: row.personal_title_set_at }
}

function unavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Character title data is unavailable right now.',
  )
}
