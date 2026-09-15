import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OnlineUsersDirectory } from './online-users-directory'

const character = {
  characterId: 'character-one',
  name: 'Eira Vale',
  level: 12,
  lastSeenAt: '2026-09-15T09:00:00.000Z',
  portraitRef: null,
  disciplineId: 'lifebinder',
  personalTitle: 'Moonlit Wayfarer',
  imageUrl: null,
}

describe('Online Users concept directory', () => {
  it('renders portrait-led rows with explicit real-data column labels', () => {
    const markup = renderToStaticMarkup(
      createElement(OnlineUsersDirectory, { characters: [character] }),
    )
    expect(markup).toContain('aria-label="Adventurer rows"')
    expect(markup).toContain('data-directory-columns="true"')
    expect(markup).toContain('data-directory-row="true"')
    expect(markup).toContain('data-av-surface="ink"')
    expect(markup).toContain('Eira Vale')
    expect(markup).toContain('Lifebinder')
    expect(markup).toContain('Show all characters')
    expect(markup).not.toContain('Zone / Location')
    expect(markup).not.toContain('Staff')
  })

  it('does not invent a row for an empty online roster', () => {
    const markup = renderToStaticMarkup(createElement(OnlineUsersDirectory, { characters: [] }))
    expect(markup).toContain('No characters are currently visible online.')
    expect(markup).not.toContain('data-directory-row="true"')
  })

  it('does not render unknown private fields supplied alongside a public identity', () => {
    const markup = renderToStaticMarkup(
      createElement(OnlineUsersDirectory, {
        characters: [{ ...character, secretAccountName: 'PRIVATE_SENTINEL' } as typeof character],
      }),
    )
    expect(markup).not.toContain('PRIVATE_SENTINEL')
    expect(markup).not.toContain('Pronouns')
  })
})
