import { describe, expect, it } from 'vitest'
import {
  battleReturnNavigation,
  battleSessionHref,
  parseBattleReturnTo,
  type BattleReturnTo,
} from './battle-return-navigation'

describe('bounded battle return preferences', () => {
  it.each(['world', 'battle-hall'] as const)(
    'accepts the explicit %s navigation preference',
    (value) => {
      expect(parseBattleReturnTo(value)).toBe(value)
    },
  )
  it.each([
    undefined,
    null,
    '',
    'World',
    '/game/world',
    'https://example.com',
    ['world'],
    ['world', 'battle-hall'],
  ])('rejects unsupported or duplicate query value %s', (value) => {
    expect(parseBattleReturnTo(value)).toBeUndefined()
  })
  it('preserves only validated preferences in current-battle links', () => {
    expect(battleSessionHref('session', 'world')).toBe('/game/battle/session?returnTo=world')
    expect(battleSessionHref('session', 'battle-hall')).toBe(
      '/game/battle/session?returnTo=battle-hall',
    )
    expect(battleSessionHref('session')).toBe('/game/battle/session')
    expect(battleSessionHref('session', 'https://example.com' as BattleReturnTo)).toBe(
      '/game/battle/session',
    )
  })
  it.each([
    ['world', 'battle-hall', '/game/world', 'World Encounter · PvP Result'],
    ['battle-hall', 'world', '/game/battle', 'Battle Hall · PvP Result'],
    [undefined, 'world', '/game/world', 'PvP Result'],
    [undefined, 'battle-hall', '/game/battle', 'PvP Result'],
    [undefined, undefined, '/game/battle', 'PvP Result'],
  ] as const)(
    'resolves canonical %s origin and %s preference to a fixed destination',
    (origin, hint, href, eyebrow) => {
      expect(battleReturnNavigation(origin, hint)).toMatchObject({ href, eyebrow })
    },
  )
})
