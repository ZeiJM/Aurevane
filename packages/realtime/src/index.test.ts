import { describe, expect, it } from 'vitest'

import {
  createBattleSessionChangedInvalidation,
  createCharacterLevelChangedInvalidation,
  createRealtimeInvalidation,
} from './index'

describe('realtime invalidations', () => {
  it('carry identifiers for authoritative refetch instead of authoritative state', () => {
    expect(
      createRealtimeInvalidation({
        topic: 'user:abc',
        resourceType: 'foundation-probe',
        resourceId: 'receipt-1',
      }),
    ).toEqual({
      event: 'authoritative_state_changed',
      topic: 'user:abc',
      resourceType: 'foundation-probe',
      resourceId: 'receipt-1',
    })
  })

  it('creates a Level-change invalidation without broadcasting character state', () => {
    expect(
      createCharacterLevelChangedInvalidation({
        characterId: 'character-1',
        level: 12,
        occurredAt: '2026-08-16T20:00:00.000Z',
      }),
    ).toEqual({
      event: 'authoritative_state_changed',
      topic: 'character:character-1',
      resourceType: 'character_profile',
      resourceId: 'character-1',
      version: 12,
      occurredAt: '2026-08-16T20:00:00.000Z',
      reason: 'level_changed',
    })
  })

  it('creates an identifier-only battle-session invalidation for authoritative refetch', () => {
    const invalidation = createBattleSessionChangedInvalidation({
      battleSessionId: '33333333-3333-4333-8333-333333333333',
      battleVersion: 7,
      occurredAt: '2026-08-17T10:45:00.000Z',
      reason: 'state_changed',
    })

    expect(invalidation).toEqual({
      event: 'authoritative_state_changed',
      topic: 'battle-session:33333333-3333-4333-8333-333333333333',
      resourceType: 'battle_session',
      resourceId: '33333333-3333-4333-8333-333333333333',
      version: 7,
      occurredAt: '2026-08-17T10:45:00.000Z',
      reason: 'state_changed',
    })
    expect(invalidation).not.toHaveProperty('snapshot')
    expect(invalidation).not.toHaveProperty('rng')
    expect(invalidation).not.toHaveProperty('events')
  })
})
