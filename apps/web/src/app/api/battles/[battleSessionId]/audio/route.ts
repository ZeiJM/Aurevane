import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleBattleAudioRequest } from '@/server/battle/battle-audio-handler'
import { findPvpBattleEvents } from '@/server/battle/pvp-battle-communication-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'

export async function GET(
  request: Request,
  context: { params: Promise<{ battleSessionId: string }> },
) {
  const { battleSessionId } = await context.params
  return handleBattleAudioRequest(request, battleSessionId, {
    getActor: getAuthenticatedActor,
    readEvents: (userId, sessionId, mode) =>
      mode === 'pvp'
        ? findPvpBattleEvents(userId, sessionId, 100)
        : createSupabaseBattleSessionRepository().findBattleEvents(userId, sessionId, 100),
  })
}
