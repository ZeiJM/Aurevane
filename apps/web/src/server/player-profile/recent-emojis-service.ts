import 'server-only'

import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const MAX_RECENT_BATTLE_EMOJIS = 10

const SINGLE_EMOJI_PATTERN =
  /^\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*$/u

function parseRecentEmojis(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length > MAX_RECENT_BATTLE_EMOJIS) return null

  const result: string[] = []
  for (const value of input) {
    if (typeof value !== 'string' || value.length > 64 || !SINGLE_EMOJI_PATTERN.test(value)) {
      return null
    }
    if (!result.includes(value)) result.push(value)
  }
  return result.slice(0, MAX_RECENT_BATTLE_EMOJIS)
}

function parsePersistedEmojis(input: unknown): string[] {
  const parsed = parseRecentEmojis(input)
  if (!parsed) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Recent emoji preferences are unavailable.')
  }
  return parsed
}

export async function loadRecentBattleEmojis(actor: AuthenticatedActor): Promise<string[]> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.rpc('get_player_recent_emojis_v1', {
    p_user_id: actor.userId,
  })

  if (error) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Recent emoji preferences are unavailable.')
  }

  return parsePersistedEmojis(data)
}

export async function saveRecentBattleEmojis(
  actor: AuthenticatedActor,
  input: unknown,
): Promise<string[]> {
  const emojis = parseRecentEmojis(input)
  if (!emojis) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Recent emoji preferences must contain at most ten valid emoji.',
    )
  }

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.rpc('save_player_recent_emojis_v1', {
    p_user_id: actor.userId,
    p_recent_emojis: emojis,
  })

  if (error) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Recent emoji preferences could not be saved.',
    )
  }

  return parsePersistedEmojis(data)
}
