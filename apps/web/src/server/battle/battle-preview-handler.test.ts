import { StaleBattleVersionError } from '@aurevane/game-core/errors'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { BattlePreviewService } from './battle-preview-service'
import { handleBattlePreviewRequest } from './battle-preview-handler'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'

function actor() {
  return { userId: USER_ID, email: 'wayfarer@example.com' }
}

function createService() {
  return {
    previewIntent: vi.fn(),
  } as unknown as BattlePreviewService & {
    previewIntent: ReturnType<typeof vi.fn>
  }
}

describe('P2.5 battle preview HTTP handler', () => {
  it('rejects malformed preview input before calling the service', async () => {
    const service = createService()
    const response = await handleBattlePreviewRequest(
      new Request(`http://localhost/api/battles/${SESSION_ID}/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedBattleVersion: 1 }),
      }),
      SESSION_ID,
      { getActor: vi.fn(async () => actor()), service },
    )

    expect(response.status).toBe(400)
    expect(service.previewIntent).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } })
  })

  it('returns a private no-store preview without mutable battle authority', async () => {
    const service = createService()
    service.previewIntent.mockResolvedValue({
      battleSessionId: SESSION_ID,
      battleVersion: 2,
      preview: {
        kind: 'action',
        legal: true,
        actionId: 'basic.attack.unarmed.basic',
        actorId: `character:${USER_ID}`,
        primaryCombatantId: 'recruit:p2-4-1',
        affectedTiles: [{ x: 4, y: 1 }],
        affectedCombatantIds: ['recruit:p2-4-1'],
        projectedEffects: [
          {
            effectType: 'damage',
            combatantId: 'recruit:p2-4-1',
            before: 80,
            after: 67,
          },
        ],
        mpCost: 0,
        spendsAction: true,
        hitChanceBasisPoints: 6_400,
        defenseKind: 'armor',
        defenseRating: 20,
        mitigatedBaseDamage: 13,
        issues: [],
      },
    })

    const response = await handleBattlePreviewRequest(
      new Request(`http://localhost/api/battles/${SESSION_ID}/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedBattleVersion: 2,
          intent: {
            kind: 'action',
            actionId: 'basic.attack.unarmed.basic',
            target: { kind: 'unit', combatantId: 'recruit:p2-4-1' },
          },
        }),
      }),
      SESSION_ID,
      { getActor: vi.fn(async () => actor()), service },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(service.previewIntent).toHaveBeenCalledWith({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 2,
      intent: {
        kind: 'action',
        actionId: 'basic.attack.unarmed.basic',
        target: { kind: 'unit', combatantId: 'recruit:p2-4-1' },
      },
    })
    const body = await response.json()
    expect(body).toMatchObject({
      battlePreview: {
        battleSessionId: SESSION_ID,
        battleVersion: 2,
        preview: { legal: true, hitChanceBasisPoints: 6_400 },
      },
    })
    expect(JSON.stringify(body)).not.toContain('rng')
    expect(body.battlePreview).not.toHaveProperty('snapshot')
  })

  it('surfaces the current authoritative version for a stale preview', async () => {
    const service = createService()
    service.previewIntent.mockRejectedValue(new StaleBattleVersionError(5))

    const response = await handleBattlePreviewRequest(
      new Request(`http://localhost/api/battles/${SESSION_ID}/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedBattleVersion: 2,
          intent: { kind: 'face', facing: 'east' },
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
        currentVersion: 5,
      },
    })
  })
})
