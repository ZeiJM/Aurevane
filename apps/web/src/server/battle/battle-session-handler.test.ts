import { StaleBattleVersionError } from '@aurevane/game-core/errors'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { BattleSessionService } from './battle-session-service'
import {
  handleBattleIntentRequest,
  handleCreateBattleSessionRequest,
  handleGetBattleSessionRequest,
} from './battle-session-handler'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const IDEMPOTENCY_KEY = '44444444-4444-4444-8444-444444444444'

function createService() {
  return {
    createSession: vi.fn(),
    getSession: vi.fn(),
    submitIntent: vi.fn(),
  } as unknown as BattleSessionService & {
    createSession: ReturnType<typeof vi.fn>
    getSession: ReturnType<typeof vi.fn>
    submitIntent: ReturnType<typeof vi.fn>
  }
}

function actor() {
  return { userId: USER_ID, email: 'wayfarer@example.com' }
}

describe('P2.4 battle session HTTP handlers', () => {
  it('rejects malformed creation input before calling the service', async () => {
    const service = createService()
    const response = await handleCreateBattleSessionRequest(
      new Request('http://localhost/api/battles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ characterId: CHARACTER_ID }),
      }),
      { getActor: vi.fn(async () => actor()), service },
    )

    expect(response.status).toBe(400)
    expect(service.createSession).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } })
  })

  it('delegates only validated battle intent fields and exposes identifier-only refetch metadata', async () => {
    const service = createService()
    const invalidation = {
      event: 'authoritative_state_changed' as const,
      topic: `battle-session:${SESSION_ID}` as const,
      resourceType: 'battle_session' as const,
      resourceId: SESSION_ID,
      version: 2,
      occurredAt: '2026-08-17T10:46:00.000Z',
      reason: 'state_changed' as const,
    }
    service.submitIntent.mockResolvedValue({
      battleSessionId: SESSION_ID,
      battleVersion: 2,
      snapshot: {},
      replayed: false,
      invalidation,
    })

    const response = await handleBattleIntentRequest(
      new Request(`http://localhost/api/battles/${SESSION_ID}/intents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: IDEMPOTENCY_KEY,
          expectedBattleVersion: 1,
          intent: {
            kind: 'move',
            path: [
              { x: 0, y: 1 },
              { x: 1, y: 1 },
            ],
          },
        }),
      }),
      SESSION_ID,
      { getActor: vi.fn(async () => actor()), service },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(service.submitIntent).toHaveBeenCalledWith({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
      intent: {
        kind: 'move',
        path: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
      },
    })
    expect(await response.json()).toMatchObject({
      battle: {
        battleSessionId: SESSION_ID,
        battleVersion: 2,
        invalidation,
      },
    })
  })

  it('returns current authoritative version metadata for a stale intent', async () => {
    const service = createService()
    service.submitIntent.mockRejectedValue(new StaleBattleVersionError(7))

    const response = await handleBattleIntentRequest(
      new Request(`http://localhost/api/battles/${SESSION_ID}/intents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: IDEMPOTENCY_KEY,
          expectedBattleVersion: 3,
          intent: { kind: 'end-turn' },
        }),
      }),
      SESSION_ID,
      { getActor: vi.fn(async () => actor()), service },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: {
        code: 'STALE_VERSION',
        message: 'The battle changed. Refresh the authoritative battle state and retry.',
        currentVersion: 7,
      },
    })
  })

  it('rejects invalid battle-session identifiers before reconnect lookup', async () => {
    const service = createService()
    const response = await handleGetBattleSessionRequest('not-a-session-id', {
      getActor: vi.fn(async () => actor()),
      service,
    })

    expect(response.status).toBe(400)
    expect(service.getSession).not.toHaveBeenCalled()
  })
})
