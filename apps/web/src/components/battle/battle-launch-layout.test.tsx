import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/media/aurevane-image', () => ({
  AurevaneImage: () => createElement('img', { alt: '' }),
}))
vi.mock('./pvp-lobby-modal', () => ({ PvpLobbyModal: () => null }))

import { BattleLaunch } from './battle-launch'

describe('Battle Hall concept composition', () => {
  it('renders three real workspaces without selecting an AI battle or inventing public matches', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleLaunch, {
        characterId: 'character-1',
        characterName: 'Eira Vale',
      }),
    )
    expect(markup.match(/data-hall-workspace="/g)).toHaveLength(3)
    expect(markup).toContain('data-hall-scene="true"')
    expect(markup.match(/data-hall-scroll-body="true"/g)).toHaveLength(3)
    expect(markup.match(/data-hall-action-row="true"/g)).toHaveLength(2)
    expect(markup).toContain('AI Sparring')
    expect(markup).toContain('Create Battle Lobby')
    expect(markup).toContain('Join Battle Lobby')
    expect(markup).toContain('Spectate Battle')
    expect(markup).not.toContain('>Enter Battle<')
    expect(markup).not.toContain('Featured Matches')
  })

  it('separates lobby creation from key entry without losing either action', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleLaunch, { characterId: 'character-1', characterName: 'Eira Vale' }),
    )
    expect(markup).toContain('aria-label="PvP lobby actions"')
    expect(markup).toContain('data-pvp-entry="create"')
    expect(markup).toMatch(/data-pvp-entry="join"[^>]*hidden=""/)
    expect(markup).toContain('>Join by Key<')
    expect(markup).toContain('Create Battle Lobby')
    expect(markup).toContain('Join Battle Lobby')
  })

  it('describes the selected PvP format outside the dropdown', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleLaunch, { characterId: 'character-1', characterName: 'Eira Vale' }),
    )
    expect(markup).toContain('aria-describedby="pvp-format-description"')
    expect(markup).toMatch(
      /<p[^>]*id="pvp-format-description"[^>]*>Two combatants · one per side<\/p>/,
    )
  })
})
