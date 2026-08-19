import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface CharacterTitleState {
  personalTitle: string | null
  personalTitleSetAt: string | null
}

const PERSONAL_TITLE_PATTERN = /^[A-Za-z0-9 ]+$/

export function normalizePersonalTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function validatePersonalTitle(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AurevaneError('INVALID_REQUEST', 'Enter a title using letters, numbers, and spaces.')
  }
  const normalized = normalizePersonalTitle(value)
  if (normalized.length < 1 || normalized.length > 20 || !PERSONAL_TITLE_PATTERN.test(normalized)) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Personal titles must be 1–20 characters using letters, numbers, and spaces only.',
    )
  }
  return normalized
}

export async function loadCharacterTitleState(
  userId: string,
  characterId: string,
): Promise<CharacterTitleState> {
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
    personalTitle: typeof row.personal_title === 'string' ? row.personal_title : null,
    personalTitleSetAt:
      typeof row.personal_title_set_at === 'string' ? row.personal_title_set_at : null,
  }
}

export async function setCharacterPersonalTitle(input: {
  userId: string
  characterId: string
  title: unknown
}): Promise<CharacterTitleState> {
  const title = validatePersonalTitle(input.title)
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('set_character_personal_title_v1', {
    p_user_id: input.userId,
    p_character_id: input.characterId,
    p_title: title,
  })

  if (error) {
    if (error.message.includes('PERSONAL_TITLE_INVALID')) {
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Personal titles must be 1–20 characters using letters, numbers, and spaces only.',
      )
    }
    if (error.message.includes('PERSONAL_TITLE_UNAVAILABLE')) {
      throw new AurevaneError('TITLE_UNAVAILABLE', 'That title is already in use. Choose another.')
    }
    if (error.message.includes('PERSONAL_TITLE_ALREADY_SET')) {
      throw new AurevaneError(
        'TITLE_ALREADY_SET',
        'This character has already used its one personal-title choice.',
      )
    }
    if (error.message.includes('CHARACTER_NOT_PLAYABLE')) {
      throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
    }
    throw unavailable()
  }

  const row = Array.isArray(data) && data.length === 1 ? data[0] : null
  if (
    !row ||
    typeof row.personal_title !== 'string' ||
    typeof row.personal_title_set_at !== 'string'
  ) {
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
