import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

import { tickAiTurnClock } from './ai-battle-quality-service'
import { tickPvpTurnClock } from './pvp-battle-quality-service'

async function isPvpBattleForUser(userId: string, battleSessionId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('is_pvp_battle_for_user_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
  })

  if (error || typeof data !== 'boolean') {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The battle turn deadline could not be verified safely.',
    )
  }

  return data
}

export async function enforceBattleTurnDeadline(
  userId: string,
  battleSessionId: string,
): Promise<void> {
  const pvp = await isPvpBattleForUser(userId, battleSessionId)
  const tick = pvp
    ? await tickPvpTurnClock(userId, battleSessionId)
    : await tickAiTurnClock(userId, battleSessionId)
  if (tick.timedOut) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Your turn timer expired. The battle has advanced to the next combatant.',
    )
  }
}

export const enforcePvpTurnDeadline = enforceBattleTurnDeadline
