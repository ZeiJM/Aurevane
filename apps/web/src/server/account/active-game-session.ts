import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface VerifiedGameSessionIdentity {
  userId: string
  authSessionId: string
}

export interface ActiveBattleSummary {
  battleSessionId: string
  battleId: string
  lifecycle: 'active'
  updatedAt: string
  isPvp: boolean
}

export interface ActiveSpectatingSummary {
  battleSessionId: string
  battleKey: string
  updatedAt: string
}

export function readVerifiedGameSessionIdentity(
  claims: unknown,
): VerifiedGameSessionIdentity | null {
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) return null
  const record = claims as Record<string, unknown>
  const userId = typeof record.sub === 'string' ? record.sub : null
  const authSessionId = typeof record.session_id === 'string' ? record.session_id : null
  if (!userId || !authSessionId) return null
  return { userId, authSessionId }
}

export async function claimActiveGameSession(
  identity: VerifiedGameSessionIdentity,
): Promise<boolean> {
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

export async function ensureActiveGameSession(
  identity: VerifiedGameSessionIdentity,
): Promise<boolean> {
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

export async function getActiveBattleForUser(userId: string): Promise<ActiveBattleSummary | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_active_battle_for_user_v1', {
    p_user_id: userId,
  })
  if (error) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The active battle state could not be checked safely.',
    )
  }
  if (!Array.isArray(data) || data.length === 0) return null
  const row = data[0]
  if (
    !row ||
    typeof row !== 'object' ||
    typeof row.battle_session_id !== 'string' ||
    typeof row.battle_id !== 'string' ||
    row.lifecycle !== 'active' ||
    typeof row.updated_at !== 'string' ||
    typeof row.is_pvp !== 'boolean'
  ) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The active battle lookup returned invalid state.',
    )
  }
  return {
    battleSessionId: row.battle_session_id,
    battleId: row.battle_id,
    lifecycle: 'active',
    updatedAt: row.updated_at,
    isPvp: row.is_pvp,
  }
}

export async function getActiveSpectatingForUser(
  userId: string,
): Promise<ActiveSpectatingSummary | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_active_spectating_for_user_v1', {
    p_user_id: userId,
  })
  if (error) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The active spectator state could not be checked safely.',
    )
  }
  if (!Array.isArray(data) || data.length === 0) return null
  const row = data[0]
  if (
    !row ||
    typeof row !== 'object' ||
    typeof row.battle_session_id !== 'string' ||
    typeof row.battle_key !== 'string' ||
    typeof row.updated_at !== 'string'
  ) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The active spectator lookup returned invalid state.',
    )
  }
  return {
    battleSessionId: row.battle_session_id,
    battleKey: row.battle_key,
    updatedAt: row.updated_at,
  }
}

async function isExistingBattleCreateReplay(
  userId: string,
  idempotencyKey: string,
  battleSessionId: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('is_existing_battle_create_replay_v1', {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_battle_session_id: battleSessionId,
  })
  if (error || typeof data !== 'boolean') {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The active battle replay state could not be checked safely.',
    )
  }
  return data
}

export async function assertNoActiveBattle(
  userId: string,
  allowedCreateReplayKey?: string,
): Promise<void> {
  const active = await getActiveBattleForUser(userId)
  if (!active) return
  if (
    allowedCreateReplayKey &&
    !active.isPvp &&
    (await isExistingBattleCreateReplay(userId, allowedCreateReplayKey, active.battleSessionId))
  ) {
    return
  }
  throw new AurevaneError(
    'INVALID_REQUEST',
    'You are already in a battle. Return to it before starting or joining another fight.',
  )
}

export async function assertGameplayMutationAllowed(userId: string): Promise<void> {
  const activeBattle = await getActiveBattleForUser(userId)
  if (activeBattle) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'This action is unavailable while you are in battle. Return to the battle first.',
    )
  }

  const spectating = await getActiveSpectatingForUser(userId)
  if (spectating) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'This action is unavailable while you are spectating. Stop spectating first.',
    )
  }
}
