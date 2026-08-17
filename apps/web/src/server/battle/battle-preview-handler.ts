import 'server-only'

import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseBattlePreviewRequest,
  parseBattleSessionId,
} from '@aurevane/validation/combat/battle-session'

import { toServerErrorResponse } from '../http/error-response'
import type { BattlePreviewService } from './battle-preview-service'

interface Dependencies {
  getActor: () => Promise<AuthenticatedActor>
  service: BattlePreviewService
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}

export async function handleBattlePreviewRequest(
  request: Request,
  battleSessionIdInput: unknown,
  dependencies: Dependencies,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const battleSessionId = parseBattleSessionId(battleSessionIdInput)
    const parsed = parseBattlePreviewRequest(await readJson(request))
    if (!battleSessionId || !parsed) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid battle preview request.')
    }

    const battlePreview = await dependencies.service.previewIntent({
      userId: actor.userId,
      battleSessionId,
      expectedBattleVersion: parsed.expectedBattleVersion,
      intent: parsed.intent,
    })

    return Response.json(
      { battlePreview },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
