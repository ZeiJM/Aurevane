import { describe, expect, it } from 'vitest'

import { parseBattleIntentRequest, parseBattleSessionCreateRequest } from './battle-session'

const IDEMPOTENCY_KEY = '11111111-1111-4111-8111-111111111111'

describe('explicit Manual modifier intent', () => {
  const parse = (intent: unknown) =>
    parseBattleIntentRequest({
      idempotencyKey: IDEMPOTENCY_KEY,
      expectedBattleVersion: 1,
      intent,
    })
  const action = {
    kind: 'action',
    actionId: 'basic.attack',
    target: { kind: 'unit', combatantId: 'enemy' },
  }
  const reference = { sourceInstanceId: '["actor","skill",1]', behaviorId: 'bonus' }
  it('accepts exact opaque reference identities and optional root behavior', () => {
    expect(
      parse({ ...action, behaviorId: 'strike', manualModifiers: [reference] })?.intent,
    ).toEqual({ ...action, behaviorId: 'strike', manualModifiers: [reference] })
    expect(parse(action)).not.toBeNull()
    expect(parse({ ...action, manualModifiers: [] })).not.toBeNull()
  })
  it.each([
    null,
    {},
    'bonus',
    [reference, reference],
    [{ ...reference, definition: {} }],
    [{ ...reference, sourceInstanceId: ' outer ' }],
    [{ ...reference, behaviorId: '' }],
    Array.from({ length: 16 }, (_, i) => ({ ...reference, behaviorId: `bonus-${i}` })),
  ])('rejects malformed/duplicate/overbudget references %j', (manualModifiers) => {
    expect(parse({ ...action, manualModifiers })).toBeNull()
  })
  it('rejects private Basic execution authority in client commands', () => {
    expect(parse({ ...action, nativeBasicAttackCommand: true })).toBeNull()
    expect(
      parse({ ...action, manualModifiers: [{ ...reference, nativeBasicAttackCommand: true }] }),
    ).toBeNull()
  })
  it('accepts fifteen distinct references but rejects fields on other intents', () => {
    expect(
      parse({
        ...action,
        manualModifiers: Array.from({ length: 15 }, (_, i) => ({
          ...reference,
          behaviorId: `bonus-${i}`,
        })),
      }),
    ).not.toBeNull()
    expect(parse({ kind: 'end-turn', manualModifiers: [] })).toBeNull()
    expect(parse({ ...action, behaviorId: ' outer ' })).toBeNull()
  })
})

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

describe('strict targeting decisions', () => {
  const request = (target: unknown) => ({
    idempotencyKey: IDEMPOTENCY_KEY,
    expectedBattleVersion: 3,
    intent: { kind: 'action', actionId: 'skill.line', target },
  })
  it.each(['north', 'east', 'south', 'west'])('accepts %s direction', (direction) =>
    expect(parseBattleIntentRequest(request({ kind: 'direction', direction }))).not.toBeNull(),
  )
  it('accepts one area activation', () =>
    expect(parseBattleIntentRequest(request({ kind: 'activate' }))).not.toBeNull())
  it.each([
    { kind: 'direction', direction: 'diagonal' },
    { kind: 'activate', victims: ['enemy'] },
    { kind: 'activate', tiles: [{ x: 1, y: 1 }] },
    { kind: 'direction', direction: 'north', combatantId: 'enemy' },
  ])('rejects malformed or supplied coverage %j', (target) =>
    expect(parseBattleIntentRequest(request(target))).toBeNull(),
  )
})

it('parses explicit area Ground intent without accepting false or unrecognized fields', () => {
  const request = {
    idempotencyKey: IDEMPOTENCY_KEY,
    expectedBattleVersion: 1,
    intent: {
      kind: 'action',
      actionId: 'fire',
      target: { kind: 'direction', direction: 'east', ground: true },
    },
  }
  expect(parseBattleIntentRequest(request)?.intent).toEqual(request.intent)
  expect(
    parseBattleIntentRequest({
      ...request,
      intent: { ...request.intent, target: { ...request.intent.target, ground: false } },
    }),
  ).toBeNull()
})
