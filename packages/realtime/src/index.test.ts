import { describe, expect, it } from 'vitest'

import { createCharacterLevelChangedInvalidation, createRealtimeInvalidation } from './index'

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
})
