import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'
import { cache } from 'react'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface CharacterProfileDisplayState {
  imageUrl: string | null
  legacyImageUrl?: string | null
}

async function readCharacterProfileDisplay(
  userId: string,
  characterId: string,
): Promise<CharacterProfileDisplayState> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('character_profile_display')
    .select('image_url, appearance_image_url')
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .maybeSingle()

  if (error) throw unavailable()
  const legacyImageUrl = typeof data?.image_url === 'string' ? data.image_url : null
  return {
    imageUrl:
      typeof data?.appearance_image_url === 'string' ? data.appearance_image_url : legacyImageUrl,
    legacyImageUrl,
  }
}

/**
 * Server Component request memoization only. The character page and authenticated shell can ask
 * for the same cosmetic display state during one navigation; sharing that read avoids an extra
 * database round trip while every later request still observes profile changes.
 */
export const loadCharacterProfileDisplay = cache(readCharacterProfileDisplay)

export async function loadCharacterProfileImageMap(
  userId: string,
  characterIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (characterIds.length === 0) return new Map()
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('character_profile_display')
    .select('character_id, image_url, appearance_image_url')
    .eq('user_id', userId)
    .in('character_id', [...characterIds])

  if (error || !Array.isArray(data)) throw unavailable()
  return profileImageRowsToMap(data)
}

/**
 * Server-only public identity projection. The browser never receives table access; only the
 * cosmetic image URL for character ids that another authenticated service has already selected.
 */
export async function loadPublicCharacterProfileImageMap(
  characterIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (characterIds.length === 0) return new Map()
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('character_profile_display')
    .select('character_id, image_url, appearance_image_url')
    .in('character_id', [...characterIds])

  if (error || !Array.isArray(data)) throw unavailable()
  return profileImageRowsToMap(data)
}

function profileImageRowsToMap(
  rows: readonly { character_id?: unknown; image_url?: unknown; appearance_image_url?: unknown }[],
): ReadonlyMap<string, string> {
  const result = new Map<string, string>()
  for (const row of rows) {
    const imageUrl = row.appearance_image_url ?? row.image_url
    if (typeof row.character_id === 'string' && typeof imageUrl === 'string') {
      result.set(row.character_id, imageUrl)
    }
  }
  return result
}

function unavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Profile display settings are unavailable right now.',
  )
}
