import { describe, expect, it } from 'vitest'

import { AurevaneError, isAurevaneError } from './errors'

describe('AurevaneError', () => {
  it('carries a stable code and player-safe message', () => {
    const error = new AurevaneError('FORBIDDEN', 'You are not allowed to do that.')

    expect(isAurevaneError(error)).toBe(true)
    expect(error.code).toBe('FORBIDDEN')
    expect(error.publicMessage).toBe('You are not allowed to do that.')
  })
})
