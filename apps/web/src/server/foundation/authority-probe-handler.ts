import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import { parseAuthorityProbeRequest } from '@aurevane/validation/foundation/authority-probe'

import { executeAuthorityProbe, type AuthorityProbeRepository } from './authority-probe-service'
import { toServerErrorResponse } from '@/server/http/error-response'

export interface AuthorityProbeHandlerDependencies {
  getActor(): Promise<AuthenticatedActor>
  repository: AuthorityProbeRepository
}

export async function handleAuthorityProbeRequest(
  request: Request,
  dependencies: AuthorityProbeHandlerDependencies,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const input = parseAuthorityProbeRequest(await readRequestJson(request))

    if (!input) {
      throw new AurevaneError('INVALID_REQUEST', 'The request was not valid.')
    }

    const outcome = await executeAuthorityProbe(
      {
        actor,
        idempotencyKey: input.idempotencyKey,
      },
      dependencies.repository,
    )

    return Response.json(
      {
        receiptId: outcome.result.receiptId,
        acceptedAt: outcome.result.acceptedAt,
        replayed: outcome.replayed,
      },
      {
        status: outcome.replayed ? 200 : 201,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

async function readRequestJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}
