import { randomUUID } from 'node:crypto'

import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleBattleIntentRequest } from '@/server/battle/battle-session-handler'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import { enforceBattleTurnDeadline } from '@/server/battle/pvp-turn-command-guard'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'
import { toServerErrorResponse } from '@/server/http/error-response'

interface RouteContext {
  params: Promise<{ battleSessionId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getAuthenticatedActor()
    const { battleSessionId } = await context.params
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid battle commit request.')
    }

    await enforceBattleTurnDeadline(actor.userId, battleSessionId)

    const forwarded = new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(raw as Record<string, unknown>),
        idempotencyKey: randomUUID(),
      }),
    })

    return handleBattleIntentRequest(forwarded, battleSessionId, {
      getActor: async () => actor,
      service: createBattleSessionService({
        characters: createSupabaseCharacterRepository(),
        battles: createSupabaseBattleSessionRepository(),
      }),
    })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
