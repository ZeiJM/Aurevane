import 'server-only'

import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseBattleFinalTurnPreviewRequest,
  parseBattleFinalTurnRequest,
  parseBattleSessionId,
} from '@aurevane/validation/combat/battle-session'

import type { BattleFinalTurnService } from './battle-final-turn-service'
import { toServerErrorResponse } from '../http/error-response'

interface Dependencies {
  getActor: () => Promise<AuthenticatedActor>
  service: BattleFinalTurnService
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}

export async function handleBattleFinalTurnPreviewRequest(
  request: Request,
  battleSessionIdInput: unknown,
  dependencies: Dependencies,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const battleSessionId = parseBattleSessionId(battleSessionIdInput)
    const parsed = parseBattleFinalTurnPreviewRequest(await readJson(request))
    if (!battleSessionId || !parsed) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid final-turn preview request.')
    }

    const finalTurnPreview = await dependencies.service.previewFinalTurn({
      userId: actor.userId,
      battleSessionId,
      expectedBattleVersion: parsed.expectedBattleVersion,
      facing: parsed.facing,
    })

    return Response.json(
      { finalTurnPreview },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function handleBattleFinalTurnRequest(
  request: Request,
  battleSessionIdInput: unknown,
  dependencies: Dependencies,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const battleSessionId = parseBattleSessionId(battleSessionIdInput)
    const parsed = parseBattleFinalTurnRequest(await readJson(request))
    if (!battleSessionId || !parsed) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid final-turn request.')
    }

    const battle = await dependencies.service.commitFinalTurn({
      userId: actor.userId,
      battleSessionId,
      expectedBattleVersion: parsed.expectedBattleVersion,
      idempotencyKey: parsed.idempotencyKey,
      facing: parsed.facing,
    })

    return Response.json(
      { battle },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
