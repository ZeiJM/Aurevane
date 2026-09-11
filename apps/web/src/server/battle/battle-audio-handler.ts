import 'server-only'

import type { BattleEventRecord } from '@aurevane/db/battle-session'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionId } from '@aurevane/validation/combat/battle-session'
import { selectBattleAudioCues } from '../../media/battle-audio'
import { toServerErrorResponse } from '../http/error-response'

interface Dependencies {
  getActor(): Promise<AuthenticatedActor>
  readEvents(
    userId: string,
    sessionId: string,
    mode: 'pve' | 'pvp',
  ): Promise<readonly BattleEventRecord[]>
}

export async function handleBattleAudioRequest(
  request: Request,
  sessionInput: unknown,
  dependencies: Dependencies,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const sessionId = parseBattleSessionId(sessionInput)
    const params = new URL(request.url).searchParams
    const version = Number(params.get('version'))
    const mode = params.get('mode')
    if (
      !sessionId ||
      !Number.isSafeInteger(version) ||
      version < 1 ||
      (mode !== 'pve' && mode !== 'pvp')
    ) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid battle audio request.')
    }
    // The existing RPC checks participant/active-spectator authorization before returning records.
    const records = await dependencies.readEvents(actor.userId, sessionId, mode)
    return Response.json(
      { battleVersion: version, cues: selectBattleAudioCues(records, version, Date.now()) },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
