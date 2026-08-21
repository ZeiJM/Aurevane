import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface PvpBattleChatMessageView {
  id: number
  senderCharacterId: string
  senderCharacterName: string
  body: string
  createdAt: string
}

export interface PvpSpectatorPresenceView {
  userId: string
  name: string
  lastSeenAt: string
}

function unavailable(message = 'PvP communication is unavailable right now.'): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

function mapRpcError(error: { code?: string; message?: string }): never {
  const message = error.message ?? ''
  if (error.code === '42501' || message.includes('PVP_BATTLE_FORBIDDEN') || message.includes('PVP_CHAT_FORBIDDEN')) {
    throw new AurevaneError('FORBIDDEN', 'That PvP battle is not available to this account.')
  }
  if (error.code === '22023' || message.includes('PVP_CHAT_INVALID')) {
    throw new AurevaneError('INVALID_REQUEST', 'Battle chat messages must be 1–280 characters.')
  }
  throw unavailable()
}

function parseMessageRow(input: unknown): PvpBattleChatMessageView {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw unavailable('The battle chat returned invalid data.')
  }
  const row = input as Record<string, unknown>
  if (
    !Number.isSafeInteger(row.message_id) ||
    typeof row.sender_character_id !== 'string' ||
    typeof row.sender_character_name !== 'string' ||
    typeof row.body !== 'string' ||
    typeof row.created_at !== 'string'
  ) {
    throw unavailable('The battle chat returned invalid data.')
  }
  return {
    id: row.message_id as number,
    senderCharacterId: row.sender_character_id,
    senderCharacterName: row.sender_character_name,
    body: row.body,
    createdAt: row.created_at,
  }
}

export async function joinPvpSpectation(userId: string, battleKey: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('join_pvp_spectator_v1', {
    p_user_id: userId,
    p_battle_key: battleKey,
  })
  if (error) mapRpcError(error)
  if (!Array.isArray(data) || data.length === 0) return null
  const row = data[0]
  if (!row || typeof row !== 'object' || typeof row.battle_session_id !== 'string') {
    throw unavailable('The spectator state returned invalid data.')
  }
  return row.battle_session_id
}

export async function heartbeatPvpSpectation(
  userId: string,
  battleSessionId: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('heartbeat_pvp_spectator_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
  })
  if (error) mapRpcError(error)
  if (typeof data !== 'boolean') throw unavailable('The spectator heartbeat returned invalid data.')
  return data
}

export async function leavePvpSpectation(
  userId: string,
  battleSessionId: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('leave_pvp_spectator_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
  })
  if (error) mapRpcError(error)
  if (typeof data !== 'boolean') throw unavailable('The spectator state returned invalid data.')
  return data
}

export async function getPvpSpectatorCount(
  userId: string,
  battleSessionId: string,
): Promise<number> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_pvp_spectator_count_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
  })
  if (error) mapRpcError(error)
  if (!Number.isSafeInteger(data) || (data as number) < 0) {
    throw unavailable('The spectator count returned invalid data.')
  }
  return data as number
}

export async function listPvpSpectators(
  userId: string,
  battleSessionId: string,
): Promise<PvpSpectatorPresenceView[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('list_pvp_spectators_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
  })
  if (error) mapRpcError(error)
  if (!Array.isArray(data)) throw unavailable('The spectator list returned invalid data.')
  return data.map((input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw unavailable('The spectator list returned invalid data.')
    }
    const row = input as Record<string, unknown>
    if (
      typeof row.user_id !== 'string' ||
      typeof row.spectator_name !== 'string' ||
      typeof row.last_seen_at !== 'string'
    ) {
      throw unavailable('The spectator list returned invalid data.')
    }
    return { userId: row.user_id, name: row.spectator_name, lastSeenAt: row.last_seen_at }
  })
}

export async function listPvpBattleChat(
  userId: string,
  battleSessionId: string,
  afterId = 0,
): Promise<PvpBattleChatMessageView[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('list_pvp_battle_chat_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
    p_after_id: Math.max(0, Math.trunc(afterId)),
  })
  if (error) mapRpcError(error)
  if (!Array.isArray(data)) throw unavailable('The battle chat returned invalid data.')
  return data.map(parseMessageRow)
}

export async function sendPvpBattleChat(
  userId: string,
  battleSessionId: string,
  body: string,
): Promise<PvpBattleChatMessageView> {
  const message = body.trim()
  if (message.length < 1 || message.length > 280) {
    throw new AurevaneError('INVALID_REQUEST', 'Battle chat messages must be 1–280 characters.')
  }
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('send_pvp_battle_chat_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
    p_body: message,
  })
  if (error) mapRpcError(error)
  if (!Array.isArray(data) || data.length !== 1) {
    throw unavailable('The battle chat message could not be stored.')
  }
  return parseMessageRow(data[0])
}
