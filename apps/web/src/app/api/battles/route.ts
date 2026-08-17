import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleCreateBattleSessionRequest } from '@/server/battle/battle-session-handler'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'

export async function POST(request: Request) {
  return handleCreateBattleSessionRequest(request, {
    getActor: getAuthenticatedActor,
    service: createBattleSessionService({
      characters: createSupabaseCharacterRepository(),
      battles: createSupabaseBattleSessionRepository(),
    }),
  })
}
