import { AurevaneError } from '@aurevane/game-core/errors'
import { describe, expect, it, vi } from 'vitest'

import { toServerErrorResponse } from './error-response'

describe('server error responses', () => {
  it('maps known errors to stable player-safe responses', async () => {
    const logger = { error: vi.fn() }
    const response = toServerErrorResponse(
      new AurevaneError('IDEMPOTENCY_CONFLICT', 'That request key was already used differently.'),
      logger,
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: {
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'That request key was already used differently.',
      },
    })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('does not expose unexpected internal error details', async () => {
    const logger = { error: vi.fn() }
    const response = toServerErrorResponse(new Error('secret database detail'), logger)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The server could not complete that request.',
      },
    })
    expect(logger.error).toHaveBeenCalledWith('server.unhandled_error', {
      errorType: 'Error',
    })
  })
})
