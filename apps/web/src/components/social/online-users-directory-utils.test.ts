import { describe, expect, it } from 'vitest'

import {
  compareLastSeenAt,
  formatLastSeenAt,
  readableIdentity,
} from './online-users-directory-utils'

describe('online users directory helpers', () => {
  it('formats the canonical discipline id for the class filter', () => {
    expect(readableIdentity('starter.aetherist')).toBe('Aetherist')
  })

  it('reports elapsed presence time in minutes', () => {
    const now = Date.parse('2026-09-05T16:00:00.000Z')
    expect(formatLastSeenAt('2026-09-05T15:33:00.000Z', now)).toBe('Last seen 27 min ago')
    expect(formatLastSeenAt(null, now)).toBe('Never seen')
  })

  it('sorts recorded heartbeats while keeping never-seen characters last', () => {
    const recent = '2026-09-05T15:50:00.000Z'
    const older = '2026-09-05T14:00:00.000Z'

    expect(compareLastSeenAt(recent, older, 'recent')).toBeLessThan(0)
    expect(compareLastSeenAt(recent, older, 'oldest')).toBeGreaterThan(0)
    expect(compareLastSeenAt(null, older, 'recent')).toBeGreaterThan(0)
    expect(compareLastSeenAt(null, older, 'oldest')).toBeGreaterThan(0)
  })
})
