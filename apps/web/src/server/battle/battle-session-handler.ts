import 'server-only'

import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseBattleIntentRequest,
  parseBattleSessionCreateRequest,
  parseBattleSessionId,
} from '@aurevane/validation/combat/battle-session'

import { toServerErrorResponse } from '../http/error-response'
import type { BattleSessionService } from './battle-session-service'

interface Dependencies {
  getActor: () => Promise<AuthenticatedActor>
  service: BattleSessionService
}

async function readJson(request: Request): Promise<unknown> {
  try { return await request.json() } catch { throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.') }
}

function battleResponse(battle: Awaited<ReturnType<BattleSessionService['getSession']>>): Response {
  return Response.json({ battle }, { status: 200, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function handleCreateBattleSessionRequest(request: Request, dependencies: Dependencies): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const parsed = parseBattleSessionCreateRequest(await readJson(request))
    if (!parsed) throw new AurevaneError('INVALID_REQUEST', 'Invalid battle-session creation request.')
    const battle = await dependencies.service.createSession({
      userId: actor.userId,
      characterId: parsed.characterId,
      arenaId: parsed.arenaId,
      aiDifficulty: parsed.aiDifficulty,
      idempotencyKey: parsed.idempotencyKey,
    })
    return battleResponse(battle)
  } catch (error) { return toServerErrorResponse(error) }
}

export async function handleGetBattleSessionRequest(battleSessionIdInput: unknown, dependencies: Dependencies): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const battleSessionId = parseBattleSessionId(battleSessionIdInput)
    if (!battleSessionId) throw new AurevaneError('INVALID_REQUEST', 'Invalid battle-session identifier.')
    return battleResponse(await dependencies.service.getSession(actor.userId, battleSessionId))
  } catch (error) { return toServerErrorResponse(error) }
}

export async function handleBattleIntentRequest(request: Request, battleSessionIdInput: unknown, dependencies: Dependencies): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const battleSessionId = parseBattleSessionId(battleSessionIdInput)
    const parsed = parseBattleIntentRequest(await readJson(request))
    if (!battleSessionId || !parsed) throw new AurevaneError('INVALID_REQUEST', 'Invalid battle intent request.')
    const battle = await dependencies.service.submitIntent({
      userId: actor.userId,
      battleSessionId,
      expectedBattleVersion: parsed.expectedBattleVersion,
      idempotencyKey: parsed.idempotencyKey,
      intent: parsed.intent,
    })
    return battleResponse(battle)
  } catch (error) { return toServerErrorResponse(error) }
}
