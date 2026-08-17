import { describe, expect, it } from 'vitest'

import { parseBattleIntentRequest } from './battle-session'

const IDEMPOTENCY_KEY = '11111111-1111-4111-8111-111111111111'

describe('P2.4 battle intent validation', () => {
  it('accepts identifier/version plus an opaque legal-shape movement intent', () => {
    expect(
      parseBattleIntentRequest({
        idempotencyKey: IDEMPOTENCY_KEY,
        expectedBattleVersion: 3,
        intent: {
          kind: 'move',
          path: [
            { x: 0, y: 1 },
            { x: 1, y: 1 },
          ],
        },
      }),
    ).toEqual({
      idempotencyKey: IDEMPOTENCY_KEY,
      expectedBattleVersion: 3,
      intent: {
        kind: 'move',
        path: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
      },
    })
  })

  it('rejects unsafe grid integers before they reach deterministic rules', () => {
    expect(
      parseBattleIntentRequest({
        idempotencyKey: IDEMPOTENCY_KEY,
        expectedBattleVersion: 3,
        intent: {
          kind: 'move',
          path: [
            { x: 0, y: 1 },
            { x: Number.MAX_SAFE_INTEGER + 1, y: 1 },
          ],
        },
      }),
    ).toBeNull()
  })

  it('rejects unsafe expected versions and client-submitted outcome fields', () => {
    expect(
      parseBattleIntentRequest({
        idempotencyKey: IDEMPOTENCY_KEY,
        expectedBattleVersion: Number.MAX_SAFE_INTEGER + 1,
        intent: { kind: 'end-turn' },
      }),
    ).toBeNull()

    expect(
      parseBattleIntentRequest({
        idempotencyKey: IDEMPOTENCY_KEY,
        expectedBattleVersion: 3,
        intent: {
          kind: 'action',
          actionId: 'basic.guard',
          target: { kind: 'self' },
          damage: 999999,
        },
      }),
    ).toBeNull()
  })
})
