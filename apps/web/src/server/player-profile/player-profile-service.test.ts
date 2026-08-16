import { AurevaneError } from '@aurevane/game-core/errors'
import { describe, expect, it, vi } from 'vitest'

import { loadPlayerProfile } from './player-profile-service'

describe('player profile service', () => {
  it('loads only the authenticated actor profile', async () => {
    const findByUserId = vi.fn().mockResolvedValue({
      userId: '94e76093-e46b-4859-a01b-33c541d76fcf',
      createdAt: '2026-08-16T00:10:00+00:00',
    })

    const profile = await loadPlayerProfile(
      { userId: '94e76093-e46b-4859-a01b-33c541d76fcf' },
      { findByUserId },
    )

    expect(findByUserId).toHaveBeenCalledWith('94e76093-e46b-4859-a01b-33c541d76fcf')
    expect(profile.userId).toBe('94e76093-e46b-4859-a01b-33c541d76fcf')
  })

  it('fails safely when the profile is missing or does not belong to the actor', async () => {
    await expect(
      loadPlayerProfile(
        { userId: '94e76093-e46b-4859-a01b-33c541d76fcf' },
        { findByUserId: vi.fn().mockResolvedValue(null) },
      ),
    ).rejects.toMatchObject<AurevaneError>({ code: 'PERSISTENCE_UNAVAILABLE' })

    await expect(
      loadPlayerProfile(
        { userId: '94e76093-e46b-4859-a01b-33c541d76fcf' },
        {
          findByUserId: vi.fn().mockResolvedValue({
            userId: 'e53a0811-4746-4f09-8105-a014bf3d95f8',
            createdAt: '2026-08-16T00:10:00+00:00',
          }),
        },
      ),
    ).rejects.toMatchObject<AurevaneError>({ code: 'PERSISTENCE_UNAVAILABLE' })
  })
})
