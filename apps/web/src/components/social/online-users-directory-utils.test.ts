import { describe, expect, it } from 'vitest'

import {
  compareLastSeenAt,
  compareDirectoryCharacters,
  formatLastSeenAt,
  readableDisciplinePair,
  readableIdentity,
} from './online-users-directory-utils'

describe('online users directory helpers', () => {
  it('sorts Level and EXP numerically in either direction, with unavailable EXP last', () => {
    const characters = [
      { characterId: 'a', name: 'Alpha', level: 2, xp: 900, lastSeenAt: '2026-10-05T10:00:00Z' },
      { characterId: 'b', name: 'Beta', level: 10, xp: 12000, lastSeenAt: '2026-10-05T11:00:00Z' },
      { characterId: 'c', name: 'Gamma', level: 3, xp: 0, lastSeenAt: null },
      { characterId: 'd', name: 'Delta', level: 1, xp: null, lastSeenAt: '2026-10-05T12:00:00Z' },
    ]
    const ordered = (order: Parameters<typeof compareDirectoryCharacters>[2]) =>
      [...characters]
        .sort((a, b) => compareDirectoryCharacters(a, b, order))
        .map((row) => row.characterId)
    expect(ordered('level-desc')).toEqual(['b', 'c', 'a', 'd'])
    expect(ordered('level-asc')).toEqual(['d', 'a', 'c', 'b'])
    expect(ordered('exp-desc')).toEqual(['b', 'a', 'c', 'd'])
    expect(ordered('exp-asc')).toEqual(['c', 'a', 'b', 'd'])
    expect(ordered('recent')).toEqual(['d', 'b', 'a', 'c'])
    expect(ordered('oldest')).toEqual(['a', 'b', 'd', 'c'])
  })

  it('formats the canonical discipline id for the class filter', () => {
    expect(readableIdentity('starter.aetherist')).toBe('Aetherist')
  })

  it('formats Primary and Secondary Disciplines together', () => {
    expect(readableDisciplinePair('vanguard', 'aetherist')).toBe('Vanguard | Aetherist')
    expect(readableDisciplinePair('cinderweaver', null)).toBe('Cinderweaver')
    expect(readableDisciplinePair(null, null)).toBeNull()
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
