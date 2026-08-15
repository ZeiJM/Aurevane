import { describe, expect, it } from 'vitest'

import { createRealtimeInvalidation } from './index'

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
})
