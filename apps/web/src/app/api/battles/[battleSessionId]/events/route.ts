import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleBattleLogRequest } from '@/server/battle/battle-log-handler'
import { createViewerSafeBattleLogService } from '@/server/battle/battle-log-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'

export async function GET(
  _request: Request,
  context: { params: Promise<{ battleSessionId: string }> },
) {
  const { battleSessionId } = await context.params
  const repository = createSupabaseBattleSessionRepository()
  return handleBattleLogRequest(battleSessionId, {
    getActor: getAuthenticatedActor,
    service: createViewerSafeBattleLogService(repository, repository),
  })
}
