import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface CharacterProfileDisplayState {
  imageUrl: string | null
}

export async function loadCharacterProfileDisplay(
  userId: string,
  characterId: string,
): Promise<CharacterProfileDisplayState> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('character_profile_display')
    .select('image_url')
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .maybeSingle()

  if (error) throw unavailable()
  return { imageUrl: typeof data?.image_url === 'string' ? data.image_url : null }
}

export async function loadCharacterProfileImageMap(
  userId: string,
  characterIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (characterIds.length === 0) return new Map()
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('character_profile_display')
    .select('character_id, image_url')
    .eq('user_id', userId)
    .in('character_id', [...characterIds])

  if (error || !Array.isArray(data)) throw unavailable()
  const result = new Map<string, string>()
  for (const row of data) {
    if (typeof row.character_id === 'string' && typeof row.image_url === 'string') {
      result.set(row.character_id, row.image_url)
    }
  }
  return result
}

export async function setCharacterProfileImage(input: {
  userId: string
  characterId: string
  imageUrl: string | null
}): Promise<CharacterProfileDisplayState> {
  const imageUrl = normalizeProfileImageUrl(input.imageUrl)
  const supabase = createSupabaseAdminClient()
  const { data: owned, error: ownershipError } = await supabase
    .from('characters')
    .select('id')
    .eq('id', input.characterId)
    .eq('user_id', input.userId)
    .maybeSingle()

  if (ownershipError) throw unavailable()
  if (!owned) throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')

  const { error } = await supabase.from('character_profile_display').upsert(
    {
      character_id: input.characterId,
      user_id: input.userId,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'character_id' },
  )
  if (error) throw unavailable()
  return { imageUrl }
}

export function normalizeProfileImageUrl(value: string | null): string | null {
  const normalized = value?.trim() ?? ''
  if (!normalized) return null
  if (normalized.length > 2048) {
    throw new AurevaneError('INVALID_REQUEST', 'Profile image URLs must be 2048 characters or fewer.')
  }
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'Enter a complete image URL beginning with http:// or https://.')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AurevaneError('INVALID_REQUEST', 'Profile images must use an http:// or https:// URL.')
  }
  return parsed.toString()
}

function unavailable(): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Profile display settings are unavailable right now.')
}
