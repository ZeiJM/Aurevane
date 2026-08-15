import { describe, expect, it } from 'vitest'

import { foundationStatus } from './foundation'

describe('AUREVANE application foundation', () => {
  it('identifies the current implementation boundary', () => {
    expect(foundationStatus.phase).toBe('Phase 0')
    expect(foundationStatus.ticket).toBe('F0.4')
  })

  it('keeps server authority as a foundational invariant', () => {
    expect(foundationStatus.serverAuthoritative).toBe(true)
  })
})
