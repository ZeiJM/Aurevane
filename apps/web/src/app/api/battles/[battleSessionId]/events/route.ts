import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleBattleLogRequest } from '@/server/battle/battle-log-handler'
import { createViewerSafeBattleLogService } from '@/server/battle/battle-log-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'

export async function GET(
  _request: Request,
  context: { params: Promise<{ battleSessionId: string }> },
) {
  const { battleSessionId } = await context.params
  const repository = createSupabaseBattleSessionRepository()
  return handleBattleLogRequest(battleSessionId, {
    getActor: getAuthenticatedActor,
    service: createViewerSafeBattleLogService(
      repository,
      repository,
      createServerCombatContentResolver(),
    ),
  })
}
