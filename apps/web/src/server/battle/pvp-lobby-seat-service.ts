import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

import { getPvpLobby } from './pvp-lobby-service'

function mapSeatError(error: { code?: string; message?: string }): never {
  const message = error.message ?? ''
  if (error.code === '42501') {
    throw new AurevaneError('FORBIDDEN', 'That PvP lobby is not available to this account.')
  }
  if (message.includes('PVP_INVALID_SEAT')) {
    throw new AurevaneError('INVALID_REQUEST', 'That PvP seat is not available in this format.')
  }
  if (message.includes('PVP_SEAT_OCCUPIED')) {
    throw new AurevaneError('INVALID_REQUEST', 'Choose an open seat before rejoining the roster.')
  }
  if (message.includes('PVP_LOBBY_NOT_WAITING')) {
    throw new AurevaneError('INVALID_REQUEST', 'Team composition is locked after battle begins.')
  }
  throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'PvP seating is unavailable right now.')
}

export async function movePvpLobbySeat(
  userId: string,
  lobbyId: string,
  targetTeamIndex: number | null,
  targetSeatIndex: number | null,
) {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.rpc('move_pvp_lobby_seat_v2', {
    p_user_id: userId,
    p_lobby_id: lobbyId,
    p_target_team_index: targetTeamIndex,
    p_target_seat_index: targetSeatIndex,
  })
  if (error) mapSeatError(error)
  return getPvpLobby(userId, lobbyId)
}
