import {
  isAurevaneError,
  isStaleBattleVersionError,
  type AurevaneErrorCode,
} from '@aurevane/game-core/errors'

import { serverLogger, type ServerLogger } from '../logging'

const statusByCode: Record<AurevaneErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INVALID_REQUEST: 400,
  IDEMPOTENCY_CONFLICT: 409,
  STALE_VERSION: 409,
  CHARACTER_NAME_UNAVAILABLE: 409,
  CHARACTER_ALREADY_EXISTS: 409,
  CHARACTER_RESELECT_COOLDOWN: 409,
  TITLE_UNAVAILABLE: 409,
  TITLE_ALREADY_SET: 409,
  PERSISTENCE_UNAVAILABLE: 503,
}

export function toServerErrorResponse(
  error: unknown,
  logger: ServerLogger = serverLogger,
): Response {
  if (isAurevaneError(error)) {
    if (error.code === 'PERSISTENCE_UNAVAILABLE') {
      logger.error('server.persistence_unavailable', { code: error.code })
    }

    return Response.json(
      {
        error: {
          code: error.code,
          message: error.publicMessage,
          ...(isStaleBattleVersionError(error) ? { currentVersion: error.currentVersion } : {}),
        },
      },
      {
        status: statusByCode[error.code],
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  }

  logger.error('server.unhandled_error', {
    errorType: error instanceof Error ? error.name : 'unknown',
  })

  return Response.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The server could not complete that request.',
      },
    },
    {
      status: 500,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  )
}
