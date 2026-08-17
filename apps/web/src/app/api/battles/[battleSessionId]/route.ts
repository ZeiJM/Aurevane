import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleGetBattleSessionRequest } from '@/server/battle/battle-session-handler'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'

interface RouteContext {
  params: Promise<{ battleSessionId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { battleSessionId } = await context.params
  return handleGetBattleSessionRequest(battleSessionId, {
    getActor: getAuthenticatedActor,
    service: createBattleSessionService({
      characters: createSupabaseCharacterRepository(),
      battles: createSupabaseBattleSessionRepository(),
    }),
  })
}
