import { describe, expect, it, vi } from 'vitest'

import { executeAuthorityProbe, type AuthorityProbeRepository } from './authority-probe-service'

describe('authority probe service', () => {
  it('derives authoritative persistence scope instead of accepting it from the caller', async () => {
    const execute = vi.fn<AuthorityProbeRepository['execute']>().mockResolvedValue({
      result: {
        receiptId: 'f74ac06d-4c42-4c74-afb0-0860626fdc35',
        acceptedAt: '2026-08-15T20:57:00+00:00',
      },
      replayed: false,
    })

    const result = await executeAuthorityProbe(
      {
        actor: { userId: '94e76093-e46b-4859-a01b-33c541d76fcf' },
        idempotencyKey: '3d26ca60-6f3e-4bf8-aa85-fbf5e92095ca',
      },
      { execute },
    )

    expect(execute).toHaveBeenCalledWith({
      actorKey: 'user:94e76093-e46b-4859-a01b-33c541d76fcf',
      commandName: 'foundation.authority_probe',
      idempotencyKey: '3d26ca60-6f3e-4bf8-aa85-fbf5e92095ca',
      requestFingerprint: 'foundation.authority_probe:v1',
    })
    expect(result.replayed).toBe(false)
  })
})
