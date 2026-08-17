import type {
  SetPracticePlanRecord,
  WayfarersPracticeRepository,
} from '@aurevane/db/wayfarers-practice'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { handleSetPracticePlanRequest } from './wayfarers-practice-handler'

const USER_ID = '00000000-0000-4000-8000-000000000b01'
const CHARACTER_ID = '00000000-0000-4000-8000-000000000b02'
const IDEMPOTENCY_KEY = '00000000-0000-4000-8000-000000000b04'

function planRecord(): SetPracticePlanRecord {
  return {
    characterId: CHARACTER_ID,
    userId: USER_ID,
    plannedWindow: 'overnight',
    plannedWindowConfigVersion: 1,
    plannedWindowSeconds: 8 * 60 * 60,
    planSetAt: '2026-08-17T16:00:00.000Z',
    serverNow: '2026-08-17T16:00:00.000Z',
  }
}

function repository(replayed = false): WayfarersPracticeRepository {
  return {
    materializeTrainingReport: vi.fn(),
    getPracticeStatus: vi.fn(),
    setPracticePlan: vi.fn(async () => ({
      replayed,
      result: planRecord(),
    })),
    claimTrainingReport: vi.fn(),
  }
}

function request(body: unknown): Request {
  return new Request('http://localhost/api/wayfarers-practice/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe("P1.6 Wayfarer's Practice Set Practice HTTP handler", () => {
  it('rejects malformed or legacy plan values before persistence', async () => {
    const repo = repository()
    const response = await handleSetPracticePlanRequest(
      request({
        version: 1,
        characterId: CHARACTER_ID,
        plannedWindow: 'until_i_return',
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
      { getActor: vi.fn(async () => ({ userId: USER_ID })), repository: repo },
    )

    expect(response.status).toBe(400)
    expect(repo.setPracticePlan).not.toHaveBeenCalled()
  })

  it('rejects client-authored timing or reward fields instead of silently ignoring them', async () => {
    const repo = repository()
    const response = await handleSetPracticePlanRequest(
      request({
        version: 1,
        characterId: CHARACTER_ID,
        plannedWindow: 'overnight',
        idempotencyKey: IDEMPOTENCY_KEY,
        plannedWindowSeconds: 999999,
        planSetAt: '2099-01-01T00:00:00.000Z',
        requestedCharacterXp: 999999,
      }),
      { getActor: vi.fn(async () => ({ userId: USER_ID })), repository: repo },
    )

    expect(response.status).toBe(400)
    expect(repo.setPracticePlan).not.toHaveBeenCalled()
  })

  it('delegates only authenticated identity, character, enum intent, and idempotency key', async () => {
    const repo = repository()
    const response = await handleSetPracticePlanRequest(
      request({
        version: 1,
        characterId: CHARACTER_ID,
        plannedWindow: 'overnight',
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
      { getActor: vi.fn(async () => ({ userId: USER_ID })), repository: repo },
    )

    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(repo.setPracticePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        actorKey: `user:${USER_ID}`,
        commandName: 'wayfarers_practice.set_plan.v1',
        userId: USER_ID,
        characterId: CHARACTER_ID,
        plannedWindow: 'overnight',
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    )
    const persistenceInput = vi.mocked(repo.setPracticePlan).mock.calls[0]?.[0]
    expect(persistenceInput?.requestFingerprint).toHaveLength(64)
    expect(persistenceInput).not.toHaveProperty('plannedWindowSeconds')
    expect(persistenceInput).not.toHaveProperty('planSetAt')
    expect(persistenceInput).not.toHaveProperty('requestedCharacterXp')

    const body = await response.json()
    expect(body).toMatchObject({
      replayed: false,
      plan: {
        plannedWindow: 'overnight',
        plannedWindowSeconds: 8 * 60 * 60,
      },
    })
  })

  it('returns the same server result as an idempotent replay without creating a second semantic action', async () => {
    const repo = repository(true)
    const response = await handleSetPracticePlanRequest(
      request({
        version: 1,
        characterId: CHARACTER_ID,
        plannedWindow: 'overnight',
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
      { getActor: vi.fn(async () => ({ userId: USER_ID })), repository: repo },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ replayed: true })
  })
})
