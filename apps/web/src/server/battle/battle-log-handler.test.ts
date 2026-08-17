import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { BattleLogService } from './battle-log-service'
import { handleBattleLogRequest } from './battle-log-handler'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'

function actor() {
  return { userId: USER_ID, email: 'wayfarer@example.com' }
}

function createService() {
  return {
    getLog: vi.fn(),
  } as unknown as BattleLogService & {
    getLog: ReturnType<typeof vi.fn>
  }
}

describe('P2.5 battle log HTTP handler', () => {
  it('rejects an invalid battle-session identifier before reading events', async () => {
    const service = createService()
    const response = await handleBattleLogRequest('not-a-session', {
      getActor: vi.fn(async () => actor()),
      service,
    })

    expect(response.status).toBe(400)
    expect(service.getLog).not.toHaveBeenCalled()
  })

  it('returns a private no-store sanitized log', async () => {
    const service = createService()
    service.getLog.mockResolvedValue({
      battleSessionId: SESSION_ID,
      entries: [
        {
          battleVersion: 5,
          eventIndex: 3,
          occurredAt: '2026-08-17T13:00:00.000Z',
          eventType: 'damage_applied',
          message: 'Recruit took 13 damage.',
        },
      ],
    })

    const response = await handleBattleLogRequest(SESSION_ID, {
      getActor: vi.fn(async () => actor()),
      service,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(service.getLog).toHaveBeenCalledWith(USER_ID, SESSION_ID)
    const body = await response.json()
    expect(body).toEqual({
      battleLog: {
        battleSessionId: SESSION_ID,
        entries: [
          {
            battleVersion: 5,
            eventIndex: 3,
            occurredAt: '2026-08-17T13:00:00.000Z',
            eventType: 'damage_applied',
            message: 'Recruit took 13 damage.',
          },
        ],
      },
    })
    expect(JSON.stringify(body)).not.toContain('rng')
    expect(JSON.stringify(body)).not.toContain('snapshot')
  })
})
