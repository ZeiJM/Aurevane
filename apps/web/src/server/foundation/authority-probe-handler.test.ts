import { AurevaneError } from '@aurevane/game-core/errors'
import { describe, expect, it, vi } from 'vitest'

import {
  handleAuthorityProbeRequest,
  type AuthorityProbeHandlerDependencies,
} from './authority-probe-handler'

function createRequest(body: unknown): Request {
  return new Request('https://aurevane.test/api/foundation/authority-probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createDependencies(
  overrides: Partial<AuthorityProbeHandlerDependencies> = {},
): AuthorityProbeHandlerDependencies {
  return {
    getActor: vi.fn().mockResolvedValue({
      userId: '94e76093-e46b-4859-a01b-33c541d76fcf',
    }),
    repository: {
      execute: vi.fn().mockResolvedValue({
        result: {
          receiptId: 'f74ac06d-4c42-4c74-afb0-0860626fdc35',
          acceptedAt: '2026-08-15T20:57:00+00:00',
        },
        replayed: false,
      }),
    },
    ...overrides,
  }
}

describe('authority probe request boundary', () => {
  it('authenticates, validates, and returns only the authoritative receipt', async () => {
    const dependencies = createDependencies()
    const response = await handleAuthorityProbeRequest(
      createRequest({ idempotencyKey: '3d26ca60-6f3e-4bf8-aa85-fbf5e92095ca' }),
      dependencies,
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      receiptId: 'f74ac06d-4c42-4c74-afb0-0860626fdc35',
      acceptedAt: '2026-08-15T20:57:00+00:00',
      replayed: false,
    })
  })

  it('returns 200 for a safe replay of a committed command', async () => {
    const dependencies = createDependencies({
      repository: {
        execute: vi.fn().mockResolvedValue({
          result: {
            receiptId: 'f74ac06d-4c42-4c74-afb0-0860626fdc35',
            acceptedAt: '2026-08-15T20:57:00+00:00',
          },
          replayed: true,
        }),
      },
    })

    const response = await handleAuthorityProbeRequest(
      createRequest({ idempotencyKey: '3d26ca60-6f3e-4bf8-aa85-fbf5e92095ca' }),
      dependencies,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ replayed: true })
  })

  it('rejects unauthenticated requests before persistence', async () => {
    const execute = vi.fn()
    const response = await handleAuthorityProbeRequest(
      createRequest({ idempotencyKey: '3d26ca60-6f3e-4bf8-aa85-fbf5e92095ca' }),
      createDependencies({
        getActor: vi.fn().mockRejectedValue(
          new AurevaneError('UNAUTHENTICATED', 'Authentication required.'),
        ),
        repository: { execute },
      }),
    )

    expect(response.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects client-forged or malformed fields before persistence', async () => {
    const execute = vi.fn()
    const response = await handleAuthorityProbeRequest(
      createRequest({
        idempotencyKey: '3d26ca60-6f3e-4bf8-aa85-fbf5e92095ca',
        trustedResult: true,
      }),
      createDependencies({ repository: { execute } }),
    )

    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('translates persistence failures without exposing internal details', async () => {
    const response = await handleAuthorityProbeRequest(
      createRequest({ idempotencyKey: '3d26ca60-6f3e-4bf8-aa85-fbf5e92095ca' }),
      createDependencies({
        repository: {
          execute: vi.fn().mockRejectedValue(
            new AurevaneError(
              'IDEMPOTENCY_CONFLICT',
              'That request key was already used for a different request.',
            ),
          ),
        },
      }),
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: {
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'That request key was already used for a different request.',
      },
    })
  })
})
