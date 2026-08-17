import { StaleBattleVersionError } from '@aurevane/game-core/errors'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { handleBattleRecruitTurnRequest } from './battle-recruit-ai-handler'
import type { BattleRecruitAiService } from './battle-recruit-ai-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'

function actor() {
  return { userId: USER_ID, email: 'wayfarer@example.com' }
}

function createService() {
  return {
    runTurn: vi.fn(),
  } as unknown as BattleRecruitAiService & { runTurn: ReturnType<typeof vi.fn> }
}

describe('P2.6 Recruit turn HTTP handler', () => {
  it('rejects malformed requests before invoking AI authority', async () => {
    const service = createService()
    const response = await handleBattleRecruitTurnRequest(
      new Request(`http://localhost/api/battles/${SESSION_ID}/recruit-turn`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedBattleVersion: 0, intent: { kind: 'end-turn' } }),
      }),
      SESSION_ID,
      { getActor: vi.fn(async () => actor()), service },
    )

    expect(response.status).toBe(400)
    expect(service.runTurn).not.toHaveBeenCalled()
  })

  it('delegates only actor, session identity, and expected version', async () => {
    const service = createService()
    service.runTurn.mockResolvedValue({
      battleSessionId: SESSION_ID,
      battleVersion: 5,
      snapshot: {},
      decisions: [{ combatantId: 'recruit:p2-4-1', reason: 'close-distance', utility: 33 }],
      invalidation: {
        event: 'authoritative_state_changed',
        topic: `battle-session:${SESSION_ID}`,
        resourceType: 'battle_session',
        resourceId: SESSION_ID,
        version: 5,
        occurredAt: '2026-08-17T15:00:00.000Z',
        reason: 'state_changed',
      },
    })

    const response = await handleBattleRecruitTurnRequest(
      new Request(`http://localhost/api/battles/${SESSION_ID}/recruit-turn`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedBattleVersion: 2 }),
      }),
      SESSION_ID,
      { getActor: vi.fn(async () => actor()), service },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(service.runTurn).toHaveBeenCalledWith({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 2,
    })
    const body = await response.json()
    expect(body.battle).toMatchObject({ battleVersion: 5 })
    expect(JSON.stringify(body)).not.toContain('rng')
    expect(JSON.stringify(body)).not.toContain('tieBreakSeed')
  })

  it('surfaces the latest version for stale Recruit-turn requests', async () => {
    const service = createService()
    service.runTurn.mockRejectedValue(new StaleBattleVersionError(8))

    const response = await handleBattleRecruitTurnRequest(
      new Request(`http://localhost/api/battles/${SESSION_ID}/recruit-turn`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedBattleVersion: 4 }),
      }),
      SESSION_ID,
      { getActor: vi.fn(async () => actor()), service },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: {
        code: 'STALE_VERSION',
        message: 'The battle changed. Refresh the authoritative battle state and retry.',
        currentVersion: 8,
      },
    })
  })
})
