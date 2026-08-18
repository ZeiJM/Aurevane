import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface VerifiedGameSessionIdentity {
  userId: string
  authSessionId: string
}

export function readVerifiedGameSessionIdentity(claims: unknown): VerifiedGameSessionIdentity | null {
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) return null
  const record = claims as Record<string, unknown>
  const userId = typeof record.sub === 'string' ? record.sub : null
  const authSessionId = typeof record.session_id === 'string' ? record.session_id : null
  if (!userId || !authSessionId) return null
  return { userId, authSessionId }
}

export async function claimActiveGameSession(identity: VerifiedGameSessionIdentity): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('claim_active_game_session_v1', {
    p_user_id: identity.userId,
    p_auth_session_id: identity.authSessionId,
  })

  if (error || typeof data !== 'boolean') {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The active account session could not be established.',
    )
  }

  return data
}

export async function ensureActiveGameSession(identity: VerifiedGameSessionIdentity): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('ensure_active_game_session_v1', {
    p_user_id: identity.userId,
    p_auth_session_id: identity.authSessionId,
  })

  if (error || typeof data !== 'boolean') {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The active account session could not be verified.',
    )
  }

  return data
}
