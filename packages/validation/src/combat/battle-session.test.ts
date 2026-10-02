import { describe, expect, it } from 'vitest'

import { parseBattleIntentRequest, parseBattleSessionCreateRequest } from './battle-session'

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

describe('AI Sparring participant validation', () => {
  const request = {
    idempotencyKey: IDEMPOTENCY_KEY,
    characterId: IDEMPOTENCY_KEY,
    battleHallRecordId: 'recruit-sparring',
  }
  it.each([0, 1, 2])(
    'accepts every enemy count within the six-person limit with %s allies',
    (allyCount) => {
      for (let enemyCount = 1; enemyCount <= 5 - allyCount; enemyCount++) {
        expect(
          parseBattleSessionCreateRequest({ ...request, allyCount, enemyCount }),
        ).toMatchObject({ allyCount, enemyCount })
      }
    },
  )
  it.each([
    [0, 6],
    [1, 5],
    [2, 4],
    [3, 1],
    [-1, 1],
    [0, 0],
    [0, 1.5],
  ])('rejects invalid counts %s / %s', (allyCount, enemyCount) => {
    expect(parseBattleSessionCreateRequest({ ...request, allyCount, enemyCount })).toBeNull()
  })
  it('keeps guided exercises and mastery trials as duels', () => {
    expect(
      parseBattleSessionCreateRequest({
        ...request,
        battleHallRecordId: 'guided-fundamentals',
        allyCount: 1,
        enemyCount: 1,
      }),
    ).toBeNull()
    expect(
      parseBattleSessionCreateRequest({
        ...request,
        battleHallRecordId: 'mastery-trial',
        allyCount: 0,
        enemyCount: 2,
      }),
    ).toBeNull()
  })
})
