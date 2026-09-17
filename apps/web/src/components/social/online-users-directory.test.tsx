import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OnlineUsersDirectory } from './online-users-directory'

const character = {
  characterId: 'character-one',
  name: 'Aster Vale',
  level: 12,
  lastSeenAt: '2026-09-15T12:00:00Z',
  portraitRef: null,
  disciplineId: 'vanguard',
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
    expect(markup).toContain('Vanguard')
    expect(markup).toContain('Show all characters')
    expect(markup).not.toContain(character.email)
    expect(markup).not.toContain(character.currency)
    expect(markup).not.toContain('data-av-surface="moonstone"')
  })

  it('keeps the honest online empty state instead of inventing players', () => {
    const markup = renderToStaticMarkup(createElement(OnlineUsersDirectory, { characters: [] }))
    expect(markup).toContain('No characters are currently visible online.')
    expect(markup).not.toContain('data-directory-character="true"')
  })
})
