import type { PlayerProfileRepository } from '@aurevane/db/player-profile'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import { describe, expect, it, vi } from 'vitest'

import type { ServerLogger } from '../logging'
import { loadGameEntryProfileState } from './game-entry-profile-state'

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
}

function createLogger(): ServerLogger {
  return { error: vi.fn() }
}

describe('loadGameEntryProfileState', () => {
  it('returns the verified actor profile when persistence is ready', async () => {
    const repository: PlayerProfileRepository = {
      findByUserId: vi.fn().mockResolvedValue({
        userId: actor.userId,
        createdAt: '2026-08-16T00:00:00.000Z',
      }),
    }
    const logger = createLogger()

    await expect(loadGameEntryProfileState(actor, repository, logger)).resolves.toEqual({
      kind: 'ready',
      profile: {
        userId: actor.userId,
        createdAt: '2026-08-16T00:00:00.000Z',
      },
    })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('converts known persistence unavailability into a recoverable state', async () => {
    const repository: PlayerProfileRepository = {
      findByUserId: vi
        .fn()
        .mockRejectedValue(new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Database detail')),
    }
    const logger = createLogger()

    await expect(loadGameEntryProfileState(actor, repository, logger)).resolves.toEqual({
      kind: 'persistence-unavailable',
    })
    expect(logger.error).toHaveBeenCalledWith('player_profile.persistence_unavailable')
  })

  it('does not hide unexpected programming failures', async () => {
    const unexpected = new TypeError('unexpected')
    const repository: PlayerProfileRepository = {
      findByUserId: vi.fn().mockRejectedValue(unexpected),
    }

    await expect(loadGameEntryProfileState(actor, repository, createLogger())).rejects.toBe(
      unexpected,
    )
  })
})
