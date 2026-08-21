import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { loadPublicCharacterProfileImageMap } from '@/server/character/character-profile-display-service'

export interface OnlineCharacter {
  characterId: string
  name: string
  level: number
  lastSeenAt: string
  portraitRef: string | null
  disciplineId: string | null
  personalTitle: string | null
  imageUrl: string | null
}

function onlineNameBucket(name: string): number {
  if (/^[A-Za-z]/.test(name)) return 0
  if (/^\d/.test(name)) return 1
  return 2
}

function compareOnlineCharacters(left: OnlineCharacter, right: OnlineCharacter): number {
  const bucketDifference = onlineNameBucket(left.name) - onlineNameBucket(right.name)
  if (bucketDifference !== 0) return bucketDifference

  const nameDifference = left.name.localeCompare(right.name, undefined, {
    sensitivity: 'base',
    numeric: true,
  })
  if (nameDifference !== 0) return nameDifference
  return left.characterId.localeCompare(right.characterId)
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

  const base: OnlineCharacter[] = []
  for (const row of data) {
    if (
      row &&
      typeof row === 'object' &&
      typeof row.character_id === 'string' &&
      typeof row.character_name === 'string' &&
      Number.isSafeInteger(row.character_level) &&
      typeof row.last_seen_at === 'string'
    ) {
      base.push({
        characterId: row.character_id,
        name: row.character_name,
        level: row.character_level,
        lastSeenAt: row.last_seen_at,
        portraitRef: null,
        disciplineId: null,
        personalTitle: null,
        imageUrl: null,
      })
    }
  }

  if (base.length === 0) return base
  const ids = base.map((row) => row.characterId)

  // Public online identity is deliberately shallow: portrait/title/discipline only, never stats,
  // account identifiers, email, currencies, inventory, or private progression data.
  const [{ data: identities, error: identityError }, imageMap] = await Promise.all([
    supabase
      .from('characters')
      .select('id, portrait_ref, foundation_discipline_id, personal_title')
      .in('id', ids),
    loadPublicCharacterProfileImageMap(ids).catch(() => new Map<string, string>()),
  ])

  const identityMap = new Map<
    string,
    { portraitRef: string | null; disciplineId: string | null; personalTitle: string | null }
  >()
  if (!identityError && Array.isArray(identities)) {
    for (const row of identities) {
      if (!row || typeof row.id !== 'string') continue
      identityMap.set(row.id, {
        portraitRef: typeof row.portrait_ref === 'string' ? row.portrait_ref : null,
        disciplineId:
          typeof row.foundation_discipline_id === 'string' ? row.foundation_discipline_id : null,
        personalTitle: typeof row.personal_title === 'string' ? row.personal_title : null,
      })
    }
  }

  return base
    .map((row) => {
      const identity = identityMap.get(row.characterId)
      return {
        ...row,
        portraitRef: identity?.portraitRef ?? null,
        disciplineId: identity?.disciplineId ?? null,
        personalTitle: identity?.personalTitle ?? null,
        imageUrl: imageMap.get(row.characterId) ?? null,
      }
    })
    .sort(compareOnlineCharacters)
}

function unavailable(): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Online presence is unavailable right now.')
}
