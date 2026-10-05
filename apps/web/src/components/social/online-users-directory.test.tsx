import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OnlineUsersDirectory } from './online-users-directory'

const character = {
  characterId: 'character-one',
  name: 'Aster Vale',
  level: 12,
  xp: 12345,
  lastSeenAt: '2026-09-15T12:00:00Z',
  portraitRef: null,
  disciplineId: 'vanguard',
  secondaryDisciplineId: 'aetherist',
  personalTitle: 'The Patient Flame',
  imageUrl: null,
  // A UI must not expose extra properties even if a future response accidentally includes them.
  email: 'private-identity@example.test',
  currency: 'private-currency-value',
}

describe('Adventurers roster composition', () => {
  it('renders aligned identity rows with real public data, not the old card gallery', () => {
    const markup = renderToStaticMarkup(
      createElement(OnlineUsersDirectory, { characters: [character] }),
    )
    expect(markup).toContain('data-directory-table="true"')
    expect(markup).toContain('data-directory-character="true"')
    expect(markup).toContain('data-av-surface="ink"')
    expect(markup).toContain('Aster Vale')
    expect(markup).toContain('The Patient Flame')
    expect(markup).toContain('Vanguard | Aetherist')
    expect(markup).toContain('Show all characters')
    expect(markup).toContain('>EXP</span>')
    expect(markup).toContain('12,345')
    expect(markup).toContain('value="recent" selected=""')
    expect(markup).toContain('Level: highest first')
    expect(markup).toContain('EXP: highest first')
    expect(markup).toContain('data-online-users-heading="true"')
    expect(markup).not.toContain('Different paths. A shared world.')
    expect(markup).not.toContain(character.email)
    expect(markup).not.toContain(character.currency)
    expect(markup).not.toContain('data-av-surface="moonstone"')
  })

  it('keeps the honest online empty state instead of inventing players', () => {
    const markup = renderToStaticMarkup(createElement(OnlineUsersDirectory, { characters: [] }))
    expect(markup).toContain('No characters are currently visible online.')
    expect(markup).not.toContain('data-directory-character="true"')
  })

  it('shows unavailable EXP honestly when the public identity query has no value', () => {
    const markup = renderToStaticMarkup(
      createElement(OnlineUsersDirectory, { characters: [{ ...character, xp: null }] }),
    )
    expect(markup).toContain('EXP unavailable')
    expect(markup).toContain('>—</span>')
  })
})
