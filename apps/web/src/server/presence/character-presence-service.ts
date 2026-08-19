import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface OnlineCharacter {
  characterId: string
  name: string
  level: number
  lastSeenAt: string
}

export async function touchCharacterPresence(userId: string, characterId: string): Promise<string> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('touch_character_presence_v1', {
    p_user_id: userId,
    p_character_id: characterId,
  })
  if (error || typeof data !== 'string') {
    if (error?.message.includes('CHARACTER_NOT_PLAYABLE')) {
      throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
    }
    throw unavailable()
  }
  return data
}

export async function listOnlineCharacters(): Promise<OnlineCharacter[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('list_online_characters_v1')
  if (error || !Array.isArray(data)) throw unavailable()

  const result: OnlineCharacter[] = []
  for (const row of data) {
    if (
      row &&
      typeof row === 'object' &&
      typeof row.character_id === 'string' &&
      typeof row.character_name === 'string' &&
      Number.isSafeInteger(row.character_level) &&
      typeof row.last_seen_at === 'string'
    ) {
      result.push({
        characterId: row.character_id,
        name: row.character_name,
        level: row.character_level,
        lastSeenAt: row.last_seen_at,
      })
    }
  }
  return result
}

function unavailable(): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Online presence is unavailable right now.')
}
